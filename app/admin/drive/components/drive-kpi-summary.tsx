"use client";

import type { DriveDashboardSummary } from "../types";
import { formatCompactNumber } from "../services/drive-service";

interface DriveKpiSummaryProps {
  loading: boolean;
  summary: DriveDashboardSummary;
  totalWorkspaces: number;
}

export function DriveKpiSummary({ loading, summary, totalWorkspaces }: DriveKpiSummaryProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-500">Estructuras</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          {loading ? "-" : formatCompactNumber(totalWorkspaces)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Registradas en el panel</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-500">Semanas detectadas</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          {loading ? "-" : formatCompactNumber(summary.totalWeeks)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Sincronizadas desde Apps Script</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-500">CESDE / SENA</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          {loading ? "-" : `${summary.cesde} / ${summary.sena}`}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Distribución por institución</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-500">Pendientes de revisión</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          {loading ? "-" : formatCompactNumber(summary.broken)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Con error de sincronización</p>
      </div>
    </section>
  );
}
