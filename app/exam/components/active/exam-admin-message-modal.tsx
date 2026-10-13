"use client";

import React from "react";
import { OctagonAlert } from "lucide-react";

type ExamAdminMessageModalProps = {
  adminMessage: string | null;
  adminMessageKey: string | null;
  dismissedAdminMessageKey: string | null;
  onDismissAdminMessage: () => void;
};

export function ExamAdminMessageModal({
  adminMessage,
  adminMessageKey,
  dismissedAdminMessageKey,
  onDismissAdminMessage,
}: ExamAdminMessageModalProps) {
  if (!adminMessage || !adminMessageKey || dismissedAdminMessageKey === adminMessageKey) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-70">
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 grid place-items-center px-4 py-10">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl">
          <div className="flex items-start gap-3 bg-rose-600 px-5 py-4 text-white">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15">
              <OctagonAlert className="h-5 w-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/90">
                Advertencia del docente
              </p>
              <p className="mt-1 text-base font-semibold tracking-tight">Debes confirmar para continuar</p>
            </div>
          </div>

          <div className="p-5">
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{adminMessage}</p>
            <div className="mt-5 flex items-center justify-end">
              <button
                type="button"
                onClick={onDismissAdminMessage}
                className="h-11 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
