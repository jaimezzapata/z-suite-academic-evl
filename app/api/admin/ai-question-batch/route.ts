import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { GeminiModelVariant } from "@/lib/ai/types";
import {
  buildReadmeGroundingIndex,
  cleanQuestionStatement,
  isDuplicateQuestion,
  validateQuestionGrounding,
} from "@/lib/ai/question-similarity";
import {
  makeId,
  normalizeQuestion,
  reformulateInOtherWords,
} from "@/lib/ai/question-rephraser";
import {
  extractJsonObject,
  extractReadmeBatchMetadata,
  generateWithGemini,
} from "@/lib/ai/gemini-client";

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Falta ${name}.`);
  return value.trim();
}

async function assertAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return { ok: false as const, status: 401, error: "Unauthorized" };

  let adminAuth: ReturnType<typeof getAdminAuth>;
  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminAuth = getAdminAuth();
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales admin.";
    return { ok: false as const, status: 500, error: msg };
  }

  let uid = "";
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token inválido.";
    return { ok: false as const, status: 401, error: `Token inválido o expirado. ${msg}` };
  }

  const adminSnap = await adminDb.collection("admins").doc(uid).get();
  if (!adminSnap.exists) return { ok: false as const, status: 403, error: "Forbidden" };

  return { ok: true as const };
}

/**
 * Calcula la cuota exacta de preguntas por tipo:
 * - 50% entre múltiple y única respuesta (si están seleccionadas).
 * - 50% repartido equitativamente entre los demás tipos seleccionados (abierta, ordenar, emparejar, completar).
 * - Garantiza que CADA tipo seleccionado reciba al menos 1 pregunta.
 */
function calculateTypeQuotas(totalCount: number, allowedTypes: string[]): Record<string, number> {
  const cleanTypes = Array.from(new Set(allowedTypes.filter(Boolean)));
  if (cleanTypes.length === 0) return { single_choice: totalCount };

  const choiceTypes = cleanTypes.filter((t) => t === "single_choice" || t === "multiple_choice");
  const otherTypes = cleanTypes.filter((t) => t !== "single_choice" && t !== "multiple_choice");

  const quotas: Record<string, number> = {};
  cleanTypes.forEach((t) => {
    quotas[t] = 0;
  });

  // Si solo hay tipos de selección (única/múltiple)
  if (otherTypes.length === 0) {
    let remaining = totalCount;
    choiceTypes.forEach((t, i) => {
      const count = i === choiceTypes.length - 1 ? remaining : Math.round(totalCount / choiceTypes.length);
      quotas[t] = Math.max(1, count);
      remaining -= quotas[t];
    });
    return quotas;
  }

  // Si solo hay otros tipos (abierta, ordenar, emparejar, completar)
  if (choiceTypes.length === 0) {
    let remaining = totalCount;
    otherTypes.forEach((t, i) => {
      const count = i === otherTypes.length - 1 ? remaining : Math.round(totalCount / otherTypes.length);
      quotas[t] = Math.max(1, count);
      remaining -= quotas[t];
    });
    return quotas;
  }

  // Regla del usuario: 50% para múltiple/única, 50% repartido entre todas las demás
  const choiceTotal = Math.round(totalCount * 0.5);
  const otherTotal = totalCount - choiceTotal;

  // Repartir choiceTotal entre choiceTypes
  let remainingChoice = choiceTotal;
  choiceTypes.forEach((t, i) => {
    const count = i === choiceTypes.length - 1 ? remainingChoice : Math.round(choiceTotal / choiceTypes.length);
    quotas[t] = Math.max(1, count);
    remainingChoice -= quotas[t];
  });

  // Repartir otherTotal entre otherTypes garantizando que NINGUNO quede en 0
  let remainingOther = otherTotal;
  const baseOther = Math.max(1, Math.floor(otherTotal / otherTypes.length));
  let extraOther = otherTotal - baseOther * otherTypes.length;

  otherTypes.forEach((t, i) => {
    const add = extraOther > 0 ? 1 : 0;
    if (extraOther > 0) extraOther--;
    const count = i === otherTypes.length - 1 ? remainingOther : baseOther + add;
    quotas[t] = Math.max(1, count);
    remainingOther -= quotas[t];
  });

  // Ajuste fino para asegurar suma exacta a totalCount
  let sum = Object.values(quotas).reduce((a, b) => a + b, 0);
  while (sum > totalCount) {
    const maxKey = Object.keys(quotas).reduce((a, b) => (quotas[a] > quotas[b] ? a : b));
    if (quotas[maxKey] > 1) {
      quotas[maxKey]--;
      sum--;
    } else break;
  }
  while (sum < totalCount) {
    const targetKey = choiceTypes[0] || cleanTypes[0];
    quotas[targetKey]++;
    sum++;
  }

  return quotas;
}

export async function POST(req: Request) {
  const access = await assertAdmin(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const geminiVariantRaw = toString(body?.modelVariant, "flash").trim().toLowerCase();
  const geminiVariant: GeminiModelVariant = geminiVariantRaw === "pro" ? "pro" : "flash";

  const documentationMarkdown = toString(body?.documentationMarkdown, "").trim();
  if (!documentationMarkdown) {
    return NextResponse.json({ error: "Debes proporcionar la documentación (Markdown)." }, { status: 400 });
  }

  const metadata = extractReadmeBatchMetadata(documentationMarkdown);
  if (!metadata.ok) {
    return NextResponse.json({ error: metadata.error }, { status: 400 });
  }

  const {
    subjectId,
    subjectName,
    groupId,
    groupName,
    momentId,
    momentName,
    timeLimitMinutes,
    gradingScale,
  } = metadata.value;

  // Dar prioridad a los parámetros explícitos recibidos desde el cliente en el Paso 2
  const questionCount =
    typeof body?.questionCount === "number" && body.questionCount > 0
      ? body.questionCount
      : metadata.value.questionCount;

  const allowedQuestionTypes =
    Array.isArray(body?.allowedQuestionTypes) && body.allowedQuestionTypes.length > 0
      ? (body.allowedQuestionTypes as string[]).filter(Boolean)
      : metadata.value.allowedQuestionTypes;

  const typeQuotas = calculateTypeQuotas(questionCount, allowedQuestionTypes);
  const quotaLines = Object.entries(typeQuotas).map(
    ([type, count]) => `  - "${type}": EXACTAMENTE ${count} pregunta${count !== 1 ? "s" : ""}.`
  );

  const apiKey = requiredEnv("AI_GEMINI_API_KEY");
  const baseUrl = (process.env.AI_GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const modelFlash = process.env.AI_GEMINI_MODEL_FLASH?.trim() || process.env.AI_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const modelPro = process.env.AI_GEMINI_MODEL_PRO?.trim() || "gemini-2.5-pro";

  const instruction = [
    "Eres un evaluador académico experto en diseño de exámenes universitarios y técnicos.",
    "Devuelve SOLO un JSON válido. No uses Markdown ni bloques con texto adicional fuera del JSON.",
    `Basate EXCLUSIVAMENTE en la siguiente documentación (Markdown):\n${documentationMarkdown}`,
    "",
    "REGLAS OBLIGATORIAS E INQUEBRANTABLES DE CUOTAS Y TIPOS:",
    `- CANTIDAD TOTAL EXACTA: DEBES generar EXACTAMENTE ${questionCount} preguntas en el arreglo "questions".`,
    "- DISTRIBUCIÓN ESTRICTA POR TIPO (REGLA 50/50 OBLIGATORIA):",
    "  El 50% corresponde a selección única y múltiple, y el otro 50% se reparte entre los demás tipos seleccionados.",
    "  DEBES generar EXACTAMENTE la siguiente cantidad para CADA tipo:",
    ...quotaLines,
    "  IMPORTANTE: CADA tipo listado arriba DEBE tener preguntas en la salida final. PROHIBIDO dejar cualquiera en 0.",
    "",
    "- PROHIBIDO REPETIR PREGUNTAS (ESTRICTO): Todas y cada una de las preguntas deben tener un enunciado ÚNICO.",
    "- COBERTURA CUANDO EL CONTENIDO ES CORTO: Si la documentación es concisa, evalúa los conceptos desde diversos ángulos didácticos (teórico vs práctico, sintaxis vs efecto, casos de error, etc.).",
    "- NO USES ETIQUETAS DE REFORMULACIÓN: Los enunciados deben ser directos y naturales.",
    "",
    "REGLAS DE FORMATO POR CADA TIPO:",
    '1. Si type es "single_choice": options[] con 4 opciones (id: "a", "b", "c", "d") y marcar EXACTAMENTE UNA con isCorrect: true.',
    '2. Si type es "multiple_choice": options[] con 4 opciones y marcar 2 o más con isCorrect: true.',
    '3. Si type es "open_concept": incluir answerRules: { "maxWords": 60, "passThreshold": 0.6, "keywords": [ { "term": "palabra_clave", "weight": 1 } ] }.',
    '4. Si type es "puzzle_order": incluir puzzle: { "items": [ { "id": "i1", "text": "Paso 1...", "correctPosition": 1 }, { "id": "i2", "text": "Paso 2...", "correctPosition": 2 }, ... ] }.',
    '5. Si type es "puzzle_match": incluir puzzle: { "leftItems": [ { "id": "l1", "text": "Concepto 1" }, ... ], "rightItems": [ { "id": "r1", "text": "Definición 1" }, ... ], "pairs": [ { "leftId": "l1", "rightId": "r1" }, ... ] }.',
    '6. Si type es "puzzle_cloze": incluir puzzle: { "templateText": "Texto con {{slot_1}} y {{slot_2}}...", "slots": [ { "slotId": "slot_1", "correctOptionId": "opt_a", "options": [ { "id": "opt_a", "text": "..." }, { "id": "opt_b", "text": "..." } ] } ] }.',
    "",
    "Objetivo:",
    `- Generar exactamente ${questionCount} preguntas para Materia: ${subjectName}, Momento: ${momentName}.`,
    "",
    "Formato de salida:",
    "{",
    '  "questions": [',
    '    { "type": "...", "statement": "...", "difficulty": "medium", "points": 1, ... }',
    "  ]",
    "}",
  ].join("\n");

  try {
    const gen = await generateWithGemini({
      apiKey,
      baseUrl,
      modelVariant: geminiVariant,
      modelFlash,
      modelPro,
      prompt: instruction,
      temperature: 0.35,
    });
    if (!gen.ok) return NextResponse.json({ error: gen.error }, { status: gen.status });

    const extracted = extractJsonObject(gen.text);
    if (!extracted.ok) return NextResponse.json({ error: extracted.error, modelUsed: gen.modelUsed }, { status: 502 });

    const obj = extracted.value as Record<string, unknown>;
    const rawQuestions = Array.isArray(obj.questions) ? (obj.questions as Array<Record<string, unknown>>) : [];
    if (!rawQuestions.length) {
      return NextResponse.json({ error: "La IA no devolvió preguntas en el campo questions[].", modelUsed: gen.modelUsed }, { status: 502 });
    }

    const readmeIndex = buildReadmeGroundingIndex(documentationMarkdown);

    const acceptedQuestions: Array<Record<string, unknown>> = [];
    const existingStatements: string[] = [];
    const droppedReasons: string[] = [];

    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];
      const rawStatement = cleanQuestionStatement(toString(q.statement, ""));
      q.statement = rawStatement;
      const check = validateQuestionGrounding(q, readmeIndex);
      if (!check.ok) {
        droppedReasons.push(`Q${i + 1}: ${check.reason ?? "no pasó validación"}`);
        continue;
      }
      if (isDuplicateQuestion(rawStatement, existingStatements)) {
        droppedReasons.push(`Q${i + 1}: pregunta duplicada`);
        continue;
      }
      acceptedQuestions.push(q);
      existingStatements.push(rawStatement);
    }

    // Verificar si faltan preguntas en general o si falta cubrir algún tipo obligatorio
    const countsByType: Record<string, number> = {};
    acceptedQuestions.forEach((q) => {
      const t = toString(q.type, "single_choice");
      countsByType[t] = (countsByType[t] || 0) + 1;
    });

    const missingTypes = Object.entries(typeQuotas)
      .filter(([type, target]) => (countsByType[type] || 0) < target)
      .map(([type, target]) => ({ type, missing: target - (countsByType[type] || 0) }));

    if (acceptedQuestions.length < questionCount || missingTypes.length > 0) {
      const neededTotal = Math.max(
        questionCount - acceptedQuestions.length,
        missingTypes.reduce((acc, m) => acc + m.missing, 0)
      );

      const missingTypePrompt = missingTypes
        .map((m) => `  * "${m.type}": Generar ${m.missing} pregunta(s).`)
        .join("\n");

      const existingSummary = existingStatements
        .slice(0, 25)
        .map((s, idx) => `${idx + 1}. ${s}`)
        .join("\n");

      const refinePrompt = [
        "Eres un evaluador académico experto.",
        'Devuelve SOLO un JSON válido con formato: { "questions": [ ... ] }.',
        `Basate en esta documentación:\n${documentationMarkdown}`,
        "",
        `Se necesitan exactamente ${neededTotal} preguntas ADICIONALES para completar la cuota:`,
        missingTypePrompt || `Tipos permitidos: ${allowedQuestionTypes.join(", ")}`,
        "",
        "REGLAS ESTRICTAS:",
        "- CADA PREGUNTA DEBE SER ESTRICTAMENTE DE LOS TIPOS SOLICITADOS ARRIBA.",
        "- PROHIBIDO REPETIR las preguntas ya existentes:",
        existingSummary,
      ].join("\n");

      try {
        const genRefine = await generateWithGemini({
          apiKey,
          baseUrl,
          modelVariant: geminiVariant,
          modelFlash,
          modelPro,
          prompt: refinePrompt,
          temperature: 0.4,
        });

        if (genRefine.ok) {
          const extRefine = extractJsonObject(genRefine.text);
          if (extRefine.ok) {
            const refineObj = extRefine.value as Record<string, unknown>;
            const newQuestions = Array.isArray(refineObj.questions)
              ? (refineObj.questions as Array<Record<string, unknown>>)
              : [];
            for (const nq of newQuestions) {
              if (acceptedQuestions.length >= questionCount) break;
              const nStatement = cleanQuestionStatement(toString(nq.statement, ""));
              nq.statement = nStatement;
              const check = validateQuestionGrounding(nq, readmeIndex);
              if (check.ok && !isDuplicateQuestion(nStatement, existingStatements)) {
                acceptedQuestions.push(nq);
                existingStatements.push(nStatement);
              }
            }
          }
        }
      } catch (err) {
        console.error("Refine call error:", err);
      }
    }

    // Si aún faltan preguntas para completar la cuota total, reformular conceptos didácticamente
    if (acceptedQuestions.length < questionCount) {
      const seedPool = acceptedQuestions.length > 0 ? acceptedQuestions : rawQuestions;
      let seedIndex = 0;
      while (acceptedQuestions.length < questionCount && seedPool.length > 0) {
        const seed = seedPool[seedIndex % seedPool.length];
        const reformulated = reformulateInOtherWords(seed, seedIndex, existingStatements);
        const rephrasedStatement = cleanQuestionStatement(toString(reformulated.statement, ""));
        reformulated.statement = rephrasedStatement;
        acceptedQuestions.push(reformulated);
        existingStatements.push(rephrasedStatement);
        seedIndex++;
      }
    }

    const baseId = makeId(`${subjectId}_${momentId}`, new Date().toISOString()).replace(/^q_/, "");
    const normalizedQuestions = acceptedQuestions.slice(0, questionCount).map((q, idx) =>
      normalizeQuestion(q, {
        subjectId,
        groupId,
        momentId,
        baseId,
        index: idx,
      }),
    );

    const templateId = makeId(`exam_${subjectId}_${groupId}_${momentId}`, new Date().toISOString());
    const batchId = `${subjectId}.${groupId}.${momentId}.${Date.now().toString(36)}`;

    const payload = {
      schemaVersion: "1.0.0",
      batch: {
        batchId,
        importedAt: new Date().toISOString(),
        importMode: "append_only",
      },
      catalog: {
        groups: [{ id: groupId, name: groupName, active: true }],
        subjects: [{ id: subjectId, name: subjectName, active: true }],
        moments: [{ id: momentId, name: momentName, active: true }],
      },
      questions: normalizedQuestions,
      examTemplates: [
        {
          id: templateId,
          name: `${subjectName} - ${momentName} - ${groupName}`,
          subjectId,
          groupId,
          momentId,
          questionCount: normalizedQuestions.length,
          timeLimitMinutes,
          allowedQuestionTypes,
          accessCode: { mode: "generated_6_digits" },
          resultPolicy: { showScoreAfterSubmit: true, showAnswersAfterSubmit: false },
          gradingScale,
          studentRequiredFields: ["fullName", "documentId"],
        },
      ],
    };

    return NextResponse.json({
      ok: true,
      provider: "gemini",
      modelUsed: gen.modelUsed,
      quotasApplied: typeQuotas,
      groundingStats: {
        generated: rawQuestions.length,
        accepted: acceptedQuestions.length,
        dropped: droppedReasons.length,
        droppedReasons: droppedReasons.slice(0, 12),
      },
      payload,
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible generar el JSON de preguntas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
