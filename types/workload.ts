import type { InstitutionType, CesdeGroupType } from "./catalog";

export type TeachingLoadRow = {
  id: string;
  institution: InstitutionType | string;
  cesdeGroupType: CesdeGroupType | string;
  period: string;
  subjectId: string;
  subjectName: string;
  audienceId: string;
  audienceName: string;
  audienceType: "group" | "ficha" | string;
  siteId: string;
  siteName: string;
  shiftId: string;
  shiftName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  day2StartTime: string;
  day2EndTime: string;
  classroom: string;
  durationMinutes: number;
  academicHours: number;
  day2DurationMinutes: number;
  day2AcademicHours: number;
  weeklyAcademicHours: number;
  dayOfWeek1: string;
  dayOfWeek2: string;
  driveWorkspaceId: string;
  driveStatus: string;
  driveErrorMessage: string;
  drivePublicFolderUrl: string;
  active: boolean;
};

export type TeachingLoadForm = {
  institution: InstitutionType;
  cesdeGroupType: CesdeGroupType;
  period: string;
  subjectId: string;
  audienceId: string;
  siteId: string;
  shiftId: string;
  startDate: string;
  endDate: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  startTime: string;
  endTime: string;
  day2StartTime: string;
  day2EndTime: string;
  classroom: string;
};

export type WorkloadFilters = {
  subjectId: string;
  audienceId: string;
  siteId: string;
  shiftId: string;
  classroom: string;
  dateFrom: string;
  dateTo: string;
};

export type PayrollStatementItem = {
  loadId: string;
  subjectId: string;
  subjectName: string;
  audienceId: string;
  audienceName: string;
  audienceType: string;
  siteId: string;
  siteName: string;
  shiftId: string;
  shiftName: string;
  period: string;
  classroom: string;
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  academicHours: number;
  sessionDayOfWeek: string;
  hourlyRate: number;
  estimatedValue: number;
  cesdeGroupType: string;
};

export type PayrollStatementRow = {
  id: string;
  rangeStart: string;
  rangeEnd: string;
  hourlyRate: number;
  totalHours: number;
  totalValue: number;
  itemCount: number;
  items: PayrollStatementItem[];
  createdByEmail: string;
  createdByName: string;
  createdAtLabel: string;
};

export type WorkloadFocusState = {
  institution?: "CESDE" | "SENA";
  startDate?: string;
  cesdeGroupType?: "REGULAR" | "EMPRESARIAL";
  period?: string;
  subjectId?: string;
  audienceId?: string;
  siteId?: string;
  shiftId?: string;
  viewMode?: "calendar" | "list";
};

export type CalendarEventItem = {
  id: string;
  row: TeachingLoadRow;
  dayIndex: number;
  top: string;
  height: string;
  tone: string;
  subjectName: string;
  audienceName: string;
  classroom: string;
  timeRange: string;
  hoursLabel: string;
  academicHours: number;
  dateRange: string;
  shortDateRange: string;
  slot: 1 | 2;
  dateKey: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
};

export type DragCalendarEventState = {
  eventId: string;
  rowId: string;
  slot: 1 | 2;
  dateKey: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
};
