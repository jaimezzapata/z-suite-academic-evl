"use client";

import { Printer } from "lucide-react";
import type { ResultRow, WrongDetail } from "../types";
import { formatDate, fraudRiskLabel, toTextPreview } from "../services/results-service";

interface ResultDetailModalProps {
  selectedRow: ResultRow | null;
  selectedWrong: WrongDetail[];
  onClose: () => void;
  onExportPdf: (row: ResultRow) => void;
  exportingAttemptId: string | null;
  onDelete: (row: ResultRow) => void;
}

export function ResultDetailModal({
  selectedRow,
  selectedWrong,
  onClose,
  onExportPdf,
  exportingAttemptId,
  onDelete,
}: ResultDetailModalProps) {
  if (!selectedRow) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar detalle"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-5xl rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-y-8 sm:bottom-auto sm:rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Detalle del intento</h3>
            <p className="mt-1 text-sm text-zinc-600">
              {selectedRow.studentFullName} • {selectedRow.examName} • Código {selectedRow.examCode}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {selectedRow.documentId} • {selectedRow.email} • {formatDate(selectedRow.submittedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onExportPdf(selectedRow)}
              disabled={exportingAttemptId === selectedRow.id}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              <Printer className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => onDelete(selectedRow)}
              className="inline-flex h-9 items-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              Eliminar intento
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Nota 0-5</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums">
              {selectedRow.grade0to5.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Nota 0-50</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums">
              {selectedRow.grade0to50.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Malas</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-700 tabular-nums">
              {selectedRow.wrongCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Solo se detallan al abrir cada pregunta.</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Fraude</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums">
              {selectedRow.fraudTotal}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Riesgo: <span className="font-semibold text-zinc-800">{fraudRiskLabel(selectedRow.fraudTotal)}</span> •{" "}
              Pestaña {selectedRow.fraudTabSwitches} • Copiar/Pegar {selectedRow.fraudClipboardAttempts}
            </p>
          </div>
        </div>

        <div className="mt-4 max-h-[58vh] overflow-y-auto rounded-2xl border border-zinc-200">
          {selectedWrong.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {selectedWrong.map((d, idx) => (
                <details key={`${selectedRow.id}-${idx}`} className="group px-4 py-3">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-950">
                          {d.number ? `Pregunta ${d.number}` : `Pregunta ${idx + 1}`}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-600">
                          {toTextPreview(d.statement, 220)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 group-open:hidden">
                        Ver
                      </span>
                      <span className="hidden shrink-0 rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white group-open:inline-flex">
                        Ocultar
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Respuesta</p>
                      <p className="mt-1 text-sm text-zinc-900">{d.answer || "Sin respuesta"}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Motivo</p>
                      <p className="mt-1 text-sm text-zinc-900">{d.reason || "Sin motivo"}</p>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-emerald-700">
              Sin preguntas malas detectadas en este intento.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
