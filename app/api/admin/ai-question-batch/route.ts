import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

type GeminiModelVariant = "flash" | "pro";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Falta ${name}.`);
  return value.trim();
}

function normalizeGeminiModelId(nameOrId: string) {
  const value = nameOrId.trim();
  return value.startsWith("models/") ? value.slice("models/".length) : value;
}

function isNotFoundModelError(message: string) {
  const msg = message.toLowerCase();
  return msg.includes("is not found") || msg.includes("not supported for generatecontent");
}

function isQuotaExceededError(message: string) {
  const msg = message.toLowerCase();
  return msg.includes("quota exceeded") || msg.includes("exceeded your current quota") || msg.includes("rate limit");
}

async function listGeminiModels(apiKey: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/models`, {
    method: "GET",
    headers: { "x-goog-api-key": apiKey },
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const errMessage =
      toString((data?.error as Record<string, unknown> | null)?.message, "") ||
      toString(data?.error, "") ||
      "No fue posible listar modelos de Gemini.";
    return { ok: false as const, status: res.status, error: errMessage };
  }
  const models = (data?.models as Array<Record<string, unknown>> | undefined) ?? [];
  const normalized = models
    .map((m) => {
      const name = toString(m.name, "");
      const methods = (m.supportedGenerationMethods as string[] | undefined) ?? [];
      return { id: name ? normalizeGeminiModelId(name) : "", methods };
    })
    .filter((m) => m.id && m.methods.includes("generateContent"));
  return { ok: true as const, models: normalized };
}

function pickGeminiModelId(
  models: Array<{ id: string; methods: string[] }>,
  variant: GeminiModelVariant,
  fallbackId: string,
) {
  const wanted = variant === "pro" ? "pro" : "flash";
  const preferred = models.find((m) => m.id.toLowerCase().includes(wanted));
  return normalizeGeminiModelId(preferred?.id || fallbackId);
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

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return { ok: true as const, value: JSON.parse(trimmed) as unknown };
  } catch {}

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return { ok: false as const, error: "La IA no devolvió un JSON válido." };
  }
  const candidate = trimmed.slice(first, last + 1);
  try {
    return { ok: true as const, value: JSON.parse(candidate) as unknown };
  } catch {
    return { ok: false as const, error: "La IA no devolvió un JSON válido." };
  }
}

