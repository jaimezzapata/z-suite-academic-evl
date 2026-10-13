"use client";

import React from "react";
import { BookOpen, LayoutGrid, Timer } from "lucide-react";
import { FRAUD_FAIL_TOTAL_EVENTS, FRAUD_GRACE_EVENTS, FRAUD_PENALTY_PER_EVENT_0TO5 } from "@/lib/exam-grading";

type ExamActiveHeaderProps = {
  examName: string;
  documentationMarkdown: string;
  remainingFormatted: string;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  safeQuestionIndex: number;
  totalQuestions: number;
  answeredCount: number;
  progressPct: number;
  fraudPill: string;
  fraudTotalEvents: number;
  fraudPenaltyPreview0to5: number;
  fraudGraceRemaining: number;
  fraudPenalizableEvents: number;
  onOpenQuestionMap: () => void;
  onOpenDocumentation: () => void;
};

export function ExamActiveHeader({
  examName,
  documentationMarkdown,
  remainingFormatted,
  fraudTabSwitches,
  fraudClipboardAttempts,
  safeQuestionIndex,
  totalQuestions,
  answeredCount,
  progressPct,
  fraudPill,
  fraudTotalEvents,
  fraudPenaltyPreview0to5,
  fraudGraceRemaining,
  fraudPenalizableEvents,
  onOpenQuestionMap,
  onOpenDocumentation,
}: ExamActiveHeaderProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-xs sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate text-base font-semibold text-zinc-950 sm:text-lg">{examName}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
              <Timer className="h-3.5 w-3.5" />
              {remainingFormatted}
            </div>
            <div
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${fraudPill}`}
              title={`Total eventos: ${fraudTotalEvents}. Penalización: ${fraudPenaltyPreview0to5.toFixed(2)}.`}
            >
              <span>
                {fraudGraceRemaining > 0
                  ? `Cortesía restante ${fraudGraceRemaining}/${FRAUD_GRACE_EVENTS} • `
                  : `Penalizables ${fraudPenalizableEvents} • `}
                Fraude {fraudTotalEvents}/{FRAUD_FAIL_TOTAL_EVENTS}
              </span>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
              Pestaña {fraudTabSwitches}
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
              Copiar/Pegar {fraudClipboardAttempts}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              Pregunta {safeQuestionIndex + 1}/{Math.max(1, totalQuestions)} • {progressPct}%
            </div>
            <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              Respondidas {answeredCount}/{Math.max(1, totalQuestions)}
            </div>
            <button
              type="button"
              onClick={onOpenQuestionMap}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              title="Mapa de preguntas (Alt+M)"
            >
              <LayoutGrid className="h-4 w-4" />
              Mapa
            </button>
            <button
              type="button"
              onClick={onOpenDocumentation}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-gradient-to-r from-indigo-600 to-indigo-700 px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs hover:from-indigo-700 hover:to-indigo-800 disabled:from-zinc-400 disabled:to-zinc-500 disabled:border-zinc-300 disabled:opacity-80"
              title="Abrir documentación del examen (Alt + D)"
              disabled={!documentationMarkdown.trim()}
            >
              <BookOpen className="h-4 w-4" />
              <span>Ver documentación</span>
              {documentationMarkdown.trim() ? (
                <span className="hidden rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/90 sm:inline">
                  Alt + D
                </span>
              ) : null}
            </button>
          </div>

          <p className="text-xs text-zinc-600">
            {fraudGraceRemaining > 0
              ? `Cortesías disponibles: ${fraudGraceRemaining}. Luego se descuentan ${FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} c/u.`
              : `Cortesías agotadas. Descuento actual: -${fraudPenaltyPreview0to5.toFixed(2)}. Límite: ${FRAUD_FAIL_TOTAL_EVENTS}.`}
          </p>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
