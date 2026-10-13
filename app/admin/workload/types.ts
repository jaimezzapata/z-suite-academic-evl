import type {
  CatalogItem,
  TeachingLoadRow,
  TeachingLoadForm,
  WorkloadFilters,
  PayrollStatementItem,
  PayrollStatementRow,
  WorkloadFocusState,
  CalendarEventItem,
  DragCalendarEventState,
  InstitutionType,
  CesdeGroupType,
} from "@/types";

export type {
  CatalogItem,
  TeachingLoadRow,
  TeachingLoadForm,
  WorkloadFilters,
  PayrollStatementItem,
  PayrollStatementRow,
  WorkloadFocusState,
  CalendarEventItem,
  DragCalendarEventState,
  InstitutionType,
  CesdeGroupType,
};

export type InstitutionTab = "CESDE" | "SENA" | "ALL";
export type WorkloadViewMode = "list" | "calendar" | "payroll";

export type PayrollBreakdownItem = {
  row: TeachingLoadRow;
  occurrences: number;
  programmedHours: number;
  estimatedValue: number;
  scheduleSummary: string;
};

export type PayrollSummary = {
  cesdeBreakdown: PayrollBreakdownItem[];
  cesdeLoads: number;
  cesdeHours: number;
  cesdeEstimated: number;
  senaLoads: number;
  senaMonthlyReference: number;
  senaQuincenaReference: number;
  isSecondFortnight: boolean;
  totalMixedReference: number;
  totalMixedLabel: string;
  totalMixedHint: string;
};

export type WorkloadSummaryCards = {
  totalLabel: string;
  totalValue: string;
  totalHint: string;
  cesdeCount: string;
  cesdeHours: string;
  senaCount: string;
  senaHours: string;
};

export type GeneralScheduleReportRow = {
  institution: string;
  cesdeGroupType: string;
  period: string;
  subject: string;
  groupOrFichaType: string;
  groupOrFichaName: string;
  site: string;
  shift: string;
  classroom: string;
  startDate: string;
  endDate: string;
  coveredWeeks: number;
  days: string;
  day1Start: string;
  day1End: string;
  day1Hours: string;
  day2Start: string;
  day2End: string;
  day2Hours: string;
  weeklyHours: string;
  weeklySessions: number;
  scheduleSummary: string;
  driveStatus: string;
  drivePublicFolderUrl: string;
  active: string;
};
