import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
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
      partialCredit: Boolean(row.partialCredit ?? true),
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
    const displayForGrade: GradingQuestion[] = display.map((q) => ({
      questionId: q.questionId,
      type: q.type,
      points: q.points,
      options: q.options,
      partialCredit: q.partialCredit,
      answerRules: q.answerRules,
      puzzle: q.puzzle,
    }));

    const fraudTab = fraudEnabled ? toNumber(attempt.fraudTabSwitches, 0) : 0;
    const fraudClip = fraudEnabled ? toNumber(attempt.fraudClipboardAttempts, 0) : 0;
    const grade = calculateGradeSnapshot({
      displayQuestions: displayForGrade,
      answers,
      fraudEnabled,
      fraudTabSwitches: fraudTab,
      fraudClipboardAttempts: fraudClip,
      forceZero: false,
    });

    const forceZero = grade.fraudForcedFail;
    const totalQuestionsLocal = grade.totalQuestions;
    const correctCount = grade.correctCount;
    const score5 = grade.grade0to5;
    const score50 = grade.grade0to50;

    batch.update(d.ref, {
      status: forceZero ? "submitted_fraud" : "submitted_closed",
      answers,
      correctCount,
      questionCount: totalQuestionsLocal,
      questionOrder: ord,
      questionValue0to5: grade.questionValue0to5,
      questionValue0to50: grade.questionValue0to50,
      earnedPoints: grade.earnedPoints,
      totalPoints: grade.totalPoints,
      grade0to5Raw: grade.grade0to5Raw,
      grade0to50Raw: grade.grade0to50Raw,
      grade0to5: score5,
      grade0to50: score50,
      fraudTabSwitches: fraudTab,
      fraudClipboardAttempts: fraudClip,
      fraudPenalty0to5: grade.fraudPenalty0to5,
      fraudForcedFail: forceZero,
      gradeMethod: "per_question_equal",
      perQuestionBreakdown: grade.perQuestion,
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

