"use client";

import { Clock4, MessageSquareText, X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import type { PublishedExamRow } from "../types";

interface LiveExamsTableViewProps {
  filtered: PublishedExamRow[];
  closingId: string | null;
  onOpenAttempts: (row: PublishedExamRow) => void;
  onOpenTime: (row: PublishedExamRow) => void;
  onCloseExam: (row: PublishedExamRow) => void;
}

export function LiveExamsTableView({
  filtered,
  closingId,
  onOpenAttempts,
  onOpenTime,
  onCloseExam,
}: LiveExamsTableViewProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="grid grid-cols-[1.5fr_0.8fr_0.6fr_0.7fr_auto] gap-0 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
        <div>Examen</div>
        <div>Código</div>
        <div>Intentos</div>
        <div>Tiempo</div>
        <div className="text-right">Acciones</div>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {filtered.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1.5fr_0.8fr_0.6fr_0.7fr_auto] items-center gap-0 border-b border-zinc-100 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-950">{row.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{row.questionCount} preguntas</p>
            </div>
            <div className="text-sm font-semibold tracking-[0.25em] text-zinc-900">{row.accessCode}</div>
            <div className="text-sm font-semibold text-zinc-900">—</div>
            <div className="text-sm text-zinc-700">{row.timeLimitMinutes} min</div>
            <div className="flex items-center justify-end gap-2">
              <IconButton
                onClick={() => onOpenTime(row)}
                disabled={closingId === row.id}
                className="h-8 w-8"
                aria-label="Cambiar tiempo"
                title="Cambiar tiempo"
              >
                <Clock4 className="h-4 w-4" />
              </IconButton>
              <IconButton
                onClick={() => onOpenAttempts(row)}
                disabled={closingId === row.id}
                className="h-8 w-8"
                aria-label="Abrir estudiantes"
                title="Abrir estudiantes"
              >
                <MessageSquareText className="h-4 w-4" />
              </IconButton>
              <IconButton
                variant="danger"
                onClick={() => onCloseExam(row)}
                disabled={closingId === row.id}
                className="h-8 w-8"
                aria-label="Cerrar examen"
                title="Cerrar examen"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
