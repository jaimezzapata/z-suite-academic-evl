export type GradingQuestion = {
  questionId: string;
  type: string;
  points: number;
  options?: Array<{ id: string; text?: string; isCorrect?: boolean }>;
  partialCredit?: boolean;
  answerRules?: {
    maxWords?: number;
    keywords?: Array<{ term: string; weight: number }>;
    passThreshold?: number;
  };
  puzzle?: Record<string, unknown>;
};

export type MultipleChoiceOptionBreakdown = {
  optionId: string;
  isCorrect: boolean;
  wasSelected: boolean;
  impact: number;
};

export type MultipleChoiceBreakdown = {
  totalCorrect: number;
  totalIncorrect: number;
  correctSelected: number;
  wrongSelected: number;
  gainRatio: number;
  lossRatio: number;
  rawRatio: number;
  finalRatio: number;
  options: MultipleChoiceOptionBreakdown[];
};

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getMultipleChoiceBreakdown(
  q: GradingQuestion,
  answer: unknown,
): MultipleChoiceBreakdown | null {
  if (q.type !== "multiple_choice") return null;
  const selected = Array.isArray(answer)
    ? (answer as unknown[]).map((x) => toString(x, "")).filter(Boolean)
    : [];
  const correctIds = (q.options ?? []).filter((o) => Boolean(o.isCorrect)).map((o) => o.id);
  const wrongIds = (q.options ?? []).filter((o) => !Boolean(o.isCorrect)).map((o) => o.id);
  const totalCorrect = correctIds.length;
  const totalIncorrect = wrongIds.length;
  if (!totalCorrect) {
    return {
      totalCorrect: 0,
      totalIncorrect,
      correctSelected: 0,
      wrongSelected: 0,
      gainRatio: 0,
      lossRatio: 0,
      rawRatio: 0,
      finalRatio: 0,
      options: (q.options ?? []).map((o) => ({
        optionId: o.id,
        isCorrect: Boolean(o.isCorrect),
        wasSelected: selected.includes(o.id),
        impact: 0,
      })),
    };
  }
  const selectedSet = new Set(selected);
  const correctSet = new Set(correctIds);
  const correctSelected = correctIds.filter((id) => selectedSet.has(id)).length;
  const wrongSelected = selected.filter((id) => !correctSet.has(id)).length;

  const gainRatio = totalCorrect > 0 ? correctSelected / totalCorrect : 0;
  const lossRatio = totalIncorrect > 0 ? wrongSelected / totalIncorrect : 0;
  const rawRatio = gainRatio - lossRatio;
  const finalRatio = Math.max(0, Math.min(1, rawRatio));

  const perCorrectGain = totalCorrect > 0 ? 1 / totalCorrect : 0;
  const perWrongLoss = totalIncorrect > 0 ? 1 / totalIncorrect : 0;

  const options: MultipleChoiceOptionBreakdown[] = (q.options ?? []).map((o) => {
    const wasSelected = selectedSet.has(o.id);
    let impact = 0;
    if (Boolean(o.isCorrect)) {
      impact = wasSelected ? perCorrectGain : 0;
    } else {
      impact = wasSelected ? -perWrongLoss : 0;
    }
    return {
      optionId: o.id,
      isCorrect: Boolean(o.isCorrect),
      wasSelected,
      impact: Number(impact.toFixed(6)),
    };
  });

  return {
    totalCorrect,
    totalIncorrect,
    correctSelected,
    wrongSelected,
    gainRatio,
    lossRatio,
    rawRatio,
    finalRatio,
    options,
  };
}

export function evaluateQuestion(q: GradingQuestion, answer: unknown): number {
  if (q.type === "single_choice") {
    const selected = toString(answer, "");
    const correct = (q.options ?? []).find((o) => Boolean(o.isCorrect));
    return correct?.id && selected === correct.id ? q.points : 0;
  }

  if (q.type === "multiple_choice") {
    const breakdown = getMultipleChoiceBreakdown(q, answer);
    if (!breakdown) return 0;
    return q.points * breakdown.finalRatio;
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
    const ok = items.every(
      (it) => toNumber(positions[toString(it.id, "")], 0) === toNumber(it.correctPosition, -1),
    );
    return ok ? q.points : 0;
  }

  if (q.type === "puzzle_match") {
    const pairs = ((q.puzzle?.pairs as Array<Record<string, unknown>>) ?? []);
    const ans = (answer as Record<string, string>) || {};
    if (!pairs.length) return 0;
    const ok = pairs.every(
      (p) => toString(ans[toString(p.leftId, "")], "") === toString(p.rightId, ""),
    );
    return ok ? q.points : 0;
  }

  if (q.type === "puzzle_cloze") {
    const slots = ((q.puzzle?.slots as Array<Record<string, unknown>>) ?? []);
    const ans = (answer as Record<string, string>) || {};
    if (!slots.length) return 0;
    const ok = slots.every(
      (s) => toString(ans[toString(s.slotId, "")], "") === toString(s.correctOptionId, ""),
    );
    return ok ? q.points : 0;
  }

  return 0;
}

