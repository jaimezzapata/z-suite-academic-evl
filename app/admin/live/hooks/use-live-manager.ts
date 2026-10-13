"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";
import type { PublishedExamRow, AttemptRow } from "../types";
import {
  toString,
  toNumber,
  toMillis,
  normalizeOtp,
  computeAttemptMetrics,
  closeExamApi,
  updateExamTimeLimit,
  sendStudentAdminMessage,
  annulAttempt,
} from "../services/live-service";

export function useLiveManager() {
  const feedback = useFeedback();

  // Exams list & search
  const [rows, setRows] = useState<PublishedExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "map">("table");

  // Quick Code search
  const [quickCode, setQuickCode] = useState("");
  const [quickCodeError, setQuickCodeError] = useState<string | null>(null);
  const [quickCodeLoading, setQuickCodeLoading] = useState(false);

  // Close exam
  const [closingId, setClosingId] = useState<string | null>(null);

  // Time modification
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeTarget, setTimeTarget] = useState<PublishedExamRow | null>(null);
  const [timeDraft, setTimeDraft] = useState("");
  const [timeSaving, setTimeSaving] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  // Attempts drawer / modal
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [attemptsExam, setAttemptsExam] = useState<PublishedExamRow | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptSearch, setAttemptSearch] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  // Messaging
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [savingAttemptId, setSavingAttemptId] = useState<string | null>(null);

  // Annulment
  const [annulOpen, setAnnulOpen] = useState(false);
  const [annulTarget, setAnnulTarget] = useState<AttemptRow | null>(null);
  const [annulDraft, setAnnulDraft] = useState("");

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

  // Realtime published exams listener
  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = query(
      collection(firestore, "publishedExams"),
      orderBy("publishedAt", "desc"),
      limit(200),
    );
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

  // Viewport detection
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

  // Filtered exams
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.accessCode.includes(q));
  }, [rows, search]);

  const quickSuggestions = useMemo(() => filtered.slice(0, 8), [filtered]);
  const effectiveViewMode = isMobile ? "map" : viewMode;

  function openAttempts(row: PublishedExamRow) {
    setAttemptsExam(row);
    setAttemptsOpen(true);
    setAttemptSearch("");
    setSelectedAttemptId(null);
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
      await closeExamApi(row.id, token);
      feedback.success("Examen cerrado correctamente.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "No fue posible cerrar el examen.");
    } finally {
      setClosingId(null);
    }
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
      await updateExamTimeLimit(timeTarget.id, minutes);
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

  // Realtime attempts listener when an exam is opened
  useEffect(() => {
    if (!attemptsOpen || !attemptsExam) return;
    setAttemptsLoading(true);
    setError(null);
    const q = query(
      collection(firestore, "attempts"),
      where("publishedExamId", "==", attemptsExam.id),
      limit(120),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => {
            const row = d.data() as Record<string, unknown>;
            const answers =
              (row.answers && typeof row.answers === "object"
                ? (row.answers as Record<string, unknown>)
                : {}) ?? {};
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

  const attemptMetrics = useMemo(() => computeAttemptMetrics(attempts), [attempts]);

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
      await sendStudentAdminMessage(attemptId, msg);
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
      await annulAttempt(annulTarget.id, reason);
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

  return {
    rows,
    filtered,
    loading,
    error,
    search,
    setSearch,
    isMobile,
    viewMode,
    setViewMode,
    effectiveViewMode,

    // Quick code
    quickCode,
    setQuickCode,
    quickCodeError,
    setQuickCodeError,
    quickCodeLoading,
    openByQuickCode,
    quickSuggestions,

    // Close exam
    closingId,
    closeExam,

    // Time modal
    timeOpen,
    setTimeOpen,
    timeTarget,
    timeDraft,
    setTimeDraft,
    timeSaving,
    timeError,
    openTime,
    saveTime,

    // Attempts modal
    attemptsOpen,
    setAttemptsOpen,
    attemptsExam,
    openAttempts,
    attempts,
    attemptsLoading,
    attemptSearch,
    setAttemptSearch,
    filteredAttempts,
    selectedAttemptId,
    setSelectedAttemptId,
    selectedAttempt,
    attemptMetrics,

    // Messaging
    messageDrafts,
    setMessageDrafts,
    savingAttemptId,
    sendMessage,

    // Annul modal
    annulOpen,
    setAnnulOpen,
    annulTarget,
    annulDraft,
    setAnnulDraft,
    openAnnul,
    confirmAnnul,
  };
}
