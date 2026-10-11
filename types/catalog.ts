export type InstitutionType = "CESDE" | "SENA";

export type CesdeGroupType = "REGULAR" | "EMPRESARIAL";

export type CatalogItem = {
  id: string;
  name: string;
};

export type CatalogRow = {
  id: string;
  name: string;
  active: boolean;
};

export type FichaRow = {
  id: string;
  number: string;
  trimesterId: string;
  active: boolean;
};

export type ChapterDraft = {
  title: string;
  markdown: string;
};

export type BookletRow = {
  id: string;
  title: string;
  slug: string;
  accessCode: string;
  institution: string;
  siteName: string;
  shiftName: string;
  groupName: string;
  subjectName: string;
  chaptersCount: number;
  active: boolean;
};

export type ChapterRow = {
  id: string;
  index: number;
  title: string;
};
