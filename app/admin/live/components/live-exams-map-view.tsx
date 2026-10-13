"use client";

import { Clock4, KeyRound, MessageSquareText, X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import type { PublishedExamRow } from "../types";
import { LiveQuickCodeBar } from "./live-quick-code-bar";

interface LiveExamsMapViewProps {
  filtered: PublishedExamRow[];
  closingId: string | null;
  onOpenAttempts: (row: PublishedExamRow) => void;
  onOpenTime: (row: PublishedExamRow) => void;
  onCloseExam: (row: PublishedExamRow) => void;
  // Quick Code props
  quickCode: string;
  onQuickCodeChange: (value: string) => void;
  quickCodeError: string | null;
  quickCodeLoading: boolean;
  onOpenByQuickCode: () => void;
  onClearQuickCode: () => void;
  quickSuggestions: PublishedExamRow[];
  onSelectSuggestion: (row: PublishedExamRow) => void;
}

export function LiveExamsMapView({
  filtered,
  closingId,
  onOpenAttempts,
  onOpenTime,
  onCloseExam,
  quickCode,
  onQuickCodeChange,
  quickCodeError,
  quickCodeLoading,
  onOpenByQuickCode,
  onClearQuickCode,
  quickSuggestions,
  onSelectSuggestion,
}: LiveExamsMapViewProps) {
  return (
    <div className="space-y-3">
      <LiveQuickCodeBar
        quickCode={quickCode}
        onQuickCodeChange={onQuickCodeChange}
        quickCodeError={quickCodeError}
        quickCodeLoading={quickCodeLoading}
        onOpenByQuickCode={onOpenByQuickCode}
        onClearQuickCode={onClearQuickCode}
        quickSuggestions={quickSuggestions}
        onSelectSuggestion={onSelectSuggestion}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpenAttempts(row)}
            className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-950">{row.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {row.questionCount} preguntas • {row.timeLimitMinutes} min
                </p>
              </div>
              <div className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                Intentos
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Código</p>
                <p className="text-xl font-semibold tracking-[0.25em] text-zinc-900">{row.accessCode}</p>
              </div>
              <KeyRound className="h-5 w-5 text-zinc-500" />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Publicado
              </span>
              <div className="flex items-center gap-2">
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTime(row);
                  }}
                  disabled={closingId === row.id}
                  className="h-8 w-8"
                  aria-label="Cambiar tiempo"
                  title="Cambiar tiempo"
                >
                  <Clock4 className="h-4 w-4" />
                </IconButton>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAttempts(row);
                  }}
                  disabled={closingId === row.id}
                  className="h-8 w-8"
                  aria-label="Abrir estudiantes"
                  title="Abrir estudiantes"
                >
                  <MessageSquareText className="h-4 w-4" />
                </IconButton>
                <IconButton
                  variant="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseExam(row);
                  }}
                  disabled={closingId === row.id}
                  className="h-8 w-8"
                  aria-label="Cerrar examen"
                  title="Cerrar examen"
                >
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
