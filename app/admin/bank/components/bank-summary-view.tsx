"use client";

import React from "react";
import {
  Boxes,
  Copy,
  FileQuestion,
  Layers,
  Pencil,
  Tags,
} from "lucide-react";
import { MinimalPagination } from "@/app/admin/ui/minimal-pagination";
import { Donut, BarList } from "./bank-charts";
import {
  badgeTone,
  difficultyLabel,
  formatCompactNumber,
  iconForType,
  statusLabel,
  typeLabel,
} from "../services/bank-service";
import type {
  BankDashboardStats,
  BankPreviewQuestion,
  CatalogItem,
} from "../types";

type BankSummaryViewProps = {
  data: BankDashboardStats;
  metricsLoading: boolean;
  metricsLoaded: boolean;
  metricsWarning: string | null;
  subjects: CatalogItem[];
  moments: CatalogItem[];
  selectedSubjectId: string;
  onSelectSubjectId: (id: string) => void;
  selectedMomentId: string;
  onSelectMomentId: (id: string) => void;
  search: string;
  onSearchChange: (val: string) => void;
  previewLoading: boolean;
  previewError: string | null;
  pagedPreview: BankPreviewQuestion[];
  previewPage: number;
  previewPageCount: number;
  onPageChange: (page: number) => void;
  onOpenEdit: (id: string) => void;
  loading: boolean;
};

export function BankSummaryView({
  data,
  metricsLoading,
  metricsLoaded,
  metricsWarning,
  subjects,
  moments,
  selectedSubjectId,
  onSelectSubjectId,
  selectedMomentId,
  onSelectMomentId,
  search,
  onSearchChange,
  previewLoading,
  previewError,
  pagedPreview,
  previewPage,
  previewPageCount,
  onPageChange,
  onOpenEdit,
  loading,
}: BankSummaryViewProps) {
  return (
    <div className="space-y-6">
      {metricsWarning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {metricsWarning}
        </div>
      ) : null}

      {/* Grid de KPIs principales */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Publicadas</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                {metricsLoading ? "-" : metricsLoaded ? formatCompactNumber(data.counts.published) : "-"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Listas para aplicar</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Borrador</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                {metricsLoading ? "-" : metricsLoaded ? formatCompactNumber(data.counts.draft) : "-"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Pendientes de revisión</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <Copy className="h-5 w-5" />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Archivadas</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                {metricsLoading ? "-" : metricsLoaded ? formatCompactNumber(data.counts.archived) : "-"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Fuera de uso</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Calidad rápida (muestra)</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600">
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Sin puntos:{" "}
              <span className="font-semibold text-zinc-900">
                {metricsLoading ? "-" : metricsLoaded ? data.quality.missingPoints : "-"}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Sin estado:{" "}
              <span className="font-semibold text-zinc-900">
                {metricsLoading ? "-" : metricsLoaded ? data.quality.missingStatus : "-"}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Sin grupos:{" "}
              <span className="font-semibold text-zinc-900">
                {metricsLoading ? "-" : metricsLoaded ? data.quality.missingGroups : "-"}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Sin momentos:{" "}
              <span className="font-semibold text-zinc-900">
                {metricsLoading ? "-" : metricsLoaded ? data.quality.missingMoments : "-"}
              </span>
            </div>
          </div>
        </article>
      </section>

      {/* Gráficos de distribución */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Estado</h2>
              <p className="text-sm text-zinc-500">Distribución por publicación.</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
              <Tags className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <Donut
              items={[
                { label: "Publicadas", value: data.counts.published, tone: "emerald" },
                { label: "Borrador", value: data.counts.draft, tone: "amber" },
                { label: "Archivadas", value: data.counts.archived, tone: "zinc" },
              ]}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Tipos</h2>
              <p className="text-sm text-zinc-500">Qué se está creando en el banco.</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
              <FileQuestion className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            {data.byType.length ? (
              <BarList items={data.byType} />
            ) : (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando..." : "Sin datos."}
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Dificultad, Top materias y Cobertura */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Dificultad</h2>
          <p className="text-sm text-zinc-500">Balance por nivel.</p>
          <div className="mt-4">
            {data.byDifficulty.length ? (
              <BarList items={data.byDifficulty} />
            ) : (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando..." : "Sin datos."}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Top materias</h2>
          <p className="text-sm text-zinc-500">Más contenido en la muestra.</p>
          <div className="mt-4">
            {data.topSubjects.length ? (
              <BarList items={data.topSubjects} />
            ) : (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando..." : "Sin datos."}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Cobertura</h2>
          <p className="text-sm text-zinc-500">Grupos y momentos más usados.</p>
          <div className="mt-4 space-y-4">
            {data.topGroups.length ? (
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Grupos</p>
                <div className="mt-2">
                  <BarList items={data.topGroups} />
                </div>
              </div>
            ) : null}
            {data.topMoments.length ? (
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Momentos</p>
                <div className="mt-2">
                  <BarList items={data.topMoments} />
                </div>
              </div>
            ) : null}
            {!data.topGroups.length && !data.topMoments.length ? (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando..." : "Sin datos."}
              </div>
            ) : null}
          </div>
        </article>
      </section>

      {/* Explorar muestra interactiva */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Explorar (muestra)</h2>
            <p className="text-sm text-zinc-500">Revisión rápida de preguntas recientes.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <select
              value={selectedSubjectId}
              onChange={(e) => onSelectSubjectId(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 sm:w-60"
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
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 sm:w-56"
            >
              <option value="">Todos los momentos</option>
              {moments.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por enunciado..."
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 sm:w-80"
            />
          </div>
        </div>

        {previewError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {previewError}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pagedPreview.length ? (
            pagedPreview.map((p) => {
              const Icon = iconForType(p.type);
              return (
                <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {difficultyLabel(p.difficulty)}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {p.points === null ? "Sin puntos" : `${p.points} pts`}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-950">{p.statement}</p>
                      <p className="mt-1 text-xs text-zinc-500">{typeLabel(p.type)}</p>
                    </div>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                    <p className="text-xs text-zinc-500">
                      ID: <span className="font-mono text-zinc-700">{p.id}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(p.id)}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar ID
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenEdit(p.id)}
                        className="inline-flex h-8 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 transition"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500 lg:col-span-2">
              {loading || previewLoading ? "Cargando..." : "No hay preguntas para mostrar con ese filtro."}
            </div>
          )}
        </div>

        <MinimalPagination pageCount={previewPageCount} page={previewPage} onChange={onPageChange} />
      </section>
    </div>
  );
}
