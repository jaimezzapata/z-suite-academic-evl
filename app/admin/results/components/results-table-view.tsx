"use client";

import { Eye, Printer, Trash2, Loader2, ArrowUpDown } from "lucide-react";
import { MinimalPagination } from "@/app/admin/ui/minimal-pagination";
import type { ResultRow, SortKey } from "../types";
import { formatDate, statusTone } from "../services/results-service";

interface ResultsTableViewProps {
  loading: boolean;
  visibleRowsCount: number;
  pagedRows: ResultRow[];
  selectedIds: Record<string, true>;
  allVisibleSelected: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectRow: (id: string, checked: boolean) => void;
  sortKey: SortKey;
  onToggleSort: (key: SortKey) => void;
  onSelectRow: (row: ResultRow) => void;
  onExportAttemptPdf: (row: ResultRow) => void;
  exportingAttemptId: string | null;
  exportingBulkZip: boolean;
  onDeleteTarget: (row: ResultRow) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function ResultsTableView({
  loading,
  visibleRowsCount,
  pagedRows,
  selectedIds,
  allVisibleSelected,
  onToggleSelectAll,
  onToggleSelectRow,
  sortKey,
  onToggleSort,
  onSelectRow,
  onExportAttemptPdf,
  exportingAttemptId,
  exportingBulkZip,
  onDeleteTarget,
  page,
  pageCount,
  onPageChange,
}: ResultsTableViewProps) {
  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-zinc-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando resultados...
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Mobile Card View (< 640px) */}
      <div className="space-y-3 sm:hidden">
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => onToggleSelectAll(e.target.checked)}
            />
            Seleccionar visibles
          </label>
          <p className="text-xs text-zinc-500">{pagedRows.length} en página</p>
        </div>

        {pagedRows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedIds[r.id])}
                    onChange={(e) => onToggleSelectRow(r.id, e.target.checked)}
                    aria-label="Seleccionar"
                  />
                  <div className="truncate font-semibold text-zinc-900">{r.examName}</div>
                </div>
                <div className="mt-1 truncate text-xs text-zinc-500">
                  Código <span className="font-semibold text-zinc-700">{r.examCode}</span> •{" "}
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(
                      r.status,
                    )}`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-zinc-900">{r.studentFullName}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {r.documentId} • {formatDate(r.submittedAt)}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">0-5</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
                      {r.grade0to5.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Fraude</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">{r.fraudTotal}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Malas</p>
                    <p
                      className={`mt-1 text-sm font-semibold tabular-nums ${
                        r.wrongCount > 0 ? "text-rose-700" : "text-zinc-900"
                      }`}
                    >
                      {r.wrongCount}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => onSelectRow(r)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  aria-label="Ver detalle"
                  title="Ver detalle"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onExportAttemptPdf(r)}
                  disabled={exportingAttemptId === r.id || exportingBulkZip}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                  aria-label="Descargar PDF"
                  title="Descargar PDF"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTarget(r)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  aria-label="Eliminar intento"
                  title="Eliminar intento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {!visibleRowsCount ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
            No hay resultados para mostrar.
          </div>
        ) : null}

        <MinimalPagination
          pageCount={pageCount}
          page={page}
          onChange={(next) => onPageChange(Math.max(0, Math.min(pageCount - 1, next)))}
        />
      </div>

      {/* Desktop Semantic Table (>= 640px) */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-[980px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-2 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  aria-label="Seleccionar todo"
                  title="Seleccionar todo"
                />
              </th>
              <th className="w-[38%] px-2 py-2">
                <button
                  type="button"
                  onClick={() => onToggleSort("examName")}
                  className="inline-flex items-center gap-1"
                >
                  Examen <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="w-[28%] px-2 py-2">
                <button
                  type="button"
                  onClick={() => onToggleSort("studentFullName")}
                  className="inline-flex items-center gap-1"
                >
                  Estudiante <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="w-[12%] px-2 py-2">
                <button
                  type="button"
                  onClick={() => onToggleSort("grade0to5")}
                  className="inline-flex items-center gap-1 whitespace-nowrap"
                >
                  0-5 <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="w-[10%] px-2 py-2">
                <button
                  type="button"
                  onClick={() => onToggleSort("fraudTotal")}
                  className="inline-flex items-center gap-1"
                >
                  Fraude <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="w-[12%] px-2 py-2">
                <button
                  type="button"
                  onClick={() => onToggleSort("submittedAt")}
                  className="inline-flex items-center gap-1"
                >
                  Fecha <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="w-[120px] px-2 py-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 align-top">
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedIds[r.id])}
                    onChange={(e) => onToggleSelectRow(r.id, e.target.checked)}
                    aria-label="Seleccionar"
                    title="Seleccionar"
                  />
                </td>
                <td className="px-2 py-2 text-zinc-900">
                  <div className="truncate font-medium">{r.examName}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    Código <span className="font-semibold text-zinc-700">{r.examCode}</span> •{" "}
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(
                        r.status,
                      )}`}
                    >
                      {r.status}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="truncate font-medium text-zinc-900">{r.studentFullName}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">{r.documentId}</div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  <div className="font-semibold text-zinc-900">{r.grade0to5.toFixed(2)}</div>
                  <div className="text-xs text-zinc-500">{r.grade0to50.toFixed(0)} / 50</div>
                </td>
                <td className="px-2 py-2">
                  <div className="text-xs text-zinc-700">
                    <span className="font-semibold tabular-nums text-zinc-900">{r.fraudTotal}</span>
                    <span className="text-zinc-500"> / </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        r.wrongCount > 0 ? "text-rose-700" : "text-zinc-500"
                      }`}
                    >
                      {r.wrongCount}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">Fraude / Malas</div>
                </td>
                <td className="px-2 py-2 text-xs text-zinc-600">{formatDate(r.submittedAt)}</td>
                <td className="px-2 py-2 text-right">
                  <div className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectRow(r)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      aria-label="Ver detalle"
                      title="Ver detalle"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onExportAttemptPdf(r)}
                      disabled={exportingAttemptId === r.id || exportingBulkZip}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                      aria-label="Descargar PDF"
                      title="Descargar PDF"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTarget(r)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      aria-label="Eliminar intento"
                      title="Eliminar intento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!visibleRowsCount ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">
                  No hay resultados para mostrar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <MinimalPagination
          pageCount={pageCount}
          page={page}
          onChange={(next) => onPageChange(Math.max(0, Math.min(pageCount - 1, next)))}
        />
      </div>
    </div>
  );
}
