"use client";

import {
  Timer,
  OctagonAlert,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import type { PublishedExam } from "@/types";
import {
  FRAUD_FAIL_TOTAL_EVENTS,
  FRAUD_GRACE_EVENTS,
  FRAUD_PENALTY_PER_EVENT_0TO5,
} from "@/lib/exam-grading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface StepExamRulesProps {
  exam: PublishedExam;
  rulesAccepted: boolean;
  onToggleRulesAccepted: (accepted: boolean) => void;
  onStartAttempt: () => void;
  submitting: boolean;
  onBackToStudent: () => void;
}

export function StepExamRules({
  exam,
  rulesAccepted,
  onToggleRulesAccepted,
  onStartAttempt,
  submitting,
  onBackToStudent,
}: StepExamRulesProps) {
  const penaltyPerEvent0to50 = FRAUD_PENALTY_PER_EVENT_0TO5 * 10;

  return (
    <section className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-9 shadow-sm transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="min-w-0">
          <Badge variant="primary" size="sm" className="mb-2">
            Reglamento Académico
          </Badge>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl truncate">
            {exam.name}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Antes de iniciar el examen, lee con atención y confirma los términos.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/70 px-3.5 py-1 text-xs font-bold text-indigo-700 shrink-0">
          <Timer className="h-4 w-4" />
          <span>{exam.timeLimitMinutes} min</span>
        </div>
      </div>

      <div className="mt-6 space-y-4 text-sm text-slate-700">
        {/* Basic Exam Rules Box */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Condiciones de la prueba
            </h3>
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <li>
              Tiempo límite: <strong>{exam.timeLimitMinutes} minutos</strong> continuos.
            </li>
            <li>
              Al llegar el contador a 0, la prueba se <strong>enviará automáticamente</strong>.
            </li>
            <li>
              <strong>Intento único:</strong> registro validado por documento y correo.
            </li>
            <li>
              Prueba estrictamente <strong>individual</strong>.
            </li>
            <li>
              Al finalizar se generará tu reporte de nota y retroalimentación académica.
            </li>
          </ul>
        </div>

        {/* Fraud Protection Box */}
        {exam.fraudEnabled ? (
          <div className="rounded-2xl border border-rose-200/90 bg-rose-50/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <OctagonAlert className="h-4 w-4 text-rose-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Supervisión y control antifraude activo
              </h3>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-sky-200 bg-white p-3 shadow-2xs">
                <p className="font-bold text-sky-900">
                  {FRAUD_GRACE_EVENTS} cortesías iniciales
                </p>
                <p className="mt-1 text-slate-500 leading-normal">
                  Los primeros {FRAUD_GRACE_EVENTS} eventos incidentales no descuentan puntuación.
                </p>
                <p className="mt-2 font-bold text-sky-700">Penalización: 0.0</p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-white p-3 shadow-2xs">
                <p className="font-bold text-rose-900">Cambio de pestaña o ventana</p>
                <p className="mt-1 text-slate-500 leading-normal">
                  Superadas las cortesías, cada cambio resta puntaje de tu nota.
                </p>
                <p className="mt-2 font-bold text-rose-600">
                  -{FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} (escala 0-5)
                </p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-white p-3 shadow-2xs">
                <p className="font-bold text-rose-900">Copiar o pegar texto</p>
                <p className="mt-1 text-slate-500 leading-normal">
                  Los intentos de copiado o captura de portapapeles quedan registrados.
                </p>
                <p className="mt-2 font-bold text-rose-600">
                  -{FRAUD_PENALTY_PER_EVENT_0TO5.toFixed(1)} (escala 0-5)
                </p>
              </div>

              <div className="rounded-xl border border-rose-300 bg-rose-100/50 p-3 shadow-2xs">
                <p className="font-bold text-rose-950">Límite crítico ({FRAUD_FAIL_TOTAL_EVENTS} eventos)</p>
                <p className="mt-1 text-rose-800 leading-normal">
                  Alcanzar {FRAUD_FAIL_TOTAL_EVENTS} anomalías anula la prueba automáticamente.
                </p>
                <p className="mt-2 font-bold text-rose-700">Nota definitiva: 0.0</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4.5 flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-emerald-900">Modo formativo (sin penalización)</p>
              <p className="text-emerald-700 mt-0.5">
                Este examen no aplica deducciones por cambio de ventana o navegación externa.
              </p>
            </div>
          </div>
        )}

        {/* Confirmation Checkbox */}
        <label
          className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4.5 text-left transition-all ${
            rulesAccepted
              ? "border-emerald-300 bg-emerald-50/50 ring-2 ring-emerald-200/50"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <input
            type="checkbox"
            checked={rulesAccepted}
            onChange={(e) => onToggleRulesAccepted(e.target.checked)}
            className="mt-0.5 h-4.5 w-4.5 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">
              He leído, comprendo y acepto las reglas del examen
            </p>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Confirmo que realizaré la prueba de forma individual y acepto los términos de tiempo y supervisión académica.
            </p>
          </div>
          <CheckCircle2
            className={`h-5 w-5 shrink-0 transition-colors ${
              rulesAccepted ? "text-emerald-600" : "text-slate-300"
            }`}
          />
        </label>
      </div>

      {/* Footer Navigation */}
      <div className="mt-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
        <Button
          variant="outline"
          size="md"
          onClick={onBackToStudent}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          Atrás (Datos)
        </Button>

        <Button
          variant="primary"
          size="lg"
          onClick={onStartAttempt}
          disabled={!rulesAccepted || submitting}
          isLoading={submitting}
          rightIcon={<ArrowRight className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          {submitting ? "Iniciando..." : "Comenzar Examen"}
        </Button>
      </div>
    </section>
  );
}
