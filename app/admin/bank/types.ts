import type {
  CatalogItem,
  StatItem,
  QuestionOption,
  AnswerRules,
  BankQualityMetrics,
  BankPreviewQuestion,
  BankDashboardStats,
  QuestionTableRow,
  EditQuestion,
} from "@/types";

export type {
  CatalogItem,
  StatItem,
  QuestionOption,
  AnswerRules,
  BankQualityMetrics,
  BankPreviewQuestion,
  BankDashboardStats,
  QuestionTableRow,
  EditQuestion,
};

export type BankViewMode = "summary" | "table";

export type BankTableFilters = {
  subjectId: string;
  momentId: string;
  status: string;
  type: string;
  difficulty: string;
  search: string;
};
