import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

type GeminiModelVariant = "flash" | "pro";
type ReadmeBatchMetadata = {
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  momentId: string;
  momentName: string;
  questionCount: number;
  timeLimitMinutes: number;
  gradingScale: string;
  allowedQuestionTypes: string[];
};

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function normalizeForGrounding(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-|!\\\[\](){}]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string, minLen = 3) {
  const norm = normalizeForGrounding(text);
  const stop = new Set([
    "que","los","las","del","una","unos","unas","por","para","pero","sino","como","este","esta","estos","estas",
    "esto","aquel","aquella","aquellos","aquellas","hace","hacia","tambien","tampoco","entre","durante","sobre",
    "todo","todos","toda","todas","cual","cuales","donde","cuando","cuanto","cuanta","otros","otra","ante",
    "desde","hasta","contra","sin","mientras","despues","antes","aunque","entonces","luego","ahora","mismo",
    "misma","ellos","ellas","nosotros","vosotros","usted","tienen","tiene","hayan","hayas","ser","estar",
    "esta","estas","este","estos","sido","siendo","tambien","aqui","alli","cerca","lejos","parte","sido",
    "sido","muy","mas","menos","poco","mucho","tan","casi","solo","todo","nada","algo","nunca","siempre",
  ]);
  return new Set(
    norm
      .split(/\s+/)
      .filter((w) => w.length >= minLen && !stop.has(w)),
  );
}

type ReadmeGroundingIndex = {
  normalizedFull: string;
  tokenSet: Set<string>;
};

function buildReadmeGroundingIndex(markdown: string): ReadmeGroundingIndex {
  const normalized = normalizeForGrounding(markdown);
  return { normalizedFull: normalized, tokenSet: tokenize(markdown, 3) };
}

function overlapRatio(text: string, index: ReadmeGroundingIndex): number {
  const tokens = tokenize(text, 3);
  if (tokens.size === 0) return 0;
  let matched = 0;
  tokens.forEach((t) => {
    if (index.tokenSet.has(t) || index.normalizedFull.includes(` ${t} `) || index.normalizedFull.startsWith(t + " ") || index.normalizedFull.endsWith(" " + t)) {
      matched += 1;
    }
  });
  return matched / tokens.size;
}

