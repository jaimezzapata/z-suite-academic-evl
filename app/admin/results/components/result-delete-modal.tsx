"use client";

import type { ResultRow } from "../types";

interface ResultDeleteModalProps {
  deleteTarget: ResultRow | null;
  deleting: boolean;
  deleteError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResultDeleteModal({
  deleteTarget,
  deleting,
  deleteError,
  onClose,
  onConfirm,
}: ResultDeleteModalProps) {
  if (!deleteTarget) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={() => (deleting ? null : onClose())}
        aria-label="Cerrar confirmación"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-y-16 sm:bottom-auto sm:rounded-3xl">
        <h3 className="text-lg font-semibold text-zinc-950">Eliminar intento</h3>
        <p className="mt-2 text-sm text-zinc-600">
          Esto eliminará definitivamente el intento presentado de{" "}
          <span className="font-semibold text-zinc-900">{deleteTarget.studentFullName}</span> en{" "}
          <span className="font-semibold text-zinc-900">{deleteTarget.examName}</span>. No se puede deshacer.
        </p>

        {deleteError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {deleteError}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
