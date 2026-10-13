import type { GeminiModelVariant, ReadmeBatchMetadata } from "./types";

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeGeminiModelId(nameOrId: string): string {
  const value = nameOrId.trim();
  return value.startsWith("models/") ? value.slice("models/".length) : value;
}

export function isNotFoundModelError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("is not found") || msg.includes("not supported for generatecontent");
}

export function isQuotaExceededError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("quota exceeded") || msg.includes("exceeded your current quota") || msg.includes("rate limit");
}

export async function listGeminiModels(apiKey: string, baseUrl: string) {
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

export function pickGeminiModelId(
  models: Array<{ id: string; methods: string[] }>,
  variant: GeminiModelVariant,
  fallbackId: string,
): string {
  const wanted = variant === "pro" ? "pro" : "flash";
  const preferred = models.find((m) => m.id.toLowerCase().includes(wanted));
  return normalizeGeminiModelId(preferred?.id || fallbackId);
}

export function extractJsonObject(text: string): { ok: boolean; value?: unknown; error?: string } {
  const trimmed = text.trim();
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch {}

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return { ok: false, error: "La IA no devolvió un JSON válido." };
  }
  const candidate = trimmed.slice(first, last + 1);
  try {
    return { ok: true, value: JSON.parse(candidate) as unknown };
  } catch {
    return { ok: false, error: "La IA no devolvió un JSON válido." };
  }
}

export type GenerateWithGeminiParams = {
  apiKey: string;
  baseUrl: string;
  modelVariant: GeminiModelVariant;
  modelFlash: string;
  modelPro: string;
  prompt: string;
  temperature?: number;
};

export type GenerateWithGeminiResult =
  | { ok: true; modelUsed: string; text: string }
  | { ok: false; status: number; error: string };

export async function generateWithGemini(params: GenerateWithGeminiParams): Promise<GenerateWithGeminiResult> {
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

    if (
      params.modelVariant === "pro" &&
      (response.status === 429 || response.status === 403 || isQuotaExceededError(errMessage))
    ) {
      const retry = await requestWithModel(flashModelId);
      const retryData = (await retry.json().catch(() => null)) as Record<string, unknown> | null;
      if (retry.ok) {
        const text = readText(retryData);
        return { ok: true, modelUsed: flashModelId, text };
      }
      const retryErr =
        toString((retryData?.error as Record<string, unknown> | null)?.message, "") ||
        toString(retryData?.error, "") ||
        "No fue posible generar con Gemini.";
      return { ok: false, status: response.status, error: `${errMessage}. También falló Flash: ${retryErr}` };
    }

    if (response.status === 404 || isNotFoundModelError(errMessage)) {
      const listed = await listGeminiModels(params.apiKey, params.baseUrl);
      if (!listed.ok) {
        return {
          ok: false,
          status: response.status,
          error:
            `${errMessage} ` +
            `Además falló el listado de modelos (status ${listed.status}). ` +
            `Detalle listado: ${listed.error}`,
        };
      }
      if (listed.models.length === 0) {
        return { ok: false, status: response.status, error: `${errMessage} No hay modelos compatibles.` };
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
          ok: false,
          status: retry.status,
          error: `${retryErr} Modelos detectados (ejemplos): ${examples}.`,
        };
      }
      const text = readText(retryData);
      return { ok: true, modelUsed: modelId, text };
    }

    return { ok: false, status: response.status, error: errMessage };
  }

  const text = readText(data);
  return { ok: true, modelUsed: initialModel, text };
}

export function parseMetadataScalar(value: string): string {
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

export function extractReadmeBatchMetadata(markdown: string): { ok: true; value: ReadmeBatchMetadata } | { ok: false; error: string } {
  const startMarker = "<!-- BATCH_METADATA_START -->";
  const endMarker = "<!-- BATCH_METADATA_END -->";
  const start = markdown.indexOf(startMarker);
  const end = markdown.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: "El README no contiene el bloque obligatorio de metadatos del JSON." };
  }

  const section = markdown.slice(start + startMarker.length, end).trim();
  const fenceMatch = section.match(/```(?:yaml|yml)?\s*([\s\S]*?)```/i);
  const raw = (fenceMatch?.[1] ?? section).trim();
  if (!raw) {
    return { ok: false, error: "El bloque de metadatos del README está vacío." };
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
      ok: false,
      error: "El README debe incluir subjectId, groupId y momentId en el bloque de metadatos.",
    };
  }
  if (!parsed.subjectName || !parsed.groupName || !parsed.momentName) {
    return {
      ok: false,
      error: "El README debe incluir subjectName, groupName y momentName en el bloque de metadatos.",
    };
  }
  if (!parsed.allowedQuestionTypes.length) {
    return {
      ok: false,
      error: "El README debe incluir allowedQuestionTypes en el bloque de metadatos.",
    };
  }
  if (!parsed.questionCount || !parsed.timeLimitMinutes) {
    return {
      ok: false,
      error: "El README debe incluir questionCount y timeLimitMinutes en el bloque de metadatos.",
    };
  }

  return { ok: true, value: parsed };
}
