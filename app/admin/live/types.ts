export type PublishedExamRow = {
  id: string;
  name: string;
  accessCode: string;
  status: string;
  questionCount: number;
  timeLimitMinutes: number;
};

export type AttemptRow = {
  id: string;
  status: string;
  studentFullName: string;
  email: string;
  documentId: string;
  adminMessage: string | null;
  annulReason: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  questionCount: number;
  currentQuestionIndex: number;
  answers: Record<string, unknown>;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  fraudPenalty0to5: number;
  fraudForcedFail: boolean;
};

export type AttemptMetricItem = {
  attempt: AttemptRow;
  total: number;
  answered: number;
  progressPct: number;
  fraudEvents: number;
  isSubmitted: boolean;
  isInProgress: boolean;
  isAnnulled: boolean;
  isFraudStatus: boolean;
};

export type AttemptMetrics = {
  perAttempt: AttemptMetricItem[];
  totals: {
    total: number;
    inProgress: number;
    submitted: number;
    annulled: number;
    suspicious: number;
    fraudEventsSum: number;
    inProgressProgressSum: number;
    inProgressCount: number;
  };
  avgProgressInProgress: number;
  avgFraudEvents: number;
  suspiciousTop: AttemptMetricItem[];
};
