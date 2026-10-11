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
    .replace(/```[a-z0-9_-]*\s*/gi, " ")
    .replace(/```/g, " ")
    .replace(/[#>*_`~\-|!\\\[\](){}]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanQuestionStatement(statement: string): string {
  if (!statement) return "";
  return statement
    .replace(/\s*\(reformulaci[oó]n\s*\d*\)/gi, "")
    .replace(/\s*\(variante\s*\d*\)/gi, "")
    .replace(/\s*\(versi[oó]n\s*\d*\)/gi, "")
    .replace(/\s*\(pregunta\s+repetida\s*\d*\)/gi, "")
    .replace(/\s*\(duplicad[oa]\s*\d*\)/gi, "")
    .replace(/^(?:reformulaci[oó]n\s*\d*[:.-]\s*)+/gi, "")
    .replace(/^(?:variante\s*\d*[:.-]\s*)+/gi, "")
    .trim();
}

function normalizeStatementForComparison(statement: string): string {
  return normalizeForGrounding(cleanQuestionStatement(statement));
}

function getStatementJaccardSimilarity(str1: string, str2: string): number {
  const t1 = tokenize(str1, 2);
  const t2 = tokenize(str2, 2);
  if (t1.size === 0 && t2.size === 0) return 1;
  if (t1.size === 0 || t2.size === 0) return 0;
  let intersection = 0;
  t1.forEach((t) => {
    if (t2.has(t)) intersection++;
  });
  const union = new Set([...t1, ...t2]).size;
  return union > 0 ? intersection / union : 0;
}

function isDuplicateQuestion(candidateStatement: string, existingStatements: string[]): boolean {
  const normCandidate = normalizeStatementForComparison(candidateStatement);
  if (!normCandidate) return true;
  for (const existing of existingStatements) {
    const normExisting = normalizeStatementForComparison(existing);
    if (normCandidate === normExisting) return true;
    const similarity = getStatementJaccardSimilarity(candidateStatement, existing);
    if (similarity >= 0.85) return true;
  }
  return false;
}

function generateRephrasedStatement(
  statement: string,
  variantIndex: number,
  existingStatements: string[]
): string {
  const clean = cleanQuestionStatement(statement);
  const core = clean
    .replace(/^[¿?¡!]+/, "")
    .replace(/[¿?¡!]+$/, "")
    .trim();

  let variants: string[] = [];

  if (/^(?:que\s+es|que\s+define|que\s+significa|que\s+representa)\s+/i.test(core)) {
    const subject = core.replace(/^(?:que\s+es|que\s+define|que\s+significa|que\s+representa)\s+/i, "").trim();
    variants = [
      `En el contexto de la documentación técnica, ¿cuál es el concepto o propósito principal de ${subject}?`,
      `Identifica la afirmación correcta que define a ${subject}:`,
      `Respecto a ${subject}, ¿cuál de las siguientes opciones describe con mayor precisión sus características?`,
      `¿De qué manera se define ${subject} según los fundamentos explicados en el material?`,
      `¿Cuál de las siguientes alternativas resume fielmente el rol o alcance de ${subject}?`,
    ];
  } else if (/^(?:cual\s+es\s+la\s+funcion\s+de|para\s+que\s+sirve|que\s+funcion\s+cumple|como\s+se\s+utiliza)\s+/i.test(core)) {
    const subject = core.replace(/^(?:cual\s+es\s+la\s+funcion\s+de|para\s+que\s+sirve|que\s+funcion\s+cumple|como\s+se\s+utiliza)\s+/i, "").trim();
    variants = [
      `En un escenario práctico de aplicación, ¿cuál es la utilidad primordial de ${subject}?`,
      `¿Qué objetivo o resultado técnico se busca alcanzar al utilizar ${subject}?`,
      `Determina la responsabilidad principal o propósito de ${subject}:`,
      `Con relación a ${subject}, ¿en qué situación o con qué fin se debe emplear?`,
      `¿Cuál es el beneficio o función clave que aporta ${subject} en este entorno?`,
    ];
  } else if (/^(?:cual\s+de\s+las\s+siguientes|cual\s+de\s+los\s+siguientes|selecciona\s+la|identifica\s+la)\s+/i.test(core)) {
    const subject = core.replace(/^(?:cual\s+de\s+las\s+siguientes|cual\s+de\s+los\s+siguientes|selecciona\s+la|identifica\s+la)\s+/i, "").trim();
    variants = [
      `Considerando lo establecido en el documento de estudio, determina la opción acertada respecto a: ${subject}:`,
      `Analiza las alternativas disponibles e identifica la correcta sobre: ${subject}:`,
      `En relación con los temas analizados, selecciona la afirmación verídica acerca de: ${subject}:`,
      `De acuerdo con los estándares expuestos, ¿qué alternativa describe apropiadamente a: ${subject}?`,
    ];
  } else {
    variants = [
      `De acuerdo con lo expuesto en el material didáctico, ¿cuál es la alternativa correcta acerca de: ${core}?`,
      `Considerando la información técnica suministrada, selecciona la opción que responde a: ${core}:`,
      `En relación con los temas explicados, identifica la respuesta acertada sobre: ${core}:`,
      `Analizando los conceptos abordados en el documento, ¿qué opción describe con veracidad: ${core}?`,
      `Con base en los lineamientos estudiados, determina la opción válida respecto a: ${core}:`,
    ];
  }

  for (let i = 0; i < variants.length; i++) {
    const candidate = variants[(variantIndex + i) % variants.length];
    if (!isDuplicateQuestion(candidate, existingStatements)) {
      return candidate;
    }
  }

  return variants[variantIndex % variants.length];
}

function reformulateInOtherWords(
  seed: Record<string, unknown>,
  variantIndex: number,
  existingStatements: string[]
): Record<string, unknown> {
  const clone: Record<string, unknown> =
    typeof structuredClone === "function" ? structuredClone(seed) : JSON.parse(JSON.stringify(seed));

  const originalStatement = cleanQuestionStatement(toString(clone.statement, ""));
  const rephrased = generateRephrasedStatement(originalStatement, variantIndex, existingStatements);
  clone.statement = rephrased;

  const difficulties = ["easy", "medium", "hard"] as const;
  clone.difficulty = difficulties[(variantIndex + 1) % difficulties.length];

  if (Array.isArray(clone.options) && clone.options.length >= 2) {
    const opts = clone.options as Array<Record<string, unknown>>;
    const rot = ((variantIndex % (opts.length - 1)) + 1);
    const rotated = [...opts.slice(rot), ...opts.slice(0, rot)];
    clone.options = rotated.map((o, idx) => ({
      ...o,
      id: String.fromCharCode(97 + idx),
      text: cleanQuestionStatement(toString(o.text, "")).trim(),
    }));
  }

  return clone;
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
  const statement = cleanQuestionStatement(toString(q.statement, ""));
  if (!statement) return { ok: false, reason: "statement vacío" };

  const statementTokens = tokenize(statement, 3);
  const statementOverlap = overlapRatio(statement, index);
  const significantHits = [...statementTokens].filter((t) => index.tokenSet.has(t) || index.normalizedFull.includes(` ${t} `)).length;

  if (significantHits < 2 && statementOverlap < 0.20) {
    return { ok: false, reason: `statement tiene pocos términos del README (hits: ${significantHits}, overlap: ${Math.round(statementOverlap * 100)}%)` };
  }

  if (type === "single_choice" || type === "multiple_choice") {
    const opts = Array.isArray(q.options) ? (q.options as Array<Record<string, unknown>>) : [];
    if (!opts.length) return { ok: false, reason: "sin opciones" };
    const validOpts = opts.filter((o) => toString(o?.text, "").trim().length > 0);
    if (validOpts.length < 2) return { ok: false, reason: "menos de 2 opciones válidas" };
    const correctOptions = validOpts.filter((o) => o && typeof o === "object" && (o as { isCorrect?: unknown }).isCorrect === true);
    if (correctOptions.length === 0) return { ok: false, reason: "ninguna opción marcada como correcta" };
  }

  if (type === "open_concept") {
    const rules = (q.answerRules as Record<string, unknown> | undefined) ?? {};
    const kws = Array.isArray(rules.keywords) ? (rules.keywords as Array<Record<string, unknown>>) : [];
    const validKeywords = kws.filter((kw) => {
      const term = toString(kw?.term, "").trim();
      return term && index.normalizedFull.includes(normalizeForGrounding(term));
    });
    if (kws.length > 0 && validKeywords.length === 0) {
      return { ok: false, reason: "ningún keyword aparece en el README" };
    }
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
  const statement = cleanQuestionStatement(toString(raw.statement, "")).trim();
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
    base.options = normalizeOptions(rawOptions)
      .map((opt) => ({
        ...opt,
        text: cleanQuestionStatement(toString(opt.text, "")).trim(),
      }))
      .filter((o) => toString(o.text, "").trim());
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
  temperature?: number;
}) {
  const initialModel = normalizeGeminiModelId(params.modelVariant === "pro" ? params.modelPro : params.modelFlash);
  const flashModelId = normalizeGeminiModelId(params.modelFlash);
  const temperature = typeof params.temperature === "number" ? params.temperature : 0.35;

  async function requestWithModel(modelId: string) {
    const url = `${params.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`;
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": params.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: params.prompt }] }],
        generationConfig: { temperature, topP: 0.9, topK: 40, maxOutputTokens: 32000 },
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
    "Eres un evaluador académico experto en diseño de exámenes.",
    "Devuelve SOLO un JSON válido. No uses Markdown ni bloques con texto adicional fuera del JSON.",
    `Basate EXCLUSIVAMENTE en la siguiente documentación (Markdown):\n${documentationMarkdown}`,
    "",
    "REGLAS OBLIGATORIAS E INQUEBRANTABLES:",
    `- CANTIDAD EXACTA: DEBES generar EXACTAMENTE ${questionCount} preguntas en el campo "questions". Ni una más ni una menos.`,
    "- PROHIBIDO REPETIR PREGUNTAS (ESTRICTO): Todas y cada una de las preguntas deben tener un enunciado ÚNICO. No puede haber dos preguntas con redacción idéntica ni que pregunten exactamente lo mismo con leves cambios.",
    "- COBERTURA CUANDO EL CONTENIDO ES CORTO:",
    `  Si el contenido del README es breve para alcanzar las ${questionCount} preguntas requeridas, EVALÚA LOS MISMOS CONCEPTOS DESDE ÁNGULOS DIDÁCTICOS DIFERENTES Y OBLIGATORIAMENTE EXPRESADOS EN OTRAS PALABRAS:`,
    "  * Pregunta por el concepto teórico vs. su aplicación o caso de uso práctico.",
    "  * Pregunta por la sintaxis o comando exacto vs. el efecto o resultado de ejecutarlo.",
    "  * Pregunta por errores comunes, malas prácticas o contraejemplos explicados en el texto.",
    "  * Pregunta por contrastes o diferencias entre dos elementos descritos.",
    "  * Invierte el sentido: dada la definición o caso de uso, identificar cuál es el término correspondiente.",
    "  * Diseña opciones y distractores completamente NUEVOS para cada pregunta.",
    "- PROHIBIDO USAR ETIQUETAS DE REFORMULACIÓN: NUNCA agregues sufijos o leyendas como '(reformulación 1)', '(variante)', 'Reformulación:', etc. en el enunciado ni en las opciones. Los enunciados deben ser limpios, naturales y profesionales.",
    "- PRINCIPIO DE FIDELIDAD AL CONTENIDO: No inventes hechos, herramientas o términos que no aparezcan en la documentación.",
    "- Si el README contiene una sección 'Glosario', úsalo como fuente canónica de definiciones.",
    "- Si hay bloques de código o tablas, úsalos como fuente de verdad para preguntas prácticas.",
    "",
    "Objetivo:",
    `- Generar exactamente ${questionCount} preguntas para:`,
    `  - Materia: ${subjectName}`,
    `  - Grupo: ${groupName}`,
    `  - Momento: ${momentName}`,
    `- Tipos permitidos: ${allowedQuestionTypes.join(", ")}`,
    "- Reglas de formato por tipo:",
    "- Cada pregunta debe tener: type, statement, difficulty (easy|medium|hard), points (default 1), y opcionalmente 'sourceQuote'.",
    "- Si type es single_choice o multiple_choice: incluir options[] con text y marcar isCorrect: true en las correctas. Opciones claras y basadas en el texto.",
    "- Si type es open_concept: incluir answerRules { maxWords, passThreshold, keywords[{term,weight}] }.",
    "- Si type es puzzle_order: puzzle { items[{text,correctPosition}] }.",
    "- Si type es puzzle_match: puzzle { leftItems[{text}], rightItems[{text}], pairs[{leftId,rightId}] }.",
    "- Si type es puzzle_cloze: puzzle { templateText con {{slot_1}}, slots[{slotId, options[{text}], correctOptionId}] }.",
    "",
    "Formato de salida:",
    "{",
    '  "questions": [ { "type": "...", "statement": "...", "difficulty": "...", "points": 1, ... } ]',
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
        droppedReasons.push(`Q${i + 1}: pregunta duplicada o casi idéntica a otra`);
        continue;
      }
      acceptedQuestions.push(q);
      existingStatements.push(rawStatement);
    }

    // Si faltan preguntas para la cuota, realizar llamada adicional a Gemini con instrucciones de no repetir
    if (acceptedQuestions.length < questionCount) {
      const needed = questionCount - acceptedQuestions.length;
      const existingSummary = existingStatements
        .slice(0, 30)
        .map((s, idx) => `${idx + 1}. ${s}`)
        .join("\n");

      const refinePrompt = [
        "Eres un evaluador académico experto.",
        "Devuelve SOLO un JSON válido con formato: { \"questions\": [ ... ] }.",
        `Basate en esta documentación (Markdown):\n${documentationMarkdown}`,
        "",
        `Se necesitan exactamente ${needed} preguntas ADICIONALES para completar un banco de ${questionCount}.`,
        "REGLAS ESTRICTAS:",
        `- PROHIBIDO REPETIR: Ya existen las siguientes preguntas en el examen y NO DEBES repetirlas ni textual ni conceptualmente:`,
        existingSummary,
        `- Si el contenido del README es breve, EVALÚA LOS MISMOS CONCEPTOS DESDE OTROS ÁNGULOS DIDÁCTICOS (aplicación práctica, diferencias, errores comunes, sintaxis) PERO EXPRESADOS EN OTRAS PALABRAS y con opciones totalmente renovadas.`,
        "- PROHIBIDO agregar etiquetas o sufijos como '(reformulación 1)', '(variante)' o similares.",
        `- Tipos permitidos: ${allowedQuestionTypes.join(", ")}`,
        "",
        "Formato de salida:",
        '{ "questions": [ { "type": "...", "statement": "...", "difficulty": "...", "points": 1, ... } ] }',
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
      } catch {
        // En caso de error o límite de cuota, el fallback posterior completa de forma controlada
      }
    }

    // Si aún faltan preguntas (documentación muy breve), reformular conceptos en OTRAS PALABRAS sin repetir texto ni etiquetas
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