export function isQuestionFullyCorrect(q: GradingQuestion, answers: Record<string, unknown>) {
  const earned = evaluateQuestion(q, answers[q.questionId]);
  if (!Number.isFinite(earned)) return false;
  if (q.type === "open_concept") return earned > 0;
  return earned >= q.points && q.points > 0;
}

export type GradeSnapshotInput = {
  displayQuestions: GradingQuestion[];
  answers: Record<string, unknown>;
  fraudEnabled?: boolean;
  fraudTabSwitches?: number;
  fraudClipboardAttempts?: number;
  forceZero?: boolean;
};

export const FRAUD_PENALTY_PER_EVENT_0TO5 = 0.2;
export const FRAUD_GRACE_EVENTS = 2;
export const FRAUD_FAIL_TOTAL_EVENTS = 11;

export function countPenalizableFraudEvents(total: number, grace = FRAUD_GRACE_EVENTS): number {
  return Math.max(0, Number(total || 0) - Math.max(0, grace));
}

export type GradeSnapshotResult = {
  correctCount: number;
  totalQuestions: number;
  questionValue0to5: number;
  questionValue0to50: number;
  earnedPoints: number;
  totalPoints: number;
  grade0to5Raw: number;
  grade0to50Raw: number;
  grade0to5: number;
  grade0to50: number;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  fraudPenalizableEvents: number;
  fraudGraceRemaining: number;
  fraudPenalty0to5: number;
  fraudForcedFail: boolean;
  perQuestion: Array<{
    questionId: string;
    earned: number;
    points: number;
    fullyCorrect: boolean;
    ratio: number;
    multipleChoice?: MultipleChoiceBreakdown | null;
  }>;
};

export function calculateGradeSnapshot(input: GradeSnapshotInput): GradeSnapshotResult {
  const {
    displayQuestions,
    answers,
    fraudEnabled = true,
    fraudTabSwitches = 0,
    fraudClipboardAttempts = 0,
    forceZero = false,
  } = input;

  const totalQuestions = displayQuestions.length;
  const perQuestion = displayQuestions.map((q) => {
    const earned = evaluateQuestion(q, answers[q.questionId]);
    const ratio = q.points > 0 ? Math.max(0, Math.min(1, earned / q.points)) : 0;
    const fullyCorrect = isQuestionFullyCorrect(q, answers);
    return {
      questionId: q.questionId,
      earned: Number(earned.toFixed(4)),
      points: q.points,
      fullyCorrect,
      ratio: Number(ratio.toFixed(4)),
      multipleChoice: getMultipleChoiceBreakdown(q, answers[q.questionId]),
    };
  });

  const correctCount = perQuestion.reduce((acc, p) => acc + (p.fullyCorrect ? 1 : 0), 0);
  const questionValue0to5 = totalQuestions > 0 ? 5 / totalQuestions : 0;
  const questionValue0to50 = totalQuestions > 0 ? 50 / totalQuestions : 0;
  const score5Raw = correctCount * questionValue0to5;
  const score50Raw = correctCount * questionValue0to50;
  const earnedPoints = Number(correctCount);
  const totalPoints = Number(totalQuestions);

  const fraudTotal = fraudTabSwitches + fraudClipboardAttempts;
  const fraudPenalizableEvents = fraudEnabled ? countPenalizableFraudEvents(fraudTotal, FRAUD_GRACE_EVENTS) : 0;
  const fraudGraceRemaining = fraudEnabled ? Math.max(0, FRAUD_GRACE_EVENTS - fraudTotal) : FRAUD_GRACE_EVENTS;
  const fraudPenalty0to5 = fraudEnabled ? Number((fraudPenalizableEvents * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2)) : 0;
  const forcedFail = fraudEnabled ? Boolean(forceZero) || fraudTotal >= FRAUD_FAIL_TOTAL_EVENTS : false;

  const adjusted5 = forcedFail ? 0 : Math.max(0, score5Raw - fraudPenalty0to5);
  const adjusted50 = forcedFail ? 0 : (adjusted5 / 5) * 50;

  return {
    correctCount,
    totalQuestions,
    questionValue0to5: Number(questionValue0to5.toFixed(4)),
    questionValue0to50: Number(questionValue0to50.toFixed(4)),
    earnedPoints,
    totalPoints,
    grade0to5Raw: Number(score5Raw.toFixed(2)),
    grade0to50Raw: Number(score50Raw.toFixed(2)),
    grade0to5: Number(adjusted5.toFixed(2)),
    grade0to50: Number(adjusted50.toFixed(2)),
    fraudTabSwitches,
    fraudClipboardAttempts,
    fraudPenalizableEvents,
    fraudGraceRemaining,
    fraudPenalty0to5,
    fraudForcedFail: forcedFail,
    perQuestion,
  };
}
