"use client";

import { X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import type { PublishedExamRow } from "../types";

interface LiveTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeTarget: PublishedExamRow | null;
  timeDraft: string;
  onTimeDraftChange: (value: string) => void;
  timeSaving: boolean;
  timeError: string | null;
  onSave: () => void;
}

export function LiveTimeModal({
  isOpen,
  onClose,
  timeTarget,
  timeDraft,
  onTimeDraftChange,
  timeSaving,
  timeError,
  onSave,
}: LiveTimeModalProps) {
  if (!isOpen || !timeTarget) return null;

  return (
    <div className="fixed inset-0 z-60">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-16 sm:bottom-auto sm:rounded-3xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950">
              Cambiar tiempo de evaluación
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              Examen: <strong>{timeTarget.name}</strong>
            </p>
          </div>
          <IconButton
            onClick={onClose}
            className="h-9 w-9"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        {timeError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {timeError}
          </div>
        ) : null}

        <label className="mt-4 grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Minutos</span>
          <input
            value={timeDraft}
            onChange={(e) => onTimeDraftChange(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
            inputMode="numeric"
            className="h-10 rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            placeholder="60"
            disabled={timeSaving}
          />
        </label>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            disabled={timeSaving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={timeSaving}
            className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {timeSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
