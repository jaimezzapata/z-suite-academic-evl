"use client";

import { Save } from "lucide-react";
import { Modal, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui";
import type { PayrollStatementRow } from "../types";
import { formatCurrency, formatHours, formatTimeRange } from "../services/workload-date-utils";

interface WorkloadPayrollModalProps {
  statement: PayrollStatementRow | null;
  onClose: () => void;
  onDownloadPdf: (statement: PayrollStatementRow) => void;
}

export function WorkloadPayrollModal({
  statement,
  onClose,
  onDownloadPdf,
}: WorkloadPayrollModalProps) {
  if (!statement) return null;

  return (
    <Modal
      isOpen={Boolean(statement)}
      onClose={onClose}
      title={`Colilla ${statement.rangeStart} - ${statement.rangeEnd}`}
      description={`Detalle discriminado del corte guardado el ${statement.createdAtLabel || "-"}.`}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onDownloadPdf(statement)}
          >
            <Save className="h-4 w-4 mr-1.5" />
            Descargar PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* KPI Mini Grid */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-800/40 p-3">
            <p className="text-xs text-foreground/55">Período</p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {statement.rangeStart} - {statement.rangeEnd}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-800/40 p-3">
            <p className="text-xs text-foreground/55">Valor hora</p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {formatCurrency(statement.hourlyRate)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-800/40 p-3">
            <p className="text-xs text-foreground/55">Horas liquidadas</p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {formatHours(statement.totalHours)} h
            </p>
          </div>
          <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/30 p-3">
            <p className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">Total liquidado</p>
            <p className="mt-1 text-sm font-bold text-fuchsia-700 dark:text-fuchsia-300">
              {formatCurrency(statement.totalValue)}
            </p>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="rounded-2xl border border-border bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50">
            <div>
              <p className="text-sm font-bold text-foreground">Detalle de clases liquidadas</p>
              <p className="text-xs text-foreground/55">
                {statement.itemCount} registro(s) incluidos en la colilla.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[360px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Materia</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Jornada</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Salón</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.items.map((item, index) => (
                  <TableRow key={`${item.loadId}-${item.date}-${index}`}>
                    <TableCell className="font-medium text-foreground">{item.subjectName}</TableCell>
                    <TableCell className="text-foreground/70">
                      {item.audienceType === "ficha" ? `Ficha ${item.audienceName}` : item.audienceName}
                    </TableCell>
                    <TableCell className="text-foreground/70">{item.siteName}</TableCell>
                    <TableCell className="text-foreground/70">{item.shiftName}</TableCell>
                    <TableCell className="text-foreground/70">
                      {item.date} · {item.dayName}
                    </TableCell>
                    <TableCell className="text-foreground/70">{formatTimeRange(item.startTime, item.endTime)}</TableCell>
                    <TableCell className="text-foreground/70">{item.classroom || "-"}</TableCell>
                    <TableCell className="text-right text-foreground/70">{formatHours(item.academicHours)}</TableCell>
                    <TableCell className="text-right font-bold text-fuchsia-700 dark:text-fuchsia-400">
                      {formatCurrency(item.estimatedValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
