"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  CalendarRange,
  Eye,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge, Button, Input, EmptyState } from "@/components/ui";
import type {
  PayrollSummary,
  PayrollStatementRow,
} from "../types";
import { formatCurrency, formatHours, formatTimeRange } from "../services/workload-date-utils";

interface WorkloadPayrollViewProps {
  payrollRangeStart: string;
  payrollRangeEnd: string;
  cesdeHourlyRate: string;
  senaMonthlySalary: string;
  payrollSummary: PayrollSummary;
  payrollStatements: PayrollStatementRow[];
  loading: boolean;
  onRangeStartChange: (val: string) => void;
  onRangeEndChange: (val: string) => void;
  onCesdeRateChange: (val: string) => void;
  onSenaSalaryChange: (val: string) => void;
  onMoveFortnight: (dir: -1 | 1) => void;
  onSaveStatement: () => void;
  onSelectStatement: (st: PayrollStatementRow) => void;
  onDownloadStatementPdf: (st: PayrollStatementRow) => void;
  onRemoveStatement: (st: PayrollStatementRow) => void;
}

export function WorkloadPayrollView({
  payrollRangeStart,
  payrollRangeEnd,
  cesdeHourlyRate,
  senaMonthlySalary,
  payrollSummary,
  payrollStatements,
  loading,
  onRangeStartChange,
  onRangeEndChange,
  onCesdeRateChange,
  onSenaSalaryChange,
  onMoveFortnight,
  onSaveStatement,
  onSelectStatement,
  onDownloadStatementPdf,
  onRemoveStatement,
}: WorkloadPayrollViewProps) {
  return (
    <div className="mt-4 space-y-4">
      {/* Simulation Controls Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/70 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">Vista nómina</h2>
            <p className="mt-1 text-sm text-foreground/55">
              Simulación operativa: CESDE se calcula por horas programadas en la quincena y SENA se trata como salario fijo mensual.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" size="sm" className="font-mono">
              Corte: {payrollRangeStart || "--"} &rarr; {payrollRangeEnd || "--"}
            </Badge>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onMoveFortnight(-1)}
              className="h-8.5 px-3 text-xs"
              aria-label="Retroceder una quincena"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onMoveFortnight(1)}
              className="h-8.5 px-3 text-xs"
              aria-label="Avanzar una quincena"
            >
              Siguiente
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onSaveStatement}
              className="h-8.5 px-3 text-xs"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Guardar colilla
            </Button>
          </div>
        </div>

        {/* Inputs & KPI Simulation Summary */}
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_1fr]">
          {/* Rate Inputs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="date"
              label="Inicio quincena"
              value={payrollRangeStart}
              onChange={(e) => onRangeStartChange(e.target.value)}
              leftIcon={<CalendarRange className="h-4 w-4" />}
            />
            <Input
              type="date"
              label="Fin quincena"
              value={payrollRangeEnd}
              onChange={(e) => onRangeEndChange(e.target.value)}
              leftIcon={<CalendarRange className="h-4 w-4" />}
            />
            <Input
              type="text"
              inputMode="numeric"
              label="Valor hora CESDE"
              placeholder="Ej. 25000"
              value={cesdeHourlyRate}
              onChange={(e) => onCesdeRateChange(e.target.value)}
              leftIcon={<BadgeDollarSign className="h-4 w-4" />}
            />
            <Input
              type="text"
              inputMode="numeric"
              label="Salario mensual SENA"
              placeholder="Ej. 3200000"
              value={senaMonthlySalary}
              onChange={(e) => onSenaSalaryChange(e.target.value)}
              leftIcon={<Wallet className="h-4 w-4" />}
            />
          </div>

          {/* Mini Cards Summary */}
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-fuchsia-100 dark:border-fuchsia-950 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-3">
              <p className="text-xs text-foreground/60">Horas CESDE en quincena</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-fuchsia-700 dark:text-fuchsia-300">
                {formatHours(payrollSummary.cesdeHours)} h
              </p>
              <p className="mt-0.5 text-xs text-foreground/55">{payrollSummary.cesdeLoads} carga(s) con programación</p>
            </article>

            <article className="rounded-xl border border-fuchsia-100 dark:border-fuchsia-950 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-3">
              <p className="text-xs text-foreground/60">CESDE estimado quincena</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-fuchsia-700 dark:text-fuchsia-300">
                {formatCurrency(payrollSummary.cesdeEstimated)}
              </p>
              <p className="mt-0.5 text-xs text-foreground/55">Bruto simulado con valor hora</p>
            </article>

            <article className="rounded-xl border border-emerald-100 dark:border-emerald-950 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
              <p className="text-xs text-foreground/60">SENA mensual fijo</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                {formatCurrency(payrollSummary.senaMonthlyReference)}
              </p>
              <p className="mt-0.5 text-xs text-foreground/55">{payrollSummary.senaLoads} carga(s) SENA visibles</p>
            </article>

            <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-slate-800/40 p-3">
              <p className="text-xs text-foreground/60">{payrollSummary.totalMixedLabel}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {formatCurrency(payrollSummary.totalMixedReference)}
              </p>
              <p className="mt-0.5 text-xs text-foreground/55">{payrollSummary.totalMixedHint}</p>
            </article>
          </div>
        </div>
      </div>

      {/* CESDE Breakdown Section */}
      <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/70 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight text-foreground">Detalle CESDE por carga</h3>
            <p className="mt-1 text-sm text-foreground/55">
              Se cuentan solo las clases o sesiones que realmente caen dentro del rango seleccionado.
            </p>
          </div>
          <Badge variant="default" size="sm">
            {payrollSummary.cesdeBreakdown.length} fila(s)
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {payrollSummary.cesdeBreakdown.length ? (
            payrollSummary.cesdeBreakdown.map((item) => (
              <article
                key={item.row.id}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-3.5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">{item.row.subjectName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-foreground/55">
                      {item.row.audienceType === "ficha" ? `Ficha ${item.row.audienceName}` : item.row.audienceName} &middot; {item.row.siteName} &middot; {item.row.shiftName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-fuchsia-700 dark:text-fuchsia-300">
                      {formatCurrency(item.estimatedValue)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-foreground/55">{formatHours(item.programmedHours)} h</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-foreground/60">
                  <span className="inline-flex rounded-full border border-border bg-slate-50 dark:bg-slate-800 px-2 py-0.5">
                    {item.occurrences} {item.occurrences === 1 ? "clase" : "sesiones"}
                  </span>
                  <span className="inline-flex rounded-full border border-border bg-slate-50 dark:bg-slate-800 px-2 py-0.5">
                    {item.row.dayOfWeek2 ? `${item.row.dayOfWeek1} y ${item.row.dayOfWeek2}` : item.row.dayOfWeek1}
                  </span>
                  <span className="inline-flex rounded-full border border-border bg-slate-50 dark:bg-slate-800 px-2 py-0.5">
                    {formatTimeRange(item.row.startTime, item.row.endTime)}
                  </span>
                  <span className="inline-flex rounded-full border border-border bg-slate-50 dark:bg-slate-800 px-2 py-0.5">
                    {item.row.classroom || "Sin salón"}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState
                title={loading ? "Calculando nómina..." : "No hay horas CESDE"}
                description="No hay horas CESDE programadas en el rango quincenal seleccionado."
              />
            </div>
          )}
        </div>
      </section>

      {/* History of Saved Statements */}
      <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/70 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight text-foreground">Historial de colillas</h3>
            <p className="mt-1 text-sm text-foreground/55">
              Cada corte guardado conserva su detalle para consulta futura y descarga en PDF.
            </p>
          </div>
          <Badge variant="default" size="sm">
            {payrollStatements.length} registro(s)
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          {payrollStatements.length ? (
            payrollStatements.map((statement) => (
              <article
                key={statement.id}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      Colilla {statement.createdAtLabel ? `· ${statement.createdAtLabel}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-foreground/55">
                      {statement.rangeStart} &rarr; {statement.rangeEnd}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-9 flex-col justify-center rounded-xl border border-fuchsia-200 bg-fuchsia-50/70 dark:border-fuchsia-900 dark:bg-fuchsia-950/40 px-3">
                      <p className="text-[10px] leading-none text-fuchsia-700/75 dark:text-fuchsia-300/75">Total</p>
                      <p className="mt-1 text-sm font-bold leading-none text-fuchsia-700 dark:text-fuchsia-300">
                        {formatCurrency(statement.totalValue)}
                      </p>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onSelectStatement(statement)}
                      className="h-9 px-3 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onDownloadStatementPdf(statement)}
                      className="h-9 px-3 text-xs"
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onRemoveStatement(statement)}
                      className="h-9 px-3 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="Sin colillas guardadas"
              description="Todavía no has guardado colillas quincenales en el historial."
            />
          )}
        </div>
      </section>
    </div>
  );
}
