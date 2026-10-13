"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, OctagonAlert } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import { DocumentationDrawer } from "@/app/ui/documentation-drawer";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";
import {
  FRAUD_FAIL_TOTAL_EVENTS,
  FRAUD_GRACE_EVENTS,
  FRAUD_PENALTY_PER_EVENT_0TO5,
  countPenalizableFraudEvents,
} from "@/lib/exam-grading";
import type { PublishedExam, SnapshotQuestion } from "@/types";
import { ExamActiveHeader } from "./active/exam-active-header";
import { ExamQuestionInput } from "./active/exam-question-input";
import { ExamQuestionMap } from "./active/exam-question-map";
import { ExamSummaryModal } from "./active/exam-summary-modal";
import { ExamAdminMessageModal } from "./active/exam-admin-message-modal";

export interface StepActiveExamProps {
  exam: PublishedExam;
  displayQuestions: SnapshotQuestion[];
  currentQuestionIndex: number;
  onSelectQuestionIndex: (index: number) => void;
  answers: Record<string, unknown>;
  onSetAnswer: (questionId: string, value: unknown) => void;
  remainingMs: number;
  formatRemaining: (ms: number) => string;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  graceUsedToastVisible: boolean;
  onDismissGraceToast: () => void;
  error: string | null;
  onClearError: () => void;
  submitting: boolean;
  onSubmitAttempt: () => void;
  adminMessage: string | null;
  adminMessageKey: string | null;
  dismissedAdminMessageKey: string | null;
  onDismissAdminMessage: () => void;
}

