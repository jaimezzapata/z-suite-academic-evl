import { collection, deleteDoc, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import {
  evaluateQuestion as evaluateQuestionShared,
  isQuestionFullyCorrect as isQuestionFullyCorrectShared,
  type GradingQuestion,
} from "@/lib/exam-grading";
import type { SnapshotQuestion, ResultRow, WrongDetail } from "../types";

export function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return ((value as { toDate: () => Date }).toDate() as Date) ?? null;
  }
  return null;
}

export function formatDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusColorHex(status: string) {
  const s = status.toLowerCase();
  if (s.includes("fraud")) return "FEE2E2";
  if (s.includes("expired")) return "FEF3C7";
  if (s.includes("submitted")) return "DCFCE7";
  return "E5E7EB";
}

export function fraudRiskLabel(total: number) {
  if (total >= 11) return "Crítico";
  if (total >= 6) return "Alto";
  if (total >= 3) return "Moderado";
  return "Bajo";
}

export function normalizeCsvCell(value: string | number) {
  const s = String(value);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toTextPreview(value: string, max = 120) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}...`;
}

export function safeFilenamePart(value: string) {
  const compact = value.trim().replace(/\s+/g, " ");
  return (
    compact
      .normalize("NFKD")
      .replace(/[\u0300-\u036F]/g, "")
      .replace(/[^a-zA-Z0-9 _.-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 64) || "archivo"
  );
}

export function parseWrongDetail(value: string): WrongDetail {
  const s = value.trim();
  const m = s.match(/^P(\d+):\s*(.*?)\s*\|\s*Respuesta:\s*(.*?)\s*\|\s*Motivo:\s*(.*)$/);
  if (!m) {
    return { number: null, statement: s, answer: "", reason: "" };
  }
  return {
    number: Number(m[1]),
    statement: m[2]?.trim() ?? "",
    answer: m[3]?.trim() ?? "",
    reason: m[4]?.trim() ?? "",
  };
}

export function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("fraud")) return "bg-rose-50 text-rose-700";
  if (s.includes("expired")) return "bg-amber-50 text-amber-800";
  if (s.includes("submitted")) return "bg-emerald-50 text-emerald-700";
  if (s.includes("annul")) return "bg-zinc-100 text-zinc-700";
  return "bg-zinc-100 text-zinc-700";
}

export function resolveOptionText(q: SnapshotQuestion, optionId: string) {
  const opt = (q.options ?? []).find((o) => o.id === optionId);
  return opt ? toTextPreview(opt.text, 80) : optionId;
}

export function answerPreview(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") {
    const id = toString(answer, "");
    if (!id) return "Sin respuesta";
    return resolveOptionText(q, id);
  }
  if (q.type === "multiple_choice") {
    const ids = Array.isArray(answer) ? (answer as string[]) : [];
    if (!ids.length) return "Sin respuesta";
    return ids.map((id) => resolveOptionText(q, id)).join(", ");
  }
  if (q.type === "open_concept") {
    return toTextPreview(toString(answer, "Sin respuesta"), 180);
  }
  if (q.type === "puzzle_order") {
    const map = (answer as Record<string, number>) || {};
    const parts = Object.entries(map)
      .slice(0, 6)
      .map(([k, v]) => `${k}:${v}`);
    return parts.length ? parts.join(", ") : "Sin respuesta";
  }
  if (q.type === "puzzle_match" || q.type === "puzzle_cloze") {
    const map = (answer as Record<string, string>) || {};
    const parts = Object.entries(map)
      .slice(0, 6)
      .map(([k, v]) => `${k}:${v}`);
    return parts.length ? parts.join(", ") : "Sin respuesta";
  }
  return toTextPreview(JSON.stringify(answer ?? "Sin respuesta"), 180);
}

export function reasonWrong(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") return "Opción seleccionada no corresponde a la correcta.";
  if (q.type === "multiple_choice") {
    const selected = Array.isArray(answer) ? (answer as string[]) : [];
    const correctIds = (q.options ?? []).filter((o) => Boolean(o.isCorrect)).map((o) => o.id);
    const wrongIds = (q.options ?? []).filter((o) => !Boolean(o.isCorrect)).map((o) => o.id);
    const correctSet = new Set(correctIds);
    const wrongSet = new Set(wrongIds);
    const okSelected = selected.filter((id) => correctSet.has(id)).length;
    const badSelected = selected.filter((id) => wrongSet.has(id)).length;
    const missing = correctIds.length - okSelected;
    const hasExtra = badSelected > 0;
    const parts: string[] = [];
    if (missing > 0) parts.push(`faltan ${missing} correcta${missing > 1 ? "s" : ""}`);
    if (hasExtra) parts.push(`${badSelected} opción${badSelected > 1 ? "es" : ""} incorrecta${badSelected > 1 ? "s" : ""} marcada${badSelected > 1 ? "s" : ""}`);
    if (!parts.length) return "Combinación no coincide con las respuestas correctas.";
    return `Calificación parcial: ${parts.join(", ")}.`;
  }
  if (q.type === "open_concept") {
    const text = toString(answer, "").toLowerCase();
    const maxWords = q.answerRules?.maxWords ?? 120;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > maxWords) return `Supera el máximo de palabras permitido (${maxWords}).`;
    const keywords = q.answerRules?.keywords ?? [];
    const matched = keywords.filter((k) => text.includes(k.term.toLowerCase())).length;
    return `Coincidencia insuficiente de palabras clave (${matched}/${keywords.length || 0}).`;
  }
  if (q.type === "puzzle_order") return "El orden asignado no coincide con el esperado.";
  if (q.type === "puzzle_match") return "Hay emparejamientos incorrectos.";
  if (q.type === "puzzle_cloze") return "Hay opciones incorrectas en los espacios.";
  return "Respuesta incorrecta según reglas de calificación.";
}

export function expectedAnswerPreview(q: SnapshotQuestion) {
  if (q.type === "single_choice") {
    const correct = q.options?.find((o) => o.isCorrect);
    return correct ? toTextPreview(correct.text, 120) : "No disponible";
  }
  if (q.type === "multiple_choice") {
    const correct = (q.options ?? []).filter((o) => o.isCorrect);
    if (!correct.length) return "No disponible";
    return correct.map((o) => toTextPreview(o.text, 60)).join(", ");
  }
  if (q.type === "open_concept") {
    const rules = q.answerRules;
    const keywords = (rules?.keywords ?? []).map((k) => k.term).filter(Boolean);
    const parts = [
      keywords.length ? `Palabras clave: ${keywords.slice(0, 14).join(", ")}${keywords.length > 14 ? "…" : ""}` : null,
      typeof rules?.maxWords === "number" ? `Máximo palabras: ${rules.maxWords}` : null,
      typeof rules?.passThreshold === "number" ? `Umbral: ${(rules.passThreshold * 100).toFixed(0)}%` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Respuesta abierta (sin criterio configurado)";
  }
  if (q.type === "puzzle_order") {
    const items = ((q.puzzle?.items as Array<Record<string, unknown>>) ?? []);
    const pairs = items
      .slice(0, 10)
      .map((it) => `${toString(it.id)}→${toNumber(it.correctPosition, -1)}`)
      .filter((x) => !x.endsWith("→-1"));
    return pairs.length ? `Orden esperado: ${pairs.join(", ")}${items.length > 10 ? "…" : ""}` : "Orden esperado: (no disponible)";
  }
  if (q.type === "puzzle_match") {
    const pairs = ((q.puzzle?.pairs as Array<Record<string, unknown>>) ?? []);
    const preview = pairs
      .slice(0, 10)
      .map((p) => `${toString(p.leftId)}→${toString(p.rightId)}`)
      .filter((x) => !x.endsWith("→"));
    return preview.length ? `Pares esperados: ${preview.join(", ")}${pairs.length > 10 ? "…" : ""}` : "Pares esperados: (no disponible)";
  }
  if (q.type === "puzzle_cloze") {
    const slots = ((q.puzzle?.slots as Array<Record<string, unknown>>) ?? []);
    const preview = slots
      .slice(0, 10)
      .map((s) => `${toString(s.slotId)}→${toString(s.correctOptionId)}`)
      .filter((x) => !x.endsWith("→"));
    return preview.length ? `Respuestas: ${preview.join(", ")}${slots.length > 10 ? "…" : ""}` : "Respuestas: (no disponible)";
  }
  return "No disponible";
}

export function isAnswered(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") return typeof answer === "string" && answer.trim().length > 0;
  if (q.type === "multiple_choice") return Array.isArray(answer) && answer.length > 0;
  if (q.type === "open_concept") return typeof answer === "string" && answer.trim().length > 0;
  if (q.type === "puzzle_order") return Boolean(answer && typeof answer === "object" && Object.keys(answer as object).length > 0);
  if (q.type === "puzzle_match") return Boolean(answer && typeof answer === "object" && Object.keys(answer as object).length > 0);
  if (q.type === "puzzle_cloze") return Boolean(answer && typeof answer === "object" && Object.keys(answer as object).length > 0);
  return Boolean(answer);
}

export function openConceptFeedback(q: SnapshotQuestion, answer: unknown) {
  const text = toString(answer, "").trim();
  if (!text) return "Sin respuesta.";
  const rules = q.answerRules;
  const maxWords = rules?.maxWords ?? 120;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) return `Supera el máximo de palabras permitido (${maxWords}). Reduce la extensión y responde de forma más concreta.`;
  const keywords = (rules?.keywords ?? []).map((k) => k.term).filter(Boolean);
  if (!keywords.length) return "Respuesta abierta: revisa que el concepto esté bien definido y sustentado.";
  const lower = text.toLowerCase();
  const matched = keywords.filter((k) => lower.includes(k.toLowerCase()));
  const missing = keywords.filter((k) => !lower.includes(k.toLowerCase()));
  const matchedHint = `Coincidencias: ${matched.length}/${keywords.length}.`;
  const missingHint = missing.length ? `Faltan: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}.` : "";
  return [matchedHint, missingHint].filter(Boolean).join(" ");
}

export function gradingQuestionFrom(q: SnapshotQuestion): GradingQuestion {
  return {
    questionId: q.questionId,
    type: q.type,
    points: q.points,
    options: q.options,
    partialCredit: Boolean(q.partialCredit ?? true),
    answerRules: q.answerRules,
    puzzle: q.puzzle,
  };
}

export function evaluateQuestion(q: SnapshotQuestion, answer: unknown) {
  return evaluateQuestionShared(gradingQuestionFrom(q), answer);
}

export function isFullyCorrect(q: SnapshotQuestion, answer: unknown) {
  return isQuestionFullyCorrectShared(gradingQuestionFrom(q), { [q.questionId]: answer });
}

export async function fetchResultsData(): Promise<ResultRow[]> {
  const attemptsSnap = await getDocs(query(collection(firestore, "attempts"), limit(800)));
  const attempts = attemptsSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string },
  );

  const publishedExamIds = Array.from(
    new Set(
      attempts
        .map((a) => toString(a.publishedExamId))
        .filter(Boolean),
    ),
  );

  const questionMap = new Map<string, SnapshotQuestion[]>();
  const examMetaMap = new Map<string, { accessCode: string }>();

  await Promise.all(
    publishedExamIds.map(async (examId) => {
      const examSnap = await getDoc(doc(firestore, "publishedExams", examId));
      if (examSnap.exists()) {
        const examRow = examSnap.data() as Record<string, unknown>;
        examMetaMap.set(examId, { accessCode: toString(examRow.accessCode, "") });
      }
      const qSnap = await getDocs(query(collection(firestore, "publishedExams", examId, "questions"), limit(400)));
      const questions = qSnap.docs
        .map((d) => {
          const row = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            questionId: toString(row.questionId, d.id),
            order: toNumber(row.order, 0),
            type: toString(row.type, "single_choice"),
            statement: toString(row.statement, ""),
            points: toNumber(row.points, 1),
            options: Array.isArray(row.options) ? (row.options as SnapshotQuestion["options"]) : undefined,
            partialCredit: Boolean(row.partialCredit ?? true),
            answerRules: (row.answerRules as SnapshotQuestion["answerRules"]) ?? undefined,
            puzzle: (row.puzzle as Record<string, unknown>) ?? undefined,
          } satisfies SnapshotQuestion;
        })
        .sort((a, b) => a.order - b.order);
      questionMap.set(examId, questions);
    }),
  );

  const computed: ResultRow[] = attempts.map((a) => {
    const examId = toString(a.publishedExamId);
    const examMeta = examMetaMap.get(examId);
    const questions = questionMap.get(examId) ?? [];
    const answers = (a.answers as Record<string, unknown>) ?? {};
    const order = Array.isArray(a.questionOrder)
      ? (a.questionOrder as unknown[]).map((x) => toString(x)).filter(Boolean)
      : [];
    const byId = new Map(questions.map((q) => [q.questionId, q] as const));
    const orderedQuestions =
      order.length > 0
        ? [
            ...order.map((id) => byId.get(id)).filter((q): q is SnapshotQuestion => Boolean(q)),
            ...questions.filter((q) => !order.includes(q.questionId)),
          ]
        : questions;

    const wrongDetails: string[] = [];
    orderedQuestions.forEach((q, idx) => {
      if (!isFullyCorrect(q, answers[q.questionId])) {
        wrongDetails.push(
          `P${idx + 1}: ${toTextPreview(q.statement)} | Respuesta: ${answerPreview(q, answers[q.questionId])} | Motivo: ${reasonWrong(
            q,
            answers[q.questionId],
          )}`,
        );
      }
    });

    const fraudTabSwitches = toNumber(a.fraudTabSwitches, 0);
    const fraudClipboardAttempts = toNumber(a.fraudClipboardAttempts, 0);
    const fraudTotal = fraudTabSwitches + fraudClipboardAttempts;

    return {
      id: a.id,
      examName: toString(a.examName, "Examen"),
      examCode: examMeta?.accessCode || "-",
      studentFullName: toString(a.studentFullName, "-"),
      documentId: toString(a.documentId, "-"),
      email: toString(a.email, "-"),
      status: toString(a.status, "-"),
      grade0to5: toNumber(a.grade0to5, 0),
      grade0to50: toNumber(a.grade0to50, 0),
      submittedAt: toDate(a.submittedAt),
      fraudTabSwitches,
      fraudClipboardAttempts,
      fraudTotal,
      wrongCount: wrongDetails.length,
      wrongDetails,
    };
  });

  computed.sort((a, b) => {
    const at = a.submittedAt?.getTime() ?? 0;
    const bt = b.submittedAt?.getTime() ?? 0;
    return bt - at;
  });

  return computed;
}

export async function deleteAttemptDoc(id: string) {
  await deleteDoc(doc(firestore, "attempts", id));
}

export async function deleteBulkAttemptDocs(ids: string[]) {
  for (const id of ids) {
    await deleteDoc(doc(firestore, "attempts", id));
  }
}
