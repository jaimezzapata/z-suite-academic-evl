"use client";

import { Calendar, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { DayTimeline, SessionItem } from "../types";

export interface DashboardScheduleProps {
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onRefresh: () => void;
  holidays: Array<{ dateKey: string; name: string }>;
  todaySchedule: {
    dayLabel: string;
    holidayName: string | null;
    items: SessionItem[];
  };
  weekTimeline: DayTimeline[];
}

function formatWeekRange(startDate: Date) {
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
  const startLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(endDate);
  return `${startLabel} - ${endLabel}`;
}

export function DashboardSchedule({
  weekStart,
  onPrevWeek,
  onNextWeek,
  onToday,
  onRefresh,
  holidays,
  todaySchedule,
  weekTimeline,
}: DashboardScheduleProps) {
  return (
    <div className="space-y-6">
      {/* Barra de navegación de la semana */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Semana: {formatWeekRange(weekStart)}
                </p>
                <p className="text-xs text-slate-500">
                  Agenda académica sincronizada con franjas horarias y festivos.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onPrevWeek} leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={onToday}>
                Hoy
              </Button>
              <Button variant="secondary" size="sm" onClick={onNextWeek} rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                Siguiente
              </Button>
              <Button variant="primary" size="sm" onClick={onRefresh} leftIcon={<RotateCw className="w-3.5 h-3.5" />}>
                Actualizar
              </Button>
            </div>
          </div>

          {holidays.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Festivos esta semana:</span>
              {holidays.map((h) => (
                <Badge key={h.dateKey} variant="warning" size="sm">
                  {h.dateKey} · {h.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agenda de Hoy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Hoy en agenda</CardTitle>
            <CardDescription className="capitalize">
              {todaySchedule.dayLabel} · Orden cronológico del día
            </CardDescription>
          </div>
          <Badge variant="default" size="sm">
            {todaySchedule.items.length} materia(s)
          </Badge>
        </CardHeader>

        <CardContent>
          {todaySchedule.holidayName ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 p-4 text-xs font-medium text-amber-900 dark:text-amber-200">
              Hoy es festivo oficial: {todaySchedule.holidayName}
            </div>
          ) : todaySchedule.items.length ? (
            <div className="space-y-3">
              {todaySchedule.items.map((item) => {
                const isSena = item.institution.toUpperCase() === "SENA";
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-4 transition-all hover:shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={isSena ? "sena" : "cesde"} size="sm">
                            {item.institution}
                          </Badge>
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {item.subjectName}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.audienceName} · {item.siteName || "Sin sede"} · {item.shiftName || "Sin jornada"}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                          {item.timeLabel}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {item.classroom || "Sin salón asignado"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-8 text-center text-xs text-slate-400">
              No tienes materias programadas para hoy.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Materias por día (Semanal) */}
      <Card>
        <CardHeader>
          <CardTitle>Materias por día</CardTitle>
          <CardDescription>
            Distribución semanal según la fecha seleccionada (excluyendo festivos).
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            {weekTimeline.map((day) => (
              <div
                key={day.dateKey}
                className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/40 p-3"
              >
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-white/5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {day.weekdayLabel}
                    </p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                      {day.dayLabel}
                    </p>
                  </div>
                  {day.holidayName ? (
                    <Badge variant="warning" size="sm">
                      Festivo
                    </Badge>
                  ) : null}
                </div>

                {day.holidayName ? (
                  <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50 dark:bg-amber-950/20 p-2 text-[11px] text-amber-900 dark:text-amber-200 leading-tight">
                    {day.holidayName}
                  </div>
                ) : day.items.length ? (
                  <div className="mt-3 space-y-2">
                    {day.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 p-2.5 shadow-2xs"
                      >
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                          {item.subjectName}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">
                          {item.audienceName} · {item.classroom || "-"}
                        </p>
                        <p className="mt-1 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-medium">
                          {item.timeLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-center text-[11px] text-slate-400">
                    Sin clases
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
