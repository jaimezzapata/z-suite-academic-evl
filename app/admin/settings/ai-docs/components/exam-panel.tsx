"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Layers,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";
import type { CatalogItem, ExamPipelineFormData } from "../types";

type ExamPanelProps = {
  examForm: ExamPipelineFormData;
  markdown: string;
  subjects: CatalogItem[];
  groups: CatalogItem[];
  fichas: CatalogItem[];
  moments: CatalogItem[];
  sites: CatalogItem[];
  shifts: CatalogItem[];
  creatingExam: boolean;
  examResult: { templateId: string; name: string } | null;
  examError: string | null;
  onUpdateExamField: <K extends keyof ExamPipelineFormData>(key: K, value: ExamPipelineFormData[K]) => void;
  onCreateExam: () => Promise<boolean>;
  onGoBackToQuestions: () => void;
};

export function ExamPanel({
  examForm,
  markdown,
  subjects,
  groups,
  fichas,
  moments,
  sites,
  shifts,
  creatingExam,
  examResult,
  examError,
  onUpdateExamField,
  onCreateExam,
  onGoBackToQuestions,
}: ExamPanelProps) {
  const [showDocPreview, setShowDocPreview] = useState(false);

  const activeSubjectName = subjects.find((s) => s.id === examForm.subjectId)?.name ?? examForm.subjectId;
  const isSena = examForm.institution === "SENA";

  return (
    <div className="space-y-5">
      {/* Tarjeta de configuración del examen */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                Paso 3 de 3
              </span>
              <h2 className="text-base font-bold text-zinc-950">
                Creación y Vinculación del Examen
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Crea la plantilla del examen con la documentación del temario adjunta automáticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={onGoBackToQuestions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Preguntas (Paso 2)
          </button>
        </div>

        {/* Resumen del contexto heredado */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
            <span className="font-semibold text-zinc-900">Materia:</span>
            <span>{activeSubjectName || "No seleccionada"}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
            <Layers className="h-3.5 w-3.5 text-zinc-500" />
            <span>{examForm.questionCount} preguntas requeridas</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
            <span>{examForm.timeLimitMinutes} min límite</span>
          </div>

          {markdown.trim() ? (
            <button
              type="button"
              onClick={() => setShowDocPreview(!showDocPreview)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{showDocPreview ? "Ocultar guía adjunta" : "Ver guía adjunta"}</span>
            </button>
          ) : null}
        </div>

        {/* Previsualización colapsable de la guía adjunta */}
        {showDocPreview && markdown.trim() ? (
          <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Guía / Documentación que verá el estudiante:
            </p>
            <MarkdownViewer markdown={markdown} className="prose-sm max-w-none text-zinc-800" />
          </div>
        ) : null}

        {/* Formulario de parámetros del examen */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-700">Institución</label>
            <select
              value={examForm.institution}
              onChange={(e) => onUpdateExamField("institution", e.target.value as "CESDE" | "SENA")}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            >
              <option value="CESDE">CESDE</option>
              <option value="SENA">SENA</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Materia</label>
            <select
              value={examForm.subjectId}
              onChange={(e) => onUpdateExamField("subjectId", e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            >
              <option value="">Selecciona materia...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">
              {isSena ? "Ficha" : "Grupo"}
            </label>
            <select
              value={examForm.groupId}
              onChange={(e) => onUpdateExamField("groupId", e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            >
              <option value="">Selecciona {isSena ? "ficha" : "grupo"}...</option>
              {(isSena ? fichas : groups).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Momento Académico</label>
            <select
              value={examForm.momentId}
              onChange={(e) => onUpdateExamField("momentId", e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            >
              <option value="">Selecciona momento...</option>
              {moments.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Sede</label>
            <select
              value={examForm.siteId}
              onChange={(e) => onUpdateExamField("siteId", e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            >
              <option value="">Selecciona sede...</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Jornada</label>
            <select
              value={examForm.shiftId}
              onChange={(e) => onUpdateExamField("shiftId", e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            >
              <option value="">Selecciona jornada...</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Cantidad de Preguntas</label>
            <input
              type="number"
              min={1}
              max={200}
              value={examForm.questionCount}
              onChange={(e) => onUpdateExamField("questionCount", Number(e.target.value || 45))}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Tiempo Límite (minutos)</label>
            <input
              type="number"
              min={5}
              max={240}
              value={examForm.timeLimitMinutes}
              onChange={(e) => onUpdateExamField("timeLimitMinutes", Number(e.target.value || 60))}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            />
          </div>

          <div className="flex items-center pt-6">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={examForm.fraudEnabled}
                onChange={(e) => onUpdateExamField("fraudEnabled", e.target.checked)}
                className="h-4 w-4 rounded text-zinc-900 focus:ring-zinc-900"
              />
              Control anti-fraude activado
            </label>
          </div>
        </div>

        {examError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {examError}
          </div>
        ) : null}

        {examResult ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    ¡Plantilla de Examen Creada Exitosamente!
                  </h4>
                  <p className="text-xs text-emerald-800">
                    {examResult.name} (ID: {examResult.templateId})
                  </p>
                </div>
              </div>
              <Link
                href="/admin/templates"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700"
              >
                Ver en Gestor de Exámenes
              </Link>
            </div>
          </div>
        ) : null}

        {/* Botón de acción final */}
        <div className="mt-6 flex items-center justify-end border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={() => void onCreateExam()}
            disabled={creatingExam || !examForm.subjectId || !examForm.groupId || !examForm.siteId}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            <SendHorizontal className="h-4 w-4" />
            {creatingExam ? "Creando Examen..." : "Crear Plantilla de Examen"}
          </button>
        </div>
      </div>
    </div>
  );
}
