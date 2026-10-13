import type { User } from "firebase/auth";
import type { CatalogItem, ReadmeBatchMetadata, ReadmeBatchMetadataResult } from "../types";

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
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

export function extractReadmeBatchMetadata(markdown: string): ReadmeBatchMetadataResult {
  const startMarker = "<!-- BATCH_METADATA_START -->";
  const endMarker = "<!-- BATCH_METADATA_END -->";
  const start = markdown.indexOf(startMarker);
  const end = markdown.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: "El README aún no tiene el bloque obligatorio de metadatos del JSON." };
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

  const allowedQuestionTypes = Array.isArray(meta.allowedQuestionTypes)
    ? (meta.allowedQuestionTypes as string[]).map((item) => parseMetadataScalar(item)).filter(Boolean)
    : [];

  const parsed: ReadmeBatchMetadata = {
    subjectId: parseMetadataScalar(String(meta.subjectId ?? "")),
    subjectName: parseMetadataScalar(String(meta.subjectName ?? meta.subjectId ?? "")),
    groupId: parseMetadataScalar(String(meta.groupId ?? "")),
    groupName: parseMetadataScalar(String(meta.groupName ?? meta.groupId ?? "")),
    momentId: parseMetadataScalar(String(meta.momentId ?? "")),
    momentName: parseMetadataScalar(String(meta.momentName ?? meta.momentId ?? "")),
    questionCount: Number(parseMetadataScalar(String(meta.questionCount ?? ""))) || 0,
    timeLimitMinutes: Number(parseMetadataScalar(String(meta.timeLimitMinutes ?? ""))) || 0,
    gradingScale: parseMetadataScalar(String(meta.gradingScale ?? "0_50")) || "0_50",
    allowedQuestionTypes,
  };

  if (
    !parsed.subjectId ||
    !parsed.groupId ||
    !parsed.momentId ||
    !parsed.subjectName ||
    !parsed.groupName ||
    !parsed.momentName ||
    !parsed.questionCount ||
    !parsed.timeLimitMinutes ||
    !parsed.allowedQuestionTypes.length
  ) {
    return { ok: false, error: "El README tiene metadatos incompletos para generar el JSON." };
  }

  return { ok: true, value: parsed };
}

export type GenerateReadmePayload = {
  topics: string;
  criteria: string;
  audience: string;
  context: string;
  lengthHint: string;
  modelVariant: "flash" | "pro";
  readmeTemplate: string;
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

export async function generateReadmeApi(
  user: User,
  payload: GenerateReadmePayload,
): Promise<{ ok: boolean; markdown?: string; modelUsed?: string | null; error?: string }> {
  try {
    const token = await user.getIdToken(true);
    const res = await fetch("/api/admin/ai-readme", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : "No fue posible generar el README.",
      };
    }
    return {
      ok: true,
      markdown: typeof data?.markdown === "string" ? data.markdown : "",
      modelUsed: typeof data?.modelUsed === "string" ? data.modelUsed : null,
    };
  } catch {
    return { ok: false, error: "No fue posible generar el README." };
  }
}

export async function generateQuestionBatchApi(
  user: User,
  modelVariant: "flash" | "pro",
  documentationMarkdown: string,
  questionCount?: number,
  allowedQuestionTypes?: string[],
): Promise<{ ok: boolean; payload?: unknown; modelUsed?: string | null; error?: string }> {
  try {
    const token = await user.getIdToken(true);
    const res = await fetch("/api/admin/ai-question-batch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        modelVariant,
        documentationMarkdown,
        questionCount,
        allowedQuestionTypes,
      }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : "No fue posible generar el JSON.",
      };
    }
    return {
      ok: true,
      payload: data?.payload,
      modelUsed: typeof data?.modelUsed === "string" ? data.modelUsed : null,
    };
  } catch {
    return { ok: false, error: "No fue posible generar el JSON." };
  }
}
