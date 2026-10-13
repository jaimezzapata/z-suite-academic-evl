import type { CatalogItem, TeachingLoadRow, PayrollStatementItem } from "../types";
import { getSubjectTechnologyMeta } from "@/lib/subject-tech-branding";
import {
  calculateAcademicHoursForInstitution,
  diffMinutesLoose,
  getTeachingLoadSessions,
  getWeeklyAcademicHoursFromSource,
  getWeeklySessionCountFromSource,
} from "@/lib/teaching-load-sessions";

export const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  DOMINGO: 0,
  DOM: 0,
  LUNES: 1,
  LUN: 1,
  MARTES: 2,
  MAR: 2,
  MIERCOLES: 3,
  MIE: 3,
  JUEVES: 4,
  JUE: 4,
  VIERNES: 5,
  VIE: 5,
  SABADO: 6,
  SAB: 6,
};

export const WEEK_DAY_OPTIONS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"] as const;

export const CALENDAR_START_MINUTES = 6 * 60;
export const CALENDAR_END_MINUTES = 22 * 60;
export const CALENDAR_SLOT_MINUTES = 30;
export const CALENDAR_SLOTS = (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES) / CALENDAR_SLOT_MINUTES;

export function buildTimeLabels() {
  return Array.from({ length: CALENDAR_SLOTS }, (_, index) => {
    const totalMinutes = CALENDAR_START_MINUTES + index * CALENDAR_SLOT_MINUTES;
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const suffix = hour24 >= 12 ? "pm" : "am";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  });
}

export const CALENDAR_LABELS = buildTimeLabels();

export function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

export function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function sortByName(items: CatalogItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function normalizeWeekdayLabel(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function weekdayIndexFromName(value: string) {
  const normalized = normalizeWeekdayLabel(value);
  if (!normalized) return null;
  return WEEKDAY_INDEX_BY_NAME[normalized] ?? null;
}

export function getRowWeekdayIndexes(row: Pick<TeachingLoadRow, "dayOfWeek1" | "dayOfWeek2" | "startDate">) {
  const selected = new Set<number>();
  [row.dayOfWeek1, row.dayOfWeek2].forEach((value) => {
    const index = weekdayIndexFromName(value);
    if (index !== null) selected.add(index);
  });
  if (!selected.size) {
    const fallbackIndex = weekdayIndexFromName(dayNameFromIsoDate(row.startDate));
    if (fallbackIndex !== null) selected.add(fallbackIndex);
  }
  return selected;
}

export function normalizeCesdeGroupType(value: unknown) {
  return toString(value, "").trim().toUpperCase() === "EMPRESARIAL" ? "EMPRESARIAL" : "REGULAR";
}

export function usesManualWeekdays(values: { institution: string; cesdeGroupType: string }) {
  const institution = (values.institution || "CESDE").toUpperCase();
  const cesdeGroupType = normalizeCesdeGroupType(values.cesdeGroupType);
  return institution === "SENA" || (institution === "CESDE" && cesdeGroupType === "EMPRESARIAL");
}

export function diffMinutes(startTime: string, endTime: string) {
  return diffMinutesLoose(startTime, endTime);
}

export function calculateAcademicHours(durationMinutes: number, institution: string) {
  return calculateAcademicHoursForInstitution(durationMinutes, institution);
}

export function getWeeklySessionCount(values: {
  institution: string;
  startDate?: string;
  cesdeGroupType: string;
  dayOfWeek1?: string;
  dayOfWeek2: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  academicHours?: number;
  day2StartTime?: string;
  day2EndTime?: string;
  day2DurationMinutes?: number;
  day2AcademicHours?: number;
}) {
  return getWeeklySessionCountFromSource({
    institution: values.institution,
    startDate: values.startDate ?? "",
    dayOfWeek1: values.dayOfWeek1 ?? "",
    dayOfWeek2: values.dayOfWeek2,
    startTime: values.startTime ?? "",
    endTime: values.endTime ?? "",
    durationMinutes: values.durationMinutes,
    academicHours: values.academicHours,
    day2StartTime: values.day2StartTime,
    day2EndTime: values.day2EndTime,
    day2DurationMinutes: values.day2DurationMinutes,
    day2AcademicHours: values.day2AcademicHours,
  });
}

export function getWeeklyAcademicHours(values: {
  institution: string;
  startDate?: string;
  cesdeGroupType: string;
  dayOfWeek1?: string;
  dayOfWeek2: string;
  startTime?: string;
  endTime?: string;
  academicHours: number;
  durationMinutes?: number;
  day2StartTime?: string;
  day2EndTime?: string;
  day2DurationMinutes?: number;
  day2AcademicHours?: number;
  weeklyAcademicHours?: number;
}) {
  return roundHours(
    getWeeklyAcademicHoursFromSource(
      {
        institution: values.institution,
        startDate: values.startDate ?? "",
        dayOfWeek1: values.dayOfWeek1 ?? "",
        dayOfWeek2: values.dayOfWeek2,
        startTime: values.startTime ?? "",
        endTime: values.endTime ?? "",
        durationMinutes: values.durationMinutes,
        academicHours: values.academicHours,
        day2StartTime: values.day2StartTime,
        day2EndTime: values.day2EndTime,
        day2DurationMinutes: values.day2DurationMinutes,
        day2AcademicHours: values.day2AcademicHours,
      },
      values.weeklyAcademicHours,
    ),
  );
}

export function formatDateRange(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "Sin fechas";
  if (startDate && endDate) return `${startDate} -> ${endDate}`;
  return startDate || endDate;
}

export function formatTimeRange(startTime: string, endTime: string) {
  if (!startTime && !endTime) return "Sin horario";
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  return startTime || endTime;
}

export function formatScheduleSummary(row: Pick<
  TeachingLoadRow,
  | "startDate"
  | "dayOfWeek1"
  | "dayOfWeek2"
  | "startTime"
  | "endTime"
  | "durationMinutes"
  | "academicHours"
  | "institution"
  | "day2StartTime"
  | "day2EndTime"
  | "day2DurationMinutes"
  | "day2AcademicHours"
>) {
  return getTeachingLoadSessions(row)
    .map((session) => `${session.dayOfWeek} ${formatTimeRange(session.startTime, session.endTime)} · ${formatHours(session.academicHours)} h`)
    .join(" | ");
}

export function countCoveredWeeks(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end) return 0;
  const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (normalizedEnd.getTime() < normalizedStart.getTime()) return 0;
  const diffDays = Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / 86400000) + 1;
  return Math.ceil(diffDays / 7);
}

