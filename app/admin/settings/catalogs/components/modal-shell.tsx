"use client";

import { X } from "lucide-react";

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalShell({ title, onClose, children }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-zinc-950">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
