"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";
import { getTeachingLoadSessions } from "@/lib/teaching-load-sessions";
import type {
  CatalogItem,
  GeneralScheduleReportRow,
  InstitutionTab,
  PayrollStatementItem,
  PayrollStatementRow,
  TeachingLoadRow,
  WorkloadFilters,
  WorkloadFocusState,
  WorkloadSummaryCards,
  WorkloadViewMode,
} from "../types";
import {
  calculateAcademicHours,
  countCoveredWeeks,
  dayNameFromIsoDate,
  diffMinutes,
  formatCurrency,
  formatHours,
  formatScheduleSummary,
  getTimestampLabel,
  getWeeklyAcademicHours,
  getWeeklySessionCount,
  normalizeCesdeGroupType,
  parseLocalDate,
  periodFromDate,
  roundHours,
  startOfWeek,
  toString,
} from "../services/workload-date-utils";
import {
  deleteTeachingLoadApi,
  fetchWorkloadCatalogs,
} from "../services/workload-service";
import {
  downloadCalendarPdf as exportCalendarPdf,
  downloadGeneralScheduleCsv as exportGeneralScheduleCsv,
  downloadGeneralSchedulePdf as exportGeneralSchedulePdf,
  downloadPayrollStatementPdf as exportPayrollStatementPdf,
} from "../services/workload-export-service";
import { useWorkloadCalendar } from "./use-workload-calendar";
import { useWorkloadPayroll } from "./use-workload-payroll";
import { useWorkloadForm } from "./use-workload-form";

const EMPTY_FILTERS: WorkloadFilters = {
  subjectId: "",
  audienceId: "",
  siteId: "",
  shiftId: "",
  classroom: "",
  dateFrom: "",
  dateTo: "",
};

const WORKLOAD_FOCUS_STORAGE_KEY = "workload-focus";

