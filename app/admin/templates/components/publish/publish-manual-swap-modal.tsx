"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import type { PreviewQuestion } from "../../types";
import { getDifficultyBadge, getQuestionTypeLabel } from "./publish-utils";

type PublishManualSwapModalProps = {
  manualSwapIndex: number;
  swapSearchTerm: string;
  swapDifficultyFilter: string;
  filteredUnusedQuestions: PreviewQuestion[];
  onClose: () => void;
  onSearchTermChange: (term: string) => void;
  onDifficultyFilterChange: (filter: string) => void;
  onSelectReplacement: (candidate: PreviewQuestion) => void;
};

export function PublishManualSwapModal({
  manualSwapIndex,
  swapSearchTerm,
  swapDifficultyFilter,
  filteredUnusedQuestions,
  onClose,
  onSearchTermChange,
  onDifficultyFilterChange,
  onSelectReplacement,
}: PublishManualSwapModalProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-zinc-950">
            Reemplazar Pregunta #{manualSwapIndex + 1}
          </h3>
          <p className="text-xs text-zinc-500">
            Selecciona una pregunta disponible del banco para esta materia y momento académico.
          </p>
        </div>
        <IconButton onClick={onClose} className="h-8 w-8" aria-label="Cerrar selector">
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={swapSearchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Buscar por texto del enunciado..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-xs outline-none transition focus:border-zinc-400 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(["all", "easy", "medium", "hard"] as const).map((diff) => (
            <button
              key={diff}
              type="button"
              onClick={() => onDifficultyFilterChange(diff)}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                swapDifficultyFilter === diff
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {diff === "all" ? "Todas" : diff === "easy" ? "Fácil" : diff === "medium" ? "Media" : "Difícil"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {filteredUnusedQuestions.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            No se encontraron preguntas disponibles con los filtros actuales.
          </div>
        ) : (
          filteredUnusedQuestions.map((candidate) => {
            const diffBadge = getDifficultyBadge(candidate.difficulty);
            return (
              <div
                key={candidate.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3.5 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      {getQuestionTypeLabel(candidate.type)}
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${diffBadge.cls}`}>
                      {diffBadge.label}
                    </span>
                    <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      {candidate.points ?? 1} pt(s)
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-zinc-800">
                    {candidate.statement || "Sin enunciado"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectReplacement(candidate)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 transition"
                >
                  Seleccionar
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 flex justify-end border-t border-zinc-100 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
