"use client";

import { Sparkles } from "lucide-react";
import type { ReadmeBatchMetadataResult } from "../types";
import { ModalShell } from "./modal-shell";

interface BatchConfigModalProps {
  open: boolean;
  onClose: () => void;
  markdown: string;
  readmeBatchMetadata: ReadmeBatchMetadataResult;
  batchError: string | null;
  batchLoading: boolean;
  canGenerateBatch: boolean;
  onGenerateBatch: () => Promise<boolean>;
}

export function BatchConfigModal({
  open,
  onClose,
  markdown,
  readmeBatchMetadata,
  batchError,
  batchLoading,
  canGenerateBatch,
  onGenerateBatch,
}: BatchConfigModalProps) {
  return (
    <ModalShell
      open={open}
      title="Generar Batch JSON"
      subtitle="El JSON se construye únicamente desde los metadatos incrustados en el README."
      onClose={onClose}
    >
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        {!markdown.trim() ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            Primero genera un README (se usa como fuente del batch).
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          {readmeBatchMetadata.ok ? (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Materia</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{readmeBatchMetadata.value.subjectName}</p>
                  <p className="text-xs text-zinc-500">{readmeBatchMetadata.value.subjectId}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Grupo</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{readmeBatchMetadata.value.groupName}</p>
                  <p className="text-xs text-zinc-500">{readmeBatchMetadata.value.groupId}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Momento</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{readmeBatchMetadata.value.momentName}</p>
                  <p className="text-xs text-zinc-500">{readmeBatchMetadata.value.momentId}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Preguntas</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{readmeBatchMetadata.value.questionCount}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Tiempo</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{readmeBatchMetadata.value.timeLimitMinutes} min</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Escala</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{readmeBatchMetadata.value.gradingScale}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Tipos permitidos</p>
                <p className="mt-1 text-sm text-zinc-900">{readmeBatchMetadata.value.allowedQuestionTypes.join(", ")}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
              {readmeBatchMetadata.error}
            </div>
          )}

          {batchError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {batchError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await onGenerateBatch();
                if (ok) onClose();
              }}
              disabled={!canGenerateBatch}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {batchLoading ? "Generando..." : "Generar JSON"}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