export function normalizeCsvValue(value: string | number | boolean) {
  const raw = String(value ?? "");
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}

export function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatHours(value: number) {
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

export function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatLongDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value || "-";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function parseLocalDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every((n) => Number.isFinite(n))) return null;
  return new Date(year, month - 1, day);
}

export function startOfWeek(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

export function isSameOrAfterDay(target: Date, reference: Date) {
  return new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() >=
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
}

export function isSameOrBeforeDay(target: Date, reference: Date) {
  return new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() <=
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
}

export function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function currentFortnightRange() {
  const now = new Date();
  return fortnightRangeFromDate(now);
}

export function fortnightRangeFromDate(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  if (day <= 15) {
    return {
      start: isoDate(new Date(year, month, 1)),
      end: isoDate(new Date(year, month, 15)),
    };
  }
  return {
    start: isoDate(new Date(year, month, 16)),
    end: isoDate(new Date(year, month + 1, 0)),
  };
}

export function shiftFortnightRange(rangeStart: string, direction: -1 | 1) {
  const baseDate = parseLocalDate(rangeStart) ?? new Date();
  return fortnightRangeFromDate(addDays(baseDate, direction * 16));
}

export function isSecondFortnightRange(rangeStart: string, rangeEnd: string) {
  const start = parseLocalDate(rangeStart);
  const end = parseLocalDate(rangeEnd);
  if (!start || !end) return false;
  if (start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth()) return false;
  const expected = fortnightRangeFromDate(start);
  return start.getDate() === 16 && rangeStart === expected.start && rangeEnd === expected.end;
}

export function dayNameFromIsoDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return "";
  return ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"][date.getDay()] ?? "";
}

export function periodFromDate(value: string) {
  const parsed = parseLocalDate(value);
  if (parsed) {
    const periodCode = parsed.getMonth() + 1 >= 7 ? "02" : "01";
    return `${parsed.getFullYear()}-${periodCode}`;
  }
  const fallbackDate = new Date();
  const fallbackPeriodCode = fallbackDate.getMonth() + 1 >= 7 ? "02" : "01";
  return `${fallbackDate.getFullYear()}-${fallbackPeriodCode}`;
}

