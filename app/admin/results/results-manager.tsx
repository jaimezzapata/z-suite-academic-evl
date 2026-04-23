"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import { Eye, Trash2, Download, FileDown, FileSpreadsheet, Loader2, ArrowUpDown, Printer, FileArchive } from "lucide-react";
import { firestore } from "@/lib/firebase/client";
import { MinimalPagination } from "@/app/admin/ui/minimal-pagination";

type SnapshotQuestion = {
  id: string;
  questionId: string;
  order: number;
  type: string;
  statement: string;
  points: number;
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  partialCredit?: boolean;
  answerRules?: {
    maxWords?: number;
    keywords?: Array<{ term: string; weight: number }>;
    passThreshold?: number;
  };
  puzzle?: Record<string, unknown>;
};

type ResultRow = {
  id: string;
  examName: string;
  examCode: string;
  studentFullName: string;
  documentId: string;
  email: string;
  status: string;
  grade0to5: number;
  grade0to50: number;
  submittedAt: Date | null;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  fraudTotal: number;
  wrongCount: number;
  wrongDetails: string[];
};

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return ((value as { toDate: () => Date }).toDate() as Date) ?? null;
  }
  return null;
}

function formatDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColorHex(status: string) {
  const s = status.toLowerCase();
  if (s.includes("fraud")) return "FEE2E2";
  if (s.includes("expired")) return "FEF3C7";
  if (s.includes("submitted")) return "DCFCE7";
  return "E5E7EB";
}

function fraudRiskLabel(total: number) {
  if (total >= 11) return "Crítico";
  if (total >= 6) return "Alto";
  if (total >= 3) return "Moderado";
  return "Bajo";
}

