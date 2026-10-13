"use client";

import { Download, FileDown, FileSpreadsheet } from "lucide-react";
import type { ExportFormat } from "../types";

interface ResultsHeaderProps {
  loading: boolean;
  hasRows: boolean;
  exporting: ExportFormat;
  onExport: (format: "csv" | "excel" | "pdf") => void;
}

export function ResultsHeader({
  loading,
  hasRows,
  exporting,
  onExport,
}: ResultsHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Resultados</h1>
        <p className="mt-1 text-sm text-foreground/65">
          Exporta resultados en Excel, CSV y PDF, incluyendo reporte de preguntas incorrectas por estudiante.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onExport("csv")}
          disabled={loading || !hasRows || exporting !== ""}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          CSV
        </button>
        <button
          type="button"
          onClick={() => void onExport("excel")}
          disabled={loading || !hasRows || exporting !== ""}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </button>
        <button
          type="button"
          onClick={() => void onExport("pdf")}
          disabled={loading || !hasRows || exporting !== ""}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          <FileDown className="h-4 w-4" />
          PDF
        </button>
      </div>
    </div>
  );
}
