"use client";

import React from "react";
import { Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type BankWipeModalProps = {
  isOpen: boolean;
  confirmText: string;
  onConfirmTextChange: (val: string) => void;
  wiping: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function BankWipeModal({
  isOpen,
  confirmText,
  onConfirmTextChange,
  wiping,
  error,
  onClose,
  onConfirm,
}: BankWipeModalProps) {
  if (!isOpen) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === "ELIMINAR";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          onClick={() => (wiping ? null : onClose())}
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
              <p className="text-sm font-semibold text-zinc-950">Borrar todo el banco</p>
              <p className="mt-1 text-sm text-zinc-600">
                Esto eliminará todas las preguntas de la colección questions.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60 transition"
              disabled={wiping}
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Acción irreversible. Se borrarán también las subcolecciones dentro de questions si existieran.
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Confirmación</span>
              <input
                value={confirmText}
                onChange={(e) => onConfirmTextChange(e.target.value)}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                placeholder="Escribe ELIMINAR"
                disabled={wiping}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={wiping}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={wiping || !isConfirmed}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              <Trash2 className="h-4 w-4" />
              {wiping ? "Eliminando..." : "Eliminar todo"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
