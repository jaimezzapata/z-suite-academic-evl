"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { MiniSparkline } from "./bank-charts";
import { formatCompactNumber } from "../services/bank-service";
import type { BankViewMode } from "../types";

type BankHeaderProps = {
  view: BankViewMode;
  onViewChange: (mode: BankViewMode) => void;
  totalCount: number;
  metricsLoading: boolean;
  metricsLoaded: boolean;
  statusSpark: number[];
};

export function BankHeader({
  view,
  onViewChange,
  totalCount,
  metricsLoading,
  metricsLoaded,
  statusSpark,
}: BankHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Banco de preguntas</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Visualiza cobertura, distribución y calidad del banco. Importa lotes JSON cuando lo necesites.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1">
          <button
            type="button"
            onClick={() => onViewChange("summary")}
            className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
              view === "summary" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
            }`}
            aria-pressed={view === "summary"}
          >
            Resumen
          </button>
          <button
            type="button"
            onClick={() => onViewChange("table")}
            className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
              view === "table" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
            }`}
            aria-pressed={view === "table"}
          >
            Tabla
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Total
              </p>
              <p className="text-xl font-semibold tracking-tight text-zinc-950">
                {metricsLoading ? "..." : metricsLoaded ? formatCompactNumber(totalCount) : "-"}
              </p>
            </div>
            <MiniSparkline values={statusSpark} />
          </div>
        </div>
      </div>
    </div>
  );
}
