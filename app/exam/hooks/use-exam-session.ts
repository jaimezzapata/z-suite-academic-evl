"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { normalizeFullName, normalizePersonNamePart } from "@/lib/text/normalize";
import {
  calculateGradeSnapshot,
  countPenalizableFraudEvents,
  evaluateQuestion as evaluateQuestionShared,
  FRAUD_FAIL_TOTAL_EVENTS,
  FRAUD_GRACE_EVENTS,
  FRAUD_PENALTY_PER_EVENT_0TO5,
  type GradingQuestion,
  type MultipleChoiceBreakdown,
} from "@/lib/exam-grading";
import type { PublishedExam, SnapshotQuestion, ExamStep as Step } from "@/types";
import {
  getStoredResume,
  saveStoredResume,
  clearStoredResume,
  getStoredAttemptState,
  saveStoredAttemptState,
} from "../services/exam-storage";
import {
  accessExamByCode,
  requestStartAttempt,
  requestSubmitAttempt,
} from "../services/exam-api";
import { useExamFraud } from "./use-exam-fraud";
import { useResultsReviewGuard } from "./use-results-review-guard";
import { useExamRealtime } from "./use-exam-realtime";

export function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
export { formatReviewClock, RESULTS_REVIEW_TOTAL_MS } from "./use-results-review-guard";

function randomInt(maxExclusive: number) {
  if (maxExclusive <= 0) return 0;
  try {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % maxExclusive;
  } catch {
    return Math.floor(Math.random() * maxExclusive);
  }
}