function normalizeStatementMarkdown(statement: string) {
  const raw = typeof statement === "string" ? statement : "";
  if (!raw.includes("```")) return raw;
  return raw
    .replace(/```(\w+)[ \t]+/g, "```$1\n")
    .replace(/([^\n])```/g, "$1\n```");
}

export function StepActiveExam({
  exam,
  displayQuestions,
  currentQuestionIndex,
  onSelectQuestionIndex,
  answers,
  onSetAnswer,
  remainingMs,
  formatRemaining,
  fraudTabSwitches,
  fraudClipboardAttempts,
  graceUsedToastVisible,
  onDismissGraceToast,
  error,
  onClearError,
  submitting,
  onSubmitAttempt,
  adminMessage,
  adminMessageKey,
  dismissedAdminMessageKey,
  onDismissAdminMessage,
}: StepActiveExamProps) {
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const [showExamSummary, setShowExamSummary] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const totalQuestions = displayQuestions.length;
  const safeQuestionIndex = Math.min(Math.max(currentQuestionIndex, 0), Math.max(0, totalQuestions - 1));
  const currentQuestion = totalQuestions > 0 ? displayQuestions[safeQuestionIndex] : null;

  function hasAnswer(q: SnapshotQuestion) {
    const val = answers[q.questionId];
    if (val === undefined || val === null) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (typeof val === "number") return true;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") {
      const keys = Object.keys(val as Record<string, unknown>);
      if (!keys.length) return false;
      return Object.values(val as Record<string, unknown>).some((v) => {
        if (typeof v === "number") return v > 0;
        if (typeof v === "string") return v.trim().length > 0;
        return Boolean(v);
      });
    }
    return false;
  }

  const answeredCount = displayQuestions.filter((q) => hasAnswer(q)).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const progressPct = totalQuestions > 0 ? Math.round(((safeQuestionIndex + 1) / totalQuestions) * 100) : 0;

  // Cálculo de fraude y semáforo visual
  const fraudTotalEvents = fraudTabSwitches + fraudClipboardAttempts;
  const fraudPenalizableEvents = countPenalizableFraudEvents(fraudTotalEvents, FRAUD_GRACE_EVENTS);
  const fraudGraceRemaining = Math.max(0, FRAUD_GRACE_EVENTS - fraudTotalEvents);
  const fraudPenaltyPreview0to5 = Number((fraudPenalizableEvents * FRAUD_PENALTY_PER_EVENT_0TO5).toFixed(2));

  const fraudTone =
    fraudTotalEvents >= FRAUD_FAIL_TOTAL_EVENTS
      ? "red"
      : fraudPenalizableEvents >= 6
        ? "orange"
        : fraudPenalizableEvents >= 3
          ? "yellow"
          : fraudGraceRemaining > 0
            ? "blue"
            : "green";

  const fraudPill =
    fraudTone === "red"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : fraudTone === "orange"
        ? "border-orange-200 bg-orange-50 text-orange-800"
        : fraudTone === "yellow"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : fraudTone === "blue"
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <section className="mx-auto flex w-full max-w-[95%] 2xl:max-w-[120rem] flex-1 flex-col justify-center gap-4 lg:max-w-[92%]">
      {/* Toast de error flotante */}
      {error ? (
        <div className="fixed inset-x-4 bottom-4 z-60 mx-auto w-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 whitespace-pre-wrap">{error}</p>
            <button
              type="button"
              onClick={onClearError}
              className="shrink-0 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {/* Toast de advertencia de cortesías de fraude agotadas */}
      {graceUsedToastVisible && exam.fraudEnabled !== false ? (
        <div className="fixed inset-x-4 top-4 z-60 mx-auto w-auto max-w-2xl animate-[fadeIn_.2s_ease-out] rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-xl ring-1 ring-amber-200">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/50">
              <OctagonAlert className="h-5 w-5 text-amber-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold tracking-tight text-amber-950">
                Se agotaron tus {FRAUD_GRACE_EVENTS} cortesías
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                A partir de este momento, cada cambio de pestaña o intento de copiar/pegar genera penalización (
                <span className="font-semibold">-{FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} en escala 0-5 por evento</span>).
                Si alcanzas los {FRAUD_FAIL_TOTAL_EVENTS} eventos totales, tu examen se anula automáticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissGraceToast}
              className="shrink-0 rounded-lg border border-amber-300 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-white"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}

      {/* Header superior de examen */}
      <ExamActiveHeader
        examName={exam.name}
        documentationMarkdown={exam.documentationMarkdown}
        remainingFormatted={formatRemaining(remainingMs)}
        fraudTabSwitches={fraudTabSwitches}
        fraudClipboardAttempts={fraudClipboardAttempts}
        safeQuestionIndex={safeQuestionIndex}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        progressPct={progressPct}
        fraudPill={fraudPill}
        fraudTotalEvents={fraudTotalEvents}
        fraudPenaltyPreview0to5={fraudPenaltyPreview0to5}
        fraudGraceRemaining={fraudGraceRemaining}
        fraudPenalizableEvents={fraudPenalizableEvents}
        onOpenQuestionMap={() => {
          setShowExamSummary(false);
          setShowQuestionMap(true);
        }}
        onOpenDocumentation={() => setDocOpen(true)}
      />

      {/* Modal de mensaje del docente */}
      <ExamAdminMessageModal
        adminMessage={adminMessage}
        adminMessageKey={adminMessageKey}
        dismissedAdminMessageKey={dismissedAdminMessageKey}
        onDismissAdminMessage={onDismissAdminMessage}
      />

      {/* Drawer de documentación */}
      <DocumentationDrawer
        open={docOpen}
        title="Documentación"
        markdown={exam.documentationMarkdown}
        onClose={() => setDocOpen(false)}
      />

      {/* Overlay Mapa de preguntas */}
      {showQuestionMap ? (
        <ExamQuestionMap
          displayQuestions={displayQuestions}
          safeQuestionIndex={safeQuestionIndex}
          hasAnswer={hasAnswer}
          onSelectQuestionIndex={onSelectQuestionIndex}
          onClose={() => setShowQuestionMap(false)}
        />
      ) : null}

      {/* Vista principal de pregunta activa */}
      {!showExamSummary && !showQuestionMap && currentQuestion ? (
        <article className="mx-auto flex min-h-[60vh] w-full max-w-[94%] 2xl:max-w-[112rem] flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6 lg:max-w-[90%]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-zinc-500">
                Pregunta {safeQuestionIndex + 1} de {totalQuestions}
              </p>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                  Respondidas {answeredCount}/{totalQuestions}
                </div>
              </div>
            </div>

            <div className="mt-4">
              {currentQuestion.type === "puzzle_cloze" && currentQuestion.statement.includes("{{slot_") ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 text-sm font-semibold text-indigo-950 sm:text-base">
                  Completa los espacios en blanco del siguiente enunciado seleccionando la opción correcta:
                </div>
              ) : (
                <MarkdownViewer
                  markdown={normalizeStatementMarkdown(currentQuestion.statement)}
                  idPrefix={`exam-q-${currentQuestion.questionId}`}
                  className="space-y-4 text-[15px] leading-snug text-zinc-950 sm:text-[20px]"
                />
              )}
            </div>

            <div className="mt-5">
              <ExamQuestionInput
                question={currentQuestion}
                currentAnswer={answers[currentQuestion.questionId]}
                onSetAnswer={onSetAnswer}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <IconButton
              onClick={() => onSelectQuestionIndex(Math.max(0, safeQuestionIndex - 1))}
              className="h-10 w-10"
              aria-label="Pregunta anterior"
              title="Pregunta anterior"
              disabled={safeQuestionIndex === 0}
            >
              <ArrowLeft className="h-4 w-4" />
            </IconButton>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQuestionMap(true)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                title="Mapa de preguntas (Alt+M)"
              >
                Ir a...
              </button>

              {safeQuestionIndex < totalQuestions - 1 ? (
                <IconButton
                  variant="primary"
                  onClick={() => onSelectQuestionIndex(Math.min(totalQuestions - 1, safeQuestionIndex + 1))}
                  className="h-10 w-10"
                  aria-label="Siguiente pregunta"
                  title="Siguiente pregunta"
                >
                  <ArrowRight className="h-4 w-4" />
                </IconButton>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowQuestionMap(false);
                    setShowExamSummary(true);
                  }}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                >
                  Revisar y finalizar
                </button>
              )}
            </div>
          </div>
        </article>
      ) : null}

      {/* Resumen final previo a enviar */}
      {showExamSummary ? (
        <ExamSummaryModal
          displayQuestions={displayQuestions}
          unansweredCount={unansweredCount}
          hasAnswer={hasAnswer}
          submitting={submitting}
          onSelectQuestionIndex={onSelectQuestionIndex}
          onClose={() => setShowExamSummary(false)}
          onSubmitAttempt={onSubmitAttempt}
        />
      ) : null}
    </section>
  );
}
