"use client";

import React from "react";
import {
  AlertCircle,
  BookOpen,
  Clock,
  Eye,
  FileText,
  Layers,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";
import type { ExamTemplateRow, PreviewQuestion } from "../types";
import { PublishQuestionCard } from "./publish/publish-question-card";
import { PublishManualSwapModal } from "./publish/publish-manual-swap-modal";

type TemplatePublishModalProps = {
  isOpen: boolean;
  publishTarget: ExamTemplateRow | null;
  publishing: boolean;
  previewLoading: boolean;
  previewError: string | null;
  namesById: Map<string, string>;
  eligiblePool: PreviewQuestion[];
  selectedQuestions: PreviewQuestion[];
  activeQuestionIndex: number;
  previewViewMode: "single" | "all";
  manualSwapIndex: number | null;
  swapSearchTerm: string;
  swapDifficultyFilter: string;
  showDocsPreview: boolean;
  filteredUnusedQuestions: PreviewQuestion[];
  remainingUnusedCount: number;
  onClose: () => void;
  onPublish: () => void;
  onReShuffleAll: () => void;
  onQuickSwap: (idx: number) => void;
  onSelectReplacement: (candidate: PreviewQuestion) => void;
  onActiveQuestionIndexChange: (idx: number) => void;
  onPreviewViewModeChange: (mode: "single" | "all") => void;
  onManualSwapIndexChange: (idx: number | null) => void;
  onSwapSearchTermChange: (term: string) => void;
  onSwapDifficultyFilterChange: (filter: string) => void;
  onShowDocsPreviewChange: (show: boolean) => void;
};

export function TemplatePublishModal({
  isOpen,
  publishTarget,
  publishing,
  previewLoading,
  previewError,
  namesById,
  eligiblePool,
  selectedQuestions,
  activeQuestionIndex,
  previewViewMode,
  manualSwapIndex,
  swapSearchTerm,
  swapDifficultyFilter,
  showDocsPreview,
  filteredUnusedQuestions,
  remainingUnusedCount,
  onClose,
  onPublish,
  onReShuffleAll,
  onQuickSwap,
  onSelectReplacement,
  onActiveQuestionIndexChange,
  onPreviewViewModeChange,
  onManualSwapIndexChange,
  onSwapSearchTermChange,
  onSwapDifficultyFilterChange,
  onShowDocsPreviewChange,
}: TemplatePublishModalProps) {
  if (!isOpen || !publishTarget) return null;

  const currentSingleQuestion = selectedQuestions[activeQuestionIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in-50 duration-150">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        aria-label="Cerrar"
      />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-zinc-100 bg-zinc-50/70 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                  <Eye className="h-3.5 w-3.5" />
                  Vista Previa de Examen
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  {publishTarget.institution}
                </span>
              </div>
              <h2 className="mt-1 truncate text-lg font-bold tracking-tight text-zinc-950 sm:text-xl">
                {publishTarget.name}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-600">
                Revisa las preguntas que integrarán el examen, cámbialas si lo requieres y confirma la publicación.
              </p>
            </div>
            <IconButton onClick={onClose} className="h-9 w-9 shrink-0" aria-label="Cerrar" title="Cerrar">
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          {/* Badges de resumen rápido */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
              <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
              <span className="font-medium text-zinc-900">
                {namesById.get(`subjects:${publishTarget.subjectId}`) ?? publishTarget.subjectId}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              <span>{publishTarget.timeLimitMinutes || 60} minutos</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
              <Layers className="h-3.5 w-3.5 text-zinc-500" />
              <span>{selectedQuestions.length} de {publishTarget.questionCount} preguntas</span>
            </div>
            {eligiblePool.length > 0 ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                <span>{remainingUnusedCount} en reserva en banco</span>
              </div>
            ) : null}

            {eligiblePool.length >= publishTarget.questionCount && !previewLoading ? (
              <button
                type="button"
                onClick={onReShuffleAll}
                disabled={publishing}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-100 transition disabled:opacity-50"
                title="Generar una nueva combinación aleatoria con preguntas del banco"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Re-mezclar todas
              </button>
            ) : null}
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {previewLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-9 w-9 animate-spin rounded-full border-3 border-zinc-900 border-t-transparent" />
              <p className="mt-4 text-sm font-semibold text-zinc-900">
                Cargando preguntas elegibles del banco...
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Filtrando por materia y momento académico correspondiente.
              </p>
            </div>
          ) : previewError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div>
                  <h3 className="font-semibold text-rose-950">Atención al generar la vista previa</h3>
                  <p className="mt-1 text-xs leading-relaxed text-rose-800 sm:text-sm">{previewError}</p>
                </div>
              </div>
            </div>
          ) : selectedQuestions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
              No hay preguntas seleccionadas para previsualizar.
            </div>
          ) : (
            <>
              {/* Selector y modo de vista */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5">
                <div className="flex max-w-full items-center gap-1.5 overflow-x-auto py-0.5">
                  {selectedQuestions.map((_, idx) => {
                    const isActive = previewViewMode === "single" && activeQuestionIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          onActiveQuestionIndexChange(idx);
                          onPreviewViewModeChange("single");
                        }}
                        className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
                          isActive
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => onPreviewViewModeChange("single")}
                    className={`rounded-lg px-2.5 py-1 font-medium transition ${
                      previewViewMode === "single"
                        ? "bg-zinc-900 text-white shadow-2xs"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Una a una
                  </button>
                  <button
                    type="button"
                    onClick={() => onPreviewViewModeChange("all")}
                    className={`rounded-lg px-2.5 py-1 font-medium transition ${
                      previewViewMode === "all"
                        ? "bg-zinc-900 text-white shadow-2xs"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Ver todas ({selectedQuestions.length})
                  </button>
                </div>
              </div>

              {/* Render de preguntas */}
              {previewViewMode === "single" && currentSingleQuestion ? (
                <PublishQuestionCard
                  question={currentSingleQuestion}
                  index={activeQuestionIndex}
                  totalCount={selectedQuestions.length}
                  isSingleMode={true}
                  canSwap={remainingUnusedCount > 0}
                  publishing={publishing}
                  onQuickSwap={onQuickSwap}
                  onOpenManualSwap={(idx) => {
                    onManualSwapIndexChange(idx);
                    onSwapSearchTermChange("");
                    onSwapDifficultyFilterChange("all");
                  }}
                  onNavigatePrev={() => onActiveQuestionIndexChange(Math.max(0, activeQuestionIndex - 1))}
                  onNavigateNext={() =>
                    onActiveQuestionIndexChange(Math.min(selectedQuestions.length - 1, activeQuestionIndex + 1))
                  }
                />
              ) : (
                <div className="space-y-4">
                  {selectedQuestions.map((q, idx) => (
                    <PublishQuestionCard
                      key={q.id || idx}
                      question={q}
                      index={idx}
                      isSingleMode={false}
                      canSwap={remainingUnusedCount > 0}
                      publishing={publishing}
                      onQuickSwap={onQuickSwap}
                      onOpenManualSwap={(i) => {
                        onManualSwapIndexChange(i);
                        onSwapSearchTermChange("");
                        onSwapDifficultyFilterChange("all");
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Documentación adjunta */}
              {publishTarget.documentationMarkdown ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-zinc-600" />
                      <span className="text-xs font-semibold text-zinc-900">
                        Documentación / Guía adjunta al examen
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onShowDocsPreviewChange(!showDocsPreview)}
                      className="text-xs font-semibold text-zinc-700 underline hover:text-zinc-950"
                    >
                      {showDocsPreview ? "Ocultar" : "Mostrar documento"}
                    </button>
                  </div>
                  {showDocsPreview ? (
                    <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4">
                      <MarkdownViewer
                        markdown={publishTarget.documentationMarkdown}
                        className="prose-sm max-w-none text-zinc-800"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Modal manual de reemplazo */}
        {manualSwapIndex !== null ? (
          <PublishManualSwapModal
            manualSwapIndex={manualSwapIndex}
            swapSearchTerm={swapSearchTerm}
            swapDifficultyFilter={swapDifficultyFilter}
            filteredUnusedQuestions={filteredUnusedQuestions}
            onClose={() => onManualSwapIndexChange(null)}
            onSearchTermChange={onSwapSearchTermChange}
            onDifficultyFilterChange={onSwapDifficultyFilterChange}
            onSelectReplacement={onSelectReplacement}
          />
        ) : null}

        {/* Footer del Modal */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/70 p-4 sm:p-5">
          <div className="text-xs text-zinc-500">
            {selectedQuestions.length > 0 ? (
              <span>
                Total: <strong className="font-semibold text-zinc-900">{selectedQuestions.length} preguntas</strong> listas para publicar.
              </span>
            ) : (
              <span>Configuración de examen</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-100 transition disabled:opacity-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={publishing || previewLoading || selectedQuestions.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-zinc-800 transition disabled:opacity-50"
            >
              <SendHorizontal className="h-4 w-4" />
              {publishing ? "Publicando examen..." : "Confirmar y Publicar Examen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
