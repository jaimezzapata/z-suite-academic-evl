"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import type { DriveWorkspaceRow } from "../types";

interface DriveDeleteModalProps {
  pendingWorkspaceDelete: DriveWorkspaceRow | null;
  workspaceDeletingId: string | null;
  workspaceDeleteError: string | null;
  onClose: () => void;
  onConfirm: (ws: DriveWorkspaceRow) => void;
}

export function DriveDeleteModal({
  pendingWorkspaceDelete,
  workspaceDeletingId,
  workspaceDeleteError,
  onClose,
  onConfirm,
}: DriveDeleteModalProps) {
  return (
    <AnimatePresence>
      {pendingWorkspaceDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => (workspaceDeletingId ? null : onClose())}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-950">Eliminar del panel</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Se quitará el registro local de Drive y, si está vinculado, también desaparecerá de carga horaria.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                disabled={!!workspaceDeletingId}
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4">
              {workspaceDeleteError ? (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {workspaceDeleteError}
                </div>
              ) : null}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-500">Estructura</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">
                  {pendingWorkspaceDelete.institution} · {pendingWorkspaceDelete.period} ·{" "}
                  {pendingWorkspaceDelete.campus} · {pendingWorkspaceDelete.groupName}
                </p>
                <p className="mt-2 text-xs font-semibold text-zinc-500">ID</p>
                <p className="mt-1 font-mono text-xs text-zinc-700">{pendingWorkspaceDelete.id}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={!!workspaceDeletingId}
                className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void onConfirm(pendingWorkspaceDelete)}
                disabled={workspaceDeletingId === pendingWorkspaceDelete.id}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {workspaceDeletingId === pendingWorkspaceDelete.id ? "Eliminando..." : "Eliminar del panel"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
