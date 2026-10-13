import type { ComponentType } from "react";
import type { CatalogRow, FichaRow } from "@/types";

export type { CatalogRow, FichaRow };

export type CatalogItemConfig = {
  key: "subjects" | "fichas" | "sites" | "shifts" | "trimesters" | "moments" | "groups";
  title: string;
  description: string;
  collectionName: string;
  icon: ComponentType<{ className?: string }>;
};

export type FilterStatus = "all" | "active" | "inactive";