export function normalizeInstitutionTab(value: "CESDE" | "SENA" | "ALL") {
  return value === "SENA" ? "SENA" : "CESDE";
}

export function makeTeachingLoadWorkspaceId(loadId: string) {
  return `teaching_load__${loadId}`;
}

export function minutesFromTime(value: string) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (![hour, minute].every((n) => Number.isFinite(n))) return null;
  return hour * 60 + minute;
}

export function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(date);
}

export function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(date);
}

export function formatWeekRange(startDate: Date) {
  const endDate = addDays(startDate, 6);
  const startLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(endDate);
  return `${startLabel} - ${endLabel}`;
}

export function formatCompactDateRange(startDate: string, endDate: string) {
  const normalize = (value: string) => {
    if (!value) return "--/--";
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}`;
  };
  if (!startDate && !endDate) return "Sin fechas";
  if (startDate && endDate) return `${normalize(startDate)} - ${normalize(endDate)}`;
  return normalize(startDate || endDate);
}

export function safeNumberFromInput(value: string) {
  const normalized = value.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getTimestampLabel(value: unknown) {
  if (!value || typeof value !== "object") return "";
  try {
    if ("toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
      const date = (value as { toDate: () => Date }).toDate();
      return new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }
  } catch {}
  return "";
}

export function buildPayrollOccurrences(
  row: TeachingLoadRow,
  rangeStart: string,
  rangeEnd: string,
  hourlyRate: number,
) {
  const start = parseLocalDate(rangeStart);
  const end = parseLocalDate(rangeEnd);
  const rowStart = parseLocalDate(row.startDate);
  const rowEnd = parseLocalDate(row.endDate) ?? rowStart;
  if (!start || !end || !rowStart || !rowEnd) return [] as PayrollStatementItem[];
  if (end < start) return [] as PayrollStatementItem[];
  const effectiveStart = isSameOrAfterDay(rowStart, start) ? rowStart : start;
  const effectiveEnd = isSameOrBeforeDay(rowEnd, end) ? rowEnd : end;
  if (effectiveEnd < effectiveStart) return [] as PayrollStatementItem[];
  const sessions = getTeachingLoadSessions(row);
  if (!sessions.length) return [] as PayrollStatementItem[];

  const items: PayrollStatementItem[] = [];
  for (
    let cursor = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), effectiveStart.getDate());
    isSameOrBeforeDay(cursor, effectiveEnd);
    cursor = addDays(cursor, 1)
  ) {
    const date = isoDate(cursor);
    sessions
      .filter((session) => session.weekdayIndex === cursor.getDay())
      .forEach((session) => {
        items.push({
          loadId: row.id,
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          audienceId: row.audienceId,
          audienceName: row.audienceName,
          audienceType: row.audienceType,
          siteId: row.siteId,
          siteName: row.siteName,
          shiftId: row.shiftId,
          shiftName: row.shiftName,
          period: row.period,
          classroom: row.classroom,
          date,
          dayName: dayNameFromIsoDate(date),
          startTime: session.startTime,
          endTime: session.endTime,
          academicHours: session.academicHours,
          sessionDayOfWeek: session.dayOfWeek,
          hourlyRate,
          estimatedValue: roundHours(session.academicHours * hourlyRate),
          cesdeGroupType: row.cesdeGroupType,
        });
      });
  }
  return items;
}

export function countOccurrencesInRange(row: TeachingLoadRow, rangeStart: string, rangeEnd: string) {
  return buildPayrollOccurrences(row, rangeStart, rangeEnd, 0).length;
}

export function eventTone(institution: string) {
  return institution === "SENA"
    ? "border-emerald-300 bg-emerald-100 text-emerald-950"
    : "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-950";
}

export function getEventTone(institution: string, subjectName: string) {
  return getSubjectTechnologyMeta(subjectName)?.calendarCardClassName ?? eventTone(institution);
}

export function minutesToTimeString(totalMinutes: number) {
  const safe = Math.max(0, totalMinutes);
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function makeCalendarDropTargetId(dateKey: string, startMinutes: number) {
  return `${dateKey}__${startMinutes}`;
}

export function sameWeekday(a: string, b: string) {
  return normalizeWeekdayLabel(a) === normalizeWeekdayLabel(b);
}
