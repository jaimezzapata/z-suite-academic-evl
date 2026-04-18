"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
  orderBy,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { normalizeFullName, normalizePersonNamePart } from "@/lib/text/normalize";
import { IconButton } from "@/app/admin/ui/icon-button";
import { DocumentationDrawer } from "@/app/ui/documentation-drawer";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  LayoutGrid,
  LockKeyhole,
  OctagonAlert,
  Save,
  ShieldCheck,
  Smartphone,
  Timer,
  XCircle,
} from "lucide-react";

type PublishedExam = {
  id: string;
  templateId: string;
  name: string;
  accessCode: string;
  status: string;
  questionCount: number;
  timeLimitMinutes: number;
  documentationMarkdown: string;
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

const FRAUD_PENALTY_PER_EVENT_0TO5 = 0.2;
const FRAUD_FAIL_TOTAL_EVENTS = 11;
const RESUME_KEY = "zse:examResume";

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

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const answersRef = useRef<Record<string, unknown>>({});
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
  const [result, setResult] = useState<{
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
  } | null>(null);
  const [annulled, setAnnulled] = useState(false);
  const [annulReason, setAnnulReason] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  const [fraudTabSwitches, setFraudTabSwitches] = useState(0);
  const [fraudClipboardAttempts, setFraudClipboardAttempts] = useState(0);
  const fraudCountsRef = useRef({ tab: 0, clip: 0 });
  const fraudRuntimeRef = useRef({
    lastSyncAt: 0,
    lastClipboardCountAt: 0,
    lastTabCountAt: 0,
    isVisible: true,
    submittedFraudFail: false,
  });
  const autosaveTimerRef = useRef<number | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const submittingRef = useRef(false);
  const questionsRef = useRef<SnapshotQuestion[]>([]);
  const questionOrderRef = useRef<string[]>([]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    questionOrderRef.current = questionOrder;
  }, [questionOrder]);

  const displayQuestions = useMemo(() => {
    if (!questionOrder.length) return questions;
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
    return ordered;
  }, [questions, questionOrder]);

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
    fraudCountsRef.current = { tab: fraudTabSwitches, clip: fraudClipboardAttempts };
  }, [fraudTabSwitches, fraudClipboardAttempts]);

  async function loadExamByCode() {
    setLoading(true);
    setError(null);
    try {
      const c = code.trim();
      if (!/^\d{6}$/.test(c)) {
        setError("El codigo debe tener 6 digitos.");
        return;
      }

      const snap = await getDocs(
        query(collection(firestore, "publishedExams"), where("accessCode", "==", c), limit(5)),
      );
      const found = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .find((row) => {
          const r = row as Record<string, unknown>;
          return toString(r.status, "published") === "published";
        });

      if (!found) {
        setError("No se encontro un examen publicado con ese codigo.");
        return;
      }
      const foundRow = found as Record<string, unknown> & { id: string };

      const nextExam: PublishedExam = {
        id: foundRow.id,
        templateId: toString(foundRow.templateId, ""),
        name: toString(foundRow.name, "Examen"),
        accessCode: toString(foundRow.accessCode),
        status: toString(foundRow.status, "published"),
        questionCount: toNumber(foundRow.questionCount, 0),
        timeLimitMinutes: toNumber(foundRow.timeLimitMinutes, 60),
        documentationMarkdown: toString(foundRow.documentationMarkdown, ""),
      };
      setExam(nextExam);

      const qSnap = await getDocs(
        query(collection(firestore, "publishedExams", foundRow.id, "questions"), orderBy("order", "asc"), limit(300)),
      );
      const loadedQuestions = qSnap.docs.map((d) => {
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
          if (resumeExamId === foundRow.id && resumeAttemptId) {
            const attemptSnap = await getDoc(doc(firestore, "attempts", resumeAttemptId));
            if (attemptSnap.exists()) {
              const attempt = attemptSnap.data() as Record<string, unknown>;
              const status = toString(attempt.status, "in_progress");
              if (status === "in_progress") {
                const startedAt = attempt.startedAt as unknown;
                const startMs =
                  startedAt && typeof startedAt === "object" && "toMillis" in (startedAt as any)
                    ? Number((startedAt as any).toMillis())
                    : Date.now();
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
                const fraudTotal = fraudTab + fraudClip;
                const fraudPenalty0to5 = Number((fraudTotal * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2));

                if (fraudTotal >= FRAUD_FAIL_TOTAL_EVENTS || Date.now() >= ends) {
                  const forceZero = fraudTotal >= FRAUD_FAIL_TOTAL_EVENTS;
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
                      fraudTabSwitches: fraudTab,
                      fraudClipboardAttempts: fraudClip,
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
                    fraudTabSwitches: fraudTab,
                    fraudClipboardAttempts: fraudClip,
                    fraudPenalty0to5,
                    fraudForcedFail: forceZero,
                  });
                  setSubmitted(true);
                  setStep("result");
                }
              }
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
    try {
      const [byEmail, byDoc] = await Promise.all([
        getDocs(
          query(
            collection(firestore, "attempts"),
            where("publishedExamId", "==", exam.id),
            where("email", "==", emailNorm),
            limit(1),
          ),
        ),
        getDocs(
          query(
            collection(firestore, "attempts"),
            where("publishedExamId", "==", exam.id),
            where("documentId", "==", docNorm),
            limit(1),
          ),
        ),
      ]);

      if (!byEmail.empty || !byDoc.empty) {
        setError("Ya existe un intento registrado con ese correo o documento. Solo se permite un intento.");
        return;
      }
    } catch {
      setError("No fue posible validar el intento unico. Intenta de nuevo.");
      return;
    }

    const now = Date.now();
    const ends = now + exam.timeLimitMinutes * 60 * 1000;
    const order = shuffleIds(questions.map((q) => q.questionId));

    const ref = await addDoc(collection(firestore, "attempts"), {
      publishedExamId: exam.id,
      examTemplateId: exam.templateId || null,
      templateId: exam.templateId || null,
      examName: exam.name,
      studentFirstName: n1.value,
      studentLastName: n2.value,
      studentFullName: full.value,
      documentId: docNorm,
      email: emailNorm,
      status: "in_progress",
      questionCount: questions.length,
      answers: {},
      questionOrder: order,
      currentQuestionIndex: 0,
      fraudTabSwitches: 0,
      fraudClipboardAttempts: 0,
      startedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setAttemptId(ref.id);
    setQuestionOrder(order);
    setAnswers({});
    setAttemptStartMs(now);
    setEndAtMs(ends);
    setRemainingMs(ends - now);
    setCurrentQuestionIndex(0);
    setShowExamSummary(false);
    setShowQuestionMap(false);
    setFinalSubmitAccepted(false);
    fraudRuntimeRef.current.isVisible = document.visibilityState === "visible";
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ publishedExamId: exam.id, attemptId: ref.id, accessCode: exam.accessCode }));
    } catch {}
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
    const unsub = onSnapshot(doc(firestore, "publishedExams", exam.id), (snap) => {
      if (!snap.exists()) return;
      const row = snap.data() as Record<string, unknown>;
      const status = toString(row.status, "published");
      const timeLimitMinutes = toNumber(row.timeLimitMinutes, exam.timeLimitMinutes);
      const documentationMarkdown = toString(row.documentationMarkdown, exam.documentationMarkdown);

      if (timeLimitMinutes !== exam.timeLimitMinutes) {
        setExam((prev) => (prev ? { ...prev, timeLimitMinutes } : prev));
        if (step === "exam" && !submitted) {
          const start = attemptStartMs ?? (endAtMs ? endAtMs - exam.timeLimitMinutes * 60 * 1000 : null);
          if (start) {
            const nextEnd = start + timeLimitMinutes * 60 * 1000;
            setEndAtMs(nextEnd);
            setRemainingMs(nextEnd - Date.now());
          }
        }
      }
      if (documentationMarkdown !== exam.documentationMarkdown) {
        setExam((prev) => (prev ? { ...prev, documentationMarkdown } : prev));
      }
      if (status === "closed" && (step === "rules" || step === "student")) {
        setError("Este examen ya esta cerrado.");
        setStep("code");
        setExam(null);
      }
    });
    return () => unsub();
  }, [exam, attemptStartMs, endAtMs, step, submitted]);

  useEffect(() => {
    if (!attemptId) return;
    const unsub = onSnapshot(doc(firestore, "attempts", attemptId), (snap) => {
      if (!snap.exists()) return;
      const row = snap.data() as Record<string, unknown>;
      const status = toString(row.status, "in_progress");
      const msg = toString(row.adminMessage, "") || null;
      setAdminMessage(msg);

      const startedAt = row.startedAt as unknown;
      if (!attemptStartMs && startedAt && typeof startedAt === "object" && "toMillis" in (startedAt as any)) {
        const ms = Number((startedAt as any).toMillis());
        if (Number.isFinite(ms) && ms > 0) setAttemptStartMs(ms);
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
          Number(((fraudTab + fraudClip) * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2)),
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
    });
    return () => unsub();
  }, [attemptId, step, questions]);

  useEffect(() => {
    if (!attemptId || step !== "exam" || submitted) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        await updateDoc(doc(firestore, "attempts", attemptId), {
          answers,
          currentQuestionIndex,
          questionOrder,
          fraudTabSwitches,
          fraudClipboardAttempts,
          updatedAt: serverTimestamp(),
        });
      } catch {}
    }, 600);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    };
  }, [
    attemptId,
    step,
    submitted,
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
            return (
              <div key={toString(it.id)} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-base font-medium text-zinc-900">
                  {toString(it.text)}
                </div>
                <select
                  value={String(map[toString(it.id)] ?? "")}
                  onChange={(e) =>
                    setAnswer(q.questionId, {
                      ...map,
                      [toString(it.id)]: Number(e.target.value || 0),
                    })
                  }
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-200/40"
                >
                  <option value="">Pos.</option>
                  {Array.from({ length: n }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>
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
            return (
              <div key={toString(left.id)} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-base font-medium text-zinc-900">
                  {toString(left.text)}
                </div>
                <select
                  value={ans[toString(left.id)] ?? ""}
                  onChange={(e) => setAnswer(q.questionId, { ...ans, [toString(left.id)]: e.target.value })}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-200/40"
                >
                  <option value="">Selecciona</option>
                  {rightItems.map((ri) => (
                    <option key={toString(ri.id)} value={toString(ri.id)}>
                      {toString(ri.text)}
                    </option>
                  ))}
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
          return (
            <div key={toString(slot.slotId)} className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
              <div className="rounded-xl bg-zinc-50 px-3 py-2 text-base font-medium text-zinc-900">
                {toString(slot.slotId)}
              </div>
              <select
                value={ans[toString(slot.slotId)] ?? ""}
                onChange={(e) =>
                  setAnswer(q.questionId, {
                    ...ans,
                    [toString(slot.slotId)]: e.target.value,
                  })
                }
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-200/40"
              >
                <option value="">Selecciona</option>
                {options.map((o) => (
                  <option key={toString(o.id)} value={toString(o.id)}>
                    {toString(o.text)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    );
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

  function isQuestionFullyCorrect(q: SnapshotQuestion) {
    const earned = evaluateQuestion(q, answersRef.current[q.questionId]);
    if (!Number.isFinite(earned)) return false;
    if (q.type === "open_concept") return earned > 0;
    return earned >= q.points && q.points > 0;
  }

  async function submitAttempt(
    expired = false,
    opts?: { forcedStatus?: "submitted" | "submitted_expired" | "submitted_fraud"; forceZero?: boolean },
  ) {
    const id = attemptIdRef.current;
    if (!id || submittedRef.current || submittingRef.current) return;
    setSubmitting(true);
    submittingRef.current = true;
    setError(null);
    try {
      const questionsSnapshot = questionsRef.current;
      const totalQuestionsLocal = questionsSnapshot.length;
      const correctCount = questionsSnapshot.reduce((acc, q) => acc + (isQuestionFullyCorrect(q) ? 1 : 0), 0);
      const valuePerQuestion0to5 = totalQuestionsLocal > 0 ? 5 / totalQuestionsLocal : 0;
      const valuePerQuestion0to50 = totalQuestionsLocal > 0 ? 50 / totalQuestionsLocal : 0;
      const score5Raw = correctCount * valuePerQuestion0to5;
      const score50Raw = correctCount * valuePerQuestion0to50;

      const fraudTab = fraudCountsRef.current.tab;
      const fraudClip = fraudCountsRef.current.clip;
      const fraudTotal = fraudTab + fraudClip;
      const fraudPenalty0to5 = Number((fraudTotal * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2));

      const adjusted5 = opts?.forceZero ? 0 : Math.max(0, score5Raw - fraudPenalty0to5);
      const adjusted50 = opts?.forceZero ? 0 : (adjusted5 / 5) * 50;
      const score5 = Number(adjusted5.toFixed(2));
      const score50 = Number(adjusted50.toFixed(2));

      await updateDoc(doc(firestore, "attempts", id), {
        status: opts?.forcedStatus ?? (expired ? "submitted_expired" : "submitted"),
        answers: answersRef.current,
        correctCount,
        questionCount: totalQuestionsLocal,
        questionOrder: questionOrderRef.current,
        questionValue0to5: Number(valuePerQuestion0to5.toFixed(4)),
        questionValue0to50: Number(valuePerQuestion0to50.toFixed(4)),
        earnedPoints: Number(correctCount),
        totalPoints: Number(totalQuestionsLocal),
        grade0to5Raw: Number(score5Raw.toFixed(2)),
        grade0to50Raw: Number(score50Raw.toFixed(2)),
        grade0to5: score5,
        grade0to50: score50,
        fraudTabSwitches: fraudTab,
        fraudClipboardAttempts: fraudClip,
        fraudPenalty0to5,
        fraudForcedFail: Boolean(opts?.forceZero),
        gradeMethod: "per_question_equal",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

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
        fraudTabSwitches: fraudTab,
        fraudClipboardAttempts: fraudClip,
        fraudPenalty0to5,
        fraudForcedFail: Boolean(opts?.forceZero),
      });
      setSubmitted(true);
      submittedRef.current = true;
      setStep("result");
    } catch {
      setError("No fue posible enviar el examen.");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  useEffect(() => {
    if (step !== "exam" || !attemptId || submitted) return;
    const id = attemptId;

    async function syncFraud(nextTab: number, nextClip: number, force = false) {
      const now = Date.now();
      if (!force && now - fraudRuntimeRef.current.lastSyncAt < 1500) return;
      fraudRuntimeRef.current.lastSyncAt = now;
      const total = nextTab + nextClip;
      const penalty = Number((total * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2));
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
  }, [step, attemptId, submitted]);

  useEffect(() => {
    if (step !== "exam" || showExamSummary || showQuestionMap) return;

    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (!e.altKey) return;
      if (e.key === "ArrowLeft") {
        setCurrentQuestionIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "ArrowRight") {
        setCurrentQuestionIndex((i) => Math.min(Math.max(0, displayQuestions.length - 1), i + 1));
      }
      if (e.key.toLowerCase() === "m") {
        setShowQuestionMap(true);
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
  const fraudPenaltyPreview0to5 = Number((fraudTotalEvents * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2));
  const fraudTone =
    fraudTotalEvents >= FRAUD_FAIL_TOTAL_EVENTS
      ? "red"
      : fraudTotalEvents >= 6
        ? "orange"
        : fraudTotalEvents >= 3
          ? "yellow"
          : "green";
  const fraudPill =
    fraudTone === "red"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : fraudTone === "orange"
        ? "border-orange-200 bg-orange-50 text-orange-800"
        : fraudTone === "yellow"
          ? "border-amber-200 bg-amber-50 text-amber-800"
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

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6">
      <div
        className={`mx-auto w-full ${
          centeredEntryStep
            ? "relative max-w-3xl min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-4"
            : centeredExamStep
              ? "max-w-6xl min-h-[calc(100vh-3rem)] flex flex-col justify-center gap-4"
              : "max-w-4xl space-y-4"
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


        {error ? (
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
                  <li>
                    Esta <strong>prohibido copiar y pegar</strong>. Cada intento de copiar/pegar se registra como fraude.
                  </li>
                  <li>
                    Cambiar de <strong>pestaña o ventana</strong> tambien se registra como fraude.
                  </li>
                  <li>
                    Penalizacion por fraude: <strong>-{FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)}</strong> en escala 0-5 por cada evento (pestaña o copiar/pegar).
                  </li>
                  <li>
                    Si el fraude total llega a <strong>{FRAUD_FAIL_TOTAL_EVENTS}</strong>, el intento se marca como <strong>perdido</strong> (nota 0).
                  </li>
                  <li>Al finalizar, solo veras tu <strong>nota</strong>. Las preguntas y respuestas se habilitan despues.</li>
                  <li>Recuperacion solo si la nota final esta entre <strong>2.0 y 2.9</strong>.</li>
                  <li>Si obtienes <strong>3.0 o superior</strong>, esa es tu nota definitiva.</li>
                  <li>
                    El docente puede <strong>anular tu intento</strong> de forma remota si detecta copia. En ese caso la nota sera <strong>0</strong> sin recuperacion.
                  </li>
                </ul>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-zinc-700" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">Consentimiento</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Al continuar confirmas que entiendes el tiempo del examen y aceptas que no se habilitara una segunda oportunidad.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRulesAccepted((v) => !v)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left ${
                  rulesAccepted ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">He leido y acepto las reglas</p>
                  <p className="truncate text-xs text-zinc-600">Incluye intento unico, tiempo limite y politica de nota.</p>
                </div>
                <CheckCircle2 className={`h-5 w-5 ${rulesAccepted ? "text-emerald-600" : "text-zinc-300"}`} />
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <IconButton
                variant="primary"
                onClick={startAttempt}
                className="h-11 w-11"
                aria-label="Aceptar e iniciar"
                title="Aceptar e iniciar"
                disabled={!rulesAccepted || submitting}
              >
                <ArrowRight className="h-5 w-5" />
              </IconButton>
            </div>
          </section>
        ) : null}

        {step === "student" && exam ? (
          <section className="mx-auto w-full max-w-md rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">{exam.name}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {questions.length} preguntas • {exam.timeLimitMinutes} min
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Nombre</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-indigo-400"
                  placeholder="Ej: Jaime"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Apellido</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-indigo-400"
                  placeholder="Ej: Zapata"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Documento</span>
                <input
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-indigo-400"
                  placeholder="Solo numeros o alfanumerico"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Correo</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-indigo-400"
                  placeholder="correo@ejemplo.com"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <IconButton
                variant="primary"
                onClick={() => setStep("rules")}
                className="h-10 w-10"
                aria-label="Continuar"
                title="Continuar a confirmacion"
              >
                <ArrowRight className="h-4 w-4" />
              </IconButton>
            </div>
          </section>
        ) : null}

        {step === "exam" && exam ? (
          <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-4">
            <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
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
                      title={`Fraude total: ${fraudTotalEvents} (Cambio de pestaña: ${fraudTabSwitches}, Copiar/Pegar: ${fraudClipboardAttempts}). Penalización: ${fraudPenaltyPreview0to5.toFixed(
                        2,
                      )} en escala 0-5.`}
                    >
                      Fraude {fraudTotalEvents}/{FRAUD_FAIL_TOTAL_EVENTS}
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
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                      title="Mapa de preguntas (Alt+M)"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Mapa
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                      title="Documentacion"
                      disabled={!exam.documentationMarkdown.trim()}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Docs
                    </button>
                  </div>

                  <p className="text-xs text-zinc-600">
                    Fraude: pestaña + copiar/pegar (-{FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} c/u). Límite{" "}
                    {FRAUD_FAIL_TOTAL_EVENTS}.
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

            {adminMessage ? (
              <div className="mx-auto w-full max-w-4xl rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Mensaje del docente</p>
                <p className="mt-2">{adminMessage}</p>
              </div>
            ) : null}

            <DocumentationDrawer
              open={docOpen}
              title="Documentación"
              markdown={exam.documentationMarkdown}
              onClose={() => setDocOpen(false)}
            />

            {showQuestionMap ? (
              <article className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
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

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-8">
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
              <article className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-zinc-500">
                    Pregunta {safeQuestionIndex + 1} de {totalQuestions}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                      Puntos {currentQuestion.points}
                    </div>
                    <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                      Respondidas {answeredCount}/{totalQuestions}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-lg font-semibold leading-snug text-zinc-950 sm:text-2xl">
                  {currentQuestion.statement}
                </p>

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
              <article className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
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

                <div className="mt-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Nota estimada si envias ahora
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-3 py-2">
                      <p className="text-xs text-zinc-500">0–5 (final)</p>
                      <p className="text-lg font-semibold text-zinc-900">{scorePreview.score5.toFixed(2)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2">
                      <p className="text-xs text-zinc-500">Penalización fraude</p>
                      <p className="text-lg font-semibold text-zinc-900">-{fraudPenaltyPreview0to5.toFixed(2)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">
                    No revela respuestas correctas. Solo muestra la nota estimada con la fórmula del examen.
                  </p>
                </div>

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
                    onClick={() => void submitAttempt(false)}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submitting || !finalSubmitAccepted}
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
          <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
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
