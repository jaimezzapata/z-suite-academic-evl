"use client";

import { useMemo, useState } from "react";
import { getColombiaHolidayName } from "@/lib/colombia-holidays";
import { getTeachingLoadSessions } from "@/lib/teaching-load-sessions";
import { Alert } from "@/components/ui/alert";
import { useDashboardData } from "./dashboard/hooks/use-dashboard-data";
import { DashboardKpiGrid } from "./dashboard/components/dashboard-kpi-grid";
import { DashboardCharts } from "./dashboard/components/dashboard-charts";
import { DashboardRecentActivity } from "./dashboard/components/dashboard-recent-activity";
import { DashboardSchedule } from "./dashboard/components/dashboard-schedule";
import {
  startOfWeek,
  addDays,
  isoDate,
  parseLocalDate,
  isSameOrAfterDay,
  isSameOrBeforeDay,
  minutesFromTimeLoose,
  buildWeekTimeline,
  buildTodaySchedule,
} from "./dashboard/services/dashboard-schedule-utils";

export function DashboardView() {
  const { loading, error, warning, data, teachingLoads, driveWorkspaces, refresh } =
    useDashboardData();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const holidayByDateKey = useMemo(() => {
    const map = new Map<string, string>();
    weekDays.forEach((day) => {
      const name = getColombiaHolidayName(day);
      if (name) map.set(isoDate(day), name);
    });
    return map;
  }, [weekDays]);

  const holidaysList = useMemo(
    () => Array.from(holidayByDateKey.entries()).map(([dateKey, name]) => ({ dateKey, name })),
    [holidayByDateKey],
  );

  const driveLinkedTotal = useMemo(() => {
    const ids = new Set<string>();
    teachingLoads.forEach((row) => {
      if (row.driveWorkspaceId) ids.add(row.driveWorkspaceId);
    });
    return ids.size;
  }, [teachingLoads]);

  const workloadWeek = useMemo(() => {
    const labels = new Map([
      [1, "LUN"],
      [2, "MAR"],
      [3, "MIE"],
      [4, "JUE"],
      [5, "VIE"],
      [6, "SAB"],
      [0, "DOM"],
    ]);

    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const occupiedIntervalsByDay = new Map<number, Array<[number, number]>>();
    const scheduledHoursByDay = new Map<number, number>();
    const driveWorkspaceIds = new Set<string>();
    let totalOccurrences = 0;

    const workWindow = { startMinutes: 6 * 60, endMinutes: 22 * 60 };

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

            const clampedStart = Math.max(workWindow.startMinutes, startMinutes);
            const clampedEnd = Math.min(workWindow.endMinutes, endMinutes);

            if (clampedEnd > clampedStart) {
              const currentIntervals = occupiedIntervalsByDay.get(session.weekdayIndex) ?? [];
              currentIntervals.push([clampedStart, clampedEnd]);
              occupiedIntervalsByDay.set(session.weekdayIndex, currentIntervals);
            }

            const currentHours = scheduledHoursByDay.get(session.weekdayIndex) ?? 0;
            scheduledHoursByDay.set(session.weekdayIndex, currentHours + session.academicHours);
            totalOccurrences += 1;
            if (row.driveWorkspaceId) driveWorkspaceIds.add(row.driveWorkspaceId);
          });
        });
      });

    function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
      if (!intervals.length) return [];
      const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
      const merged: Array<[number, number]> = [sorted[0]!];
      for (let i = 1; i < sorted.length; i += 1) {
        const current = sorted[i]!;
        const last = merged[merged.length - 1]!;
        if (current[0] <= last[1]) {
          last[1] = Math.max(last[1], current[1]);
        } else {
          merged.push(current);
        }
      }
      return merged;
    }

    const perDay = dayOrder.map((dayIndex) => {
      const dayDate = weekDays.find((day) => day.getDay() === dayIndex);
      const dayDateLabel = dayDate
        ? new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(dayDate)
        : "";
      const intervals = mergeIntervals(occupiedIntervalsByDay.get(dayIndex) ?? []);
      const occupiedMinutes = intervals.reduce((acc, [s, e]) => acc + (e - s), 0);
      const freeMinutes = Math.max(0, workWindow.endMinutes - workWindow.startMinutes - occupiedMinutes);
      const occupiedHours = occupiedMinutes / 60;
      const freeHours = freeMinutes / 60;
      const scheduledHours = scheduledHoursByDay.get(dayIndex) ?? 0;
      const baseLabel = labels.get(dayIndex) ?? `${dayIndex}`;

      return {
        dayIndex,
        label: baseLabel,
        dateLabel: dayDateLabel,
        fullLabel: dayDateLabel ? `${baseLabel} ${dayDateLabel}` : baseLabel,
        occupiedHours,
        freeHours,
        scheduledHours,
      };
    });

    const nonHolidayCount = weekDays.reduce(
      (acc, day) => (holidayByDateKey.has(isoDate(day)) ? acc : acc + 1),
      0,
    );
    const weekWorkMinutes = nonHolidayCount * (workWindow.endMinutes - workWindow.startMinutes);
    const totalOccupiedMinutes = perDay.reduce((acc, d) => acc + d.occupiedHours * 60, 0);
    const occupancy = weekWorkMinutes ? totalOccupiedMinutes / weekWorkMinutes : 0;
    const totalAcademicHours = perDay.reduce((acc, d) => acc + d.scheduledHours, 0);
    const busiest = perDay.reduce((a, b) => (b.scheduledHours > a.scheduledHours ? b : a), perDay[0]!);
    const lightest = perDay.reduce((a, b) => (b.scheduledHours < a.scheduledHours ? b : a), perDay[0]!);

    return {
      perDay,
      totalOccurrences,
      driveWorkspaceCount: driveWorkspaceIds.size,
      totalAcademicHours,
      occupancy,
      busiestDay: busiest,
      lightestDay: lightest,
    };
  }, [holidayByDateKey, teachingLoads, weekDays]);

  const driveSummary = useMemo(() => {
    const broken = driveWorkspaces.filter((ws) => ws.healthBroken).length;
    const cesde = driveWorkspaces.filter((ws) => ws.institution.toUpperCase() === "CESDE").length;
    const sena = driveWorkspaces.filter((ws) => ws.institution.toUpperCase() === "SENA").length;
    return { cesde, sena, broken };
  }, [driveWorkspaces]);

  const weekTimeline = useMemo(
    () => buildWeekTimeline(teachingLoads, weekDays, holidayByDateKey),
    [teachingLoads, weekDays, holidayByDateKey],
  );

  const todaySchedule = useMemo(() => buildTodaySchedule(teachingLoads), [teachingLoads]);

  return (
    <div className="space-y-6">
      {/* Alertas del sistema */}
      {error && (
        <Alert variant="danger" title="Error al cargar el dashboard">
          {error}
        </Alert>
      )}

      {warning && (
        <Alert variant="warning" title="Aviso de sincronización parcial">
          {warning}
        </Alert>
      )}

      {/* Grid de KPIs principales */}
      <DashboardKpiGrid
        data={data}
        loading={loading}
        driveLinkedTotal={driveLinkedTotal}
        workloadWeek={workloadWeek}
      />

      {/* Gráficos de tendencias y distribuciones */}
      <DashboardCharts
        data={data}
        workloadWeek={workloadWeek}
        driveSummary={driveSummary}
      />

      {/* Exámenes destacados y últimos intentos registrados */}
      <DashboardRecentActivity
        topExams={data.topExams7}
        latestAttempts={data.latestAttempts}
        loading={loading}
      />

      {/* Agenda cronológica y distribución de materias */}
      <DashboardSchedule
        weekStart={weekStart}
        onPrevWeek={() => setWeekStart((prev) => addDays(prev, -7))}
        onNextWeek={() => setWeekStart((prev) => addDays(prev, 7))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
        onRefresh={refresh}
        holidays={holidaysList}
        todaySchedule={todaySchedule}
        weekTimeline={weekTimeline}
      />
    </div>
  );
}
