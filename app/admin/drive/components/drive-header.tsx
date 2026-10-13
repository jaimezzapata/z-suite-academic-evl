"use client";

import { FolderPlus } from "lucide-react";

interface DriveHeaderProps {
  onOpenCreate: () => void;
  error: string | null;
  workspaceSyncError: string | null;
}

export function DriveHeader({ onOpenCreate, error, workspaceSyncError }: DriveHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Estructuras Drive</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Crea, consulta y sincroniza las estructuras académicas generadas por tu Apps Script.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <FolderPlus className="h-4 w-4" />
            Crear estructura
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {workspaceSyncError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {workspaceSyncError}
        </div>
      ) : null}
    </div>
  );
}
