import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

const FRAUD_PENALTY_PER_EVENT_0TO5 = 0.2;
const FRAUD_FAIL_TOTAL_EVENTS = 11;

type SnapshotQuestion = {
  questionId: string;
  type: string;
  points: number;
  options?: Array<{ id: string; isCorrect?: boolean }>;
  partialCredit?: boolean;
  answerRules?: {
    maxWords?: number;
    keywords?: Array<{ term: string; weight: number }>;
    passThreshold?: number;
  };
  puzzle?: Record<string, unknown>;
};

function evaluateQuestion(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") {
    const selected = toString(answer, "");
    const correct = (q.options ?? []).find((o) => Boolean(o.isCorrect));
    return correct?.id && selected === correct.id ? q.points : 0;
  }

  if (q.type === "multiple_choice") {
    const selected = Array.isArray(answer) ? (answer as unknown[]).map((x) => toString(x, "")).filter(Boolean) : [];
    const correctIds = (q.options ?? []).filter((o) => Boolean(o.isCorrect)).map((o) => o.id);
    if (!correctIds.length) return 0;
    const selectedSet = new Set(selected);
    const correctSet = new Set(correctIds);
    const correctSelected = correctIds.filter((id) => selectedSet.has(id)).length;
    const wrongSelected = selected.filter((id) => !correctSet.has(id)).length;
    if (!q.partialCredit) {
      const ok = correctSelected === correctIds.length && wrongSelected === 0;
      return ok ? q.points : 0;
    }
    const ratio = Math.max(0, (correctSelected - wrongSelected) / correctIds.length);
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
      if (text.includes((k.term || "").toLowerCase())) scoreWeight += k.weight || 0;
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
    const ok = items.every((it) => toNumber(positions[toString(it.id, "")], 0) === toNumber(it.correctPosition, -1));
    return ok ? q.points : 0;
  }

  if (q.type === "puzzle_match") {
    const pairs = ((q.puzzle?.pairs as Array<Record<string, unknown>>) ?? []);
    const ans = (answer as Record<string, string>) || {};
    if (!pairs.length) return 0;
    const ok = pairs.every((p) => toString(ans[toString(p.leftId, "")], "") === toString(p.rightId, ""));
    return ok ? q.points : 0;
  }

  if (q.type === "puzzle_cloze") {
    const slots = ((q.puzzle?.slots as Array<Record<string, unknown>>) ?? []);
    const ans = (answer as Record<string, string>) || {};
    if (!slots.length) return 0;
    const ok = slots.every((s) => toString(ans[toString(s.slotId, "")], "") === toString(s.correctOptionId, ""));
    return ok ? q.points : 0;
  }

  return 0;
}

function isQuestionFullyCorrect(q: SnapshotQuestion, answers: Record<string, unknown>) {
  const earned = evaluateQuestion(q, answers[q.questionId]);
  if (!Number.isFinite(earned)) return false;
  if (q.type === "open_concept") return earned > 0;
  return earned >= q.points && q.points > 0;
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
      options: Array.isArray(row.options) ? (row.options as SnapshotQuestion["options"]) : undefined,
      partialCredit: Boolean(row.partialCredit),
      answerRules: (row.answerRules as SnapshotQuestion["answerRules"]) ?? undefined,
      puzzle: (row.puzzle as Record<string, unknown>) ?? undefined,
    } satisfies SnapshotQuestion;
  });

  const byId = new Map<string, SnapshotQuestion>();
  questions.forEach((q) => byId.set(q.questionId, q));

  const storedOrder = Array.isArray(attempt.questionOrder)
    ? (attempt.questionOrder as unknown[]).map((x) => (typeof x === "string" ? x : "")).filter(Boolean)
    : [];
  const order = storedOrder.length ? storedOrder : payloadQuestionOrder;

  const ordered: SnapshotQuestion[] = [];
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

  const correctCount = displayQuestions.reduce((acc, q) => acc + (isQuestionFullyCorrect(q, answers) ? 1 : 0), 0);
  const totalQuestionsLocal = displayQuestions.length;
  const valuePerQuestion0to5 = totalQuestionsLocal > 0 ? 5 / totalQuestionsLocal : 0;
  const valuePerQuestion0to50 = totalQuestionsLocal > 0 ? 50 / totalQuestionsLocal : 0;
  const score5Raw = correctCount * valuePerQuestion0to5;
  const score50Raw = correctCount * valuePerQuestion0to50;

  const currentFraudTab = toNumber(attempt.fraudTabSwitches, 0);
  const currentFraudClip = toNumber(attempt.fraudClipboardAttempts, 0);
  const fraudTab = fraudEnabled ? Math.max(currentFraudTab, payloadFraudTab) : 0;
  const fraudClip = fraudEnabled ? Math.max(currentFraudClip, payloadFraudClip) : 0;
  const fraudTotal = fraudTab + fraudClip;
  const fraudPenalty0to5 = fraudEnabled ? Number((fraudTotal * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2)) : 0;

  const forcedFail = fraudEnabled ? Boolean(forceZero) || fraudTotal >= FRAUD_FAIL_TOTAL_EVENTS : false;
  const nextStatus =
    forcedStatus === "submitted_fraud" || forcedStatus === "submitted_expired" || forcedStatus === "submitted"
      ? forcedStatus
      : forcedFail
        ? "submitted_fraud"
        : expired
          ? "submitted_expired"
          : "submitted";

  const adjusted5 = forcedFail ? 0 : Math.max(0, score5Raw - fraudPenalty0to5);
  const adjusted50 = forcedFail ? 0 : (adjusted5 / 5) * 50;
  const score5 = Number(adjusted5.toFixed(2));
  const score50 = Number(adjusted50.toFixed(2));
  const now = Date.now();

  await attemptRef.update({
    status: nextStatus,
    answers,
    questionOrder: order,
    currentQuestionIndex: Math.max(0, payloadCurrentIndex),
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
    fraudForcedFail: forcedFail,
    gradeMethod: "per_question_equal",
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
        score5Raw: Number(score5Raw.toFixed(2)),
        score50Raw: Number(score50Raw.toFixed(2)),
        earned: Number(correctCount),
        total: Number(totalQuestionsLocal),
        fraudTabSwitches: fraudTab,
        fraudClipboardAttempts: fraudClip,
        fraudPenalty0to5,
        fraudForcedFail: forcedFail,
      },
    },
    { status: 200 },
  );
}

