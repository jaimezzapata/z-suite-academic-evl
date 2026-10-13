"use client";

import type { DragEvent as ReactDragEvent } from "react";
import { useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";
import { getColombiaHolidayName } from "@/lib/colombia-holidays";
import { getTeachingLoadSessions } from "@/lib/teaching-load-sessions";
import type {
  CalendarEventItem,
  DragCalendarEventState,
  TeachingLoadRow,
} from "../types";
import {
  CALENDAR_END_MINUTES,
  CALENDAR_START_MINUTES,
  addDays,
  calculateAcademicHours,
  dayNameFromIsoDate,
  diffMinutes,
  formatCompactDateRange,
  formatDateRange,
  formatHours,
  formatTimeRange,
  getEventTone,
  getWeeklyAcademicHours,
  isSameOrAfterDay,
  isSameOrBeforeDay,
  isoDate,
  minutesFromTime,
  minutesToTimeString,
  parseLocalDate,
  roundHours,
  sameWeekday,
  startOfWeek,
} from "../services/workload-date-utils";

export function useWorkloadCalendar({
  rows,
  filteredRows,
  setError,
}: {
  rows: TeachingLoadRow[];
  filteredRows: TeachingLoadRow[];
  setError: (err: string | null) => void;
}) {
  const feedback = useFeedback();
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => startOfWeek(new Date()));
  const [draggingCalendarEvent, setDraggingCalendarEvent] = useState<DragCalendarEventState | null>(null);
  const [calendarDropTarget, setCalendarDropTarget] = useState<string | null>(null);
  const [movingCalendarEventId, setMovingCalendarEventId] = useState<string | null>(null);

  const calendarDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(calendarWeekStart, index)),
    [calendarWeekStart],
  );

  const calendarHolidayMap = useMemo(
    () =>
      new Map<string, string>(
        calendarDays.flatMap((day) => {
          const holidayName = getColombiaHolidayName(day);
          return holidayName ? [[isoDate(day), holidayName] as [string, string]] : [];
        }),
      ),
    [calendarDays],
  );

  const calendarEvents = useMemo<CalendarEventItem[]>(() => {
    return filteredRows
      .flatMap((row) => {
        const rangeStart = parseLocalDate(row.startDate);
        const rangeEnd = parseLocalDate(row.endDate) ?? rangeStart;
        if (!rangeStart || !rangeEnd) return [];
        const sessions = getTeachingLoadSessions(row);
        if (!sessions.length) return [];
        return calendarDays.flatMap((day, dayIndex) => {
          const dayKey = isoDate(day);
          if (calendarHolidayMap.has(dayKey)) return [];
          if (!isSameOrAfterDay(day, rangeStart) || !isSameOrBeforeDay(day, rangeEnd)) return [];
          return sessions.flatMap((session) => {
            if (session.weekdayIndex !== day.getDay()) return [];
            const startMinutes = minutesFromTime(session.startTime);
            const endMinutes = minutesFromTime(session.endTime);
            if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return [];
            const topMinutes = Math.max(0, startMinutes - CALENDAR_START_MINUTES);
            const clampedEnd = Math.min(endMinutes, CALENDAR_END_MINUTES);
            const clampedStart = Math.max(startMinutes, CALENDAR_START_MINUTES);
            const blockMinutes = Math.max(30, clampedEnd - clampedStart);
            const top = `${(topMinutes / (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES)) * 100}%`;
            const height = `${(blockMinutes / (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES)) * 100}%`;
            return [
              {
                id: `${row.id}-${session.slot}-${dayKey}`,
                row,
                dayIndex,
                top,
                height,
                tone: getEventTone(row.institution, row.subjectName),
                subjectName: row.subjectName,
                audienceName: row.audienceType === "ficha" ? `Ficha ${row.audienceName}` : row.audienceName,
                classroom: row.classroom,
                timeRange: formatTimeRange(session.startTime, session.endTime),
                hoursLabel: `${formatHours(session.academicHours)} h`,
                academicHours: session.academicHours,
                dateRange: formatDateRange(row.startDate, row.endDate),
                shortDateRange: formatCompactDateRange(row.startDate, row.endDate),
                slot: session.slot,
                dateKey: dayKey,
                startMinutes,
                endMinutes,
                durationMinutes: session.durationMinutes,
              },
            ];
          });
        });
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [calendarDays, calendarHolidayMap, filteredRows]);

  const calendarSummary = useMemo(() => {
    const cesdeLoadIds = new Set<string>();
    const senaLoadIds = new Set<string>();
    let cesdeHours = 0;
    let senaHours = 0;

    calendarEvents.forEach((event) => {
      const institution = (event.row.institution || "CESDE").toUpperCase();
      if (institution === "SENA") {
        senaLoadIds.add(event.row.id);
        senaHours += event.academicHours;
        return;
      }
      cesdeLoadIds.add(event.row.id);
      cesdeHours += event.academicHours;
    });

    return {
      totalLoads: cesdeLoadIds.size + senaLoadIds.size,
      cesdeLoads: cesdeLoadIds.size,
      senaLoads: senaLoadIds.size,
      totalEvents: calendarEvents.length,
      cesdeHours: roundHours(cesdeHours),
      senaHours: roundHours(senaHours),
    };
  }, [calendarEvents]);

  function readDraggedCalendarEvent(event: ReactDragEvent<HTMLElement>) {
    if (draggingCalendarEvent) return draggingCalendarEvent;
    try {
      const raw = event.dataTransfer.getData("text/plain");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<DragCalendarEventState>;
      if (
        typeof parsed.eventId === "string" &&
        typeof parsed.rowId === "string" &&
        (parsed.slot === 1 || parsed.slot === 2) &&
        typeof parsed.dateKey === "string" &&
        typeof parsed.startMinutes === "number" &&
        typeof parsed.endMinutes === "number" &&
        typeof parsed.durationMinutes === "number"
      ) {
        return parsed as DragCalendarEventState;
      }
    } catch {}
    return null;
  }

  function handleCalendarDragStart(event: ReactDragEvent<HTMLDivElement>, item: CalendarEventItem) {
    const nextDragState: DragCalendarEventState = {
      eventId: item.id,
      rowId: item.row.id,
      slot: item.slot,
      dateKey: item.dateKey,
      startMinutes: item.startMinutes,
      endMinutes: item.endMinutes,
      durationMinutes: item.durationMinutes,
    };
    setDraggingCalendarEvent(nextDragState);
    setCalendarDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify(nextDragState));
  }

  function handleCalendarDragEnd() {
    setDraggingCalendarEvent(null);
    setCalendarDropTarget(null);
  }

  async function moveCalendarEventToSlot(targetDate: Date, targetStartMinutes: number, dragged: DragCalendarEventState) {
    if (movingCalendarEventId) return;

    const row = rows.find((item) => item.id === dragged.rowId);
    if (!row) {
      reportFormError({
        message: "No fue posible ubicar la carga que intentas mover.",
        feedback,
        setMessage: setError,
      });
      setDraggingCalendarEvent(null);
      setCalendarDropTarget(null);
      return;
    }

    const targetDateKey = isoDate(targetDate);
    if (calendarHolidayMap.has(targetDateKey)) {
      reportFormError({
        message: "No puedes mover una carga a un día festivo desde el calendario.",
        feedback,
        setMessage: setError,
      });
      setDraggingCalendarEvent(null);
      setCalendarDropTarget(null);
      return;
    }

    const targetEndMinutes = targetStartMinutes + dragged.durationMinutes;
    if (targetEndMinutes > CALENDAR_END_MINUTES) {
      reportFormError({
        message: "Ese movimiento deja la sesión por fuera del rango visible del calendario.",
        feedback,
        setMessage: setError,
      });
      setDraggingCalendarEvent(null);
      setCalendarDropTarget(null);
      return;
    }

    const nextDayLabel = dayNameFromIsoDate(targetDateKey);
    if (!nextDayLabel) {
      reportFormError({
        message: "No fue posible resolver el nuevo día para esta carga.",
        feedback,
        setMessage: setError,
      });
      setDraggingCalendarEvent(null);
      setCalendarDropTarget(null);
      return;
    }

    const nextStartTime = minutesToTimeString(targetStartMinutes);
    const nextEndTime = minutesToTimeString(targetEndMinutes);
    const currentDayLabel = dragged.slot === 1 ? row.dayOfWeek1 : row.dayOfWeek2;
    const currentStartTime = dragged.slot === 1 ? row.startTime : row.day2StartTime || row.startTime;
    const currentEndTime = dragged.slot === 1 ? row.endTime : row.day2EndTime || row.endTime;

    if (
      sameWeekday(currentDayLabel, nextDayLabel) &&
      currentStartTime === nextStartTime &&
      currentEndTime === nextEndTime
    ) {
      setDraggingCalendarEvent(null);
      setCalendarDropTarget(null);
      return;
    }

    const primaryDurationMinutes =
      dragged.slot === 1 ? dragged.durationMinutes : Math.max(0, row.durationMinutes || diffMinutes(row.startTime, row.endTime));
    const primaryAcademicHours =
      dragged.slot === 1 ? calculateAcademicHours(dragged.durationMinutes, row.institution) : row.academicHours;
    const secondaryDurationMinutes =
      dragged.slot === 2
        ? dragged.durationMinutes
        : row.dayOfWeek2
          ? Math.max(0, row.day2DurationMinutes || diffMinutes(row.day2StartTime || row.startTime, row.day2EndTime || row.endTime))
          : 0;
    const secondaryAcademicHours =
      dragged.slot === 2
        ? calculateAcademicHours(dragged.durationMinutes, row.institution)
        : row.dayOfWeek2
          ? row.day2AcademicHours
          : 0;

    const nextDayOfWeek1 = dragged.slot === 1 ? nextDayLabel : row.dayOfWeek1 || dayNameFromIsoDate(row.startDate) || nextDayLabel;
    const nextDayOfWeek2 = dragged.slot === 2 ? nextDayLabel : row.dayOfWeek2;
    if (nextDayOfWeek2 && sameWeekday(nextDayOfWeek1, nextDayOfWeek2)) {
      reportFormError({
        message: "No puedes dejar las dos jornadas en el mismo día desde el calendario.",
        feedback,
        setMessage: setError,
      });
      setDraggingCalendarEvent(null);
      setCalendarDropTarget(null);
      return;
    }

    const nextStartTime1 = dragged.slot === 1 ? nextStartTime : row.startTime;
    const nextEndTime1 = dragged.slot === 1 ? nextEndTime : row.endTime;
    const nextDay2StartTime = nextDayOfWeek2 ? (dragged.slot === 2 ? nextStartTime : row.day2StartTime || row.startTime) : "";
    const nextDay2EndTime = nextDayOfWeek2 ? (dragged.slot === 2 ? nextEndTime : row.day2EndTime || row.endTime) : "";
    const nextDay2DurationMinutes = nextDayOfWeek2 ? secondaryDurationMinutes : 0;
    const nextDay2AcademicHours = nextDayOfWeek2 ? secondaryAcademicHours : 0;

    const weeklyAcademicHours = getWeeklyAcademicHours({
      institution: row.institution,
      startDate: row.startDate,
      cesdeGroupType: row.cesdeGroupType,
      dayOfWeek1: nextDayOfWeek1,
      dayOfWeek2: nextDayOfWeek2,
      startTime: nextStartTime1,
      endTime: nextEndTime1,
      durationMinutes: primaryDurationMinutes,
      academicHours: primaryAcademicHours,
      day2StartTime: nextDay2StartTime,
      day2EndTime: nextDay2EndTime,
      day2DurationMinutes: nextDay2DurationMinutes,
      day2AcademicHours: nextDay2AcademicHours,
    });

    setMovingCalendarEventId(dragged.eventId);
    setError(null);
    try {
      await updateDoc(doc(firestore, "teachingLoads", row.id), {
        dayOfWeek1: nextDayOfWeek1,
        dayOfWeek2: nextDayOfWeek2,
        startTime: nextStartTime1,
        endTime: nextEndTime1,
        durationMinutes: primaryDurationMinutes,
        academicHours: primaryAcademicHours,
        day2StartTime: nextDay2StartTime,
        day2EndTime: nextDay2EndTime,
        day2DurationMinutes: nextDay2DurationMinutes,
        day2AcademicHours: nextDay2AcademicHours,
        weeklyAcademicHours,
        updatedAt: serverTimestamp(),
      });
      feedback.success("Carga reubicada en el calendario.");
    } catch {
      reportFormError({
        message: "No fue posible mover la carga en el calendario.",
        feedback,
        setMessage: setError,
      });
    } finally {
      setDraggingCalendarEvent(null);
      setCalendarDropTarget(null);
      setMovingCalendarEventId(null);
    }
  }

  return {
    calendarWeekStart,
    setCalendarWeekStart,
    calendarDays,
    calendarHolidayMap,
    calendarEvents,
    calendarSummary,
    draggingCalendarEvent,
    calendarDropTarget,
    setCalendarDropTarget,
    movingCalendarEventId,
    readDraggedCalendarEvent,
    handleCalendarDragStart,
    handleCalendarDragEnd,
    moveCalendarEventToSlot,
  };
}
