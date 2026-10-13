"use client";

import type { DragEvent as ReactDragEvent } from "react";
import { ArrowLeft, ArrowRight, Edit3, Save, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import type {
  CalendarEventItem,
  DragCalendarEventState,
  InstitutionTab,
  TeachingLoadRow,
} from "../types";
import { getSubjectTechnologyMeta } from "@/lib/subject-tech-branding";
import {
  CALENDAR_END_MINUTES,
  CALENDAR_LABELS,
  CALENDAR_SLOT_MINUTES,
  CALENDAR_SLOTS,
  CALENDAR_START_MINUTES,
  eventTone,
  formatDayMonth,
  formatWeekRange,
  formatWeekday,
  isoDate,
  makeCalendarDropTargetId,
} from "../services/workload-date-utils";

interface WorkloadCalendarViewProps {
  tab: InstitutionTab;
  calendarWeekStart: Date;
  calendarDays: Date[];
  calendarHolidayMap: Map<string, string>;
  calendarEvents: CalendarEventItem[];
  loading: boolean;
  movingCalendarEventId: string | null;
  draggingCalendarEvent: DragCalendarEventState | null;
  calendarDropTarget: string | null;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  onDownloadPdf: () => void;
  onOpenCreateFromCalendar: (day: Date, startMinutes: number) => void;
  onEdit: (row: TeachingLoadRow) => void;
  onRemove: (row: TeachingLoadRow) => void;
  onDragStart: (event: ReactDragEvent<HTMLDivElement>, item: CalendarEventItem) => void;
  onDragEnd: () => void;
  onDropSlot: (day: Date, startMinutes: number, dragged: DragCalendarEventState) => void;
  onSetDropTarget: (targetId: string | null) => void;
  readDraggedCalendarEvent: (event: ReactDragEvent<HTMLElement>) => DragCalendarEventState | null;
}

export function WorkloadCalendarView({
  tab,
  calendarWeekStart,
  calendarDays,
  calendarHolidayMap,
  calendarEvents,
  loading,
  movingCalendarEventId,
  draggingCalendarEvent,
  calendarDropTarget,
  onPrevWeek,
  onNextWeek,
  onCurrentWeek,
  onDownloadPdf,
  onOpenCreateFromCalendar,
  onEdit,
  onRemove,
  onDragStart,
  onDragEnd,
  onDropSlot,
  onSetDropTarget,
  readDraggedCalendarEvent,
}: WorkloadCalendarViewProps) {
  return (
    <div className="mt-4">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/70 p-4 sm:p-5 shadow-sm">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              {tab === "ALL" ? "Calendario general" : `Calendario ${tab}`}
            </h2>
            <p className="mt-1 text-sm text-foreground/55">
              Vista semanal de 6:00 am a 9:30 pm con arrastrar y soltar para mover o crear cargas.
            </p>
          </div>
          <Badge variant="default" size="sm" className="font-mono">
            {formatWeekRange(calendarWeekStart)}
          </Badge>
        </div>

        {/* Mini Stats Bar */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-800/40 px-3.5 py-3">
            <p className="text-xs text-foreground/55">Rango horario</p>
            <p className="mt-1 text-lg font-bold tracking-tight text-foreground">6:00 am - 9:30 pm</p>
            <p className="mt-0.5 text-xs text-foreground/55">{tab === "ALL" ? "CESDE + SENA" : tab}</p>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-800/40 px-3.5 py-3">
            <p className="text-xs text-foreground/55">Registros visibles</p>
            <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
              {loading ? "-" : calendarEvents.length}
            </p>
            <p className="mt-0.5 text-xs text-foreground/55">En la semana seleccionada</p>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-800/40 px-3.5 py-3">
            <p className="text-xs text-foreground/55">Instituciones</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="cesde" size="sm">
                CESDE
              </Badge>
              <Badge variant="sena" size="sm">
                SENA
              </Badge>
            </div>
          </div>
        </div>

        {/* Navigation Toolbar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-white/5 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onPrevWeek}
              className="h-8.5 px-3 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Semana anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCurrentWeek}
              className="h-8.5 px-3 text-xs font-semibold"
            >
              Hoy
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onNextWeek}
              className="h-8.5 px-3 text-xs"
            >
              Semana siguiente
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onDownloadPdf}
              className="h-8.5 px-3 text-xs"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Descargar PDF
            </Button>
          </div>
        </div>

        {/* Weekly Schedule Grid */}
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[1024px] overflow-hidden rounded-2xl border border-border bg-white dark:bg-slate-900">
            {/* Day Header Row */}
            <div className="grid grid-cols-[78px_repeat(7,minmax(0,1fr))] border-b border-border bg-slate-50/80 dark:bg-slate-800/80">
              <div className="border-r border-border px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Hora
              </div>
              {calendarDays.map((day) => {
                const holidayName = calendarHolidayMap.get(isoDate(day));
                return (
                  <div
                    key={isoDate(day)}
                    className={`border-r border-border px-2 py-2 last:border-r-0 ${holidayName ? "bg-amber-50/80 dark:bg-amber-950/40" : ""}`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      {formatWeekday(day)}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-foreground">
                      {formatDayMonth(day)}
                    </p>
                    {holidayName ? (
                      <Badge variant="warning" size="sm" className="mt-1" title={holidayName}>
                        Festivo
                      </Badge>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Time Slot Body */}
            <div className="grid h-[960px] md:h-[1020px] xl:h-[1120px] grid-cols-[78px_repeat(7,minmax(0,1fr))]">
              {/* Left Column: Time Labels */}
              <div className="relative h-full border-r border-border bg-slate-50/30 dark:bg-slate-800/20">
                {CALENDAR_LABELS.map((label, index) => (
                  <div
                    key={label}
                    className="absolute left-0 right-0 border-b border-dashed border-border/70 px-2 text-[9px] text-foreground/45"
                    style={{ top: `${(index / CALENDAR_SLOTS) * 100}%`, height: `${100 / CALENDAR_SLOTS}%` }}
                  >
                    <span className="-translate-y-1/2 inline-block bg-white dark:bg-slate-900 pr-1">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* 7 Day Columns */}
              {calendarDays.map((day, dayIndex) => {
                const holidayName = calendarHolidayMap.get(isoDate(day));
                const items = calendarEvents.filter((event) => event.dayIndex === dayIndex);

                return (
                  <div
                    key={isoDate(day)}
                    className={`relative h-full border-r border-border last:border-r-0 ${
                      holidayName ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
                    }`}
                  >
                    {/* Slot Drop/Click Targets */}
                    {Array.from({ length: CALENDAR_SLOTS }).map((_, index) => {
                      const slotStartMinutes = CALENDAR_START_MINUTES + index * CALENDAR_SLOT_MINUTES;
                      const targetId = makeCalendarDropTargetId(isoDate(day), slotStartMinutes);

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => onOpenCreateFromCalendar(day, slotStartMinutes)}
                          onDragOver={(event) => {
                            if (!draggingCalendarEvent || holidayName) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            onSetDropTarget(targetId);
                          }}
                          onDragLeave={() => {
                            onSetDropTarget(null);
                          }}
                          onDrop={(event) => {
                            if (holidayName) return;
                            event.preventDefault();
                            const dragged = readDraggedCalendarEvent(event);
                            if (!dragged) return;
                            onDropSlot(day, slotStartMinutes, dragged);
                          }}
                          className={`absolute left-0 right-0 border-b border-dashed border-border/70 text-left transition hover:bg-primary/5 ${
                            calendarDropTarget === targetId
                              ? "bg-primary/10 ring-1 ring-inset ring-primary/40"
                              : ""
                          }`}
                          style={{ top: `${(index / CALENDAR_SLOTS) * 100}%`, height: `${100 / CALENDAR_SLOTS}%` }}
                          aria-label={`Registrar carga el ${formatDayMonth(day)} a las ${CALENDAR_LABELS[index]}`}
                        />
                      );
                    })}

                    {/* Holiday Callout */}
                    {holidayName ? (
                      <div className="pointer-events-none absolute inset-x-2 top-3 z-10 rounded-xl border border-amber-200 bg-amber-100/95 dark:bg-amber-950/90 dark:border-amber-800 px-2 py-2 text-center shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                          Festivo
                        </p>
                        <p className="mt-0.5 text-[10px] text-amber-900/80 dark:text-amber-300/80">
                          {holidayName}
                        </p>
                      </div>
                    ) : null}

                    {/* Event Cards */}
                    {items.map((event) => {
                      const techMeta = getSubjectTechnologyMeta(event.subjectName);
                      const PrimaryIcon = techMeta?.primaryIcon;
                      const SecondaryIcon = techMeta?.secondaryIcon;

                      return (
                        <div
                          key={event.id}
                          role="button"
                          tabIndex={0}
                          draggable={movingCalendarEventId !== event.id}
                          onDragStart={(dragEvent) => onDragStart(dragEvent, event)}
                          onDragEnd={onDragEnd}
                          onClick={() => onEdit(event.row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onEdit(event.row);
                            }
                          }}
                          className={`absolute left-1.5 right-1.5 z-10 overflow-hidden rounded-xl border px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-primary/30 ${
                            draggingCalendarEvent?.eventId === event.id ? "cursor-grabbing opacity-70" : "cursor-grab"
                          } ${movingCalendarEventId === event.id ? "pointer-events-none opacity-60" : ""} ${event.tone}`}
                          style={{ top: event.top, height: event.height, minHeight: "92px" }}
                        >
                          {techMeta && PrimaryIcon ? (
                            <div className={`pointer-events-none absolute -bottom-3 -right-2 ${techMeta.watermarkClassName}`}>
                              <PrimaryIcon className="h-14 w-14 opacity-20" />
                            </div>
                          ) : null}

                          <div className="relative z-10 flex items-start justify-between gap-1.5">
                            <div className="min-w-0 pr-1">
                              {techMeta && PrimaryIcon ? (
                                <div className="mb-1 flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${techMeta.iconWrapClassName}`}
                                    title={techMeta.label}
                                  >
                                    <PrimaryIcon className="h-3 w-3" />
                                    {SecondaryIcon ? <SecondaryIcon className="h-3 w-3" /> : null}
                                  </span>
                                </div>
                              ) : null}
                              <p className="text-[10.5px] font-bold leading-3.5 truncate">
                                {event.subjectName}
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(event.row);
                                }}
                                className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/70 text-current transition hover:bg-white dark:bg-black/40 dark:hover:bg-black/70"
                                aria-label="Editar carga"
                              >
                                <Edit3 className="h-2.5 w-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(event.row);
                                }}
                                className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/70 text-current transition hover:bg-white dark:bg-black/40 dark:hover:bg-black/70"
                                aria-label="Eliminar carga"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>

                          <div className="relative z-10 mt-1.5 space-y-1 text-[9px] leading-3.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="inline-flex rounded-full border border-current/20 bg-white/60 dark:bg-black/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                                {event.row.siteName || "Sin sede"}
                              </span>
                            </div>
                            <p className="truncate opacity-90">
                              {event.audienceName} | {event.classroom || "N/A"}
                            </p>
                            <p className="truncate font-bold">
                              {event.timeRange} | {event.hoursLabel}
                            </p>
                            <p className="truncate opacity-75">{event.shortDateRange}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {!calendarEvents.length ? (
          <div className="mt-4">
            <EmptyState
              title={loading ? "Cargando calendario..." : `No hay registros de ${tab}`}
              description="No hay bloques horarios registrados en la semana seleccionada. Haz clic en cualquier casilla para crear uno."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
