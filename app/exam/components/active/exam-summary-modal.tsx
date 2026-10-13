"use client";

import React, { useState } from "react";
import { BadgeCheck, CheckCircle2, OctagonAlert, Save } from "lucide-react";
import type { SnapshotQuestion } from "@/types";

type ExamSummaryModalProps = {
  displayQuestions: SnapshotQuestion[];
  unansweredCount: number;
  hasAnswer: (q: SnapshotQuestion) => boolean;
  submitting: boolean;
  onSelectQuestionIndex: (index: number) => void;
  onClose: () => void;
  onSubmitAttempt: () => void;
};

export function ExamSummaryModal({
  displayQuestions,
  unansweredCount,
  hasAnswer,
  submitting,
  onSelectQuestionIndex,
  onClose,
  onSubmitAttempt,
}: ExamSummaryModalProps) {
  const [finalSubmitAccepted, setFinalSubmitAccepted] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  function handleFinalSubmit() {
    if (!finalSubmitAccepted) {
      setSummaryError("Debes activar la confirmación para poder enviar el examen.");
      return;
    }
    onSubmitAttempt();
  }

  return (
    <article className="mx-auto flex min-h-[60vh] w-full max-w-[94%] 2xl:max-w-[112rem] flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6 lg:max-w-[90%]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-950">Resumen final del intento</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Antes de enviar, revisa pendientes y confirma el envío definitivo.
          </p>
        </div>
        <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          Pendientes {unansweredCount}
        </div>
      </div>

      {unansweredCount > 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <OctagonAlert className="mt-0.5 h-5 w-5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Aún tienes preguntas pendientes</p>
            <p className="mt-1 text-xs text-amber-800">
              Puedes entrar a cualquier pregunta y completarla antes de finalizar el envío.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <BadgeCheck className="mt-0.5 h-5 w-5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Todo listo</p>
            <p className="mt-1 text-xs text-emerald-800">Todas las preguntas tienen respuesta registrada.</p>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {displayQuestions.map((q, idx) => {
          const answered = hasAnswer(q);
          return (
            <button
              key={q.questionId}
              type="button"
              onClick={() => {
                onSelectQuestionIndex(idx);
                onClose();
              }}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                answered
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              P{idx + 1} {answered ? "OK" : "Pend."}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setFinalSubmitAccepted((v) => !v)}
        className={`mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left ${
          finalSubmitAccepted ? "border-indigo-200 bg-indigo-50" : "border-zinc-200 bg-white"
        }`}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">Confirmo envío definitivo</p>
          <p className="truncate text-xs text-zinc-600">Al finalizar no podrás editar respuestas nuevamente.</p>
        </div>
        <CheckCircle2 className={`h-5 w-5 ${finalSubmitAccepted ? "text-indigo-600" : "text-zinc-300"}`} />
      </button>

      {!finalSubmitAccepted && summaryError ? (
        <p className="mt-2 text-xs font-semibold text-rose-700">{summaryError}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Volver a preguntas
        </button>
        <button
          type="button"
          onClick={handleFinalSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
        >
          <Save className="h-3.5 w-3.5" />
          Finalizar envío definitivo
        </button>
      </div>
    </article>
  );
}
