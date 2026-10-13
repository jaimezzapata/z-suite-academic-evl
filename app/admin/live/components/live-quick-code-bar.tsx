"use client";

import type { PublishedExamRow } from "../types";

interface LiveQuickCodeBarProps {
  quickCode: string;
  onQuickCodeChange: (value: string) => void;
  quickCodeError: string | null;
  quickCodeLoading: boolean;
  onOpenByQuickCode: () => void;
  onClearQuickCode: () => void;
  quickSuggestions: PublishedExamRow[];
  onSelectSuggestion: (row: PublishedExamRow) => void;
}

export function LiveQuickCodeBar({
  quickCode,
  onQuickCodeChange,
  quickCodeError,
  quickCodeLoading,
  onOpenByQuickCode,
  onClearQuickCode,
  quickSuggestions,
  onSelectSuggestion,
}: LiveQuickCodeBarProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950">Acceso rápido por código</p>
          <p className="mt-1 text-xs text-zinc-600">
            Escribe el código de 6 dígitos y presiona Enter para abrir el examen.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenByQuickCode}
            disabled={quickCodeLoading}
            className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Abrir
          </button>
          <button
            type="button"
            onClick={onClearQuickCode}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="mt-4">
        <input
          value={quickCode}
          onChange={(e) => onQuickCodeChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onOpenByQuickCode();
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Ej: 123456"
          className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-base font-semibold tracking-[0.2em] text-zinc-900 outline-none focus:border-zinc-400"
          aria-label="Código de examen"
        />

        {quickCodeError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {quickCodeError}
          </div>
        ) : null}

        {quickSuggestions.length ? (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Códigos recientes
            </p>
            <div className="flex flex-wrap gap-2">
              {quickSuggestions.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectSuggestion(row)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-zinc-800 hover:bg-zinc-100"
                  title={`Abrir ${row.name}`}
                >
                  {row.accessCode}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
