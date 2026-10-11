import type { InstitutionType } from "./catalog";
import type { AnswerRules } from "./bank";

export type ExamStep = "code" | "student" | "rules" | "exam" | "result";

export type ExamTemplateRow = {
  id: string;
  name: string;
  institution: InstitutionType;
  subjectId: string;
  groupId: string;
  momentId: string;
  siteId: string;
  shiftId: string;
  questionCount: number;
  timeLimitMinutes: number;
  active: boolean;
  fraudEnabled: boolean;
  documentationMarkdown: string;
};

export type PublishedRef = {
  accessCode: string;
  status: string;
};

export type PublishedExam = {
  id: string;
  templateId: string;
  name: string;
  accessCode: string;
  status: string;
  questionCount: number;
  timeLimitMinutes: number;
  documentationMarkdown: string;
  fraudEnabled: boolean;
};

export type SnapshotQuestion = {
  id: string;
  questionId: string;
  order: number;
  type: string;
  statement: string;
  points: number;
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  partialCredit?: boolean;
  answerRules?: AnswerRules;
  puzzle?: Record<string, unknown>;
};

export type PreviewQuestion = {
  id: string;
  statement?: string;
  type?: string;
  points?: number;
  difficulty?: string;
  subjectId?: string;
  momentIds?: string[];
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  puzzle?: Record<string, unknown>;
  answerRules?: AnswerRules;
  [key: string]: unknown;
};

export type ResultRow = {
  id: string;
  examName: string;
  examCode: string;
  studentFullName: string;
  documentId: string;
  email: string;
  status: string;
  grade0to5: number;
  grade0to50: number;
  submittedAt: Date | null;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  fraudTotal: number;
  wrongCount: number;
  wrongDetails: string[];
};

export type StudentExamInfo = {
  fullName: string;
  documentId: string;
  email: string;
};
