"use client";

import { AlertTriangle, X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import type { AttemptRow } from "../types";

interface LiveAnnulModalProps {
  isOpen: boolean;
  onClose: () => void;
  annulTarget: AttemptRow | null;
  annulDraft: string;
  onAnnulDraftChange: (value: string) => void;
  savingAttemptId: string | null;
  onConfirm: () => void;
}

export function LiveAnnulModal({
  isOpen,
  onClose,
  annulTarget,
  annulDraft,
  onAnnulDraftChange,
  savingAttemptId,
  onConfirm,
}: LiveAnnulModalProps) {
  if (!isOpen || !annulTarget) return null;

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
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Anular intento</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Escribe el motivo. Este quedará guardado en el resultado del estudiante.
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

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{annulTarget.studentFullName}</p>
              <p className="mt-1 text-xs text-amber-800">{annulTarget.email}</p>
            </div>
          </div>
        </div>

        <label className="mt-4 grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Motivo</span>
          <textarea
            value={annulDraft}
            onChange={(e) => onAnnulDraftChange(e.target.value)}
            className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            placeholder="Ej: Uso de celular / copia / cambio de pestañas repetido..."
          />
        </label>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={savingAttemptId === annulTarget.id}
            className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirmar anulación
          </button>
        </div>
      </div>
    </div>
  );
}
