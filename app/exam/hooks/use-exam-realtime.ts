"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import {
  countPenalizableFraudEvents,
  FRAUD_GRACE_EVENTS,
  FRAUD_PENALTY_PER_EVENT_0TO5,
} from "@/lib/exam-grading";
import type { PublishedExam, SnapshotQuestion, ExamStep as Step } from "@/types";
import { getDismissedAdminMessage, saveDismissedAdminMessage } from "../services/exam-storage";
import type { ExamResultData } from "./use-exam-session";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toMillis(value: unknown) {
  if (!value || typeof value !== "object") return null;
  try {
    if ("toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
      const ms = Number((value as { toMillis: () => number }).toMillis());
      return Number.isFinite(ms) ? ms : null;
    }
    if ("toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
      const d = (value as { toDate: () => Date }).toDate();
      const ms = d?.getTime?.();
      return typeof ms === "number" && Number.isFinite(ms) ? ms : null;
    }
  } catch {
    return null;
  }
  return null;
}

export interface UseExamRealtimeOptions {
  exam: PublishedExam | null;
  setExam: React.Dispatch<React.SetStateAction<PublishedExam | null>>;
  attemptId: string | null;
  step: Step;
  setStep: (step: Step) => void;
  submitted: boolean;
  setSubmitted: (submitted: boolean) => void;
  attemptStartMs: number | null;
  setAttemptStartMs: (ms: number | null) => void;
  endAtMs: number | null;
  setEndAtMs: (ms: number | null) => void;
  setRemainingMs: (ms: number) => void;
  questions: SnapshotQuestion[];
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setResult: React.Dispatch<React.SetStateAction<ExamResultData | null>>;
  setError: (err: string | null) => void;
}

