export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "open_text"
  | "puzzle"
  | string;

export type QuestionDifficulty = "easy" | "medium" | "hard" | string;

export type QuestionOption = {
  id: string;
  text: string;
  isCorrect?: boolean;
};

export type AnswerRules = {
  maxWords?: number;
  passThreshold?: number;
  keywords?: Array<{ term: string; weight: number }>;
};

export type StatItem = {
  label: string;
  value: number;
};

export type BankQualityMetrics = {
  missingStatus: number;
  missingPoints: number;
  missingGroups: number;
  missingMoments: number;
};

export type BankPreviewQuestion = {
  id: string;
  statement: string;
  status: string;
  type: string;
  difficulty: string;
  points: number | null;
  subjectId: string;
};

export type BankDashboardStats = {
  counts: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  };
  byType: StatItem[];
  byDifficulty: StatItem[];
  topSubjects: StatItem[];
  topGroups: StatItem[];
  topMoments: StatItem[];
  quality: BankQualityMetrics;
  preview: BankPreviewQuestion[];
};

export type QuestionTableRow = {
  id: string;
  statement: string;
  status: string;
  type: string;
  difficulty: string;
  points: number | null;
  subjectId: string;
  groupIds: string[];
  momentIds: string[];
  updatedAt: Date | null;
};

export type EditQuestion = {
  id: string;
  type: string;
  statement: string;
  points: number;
  difficulty: string;
  status: string;
  subjectId: string;
  groupIds: string[];
  momentIds: string[];
  tags: string[];
  options: QuestionOption[];
  partialCredit: boolean;
  answerRules: AnswerRules;
  puzzleText: string;
};
