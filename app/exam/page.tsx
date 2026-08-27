"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { normalizeFullName, normalizePersonNamePart } from "@/lib/text/normalize";
import { IconButton } from "@/app/admin/ui/icon-button";
import { DocumentationDrawer } from "@/app/ui/documentation-drawer";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Lock,
  LockKeyhole,
  OctagonAlert,
  Save,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Timer,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import {
  calculateGradeSnapshot,
  countPenalizableFraudEvents,
  evaluateQuestion as evaluateQuestionShared,
  FRAUD_FAIL_TOTAL_EVENTS,
  FRAUD_GRACE_EVENTS,
  FRAUD_PENALTY_PER_EVENT_0TO5,
  getMultipleChoiceBreakdown,
  isQuestionFullyCorrect as isQuestionFullyCorrectShared,
  type GradingQuestion,
  type MultipleChoiceBreakdown,
} from "@/lib/exam-grading";

type PublishedExam = {
  id: string;
  templateId: string;
  name: string;
  accessCode: string;
  status: string;
  questionCount: number;
  timeLimitMinutes: number;
  documentationMarkdown: string;
  fraudEnabled: boolean;
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

type Step = "code" | "student" | "rules" | "exam" | "result";

const RESUME_KEY = "zse:examResume";
const ATTEMPT_STATE_PREFIX = "zse:attemptState:";

function normalizeStatementMarkdown(statement: string) {
  const raw = typeof statement === "string" ? statement : "";
  if (!raw.includes("```")) return raw;
  return raw
    .replace(/```(\w+)[ \t]+/g, "```$1\n")
    .replace(/([^\n])```/g, "$1\n```");
}

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

function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function OTPInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const digits = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const char = value[i];
        return /\d/.test(char ?? "") ? char : "";
      }),
    [value],
  );

  function setDigit(index: number, digit: string) {
    const next = digits.map((d, i) => (i === index ? digit : d)).join("").replace(/\D/g, "").slice(0, 6);
    onChange(next);
  }

  function focusIndex(index: number) {
    const el = document.getElementById(`otp-${index}`) as HTMLInputElement | null;
    el?.focus();
    el?.select();
  }

  return (
    <div className="flex justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={d}
          onChange={(e) => {
            const nextDigit = e.target.value.replace(/\D/g, "").slice(-1);
            setDigit(i, nextDigit);
            if (nextDigit && i < 5) focusIndex(i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              focusIndex(i - 1);
            }
            if (e.key === "ArrowLeft" && i > 0) focusIndex(i - 1);
            if (e.key === "ArrowRight" && i < 5) focusIndex(i + 1);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (!pasted) return;
            onChange(pasted);
            const nextIndex = Math.min(5, pasted.length - 1);
            setTimeout(() => focusIndex(nextIndex), 0);
            e.preventDefault();
          }}
          className="h-12 w-10 rounded-2xl border border-indigo-200 bg-indigo-50 text-center text-lg font-semibold tracking-tight text-indigo-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-200/50"
          maxLength={1}
        />
      ))}
    </div>
  );
}

