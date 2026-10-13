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

