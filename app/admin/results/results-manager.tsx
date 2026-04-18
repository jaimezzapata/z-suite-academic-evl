"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { ChevronDown, ChevronUp, FileText, Loader2, Trash2 } from "lucide-react";
import { firestore } from "@/lib/firebase/client";

type AttemptRow = {
  id: string;
  publishedExamId: string;
  examName: string;
  studentFullName: string;
  documentId: string;
  email: string;
  status: string;
  grade0to5: number;
  grade0to50: number;
  correctCount: number;
  questionCount: number;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  fraudPenalty0to5: number;
  submittedAt: Date | null;
  answers: Record<string, unknown>;
  questionOrder: string[];
};

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

type WrongDetail = {
  questionNumber: number;
  statement: string;
  answer: string;
  reason: string;
};

function toString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
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

function toTextPreview(value: string, max = 120) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}...`;
}

function resolveOptionText(q: SnapshotQuestion, optionId: string) {
  const opt = (q.options ?? []).find((o) => o.id === optionId);
  return opt ? toTextPreview(opt.text, 90) : optionId;
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
    return toTextPreview(toString(answer, "Sin respuesta"), 200);
  }
  return toTextPreview(JSON.stringify(answer ?? "Sin respuesta"), 200);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [examCodeById, setExamCodeById] = useState<Record<string, string>>({});

  const [search, setSearch] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "submittedAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState<AttemptRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRows, setDetailRows] = useState<WrongDetail[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AttemptRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(query(collection(firestore, "attempts"), orderBy("submittedAt", "desc"), limit(500)));
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string },
        );

        const mapped: AttemptRow[] = rows.map((r) => ({
          id: toString(r.id),
          publishedExamId: toString(r.publishedExamId),
          examName: toString(r.examName, "Examen"),
          studentFullName: toString(r.studentFullName, "-"),
          documentId: toString(r.documentId, "-"),
          email: toString(r.email, "-"),
          status: toString(r.status, "-"),
          grade0to5: toNumber(r.grade0to5, 0),
          grade0to50: toNumber(r.grade0to50, 0),
          correctCount: toNumber(r.correctCount, 0),
          questionCount: toNumber(r.questionCount, 0),
          fraudTabSwitches: toNumber(r.fraudTabSwitches, 0),
          fraudClipboardAttempts: toNumber(r.fraudClipboardAttempts, 0),
          fraudPenalty0to5: toNumber(r.fraudPenalty0to5, 0),
          submittedAt: toDate(r.submittedAt),
          answers: (r.answers && typeof r.answers === "object" ? (r.answers as Record<string, unknown>) : {}) ?? {},
          questionOrder: Array.isArray(r.questionOrder)
            ? (r.questionOrder as unknown[]).map((x) => (typeof x === "string" ? x : "")).filter(Boolean)
            : [],
        }));

        const uniqueExamIds = Array.from(new Set(mapped.map((a) => a.publishedExamId).filter(Boolean)));
        const codesEntries = await Promise.all(
          uniqueExamIds.map(async (id) => {
            const docSnap = await getDoc(doc(firestore, "publishedExams", id));
            if (!docSnap.exists()) return [id, ""] as const;
            const data = docSnap.data() as Record<string, unknown>;
            return [id, toString(data.accessCode, "")] as const;
          }),
        );
        const codeMap: Record<string, string> = {};
        codesEntries.forEach(([id, code]) => {
          codeMap[id] = code || "";
        });

        if (!cancelled) {
          setAttempts(mapped);
          setExamCodeById(codeMap);
        }
      } catch {
        if (!cancelled) setError("No fue posible cargar resultados. Revisa permisos o conexión.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const code = codeFilter.trim();
    return attempts.filter((a) => {
      const accessCode = examCodeById[a.publishedExamId] || "";
      const byCode = !code || accessCode.includes(code);
      const bySearch =
        !q ||
        [a.examName, a.studentFullName, a.documentId, a.email, a.status, accessCode]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return byCode && bySearch;
    });
  }, [attempts, examCodeById, search, codeFilter]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const key = sort.key;
    const toComparable = (a: AttemptRow): string | number => {
      const code = examCodeById[a.publishedExamId] || "";
      const total = Math.max(0, a.questionCount);
      const good = Math.min(Math.max(0, a.correctCount), total);
      const bad = Math.max(0, total - good);
      const fraudTotal = a.fraudTabSwitches + a.fraudClipboardAttempts;
      if (key === "examName") return a.examName.toLowerCase();
      if (key === "examCode") return code;
      if (key === "studentFullName") return a.studentFullName.toLowerCase();
      if (key === "documentId") return a.documentId;
      if (key === "status") return a.status.toLowerCase();
      if (key === "questionCount") return total;
      if (key === "fraudTotal") return fraudTotal;
      if (key === "grade0to5") return a.grade0to5;
      if (key === "grade0to50") return a.grade0to50;
      if (key === "submittedAt") return a.submittedAt?.getTime() ?? 0;
      return 0;
    };

    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = toComparable(a);
      const bv = toComparable(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "es-CO", { numeric: true, sensitivity: "base" }) * dir;
    });
    return copy;
  }, [examCodeById, filtered, sort.dir, sort.key]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [safePage, sorted]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
    setPage(1);
  }

  function SortHeader({ label, sortKey }: { label: string; sortKey: string }) {
    const active = sort.key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1 text-left font-medium text-zinc-500 hover:text-zinc-700"
      >
        <span>{label}</span>
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : null}
      </button>
    );
  }

  async function openDetail(attempt: AttemptRow) {
    setDetailAttempt(attempt);
    setDetailRows([]);
    setDetailError(null);
    setDetailOpen(true);
    setDetailLoading(true);
    setError(null);
    try {
      const examId = attempt.publishedExamId;
      const qSnap = await getDocs(query(collection(firestore, "publishedExams", examId, "questions"), orderBy("order", "asc"), limit(400)));
      const questions: SnapshotQuestion[] = qSnap.docs.map((d) => {
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
        };
      });

      const byId = new Map(questions.map((q) => [q.questionId, q] as const));
      const ordered =
        attempt.questionOrder.length
          ? [
              ...attempt.questionOrder.map((id) => byId.get(id)).filter((q): q is SnapshotQuestion => Boolean(q)),
              ...questions.filter((q) => !attempt.questionOrder.includes(q.questionId)),
            ]
          : questions;

      const wrong: WrongDetail[] = [];
      ordered.forEach((q, idx) => {
        const ans = attempt.answers[q.questionId];
        if (!isFullyCorrect(q, ans)) {
          wrong.push({
            questionNumber: idx + 1,
            statement: toTextPreview(q.statement, 240),
            answer: answerPreview(q, ans),
            reason: reasonWrong(q, ans),
          });
        }
      });
      setDetailRows(wrong);
    } catch {
      setDetailRows([]);
      setDetailError("No fue posible calcular detalle de preguntas.");
    } finally {
      setDetailLoading(false);
    }
  }

  function requestDelete(attempt: AttemptRow) {
    setDeleteTarget(attempt);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    const attempt = deleteTarget;
    if (!attempt) return;
    setDeletingId(attempt.id);
    setError(null);
    try {
      await deleteDoc(doc(firestore, "attempts", attempt.id));
      setAttempts((prev) => prev.filter((x) => x.id !== attempt.id));
      if (detailAttempt?.id === attempt.id) {
        setDetailOpen(false);
        setDetailAttempt(null);
        setDetailRows([]);
        setDetailError(null);
      }
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch {
      setError("No fue posible eliminar el intento. Revisa permisos de admin.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Resultados</h1>
          <p className="mt-1 text-sm text-zinc-600">Tabla ordenada de intentos enviados, notas, fraude y detalle.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full max-w-4xl flex-col gap-2 sm:flex-row">
            <input
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Filtrar por código de examen (6 dígitos)..."
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por examen, estudiante, documento, correo o estado..."
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
          <div className="text-sm text-zinc-600">
            {loading ? "Cargando..." : `${filtered.length} intentos`}
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
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2">
                      <SortHeader label="Examen" sortKey="examName" />
                    </th>
                    <th className="px-3 py-2">
                      <SortHeader label="Código" sortKey="examCode" />
                    </th>
                    <th className="px-3 py-2">
                      <SortHeader label="Estudiante" sortKey="studentFullName" />
                    </th>
                    <th className="px-3 py-2">
                      <SortHeader label="Documento" sortKey="documentId" />
                    </th>
                    <th className="px-3 py-2">
                      <SortHeader label="Estado" sortKey="status" />
                    </th>
                    <th className="px-3 py-2">
                      <SortHeader label="Preguntas" sortKey="questionCount" />
                    </th>
                    <th className="px-3 py-2">
                      <SortHeader label="Fraude" sortKey="fraudTotal" />
                    </th>
                    <th className="px-3 py-2">
                      <SortHeader label="0-5" sortKey="grade0to5" />
                    </th>
                    <th className="px-3 py-2">
                      <SortHeader label="0-50" sortKey="grade0to50" />
                    </th>
                    <th className="px-3 py-2">Detalle</th>
                    <th className="px-3 py-2">Eliminar</th>
                    <th className="px-3 py-2">
                      <SortHeader label="Fecha" sortKey="submittedAt" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((a) => {
                    const code = examCodeById[a.publishedExamId] || "-";
                    const total = Math.max(0, a.questionCount);
                    const good = Math.min(Math.max(0, a.correctCount), total);
                    const bad = Math.max(0, total - good);
                    const fraudTotal = a.fraudTabSwitches + a.fraudClipboardAttempts;
                    return (
                      <tr key={a.id} className="border-b border-zinc-100 align-top">
                        <td className="px-3 py-2 text-zinc-900">{a.examName}</td>
                        <td className="px-3 py-2 font-semibold tracking-[0.25em] text-zinc-900">{code}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-zinc-900">{a.studentFullName}</p>
                          <p className="text-xs text-zinc-500">{a.email}</p>
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{a.documentId}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{a.status}</span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-zinc-900">{total}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-zinc-900">{fraudTotal}</p>
                          <p className="text-[11px] text-zinc-500">
                            Pestaña {a.fraudTabSwitches} • Copy {a.fraudClipboardAttempts}
                          </p>
                        </td>
                        <td className="px-3 py-2 font-semibold text-zinc-900">{a.grade0to5.toFixed(2)}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-900">{a.grade0to50.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void openDetail(a)}
                            className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            <FileText className="h-4 w-4" />
                            Ver
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => requestDelete(a)}
                            disabled={deletingId === a.id}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            title="Eliminar intento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-zinc-600">{formatDate(a.submittedAt)}</td>
                      </tr>
                    );
                  })}
                  {!paginated.length ? (
                    <tr>
                      <td colSpan={13} className="px-3 py-8 text-center text-sm text-zinc-500">
                        No hay resultados para mostrar.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-600">
                Página {safePage} de {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {detailOpen && detailAttempt ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setDetailOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-5xl rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-y-8 sm:bottom-auto sm:rounded-3xl max-h-[90vh] overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-zinc-950">Detalle del resultado</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {detailAttempt.studentFullName} • {detailAttempt.examName} • Código{" "}
                  {examCodeById[detailAttempt.publishedExamId] || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => requestDelete(detailAttempt)}
                disabled={deletingId === detailAttempt.id}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar intento
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">0-5</p>
                <p className="text-base font-semibold text-zinc-900">{detailAttempt.grade0to5.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">0-50</p>
                <p className="text-base font-semibold text-zinc-900">{detailAttempt.grade0to50.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Preguntas malas</p>
                <p className="text-base font-semibold text-emerald-700">{detailRows.length}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Fraude total</p>
                <p className="text-base font-semibold text-zinc-900">
                  {detailAttempt.fraudTabSwitches + detailAttempt.fraudClipboardAttempts}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Pestaña {detailAttempt.fraudTabSwitches} • Copy {detailAttempt.fraudClipboardAttempts}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Penalización (0-5)</p>
                <p className="text-base font-semibold text-zinc-900">-{detailAttempt.fraudPenalty0to5.toFixed(2)}</p>
              </div>
            </div>

            <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-2xl border border-zinc-200">
              {detailLoading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-zinc-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculando detalle...
                </div>
              ) : detailError ? (
                <div className="px-4 py-8 text-center text-sm text-rose-700">{detailError}</div>
              ) : detailRows.length ? (
                <div className="space-y-3 p-3">
                  {detailRows.map((t) => (
                    <article key={t.questionNumber} className="rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pregunta {t.questionNumber}</p>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          Mala
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-zinc-900">{t.statement}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg bg-zinc-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Respuesta del estudiante</p>
                          <p className="mt-1 text-xs text-zinc-700">{t.answer}</p>
                        </div>
                        <div className="rounded-lg bg-zinc-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Motivo de evaluación</p>
                          <p className="mt-1 text-xs text-zinc-700">{t.reason}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-emerald-700">
                  Sin preguntas malas detectadas en este intento.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen && deleteTarget ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => {
              if (deletingId) return;
              setDeleteOpen(false);
              setDeleteTarget(null);
            }}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar confirmación"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-y-24 sm:bottom-auto sm:rounded-3xl">
            <h3 className="text-lg font-semibold text-zinc-950">Eliminar intento</h3>
            <p className="mt-2 text-sm text-zinc-700">
              Esta acción es definitiva. Se eliminará el intento del estudiante y no aparecerá en resultados.
            </p>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
              <p className="font-semibold text-zinc-900">{deleteTarget.examName}</p>
              <p className="mt-1">
                Estudiante: <span className="font-semibold">{deleteTarget.studentFullName}</span>
              </p>
              <p className="mt-1">
                Documento: <span className="font-semibold">{deleteTarget.documentId}</span>
              </p>
              <p className="mt-1">
                Código: <span className="font-semibold tracking-[0.25em]">{examCodeById[deleteTarget.publishedExamId] || "-"}</span>
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingId) return;
                  setDeleteOpen(false);
                  setDeleteTarget(null);
                }}
                disabled={Boolean(deletingId)}
                className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deletingId === deleteTarget.id}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deletingId === deleteTarget.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
