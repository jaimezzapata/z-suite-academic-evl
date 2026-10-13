"use client";

import React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { MinimalPagination } from "@/app/admin/ui/minimal-pagination";
import {
  badgeTone,
  difficultyLabel,
  statusLabel,
  typeLabel,
} from "../services/bank-service";
import type { CatalogItem, QuestionTableRow } from "../types";

type BankTableViewProps = {
  tableLoading: boolean;
  tableError: string | null;
  tableSourceCount: number;
  filteredCount: number;
  pagedTable: QuestionTableRow[];
  tablePage: number;
  tablePageCount: number;
  onPageChange: (page: number) => void;
  subjects: CatalogItem[];
  moments: CatalogItem[];
  selectedSubjectId: string;
  onSelectSubjectId: (id: string) => void;
  selectedMomentId: string;
  onSelectMomentId: (id: string) => void;
  tableStatus: string;
  onTableStatusChange: (status: string) => void;
  tableType: string;
  onTableTypeChange: (type: string) => void;
  tableDifficulty: string;
  onTableDifficultyChange: (diff: string) => void;
  tableSearch: string;
  onTableSearchChange: (q: string) => void;
  subjectNameById: Map<string, string>;
  momentNameById: Map<string, string>;
  onReload: () => void;
  onOpenCreate: () => void;
  onOpenWipe: () => void;
  onOpenEdit: (id: string) => void;
  onOpenDelete: (row: QuestionTableRow) => void;
};

export function BankTableView({
  tableLoading,
  tableError,
  tableSourceCount,
  filteredCount,
  pagedTable,
  tablePage,
  tablePageCount,
  onPageChange,
  subjects,
  moments,
  selectedSubjectId,
  onSelectSubjectId,
  selectedMomentId,
  onSelectMomentId,
  tableStatus,
  onTableStatusChange,
  tableType,
  onTableTypeChange,
  tableDifficulty,
  onTableDifficultyChange,
  tableSearch,
  onTableSearchChange,
  subjectNameById,
  momentNameById,
  onReload,
  onOpenCreate,
  onOpenWipe,
  onOpenEdit,
  onOpenDelete,
}: BankTableViewProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
      {/* Barra superior de acciones */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Listado</h2>
          <p className="text-sm text-zinc-500">Administra preguntas: filtra, edita, crea y elimina.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReload}
            className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition"
          >
            Recargar
          </button>
          <button
            type="button"
            onClick={onOpenWipe}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition"
          >
            <Trash2 className="h-4 w-4" />
            Borrar todas
          </button>
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 transition"
          >
            <Plus className="h-4 w-4" />
            Crear pregunta
          </button>
        </div>
      </div>

      {tableError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {tableError}
        </div>
      ) : null}

      {/* Grid de filtros */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select
          value={selectedSubjectId}
          onChange={(e) => onSelectSubjectId(e.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
        >
          <option value="">Todas las materias</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={selectedMomentId}
          onChange={(e) => onSelectMomentId(e.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
        >
          <option value="">Todos los momentos</option>
          {moments.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={tableStatus}
          onChange={(e) => onTableStatusChange(e.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
        >
          <option value="">Todos los estados</option>
          <option value="published">Publicada</option>
          <option value="draft">Borrador</option>
          <option value="archived">Archivada</option>
        </select>
        <select
          value={tableType}
          onChange={(e) => onTableTypeChange(e.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
        >
          <option value="">Todos los tipos</option>
          <option value="single_choice">Selección única</option>
          <option value="multiple_choice">Selección múltiple</option>
          <option value="open_concept">Abierta</option>
          <option value="puzzle_order">Ordenar</option>
          <option value="puzzle_match">Emparejar</option>
          <option value="puzzle_cloze">Completar</option>
        </select>
        <input
          value={tableSearch}
          onChange={(e) => onTableSearchChange(e.target.value)}
          placeholder="Buscar por enunciado..."
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
        />
        <select
          value={tableDifficulty}
          onChange={(e) => onTableDifficultyChange(e.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 lg:col-span-2"
        >
          <option value="">Todas las dificultades</option>
          <option value="easy">Fácil</option>
          <option value="medium">Media</option>
          <option value="hard">Difícil</option>
        </select>
        <div className="flex items-center justify-between gap-2 lg:col-span-3">
          <p className="text-xs text-zinc-500">
            {tableLoading ? "Cargando..." : `${filteredCount} preguntas encontradas`}
          </p>
          <p className="text-xs text-zinc-500">
            Fuente: últimas {tableSourceCount} actualizadas
          </p>
        </div>
      </div>

      {/* Vista móvil en tarjetas */}
      <div className="space-y-3 sm:hidden">
        {pagedTable.map((r) => {
          const subjectName = subjectNameById.get(r.subjectId) ?? (r.subjectId || "-");
          const momentsLabel = r.momentIds
            .map((id) => momentNameById.get(id) ?? id)
            .slice(0, 2)
            .join(", ");
          const momentsExtra = Math.max(0, r.momentIds.length - 2);

          return (
            <div key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-900 line-clamp-2">{r.statement || "-"}</div>
                  <div className="mt-1 text-xs text-zinc-500">{subjectName}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      {typeLabel(r.type)}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      {difficultyLabel(r.difficulty)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-600">
                    {momentsLabel || "-"}
                    {momentsExtra ? <span className="ml-1 text-zinc-500">(+{momentsExtra} más)</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenEdit(r.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition"
                    aria-label="Editar pregunta"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDelete(r)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                    aria-label="Eliminar pregunta"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {!pagedTable.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
            {tableLoading ? "Cargando..." : "No hay preguntas para mostrar con esos filtros."}
          </div>
        ) : null}
        <MinimalPagination pageCount={tablePageCount} page={tablePage} onChange={onPageChange} />
      </div>

      {/* Vista de escritorio en tabla semántica */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 sm:block">
        <table className="min-w-[900px] w-full text-left">
          <thead className="bg-zinc-50">
            <tr className="text-xs text-zinc-500">
              <th className="px-3 py-2 font-medium">Pregunta</th>
              <th className="px-3 py-2 font-medium">Materia</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Momentos</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagedTable.map((r) => {
              const subjectName = subjectNameById.get(r.subjectId) ?? (r.subjectId || "-");
              const momentsLabel = r.momentIds
                .map((id) => momentNameById.get(id) ?? id)
                .slice(0, 2)
                .join(", ");
              const momentsExtra = Math.max(0, r.momentIds.length - 2);

              return (
                <tr key={r.id} className="border-t border-zinc-100 text-sm transition-colors hover:bg-zinc-50/50">
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-zinc-900 line-clamp-2">{r.statement || "-"}</div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="text-sm font-medium text-zinc-900">{subjectName}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{r.subjectId || "-"}</div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="text-sm font-medium text-zinc-900">{typeLabel(r.type)}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{difficultyLabel(r.difficulty)}</div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="text-sm text-zinc-900">{momentsLabel || "-"}</div>
                    {momentsExtra ? <div className="mt-0.5 text-xs text-zinc-500">+{momentsExtra} más</div> : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenEdit(r.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition"
                        aria-label="Editar pregunta"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDelete(r)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                        aria-label="Eliminar pregunta"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!pagedTable.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-zinc-500">
                  {tableLoading ? "Cargando..." : "No hay preguntas para mostrar con esos filtros."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="min-w-[900px] border-t border-zinc-100 bg-white">
          <MinimalPagination pageCount={tablePageCount} page={tablePage} onChange={onPageChange} />
        </div>
      </div>
    </section>
  );
}
