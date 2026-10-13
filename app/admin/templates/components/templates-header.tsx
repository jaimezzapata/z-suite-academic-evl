"use client";

import React from "react";
import { Filter, LayoutGrid, Plus, Table2 } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";

type TemplatesHeaderProps = {
  search: string;
  onSearchChange: (value: string) => void;
  isMobile: boolean;
  viewMode: "cards" | "table";
  onViewModeChange: (mode: "cards" | "table") => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onOpenCreate: () => void;
};

export function TemplatesHeader({
  search,
  onSearchChange,
  isMobile,
  viewMode,
  onViewModeChange,
  filtersOpen,
  onToggleFilters,
  onOpenCreate,
}: TemplatesHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Exámenes</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Crea y administra exámenes por jornada, sede, momento y grupo. Define cantidad de preguntas y activa/inactiva.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-zinc-800">Buscar</span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nombre, grupo, sede..."
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 sm:w-72"
          />
        </label>

        {isMobile ? (
          <div className="inline-flex h-11 items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-600">
            En móvil se muestran cards
          </div>
        ) : (
          <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => onViewModeChange("table")}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                viewMode === "table" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
              aria-pressed={viewMode === "table"}
            >
              <Table2 className="h-4 w-4" />
              Tabla
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("cards")}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                viewMode === "cards" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
              aria-pressed={viewMode === "cards"}
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>
          </div>
        )}

        <IconButton
          onClick={onToggleFilters}
          className={`h-11 w-11 ${filtersOpen ? "bg-zinc-100 text-zinc-950" : ""}`}
          aria-label="Filtros"
          title="Filtros"
        >
          <Filter className="h-5 w-5" />
        </IconButton>

        <IconButton
          variant="primary"
          onClick={onOpenCreate}
          className="h-11 w-11 shrink-0"
          aria-label="Crear examen"
          title="Crear examen"
        >
          <Plus className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  );
}
