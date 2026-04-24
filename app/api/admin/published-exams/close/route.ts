import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

async function assertAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return { ok: false as const, status: 401, error: "Unauthorized" };

  let adminAuth: ReturnType<typeof getAdminAuth>;
  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminAuth = getAdminAuth();
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales admin.";
    return { ok: false as const, status: 500, error: msg };
  }

  let uid = "";
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token inválido.";
    return { ok: false as const, status: 401, error: `Token inválido o expirado. ${msg}` };
  }

  const adminSnap = await adminDb.collection("admins").doc(uid).get();
  if (!adminSnap.exists) return { ok: false as const, status: 403, error: "Forbidden" };

  return { ok: true as const, adminDb };
}

type SnapshotQuestion = {
  id: string;
  questionId: string;
  order: number;
  type: string;
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

const FRAUD_PENALTY_PER_EVENT_0TO5 = 0.2;
const FRAUD_FAIL_TOTAL_EVENTS = 11;

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
    const rules = q.answerRules ?? {};
    const keywords = rules.keywords ?? [];
    const maxWords = typeof rules.maxWords === "number" ? rules.maxWords : 120;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > maxWords) return 0;
    const totalWeight = keywords.reduce((acc, x) => acc + (x.weight || 0), 0);
    if (!totalWeight) return 0;
    let scoreWeight = 0;
    keywords.forEach((k) => {
      if (text.includes(String(k.term || "").toLowerCase())) scoreWeight += k.weight || 0;
    });
    const ratio = Math.min(1, scoreWeight / totalWeight);
    const threshold = typeof rules.passThreshold === "number" ? rules.passThreshold : 0;
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

function isQuestionFullyCorrect(q: SnapshotQuestion, answersById: Record<string, unknown>) {
  const earned = evaluateQuestion(q, answersById[q.questionId]);
  if (!Number.isFinite(earned)) return false;
  if (q.type === "open_concept") return earned > 0;
  return earned >= q.points && q.points > 0;
}

function orderQuestions(questions: SnapshotQuestion[], questionOrder: string[], limitCount: number) {
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
}

export async function POST(req: Request) {
  const access = await assertAdmin(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const publishedExamId = toString(body?.publishedExamId, "").trim();
  if (!publishedExamId) return NextResponse.json({ error: "Falta publishedExamId." }, { status: 400 });

  const adminDb = access.adminDb;
  const pubRef = adminDb.collection("publishedExams").doc(publishedExamId);
  const pubSnap = await pubRef.get();
  if (!pubSnap.exists) return NextResponse.json({ error: "No se encontro el examen." }, { status: 404 });
  const pub = pubSnap.data() as Record<string, unknown>;

  const questionCount = Math.max(1, toNumber(pub.questionCount, 1));
  const fraudEnabled = toBoolean(pub.fraudEnabled, true);

  const qSnap = await pubRef.collection("questions").orderBy("order", "asc").limit(300).get();
  const questions = qSnap.docs.map((d) => {
    const row = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      questionId: toString(row.questionId, d.id),
      order: toNumber(row.order, 0),
      type: toString(row.type, "single_choice"),
      points: toNumber(row.points, 1),
      options: Array.isArray(row.options) ? (row.options as SnapshotQuestion["options"]) : undefined,
      partialCredit: Boolean(row.partialCredit),
      answerRules: (row.answerRules as SnapshotQuestion["answerRules"]) ?? undefined,
      puzzle: (row.puzzle as Record<string, unknown>) ?? undefined,
    } satisfies SnapshotQuestion;
  });

  const attemptsSnap = await adminDb
    .collection("attempts")
    .where("publishedExamId", "==", publishedExamId)
    .where("status", "==", "in_progress")
    .limit(1000)
    .get();

  let updated = 0;
  let batch = adminDb.batch();
  let ops = 0;

  for (const d of attemptsSnap.docs) {
    const attempt = d.data() as Record<string, unknown>;
    const answers = (attempt.answers && typeof attempt.answers === "object" ? (attempt.answers as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >;
    const ord = Array.isArray(attempt.questionOrder)
      ? (attempt.questionOrder as unknown[]).map((x) => (typeof x === "string" ? x : "")).filter(Boolean)
      : [];
    const display = orderQuestions(questions, ord, Math.min(questionCount, questions.length || questionCount));

    const totalQuestionsLocal = display.length;
    const correctCount = display.reduce((acc, q) => acc + (isQuestionFullyCorrect(q, answers) ? 1 : 0), 0);
    const valuePerQuestion0to5 = totalQuestionsLocal > 0 ? 5 / totalQuestionsLocal : 0;
    const valuePerQuestion0to50 = totalQuestionsLocal > 0 ? 50 / totalQuestionsLocal : 0;
    const score5Raw = correctCount * valuePerQuestion0to5;
    const score50Raw = correctCount * valuePerQuestion0to50;

    const fraudTab = fraudEnabled ? toNumber(attempt.fraudTabSwitches, 0) : 0;
    const fraudClip = fraudEnabled ? toNumber(attempt.fraudClipboardAttempts, 0) : 0;
    const fraudTotal = fraudTab + fraudClip;
    const fraudPenalty0to5 = fraudEnabled ? Number((fraudTotal * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2)) : 0;

    const forceZero = fraudEnabled && fraudTotal >= FRAUD_FAIL_TOTAL_EVENTS;
    const adjusted5 = forceZero ? 0 : Math.max(0, score5Raw - fraudPenalty0to5);
    const adjusted50 = forceZero ? 0 : (adjusted5 / 5) * 50;
    const score5 = Number(adjusted5.toFixed(2));
    const score50 = Number(adjusted50.toFixed(2));

    batch.update(d.ref, {
      status: forceZero ? "submitted_fraud" : "submitted_closed",
      answers,
      correctCount,
      questionCount: totalQuestionsLocal,
      questionOrder: ord,
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
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    updated += 1;
    ops += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();

  await pubRef.update({
    status: "closed",
    closedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    closePolicy: "finalize_attempts",
  });

  return NextResponse.json({ ok: true, attemptsFinalized: updated }, { status: 200 });
}