function normalizeCsvCell(value: string | number) {
  const s = String(value);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toTextPreview(value: string, max = 120) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}...`;
}

function safeFilenamePart(value: string) {
  const compact = value.trim().replace(/\s+/g, " ");
  return compact
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[^a-zA-Z0-9 _.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64) || "archivo";
}

function parseWrongDetail(value: string) {
  const s = value.trim();
  const m = s.match(/^P(\d+):\s*(.*?)\s*\|\s*Respuesta:\s*(.*?)\s*\|\s*Motivo:\s*(.*)$/);
  if (!m) {
    return { number: null as number | null, statement: s, answer: "", reason: "" };
  }
  return {
    number: Number(m[1]),
    statement: m[2]?.trim() ?? "",
    answer: m[3]?.trim() ?? "",
    reason: m[4]?.trim() ?? "",
  };
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("fraud")) return "bg-rose-50 text-rose-700";
  if (s.includes("expired")) return "bg-amber-50 text-amber-800";
  if (s.includes("submitted")) return "bg-emerald-50 text-emerald-700";
  if (s.includes("annul")) return "bg-zinc-100 text-zinc-700";
  return "bg-zinc-100 text-zinc-700";
}

function resolveOptionText(q: SnapshotQuestion, optionId: string) {
  const opt = (q.options ?? []).find((o) => o.id === optionId);
  return opt ? toTextPreview(opt.text, 80) : optionId;
}

function answerPreview(q: SnapshotQuestion, answer: unknown) {
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

function reasonWrong(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") return "Opción seleccionada no corresponde a la correcta.";
  if (q.type === "multiple_choice") {
    return q.partialCredit
      ? "Combinación incompleta o incluye opciones incorrectas."
      : "Combinación no coincide exactamente con las respuestas correctas.";
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

function expectedAnswerPreview(q: SnapshotQuestion) {
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

function isAnswered(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") return typeof answer === "string" && answer.trim().length > 0;
  if (q.type === "multiple_choice") return Array.isArray(answer) && answer.length > 0;
  if (q.type === "open_concept") return typeof answer === "string" && answer.trim().length > 0;
  if (q.type === "puzzle_order") return Boolean(answer && typeof answer === "object" && Object.keys(answer as object).length > 0);
  if (q.type === "puzzle_match") return Boolean(answer && typeof answer === "object" && Object.keys(answer as object).length > 0);
  if (q.type === "puzzle_cloze") return Boolean(answer && typeof answer === "object" && Object.keys(answer as object).length > 0);
  return Boolean(answer);
}

function openConceptFeedback(q: SnapshotQuestion, answer: unknown) {
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

function evaluateQuestion(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") {
    const correct = q.options?.find((o) => o.isCorrect)?.id;
    return answer === correct ? q.points : 0;
  }

  if (q.type === "multiple_choice") {
    const selected = Array.isArray(answer) ? (answer as string[]) : [];
    const correct = (q.options ?? []).filter((o) => o.isCorrect).map((o) => o.id);
    const same = selected.length === correct.length && selected.every((x) => correct.includes(x));
    if (same) return q.points;

    if (!q.partialCredit) return 0;
    const correctSet = new Set(correct);
    const selectedSet = new Set(selected);
    const correctCount = correct.length || 1;
    let correctSelected = 0;
    let wrongSelected = 0;
    selectedSet.forEach((id) => {
      if (correctSet.has(id)) correctSelected += 1;
      else wrongSelected += 1;
    });
    const ratio = Math.max(0, (correctSelected - wrongSelected) / correctCount);
    return q.points * Math.min(1, ratio);
  }

  if (q.type === "open_concept") {
    const text = toString(answer, "").toLowerCase();
    const keywords = q.answerRules?.keywords ?? [];
    const maxWords = q.answerRules?.maxWords ?? 120;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > maxWords) return 0;
    const totalWeight = keywords.reduce((acc, x) => acc + (x.weight || 0), 0);
    if (!totalWeight) return 0;
    let scoreWeight = 0;
    keywords.forEach((k) => {
      if (text.includes(k.term.toLowerCase())) scoreWeight += k.weight;
    });
    const ratio = Math.min(1, scoreWeight / totalWeight);
    const threshold = typeof q.answerRules?.passThreshold === "number" ? q.answerRules.passThreshold : 0;
    if (ratio < threshold) return 0;
    return q.points * ratio;
  }

  if (q.type === "puzzle_order") {
    const positions = (answer as Record<string, number>) || {};
    const items = ((q.puzzle?.items as Array<Record<string, unknown>>) ?? []);
    if (!items.length) return 0;
    const ok = items.every((it) => positions[toString(it.id)] === toNumber(it.correctPosition, -1));
    return ok ? q.points : 0;
  }

  if (q.type === "puzzle_match") {
    const pairs = ((q.puzzle?.pairs as Array<Record<string, unknown>>) ?? []);
    const ans = (answer as Record<string, string>) || {};
    if (!pairs.length) return 0;
    const ok = pairs.every((p) => ans[toString(p.leftId)] === toString(p.rightId));
    return ok ? q.points : 0;
  }

  if (q.type === "puzzle_cloze") {
    const slots = ((q.puzzle?.slots as Array<Record<string, unknown>>) ?? []);
    const ans = (answer as Record<string, string>) || {};
    if (!slots.length) return 0;
    const ok = slots.every((s) => ans[toString(s.slotId)] === toString(s.correctOptionId));
    return ok ? q.points : 0;
  }

  return 0;
}

function isFullyCorrect(q: SnapshotQuestion, answer: unknown) {
  const earned = evaluateQuestion(q, answer);
  if (!Number.isFinite(earned)) return false;
  if (q.type === "open_concept") return earned > 0;
  return earned >= q.points && q.points > 0;
}

export function ResultsManager() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [examCodeFilter, setExamCodeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "in_progress" | "annulled" | "fraud">("all");
  const [onlyWithWrong, setOnlyWithWrong] = useState(false);
  const [onlyWithFraud, setOnlyWithFraud] = useState(false);
  const [sortKey, setSortKey] = useState<
    | "submittedAt"
    | "examName"
    | "examCode"
    | "studentFullName"
    | "status"
    | "grade0to5"
    | "grade0to50"
    | "fraudTotal"
    | "wrongCount"
  >("submittedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Record<string, true>>({});
  const [exporting, setExporting] = useState<"" | "csv" | "excel" | "pdf">("");
  const [exportingAttemptId, setExportingAttemptId] = useState<string | null>(null);
  const [exportingBulkZip, setExportingBulkZip] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResultRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
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
                  partialCredit: Boolean(row.partialCredit),
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
          const order = Array.isArray(a.questionOrder) ? (a.questionOrder as unknown[]).map((x) => toString(x)).filter(Boolean) : [];
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

        if (!cancelled) setRows(computed);
      } catch {
        if (!cancelled) setError("No fue posible cargar resultados desde Firestore.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const code = examCodeFilter.trim();
    return rows.filter((r) => {
      const bySearch =
        !q ||
        [r.examName, r.studentFullName, r.documentId, r.email, r.status, r.examCode].some((field) =>
          field.toLowerCase().includes(q),
        );
      const byCode = !code || r.examCode.includes(code);
      const byStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "fraud"
            ? r.status.toLowerCase().includes("fraud")
            : statusFilter === "submitted"
              ? r.status.toLowerCase().includes("submitted")
              : statusFilter === "annulled"
                ? r.status.toLowerCase().includes("annul")
                : r.status.toLowerCase().includes("in_progress");
      const byWrong = !onlyWithWrong || r.wrongCount > 0;
      const byFraud = !onlyWithFraud || r.fraudTotal > 0;
      return bySearch && byCode && byStatus && byWrong && byFraud;
    });
  }, [rows, search, examCodeFilter, statusFilter, onlyWithWrong, onlyWithFraud]);

  const visibleRows = useMemo(() => {
    const copy = [...filteredRows];
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (r: ResultRow) => {
      if (sortKey === "submittedAt") return r.submittedAt?.getTime?.() ?? 0;
      if (sortKey === "grade0to5") return r.grade0to5;
      if (sortKey === "grade0to50") return r.grade0to50;
      if (sortKey === "fraudTotal") return r.fraudTotal;
      if (sortKey === "wrongCount") return r.wrongCount;
      if (sortKey === "examName") return r.examName.toLowerCase();
      if (sortKey === "examCode") return r.examCode.toLowerCase();
      if (sortKey === "studentFullName") return r.studentFullName.toLowerCase();
      return r.status.toLowerCase();
    };
    copy.sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "es") * dir;
    });
    return copy;
  }, [filteredRows, sortKey, sortDir]);

  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = useMemo(() => {
    const start = safePage * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, safePage]);

  const selectedWrong = useMemo(() => {
    if (!selectedRow) return [];
    return selectedRow.wrongDetails.map(parseWrongDetail);
  }, [selectedRow]);

  const selectedCount = useMemo(() => Object.keys(selectedIds).length, [selectedIds]);
  const selectedRows = useMemo(() => visibleRows.filter((r) => Boolean(selectedIds[r.id])), [visibleRows, selectedIds]);
  const allVisibleSelected = useMemo(() => {
    if (!pagedRows.length) return false;
    return pagedRows.every((r) => Boolean(selectedIds[r.id]));
  }, [pagedRows, selectedIds]);

  async function confirmBulkDelete() {
    const ids = Object.keys(selectedIds);
    if (!ids.length) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      for (const id of ids) {
        await deleteDoc(doc(firestore, "attempts", id));
      }
      setRows((prev) => prev.filter((r) => !selectedIds[r.id]));
      setSelectedIds({});
      setBulkDeleteOpen(false);
      setSelectedRow((prev) => (prev && selectedIds[prev.id] ? null : prev));
    } catch {
      setDeleteError("No fue posible eliminar en masa. Revisa reglas/permisos de Firestore.");
    } finally {
      setDeleting(false);
    }
  }

  function downloadBlob(content: BlobPart, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function confirmDeleteAttempt() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteDoc(doc(firestore, "attempts", deleteTarget.id));
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      setSelectedRow((prev) => (prev?.id === deleteTarget.id ? null : prev));
    } catch {
      setDeleteError("No fue posible eliminar este intento. Revisa reglas/permisos de Firestore.");
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const headers = [
      "Examen",
      "Estudiante",
      "Código examen",
      "Documento",
      "Correo",
      "Estado",
      "Nota 0-5",
      "Nota 0-50",
      "Fraude pestaña",
      "Fraude copiar/pegar",
      "Fraude total",
      "Fecha envio",
      "Preguntas malas (cantidad)",
      "Preguntas malas (detalle)",
    ];
    const lines = [
      headers.map(normalizeCsvCell).join(","),
      ...visibleRows.map((r) =>
        [
          r.examName,
          r.studentFullName,
          r.examCode,
          r.documentId,
          r.email,
          r.status,
          r.grade0to5.toFixed(2),
          r.grade0to50.toFixed(2),
          r.fraudTabSwitches,
          r.fraudClipboardAttempts,
          r.fraudTotal,
          formatDate(r.submittedAt),
          r.wrongCount,
          r.wrongDetails.join(" || "),
        ]
          .map(normalizeCsvCell)
          .join(","),
      ),
    ];
    downloadBlob(`\uFEFF${lines.join("\n")}`, `reporte-resultados-${Date.now()}.csv`, "text/csv;charset=utf-8;");
  }

  async function exportExcel() {
    type ExcelCell = {
      value?: unknown;
      font?: unknown;
      alignment?: unknown;
      fill?: unknown;
      border?: unknown;
      numFmt?: unknown;
    } & Record<string, unknown>;
    type ExcelRow = { height?: number; eachCell: (cb: (cell: ExcelCell, col: number) => void) => void } & Record<string, unknown>;
    type ExcelWorksheet = {
      mergeCells: (ref: string) => void;
      getCell: (addr: string) => ExcelCell;
      getRow: (idx: number) => ExcelRow;
      addRow: (vals: unknown[]) => ExcelRow;
      columns?: Array<{ key?: string; width?: number }>;
      autoFilter?: string;
      eachRow: (cb: (row: ExcelRow, rowNumber: number) => void) => void;
    } & Record<string, unknown>;
    type ExcelWorkbook = {
      creator?: string;
      created?: Date;
      addWorksheet: (name: string, opts?: Record<string, unknown>) => ExcelWorksheet;
      xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
    } & Record<string, unknown>;
    type ExcelJsModule = { Workbook?: new () => ExcelWorkbook; default?: { Workbook?: new () => ExcelWorkbook } };

    const ExcelJSImport = (await import("exceljs")) as unknown;
    const mod = ExcelJSImport as ExcelJsModule;
    const WorkbookCtor = mod.Workbook ?? mod.default?.Workbook;
    if (!WorkbookCtor) throw new Error("No fue posible inicializar ExcelJS.");

    const workbook = new WorkbookCtor();
    workbook.creator = "Z-Suite Eval";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Resultados", {
      views: [{ state: "frozen", ySplit: 5 }],
    });

    ws.mergeCells("A1:K1");
    ws.getCell("A1").value = "Reporte de Resultados de Exámenes";
    ws.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    ws.getRow(1).height = 26;

    ws.mergeCells("A2:K2");
    ws.getCell("A2").value = `Generado: ${new Date().toLocaleString("es-CO")} • Registros: ${visibleRows.length}`;
    ws.getCell("A2").font = { size: 11, color: { argb: "FF334155" } };
    ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 20;

    const headers = [
      "Examen",
      "Código",
      "Estudiante",
      "Documento",
      "Correo",
      "Estado",
      "Nota 0-5",
      "Nota 0-50",
      "Fraude (T/C/Total)",
      "Riesgo fraude",
      "Fecha envío",
    ];
    ws.addRow(headers);
    ws.getRow(4).eachCell((cell: ExcelCell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
    ws.getRow(4).height = 24;

    visibleRows.forEach((r) => {
      const risk = fraudRiskLabel(r.fraudTotal);
      const row = ws.addRow([
        r.examName,
        r.examCode,
        r.studentFullName,
        r.documentId,
        r.email,
        r.status,
        Number(r.grade0to5.toFixed(2)),
        Number(r.grade0to50.toFixed(2)),
        `${r.fraudTabSwitches}/${r.fraudClipboardAttempts}/${r.fraudTotal}`,
        risk,
        formatDate(r.submittedAt),
      ]);
      row.height = 22;
      row.eachCell((cell: ExcelCell, col: number) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFF1F5F9" } },
          left: { style: "thin", color: { argb: "FFF1F5F9" } },
          bottom: { style: "thin", color: { argb: "FFF1F5F9" } },
          right: { style: "thin", color: { argb: "FFF1F5F9" } },
        };
        if (col === 6) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${statusColorHex(r.status)}` } };
        }
        if (col === 10) {
          const color = risk === "Crítico" ? "FFFECACA" : risk === "Alto" ? "FFFED7AA" : risk === "Moderado" ? "FFFEF3C7" : "FFDCFCE7";
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        }
        if (col === 7 || col === 8) {
          cell.numFmt = "0.00";
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });
    });

    ws.columns = [
      { key: "examen", width: 28 },
      { key: "codigo", width: 12 },
      { key: "estudiante", width: 24 },
      { key: "documento", width: 16 },
      { key: "correo", width: 28 },
      { key: "estado", width: 18 },
      { key: "nota5", width: 11 },
      { key: "nota50", width: 11 },
      { key: "fraude", width: 16 },
      { key: "riesgo", width: 14 },
      { key: "fecha", width: 20 },
    ];
    ws.autoFilter = "A4:K4";

    const detail = workbook.addWorksheet("Preguntas malas");
    detail.addRow(["Detalle de preguntas incorrectas por estudiante"]);
    detail.mergeCells("A1:G1");
    detail.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    detail.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
    detail.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    detail.getRow(1).height = 24;

    detail.addRow(["Examen", "Código", "Estudiante", "Documento", "Fraude total", "Pregunta #", "Detalle (respuesta + motivo)"]);
    detail.getRow(2).eachCell((cell: ExcelCell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4C1D95" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });

    visibleRows.forEach((r) => {
      if (!r.wrongDetails.length) {
        detail.addRow([r.examName, r.examCode, r.studentFullName, r.documentId, r.fraudTotal, "-", "Sin preguntas malas detectadas."]);
      } else {
        r.wrongDetails.forEach((d, idx) => {
          detail.addRow([r.examName, r.examCode, r.studentFullName, r.documentId, r.fraudTotal, idx + 1, d]);
        });
      }
    });
    detail.columns = [
      { width: 26 },
      { width: 10 },
      { width: 22 },
      { width: 16 },
      { width: 12 },
      { width: 10 },
      { width: 90 },
    ];
    detail.eachRow((row: ExcelRow, rowNumber: number) => {
      if (rowNumber <= 2) return;
      row.eachCell((cell: ExcelCell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });
    detail.autoFilter = "A2:G2";

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(buffer, `reporte-resultados-${Date.now()}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  async function exportPdf() {
    const jsPDFModule = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const jsPDF = jsPDFModule.default;
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("Reporte de Resultados de Exámenes", 24, 30);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString("es-CO")} • Registros: ${visibleRows.length}`, 24, 48);
    doc.setTextColor(17, 24, 39);

    autoTable(doc, {
      startY: 78,
      head: [[
        "Examen",
        "Código",
        "Estudiante",
        "Documento",
        "Estado",
        "0-5",
        "0-50",
        "Fraude",
        "Fecha",
        "Malas",
      ]],
      body: visibleRows.map((r) => [
        r.examName,
        r.examCode,
        r.studentFullName,
        r.documentId,
        r.status,
        r.grade0to5.toFixed(2),
        r.grade0to50.toFixed(2),
        String(r.fraudTotal),
        formatDate(r.submittedAt),
        String(r.wrongCount),
      ]),
      styles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55] },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const raw = (data.row.raw ?? []) as unknown[];
        const status = String(raw?.[4] ?? "");
        const fraud = Number(raw?.[7] ?? 0);
        if (data.column.index === 4) {
          if (status.toLowerCase().includes("fraud")) data.cell.styles.fillColor = [254, 226, 226];
          else if (status.toLowerCase().includes("expired")) data.cell.styles.fillColor = [254, 243, 199];
          else if (status.toLowerCase().includes("submitted")) data.cell.styles.fillColor = [220, 252, 231];
        }
        if (data.column.index === 7) {
          if (fraud >= 11) data.cell.styles.fillColor = [254, 202, 202];
          else if (fraud >= 6) data.cell.styles.fillColor = [254, 215, 170];
          else if (fraud >= 3) data.cell.styles.fillColor = [254, 243, 199];
          else data.cell.styles.fillColor = [220, 252, 231];
        }
      },
    });

    doc.addPage("landscape");
    const pageWidth2 = doc.internal.pageSize.getWidth();
    doc.setFillColor(76, 29, 149);
    doc.rect(0, 0, pageWidth2, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text("Detalle de Preguntas Malas por Estudiante", 24, 30);
    doc.setFontSize(10);
    doc.text("Incluye respuesta entregada y motivo de evaluación.", 24, 48);
    doc.setTextColor(17, 24, 39);
    autoTable(doc, {
      startY: 78,
      head: [["Estudiante", "Examen", "Código", "Fraude", "Preguntas malas"]],
      body: visibleRows.map((r) => [
        r.studentFullName,
        r.examName,
        r.examCode,
        String(r.fraudTotal),
        r.wrongDetails.join(" || ") || "Sin preguntas malas detectadas.",
      ]),
      styles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55], overflow: "linebreak" },
      headStyles: { fillColor: [76, 29, 149], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 245, 255] },
      columnStyles: { 4: { cellWidth: 180 } },
    });

    doc.save(`reporte-resultados-${Date.now()}.pdf`);
  }

  async function buildAttemptPdf(row: ResultRow): Promise<{ filename: string; blob: Blob }> {
    const attemptSnap = await getDoc(doc(firestore, "attempts", row.id));
    if (!attemptSnap.exists()) throw new Error("No se encontró el intento en Firestore.");

    const attempt = attemptSnap.data() as Record<string, unknown>;
    const publishedExamId = toString(attempt.publishedExamId, "");
    const examName = toString(attempt.examName, row.examName);
    const student = toString(attempt.studentFullName, row.studentFullName);
    const email = toString(attempt.email, row.email);
    const documentId = toString(attempt.documentId, row.documentId);
    const submittedAt = toDate(attempt.submittedAt) ?? row.submittedAt;
    const status = toString(attempt.status, row.status);
    const grade0to5 = toNumber(attempt.grade0to5, row.grade0to5);
    const grade0to50 = toNumber(attempt.grade0to50, row.grade0to50);
    const fraudTabSwitches = toNumber(attempt.fraudTabSwitches, row.fraudTabSwitches);
    const fraudClipboardAttempts = toNumber(attempt.fraudClipboardAttempts, row.fraudClipboardAttempts);
    const fraudTotal = fraudTabSwitches + fraudClipboardAttempts;
    const adminMessage = toString(attempt.adminMessage, "").trim();

    const examMetaSnap = publishedExamId ? await getDoc(doc(firestore, "publishedExams", publishedExamId)) : null;
    const accessCode = examMetaSnap?.exists()
      ? toString((examMetaSnap.data() as Record<string, unknown>).accessCode, row.examCode)
      : row.examCode;

    const qSnap = publishedExamId
      ? await getDocs(query(collection(firestore, "publishedExams", publishedExamId, "questions"), limit(400)))
      : null;
    const questions: SnapshotQuestion[] = (qSnap?.docs ?? [])
      .map((d) => {
        const q = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          questionId: toString(q.questionId, d.id),
          order: toNumber(q.order, 0),
          type: toString(q.type, "single_choice"),
          statement: toString(q.statement, ""),
          points: toNumber(q.points, 1),
          options: Array.isArray(q.options) ? (q.options as SnapshotQuestion["options"]) : undefined,
          partialCredit: Boolean(q.partialCredit),
          answerRules: (q.answerRules as SnapshotQuestion["answerRules"]) ?? undefined,
          puzzle: (q.puzzle as Record<string, unknown>) ?? undefined,
        } satisfies SnapshotQuestion;
      })
      .sort((a, b) => a.order - b.order);

    const answers = (attempt.answers as Record<string, unknown>) ?? {};
    const order = Array.isArray(attempt.questionOrder)
      ? (attempt.questionOrder as unknown[]).map((x) => toString(x)).filter(Boolean)
      : [];
    const byId = new Map(questions.map((q) => [q.questionId, q] as const));
    const orderedQuestions =
      order.length > 0
        ? [
            ...order.map((id) => byId.get(id)).filter((q): q is SnapshotQuestion => Boolean(q)),
            ...questions.filter((q) => !order.includes(q.questionId)),
          ]
        : questions;

    let totalPoints = 0;
    let earnedPoints = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const detailRows = orderedQuestions.map((q, idx) => {
      const ans = answers[q.questionId];
      const earned = evaluateQuestion(q, ans);
      const correct = isFullyCorrect(q, ans);
      const answered = isAnswered(q, ans);
      totalPoints += q.points;
      earnedPoints += earned;
      if (!answered) unansweredCount += 1;
      if (correct) correctCount += 1;
      else wrongCount += 1;
      const feedback =
        correct ? "Correcto." : q.type === "open_concept" ? openConceptFeedback(q, ans) : reasonWrong(q, ans);
      return {
        idx: idx + 1,
        statement: toTextPreview(q.statement, 260) || "-",
        studentAnswer: answerPreview(q, ans),
        expected: expectedAnswerPreview(q),
        score: `${Number.isFinite(earned) ? earned.toFixed(2) : "0.00"} / ${q.points.toFixed(2)}`,
        result: correct ? "Bien" : "Por mejorar",
        feedback,
      };
    });

    const jsPDFModule = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const jsPDF = jsPDFModule.default;
    const autoTable = autoTableModule.default;

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFillColor(109, 94, 246);
    pdf.rect(0, 0, pageWidth, 82, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.text("Resultado del Examen", 32, 36);
    pdf.setFontSize(10);
    pdf.text("Z-Suite Eval", 32, 58);

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(11);
    pdf.text(`Estudiante: ${student}`, 32, 112);
    pdf.text(`Documento: ${documentId} • Correo: ${email}`, 32, 132);
    pdf.text(`Examen: ${examName} • Código: ${accessCode}`, 32, 152);
    pdf.text(`Estado: ${status} • Enviado: ${formatDate(submittedAt)}`, 32, 172);

    const statY = 200;
    const cardW = (pageWidth - 32 * 2 - 12 * 3) / 4;
    const cardH = 64;
    const cards = [
      { label: "Nota", value: `${grade0to5.toFixed(2)} (${grade0to50.toFixed(0)}/50)` },
      { label: "Correctas", value: String(correctCount) },
      { label: "Por mejorar", value: String(wrongCount) },
      { label: "Fraude", value: String(fraudTotal) },
    ];
    cards.forEach((c, i) => {
      const x = 32 + i * (cardW + 12);
      pdf.setFillColor(255, 255, 255);
      (pdf as unknown as { roundedRect?: (...args: unknown[]) => void }).roundedRect?.(x, statY, cardW, cardH, 14, 14, "F");
      pdf.setDrawColor(230, 232, 240);
      (pdf as unknown as { roundedRect?: (...args: unknown[]) => void }).roundedRect?.(x, statY, cardW, cardH, 14, 14, "S");
      pdf.setTextColor(71, 85, 105);
      pdf.setFontSize(9);
      pdf.text(c.label, x + 14, statY + 22);
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(18);
      pdf.text(c.value, x + 14, statY + 48);
    });

    const generalLines: string[] = [];
    generalLines.push(`Puntaje: ${earnedPoints.toFixed(2)} / ${totalPoints.toFixed(2)} • Sin responder: ${unansweredCount}`);
    if (fraudTotal > 0) {
      generalLines.push(`Se detectaron eventos de fraude: pestaña ${fraudTabSwitches}, copiar/pegar ${fraudClipboardAttempts}.`);
    }
    if (adminMessage) {
      generalLines.push(`Mensaje del profesor: ${adminMessage}`);
    }
    if (!generalLines.length) {
      generalLines.push("Sin observaciones adicionales.");
    }

    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text("Retroalimentación general", 32, 296);
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    const wrap = pdf.splitTextToSize(generalLines.join("\n"), pageWidth - 64);
    pdf.text(wrap, 32, 316);

    pdf.addPage();
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageWidth, 56, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.text("Detalle por pregunta", 32, 34);
    pdf.setFontSize(10);
    pdf.text(`${student} • ${examName}`, 32, 50);

    pdf.setTextColor(15, 23, 42);
    autoTable(pdf, {
      startY: 76,
      head: [["#", "Resultado", "Pregunta", "Respuesta", "Esperada", "Puntaje", "Retroalimentación"]],
      body: detailRows.map((r) => [
        String(r.idx),
        r.result,
        r.statement,
        r.studentAnswer,
        r.expected,
        r.score,
        r.feedback,
      ]),
      styles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55], overflow: "linebreak" },
      headStyles: { fillColor: [109, 94, 246], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 247, 251] },
      columnStyles: {
        0: { cellWidth: 22, halign: "center" },
        1: { cellWidth: 70 },
        5: { cellWidth: 72, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 1) {
          const v = String((data.cell.raw ?? "") as string).toLowerCase();
          if (v.includes("bien")) data.cell.styles.fillColor = [220, 252, 231];
          if (v.includes("mejorar")) data.cell.styles.fillColor = [254, 226, 226];
        }
      },
    });

    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i += 1) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Z-Suite Eval • Página ${i} / ${totalPages}`, 32, pageHeight - 22);
    }

    const filename = `resultado-${safeFilenamePart(student)}-${safeFilenamePart(examName)}-${safeFilenamePart(accessCode)}.pdf`;
    const blob = pdf.output("blob");
    return { filename, blob };
  }

  async function exportAttemptPdf(row: ResultRow) {
    setExportingAttemptId(row.id);
    setError(null);
    try {
      const { filename, blob } = await buildAttemptPdf(row);
      downloadBlob(blob, filename, "application/pdf");
    } catch {
      setError("No fue posible generar el PDF del intento.");
    } finally {
      setExportingAttemptId(null);
    }
  }

  async function exportSelectedAttemptsZip() {
    if (!selectedRows.length) return;
    setExportingBulkZip(true);
    setError(null);
    try {
      type JSZipLike = { file: (name: string, data: Blob) => void; generateAsync: (opts: Record<string, unknown>) => Promise<Blob> };
      type JSZipCtor = new () => JSZipLike;
      const JSZipModule = (await import("jszip")) as unknown;
      const mod = JSZipModule as { default?: JSZipCtor };
      const JSZipCtor = mod.default ?? (JSZipModule as JSZipCtor);
      const zip = new JSZipCtor();
      const sorted = [...selectedRows].sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));

      for (const row of sorted) {
        try {
          const { filename, blob } = await buildAttemptPdf(row);
          zip.file(filename, blob);
        } catch {}
      }

      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      downloadBlob(zipBlob, `resultados-${Date.now()}.zip`, "application/zip");
    } catch {
      setError("No fue posible generar el archivo ZIP de los seleccionados.");
    } finally {
      setExportingBulkZip(false);
    }
  }

  async function handleExport(format: "csv" | "excel" | "pdf") {
    setExporting(format);
    try {
      if (format === "csv") exportCsv();
      if (format === "excel") await exportExcel();
      if (format === "pdf") await exportPdf();
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Resultados</h1>
          <p className="mt-1 text-sm text-foreground/65">
            Exporta resultados en Excel, CSV y PDF, incluyendo reporte de preguntas incorrectas por estudiante.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport("csv")}
            disabled={loading || !visibleRows.length || exporting !== ""}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void handleExport("excel")}
            disabled={loading || !visibleRows.length || exporting !== ""}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => void handleExport("pdf")}
            disabled={loading || !visibleRows.length || exporting !== ""}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full max-w-4xl flex-col gap-2 sm:flex-row">
            <input
              value={examCodeFilter}
              onChange={(e) => {
                setExamCodeFilter(e.target.value.replace(/\D/g, "").slice(0, 6));
                setPage(0);
              }}
              placeholder="Filtrar por código de examen (6 dígitos)..."
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por examen, estudiante, documento, correo o estado..."
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
            <div className="w-full sm:w-[360px]">
              <select
                aria-label="Estado"
                value={statusFilter}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === "all" || id === "submitted" || id === "in_progress" || id === "annulled" || id === "fraud") {
                    setStatusFilter(id);
                    setPage(0);
                  }
                }}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="all">Todos</option>
                <option value="submitted">Enviados</option>
                <option value="in_progress">En progreso</option>
                <option value="fraud">Fraude</option>
                <option value="annulled">Anulados</option>
              </select>
            </div>
          </div>
            <p className="text-sm text-zinc-600">
              {loading ? "Cargando..." : `${visibleRows.length} resultados`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={onlyWithWrong}
                  onChange={(e) => {
                    setOnlyWithWrong(e.target.checked);
                    setPage(0);
                  }}
                />
                Solo con malas
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={onlyWithFraud}
                  onChange={(e) => {
                    setOnlyWithFraud(e.target.checked);
                    setPage(0);
                  }}
                />
                Solo con fraude
              </label>
            </div>

            {selectedCount ? (
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <div className="text-sm font-semibold text-zinc-800">{selectedCount} seleccionados</div>
                <button
                  type="button"
                  onClick={() => void exportSelectedAttemptsZip()}
                  disabled={exportingBulkZip || exportingAttemptId !== null}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                  title="Descargar ZIP de seleccionados"
                >
                  <FileArchive className="h-4 w-4" />
                  ZIP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setBulkDeleteOpen(true);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  aria-label="Eliminar seleccionados"
                  title="Eliminar seleccionados"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds({})}
                  className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Limpiar selección
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando resultados...
          </div>
        ) : (
          <div className="mt-4">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="w-10 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds((prev) => {
                            const next = { ...prev };
                            pagedRows.forEach((r) => {
                              next[r.id] = true;
                            });
                            return next;
                          });
                        } else {
                          setSelectedIds((prev) => {
                            const next = { ...prev };
                            pagedRows.forEach((r) => {
                              delete next[r.id];
                            });
                            return next;
                          });
                        }
                      }}
                      aria-label="Seleccionar todo"
                      title="Seleccionar todo"
                    />
                  </th>
                  <th className="w-[38%] px-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("examName");
                        setSortDir((d) => (sortKey === "examName" ? (d === "asc" ? "desc" : "asc") : "asc"));
                        setPage(0);
                      }}
                      className="inline-flex items-center gap-1"
                    >
                      Examen <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="w-[28%] px-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("studentFullName");
                        setSortDir((d) => (sortKey === "studentFullName" ? (d === "asc" ? "desc" : "asc") : "asc"));
                        setPage(0);
                      }}
                      className="inline-flex items-center gap-1"
                    >
                      Estudiante <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="w-[12%] px-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("grade0to5");
                        setSortDir((d) => (sortKey === "grade0to5" ? (d === "asc" ? "desc" : "asc") : "desc"));
                        setPage(0);
                      }}
                      className="inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      0-5 <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="w-[10%] px-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("fraudTotal");
                        setSortDir((d) => (sortKey === "fraudTotal" ? (d === "asc" ? "desc" : "asc") : "desc"));
                        setPage(0);
                      }}
                      className="inline-flex items-center gap-1"
                    >
                      Fraude <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="w-[12%] px-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("submittedAt");
                        setSortDir((d) => (sortKey === "submittedAt" ? (d === "asc" ? "desc" : "asc") : "desc"));
                        setPage(0);
                      }}
                      className="inline-flex items-center gap-1"
                    >
                      Fecha <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="w-[120px] px-2 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 align-top">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedIds[r.id])}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = { ...prev };
                            if (e.target.checked) next[r.id] = true;
                            else delete next[r.id];
                            return next;
                          });
                        }}
                        aria-label="Seleccionar"
                        title="Seleccionar"
                      />
                    </td>
                    <td className="px-2 py-2 text-zinc-900">
                      <div className="truncate font-medium">{r.examName}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                        Código <span className="font-semibold text-zinc-700">{r.examCode}</span> •{" "}
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(r.status)}`}>
                          {r.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="truncate font-medium text-zinc-900">{r.studentFullName}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500">{r.documentId}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      <div className="font-semibold text-zinc-900">{r.grade0to5.toFixed(2)}</div>
                      <div className="text-xs text-zinc-500">{r.grade0to50.toFixed(0)} / 50</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-xs text-zinc-700">
                        <span className="font-semibold tabular-nums text-zinc-900">{r.fraudTotal}</span>
                        <span className="text-zinc-500"> / </span>
                        <span className={`font-semibold tabular-nums ${r.wrongCount > 0 ? "text-rose-700" : "text-zinc-500"}`}>
                          {r.wrongCount}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">Fraude / Malas</div>
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-600">{formatDate(r.submittedAt)}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(r)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                          aria-label="Ver detalle"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void exportAttemptPdf(r)}
                          disabled={exportingAttemptId === r.id || exportingBulkZip}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                          aria-label="Descargar PDF"
                          title="Descargar PDF"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(r);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          aria-label="Eliminar intento"
                          title="Eliminar intento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleRows.length ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">
                      No hay resultados para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <MinimalPagination
              pageCount={pageCount}
              page={safePage}
              onChange={(next) => setPage(Math.max(0, Math.min(pageCount - 1, next)))}
            />
          </div>
        )}
      </section>

      {selectedRow ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedRow(null)}
            aria-label="Cerrar detalle"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-5xl rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-y-8 sm:bottom-auto sm:rounded-3xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">Detalle del intento</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {selectedRow.studentFullName} • {selectedRow.examName} • Código {selectedRow.examCode}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {selectedRow.documentId} • {selectedRow.email} • {formatDate(selectedRow.submittedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void exportAttemptPdf(selectedRow)}
                  disabled={exportingAttemptId === selectedRow.id}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(selectedRow);
                  }}
                  className="inline-flex h-9 items-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Eliminar intento
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Nota 0-5</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums">
                  {selectedRow.grade0to5.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Nota 0-50</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums">
                  {selectedRow.grade0to50.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Malas</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-700 tabular-nums">
                  {selectedRow.wrongCount}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Solo se detallan al abrir cada pregunta.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Fraude</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums">
                  {selectedRow.fraudTotal}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Riesgo: <span className="font-semibold text-zinc-800">{fraudRiskLabel(selectedRow.fraudTotal)}</span> •{" "}
                  Pestaña {selectedRow.fraudTabSwitches} • Copiar/Pegar {selectedRow.fraudClipboardAttempts}
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-[58vh] overflow-y-auto rounded-2xl border border-zinc-200">
              {selectedWrong.length ? (
                <div className="divide-y divide-zinc-100">
                  {selectedWrong.map((d, idx) => (
                    <details key={`${selectedRow.id}-${idx}`} className="group px-4 py-3">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-950">
                              {d.number ? `Pregunta ${d.number}` : `Pregunta ${idx + 1}`}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{toTextPreview(d.statement, 220)}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 group-open:hidden">
                            Ver
                          </span>
                          <span className="hidden shrink-0 rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white group-open:inline-flex">
                            Ocultar
                          </span>
                        </div>
                      </summary>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl bg-zinc-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Respuesta</p>
                          <p className="mt-1 text-sm text-zinc-900">{d.answer || "Sin respuesta"}</p>
                        </div>
                        <div className="rounded-xl bg-zinc-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Motivo</p>
                          <p className="mt-1 text-sm text-zinc-900">{d.reason || "Sin motivo"}</p>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-emerald-700">
                  Sin preguntas malas detectadas en este intento.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => (deleting ? null : setDeleteTarget(null))}
            aria-label="Cerrar confirmación"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-y-16 sm:bottom-auto sm:rounded-3xl">
            <h3 className="text-lg font-semibold text-zinc-950">Eliminar intento</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Esto eliminará definitivamente el intento presentado de{" "}
              <span className="font-semibold text-zinc-900">{deleteTarget.studentFullName}</span>{" "}
              en{" "}
              <span className="font-semibold text-zinc-900">{deleteTarget.examName}</span>. No se puede deshacer.
            </p>

            {deleteError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {deleteError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteAttempt()}
                disabled={deleting}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDeleteOpen ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => (deleting ? null : setBulkDeleteOpen(false))}
            aria-label="Cerrar confirmación"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-y-16 sm:bottom-auto sm:rounded-3xl">
            <h3 className="text-lg font-semibold text-zinc-950">Eliminar en masa</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Esto eliminará definitivamente <span className="font-semibold text-zinc-900">{selectedCount}</span>{" "}
              intentos seleccionados. No se puede deshacer.
            </p>

            {deleteError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {deleteError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={deleting}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmBulkDelete()}
                disabled={deleting}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? "Eliminando..." : "Eliminar seleccionados"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
