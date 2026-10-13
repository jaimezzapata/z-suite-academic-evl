"use client";

import {
  Award,
  Clock,
  Lock,
  LockKeyhole,
  OctagonAlert,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import type { SnapshotQuestion } from "@/types";
import type { MultipleChoiceBreakdown } from "@/lib/exam-grading";
import { FRAUD_FAIL_TOTAL_EVENTS } from "@/lib/exam-grading";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";

export interface ExamResultData {
  score5: number;
  score50: number;
  score5Raw: number;
  score50Raw: number;
  earned: number;
  total: number;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  fraudPenalty0to5: number;
  fraudForcedFail: boolean;
  perQuestion?: Array<{
    questionId: string;
    earned: number;
    points: number;
    fullyCorrect: boolean;
    ratio: number;
    multipleChoice?: MultipleChoiceBreakdown | null;
  }>;
}

export interface StepExamResultProps {
  examName: string;
  result: ExamResultData;
  resultsReviewBlocked: boolean;
  resultsReviewBlockReason: string | null;
  resultsReviewRemainingMs: number;
  reviewTotalMs: number;
  formatReviewClock: (ms: number) => string;
  questionOrder: string[];
  displayQuestions: SnapshotQuestion[];
  openQuestionIds: Set<string>;
  onToggleQuestion: (id: string) => void;
  onOpenAll: () => void;
  onCloseAll: () => void;
  answers: Record<string, unknown>;
}

export function StepExamResult({
  examName,
  result,
  resultsReviewBlocked,
  resultsReviewBlockReason,
  resultsReviewRemainingMs,
  reviewTotalMs,
  formatReviewClock,
  questionOrder,
  displayQuestions,
  openQuestionIds,
  onToggleQuestion,
  onOpenAll,
  onCloseAll,
  answers,
}: StepExamResultProps) {
  const resultStatus = result.fraudForcedFail
    ? "fraud"
    : result.score5 >= 3
      ? "pass"
      : result.score5 >= 2
        ? "recovery"
        : "fail";

  return (
    <section className="select-none mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm transition-all duration-300">
      {/* ======= Modal emergente de bloqueo por intento de copia ======= */}
      {resultsReviewBlocked && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl">
            <div className="bg-rose-600 px-6 py-6 text-white">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold tracking-tight">
                    Vista de respuestas protegida
                  </h2>
                  <p className="mt-1 text-sm text-white/85">
                    El detalle de preguntas se cerró por políticas de seguridad del banco.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 px-6 py-6 text-sm text-slate-700">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">Motivo del cierre</p>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {resultsReviewBlockReason === "timeout"
                      ? "Agotaste los 2 minutos establecidos para revisar las preguntas."
                      : resultsReviewBlockReason === "screenshot"
                        ? "Se detectó un atajo de captura de pantalla."
                        : resultsReviewBlockReason === "devtools"
                          ? "Se detectó intento de abrir herramientas de desarrollador."
                          : "Acción de copiado, atajo no permitido o menú contextual detectado."}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-indigo-900">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Tu calificación está a salvo</p>
                <p className="mt-1 text-xs sm:text-sm text-indigo-800/90 leading-relaxed">
                  Esta acción <strong>no altera tu nota</strong>. Tu calificación definitiva de{" "}
                  <strong>{result.score5.toFixed(2)}</strong> sobre 5.0 ya fue registrada en el sistema.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======= Barra countdown: solo si no está bloqueado ======= */}
      {!resultsReviewBlocked && (
        <div
          className={`border-b transition-colors ${
            resultsReviewRemainingMs <= 30_000
              ? "border-rose-200 bg-rose-50"
              : "border-indigo-100 bg-indigo-50/70"
          }`}
        >
          <div className="flex flex-wrap items-center gap-3 px-6 py-3">
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold ${
                resultsReviewRemainingMs <= 30_000
                  ? "bg-rose-600 text-white shadow-xs animate-pulse"
                  : "bg-white text-indigo-800 border border-indigo-200 shadow-xs"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums tracking-tight">
                {formatReviewClock(resultsReviewRemainingMs)}
              </span>
              <span className="font-normal opacity-80">restantes</span>
            </div>
            <p className="text-xs text-slate-600 sm:text-sm">
              Cuentas con <strong className="text-slate-900">2 minutos</strong> para revisar tus aciertos. Después la vista detallada se cerrará automáticamente.
            </p>
          </div>
          <div className="h-1 w-full bg-white/40">
            <div
              className={`h-full transition-all duration-300 ease-linear ${
                resultsReviewRemainingMs <= 30_000 ? "bg-rose-500" : "bg-indigo-600"
              }`}
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, (resultsReviewRemainingMs / reviewTotalMs) * 100),
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Scorecard Header */}
      <div className="bg-indigo-600 px-6 sm:px-8 py-7 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
              Evaluación Finalizada
            </p>
            <h2 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {examName}
            </h2>
          </div>
          <div
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ${
              resultStatus === "pass"
                ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-300/40"
                : resultStatus === "recovery"
                  ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-300/40"
                  : "bg-rose-500/20 text-rose-100 ring-1 ring-rose-300/40"
            }`}
          >
            {resultStatus === "pass"
              ? "Aprobado"
              : resultStatus === "recovery"
                ? "Recuperación"
                : resultStatus === "fraud"
                  ? "Fraude"
                  : "Reprobado"}
          </div>
        </div>

        {/* Score Metrics */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-4 border border-white/10 backdrop-blur-xs">
            <p className="text-xs font-semibold text-indigo-100">Nota definitiva (0–5)</p>
            <p className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight">
              {result.score5.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 border border-white/10 backdrop-blur-xs">
            <p className="text-xs font-semibold text-indigo-100">Aciertos obtenidos</p>
            <p className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight">
              {result.earned.toFixed(0)} / {result.total.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="space-y-6 px-6 sm:px-8 py-7">
        {/* Status Alert Banner */}
        {resultStatus === "fraud" ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4.5 text-rose-900">
            <XCircle className="mt-0.5 h-5 w-5 text-rose-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Examen anulado por límite de fraude</p>
              <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                Se alcanzó el límite crítico de {FRAUD_FAIL_TOTAL_EVENTS} eventos de fraude registrados durante el intento.
              </p>
            </div>
          </div>
        ) : resultStatus === "pass" ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4.5 text-emerald-900">
            <Award className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Aprobado satisfactoriamente</p>
              <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                Has alcanzado una nota igual o superior a 3.0. Tu registro ha sido almacenado de manera definitiva.
              </p>
            </div>
          </div>
        ) : resultStatus === "recovery" ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4.5 text-amber-900">
            <OctagonAlert className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Rango de recuperación</p>
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                Tu nota se encuentra entre 2.0 y 2.9. Consulta con tu docente para el proceso de recuperación académica.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4.5 text-rose-900">
            <OctagonAlert className="mt-0.5 h-5 w-5 text-rose-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Prueba reprobada</p>
              <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                Tu nota definitiva es inferior a 2.0.
              </p>
            </div>
          </div>
        )}

        {/* Detailed Question Review */}
        {!resultsReviewBlocked && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Revisión por pregunta
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Despliega cada ítem para analizar las opciones y su ponderación.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onOpenAll}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Abrir todas
                </button>
                <button
                  type="button"
                  onClick={onCloseAll}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cerrar todas
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {displayQuestions.map((q, idx) => {
                const detail = result.perQuestion?.find((p) => p.questionId === q.questionId);
                const open = openQuestionIds.has(q.questionId);
                const earned = detail?.earned ?? 0;
                const points = detail?.points ?? q.points;
                const ratio = detail?.ratio ?? 0;
                const pct = Math.round(ratio * 100);

                const pillBadge =
                  ratio >= 1
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : ratio > 0
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-rose-200 bg-rose-50 text-rose-800";

                return (
                  <div key={q.questionId}>
                    <button
                      type="button"
                      onClick={() => onToggleQuestion(q.questionId)}
                      className="flex w-full items-start gap-4 px-6 py-4.5 text-left hover:bg-slate-50/70 transition-colors"
                    >
                      <div className={`mt-0.5 rounded-xl border px-2.5 py-0.5 text-xs font-bold ${pillBadge}`}>
                        P{idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                            {q.statement}
                          </p>
                          <span className="text-xs font-bold text-slate-400 shrink-0">
                            {open ? "−" : "+"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold uppercase text-[10px] text-slate-700">
                            {q.type}
                          </span>
                          <span>
                            Puntaje:{" "}
                            <strong className="text-slate-800">
                              {earned.toFixed(2)} / {points.toFixed(2)}
                            </strong>
                          </span>
                          <span>
                            Rendimiento: <strong className="text-slate-800">{pct}%</strong>
                          </span>
                        </div>
                      </div>
                    </button>

                    {open && (
                      <div className="space-y-4 border-t border-slate-100 bg-slate-50/40 px-6 py-5">
                        <MarkdownViewer
                          markdown={q.statement}
                          className="prose-sm max-w-none text-slate-800"
                        />

                        {Array.isArray(q.options) && q.options.length > 0 && (
                          <ul className="space-y-2 mt-3">
                            {q.options.map((o) => {
                              const studentAns = answers[q.questionId];
                              const wasSelected = Array.isArray(studentAns)
                                ? studentAns.map(String).includes(o.id)
                                : studentAns === o.id;
                              const isCorrect = Boolean(o.isCorrect);

                              let badgeStyle = "border-slate-200 bg-white text-slate-700";
                              if (wasSelected && isCorrect) {
                                badgeStyle = "border-emerald-300 bg-emerald-50 text-emerald-950 font-medium";
                              } else if (wasSelected && !isCorrect) {
                                badgeStyle = "border-rose-300 bg-rose-50 text-rose-950";
                              } else if (!wasSelected && isCorrect) {
                                badgeStyle = "border-sky-300 bg-sky-50 text-sky-950 font-medium";
                              }

                              return (
                                <li key={o.id} className={`rounded-xl border p-3 text-xs sm:text-sm ${badgeStyle}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <span>{o.text}</span>
                                    <div className="flex items-center gap-1.5 shrink-0 text-xs">
                                      {isCorrect && (
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 text-[10px]">
                                          Correcta
                                        </span>
                                      )}
                                      {wasSelected && (
                                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-bold text-indigo-800 text-[10px]">
                                          Tu selección
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Formulas & Calculations summary card */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Desglose de cálculo
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">Nota bruta</span>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {result.score5Raw.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">Deducción fraude</span>
                <p className="mt-1 text-base font-bold text-rose-600">
                  -{result.fraudPenalty0to5.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Registro antifraude
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">Cambios de pestaña</span>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {result.fraudTabSwitches}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">Copiar / Pegar</span>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {result.fraudClipboardAttempts}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
