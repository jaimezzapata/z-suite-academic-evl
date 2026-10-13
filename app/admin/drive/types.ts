import type { CatalogItem, DriveWorkspaceRow, DriveNodeRow } from "@/types";

export type { CatalogItem, DriveWorkspaceRow, DriveNodeRow };

export type WeekGroupItem = {
  weekdayLabel: string;
  weeks: Array<
    DriveNodeRow & {
      parsedDate: Date | null;
      dateLabel: string;
    }
  >;
};

export type DriveDashboardSummary = {
  totalWeeks: number;
  cesde: number;
  sena: number;
  broken: number;
};

export type CreateStructurePayload = {
  workspaceId: string;
  institution: "CESDE" | "SENA";
  cesdeGroupType: "REGULAR" | "EMPRESARIAL";
  subjectId: string;
  groupId: string;
  siteId: string;
  shiftId: string;
  period: string;
  campus: string;
  jornada: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  day2StartTime: string;
  day2EndTime: string;
  classroom: string;
};