export default function ExamPublicPage() {
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
  const [studentFieldIndex, setStudentFieldIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const answersRef = useRef<Record<string, unknown>>({});
  const displayQuestionsRef = useRef<SnapshotQuestion[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [endAtMs, setEndAtMs] = useState<number | null>(null);
  const [attemptStartMs, setAttemptStartMs] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showExamSummary, setShowExamSummary] = useState(false);
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [finalSubmitAccepted, setFinalSubmitAccepted] = useState(false);
  const [result, setResult] = useState<
    | {
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
      }
    | null
  >(null);
  const [resultOpenQuestionIds, setResultOpenQuestionIds] = useState<Set<string>>(new Set());
  const [annulled, setAnnulled] = useState(false);
  const [annulReason, setAnnulReason] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminMessageKey, setAdminMessageKey] = useState<string | null>(null);
  const [dismissedAdminMessageKey, setDismissedAdminMessageKey] = useState<string | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);
  const [broadcastMessageKey, setBroadcastMessageKey] = useState<string | null>(null);
  const [dismissedBroadcastMessageKey, setDismissedBroadcastMessageKey] = useState<string | null>(null);

  const [fraudTabSwitches, setFraudTabSwitches] = useState(0);
  const [fraudClipboardAttempts, setFraudClipboardAttempts] = useState(0);
  const [graceUsedToastVisible, setGraceUsedToastVisible] = useState(false);
  const [graceDismissedAt, setGraceDismissedAt] = useState<number | null>(null);
  const fraudCountsRef = useRef({ tab: 0, clip: 0 });
  const fraudRuntimeRef = useRef({
    lastSyncAt: 0,
    lastClipboardCountAt: 0,
    lastTabCountAt: 0,
    isVisible: true,
    submittedFraudFail: false,
  });
  const autosaveTimerRef = useRef<number | null>(null);
  const lastAutosaveKeyRef = useRef<string>("");
  const autoResumeRef = useRef(false);

  // ====== Vista de resultados: 2 min countdown + bloqueo por captura/copiar ======
  const RESULTS_REVIEW_TOTAL_MS = 120_000; // 2 minutos
  const [resultsReviewRemainingMs, setResultsReviewRemainingMs] = useState<number>(RESULTS_REVIEW_TOTAL_MS);
  const [resultsReviewBlocked, setResultsReviewBlocked] = useState<boolean>(false);
  const [resultsReviewBlockReason, setResultsReviewBlockReason] = useState<string | null>(null);
  const resultsReviewStartRef = useRef<number | null>(null);
  const resultsReviewIntervalRef = useRef<number | null>(null);
  const resultsReviewListenersRef = useRef<{ cleaned: boolean }>({ cleaned: true });

  function formatReviewClock(ms: number) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const mm = Math.floor(totalSeconds / 60);
    const ss = totalSeconds - mm * 60;
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  }
  function blockResultsView(reason: string) {
    if (resultsReviewBlocked) return;
    setResultsReviewBlocked(true);
    setResultsReviewBlockReason(reason);
  }

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const displayQuestions = useMemo(() => {
    const limitCount = exam?.questionCount ? Math.max(1, Math.min(exam.questionCount, questions.length)) : questions.length;
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

  useEffect(() => {
    if (step !== "code") return;
    try {
      const raw = localStorage.getItem(RESUME_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { accessCode?: unknown };
      const c = typeof parsed.accessCode === "string" ? parsed.accessCode : "";
      if (c && /^\d{6}$/.test(c)) setCode(c);
    } catch {}
  }, [step]);

  useEffect(() => {
    if (autoResumeRef.current) return;
    if (step !== "code") return;
    if (loading) return;
    if (!/^\d{6}$/.test(code.trim())) return;
    try {
      const raw = localStorage.getItem(RESUME_KEY);
      if (!raw) return;
      autoResumeRef.current = true;
      void loadExamByCode();
    } catch {}
  }, [step, code, loading]);

  useEffect(() => {
    fraudCountsRef.current = { tab: fraudTabSwitches, clip: fraudClipboardAttempts };
  }, [fraudTabSwitches, fraudClipboardAttempts]);

  useEffect(() => {
    if (step !== "exam" || submitted || !exam || exam.fraudEnabled === false) return;
    const total = fraudTabSwitches + fraudClipboardAttempts;
    if (total >= FRAUD_GRACE_EVENTS) {
      const lastDismissed = graceDismissedAt ?? 0;
      if (!graceUsedToastVisible && Date.now() - lastDismissed > 10_000) {
        setGraceUsedToastVisible(true);
      }
    } else {
      if (graceUsedToastVisible) setGraceUsedToastVisible(false);
    }
  }, [fraudTabSwitches, fraudClipboardAttempts, step, submitted, exam, graceUsedToastVisible, graceDismissedAt]);

  useEffect(() => {
    if (!graceUsedToastVisible) return;
    const t = window.setTimeout(() => {
      setGraceUsedToastVisible(false);
      setGraceDismissedAt(Date.now());
    }, 9000);
    return () => window.clearTimeout(t);
  }, [graceUsedToastVisible]);

  // ---------------------------------------------------------------------------
  // Vista de resultados (step === "result"): countdown de 2 minutos
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Solo activar cuando estemos realmente en resultados y NO estemos bloqueados
    if (step !== "result" || !result || submitting || resultsReviewBlocked) {
      resultsReviewStartRef.current = null;
      if (resultsReviewIntervalRef.current != null) {
        window.clearInterval(resultsReviewIntervalRef.current);
        resultsReviewIntervalRef.current = null;
      }
      return;
    }
    // Inicializar reloj cuando entramos por primera vez
    if (resultsReviewStartRef.current == null) {
      resultsReviewStartRef.current = Date.now();
      setResultsReviewRemainingMs(RESULTS_REVIEW_TOTAL_MS);
    }
    const startAt = resultsReviewStartRef.current;
    resultsReviewIntervalRef.current = Number(
      window.setInterval(() => {
        const elapsed = Date.now() - startAt;
        const remaining = RESULTS_REVIEW_TOTAL_MS - elapsed;
        if (remaining <= 0) {
          setResultsReviewRemainingMs(0);
          blockResultsView("timeout");
          if (resultsReviewIntervalRef.current != null) {
            window.clearInterval(resultsReviewIntervalRef.current);
            resultsReviewIntervalRef.current = null;
          }
        } else {
          setResultsReviewRemainingMs(remaining);
        }
      }, 250),
    );
    return () => {
      if (resultsReviewIntervalRef.current != null) {
        window.clearInterval(resultsReviewIntervalRef.current);
        resultsReviewIntervalRef.current = null;
      }
    };
  }, [step, result, submitting, resultsReviewBlocked]);

  // ---------------------------------------------------------------------------
  // Vista de resultados: listeners de bloqueo
  // Detecta copiar/pegar, selección, clic derecho, atajos de captura, Ctrl+P,
  // Ctrl+S y cierra inmediatamente la vista con mensaje al estudiante.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const active = step === "result" && !!result && !submitting && !resultsReviewBlocked;
    if (!active) {
      resultsReviewListenersRef.current.cleaned = true;
      return;
    }
    resultsReviewListenersRef.current.cleaned = false;

    function onProtectedCopyCut(e: ClipboardEvent) {
      if (resultsReviewBlocked) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      blockResultsView("copy");
    }
    function onProtectedPaste(e: ClipboardEvent) {
      if (resultsReviewBlocked) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      blockResultsView("paste");
    }
    function onProtectedContextMenu(e: MouseEvent) {
      if (resultsReviewBlocked) return;
      e.preventDefault();
      blockResultsView("contextmenu");
    }
    function onProtectedSelectStart(e: Event) {
      if (resultsReviewBlocked) return;
      // Permitir selección dentro de inputs (ej: input de código OTP en resumen futuro)
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      e.preventDefault();
      blockResultsView("select");
    }
    function onProtectedDragStart(e: DragEvent) {
      if (resultsReviewBlocked) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      e.preventDefault();
      blockResultsView("drag");
    }
    function onProtectedBeforePrint() {
      if (resultsReviewBlocked) return;
      blockResultsView("print");
      try {
        // Cancelar diálogo de impresión
        window.stop();
      } catch {}
    }
    function onProtectedKeyDown(e: KeyboardEvent) {
      if (resultsReviewBlocked) return;
      const isMac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || "");
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      const key = (e.key || "").toString();
      const code = (e.code || "").toString();

      // Ctrl+P / ⌘+P → Imprimir / guardar como PDF
      if (ctrl && key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("print");
        return;
      }
      // Ctrl+S / ⌘+S → Guardar página como HTML
      if (ctrl && key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("copy");
        return;
      }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C / F12 → DevTools
      const devShortcut =
        (ctrl && e.shiftKey && ["I", "J", "C"].includes(key.toUpperCase())) || key === "F12";
      if (devShortcut) {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("devtools");
        return;
      }
      // Ctrl+U / ⌘+U → Ver código fuente
      if (ctrl && key.toLowerCase() === "u") {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("viewsource");
        return;
      }
      // PrintScreen
      if (key === "PrintScreen" || code === "PrintScreen") {
        e.preventDefault();
        blockResultsView("screenshot");
        return;
      }
      // Win + Shift + S (Snipping Tool, Windows) | Cmd+Shift+3/4/5 (macOS capture)
      const winShiftS = !isMac && (e.metaKey || e.key === "Meta") && e.shiftKey && code === "KeyS";
      const macCapture = isMac && e.metaKey && e.shiftKey && ["Digit3", "Digit4", "Digit5"].includes(code);
      if (winShiftS || macCapture) {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("screenshot");
        return;
      }
    }

    document.addEventListener("copy", onProtectedCopyCut, true);
    document.addEventListener("cut", onProtectedCopyCut, true);
    document.addEventListener("paste", onProtectedPaste, true);
    document.addEventListener("contextmenu", onProtectedContextMenu, true);
    document.addEventListener("selectstart", onProtectedSelectStart, true);
    document.addEventListener("dragstart", onProtectedDragStart, true);
    window.addEventListener("beforeprint", onProtectedBeforePrint, true);
    document.addEventListener("keydown", onProtectedKeyDown, true);

    return () => {
      if (resultsReviewListenersRef.current.cleaned) return;
      resultsReviewListenersRef.current.cleaned = true;
      document.removeEventListener("copy", onProtectedCopyCut, true);
      document.removeEventListener("cut", onProtectedCopyCut, true);
      document.removeEventListener("paste", onProtectedPaste, true);
      document.removeEventListener("contextmenu", onProtectedContextMenu, true);
      document.removeEventListener("selectstart", onProtectedSelectStart, true);
      document.removeEventListener("dragstart", onProtectedDragStart, true);
      window.removeEventListener("beforeprint", onProtectedBeforePrint, true);
      document.removeEventListener("keydown", onProtectedKeyDown, true);
    };
  }, [step, result, submitting, resultsReviewBlocked]);

  async function loadExamByCode() {
    setLoading(true);
    setError(null);
    try {
      const c = code.trim();
      if (!/^\d{6}$/.test(c)) {
        setError("El codigo debe tener 6 digitos.");
        return;
      }

      const res = await fetch("/api/exam/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "No fue posible cargar el examen.");
        return;
      }

      const examRow = (data?.exam ?? null) as Record<string, unknown> | null;
      const nextExam: PublishedExam = {
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
      if (!nextExam.id) {
        setError("No fue posible cargar el examen.");
        return;
      }
      setExam(nextExam);

      const qs = Array.isArray(data?.questions) ? (data?.questions as unknown[]) : [];
      const loadedQuestions = qs.map((raw) => {
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
      setShowExamSummary(false);
      setShowQuestionMap(false);

      setRulesAccepted(false);
      setDocOpen(false);
      setFraudTabSwitches(0);
      setFraudClipboardAttempts(0);
      fraudCountsRef.current = { tab: 0, clip: 0 };
      fraudRuntimeRef.current.submittedFraudFail = false;

      let resumed = false;
      try {
        const raw = localStorage.getItem(RESUME_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            publishedExamId?: unknown;
            attemptId?: unknown;
            accessCode?: unknown;
          };
          const resumeExamId = typeof parsed.publishedExamId === "string" ? parsed.publishedExamId : "";
          const resumeAttemptId = typeof parsed.attemptId === "string" ? parsed.attemptId : "";
          if (resumeExamId === nextExam.id && resumeAttemptId) {
            let attemptSnap: Awaited<ReturnType<typeof getDoc>> | null = null;
            try {
              attemptSnap = await getDoc(doc(firestore, "attempts", resumeAttemptId));
            } catch {
              attemptSnap = null;
            }
            if (attemptSnap?.exists()) {
              const attempt = attemptSnap.data() as Record<string, unknown>;
              const status = toString(attempt.status, "in_progress");
              if (status === "in_progress") {
                const startedAt = attempt.startedAt as unknown;
                const startMs = toMillis(startedAt) ?? Date.now();
                const ends = startMs + nextExam.timeLimitMinutes * 60 * 1000;
                setAttemptId(resumeAttemptId);
                setAttemptStartMs(startMs);
                setEndAtMs(ends);
                setRemainingMs(ends - Date.now());
                setCurrentQuestionIndex(toNumber(attempt.currentQuestionIndex, 0));

                const ord = Array.isArray(attempt.questionOrder)
                  ? (attempt.questionOrder as unknown[])
                      .map((x) => (typeof x === "string" ? x : ""))
                      .filter(Boolean)
                  : [];
                setQuestionOrder(ord);

                const ans = attempt.answers;
                if (ans && typeof ans === "object") setAnswers(ans as Record<string, unknown>);

                const fraudTab = toNumber(attempt.fraudTabSwitches, 0);
                const fraudClip = toNumber(attempt.fraudClipboardAttempts, 0);
                setFraudTabSwitches(fraudTab);
                setFraudClipboardAttempts(fraudClip);
                fraudCountsRef.current = { tab: fraudTab, clip: fraudClip };

                setRulesAccepted(true);
                setStep("exam");
                resumed = true;

                const answersMap = ans && typeof ans === "object" ? (ans as Record<string, unknown>) : {};
                const totalQuestionsLocal = loadedQuestions.length;
                const correctCount = loadedQuestions.reduce((acc, q) => {
                  const earned = evaluateQuestion(q, answersMap[q.questionId]);
                  if (!Number.isFinite(earned)) return acc;
                  if (q.type === "open_concept") return acc + (earned > 0 ? 1 : 0);
                  return acc + (earned >= q.points && q.points > 0 ? 1 : 0);
                }, 0);
                const valuePerQuestion0to5 = totalQuestionsLocal > 0 ? 5 / totalQuestionsLocal : 0;
                const valuePerQuestion0to50 = totalQuestionsLocal > 0 ? 50 / totalQuestionsLocal : 0;
                const score5Raw = correctCount * valuePerQuestion0to5;
                const score50Raw = correctCount * valuePerQuestion0to50;
                const fraudTotal = nextExam.fraudEnabled ? fraudTab + fraudClip : 0;
                const fraudPenalty0to5 = nextExam.fraudEnabled
                  ? Number((countPenalizableFraudEvents(fraudTotal, FRAUD_GRACE_EVENTS) * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2))
                  : 0;

                if ((nextExam.fraudEnabled && fraudTotal >= FRAUD_FAIL_TOTAL_EVENTS) || Date.now() >= ends) {
                  const forceZero = nextExam.fraudEnabled && fraudTotal >= FRAUD_FAIL_TOTAL_EVENTS;
                  const status = forceZero ? "submitted_fraud" : "submitted_expired";
                  const adjusted5 = forceZero ? 0 : Math.max(0, score5Raw - fraudPenalty0to5);
                  const adjusted50 = forceZero ? 0 : (adjusted5 / 5) * 50;
                  const score5 = Number(adjusted5.toFixed(2));
                  const score50 = Number(adjusted50.toFixed(2));

                  try {
                    await updateDoc(doc(firestore, "attempts", resumeAttemptId), {
                      status,
                      answers: answersMap,
                      correctCount,
                      questionCount: totalQuestionsLocal,
                      questionValue0to5: Number(valuePerQuestion0to5.toFixed(4)),
                      questionValue0to50: Number(valuePerQuestion0to50.toFixed(4)),
                      earnedPoints: Number(correctCount),
                      totalPoints: Number(totalQuestionsLocal),
                      grade0to5Raw: Number(score5Raw.toFixed(2)),
                      grade0to50Raw: Number(score50Raw.toFixed(2)),
                      grade0to5: score5,
                      grade0to50: score50,
                      fraudTabSwitches: nextExam.fraudEnabled ? fraudTab : 0,
                      fraudClipboardAttempts: nextExam.fraudEnabled ? fraudClip : 0,
                      fraudPenalty0to5,
                      fraudForcedFail: forceZero,
                      gradeMethod: "per_question_equal",
                      submittedAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                    });
                  } catch {}

                  try {
                    localStorage.removeItem(RESUME_KEY);
                  } catch {}

                  setResult({
                    score5,
                    score50,
                    score5Raw: Number(score5Raw.toFixed(2)),
                    score50Raw: Number(score50Raw.toFixed(2)),
                    earned: Number(correctCount),
                    total: Number(totalQuestionsLocal),
                    fraudTabSwitches: nextExam.fraudEnabled ? fraudTab : 0,
                    fraudClipboardAttempts: nextExam.fraudEnabled ? fraudClip : 0,
                    fraudPenalty0to5,
                    fraudForcedFail: forceZero,
                  });
                  setSubmitted(true);
                  setStep("result");
                }
              }
            } else {
              try {
                const rawAttempt = localStorage.getItem(`${ATTEMPT_STATE_PREFIX}${resumeAttemptId}`);
                if (rawAttempt) {
                  const parsedAttempt = JSON.parse(rawAttempt) as Record<string, unknown>;
                  const pid = toString(parsedAttempt.publishedExamId, "");
                  if (pid === nextExam.id) {
                    const startMs = toNumber(parsedAttempt.startedAtMs, Date.now());
                    const ends = startMs + nextExam.timeLimitMinutes * 60 * 1000;
                    setAttemptId(resumeAttemptId);
                    setAttemptStartMs(startMs);
                    setEndAtMs(ends);
                    setRemainingMs(ends - Date.now());
                    setCurrentQuestionIndex(toNumber(parsedAttempt.currentQuestionIndex, 0));

                    const ord = Array.isArray(parsedAttempt.questionOrder)
                      ? (parsedAttempt.questionOrder as unknown[]).map((x) => (typeof x === "string" ? x : "")).filter(Boolean)
                      : [];
                    setQuestionOrder(ord);

                    const ans = parsedAttempt.answers;
                    if (ans && typeof ans === "object") setAnswers(ans as Record<string, unknown>);

                    const fraudTab = toNumber(parsedAttempt.fraudTabSwitches, 0);
                    const fraudClip = toNumber(parsedAttempt.fraudClipboardAttempts, 0);
                    setFraudTabSwitches(fraudTab);
                    setFraudClipboardAttempts(fraudClip);
                    fraudCountsRef.current = { tab: fraudTab, clip: fraudClip };

                    setRulesAccepted(true);
                    setStep("exam");
                    resumed = true;
                  }
                }
              } catch {}
            }
          }
        }
      } catch {}

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
      setError("Correo invalido.");
      return;
    }

    const emailNorm = email.trim().toLowerCase();
    const docNorm = documentId.trim();
    const order = shuffleIds(questions.map((q) => q.questionId));
    let attemptIdRes = "";
    let startedAtMs = Date.now();
    let fraudEnabledRes: boolean | null = null;
    try {
      const res = await fetch("/api/exam/attempt/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publishedExamId: exam.id,
          accessCode: exam.accessCode,
          examTemplateId: exam.templateId || null,
          templateId: exam.templateId || null,
          examName: exam.name,
          studentFirstName: n1.value,
          studentLastName: n2.value,
          studentFullName: full.value,
          documentId: docNorm,
          email: emailNorm,
          questionCount: questions.length,
          questionOrder: order,
        }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "No fue posible validar el intento unico. Intenta de nuevo.");
        return;
      }
      attemptIdRes = typeof data?.attemptId === "string" ? data.attemptId : "";
      const ms = toNumber(data?.startedAtMs, Date.now());
      startedAtMs = ms > 0 ? ms : Date.now();
      fraudEnabledRes = typeof data?.fraudEnabled === "boolean" ? data.fraudEnabled : null;
    } catch {
      setError("No fue posible validar el intento unico. Intenta de nuevo.");
      return;
    }
    if (!attemptIdRes) {
      setError("No fue posible inicializar el intento. Intenta de nuevo.");
      return;
    }

    const ends = startedAtMs + exam.timeLimitMinutes * 60 * 1000;

    setAttemptId(attemptIdRes);
    setQuestionOrder(order);
    setAnswers({});
    setAttemptStartMs(startedAtMs);
    setEndAtMs(ends);
    setRemainingMs(ends - Date.now());
    setCurrentQuestionIndex(0);
    setShowExamSummary(false);
    setShowQuestionMap(false);
    setFinalSubmitAccepted(false);
    fraudRuntimeRef.current.isVisible = document.visibilityState === "visible";
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ publishedExamId: exam.id, attemptId: attemptIdRes, accessCode: exam.accessCode }));
    } catch {}
    try {
      localStorage.setItem(
        `${ATTEMPT_STATE_PREFIX}${attemptIdRes}`,
        JSON.stringify({
          attemptId: attemptIdRes,
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
        }),
      );
    } catch {}
    if (fraudEnabledRes !== null && fraudEnabledRes !== exam.fraudEnabled) {
      setExam((prev) => (prev ? { ...prev, fraudEnabled: fraudEnabledRes } : prev));
    }
    setStep("exam");
  }

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
          setError("Este examen ya esta cerrado.");
          setStep("code");
          setExam(null);
        }
      },
      () => {},
    );

    return () => unsub();
  }, [attemptStartMs, endAtMs, exam?.id, questions.length, step, submitted]);

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
              "Tu intento fue anulado por el docente. Nota asignada: 0.00, sin posibilidad de recuperacion.",
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
  }, [attemptId, step, questions]);

  useEffect(() => {
    if (!attemptId) return;
    try {
      const raw = localStorage.getItem(`zse:adminMsgDismissed:${attemptId}`);
      if (raw && typeof raw === "string") setDismissedAdminMessageKey(raw);
    } catch {}
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId || step !== "exam" || submitted) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        const saveFraudEnabled = exam?.fraudEnabled !== false;
        const nextFraudTab = saveFraudEnabled ? fraudTabSwitches : 0;
        const nextFraudClip = saveFraudEnabled ? fraudClipboardAttempts : 0;
        const payloadKey = JSON.stringify({
          answers,
          currentQuestionIndex,
          questionOrder,
          fraudTabSwitches: nextFraudTab,
          fraudClipboardAttempts: nextFraudClip,
        });
        if (payloadKey === lastAutosaveKeyRef.current) return;
        lastAutosaveKeyRef.current = payloadKey;
        try {
          localStorage.setItem(
            `${ATTEMPT_STATE_PREFIX}${attemptId}`,
            JSON.stringify({
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
            }),
          );
        } catch {}
        await updateDoc(doc(firestore, "attempts", attemptId), {
          answers,
          currentQuestionIndex,
          questionOrder,
          fraudTabSwitches: nextFraudTab,
          fraudClipboardAttempts: nextFraudClip,
          updatedAt: serverTimestamp(),
        });
      } catch {}
    }, 3000);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    };
  }, [
    attemptId,
    step,
    submitted,
    exam?.fraudEnabled,
    exam?.id,
    exam?.accessCode,
    attemptStartMs,
    endAtMs,
    answers,
    currentQuestionIndex,
    questionOrder,
    fraudTabSwitches,
    fraudClipboardAttempts,
  ]);

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function hasAnswer(q: SnapshotQuestion) {
    const val = answers[q.questionId];
    if (q.type === "single_choice") return typeof val === "string" && val.trim().length > 0;
    if (q.type === "multiple_choice") return Array.isArray(val) && val.length > 0;
    if (q.type === "open_concept") return toString(val, "").trim().length > 0;
    if (!val || typeof val !== "object") return false;
    return Object.keys(val as Record<string, unknown>).length > 0;
  }

  function renderQuestionInput(q: SnapshotQuestion) {
    if (q.type === "single_choice") {
      const selected = toString(answers[q.questionId], "");
      return (
        <div className="space-y-3">
          {(q.options ?? []).map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                selected === o.id ? "border-indigo-200 bg-indigo-50" : "border-zinc-200 bg-white hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name={q.questionId}
                checked={selected === o.id}
                onChange={() => setAnswer(q.questionId, o.id)}
                className="mt-1 h-4 w-4 accent-indigo-600"
              />
              <span className="text-base font-medium leading-relaxed text-zinc-900 sm:text-lg">{o.text}</span>
            </label>
          ))}
        </div>
      );
    }

    if (q.type === "multiple_choice") {
      const current = Array.isArray(answers[q.questionId]) ? (answers[q.questionId] as string[]) : [];
      return (
        <div className="space-y-3">
          {(q.options ?? []).map((o) => {
            const checked = current.includes(o.id);
            return (
              <label
                key={o.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                  checked ? "border-indigo-200 bg-indigo-50" : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...current, o.id] : current.filter((x) => x !== o.id);
                    setAnswer(q.questionId, next);
                  }}
                  className="mt-1 h-4 w-4 accent-indigo-600"
                />
                <span className="text-base font-medium leading-relaxed text-zinc-900 sm:text-lg">{o.text}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (q.type === "open_concept") {
      return (
        <textarea
          value={toString(answers[q.questionId], "")}
          onChange={(e) => setAnswer(q.questionId, e.target.value)}
          className="min-h-36 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base leading-relaxed text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-200/40"
          placeholder="Escribe tu respuesta"
        />
      );
    }

    if (q.type === "puzzle_order") {
      return (
        <div className="space-y-3">
          {(((q.puzzle?.items as Array<Record<string, unknown>>) ?? [])).map((it) => {
            const map = (answers[q.questionId] as Record<string, number>) ?? {};
            const n = (((q.puzzle?.items as Array<Record<string, unknown>>) ?? [])).length;
            const current = map[toString(it.id)] ?? 0;
            return (
              <div key={toString(it.id)} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-base font-medium text-zinc-900">
                  {toString(it.text)}
                </div>
                <select
                  value={String(current)}
                  onChange={(e) =>
                    setAnswer(q.questionId, {
                      ...map,
                      [toString(it.id)]: Number(e.target.value || 0),
                    })
                  }
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-200/40"
                >
                  <option value="0">Pos.</option>
                  {Array.from({ length: n }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={String(p)}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      );
    }

    if (q.type === "puzzle_match") {
      return (
        <div className="space-y-3">
          {(((q.puzzle?.leftItems as Array<Record<string, unknown>>) ?? [])).map((left) => {
            const ans = (answers[q.questionId] as Record<string, string>) ?? {};
            const rightItems = ((q.puzzle?.rightItems as Array<Record<string, unknown>>) ?? []);
            const current = ans[toString(left.id)] ?? "";
            return (
              <div key={toString(left.id)} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-base font-medium text-zinc-900">
                  {toString(left.text)}
                </div>
                <select
                  value={current}
                  onChange={(e) => setAnswer(q.questionId, { ...ans, [toString(left.id)]: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-200/40"
                >
                  <option value="">Selecciona</option>
                  {rightItems.map((ri) => {
                    const id = toString(ri.id);
                    return (
                      <option key={id} value={id}>
                        {toString(ri.text)}
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {(((q.puzzle?.slots as Array<Record<string, unknown>>) ?? [])).map((slot) => {
          const ans = (answers[q.questionId] as Record<string, string>) ?? {};
          const options = ((slot.options as Array<Record<string, unknown>>) ?? []);
          const current = ans[toString(slot.slotId)] ?? "";
          return (
            <div key={toString(slot.slotId)} className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
              <div className="rounded-xl bg-zinc-50 px-3 py-2 text-base font-medium text-zinc-900">
                {toString(slot.slotId)}
              </div>
              <select
                value={current}
                onChange={(e) =>
                  setAnswer(q.questionId, {
                    ...ans,
                    [toString(slot.slotId)]: e.target.value,
                  })
                }
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-200/40"
              >
                <option value="">Selecciona</option>
                {options.map((o) => {
                  const id = toString(o.id);
                  return (
                    <option key={id} value={id}>
                      {toString(o.text)}
                    </option>
                  );
                })}
              </select>
            </div>
          );
        })}
      </div>
    );
  }

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

  function getMultipleChoiceBreakdownFor(q: SnapshotQuestion, answer: unknown): MultipleChoiceBreakdown | null {
    if (q.type !== "multiple_choice") return null;
    const gq: GradingQuestion = {
      questionId: q.questionId,
      type: q.type,
      points: q.points,
      options: q.options,
      partialCredit: Boolean(q.partialCredit ?? true),
      answerRules: q.answerRules,
      puzzle: q.puzzle,
    };
    return getMultipleChoiceBreakdown(gq, answer);
  }

  function isQuestionFullyCorrect(q: SnapshotQuestion) {
    const gq: GradingQuestion = {
      questionId: q.questionId,
      type: q.type,
      points: q.points,
      options: q.options,
      partialCredit: Boolean(q.partialCredit ?? true),
      answerRules: q.answerRules,
      puzzle: q.puzzle,
    };
    return isQuestionFullyCorrectShared(gq, answersRef.current);
  }

  async function submitAttempt(
    expired = false,
    opts?: { forcedStatus?: "submitted" | "submitted_expired" | "submitted_fraud"; forceZero?: boolean },
  ) {
    if (!attemptId) {
      setError("No se encontro el intento actual. Recarga el examen y vuelve a intentarlo.");
      return;
    }
    if (submitted || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const fraudEnabled = exam?.fraudEnabled !== false;
      const currentAnswers = answersRef.current;

      const fraudTab = fraudEnabled ? fraudCountsRef.current.tab : 0;
      const fraudClip = fraudEnabled ? fraudCountsRef.current.clip : 0;
      const forcedStatus = fraudEnabled ? opts?.forcedStatus : undefined;
      const forceZero = fraudEnabled ? Boolean(opts?.forceZero) : false;

      const res = await fetch("/api/exam/attempt/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
        }),
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
        setError(fromJson || fromText || `HTTP ${res.status}: No fue posible enviar el examen.`);
        return;
      }

      const r = (data?.result ?? null) as Record<string, unknown> | null;
      if (!r) {
        setError("No fue posible enviar el examen.");
        return;
      }

      try {
        localStorage.removeItem(RESUME_KEY);
      } catch {}

      const serverPerQuestion = (r as Record<string, unknown>)?.perQuestion as
        | Array<Record<string, unknown>>
        | undefined;
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
            fraudTabSwitches: exam?.fraudEnabled !== false ? fraudCountsRef.current.tab : 0,
            fraudClipboardAttempts: exam?.fraudEnabled !== false ? fraudCountsRef.current.clip : 0,
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

  useEffect(() => {
    if (step !== "exam" || !attemptId || submitted || exam?.fraudEnabled === false) return;
    const id = attemptId;

    async function syncFraud(nextTab: number, nextClip: number, force = false) {
      const now = Date.now();
      if (!force && now - fraudRuntimeRef.current.lastSyncAt < 1500) return;
      fraudRuntimeRef.current.lastSyncAt = now;
      const total = nextTab + nextClip;
      const penalty = Number((countPenalizableFraudEvents(total, FRAUD_GRACE_EVENTS) * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2));
      try {
        await updateDoc(doc(firestore, "attempts", id), {
          fraudTabSwitches: nextTab,
          fraudClipboardAttempts: nextClip,
          fraudPenalty0to5: penalty,
          updatedAt: serverTimestamp(),
        });
      } catch {
        return;
      }
    }

    function applyTabSwitch() {
      const now = Date.now();
      if (now - fraudRuntimeRef.current.lastTabCountAt < 500) return;
      if (fraudRuntimeRef.current.submittedFraudFail) return;
      const currentTotal = fraudCountsRef.current.tab + fraudCountsRef.current.clip;
      if (currentTotal >= FRAUD_FAIL_TOTAL_EVENTS) {
        fraudRuntimeRef.current.submittedFraudFail = true;
        return;
      }
      fraudRuntimeRef.current.lastTabCountAt = now;

      const nextTab = fraudCountsRef.current.tab + 1;
      const nextClip = fraudCountsRef.current.clip;
      fraudCountsRef.current = { tab: nextTab, clip: nextClip };
      setFraudTabSwitches(nextTab);
      void syncFraud(nextTab, nextClip);

      if (nextTab + nextClip >= FRAUD_FAIL_TOTAL_EVENTS && !fraudRuntimeRef.current.submittedFraudFail) {
        fraudRuntimeRef.current.submittedFraudFail = true;
        void syncFraud(nextTab, nextClip, true);
        void submitAttempt(false, { forcedStatus: "submitted_fraud", forceZero: true });
      }
    }

    function applyClipboardAttempt() {
      const now = Date.now();
      if (now - fraudRuntimeRef.current.lastClipboardCountAt < 250) return;
      if (fraudRuntimeRef.current.submittedFraudFail) return;
      const currentTotal = fraudCountsRef.current.tab + fraudCountsRef.current.clip;
      if (currentTotal >= FRAUD_FAIL_TOTAL_EVENTS) {
        fraudRuntimeRef.current.submittedFraudFail = true;
        return;
      }
      fraudRuntimeRef.current.lastClipboardCountAt = now;

      const nextTab = fraudCountsRef.current.tab;
      const nextClip = fraudCountsRef.current.clip + 1;
      fraudCountsRef.current = { tab: nextTab, clip: nextClip };
      setFraudClipboardAttempts(nextClip);
      void syncFraud(nextTab, nextClip);

      if (nextTab + nextClip >= FRAUD_FAIL_TOTAL_EVENTS && !fraudRuntimeRef.current.submittedFraudFail) {
        fraudRuntimeRef.current.submittedFraudFail = true;
        void syncFraud(nextTab, nextClip, true);
        void submitAttempt(false, { forcedStatus: "submitted_fraud", forceZero: true });
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "c" || k === "v") {
        applyClipboardAttempt();
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function onCopy(e: ClipboardEvent) {
      applyClipboardAttempt();
      e.preventDefault();
      e.stopPropagation();
    }

    function onPaste(e: ClipboardEvent) {
      applyClipboardAttempt();
      e.preventDefault();
      e.stopPropagation();
    }

    function onVisibilityChange() {
      const visible = document.visibilityState === "visible";
      if (!visible && fraudRuntimeRef.current.isVisible) {
        fraudRuntimeRef.current.isVisible = false;
        applyTabSwitch();
        return;
      }
      if (visible) fraudRuntimeRef.current.isVisible = true;
    }

    function onWindowBlur() {
      if (fraudRuntimeRef.current.isVisible) {
        fraudRuntimeRef.current.isVisible = false;
        applyTabSwitch();
      }
    }

    function onWindowFocus() {
      fraudRuntimeRef.current.isVisible = true;
    }

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }

    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("copy", onCopy, { capture: true });
    document.addEventListener("paste", onPaste, { capture: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [step, attemptId, submitted, exam?.fraudEnabled]);

  useEffect(() => {
    if (step !== "exam" || showExamSummary || showQuestionMap) return;

    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.altKey) {
        if (e.key === "ArrowLeft") {
          setCurrentQuestionIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === "ArrowRight") {
          setCurrentQuestionIndex((i) => Math.min(Math.max(0, displayQuestions.length - 1), i + 1));
          return;
        }
        if (e.key.toLowerCase() === "m") {
          setShowQuestionMap(true);
          return;
        }
        if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          setDocOpen((v) => !v);
          return;
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [step, showExamSummary, showQuestionMap, displayQuestions.length]);

  const centeredEntryStep = step === "code" || step === "student" || step === "rules";
  const centeredExamStep = step === "exam";
  const totalQuestions = displayQuestions.length;
  const safeQuestionIndex = Math.min(Math.max(currentQuestionIndex, 0), Math.max(0, totalQuestions - 1));
  const currentQuestion = totalQuestions > 0 ? displayQuestions[safeQuestionIndex] : null;
  const answeredCount = displayQuestions.filter((q) => hasAnswer(q)).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const progressPct = totalQuestions > 0 ? Math.round(((safeQuestionIndex + 1) / totalQuestions) * 100) : 0;
  const fraudTotalEvents = fraudTabSwitches + fraudClipboardAttempts;
  const fraudPenalizableEvents = countPenalizableFraudEvents(fraudTotalEvents, FRAUD_GRACE_EVENTS);
  const fraudGraceRemaining = Math.max(0, FRAUD_GRACE_EVENTS - fraudTotalEvents);
  const fraudPenaltyPreview0to5 = Number((fraudPenalizableEvents * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2));
  const fraudTone =
    fraudTotalEvents >= FRAUD_FAIL_TOTAL_EVENTS
      ? "red"
      : fraudPenalizableEvents >= 6
        ? "orange"
        : fraudPenalizableEvents >= 3
          ? "yellow"
          : fraudGraceRemaining > 0
            ? "blue"
            : "green";
  const fraudPill =
    fraudTone === "red"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : fraudTone === "orange"
        ? "border-orange-200 bg-orange-50 text-orange-800"
        : fraudTone === "yellow"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : fraudTone === "blue"
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const resultStatus = !result
    ? null
    : result.fraudForcedFail
      ? "fraud"
      : result.score5 >= 3
        ? "pass"
        : result.score5 >= 2
          ? "recovery"
          : "fail";
  const scorePreview = useMemo(() => {
    const totalQuestionsLocal = displayQuestions.length;
    const correctCount = displayQuestions.reduce((acc, q) => acc + (isQuestionFullyCorrect(q) ? 1 : 0), 0);
    const valuePerQuestion0to5 = totalQuestionsLocal > 0 ? 5 / totalQuestionsLocal : 0;
    const valuePerQuestion0to50 = totalQuestionsLocal > 0 ? 50 / totalQuestionsLocal : 0;
    const score5Raw = correctCount * valuePerQuestion0to5;
    const score50Raw = correctCount * valuePerQuestion0to50;
    const adjusted5 = Math.max(0, score5Raw - fraudPenaltyPreview0to5);
    const adjusted50 = (adjusted5 / 5) * 50;
    return {
      totalQuestions: totalQuestionsLocal,
      correctCount,
      valuePerQuestion0to5,
      valuePerQuestion0to50,
      score5Raw,
      score50Raw,
      score5: Number(adjusted5.toFixed(2)),
      score50: Number(adjusted50.toFixed(2)),
    };
  }, [answers, fraudPenaltyPreview0to5, displayQuestions]);
  const hasAnyWrongAnswer = scorePreview.correctCount < scorePreview.totalQuestions;
  const hasFraudPenalty = fraudPenaltyPreview0to5 > 0;
  const studentFields = [
    {
      key: "firstName",
      title: "¿Cuál es tu nombre?",
      hint: "Escribe tu primer nombre tal como aparece en tu registro.",
      value: firstName,
      onChange: setFirstName,
      placeholder: "Ej: JAIME",
      type: "text" as const,
      inputMode: "text" as const,
      isValid: firstName.trim().length >= 2,
    },
    {
      key: "lastName",
      title: "¿Cuál es tu apellido?",
      hint: "Esto se usará para validar tu intento.",
      value: lastName,
      onChange: setLastName,
      placeholder: "Ej: ZAPATA",
      type: "text" as const,
      inputMode: "text" as const,
      isValid: lastName.trim().length >= 2,
    },
    {
      key: "documentId",
      title: "Ingresa tu documento",
      hint: "Puedes usar número o alfanumérico.",
      value: documentId,
      onChange: setDocumentId,
      placeholder: "Ej: 123456789",
      type: "text" as const,
      inputMode: "text" as const,
      isValid: documentId.trim().length >= 4,
    },
    {
      key: "email",
      title: "Ingresa tu correo",
      hint: "Debe ser un correo válido para el intento único.",
      value: email,
      onChange: setEmail,
      placeholder: "correo@ejemplo.com",
      type: "email" as const,
      inputMode: "email" as const,
      isValid: email.trim().includes("@") && email.trim().includes("."),
    },
  ];
  const safeStudentFieldIndex = Math.min(Math.max(studentFieldIndex, 0), studentFields.length - 1);
  const currentStudentField = studentFields[safeStudentFieldIndex];
  const studentProgressPct = Math.round(((safeStudentFieldIndex + 1) / studentFields.length) * 100);

  useEffect(() => {
    if (step !== "student") return;
    setStudentFieldIndex(0);
  }, [step]);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6">
      <div
        className={`mx-auto w-full ${
          centeredEntryStep
            ? "relative max-w-5xl min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-4"
            : centeredExamStep
              ? "w-[96%] max-w-[120rem] min-h-[calc(100vh-3rem)] flex flex-col justify-center gap-4 2xl:max-w-[128rem]"
              : "max-w-6xl space-y-4"
        }`}
      >
        <header
          className={`flex w-full justify-end ${centeredEntryStep ? "absolute right-0 top-0 max-w-2xl" : ""}`}
        >
          <IconButton
            onClick={() => {
              if (step === "exam") return;
              if (step === "student") setStep("code");
              else if (step === "rules") setStep("student");
            }}
            className="h-10 w-10"
            aria-label="Volver"
            title="Volver"
            disabled={step === "code" || step === "exam" || step === "result"}
          >
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
        </header>


        {error && step !== "exam" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {annulReason ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {annulReason}
          </div>
        ) : null}

        {step === "code" ? (
          <section className="mx-auto w-full max-w-md rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                <Smartphone className="h-7 w-7" />
              </div>
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-950 text-[10px] font-semibold text-white">
                  ZS
                </div>
                <span className="text-xs font-semibold text-indigo-800">Z-Suite Eval</span>
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950">Verificacion OTP</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Ingresa el codigo de 6 digitos compartido por tu docente.
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                <LockKeyhole className="h-3.5 w-3.5" />
                Examen individual y de un solo intento
              </div>
            </div>

            <div className="mt-6">
              <OTPInput value={code} onChange={setCode} />
            </div>

            <div className="mt-6 flex justify-center">
              <IconButton
                variant="primary"
                onClick={loadExamByCode}
                className="h-11 w-11"
                aria-label="Continuar"
                title={loading ? "Cargando..." : "Continuar"}
                disabled={loading || code.trim().length !== 6}
              >
                <ArrowRight className="h-5 w-5" />
              </IconButton>
            </div>
          </section>
        ) : null}

        {step === "rules" && exam ? (
          <section className="mx-auto w-full max-w-2xl rounded-3xl border border-indigo-200 bg-white p-4 shadow-sm">
            {(() => {
              const penaltyPerEvent0to50 = FRAUD_PENALTY_PER_EVENT_0TO5 * 10;
              return (
                <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-950">
                  {exam.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Antes de iniciar, lee y acepta las reglas del examen.
                </p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">
                <Timer className="h-3.5 w-3.5" />
                {exam.timeLimitMinutes} min
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Reglas del examen</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Tiempo limite: <strong>{exam.timeLimitMinutes} minutos</strong>.</li>
                  <li>Al llegar a 0, el examen se <strong>cierra automaticamente</strong> y se envia lo registrado.</li>
                  <li><strong>Solo un intento</strong> por estudiante: se valida por correo y documento.</li>
                  <li>El examen es <strong>individual</strong>.</li>
                  <li>El docente/profesor puede <strong>anular el examen</strong> si detecta irregularidades.</li>
                  <li>Al finalizar, solo veras tu <strong>nota</strong>. Las preguntas y respuestas se habilitan despues.</li>
                  <li>Recuperacion solo si la nota final esta entre <strong>2.0 y 2.9</strong>.</li>
                  <li>Si obtienes <strong>3.0 o superior</strong>, esa es tu nota definitiva.</li>
                </ul>
              </div>

              {exam.fraudEnabled ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center gap-2">
                    <OctagonAlert className="h-5 w-5 text-rose-700" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                      Penalizaciones y cortesías
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                      <p className="text-xs font-semibold text-sky-900">
                        {FRAUD_GRACE_EVENTS} cortesías iniciales ✅
                      </p>
                      <p className="mt-1 text-[12px] text-sky-800">
                        Los primeros {FRAUD_GRACE_EVENTS} eventos NO descuentan nada (pueden pasar cosas).
                      </p>
                      <p className="mt-1 text-sm font-semibold text-sky-800">Penalización: 0.0</p>
                    </div>

                    <div className="rounded-xl border border-rose-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-zinc-900">Copiar / pegar detectado</p>
                      <p className="mt-1 text-[12px] text-zinc-700">
                        Después de las {FRAUD_GRACE_EVENTS} cortesías, cada evento descuenta puntos.
                      </p>
                      <p className="mt-1 text-sm font-semibold text-rose-700">
                        -{FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} (0-5) / -{penaltyPerEvent0to50.toFixed(0)} (0-50)
                      </p>
                    </div>

                    <div className="rounded-xl border border-rose-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-zinc-900">Cambio de pestaña / ventana</p>
                      <p className="mt-1 text-[12px] text-zinc-700">También cuenta como evento de fraude.</p>
                      <p className="mt-1 text-sm font-semibold text-rose-700">
                        -{FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} (0-5) / -{penaltyPerEvent0to50.toFixed(0)} (0-50)
                      </p>
                    </div>

                    <div className="rounded-xl border border-rose-200 bg-white px-3 py-2 sm:col-span-2">
                      <p className="text-xs font-semibold text-zinc-900">Límite de fraude alcanzado</p>
                      <p className="mt-1 text-[12px] text-zinc-700">
                        Si el total llega a <strong>{FRAUD_FAIL_TOTAL_EVENTS}</strong> eventos (incluso cortesías),
                        el intento se marca como perdido.
                      </p>
                      <p className="mt-1 text-sm font-semibold text-rose-700">Reducción final: nota 0 (0-5 y 0-50)</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Modo fraude desactivado</p>
                  </div>
                  <p className="mt-2 text-sm text-emerald-800">Este examen no contará cambios de pestaña ni copy/paste.</p>
                </div>
              )}

              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-zinc-700" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">Consentimiento</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Al continuar confirmas que entiendes el tiempo del examen y aceptas que no se habilitara una segunda oportunidad.
                  </p>
                </div>
              </div>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  rulesAccepted ? "border-emerald-300 bg-emerald-50" : "border-zinc-300 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">Confirmo que leí y acepto las reglas</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Incluye intento único, tiempo límite{exam.fraudEnabled ? ", penalizaciones por fraude y pérdida con nota 0 por límite de eventos." : "."}
                  </p>
                </div>
                <CheckCircle2 className={`h-5 w-5 shrink-0 ${rulesAccepted ? "text-emerald-600" : "text-zinc-300"}`} />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              {!rulesAccepted ? (
                <p className="text-xs font-semibold text-rose-700">Debes activar la confirmación para iniciar.</p>
              ) : (
                <p className="text-xs font-semibold text-emerald-700">Confirmación aceptada. Ya puedes iniciar.</p>
              )}
              <button
                type="button"
                onClick={startAttempt}
                disabled={!rulesAccepted || submitting}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Aceptar e iniciar"
                title="Aceptar e iniciar"
              >
                Aceptar e iniciar
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
                </>
              );
            })()}
          </section>
        ) : null}

        {step === "student" && exam ? (
          <section className="mx-auto w-full max-w-3xl rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Registro del estudiante</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{exam.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {questions.length} preguntas • {exam.timeLimitMinutes} min
                </p>
              </div>
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                {safeStudentFieldIndex + 1}/{studentFields.length}
              </div>
            </div>

            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${studentProgressPct}%` }} />
            </div>

            <div className="mt-8">
              <p className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                {currentStudentField.title}
              </p>
              <p className="mt-2 text-sm text-zinc-600">{currentStudentField.hint}</p>

              <input
                value={currentStudentField.value}
                onChange={(e) => currentStudentField.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (!currentStudentField.isValid) return;
                  if (safeStudentFieldIndex < studentFields.length - 1) {
                    setStudentFieldIndex((i) => Math.min(studentFields.length - 1, i + 1));
                  } else {
                    setStep("rules");
                  }
                }}
                type={currentStudentField.type}
                inputMode={currentStudentField.inputMode}
                className="mt-4 h-14 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                placeholder={currentStudentField.placeholder}
                autoFocus
              />
              {!currentStudentField.isValid ? (
                <p className="mt-2 text-xs font-semibold text-rose-700">Completa este campo para continuar.</p>
              ) : null}
            </div>

            <div className="mt-8 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStudentFieldIndex((i) => Math.max(0, i - 1))}
                disabled={safeStudentFieldIndex === 0}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!currentStudentField.isValid) return;
                  if (safeStudentFieldIndex < studentFields.length - 1) {
                    setStudentFieldIndex((i) => Math.min(studentFields.length - 1, i + 1));
                  } else {
                    setStep("rules");
                  }
                }}
                disabled={!currentStudentField.isValid}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {safeStudentFieldIndex < studentFields.length - 1 ? "Siguiente" : "Continuar"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : null}

        {step === "exam" && exam ? (
          <section className="mx-auto flex w-full max-w-[95%] 2xl:max-w-[120rem] flex-1 flex-col justify-center gap-4 lg:max-w-[92%]">
            {error ? (
              <div className="fixed inset-x-4 bottom-4 z-60 mx-auto w-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 whitespace-pre-wrap">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="shrink-0 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : null}
            {graceUsedToastVisible && exam && exam.fraudEnabled !== false ? (
              <div className="fixed inset-x-4 top-4 z-60 mx-auto w-auto max-w-2xl animate-[fadeIn_.2s_ease-out] rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-xl ring-1 ring-amber-200">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/50">
                    <OctagonAlert className="h-5 w-5 text-amber-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tracking-tight text-amber-950">
                      Se agotaron tus {FRAUD_GRACE_EVENTS} cortesías
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                      A partir de este momento, cada cambio de pestaña o intento de copiar/pegar sí genera penalización
                      (<span className="font-semibold">-{FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} en escala 0-5 por evento</span>).
                      Si alcanzas los {FRAUD_FAIL_TOTAL_EVENTS} eventos totales, tu examen se anula automáticamente.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGraceUsedToastVisible(false);
                      setGraceDismissedAt(Date.now());
                    }}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-white"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm sm:px-6 sm:py-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 truncate text-base font-semibold text-zinc-950 sm:text-lg">{exam.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      <Timer className="h-3.5 w-3.5" />
                      {formatRemaining(remainingMs)}
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${fraudPill}`}
                      title={(() => {
                        const penal = fraudPenalizableEvents;
                        const remaining = fraudGraceRemaining;
                        return (
                          `Total eventos: ${fraudTotalEvents} (Cambio de pestaña: ${fraudTabSwitches}, Copiar/Pegar: ${fraudClipboardAttempts}). ` +
                          (remaining > 0
                            ? `Tienes ${remaining} cortesía${remaining === 1 ? "" : "s"} sin penalización. `
                            : `Eventos penalizables: ${penal}. `) +
                          `Penalización actual: ${fraudPenaltyPreview0to5.toFixed(2)} en escala 0-5.`
                        );
                      })()}
                    >
                      <span>
                        {fraudGraceRemaining > 0
                          ? `Cortesía restante ${fraudGraceRemaining}/${FRAUD_GRACE_EVENTS} • `
                          : `Penalizables ${fraudPenalizableEvents} • `}
                        Fraude {fraudTotalEvents}/{FRAUD_FAIL_TOTAL_EVENTS}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      Pestaña {fraudTabSwitches}
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      Copiar/Pegar {fraudClipboardAttempts}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      Pregunta {safeQuestionIndex + 1}/{Math.max(1, totalQuestions)} • {progressPct}%
                    </div>
                    <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      Respondidas {answeredCount}/{Math.max(1, totalQuestions)}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExamSummary(false);
                        setShowQuestionMap(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                      title="Mapa de preguntas (Alt+M)"
                    >
                      <LayoutGrid className="h-4 w-4" />
                      Mapa
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-gradient-to-r from-indigo-600 to-indigo-700 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-indigo-800 disabled:from-zinc-400 disabled:to-zinc-500 disabled:border-zinc-300 disabled:opacity-80"
                      title="Abrir documentación del examen (Alt + D)"
                      disabled={!exam.documentationMarkdown.trim()}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Ver documentación</span>
                      {exam.documentationMarkdown.trim() ? (
                        <span className="hidden rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/90 sm:inline">
                          Alt + D
                        </span>
                      ) : null}
                    </button>
                  </div>

                  <p className="text-xs text-zinc-600">
                    {(() => {
                      const cortesia = fraudGraceRemaining;
                      if (cortesia > 0) {
                        return `Las primeras ${FRAUD_GRACE_EVENTS} son de cortesía (sin descuento). Disponibles: ${cortesia}. Después se descuentan ${FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} c/u. Límite ${FRAUD_FAIL_TOTAL_EVENTS} para reprobar automáticamente.`;
                      }
                      if (fraudTotalEvents >= FRAUD_FAIL_TOTAL_EVENTS) {
                        return `Se alcanzó el límite (${FRAUD_FAIL_TOTAL_EVENTS}). La nota será 0.0.`;
                      }
                      return `Cortesías agotadas. A partir de ahora: pestaña + copiar/pegar descuentan ${FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} c/u. Límite para anulación: ${FRAUD_FAIL_TOTAL_EVENTS} eventos.`;
                    })()}
                  </p>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-[width]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {adminMessage && adminMessageKey && dismissedAdminMessageKey !== adminMessageKey && !submitted ? (
              <div className="fixed inset-0 z-70">
                <div className="absolute inset-0 bg-black/60" />
                <div className="absolute inset-0 grid place-items-center px-4 py-10">
                  <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl">
                    <div className="flex items-start gap-3 bg-rose-600 px-5 py-4 text-white">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15">
                        <OctagonAlert className="h-5 w-5 animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/90">
                          Advertencia del docente
                        </p>
                        <p className="mt-1 text-base font-semibold tracking-tight">
                          Debes confirmar para continuar
                        </p>
                      </div>
                    </div>

                    <div className="p-5">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">
                        {adminMessage}
                      </p>

                      <div className="mt-5 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setDismissedAdminMessageKey(adminMessageKey);
                            try {
                              if (attemptId) localStorage.setItem(`zse:adminMsgDismissed:${attemptId}`, adminMessageKey);
                            } catch {}
                          }}
                          className="h-11 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700"
                        >
                          Entendido
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <DocumentationDrawer
              open={docOpen}
              title="Documentación"
              markdown={exam.documentationMarkdown}
              onClose={() => setDocOpen(false)}
            />

            {showQuestionMap ? (
              <article className="mx-auto flex min-h-[60vh] w-full max-w-[94%] 2xl:max-w-[112rem] flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:max-w-[90%]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-zinc-950">Mapa de preguntas</h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      Selecciona una pregunta para ir directamente. Atajo: <strong>Alt + M</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQuestionMap(false)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                  {displayQuestions.map((q, idx) => {
                    const answered = hasAnswer(q);
                    const isCurrent = idx === safeQuestionIndex;
                    return (
                      <button
                        key={q.questionId}
                        type="button"
                        onClick={() => {
                          setCurrentQuestionIndex(idx);
                          setShowQuestionMap(false);
                        }}
                        className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                          isCurrent
                            ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                            : answered
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                        }`}
                        title={answered ? "Respondida" : "Pendiente"}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </article>
            ) : null}

            {!showExamSummary && !showQuestionMap && currentQuestion ? (
              <article className="mx-auto flex min-h-[60vh] w-full max-w-[94%] 2xl:max-w-[112rem] flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:max-w-[90%]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-zinc-500">
                    Pregunta {safeQuestionIndex + 1} de {totalQuestions}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                      Respondidas {answeredCount}/{totalQuestions}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <MarkdownViewer
                    markdown={normalizeStatementMarkdown(currentQuestion.statement)}
                    idPrefix={`exam-q-${currentQuestion.questionId}`}
                    className="space-y-4 text-[15px] leading-snug text-zinc-950 sm:text-[20px]"
                  />
                </div>

                <div className="mt-5">{renderQuestionInput(currentQuestion)}</div>

                <div className="mt-6 flex items-center justify-between">
                  <IconButton
                    onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
                    className="h-10 w-10"
                    aria-label="Pregunta anterior"
                    title="Pregunta anterior"
                    disabled={safeQuestionIndex === 0}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </IconButton>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuestionMap(true)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      title="Mapa de preguntas (Alt+M)"
                    >
                      Ir a...
                    </button>
                    {safeQuestionIndex < totalQuestions - 1 ? (
                      <IconButton
                        variant="primary"
                        onClick={() => setCurrentQuestionIndex((i) => Math.min(totalQuestions - 1, i + 1))}
                        className="h-10 w-10"
                        aria-label="Siguiente pregunta"
                        title="Siguiente pregunta"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </IconButton>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setFinalSubmitAccepted(false);
                          setShowExamSummary(true);
                        }}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                      >
                        Revisar y finalizar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ) : null}

            {showExamSummary ? (
              <article className="mx-auto flex min-h-[60vh] w-full max-w-[94%] 2xl:max-w-[112rem] flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:max-w-[90%]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-zinc-950">Resumen final del intento</h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      Antes de enviar, revisa pendientes y confirma el envio definitivo.
                    </p>
                  </div>
                  <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                    Pendientes {unansweredCount}
                  </div>
                </div>

                {unansweredCount > 0 ? (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <OctagonAlert className="mt-0.5 h-5 w-5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Aun tienes preguntas pendientes</p>
                      <p className="mt-1 text-xs text-amber-800">
                        Puedes entrar a cualquier pregunta y completarla antes de finalizar el envio.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <BadgeCheck className="mt-0.5 h-5 w-5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Todo listo</p>
                      <p className="mt-1 text-xs text-emerald-800">Todas las preguntas tienen respuesta registrada.</p>
                    </div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {displayQuestions.map((q, idx) => {
                    const answered = hasAnswer(q);
                    return (
                      <button
                        key={q.questionId}
                        type="button"
                        onClick={() => {
                          setCurrentQuestionIndex(idx);
                          setShowExamSummary(false);
                        }}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                          answered
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        P{idx + 1} {answered ? "OK" : "Pend."}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setFinalSubmitAccepted((v) => !v)}
                  className={`mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left ${
                    finalSubmitAccepted ? "border-indigo-200 bg-indigo-50" : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">Confirmo envio definitivo</p>
                    <p className="truncate text-xs text-zinc-600">
                      Al finalizar no podras editar respuestas nuevamente.
                    </p>
                  </div>
                  <CheckCircle2 className={`h-5 w-5 ${finalSubmitAccepted ? "text-indigo-600" : "text-zinc-300"}`} />
                </button>
                {!finalSubmitAccepted ? (
                  <p className="mt-2 text-xs font-semibold text-rose-700">
                    Debes activar la confirmación para poder enviar el examen.
                  </p>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExamSummary(false)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    Volver a preguntas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!finalSubmitAccepted) {
                        setError("Debes activar la confirmación para poder enviar el examen.");
                        return;
                      }
                      void submitAttempt(false);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submitting}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Finalizar envio definitivo
                  </button>
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {step === "result" && result ? (
          <section className="select-none mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            {/* ======= Modal emergente de bloqueo ======= */}
            {resultsReviewBlocked ? (
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="results-block-title"
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              >
                <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-rose-600 px-6 py-6 text-white">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                        <ShieldAlert className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h2 id="results-block-title" className="text-xl font-semibold tracking-tight">
                          Vista de respuestas cerrada
                        </h2>
                        <p className="mt-1 text-sm text-white/85">
                          Las respuestas correctas ya no se pueden visualizar.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 px-6 py-6 text-sm text-zinc-800">
                    <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <Lock className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">Motivo registrado</p>
                        <p className="mt-1 text-sm text-zinc-700">
                          {(() => {
                            const reason = resultsReviewBlockReason;
                            switch (reason) {
                              case "timeout":
                                return "Agotaste los 2 minutos permitidos para revisar las preguntas.";
                              case "copy":
                                return "Detectamos un intento de copiar contenido del examen (Ctrl+C / Ctrl+S / arrastrar selección).";
                              case "paste":
                                return "Detectamos una acción de pegar dentro de la vista de resultados.";
                              case "contextmenu":
                                return "Detectamos el uso del menú contextual (clic derecho), lo que permite guardar contenido.";
                              case "select":
                                return "Detectamos un intento de seleccionar texto para copiarlo.";
                              case "drag":
                                return "Detectamos un intento de arrastrar contenido fuera de la página.";
                              case "print":
                                return "Detectamos un intento de imprimir o guardar como PDF el resumen.";
                              case "screenshot":
                                return "Detectamos un atajo de captura de pantalla (PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5).";
                              case "devtools":
                                return "Detectamos un intento de abrir herramientas de desarrollador (F12 o Ctrl+Shift+I).";
                              case "viewsource":
                                return "Detectamos un intento de ver el código fuente (Ctrl+U).";
                              default:
                                return "La vista fue cerrada automáticamente por el sistema.";
                            }
                          })()}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-indigo-900">
                      <p className="text-sm font-semibold">Tu nota sigue guardada</p>
                      <p className="mt-1 text-sm text-indigo-800/90">
                        Esta acción <strong>no cambia tu calificación</strong>. Solo se cerró el acceso visual a las preguntas y respuestas correctas para evitar su difusión.
                        La nota definitiva (
                        <strong className="mx-1">{result.score5.toFixed(2)}</strong>
                        sobre 5.0) ya fue enviada al sistema.
                      </p>
                    </div>

                    <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <TriangleAlert className="mr-1.5 inline-block h-4 w-4 align-[-2px]" />
                      <strong>Importante:</strong> esta protección aplica solo mientras estás en esta página.
                      Si necesitas revisar alguna respuesta nuevamente con fines académicos, habla con tu docente para que habilite la revisión oficial.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* ======= Barra countdown: solo si no está bloqueado ======= */}
            {!resultsReviewBlocked ? (
              <div className={[
                "border-b transition-colors",
                resultsReviewRemainingMs <= 30_000
                  ? "border-rose-200 bg-rose-50"
                  : "border-indigo-100 bg-indigo-50/70",
              ].join(" ")}>
                <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                  <div className={[
                    "flex items-center gap-2 rounded-2xl px-3 py-1.5 text-xs font-semibold",
                    resultsReviewRemainingMs <= 30_000
                      ? "bg-rose-600 text-white shadow-sm animate-pulse"
                      : "bg-white text-indigo-800 border border-indigo-200 shadow-sm",
                  ].join(" ")}>
                    <Clock className="h-3.5 w-3.5" />
                    <span className="tabular-nums tracking-tight">
                      {formatReviewClock(resultsReviewRemainingMs)}
                    </span>
                    <span className="font-normal opacity-80">restantes</span>
                  </div>
                  <p className="text-xs text-zinc-600 sm:text-sm">
                    Tienes <strong className="text-zinc-900">2 minutos</strong> para revisar las respuestas.
                    Después el detalle se cierra automáticamente.
                    {resultsReviewRemainingMs <= 30_000
                      ? (
                        <span className="ml-1 font-semibold text-rose-700">
                          ⚡ Quedan menos de 30 segundos.
                        </span>
                      )
                      : null}
                  </p>
                </div>
                <div className="h-1 w-full bg-white/40">
                  <div
                    className={[
                      "h-full transition-[width] duration-300 ease-linear",
                      resultsReviewRemainingMs <= 30_000 ? "bg-rose-500" : "bg-indigo-500",
                    ].join(" ")}
                    style={{
                      width: `${Math.max(0, Math.min(100, (resultsReviewRemainingMs / RESULTS_REVIEW_TOTAL_MS) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div className="bg-indigo-600 px-6 py-6 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Resultado del examen</p>
                  <h2 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                    {exam?.name ?? "Examen"}
                  </h2>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold">
                  {resultStatus === "pass"
                    ? "Aprobado"
                    : resultStatus === "recovery"
                      ? "Recuperación"
                      : resultStatus === "fraud"
                        ? "Fraude"
                        : "Reprobado"}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs font-semibold text-white/80">Nota final (0–5)</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight">{result.score5.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs font-semibold text-white/80">Correctas</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight">
                    {result.earned.toFixed(0)}/{result.total.toFixed(0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-6 py-6">
              {resultStatus === "fraud" ? (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                  <XCircle className="mt-0.5 h-5 w-5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Examen perdido por fraude</p>
                    <p className="mt-1 text-xs text-rose-800">
                      Se alcanzó el límite de {FRAUD_FAIL_TOTAL_EVENTS} eventos de fraude (pestañas + copiar/pegar).
                    </p>
                  </div>
                </div>
              ) : resultStatus === "pass" ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <Award className="mt-0.5 h-5 w-5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Aprobado</p>
                    <p className="mt-1 text-xs text-emerald-800">
                      Nota final igual o superior a 3.0. Esta es tu nota definitiva.
                    </p>
                  </div>
                </div>
              ) : resultStatus === "recovery" ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <OctagonAlert className="mt-0.5 h-5 w-5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Rango de recuperación</p>
                    <p className="mt-1 text-xs text-amber-800">
                      Nota final entre 2.0 y 2.9. Consulta con tu docente el proceso de recuperación.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                  <OctagonAlert className="mt-0.5 h-5 w-5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Reprobado</p>
                    <p className="mt-1 text-xs text-rose-800">
                      Nota final inferior a 2.0.
                    </p>
                  </div>
                </div>
              )}

              {/* ======= Detalle por preguntas: SOLO si la vista NO fue bloqueada =======
                  (si resultsReviewBlocked === true este bloque NO se renderiza,
                  ni siquiera en el HTML; al inspeccionar no hay nada que copiar) */}
              {!resultsReviewBlocked ? (
                (() => {
                  const byQ = new Map<string, { earned: number; points: number; ratio: number; fullyCorrect: boolean; multipleChoice?: MultipleChoiceBreakdown | null }>();
                  (result.perQuestion ?? []).forEach((p) => byQ.set(p.questionId, p));
                  const orderedQids = questionOrder.length ? questionOrder : displayQuestionsRef.current.map((q) => q.questionId);
                  const visibleQuestions: SnapshotQuestion[] = orderedQids.length
                    ? orderedQids
                        .map((id) => displayQuestionsRef.current.find((q) => q.questionId === id))
                        .filter((q): q is SnapshotQuestion => Boolean(q))
                    : displayQuestionsRef.current;
                  if (!visibleQuestions.length) return null;
                  function toggle(id: string) {
                    setResultOpenQuestionIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }
                  return (
                    <div className="rounded-3xl border border-zinc-200 bg-white">
                      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Detalle por pregunta</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Abre cada pregunta para ver las opciones y el impacto proporcional en el puntaje.
                            <span className="ml-1 font-semibold text-rose-600">
                              No intentes copiar, guardar ni tomar captura: la vista se cerrará inmediatamente.
                            </span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setResultOpenQuestionIds(new Set(visibleQuestions.map((q) => q.questionId)))}
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            Abrir todas
                          </button>
                          <button
                            type="button"
                            onClick={() => setResultOpenQuestionIds(new Set())}
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            Cerrar todas
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-zinc-100">
                        {visibleQuestions.map((q, idx) => {
                          const detail = byQ.get(q.questionId);
                          const open = resultOpenQuestionIds.has(q.questionId);
                          const earned = detail?.earned ?? 0;
                          const points = detail?.points ?? q.points;
                          const ratio = detail?.ratio ?? 0;
                          const pct = Math.round(ratio * 100);
                          const barColor = ratio >= 1 ? "bg-emerald-500" : ratio > 0 ? "bg-amber-500" : "bg-rose-500";
                          const pillBadge = ratio >= 1
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : ratio > 0
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-rose-200 bg-rose-50 text-rose-800";
                          return (
                            <div key={q.questionId}>
                              <button
                                type="button"
                                onClick={() => toggle(q.questionId)}
                                className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-zinc-50/60"
                              >
                                <div className={`mt-0.5 rounded-xl border px-2 py-0.5 text-[11px] font-semibold ${pillBadge}`}>
                                  P{idx + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-zinc-900 line-clamp-2">{q.statement}</p>
                                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-zinc-700">{q.type}</span>
                                        <span>
                                          Puntaje:{" "}
                                          <strong className="text-zinc-800">
                                            {earned.toFixed(2)} / {points.toFixed(2)}
                                          </strong>
                                        </span>
                                        <span>
                                          Porcentaje: <strong className="text-zinc-800">{pct}%</strong>
                                        </span>
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-zinc-400">{open ? "−" : "+"}</div>
                                  </div>
                                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              </button>
                              {open ? (
                                <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/40 px-5 py-4">
                                  <MarkdownViewer markdown={q.statement} className="prose-sm max-w-none text-zinc-800" />
                                  {(q.type === "single_choice" || q.type === "multiple_choice") && Array.isArray(q.options) && q.options.length
                                    ? (() => {
                                        const breakdown = q.type === "multiple_choice" ? detail?.multipleChoice : null;
                                        const impactsByOptId = new Map<string, number>();
                                        if (breakdown?.options) breakdown.options.forEach((o) => impactsByOptId.set(o.optionId, o.impact));
                                        const studentAns = answersRef.current[q.questionId];
                                        const selectedSingle = typeof studentAns === "string" ? studentAns : "";
                                        const selectedMulti = Array.isArray(studentAns) ? new Set(studentAns.map(String)) : null;
                                        return (
                                          <ul className="space-y-2">
                                            {q.options.map((o) => {
                                              const wasSelected = selectedMulti
                                                ? selectedMulti.has(o.id)
                                                : q.type === "single_choice"
                                                  ? selectedSingle === o.id
                                                  : false;
                                              const impact = impactsByOptId.get(o.id) ?? 0;
                                              const isCorrect = Boolean(o.isCorrect);
                                              let badge = "border-zinc-200 bg-white text-zinc-700";
                                              if (wasSelected && isCorrect) badge = "border-emerald-300 bg-emerald-50 text-emerald-900";
                                              else if (wasSelected && !isCorrect) badge = "border-rose-300 bg-rose-50 text-rose-900";
                                              else if (!wasSelected && isCorrect) badge = "border-sky-300 bg-sky-50 text-sky-900";
                                              const impactLabel = impact !== 0
                                                ? `${impact > 0 ? "+" : ""}${(impact * 100).toFixed(0)}% / ${(impact * points).toFixed(2)}`
                                                : "";
                                              return (
                                                <li key={o.id} className={`rounded-2xl border ${badge} px-4 py-3`}>
                                                  <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                      <p className="text-sm">{o.text}</p>
                                                    </div>
                                                    <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
                                                      <div className="flex gap-1">
                                                        {isCorrect ? (
                                                          <span className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 font-semibold text-emerald-800">Correcta</span>
                                                        ) : null}
                                                        {wasSelected ? (
                                                          <span className="rounded-full border border-indigo-300 bg-white px-2 py-0.5 font-semibold text-indigo-800">Tu opción</span>
                                                        ) : null}
                                                      </div>
                                                      {impactLabel && q.type === "multiple_choice" ? (
                                                        <span className={`rounded-full px-2 py-0.5 font-semibold ${impact > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                                          {impactLabel}
                                                        </span>
                                                      ) : null}
                                                    </div>
                                                  </div>
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        );
                                      })()
                                    : null}
                                  {q.type === "multiple_choice" && detail?.multipleChoice
                                    ? (() => {
                                        const b = detail.multipleChoice;
                                        const rows: Array<{ label: string; value: string; tone: string }> = [];
                                        rows.push({ label: "Correctas encontradas", value: `${b.correctSelected}/${b.totalCorrect}`, tone: "text-emerald-800" });
                                        rows.push({ label: "Incorrectas marcadas", value: `${b.wrongSelected}/${b.totalIncorrect}`, tone: "text-rose-800" });
                                        rows.push({ label: "Ganancia parcial", value: `+${(b.gainRatio * 100).toFixed(0)}%`, tone: "text-emerald-800" });
                                        rows.push({ label: "Pérdida por error", value: `${b.lossRatio > 0 ? "-" : ""}${(b.lossRatio * 100).toFixed(0)}%`, tone: "text-rose-800" });
                                        rows.push({ label: "Ratio final", value: `${(b.finalRatio * 100).toFixed(0)}%`, tone: b.finalRatio >= 1 ? "text-emerald-900" : b.finalRatio > 0 ? "text-amber-800" : "text-rose-900" });
                                        return (
                                          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Cálculo proporcional</p>
                                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                              {rows.map((r) => (
                                                <div key={r.label} className="rounded-xl bg-zinc-50 px-3 py-2">
                                                  <p className="text-[11px] text-zinc-500">{r.label}</p>
                                                  <p className={`mt-0.5 text-sm font-semibold ${r.tone}`}>{r.value}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })()
                                    : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* ===== Panel en vez de preguntas: cuando ya está bloqueada la vista ===== */
                (() => {
                  let reasonTitle = "Detalle temporalmente inaccesible";
                  let reasonDesc = "Por protección contra copia no puedes ver las respuestas aquí.";
                  switch (resultsReviewBlockReason) {
                    case "timeout":
                      reasonTitle = "Tiempo de revisión agotado";
                      reasonDesc = "Pasaron más de 2 minutos desde que terminaste el examen. El detalle por preguntas (y sus respuestas correctas) se cierra automáticamente para evitar difusión no autorizada del banco de preguntas.";
                      break;
                    case "screenshot":
                      reasonTitle = "Se detectó una captura de pantalla";
                      reasonDesc = "Para evitar que se distribuyan las respuestas, el sistema cerró el detalle de preguntas en cuanto detectó un atajo de captura (PrintScreen, Win+Shift+S u otro). Tu nota no se ve afectada; solo el acceso a este resumen.";
                      break;
                    case "copy":
                    case "paste":
                    case "select":
                    case "drag":
                    case "contextmenu":
                      reasonTitle = "Se detectó un intento de copiar contenido";
                      reasonDesc = "Cualquier intento de seleccionar, copiar, cortar, pegar, arrastrar o usar el menú derecho sobre las respuestas cierra inmediatamente esta vista. Habla con tu docente si necesitas una revisión oficial.";
                      break;
                    case "print":
                      reasonTitle = "Intento de imprimir o guardar como PDF";
                      reasonDesc = "El sistema bloquea la exportación de este panel. La nota final ya fue guardada de forma permanente. Consulta con tu docente si necesitas un reporte oficial.";
                      break;
                    case "devtools":
                    case "viewsource":
                      reasonTitle = "Intento de inspección del código";
                      reasonDesc = "Se detectó F12 / Ctrl+Shift+I / Ctrl+U u otro acceso a herramientas de desarrollador. Como medida de protección, el detalle por preguntas ya no estará visible en esta página.";
                      break;
                  }
                  return (
                    <div className="rounded-3xl border border-zinc-200 bg-white">
                      <div className="flex flex-col items-start gap-4 px-5 py-6 sm:flex-row sm:items-center">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                          <LockKeyhole className="h-7 w-7" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-zinc-900">{reasonTitle}</p>
                          <p className="mt-1 text-sm leading-relaxed text-zinc-700">{reasonDesc}</p>
                          <p className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-900">
                            Tu calificación de <strong>{result.score5.toFixed(2)}</strong> ya fue registrada. Si requieres revisión académica, contacta directamente al docente encargado.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Detalle de calificación</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <p className="text-xs text-zinc-500">Nota sin penalización (0–5)</p>
                      <p className="text-lg font-semibold text-zinc-900">{result.score5Raw.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <p className="text-xs text-zinc-500">Penalización por fraude</p>
                      <p className="text-lg font-semibold text-zinc-900">-{result.fraudPenalty0to5.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Fórmula</p>
                    <p className="mt-2">
                      Factor = <strong>5 / {result.total.toFixed(0)}</strong> ={" "}
                      <strong>{(result.total > 0 ? 5 / result.total : 0).toFixed(2)}</strong>
                    </p>
                    <p className="mt-1">
                      Nota bruta = factor × buenas ={" "}
                      <strong>{(result.total > 0 ? (5 / result.total) * result.earned : 0).toFixed(2)}</strong>
                    </p>
                    <p className="mt-1">
                      Nota final = nota bruta − fraude ={" "}
                      <strong>
                        {Math.max(
                          0,
                          (result.total > 0 ? (5 / result.total) * result.earned : 0) - result.fraudPenalty0to5,
                        ).toFixed(2)}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Indicador de fraude</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <p className="text-xs text-zinc-500">Cambio de pestaña</p>
                      <p className="text-lg font-semibold text-zinc-900">{result.fraudTabSwitches}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <p className="text-xs text-zinc-500">Copiar/Pegar</p>
                      <p className="text-lg font-semibold text-zinc-900">{result.fraudClipboardAttempts}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-zinc-700">
                    Penalización aplicada: <strong>-{result.fraudPenalty0to5.toFixed(2)}</strong> (escala 0–5)
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Límite de fraude: <strong>{FRAUD_FAIL_TOTAL_EVENTS}</strong>. Al llegar al límite el examen se pierde (nota 0).
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
