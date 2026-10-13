"use client";

import { FileArchive, Trash2 } from "lucide-react";
import type { StatusFilter } from "../types";

interface ResultsFiltersProps {
  examCodeFilter: string;
  setExamCodeFilter: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  onlyWithWrong: boolean;
  setOnlyWithWrong: (value: boolean) => void;
  onlyWithFraud: boolean;
  setOnlyWithFraud: (value: boolean) => void;
  loading: boolean;
  totalResults: number;
  selectedCount: number;
  exportingBulkZip: boolean;
  exportingAttemptId: string | null;
  onExportSelectedZip: () => void;
  onOpenBulkDelete: () => void;
  onClearSelection: () => void;
  setPage: (page: number) => void;
}

export function ResultsFilters({
  examCodeFilter,
  setExamCodeFilter,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onlyWithWrong,
  setOnlyWithWrong,
  onlyWithFraud,
  setOnlyWithFraud,
  loading,
  totalResults,
  selectedCount,
  exportingBulkZip,
  exportingAttemptId,
  onExportSelectedZip,
  onOpenBulkDelete,
  onClearSelection,
  setPage,
}: ResultsFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full max-w-4xl flex-col gap-2 sm:flex-row">
          <input
            value={examCodeFilter}
            onChange={(e) => {
              setExamCodeFilter(e.target.value.replace(/\D/g, "").slice(0, 6));
              setPage(0);
            }}
            placeholder="Filtrar por código de examen (6 dígitos)..."
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por examen, estudiante, documento, correo o estado..."
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <div className="w-full sm:w-[360px]">
            <select
              aria-label="Estado"
              value={statusFilter}
              onChange={(e) => {
                const id = e.target.value;
                if (
                  id === "all" ||
                  id === "submitted" ||
                  id === "in_progress" ||
                  id === "annulled" ||
                  id === "fraud"
                ) {
                  setStatusFilter(id);
                  setPage(0);
                }
              }}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            >
              <option value="all">Todos</option>
              <option value="submitted">Enviados</option>
              <option value="in_progress">En progreso</option>
              <option value="fraud">Fraude</option>
              <option value="annulled">Anulados</option>
            </select>
          </div>
        </div>
        <p className="text-sm text-zinc-600">
          {loading ? "Cargando..." : `${totalResults} resultados`}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={onlyWithWrong}
              onChange={(e) => {
                setOnlyWithWrong(e.target.checked);
                setPage(0);
              }}
            />
            Solo con malas
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={onlyWithFraud}
              onChange={(e) => {
                setOnlyWithFraud(e.target.checked);
                setPage(0);
              }}
            />
            Solo con fraude
          </label>
        </div>

        {selectedCount > 0 ? (
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <div className="text-sm font-semibold text-zinc-800">{selectedCount} seleccionados</div>
            <button
              type="button"
              onClick={onExportSelectedZip}
              disabled={exportingBulkZip || exportingAttemptId !== null}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
              title="Descargar ZIP de seleccionados"
            >
              <FileArchive className="h-4 w-4" />
              ZIP
            </button>
            <button
              type="button"
              onClick={onOpenBulkDelete}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              aria-label="Eliminar seleccionados"
              title="Eliminar seleccionados"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Limpiar selección
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
