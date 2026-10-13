"use client";

import React from "react";
import { X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import type { CatalogItem } from "../types";

type TemplatesFiltersProps = {
  isOpen: boolean;
  subjects: CatalogItem[];
  groups: CatalogItem[];
  fichas: CatalogItem[];
  moments: CatalogItem[];
  sites: CatalogItem[];
  shifts: CatalogItem[];
  filterSubjectId: string;
  onFilterSubjectIdChange: (val: string) => void;
  filterGroupId: string;
  onFilterGroupIdChange: (val: string) => void;
  filterMomentId: string;
  onFilterMomentIdChange: (val: string) => void;
  filterSiteId: string;
  onFilterSiteIdChange: (val: string) => void;
  filterShiftId: string;
  onFilterShiftIdChange: (val: string) => void;
  filterActive: "all" | "active" | "inactive";
  onFilterActiveChange: (val: "all" | "active" | "inactive") => void;
  filterPublished: "all" | "published" | "not_published";
  onFilterPublishedChange: (val: "all" | "published" | "not_published") => void;
  onClearFilters: () => void;
  onClose: () => void;
};

export function TemplatesFilters({
  isOpen,
  subjects,
  groups,
  fichas,
  moments,
  sites,
  shifts,
  filterSubjectId,
  onFilterSubjectIdChange,
  filterGroupId,
  onFilterGroupIdChange,
  filterMomentId,
  onFilterMomentIdChange,
  filterSiteId,
  onFilterSiteIdChange,
  filterShiftId,
  onFilterShiftIdChange,
  filterActive,
  onFilterActiveChange,
  filterPublished,
  onFilterPublishedChange,
  onClearFilters,
  onClose,
}: TemplatesFiltersProps) {
  if (!isOpen) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm animate-in fade-in-50 duration-150">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Materia</span>
          <select
            value={filterSubjectId}
            onChange={(e) => onFilterSubjectIdChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
          >
            <option value="">Todas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Grupo / Ficha</span>
          <select
            value={filterGroupId}
            onChange={(e) => onFilterGroupIdChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
          >
            <option value="">Todos</option>
            <optgroup label="CESDE">
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="SENA">
              {fichas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Momento</span>
          <select
            value={filterMomentId}
            onChange={(e) => onFilterMomentIdChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
          >
            <option value="">Todos</option>
            {moments.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Sede</span>
          <select
            value={filterSiteId}
            onChange={(e) => onFilterSiteIdChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
          >
            <option value="">Todas</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Jornada</span>
          <select
            value={filterShiftId}
            onChange={(e) => onFilterShiftIdChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
          >
            <option value="">Todas</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Estado</span>
          <select
            value={filterActive}
            onChange={(e) => {
              const id = e.target.value;
              if (id === "all" || id === "active" || id === "inactive") onFilterActiveChange(id);
            }}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Publicado</span>
          <select
            value={filterPublished}
            onChange={(e) => {
              const id = e.target.value;
              if (id === "all" || id === "published" || id === "not_published") onFilterPublishedChange(id);
            }}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
          >
            <option value="all">Todos</option>
            <option value="published">Publicados</option>
            <option value="not_published">Sin publicar</option>
          </select>
        </label>

        <div className="flex items-end justify-end gap-2">
          <button
            type="button"
            onClick={onClearFilters}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
          >
            Limpiar filtros
          </button>
          <IconButton
            onClick={onClose}
            className="h-11 w-11"
            aria-label="Cerrar filtros"
            title="Cerrar filtros"
          >
            <X className="h-5 w-5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
