"use client";

import { LayoutGrid, Rows3, Search } from "lucide-react";

interface LiveHeaderProps {
  isMobile: boolean;
  viewMode: "table" | "map";
  onViewModeChange: (mode: "table" | "map") => void;
  search: string;
  onSearchChange: (value: string) => void;
  error: string | null;
}

export function LiveHeader({
  isMobile,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  error,
}: LiveHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Exámenes publicados</h1>
          <p className="mt-1 text-sm text-zinc-600">Gestiona códigos, estado y monitoreo en vivo.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {isMobile ? (
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
              En móvil se muestra el mapa
            </div>
          ) : (
            <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1">
              <button
                type="button"
                onClick={() => onViewModeChange("table")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  viewMode === "table" ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <Rows3 className="h-4 w-4" />
                Tabla
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("map")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  viewMode === "map" ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Mapa
              </button>
            </div>
          )}

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-zinc-400 sm:w-64"
                placeholder="Nombre o código"
              />
            </div>
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
