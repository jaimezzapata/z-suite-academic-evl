import { getColombiaHolidayName } from "@/lib/colombia-holidays";
import { getTeachingLoadSessions } from "@/lib/teaching-load-sessions";
import type { TeachingLoadRow, DayTimeline, SessionItem } from "../types";

export function startOfWeek(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every((n) => Number.isFinite(n))) return null;
  return new Date(year, month - 1, day);
}

export function isSameOrAfterDay(target: Date, reference: Date): boolean {
  return new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() >=
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
}

export function isSameOrBeforeDay(target: Date, reference: Date): boolean {
  return new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() <=
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
}

export function formatTimeMinutes(value: number): string {
  const safe = Math.max(0, value);
  const hour24 = Math.floor(safe / 60);
  const minute = safe % 60;
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function minutesFromTimeLoose(value: string): number | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const hasPm = /\bp\.?\s*m\.?\b|\bpm\b/.test(trimmed);
  const hasAm = /\ba\.?\s*m\.?\b|\bam\b/.test(trimmed);
  if (hasPm && hour < 12) hour += 12;
  if (hasAm && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function buildWeekTimeline(
  teachingLoads: TeachingLoadRow[],
  weekDays: Date[],
  holidayByDateKey: Map<string, string>,
): DayTimeline[] {
  const itemsByDate = new Map<string, SessionItem[]>();

  teachingLoads
    .filter((row) => row.active)
    .forEach((row) => {
      const rowStart = parseLocalDate(row.startDate);
      const rowEnd = parseLocalDate(row.endDate) ?? rowStart;
      if (!rowStart || !rowEnd) return;
      const sessions = getTeachingLoadSessions(row);
      if (!sessions.length) return;

      weekDays.forEach((day) => {
        const dateKey = isoDate(day);
        if (holidayByDateKey.has(dateKey)) return;
        if (!isSameOrAfterDay(day, rowStart) || !isSameOrBeforeDay(day, rowEnd)) return;
        sessions.forEach((session) => {
          if (session.weekdayIndex !== day.getDay()) return;
          const startMinutes = minutesFromTimeLoose(session.startTime);
          const endMinutes = minutesFromTimeLoose(session.endTime);
          if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;
          const bucket = itemsByDate.get(dateKey) ?? [];
          bucket.push({
            id: `${row.id}-${session.slot}-${dateKey}`,
            startMinutes,
            endMinutes,
            timeLabel: `${formatTimeMinutes(startMinutes)} - ${formatTimeMinutes(endMinutes)}`,
            subjectName: row.subjectName,
            audienceName: row.audienceName,
            institution: row.institution,
            siteName: row.siteName,
            shiftName: row.shiftName,
            classroom: row.classroom,
          });
          itemsByDate.set(dateKey, bucket);
        });
      });
    });

  return weekDays.map((day) => {
    const dateKey = isoDate(day);
    const holidayName = holidayByDateKey.get(dateKey) ?? null;
    const items = (itemsByDate.get(dateKey) ?? []).sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      return a.subjectName.localeCompare(b.subjectName, "es");
    });
    return {
      dateKey,
      weekdayLabel: new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(day),
      dayLabel: new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(day),
      holidayName,
      items,
    };
  });
}

export function buildTodaySchedule(teachingLoads: TeachingLoadRow[]): {
  dayLabel: string;
  holidayName: string | null;
  items: SessionItem[];
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = isoDate(today);
  const holidayName = getColombiaHolidayName(today) ?? null;
  const items: SessionItem[] = [];

  if (!holidayName) {
    teachingLoads
      .filter((row) => row.active)
      .forEach((row) => {
        const rowStart = parseLocalDate(row.startDate);
        const rowEnd = parseLocalDate(row.endDate) ?? rowStart;
        if (!rowStart || !rowEnd) return;
        if (!isSameOrAfterDay(today, rowStart) || !isSameOrBeforeDay(today, rowEnd)) return;
        getTeachingLoadSessions(row).forEach((session) => {
          if (session.weekdayIndex !== today.getDay()) return;
          const startMinutes = minutesFromTimeLoose(session.startTime);
          const endMinutes = minutesFromTimeLoose(session.endTime);
          if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;
          items.push({
            id: `${row.id}-${session.slot}-${todayKey}`,
            startMinutes,
            endMinutes,
            timeLabel: `${formatTimeMinutes(startMinutes)} - ${formatTimeMinutes(endMinutes)}`,
            subjectName: row.subjectName,
            audienceName: row.audienceName,
            institution: row.institution,
            siteName: row.siteName,
            shiftName: row.shiftName,
            classroom: row.classroom,
          });
        });
      });
  }

  items.sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return a.subjectName.localeCompare(b.subjectName, "es");
  });

  return {
    dayLabel: new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(today),
    holidayName,
    items,
  };
}
