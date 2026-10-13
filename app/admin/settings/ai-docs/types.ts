export type CatalogItem = {
  id: string;
  name: string;
};

export type ReadmeTemplateId = "custom" | "standard_detailed_v1";

export type AiDocsTab = "readme" | "batch" | "exam";

export type AcademicTopic = {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  topics: string;
  criteria: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ReadmeBatchMetadata = {
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  momentId: string;
  momentName: string;
  questionCount: number;
  timeLimitMinutes: number;
  gradingScale: string;
  allowedQuestionTypes: string[];
};

export type ReadmeBatchMetadataResult =
  | { ok: true; value: ReadmeBatchMetadata }
  | { ok: false; error: string };

export type ExamPipelineFormData = {
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
};

export const README_TEMPLATE_OPTIONS: Array<{
  id: ReadmeTemplateId;
  label: string;
  description: string;
}> = [
  {
    id: "custom",
    label: "Personalizada",
    description: "Plantilla estructurada con tabla de contenidos, secciones numeradas, tablas y ejemplos.",
  },
  {
    id: "standard_detailed_v1",
    label: "Capítulo didáctico",
    description: "Genera un capítulo (1 página) listo para el cuadernillo: claro, navegable y pedagógico.",
  },
];

export const QUESTION_TYPE_OPTIONS = [
  { id: "single_choice", label: "Selección única" },
  { id: "multiple_choice", label: "Selección múltiple" },
  { id: "open_concept", label: "Abierta" },
  { id: "puzzle_order", label: "Ordenar" },
  { id: "puzzle_match", label: "Emparejar" },
  { id: "puzzle_cloze", label: "Completar" },
] as const;
