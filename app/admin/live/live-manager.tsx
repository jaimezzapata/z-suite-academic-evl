"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Ban, MessageSquareText, Search, KeyRound, Send, X, LayoutGrid, Rows3, UserRound, AlertTriangle, Clock4 } from "lucide-react";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { IconButton } from "@/app/admin/ui/icon-button";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";

type PublishedExamRow = {
  id: string;
  name: string;
  accessCode: string;
  status: string;
  questionCount: number;
  timeLimitMinutes: number;
};

type AttemptRow = {
  id: string;
  status: string;
  studentFullName: string;
  email: string;
  documentId: string;
  adminMessage: string | null;
  annulReason: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  questionCount: number;
  currentQuestionIndex: number;
  answers: Record<string, unknown>;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  fraudPenalty0to5: number;
  fraudForcedFail: boolean;
};

function toString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const toMillisFn = (v as { toMillis?: unknown }).toMillis;
  if (typeof toMillisFn === "function") {
    try {
      return (toMillisFn as () => number)();
    } catch {
      return null;
    }
  }
  const seconds = typeof v.seconds === "number" ? v.seconds : null;
  if (seconds === null) return null;
  const nanos = typeof v.nanoseconds === "number" ? v.nanoseconds : 0;
  return seconds * 1000 + Math.floor(nanos / 1_000_000);
}

function countAnswered(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const record = value as Record<string, unknown>;
  let count = 0;
  Object.values(record).forEach((item) => {
    if (item === null || item === undefined) return;
    if (typeof item === "string" && !item.trim()) return;
    count += 1;
  });
  return count;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number) {
  const next = clampNumber(value, 0, 100);
  return `${Math.round(next)}%`;
}

