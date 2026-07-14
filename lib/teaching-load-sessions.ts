type TeachingLoadSessionSource = {
  institution: string;
  startDate: string;
  dayOfWeek1: string;
  dayOfWeek2?: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  academicHours?: number;
  day2StartTime?: string;
  day2EndTime?: string;
  day2DurationMinutes?: number;
  day2AcademicHours?: number;
};

export type TeachingLoadSession = {
  slot: 1 | 2;
  dayOfWeek: string;
  weekdayIndex: number | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  academicHours: number;
};

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
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

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeWeekdayLabel(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function weekdayIndexFromName(value: string) {
  const normalized = normalizeWeekdayLabel(value);
  if (!normalized) return null;
  return WEEKDAY_INDEX_BY_NAME[normalized] ?? null;
}

function parseLocalDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every((n) => Number.isFinite(n))) return null;
  return new Date(year, month - 1, day);
}

function dayNameFromIsoDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return "";
  return ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"][date.getDay()] ?? "";
}

export function diffMinutesLoose(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((n) => !Number.isFinite(n))) return 0;
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

export function calculateAcademicHoursForInstitution(durationMinutes: number, institution: string) {
  const minutesPerHour = institution.toUpperCase() === "CESDE" ? 45 : 60;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  return Math.max(0, Math.floor(durationMinutes / minutesPerHour));
}

export function getTeachingLoadSessions(source: TeachingLoadSessionSource): TeachingLoadSession[] {
  const primaryDay = source.dayOfWeek1.trim() || dayNameFromIsoDate(source.startDate);
  const primaryDuration =
    toFiniteNumber(source.durationMinutes) ?? Math.max(0, diffMinutesLoose(source.startTime, source.endTime));
  const primaryAcademicHours =
    toFiniteNumber(source.academicHours) ??
    calculateAcademicHoursForInstitution(primaryDuration, source.institution);

  const sessions: TeachingLoadSession[] = [
    {
      slot: 1,
      dayOfWeek: primaryDay,
      weekdayIndex: weekdayIndexFromName(primaryDay),
      startTime: source.startTime,
      endTime: source.endTime,
      durationMinutes: primaryDuration,
      academicHours: primaryAcademicHours,
    },
  ];

  const secondaryDay = source.dayOfWeek2?.trim() ?? "";
  if (secondaryDay) {
    const secondaryStartTime = source.day2StartTime?.trim() || source.startTime;
    const secondaryEndTime = source.day2EndTime?.trim() || source.endTime;
    const secondaryDuration =
      toFiniteNumber(source.day2DurationMinutes) ??
      Math.max(0, diffMinutesLoose(secondaryStartTime, secondaryEndTime)) ??
      primaryDuration;
    const secondaryAcademicHours =
      toFiniteNumber(source.day2AcademicHours) ??
      calculateAcademicHoursForInstitution(secondaryDuration, source.institution) ??
      primaryAcademicHours;

    sessions.push({
      slot: 2,
      dayOfWeek: secondaryDay,
      weekdayIndex: weekdayIndexFromName(secondaryDay),
      startTime: secondaryStartTime,
      endTime: secondaryEndTime,
      durationMinutes: secondaryDuration || primaryDuration,
      academicHours: secondaryAcademicHours || primaryAcademicHours,
    });
  }

  return sessions.filter((session) => session.dayOfWeek);
}

export function getWeeklySessionCountFromSource(source: TeachingLoadSessionSource) {
  return getTeachingLoadSessions(source).length;
}

export function getWeeklyAcademicHoursFromSource(
  source: TeachingLoadSessionSource,
  weeklyAcademicHours?: number,
) {
  if (typeof weeklyAcademicHours === "number" && Number.isFinite(weeklyAcademicHours)) {
    return weeklyAcademicHours;
  }
  return getTeachingLoadSessions(source).reduce((sum, session) => sum + session.academicHours, 0);
}