export function useExamRealtime({
  exam,
  setExam,
  attemptId,
  step,
  setStep,
  submitted,
  setSubmitted,
  attemptStartMs,
  setAttemptStartMs,
  endAtMs,
  setEndAtMs,
  setRemainingMs,
  questions,
  setCurrentQuestionIndex,
  setResult,
  setError,
}: UseExamRealtimeOptions) {
  const [annulled, setAnnulled] = useState(false);
  const [annulReason, setAnnulReason] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminMessageKey, setAdminMessageKey] = useState<string | null>(null);
  const [dismissedAdminMessageKey, setDismissedAdminMessageKey] = useState<string | null>(null);

  // Escuchar cambios del examen publicado (tiempo límite, estado, documentación)
  useEffect(() => {
    if (!exam) return;
    const publishedExamId = exam.id;
    const unsub = onSnapshot(
      doc(firestore, "publishedExams", publishedExamId),
      (snap) => {
        if (!snap.exists()) return;
        const examRow = snap.data() as Record<string, unknown>;

        const status = toString(examRow.status, "published");
        const timeLimitMinutes = toNumber(examRow.timeLimitMinutes, exam.timeLimitMinutes);
        const documentationMarkdown = toString(examRow.documentationMarkdown, exam.documentationMarkdown);
        const fraudEnabled = toBoolean(examRow.fraudEnabled, exam.fraudEnabled);
        const questionCount = Math.max(1, toNumber(examRow.questionCount, exam.questionCount));

        setExam((prev) => {
          if (!prev) return prev;

          if (timeLimitMinutes !== prev.timeLimitMinutes && step === "exam" && !submitted) {
            const start = attemptStartMs ?? (endAtMs ? endAtMs - prev.timeLimitMinutes * 60 * 1000 : null);
            if (start) {
              const nextEnd = start + timeLimitMinutes * 60 * 1000;
              setEndAtMs(nextEnd);
              setRemainingMs(nextEnd - Date.now());
            }
          }

          if (questionCount !== prev.questionCount) {
            const nextLimit = Math.max(1, Math.min(questionCount, questions.length || questionCount));
            setCurrentQuestionIndex((i) => Math.min(i, nextLimit - 1));
          }

          return {
            ...prev,
            status,
            timeLimitMinutes,
            documentationMarkdown,
            fraudEnabled,
            questionCount,
          };
        });

        if (status === "closed" && (step === "rules" || step === "student")) {
          setError("Este examen ya está cerrado.");
          setStep("code");
          setExam(null);
        }
      },
      () => {},
    );

    return () => unsub();
  }, [attemptStartMs, endAtMs, exam?.id, questions.length, step, submitted, setExam, setEndAtMs, setRemainingMs, setCurrentQuestionIndex, setError, setStep]);

  // Escuchar cambios del intento (anulaciones, mensajes, finalización remota)
  useEffect(() => {
    if (!attemptId) return;
    const unsub = onSnapshot(
      doc(firestore, "attempts", attemptId),
      (snap) => {
        if (!snap.exists()) return;
        const row = snap.data() as Record<string, unknown>;
        const status = toString(row.status, "in_progress");
        const msg = toString(row.adminMessage, "") || null;
        const msgAtMs = toMillis(row.adminMessageAt);
        const nextKey = msg ? `${msgAtMs ?? "na"}:${msg}` : null;
        setAdminMessage(msg);
        setAdminMessageKey(nextKey);

        const startedAt = row.startedAt as unknown;
        if (!attemptStartMs) {
          const ms = toMillis(startedAt);
          if (typeof ms === "number" && ms > 0) setAttemptStartMs(ms);
        }

        if (status === "annulled" && step !== "result") {
          setAnnulled(true);
          setAnnulReason(
            toString(
              row.annulReason,
              "Tu intento fue anulado por el docente. Nota asignada: 0.00, sin posibilidad de recuperación.",
            ),
          );
          const total = toNumber(row.questionCount, toNumber(row.totalPoints, questions.length));
          const fraudTab = toNumber(row.fraudTabSwitches, 0);
          const fraudClip = toNumber(row.fraudClipboardAttempts, 0);
          const fraudPenalty0to5 = toNumber(
            row.fraudPenalty0to5,
            Number((countPenalizableFraudEvents(fraudTab + fraudClip, FRAUD_GRACE_EVENTS) * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2)),
          );
          setResult({
            score5: 0,
            score50: 0,
            score5Raw: 0,
            score50Raw: 0,
            earned: 0,
            total: Number(total),
            fraudTabSwitches: fraudTab,
            fraudClipboardAttempts: fraudClip,
            fraudPenalty0to5,
            fraudForcedFail: Boolean(row.fraudForcedFail),
          });
          setSubmitted(true);
          setStep("result");
        }

        if (status.toLowerCase().includes("submitted") && step !== "result" && !submitted) {
          const score5 = toNumber(row.grade0to5, 0);
          const score50 = toNumber(row.grade0to50, 0);
          const earned = toNumber(row.earnedPoints, toNumber(row.correctCount, 0));
          const total = toNumber(row.totalPoints, toNumber(row.questionCount, questions.length));
          const fraudTab = toNumber(row.fraudTabSwitches, 0);
          const fraudClip = toNumber(row.fraudClipboardAttempts, 0);
          const fraudPenalty0to5 = toNumber(row.fraudPenalty0to5, 0);
          setResult({
            score5,
            score50,
            score5Raw: toNumber(row.grade0to5Raw, score5),
            score50Raw: toNumber(row.grade0to50Raw, score50),
            earned: Number(earned),
            total: Number(total),
            fraudTabSwitches: fraudTab,
            fraudClipboardAttempts: fraudClip,
            fraudPenalty0to5,
            fraudForcedFail: Boolean(row.fraudForcedFail),
          });
          setSubmitted(true);
          setStep("result");
        }
      },
      () => {},
    );
    return () => unsub();
  }, [attemptId, step, questions, attemptStartMs, submitted, setAttemptStartMs, setResult, setSubmitted, setStep]);

  useEffect(() => {
    if (!attemptId) return;
    const dismissed = getDismissedAdminMessage(attemptId);
    if (dismissed) setDismissedAdminMessageKey(dismissed);
  }, [attemptId]);

  function dismissAdminMessage() {
    if (adminMessageKey && attemptId) {
      setDismissedAdminMessageKey(adminMessageKey);
      saveDismissedAdminMessage(attemptId, adminMessageKey);
    }
  }

  return {
    annulled,
    annulReason,
    adminMessage,
    adminMessageKey,
    dismissedAdminMessageKey,
    dismissAdminMessage,
  };
}