function makeId(prefix: string, seed: string) {
  const safe = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${safe || "auto"}_${rand}`;
}

function normalizeOptions(options: Array<Record<string, unknown>>) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  return options.map((opt, idx) => {
    const id = toString(opt.id, "") || alphabet[idx] || `o${idx + 1}`;
    const text = toString(opt.text, "").trim();
    const next: Record<string, unknown> = { ...opt, id, text };
    if (!("isCorrect" in next)) delete next.isCorrect;
    return next;
  });
}

function normalizeQuestion(
  raw: Record<string, unknown>,
  ctx: {
    subjectId: string;
    groupId: string;
    momentId: string;
    baseId: string;
    index: number;
  },
) {
  const type = toString(raw.type, "single_choice");
  const statement = toString(raw.statement, "").trim();
  const difficulty = toString(raw.difficulty, "medium");
  const points = toNumber(raw.points, 1);
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === "string") : undefined;

  const base: Record<string, unknown> = {
    id: `q_${ctx.baseId}_${String(ctx.index + 1).padStart(3, "0")}`,
    type,
    statement,
    subjectId: ctx.subjectId,
    groupIds: [ctx.groupId],
    momentIds: [ctx.momentId],
    difficulty,
    points,
    status: "published",
  };
  if (tags && tags.length) base.tags = tags.slice(0, 12);

  if (type === "single_choice" || type === "multiple_choice") {
    const rawOptions = Array.isArray(raw.options) ? (raw.options as Array<Record<string, unknown>>) : [];
    base.options = normalizeOptions(rawOptions).filter((o) => toString(o.text, "").trim());
    if (type === "multiple_choice" && typeof raw.partialCredit === "boolean") base.partialCredit = raw.partialCredit;
    return base;
  }

  if (type === "open_concept") {
    const rules = (raw.answerRules as Record<string, unknown> | undefined) ?? {};
    const keywords = Array.isArray(rules.keywords) ? (rules.keywords as Array<Record<string, unknown>>) : [];
    base.answerRules = {
      maxWords: toNumber(rules.maxWords, 60),
      passThreshold: toNumber(rules.passThreshold, 0.6),
      keywords: keywords
        .map((k) => ({ term: toString(k.term, "").trim(), weight: toNumber(k.weight, 1) }))
        .filter((k) => k.term),
    };
    return base;
  }

  if (type === "puzzle_order") {
    const puzzle = (raw.puzzle as Record<string, unknown> | undefined) ?? {};
    const items = Array.isArray(puzzle.items) ? (puzzle.items as Array<Record<string, unknown>>) : [];
    base.puzzle = {
      items: items
        .map((it, idx) => ({
          id: toString(it.id, "") || `i${idx + 1}`,
          text: toString(it.text, "").trim(),
          correctPosition: toNumber(it.correctPosition, idx + 1),
        }))
        .filter((it) => it.text),
    };
    return base;
  }

  if (type === "puzzle_match") {
    const puzzle = (raw.puzzle as Record<string, unknown> | undefined) ?? {};
    const leftItems = Array.isArray(puzzle.leftItems) ? (puzzle.leftItems as Array<Record<string, unknown>>) : [];
    const rightItems = Array.isArray(puzzle.rightItems) ? (puzzle.rightItems as Array<Record<string, unknown>>) : [];
    const pairs = Array.isArray(puzzle.pairs) ? (puzzle.pairs as Array<Record<string, unknown>>) : [];
    base.puzzle = {
      leftItems: normalizeOptions(leftItems).filter((o) => toString(o.text, "").trim()),
      rightItems: normalizeOptions(rightItems).filter((o) => toString(o.text, "").trim()),
      pairs: pairs
        .map((p) => ({ leftId: toString(p.leftId, ""), rightId: toString(p.rightId, "") }))
        .filter((p) => p.leftId && p.rightId),
    };
    return base;
  }

  if (type === "puzzle_cloze") {
    const puzzle = (raw.puzzle as Record<string, unknown> | undefined) ?? {};
    const slots = Array.isArray(puzzle.slots) ? (puzzle.slots as Array<Record<string, unknown>>) : [];
    base.puzzle = {
      templateText: toString(puzzle.templateText, "").trim(),
      slots: slots
        .map((s, idx) => {
          const options = Array.isArray(s.options) ? (s.options as Array<Record<string, unknown>>) : [];
          const normalized = normalizeOptions(options).filter((o) => toString(o.text, "").trim());
          const correctOptionId = toString(s.correctOptionId, "") || toString(normalized[0]?.id, "");
          return {
            slotId: toString(s.slotId, "") || `slot_${idx + 1}`,
            options: normalized,
            correctOptionId,
          };
        })
        .filter((s) => s.options.length >= 2 && s.correctOptionId),
    };
    return base;
  }

  return { ...base, type: "single_choice", options: normalizeOptions([]) };
}

async function generateWithGemini(params: {
  apiKey: string;
  baseUrl: string;
  modelVariant: GeminiModelVariant;
  modelFlash: string;
  modelPro: string;
  prompt: string;
}) {
  const initialModel = normalizeGeminiModelId(params.modelVariant === "pro" ? params.modelPro : params.modelFlash);
  const flashModelId = normalizeGeminiModelId(params.modelFlash);

  async function requestWithModel(modelId: string) {
    const url = `${params.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`;
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": params.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: params.prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });
  }

  const response = await requestWithModel(initialModel);
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  const readText = (payload: Record<string, unknown> | null) => {
    const candidates = (payload?.candidates as Array<Record<string, unknown>> | undefined) ?? [];
    const first = candidates[0] ?? {};
    const content = (first.content as Record<string, unknown> | undefined) ?? {};
    const parts = (content.parts as Array<Record<string, unknown>> | undefined) ?? [];
    return parts.map((p) => toString(p.text, "")).join("\n").trim();
  };

  if (!response.ok) {
    const errMessage =
      toString((data?.error as Record<string, unknown> | null)?.message, "") ||
      toString(data?.error, "") ||
      "No fue posible generar con Gemini.";

    if (params.modelVariant === "pro" && (response.status === 429 || response.status === 403 || isQuotaExceededError(errMessage))) {
      const retry = await requestWithModel(flashModelId);
      const retryData = (await retry.json().catch(() => null)) as Record<string, unknown> | null;
      if (retry.ok) {
        const text = readText(retryData);
        return { ok: true as const, modelUsed: flashModelId, text };
      }
      const retryErr =
        toString((retryData?.error as Record<string, unknown> | null)?.message, "") ||
        toString(retryData?.error, "") ||
        "No fue posible generar con Gemini.";
      return { ok: false as const, status: response.status, error: `${errMessage}. También falló Flash: ${retryErr}` };
    }

    if (response.status === 404 || isNotFoundModelError(errMessage)) {
      const listed = await listGeminiModels(params.apiKey, params.baseUrl);
      if (!listed.ok) {
        return {
          ok: false as const,
          status: response.status,
          error:
            `${errMessage} ` +
            `Además falló el listado de modelos (status ${listed.status}). ` +
            `Detalle listado: ${listed.error}`,
        };
      }
      if (listed.models.length === 0) {
        return { ok: false as const, status: response.status, error: `${errMessage} No hay modelos compatibles.` };
      }
      const modelId = pickGeminiModelId(listed.models, params.modelVariant, initialModel);
      const retry = await requestWithModel(modelId);
      const retryData = (await retry.json().catch(() => null)) as Record<string, unknown> | null;
      if (!retry.ok) {
        const retryErr =
          toString((retryData?.error as Record<string, unknown> | null)?.message, "") ||
          toString(retryData?.error, "") ||
          "No fue posible generar con Gemini.";
        const examples = listed.models
          .slice(0, 8)
          .map((m) => m.id)
          .join(", ");
        return {
          ok: false as const,
          status: retry.status,
          error: `${retryErr} Modelos detectados (ejemplos): ${examples}.`,
        };
      }
      const text = readText(retryData);
      return { ok: true as const, modelUsed: modelId, text };
    }

    return { ok: false as const, status: response.status, error: errMessage };
  }

  const text = readText(data);
  return { ok: true as const, modelUsed: initialModel, text };
}

export async function POST(req: Request) {
  const access = await assertAdmin(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const geminiVariantRaw = toString(body?.modelVariant, "flash").trim().toLowerCase();
  const geminiVariant: GeminiModelVariant = geminiVariantRaw === "pro" ? "pro" : "flash";

  const documentationMarkdown = toString(body?.documentationMarkdown, "").trim();
  const subjectId = toString(body?.subjectId, "").trim();
  const subjectName = toString(body?.subjectName, subjectId).trim();
  const groupId = toString(body?.groupId, "").trim();
  const groupName = toString(body?.groupName, groupId).trim();
  const momentId = toString(body?.momentId, "").trim();
  const momentName = toString(body?.momentName, momentId).trim();
  const questionCount = Math.max(1, Math.min(200, Math.floor(toNumber(body?.questionCount, 45))));
  const timeLimitMinutes = Math.max(1, Math.min(300, Math.floor(toNumber(body?.timeLimitMinutes, 60))));
  const gradingScale = toString(body?.gradingScale, "0_50").trim() || "0_50";

  const allowedTypesRaw = Array.isArray(body?.allowedQuestionTypes) ? body?.allowedQuestionTypes : [];
  const allowedQuestionTypes = (allowedTypesRaw as unknown[])
    .map((v) => toString(v, "").trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!documentationMarkdown) {
    return NextResponse.json({ error: "Debes proporcionar la documentación (Markdown)." }, { status: 400 });
  }
  if (!subjectId || !groupId || !momentId) {
    return NextResponse.json({ error: "Debes seleccionar materia, grupo y momento." }, { status: 400 });
  }
  if (!allowedQuestionTypes.length) {
    return NextResponse.json({ error: "Debes seleccionar al menos un tipo de pregunta." }, { status: 400 });
  }

  const apiKey = requiredEnv("AI_GEMINI_API_KEY");
  const baseUrl = (process.env.AI_GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const modelFlash = process.env.AI_GEMINI_MODEL_FLASH?.trim() || process.env.AI_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const modelPro = process.env.AI_GEMINI_MODEL_PRO?.trim() || "gemini-2.5-pro";

  const instruction = [
    "Eres un generador experto de preguntas para exámenes.",
    "Devuelve SOLO un JSON válido. No uses Markdown. No uses texto adicional.",
    `Basate EXCLUSIVAMENTE en esta documentación (Markdown):\n${documentationMarkdown}`,
    "",
    "Objetivo:",
    `- Generar exactamente ${questionCount} preguntas para:`,
    `  - Materia: ${subjectName}`,
    `  - Grupo: ${groupName}`,
    `  - Momento: ${momentName}`,
    `- Tipos permitidos: ${allowedQuestionTypes.join(", ")}`,
    "- Reglas:",
    "- Cada pregunta debe tener: type, statement, difficulty (easy|medium|hard), points.",
    "- Si type es single_choice o multiple_choice: incluir options[] con text y marcar isCorrect en las correctas.",
    "- Si type es open_concept: incluir answerRules { maxWords, passThreshold, keywords[{term,weight}] }.",
    "- Si type es puzzle_order: puzzle { items[{text,correctPosition}] }.",
    "- Si type es puzzle_match: puzzle { leftItems[{text}], rightItems[{text}], pairs[{leftId,rightId}] }. Usa ids simples.",
    "- Si type es puzzle_cloze: puzzle { templateText con {{slot_1}} etc, slots[{slotId, options[{text}], correctOptionId}] }.",
    "",
    "Formato de salida:",
    "{",
    '  "questions": [ ... ]',
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
    });
    if (!gen.ok) return NextResponse.json({ error: gen.error }, { status: gen.status });

    const extracted = extractJsonObject(gen.text);
    if (!extracted.ok) return NextResponse.json({ error: extracted.error, modelUsed: gen.modelUsed }, { status: 502 });

    const obj = extracted.value as Record<string, unknown>;
    const rawQuestions = Array.isArray(obj.questions) ? (obj.questions as Array<Record<string, unknown>>) : [];
    if (!rawQuestions.length) {
      return NextResponse.json({ error: "La IA no devolvió preguntas en el campo questions[].", modelUsed: gen.modelUsed }, { status: 502 });
    }

    const baseId = makeId(`${subjectId}_${momentId}`, new Date().toISOString()).replace(/^q_/, "");
    const normalizedQuestions = rawQuestions.slice(0, questionCount).map((q, idx) =>
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

    return NextResponse.json({ ok: true, provider: "gemini", modelUsed: gen.modelUsed, payload }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible generar el JSON de preguntas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