export function useWorkloadData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const feedback = useFeedback();

  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);
  const [sites, setSites] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);
  const [rows, setRows] = useState<TeachingLoadRow[]>([]);
  const [payrollStatements, setPayrollStatements] = useState<PayrollStatementRow[]>([]);

  const [tab, setTab] = useState<InstitutionTab>("ALL");
  const [viewMode, setViewMode] = useState<WorkloadViewMode>("calendar");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<WorkloadFilters>(EMPTY_FILTERS);

  // Carga de catálogos
  useEffect(() => {
    let cancelled = false;
    async function loadCatalogs() {
      try {
        const data = await fetchWorkloadCatalogs();
        if (cancelled) return;
        setSubjects(data.subjects);
        setGroups(data.groups);
        setFichas(data.fichas);
        setSites(data.sites);
        setShifts(data.shifts);
      } catch {
        if (!cancelled) setError("No fue posible cargar los catálogos de materias, grupos, sedes y jornadas.");
      }
    }
    void loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  // Suscripción a teachingLoads
  useEffect(() => {
    const q = query(collection(firestore, "teachingLoads"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const row = d.data() as Record<string, unknown>;
          const institution = toString(row.institution, "CESDE");
          const cesdeGroupType = normalizeCesdeGroupType(row.cesdeGroupType);
          const startTime = toString(row.startTime, "");
          const endTime = toString(row.endTime, "");
          const day2StartTime = toString(row.day2StartTime, "");
          const day2EndTime = toString(row.day2EndTime, "");
          const startDate = toString(row.startDate, "");
          const dayOfWeek1 = toString(row.dayOfWeek1, dayNameFromIsoDate(startDate));
          const dayOfWeek2 = toString(row.dayOfWeek2, "");
          const fallbackMinutes = Math.max(0, diffMinutes(startTime, endTime));
          const day2FallbackMinutes = dayOfWeek2
            ? Math.max(0, diffMinutes(day2StartTime || startTime, day2EndTime || endTime))
            : 0;
          const fallbackAcademicHours = calculateAcademicHours(fallbackMinutes, institution);
          const day2FallbackAcademicHours = dayOfWeek2 ? calculateAcademicHours(day2FallbackMinutes, institution) : 0;
          const academicHours =
            typeof row.academicHours === "number" && Number.isFinite(row.academicHours)
              ? row.academicHours
              : fallbackAcademicHours;
          const day2AcademicHours =
            typeof row.day2AcademicHours === "number" && Number.isFinite(row.day2AcademicHours)
              ? row.day2AcademicHours
              : day2FallbackAcademicHours;

          return {
            id: d.id,
            institution,
            cesdeGroupType,
            period: toString(row.period, periodFromDate(startDate)),
            subjectId: toString(row.subjectId, ""),
            subjectName: toString(row.subjectName, "Sin materia"),
            audienceId: toString(row.audienceId, ""),
            audienceName: toString(row.audienceName, "Sin grupo/ficha"),
            audienceType: toString(row.audienceType, institution === "SENA" ? "ficha" : "group"),
            siteId: toString(row.siteId, ""),
            siteName: toString(row.siteName, "Sin sede"),
            shiftId: toString(row.shiftId, ""),
            shiftName: toString(row.shiftName, "Sin jornada"),
            startDate,
            endDate: toString(row.endDate, ""),
            startTime,
            endTime,
            day2StartTime,
            day2EndTime,
            classroom: toString(row.classroom, ""),
            durationMinutes:
              typeof row.durationMinutes === "number" && Number.isFinite(row.durationMinutes)
                ? row.durationMinutes
                : fallbackMinutes,
            academicHours,
            day2DurationMinutes:
              typeof row.day2DurationMinutes === "number" && Number.isFinite(row.day2DurationMinutes)
                ? row.day2DurationMinutes
                : day2FallbackMinutes,
            day2AcademicHours,
            weeklyAcademicHours:
              typeof row.weeklyAcademicHours === "number" && Number.isFinite(row.weeklyAcademicHours)
                ? row.weeklyAcademicHours
                : getWeeklyAcademicHours({
                    institution,
                    startDate,
                    cesdeGroupType,
                    dayOfWeek1,
                    dayOfWeek2,
                    startTime,
                    endTime,
                    academicHours,
                    durationMinutes: fallbackMinutes,
                    day2StartTime,
                    day2EndTime,
                    day2DurationMinutes: day2FallbackMinutes,
                    day2AcademicHours,
                  }),
            dayOfWeek1,
            dayOfWeek2,
            driveWorkspaceId: toString(row.driveWorkspaceId, ""),
            driveStatus: toString(row.driveStatus, "pending"),
            driveErrorMessage: toString(row.driveErrorMessage, ""),
            drivePublicFolderUrl: toString(row.drivePublicFolderUrl, ""),
            active: row.active !== false,
          } satisfies TeachingLoadRow;
        });
        setRows(
          next.sort((a, b) =>
            `${b.startDate}|${b.startTime}|${b.subjectName}`.localeCompare(`${a.startDate}|${a.startTime}|${a.subjectName}`, "es"),
          ),
        );
        setLoading(false);
      },
      () => {
        setError("No fue posible leer la carga horaria.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  // Suscripción a payrollStatements
  useEffect(() => {
    const q = query(collection(firestore, "payrollStatements"), orderBy("createdAt", "desc"), limit(40));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const row = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            rangeStart: toString(row.rangeStart, ""),
            rangeEnd: toString(row.rangeEnd, ""),
            hourlyRate: typeof row.hourlyRate === "number" && Number.isFinite(row.hourlyRate) ? row.hourlyRate : 0,
            totalHours: typeof row.totalHours === "number" && Number.isFinite(row.totalHours) ? row.totalHours : 0,
            totalValue: typeof row.totalValue === "number" && Number.isFinite(row.totalValue) ? row.totalValue : 0,
            itemCount: typeof row.itemCount === "number" && Number.isFinite(row.itemCount) ? row.itemCount : 0,
            createdByEmail: toString(row.createdByEmail, ""),
            createdByName: toString(row.createdByName, ""),
            createdAtLabel: getTimestampLabel(row.createdAt),
            items: Array.isArray(row.items)
              ? row.items.map((item) => {
                  const value = item as Record<string, unknown>;
                  return {
                    loadId: toString(value.loadId, ""),
                    subjectId: toString(value.subjectId, ""),
                    subjectName: toString(value.subjectName, ""),
                    audienceId: toString(value.audienceId, ""),
                    audienceName: toString(value.audienceName, ""),
                    audienceType: toString(value.audienceType, ""),
                    siteId: toString(value.siteId, ""),
                    siteName: toString(value.siteName, ""),
                    shiftId: toString(value.shiftId, ""),
                    shiftName: toString(value.shiftName, ""),
                    period: toString(value.period, ""),
                    classroom: toString(value.classroom, ""),
                    date: toString(value.date, ""),
                    dayName: toString(value.dayName, ""),
                    startTime: toString(value.startTime, ""),
                    endTime: toString(value.endTime, ""),
                    sessionDayOfWeek: toString(value.sessionDayOfWeek, toString(value.dayName, "")),
                    academicHours:
                      typeof value.academicHours === "number" && Number.isFinite(value.academicHours) ? value.academicHours : 0,
                    hourlyRate: typeof value.hourlyRate === "number" && Number.isFinite(value.hourlyRate) ? value.hourlyRate : 0,
                    estimatedValue:
                      typeof value.estimatedValue === "number" && Number.isFinite(value.estimatedValue) ? value.estimatedValue : 0,
                    cesdeGroupType: toString(value.cesdeGroupType, ""),
                  } satisfies PayrollStatementItem;
                })
              : [],
          } satisfies PayrollStatementRow;
        });
        setPayrollStatements(next);
      },
      () => {
        feedback.warning("No fue posible leer el historial de colillas guardadas.");
      },
    );
    return () => unsub();
  }, [feedback]);

  // Mobile detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncViewport);
      return () => media.removeEventListener("change", syncViewport);
    }
    media.addListener(syncViewport);
    return () => media.removeListener(syncViewport);
  }, []);

  const rowsByInstitution = useMemo(() => {
    if (tab === "ALL") return rows;
    return rows.filter((row) => (row.institution || "CESDE").toUpperCase() === tab);
  }, [rows, tab]);

  const filterAudienceOptions = useMemo(() => {
    if (tab === "ALL") {
      const merged = [
        ...groups.map((item) => ({ id: item.id, name: item.name, kind: "group" as const })),
        ...fichas.map((item) => ({ id: item.id, name: `Ficha ${item.name}`, kind: "ficha" as const })),
      ];
      return merged.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    return (tab === "SENA" ? fichas : groups).map((item) => ({
      id: item.id,
      name: tab === "SENA" ? `Ficha ${item.name}` : item.name,
      kind: tab === "SENA" ? ("ficha" as const) : ("group" as const),
    }));
  }, [fichas, groups, tab]);

  const classroomOptions = useMemo(
    () =>
      Array.from(new Set(rowsByInstitution.map((row) => row.classroom.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [rowsByInstitution],
  );

  const filteredRows = useMemo(() => {
    return rowsByInstitution.filter((row) => {
      if (filters.subjectId && row.subjectId !== filters.subjectId) return false;
      if (filters.audienceId && row.audienceId !== filters.audienceId) return false;
      if (filters.siteId && row.siteId !== filters.siteId) return false;
      if (filters.shiftId && row.shiftId !== filters.shiftId) return false;
      if (filters.classroom && row.classroom.trim().toLowerCase() !== filters.classroom.trim().toLowerCase()) return false;
      if (filters.dateFrom && row.endDate < filters.dateFrom) return false;
      if (filters.dateTo && row.startDate > filters.dateTo) return false;
      return true;
    });
  }, [filters, rowsByInstitution]);

  const counts = useMemo(
    () => ({
      CESDE: rows.filter((row) => (row.institution || "CESDE").toUpperCase() === "CESDE").length,
      SENA: rows.filter((row) => (row.institution || "CESDE").toUpperCase() === "SENA").length,
    }),
    [rows],
  );

  const hourTotals = useMemo(
    () => ({
      CESDE: roundHours(
        rows
          .filter((row) => (row.institution || "CESDE").toUpperCase() === "CESDE")
          .reduce((sum, row) => sum + getWeeklyAcademicHours(row), 0),
      ),
      SENA: roundHours(
        rows
          .filter((row) => (row.institution || "CESDE").toUpperCase() === "SENA")
          .reduce((sum, row) => sum + getWeeklyAcademicHours(row), 0),
      ),
    }),
    [rows],
  );

  const effectiveViewMode = isMobile && viewMode === "calendar" ? "list" : viewMode;

  // Sub-hooks especializados
  const calendarHook = useWorkloadCalendar({
    rows,
    filteredRows,
    setError,
  });

  const payrollHook = useWorkloadPayroll({
    filteredRows,
    setError,
    setSuccess,
  });

  const formHook = useWorkloadForm({
    tab,
    rows,
    subjects,
    groups,
    fichas,
    sites,
    shifts,
    setTab,
    setViewMode,
    setCalendarWeekStart: calendarHook.setCalendarWeekStart,
    resetFilters: () => setFilters(EMPTY_FILTERS),
    setError,
    setSuccess,
  });

  // Foco inicial de carga desde dashboard u otras vistas
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(WORKLOAD_FOCUS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as WorkloadFocusState;
      if (parsed.institution === "CESDE" || parsed.institution === "SENA") {
        setTab(parsed.institution);
      }
      const focusDate = typeof parsed.startDate === "string" ? parseLocalDate(parsed.startDate) : null;
      if (focusDate) {
        calendarHook.setCalendarWeekStart(startOfWeek(focusDate));
      }
      window.localStorage.removeItem(WORKLOAD_FOCUS_STORAGE_KEY);
    } catch {}
  }, [calendarHook]);

  const generalScheduleReportRows = useMemo<GeneralScheduleReportRow[]>(() => {
    return [...rows]
      .sort((a, b) => {
        const institutionDiff = (a.institution || "").localeCompare(b.institution || "", "es");
        if (institutionDiff !== 0) return institutionDiff;
        const subjectDiff = (a.subjectName || "").localeCompare(b.subjectName || "", "es");
        if (subjectDiff !== 0) return subjectDiff;
        return (a.audienceName || "").localeCompare(b.audienceName || "", "es");
      })
      .map((row) => {
        const sessions = getTeachingLoadSessions(row);
        const days = sessions.map((session) => session.dayOfWeek).filter(Boolean).join(" / ");
        const groupOrFichaLabel = row.audienceType === "ficha" ? "Ficha" : "Grupo";
        return {
          institution: row.institution || "CESDE",
          cesdeGroupType: row.cesdeGroupType || "-",
          period: row.period || "-",
          subject: row.subjectName || "-",
          groupOrFichaType: groupOrFichaLabel,
          groupOrFichaName: row.audienceName || "-",
          site: row.siteName || "-",
          shift: row.shiftName || "-",
          classroom: row.classroom || "-",
          startDate: row.startDate || "-",
          endDate: row.endDate || "-",
          coveredWeeks: countCoveredWeeks(row.startDate, row.endDate),
          days: days || "-",
          day1Start: row.startTime || "-",
          day1End: row.endTime || "-",
          day1Hours: formatHours(row.academicHours),
          day2Start: row.day2StartTime || "-",
          day2End: row.day2EndTime || "-",
          day2Hours: row.dayOfWeek2 ? formatHours(row.day2AcademicHours) : "-",
          weeklyHours: formatHours(getWeeklyAcademicHours(row)),
          weeklySessions: getWeeklySessionCount(row),
          scheduleSummary: formatScheduleSummary(row) || "-",
          driveStatus: row.driveStatus || "-",
          drivePublicFolderUrl: row.drivePublicFolderUrl || "-",
          active: row.active ? "Activa" : "Inactiva",
        };
      });
  }, [rows]);

  const summaryCards = useMemo<WorkloadSummaryCards>(() => {
    if (effectiveViewMode === "payroll") {
      return {
        totalLabel: "Rango de nómina",
        totalValue: `${payrollHook.payrollRangeStart || "--"} -> ${payrollHook.payrollRangeEnd || "--"}`,
        totalHint: "Corte editable para la simulación",
        cesdeCount: `${formatHours(payrollHook.payrollSummary.cesdeHours)} h`,
        cesdeHours: payrollHook.payrollHourlyRateValue
          ? `${formatCurrency(payrollHook.payrollSummary.cesdeEstimated)} estimado`
          : "Define valor hora CESDE",
        senaCount: `${payrollHook.payrollSummary.senaLoads}`,
        senaHours: payrollHook.senaMonthlySalaryValue
          ? `${formatCurrency(payrollHook.payrollSummary.senaMonthlyReference)} mensual fijo`
          : "Define salario mensual SENA",
      };
    }
    if (effectiveViewMode === "calendar") {
      return {
        totalLabel: "Cargas visibles",
        totalValue: loading ? "-" : `${calendarHook.calendarSummary.totalLoads}`,
        totalHint: loading ? "-" : `${calendarHook.calendarSummary.totalEvents} bloque(s) en la semana`,
        cesdeCount: loading ? "-" : `${calendarHook.calendarSummary.cesdeLoads}`,
        cesdeHours: loading ? "-" : `${formatHours(calendarHook.calendarSummary.cesdeHours)} h académicas`,
        senaCount: loading ? "-" : `${calendarHook.calendarSummary.senaLoads}`,
        senaHours: loading ? "-" : `${formatHours(calendarHook.calendarSummary.senaHours)} h registradas`,
      };
    }

    return {
      totalLabel: "Cargas registradas",
      totalValue: loading ? "-" : `${rows.length}`,
      totalHint: "Vista completa del módulo",
      cesdeCount: loading ? "-" : `${counts.CESDE}`,
      cesdeHours: loading ? "-" : `${formatHours(hourTotals.CESDE)} h académicas/semana`,
      senaCount: loading ? "-" : `${counts.SENA}`,
      senaHours: loading ? "-" : `${formatHours(hourTotals.SENA)} h registradas/semana`,
    };
  }, [
    calendarHook.calendarSummary.cesdeHours,
    calendarHook.calendarSummary.cesdeLoads,
    calendarHook.calendarSummary.senaHours,
    calendarHook.calendarSummary.senaLoads,
    calendarHook.calendarSummary.totalEvents,
    calendarHook.calendarSummary.totalLoads,
    counts.CESDE,
    counts.SENA,
    effectiveViewMode,
    hourTotals.CESDE,
    hourTotals.SENA,
    loading,
    payrollHook.payrollHourlyRateValue,
    payrollHook.payrollRangeEnd,
    payrollHook.payrollRangeStart,
    payrollHook.payrollSummary.cesdeEstimated,
    payrollHook.payrollSummary.cesdeHours,
    payrollHook.payrollSummary.senaLoads,
    payrollHook.payrollSummary.senaMonthlyReference,
    payrollHook.senaMonthlySalaryValue,
    rows.length,
  ]);

  function updateFilter<K extends keyof WorkloadFilters>(key: K, value: WorkloadFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function applyTab(nextTab: InstitutionTab) {
    setTab(nextTab);
    setFilters(EMPTY_FILTERS);
    const firstWithDate = rows
      .filter((row) => nextTab === "ALL" || (row.institution || "CESDE").toUpperCase() === nextTab)
      .map((row) => parseLocalDate(row.startDate))
      .find((value): value is Date => Boolean(value));
    if (firstWithDate) {
      calendarHook.setCalendarWeekStart(startOfWeek(firstWithDate));
    }
  }

  async function removeRow(row: TeachingLoadRow) {
    const confirmed = await feedback.confirm({
      title: "Eliminar carga horaria",
      description: row.driveWorkspaceId
        ? `Se eliminará ${row.subjectName} en ${row.siteName} para ${row.audienceName}, se retirará del panel y su estructura en Drive se enviará a la papelera.`
        : `Se eliminará ${row.subjectName} en ${row.siteName} para ${row.audienceName}.`,
      confirmLabel: "Eliminar carga",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    try {
      const result = await deleteTeachingLoadApi(row.id);
      const successMessage = result.deletedWorkspace
        ? "Carga horaria eliminada y estructura de Drive enviada a la papelera."
        : "Carga horaria eliminada.";
      setSuccess(successMessage);
      feedback.success(successMessage);
    } catch (err) {
      reportFormError({
        message: err instanceof Error ? err.message : "No fue posible eliminar la carga horaria.",
        feedback,
        setMessage: setError,
      });
    }
  }

  async function downloadCalendarPdf() {
    if (!calendarHook.calendarEvents.length) {
      reportFormError({
        message: "No hay bloques visibles en el calendario para exportar.",
        feedback,
        setMessage: setError,
      });
      return;
    }
    try {
      await exportCalendarPdf({
        calendarEvents: calendarHook.calendarEvents,
        calendarDays: calendarHook.calendarDays,
        calendarHolidayMap: calendarHook.calendarHolidayMap,
        calendarWeekStart: calendarHook.calendarWeekStart,
        tab,
      });
      feedback.success("Horario descargado en PDF.");
    } catch {
      reportFormError({
        message: "No fue posible descargar el horario en PDF.",
        feedback,
        setMessage: setError,
      });
    }
  }

  function downloadGeneralScheduleCsv() {
    if (!generalScheduleReportRows.length) {
      reportFormError({
        message: "No hay cargas horarias registradas para exportar en CSV.",
        feedback,
        setMessage: setError,
      });
      return;
    }
    exportGeneralScheduleCsv(generalScheduleReportRows);
    feedback.success("Reporte general descargado en CSV.");
  }

  async function downloadGeneralSchedulePdf() {
    if (!generalScheduleReportRows.length) {
      reportFormError({
        message: "No hay cargas horarias registradas para exportar en PDF.",
        feedback,
        setMessage: setError,
      });
      return;
    }
    try {
      await exportGeneralSchedulePdf(generalScheduleReportRows);
      feedback.success("Reporte general descargado en PDF.");
    } catch {
      reportFormError({
        message: "No fue posible descargar el reporte general en PDF.",
        feedback,
        setMessage: setError,
      });
    }
  }

  async function downloadPayrollStatementPdf(statement: PayrollStatementRow) {
    try {
      await exportPayrollStatementPdf(statement);
    } catch {
      feedback.error("No fue posible generar el PDF de la colilla.");
    }
  }

  return {
    loading,
    error,
    success,
    isMobile,
    subjects,
    groups,
    fichas,
    sites,
    shifts,
    rows,
    payrollStatements,
    tab,
    viewMode,
    effectiveViewMode,
    modalOpen: formHook.modalOpen,
    filtersOpen,
    editingId: formHook.editingId,
    form: formHook.form,
    filters,
    calendarWeekStart: calendarHook.calendarWeekStart,
    payrollRangeStart: payrollHook.payrollRangeStart,
    payrollRangeEnd: payrollHook.payrollRangeEnd,
    cesdeHourlyRate: payrollHook.cesdeHourlyRate,
    senaMonthlySalary: payrollHook.senaMonthlySalary,
    selectedPayrollStatement: payrollHook.selectedPayrollStatement,
    draggingCalendarEvent: calendarHook.draggingCalendarEvent,
    calendarDropTarget: calendarHook.calendarDropTarget,
    movingCalendarEventId: calendarHook.movingCalendarEventId,
    filterAudienceOptions,
    classroomOptions,
    filteredRows,
    counts,
    hourTotals,
    audienceOptions: formHook.audienceOptions,
    currentDurationMinutes: formHook.currentDurationMinutes,
    currentAcademicHours: formHook.currentAcademicHours,
    currentWeeklySessionCount: formHook.currentWeeklySessionCount,
    currentWeeklyAcademicHours: formHook.currentWeeklyAcademicHours,
    calendarDays: calendarHook.calendarDays,
    calendarHolidayMap: calendarHook.calendarHolidayMap,
    calendarEvents: calendarHook.calendarEvents,
    calendarSummary: calendarHook.calendarSummary,
    generalScheduleReportRows,
    payrollSummary: payrollHook.payrollSummary,
    summaryCards,
    // Actions
    setTab,
    setViewMode,
    setModalOpen: formHook.setModalOpen,
    setFiltersOpen,
    setCalendarWeekStart: calendarHook.setCalendarWeekStart,
    setPayrollRangeStart: payrollHook.setPayrollRangeStart,
    setPayrollRangeEnd: payrollHook.setPayrollRangeEnd,
    setCesdeHourlyRate: payrollHook.setCesdeHourlyRate,
    setSenaMonthlySalary: payrollHook.setSenaMonthlySalary,
    setSelectedPayrollStatement: payrollHook.setSelectedPayrollStatement,
    setCalendarDropTarget: calendarHook.setCalendarDropTarget,
    applyTab,
    updateFilter,
    resetFilters,
    openCreate: formHook.openCreate,
    openCreateFromCalendar: formHook.openCreateFromCalendar,
    openEdit: formHook.openEdit,
    closeModal: formHook.closeModal,
    updateFormField: formHook.updateFormField,
    saveRow: formHook.saveRow,
    removeRow,
    readDraggedCalendarEvent: calendarHook.readDraggedCalendarEvent,
    handleCalendarDragStart: calendarHook.handleCalendarDragStart,
    handleCalendarDragEnd: calendarHook.handleCalendarDragEnd,
    moveCalendarEventToSlot: calendarHook.moveCalendarEventToSlot,
    movePayrollFortnight: payrollHook.movePayrollFortnight,
    savePayrollStatement: payrollHook.savePayrollStatement,
    removePayrollStatement: payrollHook.removePayrollStatement,
    downloadCalendarPdf,
    downloadGeneralScheduleCsv,
    downloadGeneralSchedulePdf,
    downloadPayrollStatementPdf,
  };
}
