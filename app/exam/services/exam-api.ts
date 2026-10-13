import type { PublishedExam, SnapshotQuestion } from "@/types";

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export interface AccessExamResponse {
  ok: boolean;
  error?: string;
  exam?: PublishedExam;
  questions?: SnapshotQuestion[];
}

export async function accessExamByCode(code: string): Promise<AccessExamResponse> {
  const c = code.trim();
  if (!/^\d{6}$/.test(c)) {
    return { ok: false, error: "El código debe tener 6 dígitos." };
  }

  const res = await fetch("/api/exam/access", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: c }),
  });

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.error === "string" ? data.error : "No fue posible cargar el examen.",
    };
  }

  const examRow = (data?.exam ?? null) as Record<string, unknown> | null;
  const exam: PublishedExam = {
    id: toString(examRow?.id, ""),
    templateId: toString(examRow?.templateId, ""),
    name: toString(examRow?.name, "Examen"),
    accessCode: toString(examRow?.accessCode, c),
    status: toString(examRow?.status, "published"),
    questionCount: toNumber(examRow?.questionCount, 0),
    timeLimitMinutes: toNumber(examRow?.timeLimitMinutes, 60),
    documentationMarkdown: toString(examRow?.documentationMarkdown, ""),
    fraudEnabled: toBoolean(examRow?.fraudEnabled, true),
  };

  if (!exam.id) {
    return { ok: false, error: "No fue posible cargar el examen." };
  }

  const qs = Array.isArray(data?.questions) ? (data?.questions as unknown[]) : [];
  const questions: SnapshotQuestion[] = qs.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    return {
      id: toString(row.id, ""),
      questionId: toString(row.questionId, toString(row.id, "")),
      order: toNumber(row.order, 0),
      type: toString(row.type, "single_choice"),
      statement: toString(row.statement, ""),
      points: toNumber(row.points, 1),
      options: Array.isArray(row.options) ? (row.options as SnapshotQuestion["options"]) : undefined,
      partialCredit: Boolean(row.partialCredit ?? true),
      answerRules: (row.answerRules as SnapshotQuestion["answerRules"]) ?? undefined,
      puzzle: (row.puzzle as Record<string, unknown>) ?? undefined,
    };
  });

  return { ok: true, exam, questions };
}

export interface StartAttemptParams {
  publishedExamId: string;
  accessCode: string;
  examTemplateId: string | null;
  examName: string;
  studentFirstName: string;
  studentLastName: string;
  studentFullName: string;
  documentId: string;
  email: string;
  questionCount: number;
  questionOrder: string[];
}

export interface StartAttemptResponse {
  ok: boolean;
  error?: string;
  attemptId?: string;
  startedAtMs?: number;
  fraudEnabled?: boolean | null;
}

export async function requestStartAttempt(params: StartAttemptParams): Promise<StartAttemptResponse> {
  const res = await fetch("/api/exam/attempt/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...params,
      templateId: params.examTemplateId,
    }),
  });

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.error === "string" ? data.error : "No fue posible validar el intento único.",
    };
  }

  const attemptId = typeof data?.attemptId === "string" ? data.attemptId : "";
  const startedAtMs = toNumber(data?.startedAtMs, Date.now());
  const fraudEnabled = typeof data?.fraudEnabled === "boolean" ? data.fraudEnabled : null;

  return { ok: true, attemptId, startedAtMs, fraudEnabled };
}

export interface SubmitAttemptParams {
  attemptId: string;
  accessCode: string;
  expired: boolean;
  forcedStatus?: "submitted" | "submitted_expired" | "submitted_fraud";
  forceZero?: boolean;
  answers: Record<string, unknown>;
  questionOrder: string[];
  currentQuestionIndex: number;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
}

export interface SubmitAttemptResponse {
  ok: boolean;
  error?: string;
  result?: Record<string, unknown>;
}

export async function requestSubmitAttempt(params: SubmitAttemptParams): Promise<SubmitAttemptResponse> {
  const res = await fetch("/api/exam/attempt/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = (isJson ? await res.json().catch(() => null) : null) as Record<string, unknown> | null;
  const text = !isJson ? await res.text().catch(() => "") : "";

  if (!res.ok) {
    const fromJson = typeof data?.error === "string" ? data.error : "";
    const normalized = text.replace(/\s+/g, " ").trim();
    const looksHtml =
      normalized.toLowerCase().startsWith("<!doctype") || normalized.toLowerCase().startsWith("<html");
    const fromText = normalized && !looksHtml ? normalized.slice(0, 220) : "";
    return {
      ok: false,
      error: fromJson || fromText || `HTTP ${res.status}: No fue posible enviar el examen.`,
    };
  }

  const result = (data?.result ?? null) as Record<string, unknown> | null;
  if (!result) {
    return { ok: false, error: "No fue posible enviar el examen." };
  }

  return { ok: true, result };
}
