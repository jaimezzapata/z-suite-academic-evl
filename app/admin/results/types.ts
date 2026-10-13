import type { SnapshotQuestion, ResultRow } from "@/types";

export type { SnapshotQuestion, ResultRow };

export type SortKey =
  | "submittedAt"
  | "examName"
  | "examCode"
  | "studentFullName"
  | "status"
  | "grade0to5"
  | "grade0to50"
  | "fraudTotal"
  | "wrongCount";

export type SortDir = "asc" | "desc";

export type StatusFilter = "all" | "submitted" | "in_progress" | "annulled" | "fraud";

export type WrongDetail = {
  number: number | null;
  statement: string;
  answer: string;
  reason: string;
};

export type ExportFormat = "" | "csv" | "excel" | "pdf";