function validateQuestionGrounding(q: Record<string, unknown>, index: ReadmeGroundingIndex): { ok: boolean; reason?: string } {
  const type = toString(q.type, "");
  const statement = toString(q.statement, "");
  if (!statement) return { ok: false, reason: "statement vacío" };

  const quote = toString(q.sourceQuote, "");
  const quoteOk = quote.length >= 10 && index.normalizedFull.includes(normalizeForGrounding(quote));

  const statementTokens = tokenize(statement, 3);
  const statementOverlap = overlapRatio(statement, index);
  const significantHits = [...statementTokens].filter((t) => index.tokenSet.has(t) || index.normalizedFull.includes(` ${t} `)).length;

  if (significantHits < 3) {
    return { ok: false, reason: `statement tiene solo ${significantHits} términos del README (>=3 requeridos)` };
  }
  if (statementOverlap < 0.45) {
    return { ok: false, reason: `statement coincide solo en ${Math.round(statementOverlap * 100)}% del vocabulario` };
  }

  if (type === "single_choice" || type === "multiple_choice") {
    const opts = Array.isArray(q.options) ? (q.options as Array<Record<string, unknown>>) : [];
    if (!opts.length) return { ok: false, reason: "sin opciones" };
    for (const o of opts) {
      const text = toString(o?.text, "");
      if (!text) continue;
      const ratio = overlapRatio(text, index);
      const tokenHits = [...tokenize(text, 3)].filter((t) => index.tokenSet.has(t)).length;
      if (text.length > 15 && tokenHits < 2 && ratio < 0.25) {
        return { ok: false, reason: `opción "${text.slice(0, 60)}" no está sustentada en README` };
      }
    }
    const correctOptions = opts.filter((o) => o && typeof o === "object" && (o as { isCorrect?: unknown }).isCorrect === true);
    for (const o of correctOptions) {
      const ratio = overlapRatio(toString(o.text, ""), index);
      if (ratio < 0.35) return { ok: false, reason: "opción correcta no coincide con el README" };
    }
  }

  if (type === "open_concept") {
    const rules = (q.answerRules as Record<string, unknown> | undefined) ?? {};
    const kws = Array.isArray(rules.keywords) ? (rules.keywords as Array<Record<string, unknown>>) : [];
    for (const kw of kws) {
      const term = toString(kw?.term, "").trim();
      if (!term) continue;
      if (!index.normalizedFull.includes(normalizeForGrounding(term))) {
        return { ok: false, reason: `keyword "${term}" no aparece en el README` };
      }
    }
  }

  if (quote && !quoteOk) {
    return { ok: false, reason: "sourceQuote no es substring del README" };
  }

  return { ok: true };
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

function parseMetadataScalar(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function extractReadmeBatchMetadata(markdown: string) {
  const startMarker = "<!-- BATCH_METADATA_START -->";
  const endMarker = "<!-- BATCH_METADATA_END -->";
  const start = markdown.indexOf(startMarker);
  const end = markdown.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false as const, error: "El README no contiene el bloque obligatorio de metadatos del JSON." };
  }

  const section = markdown.slice(start + startMarker.length, end).trim();
  const fenceMatch = section.match(/```(?:yaml|yml)?\s*([\s\S]*?)```/i);
  const raw = (fenceMatch?.[1] ?? section).trim();
  if (!raw) {
    return { ok: false as const, error: "El bloque de metadatos del README está vacío." };
  }

  const meta: Record<string, string | string[]> = {};
  let listKey = "";
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const listMatch = /^-\s+(.+)$/.exec(trimmed);
    if (listMatch && listKey) {
      const current = Array.isArray(meta[listKey]) ? (meta[listKey] as string[]) : [];
      current.push(parseMetadataScalar(listMatch[1]));
      meta[listKey] = current;
      return;
    }
    const scalarMatch = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(trimmed);
    if (!scalarMatch) return;
    const [, key, value] = scalarMatch;
    if (value.trim()) {
      meta[key] = parseMetadataScalar(value);
      listKey = "";
      return;
    }
    meta[key] = [];
    listKey = key;
  });

  const allowedRaw = Array.isArray(meta.allowedQuestionTypes) ? meta.allowedQuestionTypes : [];
  const allowedQuestionTypes = allowedRaw
    .map((item) => parseMetadataScalar(item))
    .filter(Boolean)
    .slice(0, 6);

  const questionCount = clamp(Number(parseMetadataScalar(String(meta.questionCount ?? ""))) || 0, 1, 200);
  const timeLimitMinutes = clamp(Number(parseMetadataScalar(String(meta.timeLimitMinutes ?? ""))) || 0, 1, 300);

  const parsed: ReadmeBatchMetadata = {
    subjectId: parseMetadataScalar(String(meta.subjectId ?? "")),
    subjectName: parseMetadataScalar(String(meta.subjectName ?? meta.subjectId ?? "")),
    groupId: parseMetadataScalar(String(meta.groupId ?? "")),
    groupName: parseMetadataScalar(String(meta.groupName ?? meta.groupId ?? "")),
    momentId: parseMetadataScalar(String(meta.momentId ?? "")),
    momentName: parseMetadataScalar(String(meta.momentName ?? meta.momentId ?? "")),
    questionCount,
    timeLimitMinutes,
    gradingScale: parseMetadataScalar(String(meta.gradingScale ?? "0_50")) || "0_50",
    allowedQuestionTypes,
  };

  if (!parsed.subjectId || !parsed.groupId || !parsed.momentId) {
    return {
      ok: false as const,
      error: "El README debe incluir subjectId, groupId y momentId en el bloque de metadatos.",
    };
  }
  if (!parsed.subjectName || !parsed.groupName || !parsed.momentName) {
    return {
      ok: false as const,
      error: "El README debe incluir subjectName, groupName y momentName en el bloque de metadatos.",
    };
  }
  if (!parsed.allowedQuestionTypes.length) {
    return {
      ok: false as const,
      error: "El README debe incluir allowedQuestionTypes en el bloque de metadatos.",
    };
  }
  if (!parsed.questionCount || !parsed.timeLimitMinutes) {
    return {
      ok: false as const,
      error: "El README debe incluir questionCount y timeLimitMinutes en el bloque de metadatos.",
    };
  }

  return { ok: true as const, value: parsed };
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
    if (type === "multiple_choice") base.partialCredit = raw.partialCredit === false ? false : true;
    delete (raw as Record<string, unknown>).sourceQuote;
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
        generationConfig: { temperature: 0.12, topP: 0.9, topK: 40, maxOutputTokens: 32000 },
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
    questionCount,
    timeLimitMinutes,
    gradingScale,
    allowedQuestionTypes,
  } = metadata.value;

  const apiKey = requiredEnv("AI_GEMINI_API_KEY");
  const baseUrl = (process.env.AI_GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const modelFlash = process.env.AI_GEMINI_MODEL_FLASH?.trim() || process.env.AI_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const modelPro = process.env.AI_GEMINI_MODEL_PRO?.trim() || "gemini-2.5-pro";

  const instruction = [
    "Eres un generador experto de preguntas para exámenes.",
    "Devuelve SOLO un JSON válido. No uses Markdown. No uses texto adicional.",
    `Basate EXCLUSIVAMENTE en esta documentación (Markdown):\n${documentationMarkdown}`,
    "",
    "REGLAS INQUEBRANTABLES (si se incumplen, el resultado es inválido):",
    "- PRINCIPIO DE NO INVENCIÓN (estricto): No puedes inventar NADA. NINGÚN concepto, término, definición, ejemplo, comando, nombre de archivo, versión, regla, persona ni hecho puede aparecer a menos que aparezca LITERALMENTE (o como derivado directo de un párrafo) en el Markdown adjunto.",
    "- PRINCIPIO DE CITA OBLIGATORIA: TODA pregunta DEBE estar anclada a un fragmento concreto del README. Incluye en cada pregunta un campo EXTRA temporal llamado 'sourceQuote' que sea una cadena LITERAL (copia + pega, sin reescribir) de al menos 15 y máximo 120 caracteres EXTRAÍDA DIRECTAMENTE del README y que justifique la respuesta correcta. Si no existe ese fragmento en el README, NO CREES la pregunta.",
    "- PROHIBIDO usar conocimientos generales, cultura general o hechos de la industria NO explícitos en el README. Si el README no menciona 'HEAD' en Git, no puedes preguntar por HEAD aunque tú lo sepas.",
    "- Si el README contiene una sección 'Glosario', úsalo PREFERENTEMENTE como fuente canónica de definiciones, términos y categorías al crear preguntas conceptuales.",
    "- Para preguntas prácticas (código, sintaxis, ejemplos), toma LOS BLOQUES DE CÓDIGO o tablas que ya existen en el README como única fuente de verdad. No inventes comandos ni sintaxis.",
    "- VERIFICACIÓN ANTES DE ESCRIBIR CADA PREGUNTA (mental check):",
    "  1) ¿Aparece literalmente en el README el término/concepto central del enunciado? Si NO → descártala.",
    "  2) ¿La respuesta correcta está explícita o se sigue estrictamente de un párrafo? Si NO → descártala.",
    "  3) ¿Tengo un fragmento >= 15 chars del README que lo demuestre? Si NO → descártala.",
    "  4) ¿Los distractores (opciones incorrectas) tampoco inventan conceptos nuevos? Si inventan → descártala.",
    "",
    `- DEBES generar EXACTAMENTE ${questionCount} preguntas, ni una menos ni una más. Si sientes que la información es escasa, REFORMULA las preguntas sobre los MISMOS conceptos QUE SÍ ESTÁN en el README PERO desde ángulos diferentes: ¿qué es?, ¿para qué sirve?, ¿cuál es la diferencia con X? (si X está en el README), ¿cuál es el error común?, relaciona concepto con ejemplo (del README), invierte pregunta, cambia distractores (siempre del README), usa otros tipos de pregunta, ajusta dificultad. NO DEBES devolver menos de ${questionCount}.`,
    "",
    "Los metadatos obligatorios del lote están dentro del README. No inventes ni alteres IDs, nombres, cantidades ni tipos permitidos.",
    "Objetivo:",
    `- Generar exactamente ${questionCount} preguntas para:`,
    `  - Materia: ${subjectName}`,
    `  - Grupo: ${groupName}`,
    `  - Momento: ${momentName}`,
    `- Tipos permitidos: ${allowedQuestionTypes.join(", ")}`,
    "- Reglas:",
    "- Cada pregunta debe tener: type, statement, difficulty (easy|medium|hard), points, y SOLO en esta generación el campo EXTRA 'sourceQuote' (después se elimina automáticamente).",
    "- Si type es single_choice o multiple_choice: incluir options[] con text y marcar isCorrect en las correctas. CADA opción (tanto correcta como incorrecta) debe provenir de textos del README.",
    "- Si type es open_concept: incluir answerRules { maxWords, passThreshold, keywords[{term,weight}] }. Los keywords DEBEN ser palabras reales que aparezcan en el README.",
    "- Si type es puzzle_order: puzzle { items[{text,correctPosition}] }. Cada item debe ser una línea o fragmento existente en el README.",
    "- Si type es puzzle_match: puzzle { leftItems[{text}], rightItems[{text}], pairs[{leftId,rightId}] }. Usa ids simples. Ambos lados deben venir del contenido del README.",
    "- Si type es puzzle_cloze: puzzle { templateText con {{slot_1}} etc, slots[{slotId, options[{text}], correctOptionId}] }. El texto y las opciones deben ser fragmentos literales del README.",
    "",
    "Formato de salida:",
    "{",
    '  "questions": [ { "type": "...", "statement": "...", "difficulty": "...", "points": 1, "sourceQuote": "frase literal de al menos 15 chars del README", ... }, ... ]',
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

    const readmeIndex = buildReadmeGroundingIndex(documentationMarkdown);
    const groundedChecks = rawQuestions.map((q) => ({ q, check: validateQuestionGrounding(q, readmeIndex) }));
    const groundedQuestions = groundedChecks.filter((x) => x.check.ok).map((x) => x.q);
    const droppedReasons = groundedChecks.filter((x) => !x.check.ok).map((x, i) => `Q${i + 1}: ${x.check.reason ?? "sin justificación"}`);

    let paddedQuestions: Array<Record<string, unknown>> = [...groundedQuestions];
    const difficulties = ["easy", "medium", "hard"] as const;
    const alternateTypes = ["single_choice", "multiple_choice", "single_choice", "multiple_choice"] as const;
    const seedQuestions = groundedQuestions.length > 0 ? groundedQuestions : rawQuestions;

    if (paddedQuestions.length < questionCount) {
      let seedIndex = 0;
      while (paddedQuestions.length < questionCount) {
        const seed = seedQuestions[seedIndex % seedQuestions.length];
        const clone: Record<string, unknown> =
          typeof structuredClone === "function" ? structuredClone(seed) : JSON.parse(JSON.stringify(seed));
        const shift = Math.floor(seedIndex / Math.max(1, seedQuestions.length));
        const targetType = alternateTypes[shift % alternateTypes.length];
        if (typeof clone === "object" && clone !== null) {
          const seedType = typeof clone.type === "string" ? clone.type : "";
          if ((seedType === "single_choice" || seedType === "multiple_choice") && targetType !== seedType) {
            clone.type = targetType;
            if (targetType === "multiple_choice" && Array.isArray(clone.options)) {
              const opts = clone.options as Array<Record<string, unknown>>;
              const correctIdxs = opts
                .map((o, i) => (o && typeof o === "object" && (o as { isCorrect?: unknown }).isCorrect === true ? i : -1))
                .filter((i) => i >= 0);
              if (correctIdxs.length === 1 && opts.length >= 2) {
                const extra = opts[(correctIdxs[0] + 1) % opts.length];
                if (extra && typeof extra === "object") (extra as { isCorrect: boolean }).isCorrect = true;
              }
            } else if (targetType === "single_choice" && Array.isArray(clone.options)) {
              const opts = clone.options as Array<Record<string, unknown>>;
              let firstCorrect = -1;
              for (let i = 0; i < opts.length; i++) {
                const o = opts[i];
                if (o && typeof o === "object" && (o as { isCorrect?: unknown }).isCorrect === true) {
                  if (firstCorrect === -1) firstCorrect = i;
                  else (o as { isCorrect: boolean }).isCorrect = false;
                }
              }
            }
          }
          const diff = difficulties[(shift + seedIndex) % difficulties.length];
          clone.difficulty = diff;
          if (typeof clone.statement === "string" && clone.statement) {
            const variants = [
              `${clone.statement} (reformulación ${shift + 1})`,
              `Según el material de estudio: ${clone.statement}`,
              `Con base en la documentación, responde: ${clone.statement}`,
            ];
            clone.statement = variants[shift % variants.length];
          }
          clone._variantKey = `v${shift}_${seedIndex}`;
        }
        paddedQuestions.push(clone);
        seedIndex++;
      }
    }

    const baseId = makeId(`${subjectId}_${momentId}`, new Date().toISOString()).replace(/^q_/, "");
    const normalizedQuestions = paddedQuestions.slice(0, questionCount).map((q, idx) =>
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
      groundingStats: {
        generated: rawQuestions.length,
        grounded: groundedQuestions.length,
        dropped: rawQuestions.length - groundedQuestions.length,
        droppedReasons: droppedReasons.slice(0, 12),
      },
      payload,
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible generar el JSON de preguntas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