export function LiveManager() {
  const feedback = useFeedback();
  const [rows, setRows] = useState<PublishedExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [quickCode, setQuickCode] = useState("");
  const [quickCodeError, setQuickCodeError] = useState<string | null>(null);
  const [quickCodeLoading, setQuickCodeLoading] = useState(false);
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [attemptsExam, setAttemptsExam] = useState<PublishedExamRow | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [savingAttemptId, setSavingAttemptId] = useState<string | null>(null);
  const [attemptSearch, setAttemptSearch] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [annulOpen, setAnnulOpen] = useState(false);
  const [annulTarget, setAnnulTarget] = useState<AttemptRow | null>(null);
  const [annulDraft, setAnnulDraft] = useState("");
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeTarget, setTimeTarget] = useState<PublishedExamRow | null>(null);
  const [timeDraft, setTimeDraft] = useState("");
  const [timeSaving, setTimeSaving] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  function showError(message: string) {
    return reportFormError({ message, feedback, setMessage: setError });
  }

  function showQuickCodeError(message: string) {
    setQuickCodeError(message);
    feedback.error(message, "Validacion");
    return message;
  }

  function showTimeError(message: string) {
    setTimeError(message);
    feedback.error(message, "Validacion");
    return message;
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = query(collection(firestore, "publishedExams"), orderBy("publishedAt", "desc"), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => {
            const row = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: toString(row.name, d.id),
              accessCode: toString(row.accessCode, "------"),
              status: toString(row.status, "published"),
              questionCount: toNumber(row.questionCount, 0),
              timeLimitMinutes: toNumber(row.timeLimitMinutes, 60),
            };
          })
          .filter((r) => r.status === "published");
        setRows(next);
        setLoading(false);
      },
      () => {
        setError("No fue posible leer examenes publicados.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncViewport);
      return () => media.removeEventListener("change", syncViewport);
    }
    media.addListener(syncViewport);
    return () => media.removeListener(syncViewport);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.accessCode.includes(q));
  }, [rows, search]);

  const quickSuggestions = useMemo(() => filtered.slice(0, 8), [filtered]);
  const effectiveViewMode = isMobile ? "map" : viewMode;

  function normalizeOtp(value: string) {
    return value.replace(/[^\d]/g, "").slice(0, 6);
  }

  async function openByQuickCode() {
    const code = normalizeOtp(quickCode);
    if (!/^\d{6}$/.test(code)) {
      showQuickCodeError("El codigo debe tener 6 digitos.");
      return;
    }

    setQuickCodeError(null);
    setQuickCodeLoading(true);
    setError(null);
    try {
      const local = rows.find((r) => r.accessCode === code);
      if (local) {
        openAttempts(local);
        setQuickCode("");
        return;
      }

      const snap = await getDocs(
        query(collection(firestore, "publishedExams"), where("accessCode", "==", code), limit(1)),
      );
      if (snap.empty) {
        showQuickCodeError("Código no encontrado o no está publicado.");
        return;
      }
      const docSnap = snap.docs[0];
      const row = docSnap.data() as Record<string, unknown>;
      const status = toString(row.status, "published");
      if (status !== "published") {
        showQuickCodeError("El código existe, pero el examen ya no está publicado.");
        return;
      }
      openAttempts({
        id: docSnap.id,
        name: toString(row.name, docSnap.id),
        accessCode: toString(row.accessCode, code),
        status,
        questionCount: toNumber(row.questionCount, 0),
        timeLimitMinutes: toNumber(row.timeLimitMinutes, 60),
      });
      setQuickCode("");
    } catch {
      showQuickCodeError("No fue posible buscar el código.");
    } finally {
      setQuickCodeLoading(false);
    }
  }

  async function closeExam(row: PublishedExamRow) {
    setClosingId(row.id);
    setError(null);
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      if (!token) {
        showError("Sesión inválida. Vuelve a iniciar sesión como admin.");
        return;
      }
      const res = await fetch("/api/admin/published-exams/close", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ publishedExamId: row.id }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        showError(typeof data?.error === "string" ? data.error : "No fue posible cerrar el examen.");
        return;
      }
      feedback.success("Examen cerrado correctamente.");
    } catch {
      showError("No fue posible cerrar el examen.");
    } finally {
      setClosingId(null);
    }
  }

  function openAttempts(row: PublishedExamRow) {
    setAttemptsExam(row);
    setAttemptsOpen(true);
    setAttemptSearch("");
    setSelectedAttemptId(null);
  }

  function openTime(row: PublishedExamRow) {
    setTimeTarget(row);
    setTimeDraft(String(Math.max(1, row.timeLimitMinutes)));
    setTimeError(null);
    setTimeOpen(true);
  }

  async function saveTime() {
    if (!timeTarget) return;
    const minutes = Number(timeDraft);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
      showTimeError("Minutos inválidos. Rango recomendado: 1 a 240.");
      return;
    }
    setTimeSaving(true);
    setTimeError(null);
    setError(null);
    try {
      await updateDoc(doc(firestore, "publishedExams", timeTarget.id), {
        timeLimitMinutes: Math.round(minutes),
        timeLimitUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTimeOpen(false);
      setTimeTarget(null);
      setTimeDraft("");
      feedback.success("Tiempo actualizado correctamente.");
    } catch {
      showTimeError("No fue posible actualizar el tiempo.");
    } finally {
      setTimeSaving(false);
    }
  }

  useEffect(() => {
    if (!attemptsOpen || !attemptsExam) return;
    setAttemptsLoading(true);
    setError(null);
    const q = query(
      collection(firestore, "attempts"),
      where("publishedExamId", "==", attemptsExam.id),
      limit(200),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => {
            const row = d.data() as Record<string, unknown>;
            const answers = (row.answers && typeof row.answers === "object" ? (row.answers as Record<string, unknown>) : {}) ?? {};
            return {
              id: d.id,
              status: toString(row.status, "in_progress"),
              studentFullName: toString(row.studentFullName, "Estudiante"),
              email: toString(row.email, ""),
              documentId: toString(row.documentId, ""),
              adminMessage: toString(row.adminMessage, "") || null,
              annulReason: toString(row.annulReason, "") || null,
              createdAtMs: toMillis(row.createdAt),
              updatedAtMs: toMillis(row.updatedAt),
              questionCount: toNumber(row.questionCount, attemptsExam.questionCount),
              currentQuestionIndex: toNumber(row.currentQuestionIndex, 0),
              answers,
              fraudTabSwitches: toNumber(row.fraudTabSwitches, 0),
              fraudClipboardAttempts: toNumber(row.fraudClipboardAttempts, 0),
              fraudPenalty0to5: toNumber(row.fraudPenalty0to5, 0),
              fraudForcedFail: Boolean(row.fraudForcedFail),
            };
          })
          .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
        setAttempts(next);
        setAttemptsLoading(false);
      },
      () => {
        setError("No fue posible leer intentos del examen.");
        setAttemptsLoading(false);
      },
    );
    return () => unsub();
  }, [attemptsOpen, attemptsExam]);

  const attemptMetrics = useMemo(() => {
    const perAttempt = attempts.map((a) => {
      const total = Math.max(0, a.questionCount);
      const answered = countAnswered(a.answers);
      const progressPct = total ? (answered / total) * 100 : 0;
      const fraudEvents = Math.max(0, a.fraudTabSwitches) + Math.max(0, a.fraudClipboardAttempts);
      const isSubmitted = a.status.startsWith("submitted");
      const isInProgress = a.status === "in_progress";
      const isAnnulled = a.status === "annulled";
      const isFraudStatus = a.status === "submitted_fraud";
      return {
        attempt: a,
        total,
        answered,
        progressPct,
        fraudEvents,
        isSubmitted,
        isInProgress,
        isAnnulled,
        isFraudStatus,
      };
    });

    const totals = perAttempt.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.isInProgress) acc.inProgress += 1;
        if (item.isSubmitted) acc.submitted += 1;
        if (item.isAnnulled) acc.annulled += 1;
        if (item.isFraudStatus || item.attempt.fraudForcedFail || item.fraudEvents >= 6) acc.suspicious += 1;
        if (item.isInProgress) {
          acc.inProgressProgressSum += item.progressPct;
          acc.inProgressCount += 1;
        }
        acc.fraudEventsSum += item.fraudEvents;
        return acc;
      },
      {
        total: 0,
        inProgress: 0,
        submitted: 0,
        annulled: 0,
        suspicious: 0,
        fraudEventsSum: 0,
        inProgressProgressSum: 0,
        inProgressCount: 0,
      },
    );

    const avgProgressInProgress = totals.inProgressCount ? totals.inProgressProgressSum / totals.inProgressCount : 0;
    const avgFraudEvents = totals.total ? totals.fraudEventsSum / totals.total : 0;
    const suspiciousTop = perAttempt
      .filter((item) => item.fraudEvents > 0 || item.attempt.fraudForcedFail || item.isFraudStatus)
      .sort((a, b) => b.fraudEvents - a.fraudEvents)
      .slice(0, 6);

    return {
      perAttempt,
      totals,
      avgProgressInProgress,
      avgFraudEvents,
      suspiciousTop,
    };
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    const q = attemptSearch.trim().toLowerCase();
    if (!q) return attempts;
    return attempts.filter((a) => {
      return (
        a.studentFullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.documentId.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q)
      );
    });
  }, [attemptSearch, attempts]);

  const selectedAttempt = useMemo(() => {
    if (!selectedAttemptId) return null;
    return attempts.find((a) => a.id === selectedAttemptId) ?? null;
  }, [attempts, selectedAttemptId]);

  useEffect(() => {
    if (!attemptsOpen) return;
    if (selectedAttemptId && attempts.some((a) => a.id === selectedAttemptId)) return;
    const first = attempts[0]?.id ?? null;
    setSelectedAttemptId(first);
  }, [attempts, attemptsOpen, selectedAttemptId]);

  async function sendMessage(attemptId: string) {
    const msg = (messageDrafts[attemptId] ?? "").trim();
    if (!msg) {
      showError("Debes escribir un mensaje antes de enviarlo.");
      return;
    }
    setSavingAttemptId(attemptId);
    setError(null);
    try {
      await updateDoc(doc(firestore, "attempts", attemptId), {
        adminMessage: msg,
        adminMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setMessageDrafts((p) => ({ ...p, [attemptId]: "" }));
      feedback.success("Mensaje enviado al estudiante.");
    } catch {
      showError("No fue posible enviar el mensaje.");
    } finally {
      setSavingAttemptId(null);
    }
  }

  function openAnnul(a: AttemptRow) {
    setAnnulTarget(a);
    setAnnulDraft("");
    setAnnulOpen(true);
  }

  async function confirmAnnul() {
    if (!annulTarget) return;
    const reason = annulDraft.trim();
    if (!reason) {
      showError("Debes indicar el motivo de anulación.");
      return;
    }
    setSavingAttemptId(annulTarget.id);
    setError(null);
    try {
      await updateDoc(doc(firestore, "attempts", annulTarget.id), {
        status: "annulled",
        earnedPoints: 0,
        grade0to5: 0,
        grade0to50: 0,
        annulReason: reason,
        annulledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAnnulOpen(false);
      setAnnulTarget(null);
      setAnnulDraft("");
      feedback.success("Intento anulado correctamente.");
    } catch {
      showError("No fue posible anular el intento.");
    } finally {
      setSavingAttemptId(null);
    }
  }

  const [attemptsById, setAttemptsById] = useState<Record<string, number>>({});
  useEffect(() => {
    const targets = rows.slice(0, 30).map((r) => r.id);
    setAttemptsById((prev) => {
      const next: Record<string, number> = {};
      targets.forEach((id) => {
        next[id] = prev[id] ?? 0;
      });
      return next;
    });

    const unsubs = targets.map((id) => {
      const q = query(collection(firestore, "attempts"), where("publishedExamId", "==", id));
      return onSnapshot(
        q,
        (snap) => {
          setAttemptsById((p) => ({ ...p, [id]: snap.size }));
        },
        () => {
          setAttemptsById((p) => ({ ...p, [id]: p[id] ?? 0 }));
        },
      );
    });
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Examenes publicados</h1>
          <p className="mt-1 text-sm text-zinc-600">Gestiona codigos, estado y monitoreo.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {isMobile ? (
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
              En móvil se muestra el mapa
            </div>
          ) : (
            <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  viewMode === "table" ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <Rows3 className="h-4 w-4" />
                Tabla
              </button>
              <button
                type="button"
                onClick={() => setViewMode("map")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  viewMode === "map" ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Mapa
              </button>
            </div>
          )}

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-zinc-400 sm:w-64"
                placeholder="Nombre o codigo"
              />
            </div>
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          Cargando...
        </div>
      ) : filtered.length ? (
        effectiveViewMode === "map" ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950">Acceso rápido por código</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Escribe el código de 6 dígitos y presiona Enter para abrir el examen.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void openByQuickCode()}
                    disabled={quickCodeLoading}
                    className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCode("");
                      setQuickCodeError(null);
                    }}
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <input
                  value={quickCode}
                  onChange={(e) => {
                    setQuickCodeError(null);
                    setQuickCode(normalizeOtp(e.target.value));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void openByQuickCode();
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Ej: 123456"
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-base font-semibold tracking-[0.2em] text-zinc-900 outline-none focus:border-zinc-400"
                  aria-label="Código de examen"
                />

                {quickCodeError ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {quickCodeError}
                  </div>
                ) : null}

                {quickSuggestions.length ? (
                  <div className="mt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Códigos recientes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {quickSuggestions.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => {
                            setQuickCode(row.accessCode);
                            setQuickCodeError(null);
                            openAttempts(row);
                          }}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-zinc-800 hover:bg-zinc-100"
                          title={`Abrir ${row.name}`}
                        >
                          {row.accessCode}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openAttempts(row)}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-950">{row.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {row.questionCount} preguntas • {row.timeLimitMinutes} min
                      </p>
                    </div>
                    <div className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      Intentos {attemptsById[row.id] ?? 0}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Codigo</p>
                      <p className="text-xl font-semibold tracking-[0.25em] text-zinc-900">{row.accessCode}</p>
                    </div>
                    <KeyRound className="h-5 w-5 text-zinc-500" />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Publicado
                    </span>
                    <div className="flex items-center gap-2">
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        openTime(row);
                      }}
                      disabled={closingId === row.id}
                      className="h-8 w-8"
                      aria-label="Cambiar tiempo"
                      title="Cambiar tiempo"
                    >
                      <Clock4 className="h-4 w-4" />
                    </IconButton>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          openAttempts(row);
                        }}
                        disabled={closingId === row.id}
                        className="h-8 w-8"
                        aria-label="Abrir estudiantes"
                        title="Abrir estudiantes"
                      >
                        <MessageSquareText className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          void closeExam(row);
                        }}
                        disabled={closingId === row.id}
                        className="h-8 w-8"
                        aria-label="Cerrar examen"
                        title="Cerrar examen"
                      >
                        <X className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="grid grid-cols-[1.5fr_0.8fr_0.6fr_0.7fr_auto] gap-0 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
              <div>Examen</div>
              <div>Codigo</div>
              <div>Intentos</div>
              <div>Tiempo</div>
              <div className="text-right">Acciones</div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {filtered.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1.5fr_0.8fr_0.6fr_0.7fr_auto] items-center gap-0 border-b border-zinc-100 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-950">{row.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{row.questionCount} preguntas</p>
                  </div>
                  <div className="text-sm font-semibold tracking-[0.25em] text-zinc-900">{row.accessCode}</div>
                  <div className="text-sm font-semibold text-zinc-900">{attemptsById[row.id] ?? 0}</div>
                  <div className="text-sm text-zinc-700">{row.timeLimitMinutes} min</div>
                  <div className="flex items-center justify-end gap-2">
                    <IconButton
                      onClick={() => openTime(row)}
                      disabled={closingId === row.id}
                      className="h-8 w-8"
                      aria-label="Cambiar tiempo"
                      title="Cambiar tiempo"
                    >
                      <Clock4 className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      onClick={() => openAttempts(row)}
                      disabled={closingId === row.id}
                      className="h-8 w-8"
                      aria-label="Abrir estudiantes"
                      title="Abrir estudiantes"
                    >
                      <MessageSquareText className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      variant="danger"
                      onClick={() => void closeExam(row)}
                      disabled={closingId === row.id}
                      className="h-8 w-8"
                      aria-label="Cerrar examen"
                      title="Cerrar examen"
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          No hay examenes publicados.
        </div>
      )}

      {attemptsOpen && attemptsExam ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setAttemptsOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-950">
                  Estudiantes • {attemptsExam.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Mensajes unidireccionales (docente → estudiante) y anulacion por estudiante.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                    Intentos {attemptMetrics.totals.total}
                  </div>
                  <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                    En progreso {attemptMetrics.totals.inProgress}
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    Finalizados {attemptMetrics.totals.submitted}
                  </div>
                  <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                    Anulados {attemptMetrics.totals.annulled}
                  </div>
                  <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                    Sospechosos {attemptMetrics.totals.suspicious}
                  </div>
                  <div className="rounded-full bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                    Progreso prom. {formatPercent(attemptMetrics.avgProgressInProgress)}
                  </div>
                </div>
              </div>
              <IconButton
                onClick={() => setAttemptsOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="mt-4 grid h-[70vh] grid-cols-1 gap-3 sm:grid-cols-[320px_1fr]">
              <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Lista</p>
                  <div className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    {attempts.length}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      value={attemptSearch}
                      onChange={(e) => setAttemptSearch(e.target.value)}
                      className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-zinc-400"
                      placeholder="Buscar estudiante"
                    />
                  </div>
                </div>

                <div className="mt-3 max-h-[56vh] space-y-2 overflow-y-auto">
                  {attemptsLoading ? (
                    <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                      Cargando...
                    </div>
                  ) : filteredAttempts.length ? (
                    filteredAttempts.map((a) => {
                      const active = a.id === selectedAttemptId;
                      const annulled = a.status === "annulled";
                      const answered = countAnswered(a.answers);
                      const total = Math.max(0, a.questionCount);
                      const progressPct = total ? (answered / total) * 100 : 0;
                      const fraudEvents = Math.max(0, a.fraudTabSwitches) + Math.max(0, a.fraudClipboardAttempts);
                      const suspicious = a.status === "submitted_fraud" || a.fraudForcedFail || fraudEvents >= 6;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedAttemptId(a.id)}
                          className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                            active ? "border-indigo-200 bg-indigo-50" : "border-zinc-200 bg-white hover:bg-zinc-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-950">{a.studentFullName}</p>
                              <p className="mt-1 truncate text-xs text-zinc-600">{a.email}</p>
                              <p className="mt-1 truncate text-[11px] text-zinc-500">
                                {formatPercent(progressPct)} • {answered}/{total || 0} respuestas
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                                annulled
                                  ? "bg-rose-50 text-rose-700 ring-rose-200"
                                  : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                              }`}
                            >
                              {annulled ? "Anulado" : a.status}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${clampNumber(progressPct, 0, 100)}%` }}
                            />
                          </div>
                          {suspicious ? (
                            <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Eventos {fraudEvents}
                            </div>
                          ) : null}
                          <p className="mt-1 truncate text-[11px] text-zinc-500">{a.documentId}</p>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                      Aun no hay intentos.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                {selectedAttempt ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-950">{selectedAttempt.studentFullName}</p>
                        <p className="mt-1 text-xs text-zinc-600">{selectedAttempt.email}</p>
                        <p className="mt-1 text-xs text-zinc-500">{selectedAttempt.documentId}</p>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                          {selectedAttempt.status === "annulled" ? "Anulado" : selectedAttempt.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Progreso</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          {(() => {
                            const answered = countAnswered(selectedAttempt.answers);
                            const total = Math.max(0, selectedAttempt.questionCount);
                            const pct = total ? (answered / total) * 100 : 0;
                            return `${formatPercent(pct)} • ${answered}/${total || 0}`;
                          })()}
                        </p>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full rounded-full bg-indigo-600"
                            style={{
                              width: `${(() => {
                                const answered = countAnswered(selectedAttempt.answers);
                                const total = Math.max(0, selectedAttempt.questionCount);
                                const pct = total ? (answered / total) * 100 : 0;
                                return clampNumber(pct, 0, 100);
                              })()}%`,
                            }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-zinc-600">
                          Pregunta actual: {Math.max(0, selectedAttempt.currentQuestionIndex) + 1} /{" "}
                          {Math.max(0, selectedAttempt.questionCount)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Fraude</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          Eventos{" "}
                          {Math.max(0, selectedAttempt.fraudTabSwitches) + Math.max(0, selectedAttempt.fraudClipboardAttempts)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">
                          Pestañas {Math.max(0, selectedAttempt.fraudTabSwitches)} • Portapapeles{" "}
                          {Math.max(0, selectedAttempt.fraudClipboardAttempts)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">
                          Penalización {selectedAttempt.fraudPenalty0to5.toFixed(1)} / 5
                          {selectedAttempt.fraudForcedFail ? " • Forzar 0" : ""}
                        </p>
                        <p className="mt-2 text-xs text-zinc-500">
                          Última actividad:{" "}
                          {selectedAttempt.updatedAtMs ? new Date(selectedAttempt.updatedAtMs).toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>

                    {attemptMetrics.suspiciousTop.length ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                          Sospechosos (top)
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {attemptMetrics.suspiciousTop.map((item) => (
                            <button
                              key={item.attempt.id}
                              type="button"
                              onClick={() => setSelectedAttemptId(item.attempt.id)}
                              className="flex items-start justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-left ring-1 ring-amber-200 hover:bg-white"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{item.attempt.studentFullName}</p>
                                <p className="mt-1 text-xs text-amber-900/80">
                                  Eventos {item.fraudEvents} • {formatPercent(item.progressPct)}
                                </p>
                              </div>
                              <AlertTriangle className="h-4 w-4 text-amber-800" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedAttempt.adminMessage ? (
                      <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Mensaje enviado</p>
                        <p className="mt-2">{selectedAttempt.adminMessage}</p>
                      </div>
                    ) : null}

                    {selectedAttempt.annulReason ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Motivo de anulación</p>
                        <p className="mt-2">{selectedAttempt.annulReason}</p>
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-zinc-700">Mensaje</span>
                        <input
                          value={messageDrafts[selectedAttempt.id] ?? ""}
                          onChange={(e) => setMessageDrafts((p) => ({ ...p, [selectedAttempt.id]: e.target.value }))}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          placeholder="Mensaje al estudiante"
                          disabled={savingAttemptId === selectedAttempt.id}
                        />
                      </label>
                      <div className="flex items-center justify-end gap-2">
                        <IconButton
                          variant="primary"
                          onClick={() => void sendMessage(selectedAttempt.id)}
                          disabled={savingAttemptId === selectedAttempt.id}
                          className="h-10 w-10"
                          aria-label="Enviar mensaje"
                          title="Enviar mensaje"
                        >
                          <Send className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          variant="danger"
                          onClick={() => openAnnul(selectedAttempt)}
                          disabled={savingAttemptId === selectedAttempt.id || selectedAttempt.status === "annulled"}
                          className="h-10 w-10"
                          aria-label="Anular intento"
                          title="Anular intento"
                        >
                          <Ban className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
                      <div className="flex items-start gap-3">
                        <UserRound className="mt-0.5 h-5 w-5 text-zinc-600" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">Accesos rápidos</p>
                          <p className="mt-1 text-xs text-zinc-600">
                            Selecciona estudiante en la lista para abrir chat y acciones, sin depender del scroll.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
                    Selecciona un estudiante para ver el chat.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {annulOpen && annulTarget ? (
        <div className="fixed inset-0 z-60">
          <button
            type="button"
            onClick={() => setAnnulOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-16 sm:bottom-auto sm:rounded-3xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Anular intento</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Escribe el motivo. Este quedará guardado en el resultado del estudiante.
                </p>
              </div>
              <IconButton
                onClick={() => setAnnulOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{annulTarget.studentFullName}</p>
                  <p className="mt-1 text-xs text-amber-800">{annulTarget.email}</p>
                </div>
              </div>
            </div>

            <label className="mt-4 grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Motivo</span>
              <textarea
                value={annulDraft}
                onChange={(e) => setAnnulDraft(e.target.value)}
                className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                placeholder="Ej: Uso de celular / copia / cambio de pestañas repetido..."
              />
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAnnulOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmAnnul()}
                disabled={savingAttemptId === annulTarget.id}
                className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirmar anulación
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {timeOpen && timeTarget ? (
        <div className="fixed inset-0 z-60">
          <button
            type="button"
            onClick={() => setTimeOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-16 sm:bottom-auto sm:rounded-3xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Cambiar tiempo de evaluación</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Examen: <strong>{timeTarget.name}</strong>
                </p>
              </div>
              <IconButton
                onClick={() => setTimeOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            {timeError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {timeError}
              </div>
            ) : null}

            <label className="mt-4 grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Minutos</span>
              <input
                value={timeDraft}
                onChange={(e) => setTimeDraft(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                inputMode="numeric"
                className="h-10 rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                placeholder="60"
                disabled={timeSaving}
              />
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTimeOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                disabled={timeSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveTime()}
                disabled={timeSaving}
                className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {timeSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