function shuffleIds(ids: string[]) {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

export type ExamResultData = {
  score5: number;
  score50: number;
  score5Raw: number;
  score50Raw: number;
  earned: number;
  total: number;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  fraudPenalty0to5: number;
  fraudForcedFail: boolean;
  perQuestion?: Array<{
    questionId: string;
    earned: number;
    points: number;
    fullyCorrect: boolean;
    ratio: number;
    multipleChoice?: MultipleChoiceBreakdown | null;
  }>;
};

export function useExamSession() {
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exam, setExam] = useState<PublishedExam | null>(null);
  const [questions, setQuestions] = useState<SnapshotQuestion[]>([]);
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [email, setEmail] = useState("");

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const answersRef = useRef<Record<string, unknown>>({});
  const displayQuestionsRef = useRef<SnapshotQuestion[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [endAtMs, setEndAtMs] = useState<number | null>(null);
  const [attemptStartMs, setAttemptStartMs] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [result, setResult] = useState<ExamResultData | null>(null);
  const [resultOpenQuestionIds, setResultOpenQuestionIds] = useState<Set<string>>(new Set());

  const autosaveTimerRef = useRef<number | null>(null);
  const lastAutosaveKeyRef = useRef<string>("");
  const autoResumeRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const displayQuestions = useMemo(() => {
    const limitCount = exam?.questionCount
      ? Math.max(1, Math.min(exam.questionCount, questions.length))
      : questions.length;
    if (!questionOrder.length) return questions.slice(0, limitCount);
    const byId = new Map<string, SnapshotQuestion>();
    questions.forEach((q) => byId.set(q.questionId, q));
    const ordered: SnapshotQuestion[] = [];
    questionOrder.forEach((id) => {
      const q = byId.get(id);
      if (q) ordered.push(q);
    });
    if (ordered.length !== questions.length) {
      questions.forEach((q) => {
        if (!questionOrder.includes(q.questionId)) ordered.push(q);
      });
    }
    return ordered.slice(0, limitCount);
  }, [questions, questionOrder, exam?.questionCount]);

  useEffect(() => {
    displayQuestionsRef.current = displayQuestions;
  }, [displayQuestions]);

  // Sub-hook 1: Antifraude
  const fraud = useExamFraud({
    attemptId,
    enabled: exam?.fraudEnabled !== false,
    isActive: step === "exam",
    submitted,
    onFraudThresholdReached: () => {
      void submitAttempt(false, { forcedStatus: "submitted_fraud", forceZero: true });
    },
  });

  // Sub-hook 2: Protección y temporizador en revisión de resultados
  const reviewGuard = useResultsReviewGuard({
    active: step === "result" && !!result && !submitting,
  });

  // Sub-hook 3: Sincronización en tiempo real con Firestore
  const realtime = useExamRealtime({
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
  });

  // Recuperación automática de código guardado en localStorage
  useEffect(() => {
    if (step !== "code") return;
    const resume = getStoredResume();
    if (resume?.accessCode && /^\d{6}$/.test(resume.accessCode)) {
      setCode(resume.accessCode);
    }
  }, [step]);

  useEffect(() => {
    if (autoResumeRef.current || step !== "code" || loading || !/^\d{6}$/.test(code.trim())) return;
    const resume = getStoredResume();
    if (!resume) return;
    autoResumeRef.current = true;
    void loadExamByCode();
  }, [step, code, loading]);

  function evaluateQuestion(q: SnapshotQuestion, answer: unknown) {
    const gq: GradingQuestion = {
      questionId: q.questionId,
      type: q.type,
      points: q.points,
      options: q.options,
      partialCredit: Boolean(q.partialCredit ?? true),
      answerRules: q.answerRules,
      puzzle: q.puzzle,
    };
    return evaluateQuestionShared(gq, answer);
  }

  async function loadExamByCode() {
    setLoading(true);
    setError(null);
    try {
      const res = await accessExamByCode(code);
      if (!res.ok || !res.exam || !res.questions) {
        setError(res.error || "No fue posible cargar el examen.");
        return;
      }

      const nextExam = res.exam;
      const loadedQuestions = res.questions;

      setExam(nextExam);
      setQuestions(loadedQuestions);
      setQuestionOrder([]);
      setAnswers({});
      setSubmitted(false);
      setSubmitting(false);
      setAttemptId(null);
      setAttemptStartMs(null);
      setEndAtMs(null);
      setRemainingMs(0);
      setCurrentQuestionIndex(0);
      setRulesAccepted(false);
      fraud.resetFraud();

      let resumed = false;
      const resume = getStoredResume();
      if (resume?.publishedExamId === nextExam.id && resume.attemptId) {
        const resumeAttemptId = resume.attemptId;
        let attemptSnap: Awaited<ReturnType<typeof getDoc>> | null = null;
        try {
          attemptSnap = await getDoc(doc(firestore, "attempts", resumeAttemptId));
        } catch {
          attemptSnap = null;
        }

        if (attemptSnap?.exists()) {
          const attempt = attemptSnap.data() as Record<string, unknown>;
          const status = String(attempt.status || "in_progress");
          if (status === "in_progress") {
            const startMs = toMillis(attempt.startedAt) ?? Date.now();
            const ends = startMs + nextExam.timeLimitMinutes * 60 * 1000;
            setAttemptId(resumeAttemptId);
            setAttemptStartMs(startMs);
            setEndAtMs(ends);
            setRemainingMs(ends - Date.now());

            const stored = getStoredAttemptState(resumeAttemptId);
            const localIndex = stored?.currentQuestionIndex ?? toNumber(attempt.currentQuestionIndex, 0);
            setCurrentQuestionIndex(localIndex);

            const ord =
              (stored?.questionOrder && stored.questionOrder.length > 0)
                ? stored.questionOrder
                : Array.isArray(attempt.questionOrder)
                  ? (attempt.questionOrder as unknown[]).map((x) => String(x || "")).filter(Boolean)
                  : [];
            setQuestionOrder(ord);

            const ans =
              stored?.answers ||
              (attempt.answers && typeof attempt.answers === "object" ? (attempt.answers as Record<string, unknown>) : {});
            setAnswers(ans);

            const fTab = stored ? stored.fraudTabSwitches : toNumber(attempt.fraudTabSwitches, 0);
            const fClip = stored ? stored.fraudClipboardAttempts : toNumber(attempt.fraudClipboardAttempts, 0);
            fraud.resetFraud(fTab, fClip);

            setRulesAccepted(true);
            setStep("exam");
            resumed = true;

            const totalQ = loadedQuestions.length;
            const correctCount = loadedQuestions.reduce((acc, q) => {
              const earned = evaluateQuestion(q, ans[q.questionId]);
              if (!Number.isFinite(earned)) return acc;
              if (q.type === "open_concept") return acc + (earned > 0 ? 1 : 0);
              return acc + (earned >= q.points && q.points > 0 ? 1 : 0);
            }, 0);
            const val5 = totalQ > 0 ? 5 / totalQ : 0;
            const val50 = totalQ > 0 ? 50 / totalQ : 0;
            const raw5 = correctCount * val5;
            const raw50 = correctCount * val50;
            const fTotal = nextExam.fraudEnabled ? fTab + fClip : 0;
            const fPenalty = nextExam.fraudEnabled
              ? Number((countPenalizableFraudEvents(fTotal, FRAUD_GRACE_EVENTS) * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2))
              : 0;

            if ((nextExam.fraudEnabled && fTotal >= FRAUD_FAIL_TOTAL_EVENTS) || Date.now() >= ends) {
              const forceZero = nextExam.fraudEnabled && fTotal >= FRAUD_FAIL_TOTAL_EVENTS;
              const status = forceZero ? "submitted_fraud" : "submitted_expired";
              const adj5 = forceZero ? 0 : Math.max(0, raw5 - fPenalty);
              const adj50 = forceZero ? 0 : (adj5 / 5) * 50;
              const s5 = Number(adj5.toFixed(2));
              const s50 = Number(adj50.toFixed(2));

              try {
                await updateDoc(doc(firestore, "attempts", resumeAttemptId), {
                  status,
                  answers: ans,
                  correctCount,
                  questionCount: totalQ,
                  grade0to5: s5,
                  grade0to50: s50,
                  fraudForcedFail: forceZero,
                  submittedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch {}

              clearStoredResume();
              setResult({
                score5: s5,
                score50: s50,
                score5Raw: Number(raw5.toFixed(2)),
                score50Raw: Number(raw50.toFixed(2)),
                earned: Number(correctCount),
                total: Number(totalQ),
                fraudTabSwitches: nextExam.fraudEnabled ? fTab : 0,
                fraudClipboardAttempts: nextExam.fraudEnabled ? fClip : 0,
                fraudPenalty0to5: fPenalty,
                fraudForcedFail: forceZero,
              });
              setSubmitted(true);
              setStep("result");
            }
          }
        }
      }

      if (!resumed) setStep("student");
    } catch {
      setError("No fue posible cargar el examen.");
    } finally {
      setLoading(false);
    }
  }

  async function startAttempt() {
    if (!exam) return;
    setError(null);

    const n1 = normalizePersonNamePart(firstName);
    if (!n1.ok) {
      setError(`Nombre: ${n1.error}`);
      return;
    }
    const n2 = normalizePersonNamePart(lastName);
    if (!n2.ok) {
      setError(`Apellido: ${n2.error}`);
      return;
    }
    const full = normalizeFullName(firstName, lastName);
    if (!full.ok) {
      setError(full.error);
      return;
    }
    if (!documentId.trim()) {
      setError("Documento es obligatorio.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Correo inválido.");
      return;
    }

    const emailNorm = email.trim().toLowerCase();
    const docNorm = documentId.trim();
    const order = shuffleIds(questions.map((q) => q.questionId));

    const res = await requestStartAttempt({
      publishedExamId: exam.id,
      accessCode: exam.accessCode,
      examTemplateId: exam.templateId || null,
      examName: exam.name,
      studentFirstName: n1.value,
      studentLastName: n2.value,
      studentFullName: full.value,
      documentId: docNorm,
      email: emailNorm,
      questionCount: questions.length,
      questionOrder: order,
    });

    if (!res.ok || !res.attemptId) {
      setError(res.error || "No fue posible inicializar el intento.");
      return;
    }

    const startedAtMs = res.startedAtMs ?? Date.now();
    const ends = startedAtMs + exam.timeLimitMinutes * 60 * 1000;
    setAttemptId(res.attemptId);
    setQuestionOrder(order);
    setAnswers({});
    setAttemptStartMs(startedAtMs);
    setEndAtMs(ends);
    setRemainingMs(ends - Date.now());
    setCurrentQuestionIndex(0);

    saveStoredResume({ publishedExamId: exam.id, attemptId: res.attemptId, accessCode: exam.accessCode });
    saveStoredAttemptState(res.attemptId, {
      attemptId: res.attemptId,
      publishedExamId: exam.id,
      accessCode: exam.accessCode,
      startedAtMs,
      endAtMs: ends,
      answers: {},
      currentQuestionIndex: 0,
      questionOrder: order,
      fraudTabSwitches: 0,
      fraudClipboardAttempts: 0,
      updatedAtMs: Date.now(),
    });

    if (typeof res.fraudEnabled === "boolean" && res.fraudEnabled !== exam.fraudEnabled) {
      const nextFraud = res.fraudEnabled;
      setExam((prev) => (prev ? { ...prev, fraudEnabled: nextFraud } : prev));
    }
    setStep("exam");
  }

  // Timer de examen activo
  useEffect(() => {
    if (step !== "exam" || !endAtMs || submitted) return;
    const timer = setInterval(() => {
      const left = endAtMs - Date.now();
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(timer);
        void submitAttempt(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [step, endAtMs, submitted]);

  // Autosave
  useEffect(() => {
    if (!attemptId || step !== "exam" || submitted) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      const saveFraudEnabled = exam?.fraudEnabled !== false;
      const nextFraudTab = saveFraudEnabled ? fraud.fraudTabSwitches : 0;
      const nextFraudClip = saveFraudEnabled ? fraud.fraudClipboardAttempts : 0;
      const payloadKey = JSON.stringify({
        answers,
        currentQuestionIndex,
        questionOrder,
        fraudTabSwitches: nextFraudTab,
        fraudClipboardAttempts: nextFraudClip,
      });
      if (payloadKey === lastAutosaveKeyRef.current) return;
      lastAutosaveKeyRef.current = payloadKey;

      saveStoredAttemptState(attemptId, {
        attemptId,
        publishedExamId: exam?.id ?? null,
        accessCode: exam?.accessCode ?? null,
        startedAtMs: attemptStartMs ?? null,
        endAtMs,
        answers,
        currentQuestionIndex,
        questionOrder,
        fraudTabSwitches: nextFraudTab,
        fraudClipboardAttempts: nextFraudClip,
        updatedAtMs: Date.now(),
      });
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    };
  }, [attemptId, step, submitted, exam?.fraudEnabled, exam?.id, exam?.accessCode, attemptStartMs, endAtMs, answers, currentQuestionIndex, questionOrder, fraud.fraudTabSwitches, fraud.fraudClipboardAttempts]);

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function submitAttempt(
    expired = false,
    opts?: { forcedStatus?: "submitted" | "submitted_expired" | "submitted_fraud"; forceZero?: boolean },
  ) {
    if (!attemptId) {
      setError("No se encontró el intento actual. Recarga el examen y vuelve a intentarlo.");
      return;
    }
    if (submitted || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const fraudEnabled = exam?.fraudEnabled !== false;
      const currentAnswers = answersRef.current;
      const fraudTab = fraudEnabled ? fraud.fraudCountsRef.current.tab : 0;
      const fraudClip = fraudEnabled ? fraud.fraudCountsRef.current.clip : 0;
      const forcedStatus = fraudEnabled ? opts?.forcedStatus : undefined;
      const forceZero = fraudEnabled ? Boolean(opts?.forceZero) : false;

      const res = await requestSubmitAttempt({
        attemptId,
        accessCode: (exam?.accessCode ?? "").trim(),
        expired,
        forcedStatus,
        forceZero,
        answers: currentAnswers,
        questionOrder,
        currentQuestionIndex,
        fraudTabSwitches: fraudTab,
        fraudClipboardAttempts: fraudClip,
      });

      if (!res.ok || !res.result) {
        setError(res.error || "No fue posible enviar el examen.");
        return;
      }

      clearStoredResume();
      const r = res.result;

      const serverPerQuestion = r.perQuestion as Array<Record<string, unknown>> | undefined;
      let fallbackPerQuestion:
        | Array<{
            questionId: string;
            earned: number;
            points: number;
            fullyCorrect: boolean;
            ratio: number;
            multipleChoice?: MultipleChoiceBreakdown | null;
          }>
        | undefined;

      if (!serverPerQuestion || !serverPerQuestion.length) {
        const display = displayQuestionsRef.current;
        const ans = answersRef.current;
        if (display && display.length) {
          const gqs: GradingQuestion[] = display.map((q) => ({
            questionId: q.questionId,
            type: q.type,
            points: q.points,
            options: q.options,
            partialCredit: Boolean(q.partialCredit ?? true),
            answerRules: q.answerRules,
            puzzle: q.puzzle,
          }));
          const snapshot = calculateGradeSnapshot({
            displayQuestions: gqs,
            answers: ans,
            fraudEnabled: exam?.fraudEnabled !== false,
            fraudTabSwitches: exam?.fraudEnabled !== false ? fraud.fraudCountsRef.current.tab : 0,
            fraudClipboardAttempts: exam?.fraudEnabled !== false ? fraud.fraudCountsRef.current.clip : 0,
            forceZero: Boolean(opts?.forceZero),
          });
          fallbackPerQuestion = snapshot.perQuestion;
        }
      }

      setResult({
        score5: toNumber(r.score5, 0),
        score50: toNumber(r.score50, 0),
        score5Raw: toNumber(r.score5Raw, 0),
        score50Raw: toNumber(r.score50Raw, 0),
        earned: toNumber(r.earned, 0),
        total: toNumber(r.total, 0),
        fraudTabSwitches: toNumber(r.fraudTabSwitches, 0),
        fraudClipboardAttempts: toNumber(r.fraudClipboardAttempts, 0),
        fraudPenalty0to5: toNumber(r.fraudPenalty0to5, 0),
        fraudForcedFail: toBoolean(r.fraudForcedFail, false),
        perQuestion: serverPerQuestion?.length
          ? (serverPerQuestion as Array<{
              questionId: string;
              earned: number;
              points: number;
              fullyCorrect: boolean;
              ratio: number;
              multipleChoice?: MultipleChoiceBreakdown | null;
            }>)
          : fallbackPerQuestion,
      });
      setSubmitted(true);
      setStep("result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No fue posible enviar el examen.";
      setError(msg || "No fue posible enviar el examen.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    step,
    setStep,
    code,
    setCode,
    loading,
    error,
    setError,
    exam,
    questions,
    questionOrder,
    displayQuestions,
    attemptId,
    rulesAccepted,
    setRulesAccepted,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    documentId,
    setDocumentId,
    email,
    setEmail,
    answers,
    setAnswer,
    remainingMs,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    submitted,
    submitting,
    fraudTabSwitches: fraud.fraudTabSwitches,
    fraudClipboardAttempts: fraud.fraudClipboardAttempts,
    graceUsedToastVisible: fraud.graceUsedToastVisible,
    dismissGraceToast: fraud.dismissGraceToast,
    result,
    resultOpenQuestionIds,
    toggleResultQuestion: (id: string) => {
      setResultOpenQuestionIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    openAllResultQuestions: () => {
      setResultOpenQuestionIds(new Set(displayQuestionsRef.current.map((q) => q.questionId)));
    },
    closeAllResultQuestions: () => setResultOpenQuestionIds(new Set()),
    annulled: realtime.annulled,
    annulReason: realtime.annulReason,
    adminMessage: realtime.adminMessage,
    adminMessageKey: realtime.adminMessageKey,
    dismissedAdminMessageKey: realtime.dismissedAdminMessageKey,
    dismissAdminMessage: realtime.dismissAdminMessage,
    resultsReviewBlocked: reviewGuard.resultsReviewBlocked,
    resultsReviewBlockReason: reviewGuard.resultsReviewBlockReason,
    resultsReviewRemainingMs: reviewGuard.resultsReviewRemainingMs,
    RESULTS_REVIEW_TOTAL_MS: reviewGuard.RESULTS_REVIEW_TOTAL_MS,
    formatReviewClock: reviewGuard.formatReviewClock,
    formatRemaining,
    loadExamByCode,
    startAttempt,
    submitAttempt,
  };
}
