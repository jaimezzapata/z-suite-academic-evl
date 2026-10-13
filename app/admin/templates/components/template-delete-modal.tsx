"use client";

import React from "react";
import { Trash2, X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import type { ExamTemplateRow } from "../types";

type TemplateDeleteModalProps = {
  isOpen: boolean;
  target: ExamTemplateRow | null;
  confirmText: string;
  blockReason: string | null;
  deleting: boolean;
  onConfirmChange: (val: string) => void;
  onConfirmDelete: () => void;
  onClose: () => void;
};

export function TemplateDeleteModal({
  isOpen,
  target,
  confirmText,
  blockReason,
  deleting,
  onConfirmChange,
  onConfirmDelete,
  onClose,
}: TemplateDeleteModalProps) {
  if (!isOpen || !target) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === "ELIMINAR";
  const canDelete = !blockReason && isConfirmed && !deleting;

  return (
    <div className="fixed inset-0 z-50 animate-in fade-in-50 duration-150">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-2xs"
        aria-label="Cerrar"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
              Eliminar examen
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Esta acción es permanente y no se puede deshacer.
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

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="truncate text-sm font-semibold text-zinc-900">{target.name}</p>
          <p className="mt-1 truncate text-xs text-zinc-600">ID interno protegido</p>
        </div>

        {blockReason ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {blockReason}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Escribe <strong>ELIMINAR</strong> para confirmar.
          </div>
        )}

        <div className="mt-4 grid gap-2">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Confirmación</span>
            <input
              value={confirmText}
              onChange={(e) => onConfirmChange(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="ELIMINAR"
              disabled={!!blockReason || deleting}
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <IconButton
              onClick={onClose}
              className="h-10 w-10"
              aria-label="Cancelar"
              title="Cancelar"
              disabled={deleting}
            >
              <X className="h-4 w-4" />
            </IconButton>
            <IconButton
              variant="danger"
              onClick={onConfirmDelete}
              className="h-10 w-10"
              aria-label="Eliminar definitivamente"
              title={deleting ? "Eliminando..." : "Eliminar definitivamente"}
              disabled={!canDelete}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
