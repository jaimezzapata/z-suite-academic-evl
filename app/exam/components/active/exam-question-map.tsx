"use client";

import React from "react";
import type { SnapshotQuestion } from "@/types";

type ExamQuestionMapProps = {
  displayQuestions: SnapshotQuestion[];
  safeQuestionIndex: number;
  hasAnswer: (q: SnapshotQuestion) => boolean;
  onSelectQuestionIndex: (index: number) => void;
  onClose: () => void;
};

export function ExamQuestionMap({
  displayQuestions,
  safeQuestionIndex,
  hasAnswer,
  onSelectQuestionIndex,
  onClose,
}: ExamQuestionMapProps) {
  return (
    <article className="mx-auto flex min-h-[60vh] w-full max-w-[94%] 2xl:max-w-[112rem] flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6 lg:max-w-[90%]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-950">Mapa de preguntas</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Selecciona una pregunta para ir directamente. Atajo: <strong>Alt + M</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Cerrar
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
        {displayQuestions.map((q, idx) => {
          const answered = hasAnswer(q);
          const isCurrent = idx === safeQuestionIndex;
          return (
            <button
              key={q.questionId}
              type="button"
              onClick={() => {
                onSelectQuestionIndex(idx);
                onClose();
              }}
              className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                isCurrent
                  ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                  : answered
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
              }`}
              title={answered ? "Respondida" : "Pendiente"}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </article>
  );
}
