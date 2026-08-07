import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  calculateGradeSnapshot,
  type GradingQuestion,
} from "@/lib/exam-grading";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const attemptId = toString(body?.attemptId, "").trim();
  const accessCode = toString(body?.accessCode, "").trim();
  const expired = toBoolean(body?.expired, false);
  const forcedStatus = toString(body?.forcedStatus, "").trim();
  const forceZero = toBoolean(body?.forceZero, false);
  const payloadAnswers = (body?.answers ?? null) as unknown;
  const payloadFraudTab = toNumber(body?.fraudTabSwitches, 0);
  const payloadFraudClip = toNumber(body?.fraudClipboardAttempts, 0);
  const payloadQuestionOrder = Array.isArray(body?.questionOrder)
    ? (body?.questionOrder as unknown[]).map((x) => (typeof x === "string" ? x : "")).filter(Boolean)
    : [];
  const payloadCurrentIndex = toNumber(body?.currentQuestionIndex, 0);

  if (!attemptId) return NextResponse.json({ error: "Falta attemptId." }, { status: 400 });
  if (!/^\d{6}$/.test(accessCode)) return NextResponse.json({ error: "El codigo debe tener 6 digitos." }, { status: 400 });
  if (!payloadAnswers || typeof payloadAnswers !== "object") {
    return NextResponse.json({ error: "Respuestas inválidas." }, { status: 400 });
  }

  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const attemptRef = adminDb.collection("attempts").doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) return NextResponse.json({ error: "No se encontro el intento." }, { status: 404 });

  const attempt = attemptSnap.data() as Record<string, unknown>;
  if (toString(attempt.accessCode, "") !== accessCode) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const publishedExamId = toString(attempt.publishedExamId, "");
  if (!publishedExamId) return NextResponse.json({ error: "El intento no tiene publishedExamId." }, { status: 400 });

  const publishedSnap = await adminDb.collection("publishedExams").doc(publishedExamId).get();
  if (!publishedSnap.exists) return NextResponse.json({ error: "No se encontro el examen." }, { status: 404 });
  const published = publishedSnap.data() as Record<string, unknown>;

  const fraudEnabled = toBoolean(published.fraudEnabled, true);
  const publishedQuestionCount = Math.max(1, Math.min(300, toNumber(published.questionCount, 0)));

  const qSnap = await adminDb
    .collection("publishedExams")
    .doc(publishedExamId)
    .collection("questions")
    .orderBy("order", "asc")
    .limit(300)
    .get();

  const questions = qSnap.docs.map((d) => {
    const row = d.data() as Record<string, unknown>;
    return {
      questionId: toString(row.questionId, d.id),
      type: toString(row.type, "single_choice"),
      points: toNumber(row.points, 1),
      options: Array.isArray(row.options) ? (row.options as GradingQuestion["options"]) : undefined,
      partialCredit: Boolean(row.partialCredit ?? true),
      answerRules: (row.answerRules as GradingQuestion["answerRules"]) ?? undefined,
      puzzle: (row.puzzle as Record<string, unknown>) ?? undefined,
    } satisfies GradingQuestion;
  });

  const byId = new Map<string, GradingQuestion>();
  questions.forEach((q) => byId.set(q.questionId, q));

  const storedOrder = Array.isArray(attempt.questionOrder)
    ? (attempt.questionOrder as unknown[]).map((x) => (typeof x === "string" ? x : "")).filter(Boolean)
    : [];
  const order = storedOrder.length ? storedOrder : payloadQuestionOrder;

  const ordered: GradingQuestion[] = [];
  order.forEach((id) => {
    const q = byId.get(id);
    if (q) ordered.push(q);
  });
  if (ordered.length !== questions.length) {
    questions.forEach((q) => {
      if (!order.includes(q.questionId)) ordered.push(q);
    });
  }

  const limitCount = Math.max(1, Math.min(publishedQuestionCount || ordered.length, ordered.length));
  const displayQuestions = ordered.slice(0, limitCount);
  const answers = payloadAnswers as Record<string, unknown>;

  const currentFraudTab = toNumber(attempt.fraudTabSwitches, 0);
  const currentFraudClip = toNumber(attempt.fraudClipboardAttempts, 0);
  const fraudTab = fraudEnabled ? Math.max(currentFraudTab, payloadFraudTab) : 0;
  const fraudClip = fraudEnabled ? Math.max(currentFraudClip, payloadFraudClip) : 0;

  const grade = calculateGradeSnapshot({
    displayQuestions,
    answers,
    fraudEnabled,
    fraudTabSwitches: fraudTab,
    fraudClipboardAttempts: fraudClip,
    forceZero,
  });

  const forcedFail = grade.fraudForcedFail;
  const nextStatus =
    forcedStatus === "submitted_fraud" || forcedStatus === "submitted_expired" || forcedStatus === "submitted"
      ? forcedStatus
      : forcedFail
        ? "submitted_fraud"
        : expired
          ? "submitted_expired"
          : "submitted";

  const score5 = grade.grade0to5;
  const score50 = grade.grade0to50;
  const score5Raw = grade.grade0to5Raw;
  const score50Raw = grade.grade0to50Raw;
  const totalQuestionsLocal = grade.totalQuestions;
  const correctCount = grade.correctCount;
  const fraudPenalty0to5 = grade.fraudPenalty0to5;
  const now = Date.now();

  await attemptRef.update({
    status: nextStatus,
    answers,
    questionOrder: order,
    currentQuestionIndex: Math.max(0, payloadCurrentIndex),
    correctCount,
    questionCount: totalQuestionsLocal,
    questionValue0to5: grade.questionValue0to5,
    questionValue0to50: grade.questionValue0to50,
    earnedPoints: grade.earnedPoints,
    totalPoints: grade.totalPoints,
    grade0to5Raw: score5Raw,
    grade0to50Raw: score50Raw,
    grade0to5: score5,
    grade0to50: score50,
    fraudTabSwitches: fraudTab,
    fraudClipboardAttempts: fraudClip,
    fraudPenalty0to5,
    fraudForcedFail: forcedFail,
    gradeMethod: "per_question_equal",
    perQuestionBreakdown: grade.perQuestion,
    submittedAt: new Date(now),
    updatedAt: new Date(now),
  });

  return NextResponse.json(
    {
      ok: true,
      result: {
        status: nextStatus,
        score5,
        score50,
        score5Raw,
        score50Raw,
        earned: correctCount,
        total: totalQuestionsLocal,
        fraudTabSwitches: fraudTab,
        fraudClipboardAttempts: fraudClip,
        fraudPenalty0to5,
        fraudForcedFail: forcedFail,
        perQuestion: grade.perQuestion,
      },
    },
    { status: 200 },
  );
}

