import type {
  CatalogItem,
  ExamTemplateRow,
  PublishedRef,
  PreviewQuestion,
  InstitutionType,
} from "@/types";

export type {
  CatalogItem,
  ExamTemplateRow,
  PublishedRef,
  PreviewQuestion,
  InstitutionType,
};

export type TemplateFilters = {
  subjectId: string;
  groupId: string;
  momentId: string;
  siteId: string;
  shiftId: string;
  active: "all" | "active" | "inactive";
  published: "all" | "published" | "not_published";
};

export type ExamFormData = {
  institution: "CESDE" | "SENA";
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
  docFileName: string | null;
};
