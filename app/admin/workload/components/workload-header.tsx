"use client";

import {
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { Button, Badge, Alert } from "@/components/ui";
import type {
  InstitutionTab,
  WorkloadViewMode,
  WorkloadSummaryCards,
  PayrollSummary,
} from "../types";
import { formatCurrency } from "../services/workload-date-utils";

interface WorkloadHeaderProps {
  viewMode: WorkloadViewMode;
  effectiveViewMode: WorkloadViewMode;
  tab: InstitutionTab;
  counts: { CESDE: number; SENA: number };
  totalRows: number;
  filteredCount: number;
  subjectsCount: number;
  loading: boolean;
  error: string | null;
  success: string | null;
  summaryCards: WorkloadSummaryCards;
  payrollSummary: PayrollSummary;
  isMobile: boolean;
  onTabChange: (tab: InstitutionTab) => void;
  onViewModeChange: (mode: WorkloadViewMode) => void;
  onOpenCreate: () => void;
  onOpenFilters: () => void;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
}

export function WorkloadHeader({
  viewMode,
  effectiveViewMode,
  tab,
  counts,
  totalRows,
  filteredCount,
  subjectsCount,
  loading,
  error,
  success,
  summaryCards,
  payrollSummary,
  isMobile,
  onTabChange,
  onViewModeChange,
  onOpenCreate,
  onOpenFilters,
  onDownloadPdf,
  onDownloadCsv,
}: WorkloadHeaderProps) {
  return (
    <section className="rounded-2xl border border-border bg-white dark:bg-slate-900/60 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Carga horaria</h1>
          <p className="mt-1 text-sm text-foreground/55">
            {viewMode === "calendar"
              ? "Agenda semanal por institución con creación rápida desde la cuadrícula."
              : viewMode === "payroll"
                ? "Simula la nómina con horas programadas de CESDE y salario fijo mensual de SENA."
                : "Registra franjas horarias por institución, sede, jornada, salón y materia."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
            className="h-9 px-3 text-xs"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Recargar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownloadPdf}
            className="h-9 px-3 text-xs"
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Reporte PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownloadCsv}
            className="h-9 px-3 text-xs"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Reporte CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenCreate}
            className="h-9 px-3 text-xs shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nueva carga
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-3">
          <Alert variant="danger" title="Error en carga horaria">
            {error}
          </Alert>
        </div>
      ) : null}
      {success ? (
        <div className="mt-3">
          <Alert variant="success" title="Operación exitosa">
            {success}
          </Alert>
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200/80 bg-slate-50/60 dark:border-white/10 dark:bg-slate-800/40 p-4 transition-all">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{summaryCards.totalLabel}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{summaryCards.totalValue}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{summaryCards.totalHint}</p>
        </article>

        <article className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/40 dark:border-fuchsia-900/30 dark:bg-fuchsia-950/20 p-4 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">CESDE</p>
            <Badge variant="cesde" size="sm">45 min</Badge>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-fuchsia-700 dark:text-fuchsia-400">{summaryCards.cesdeCount}</p>
          <p className="mt-1 text-xs text-fuchsia-800/70 dark:text-fuchsia-300/70">{summaryCards.cesdeHours}</p>
        </article>

        <article className="rounded-2xl border border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/20 p-4 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">SENA</p>
            <Badge variant="sena" size="sm">60 min</Badge>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">{summaryCards.senaCount}</p>
          <p className="mt-1 text-xs text-emerald-800/70 dark:text-emerald-300/70">{summaryCards.senaHours}</p>
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-slate-50/60 dark:border-white/10 dark:bg-slate-800/40 p-4 transition-all">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {effectiveViewMode === "payroll" ? payrollSummary.totalMixedLabel : "Materias activas"}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {effectiveViewMode === "payroll"
              ? formatCurrency(payrollSummary.totalMixedReference)
              : loading
                ? "-"
                : subjectsCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {effectiveViewMode === "payroll" ? payrollSummary.totalMixedHint : "Disponibles para asignación"}
          </p>
        </article>
      </div>

      {/* Tabs and Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-white/5 pt-4">
        {/* Institutional Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: "CESDE", label: "CESDE", total: counts.CESDE },
            { id: "SENA", label: "SENA", total: counts.SENA },
            { id: "ALL", label: "Todas", total: totalRows },
          ] as const).map((institution) => {
            const active = tab === institution.id;
            return (
              <button
                key={institution.id}
                type="button"
                onClick={() => onTabChange(institution.id)}
                className={`inline-flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : "border border-border bg-white text-foreground/70 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                }`}
              >
                {institution.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    active ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {institution.total}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher and Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenFilters}
            className="h-8 px-3 text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Filtros
          </Button>

          <Badge variant="default" size="sm">
            {filteredCount} {filteredCount === 1 ? "registro" : "registros"}
          </Badge>

          {/* View mode toggle */}
          <div className="inline-flex rounded-xl border border-border bg-slate-100 dark:bg-slate-800 p-1">
            {isMobile ? (
              ([
                { id: "list", label: "Registros" },
                { id: "payroll", label: "Nómina" },
              ] as const).map((item) => {
                const active = effectiveViewMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onViewModeChange(item.id)}
                    className={`inline-flex h-6.5 items-center rounded-lg px-2.5 text-xs font-semibold transition ${
                      active
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                        : "text-foreground/65 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })
            ) : (
              ([
                { id: "calendar", label: "Calendario" },
                { id: "list", label: "Registros" },
                { id: "payroll", label: "Nómina" },
              ] as const).map((item) => {
                const active = viewMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onViewModeChange(item.id)}
                    className={`inline-flex h-6.5 items-center rounded-lg px-2.5 text-xs font-semibold transition ${
                      active
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                        : "text-foreground/65 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
