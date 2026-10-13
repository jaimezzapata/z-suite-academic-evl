"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Eraser,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { downloadMarkdown } from "../services/ai-docs-service";
import type { CatalogItem, ReadmeTemplateId } from "../types";
import { ReadmeAdvancedModal } from "./readme-advanced-modal";

interface ReadmePanelProps {
  markdown: string;
  loading: boolean;
  canGenerate: boolean;
  error: string | null;
  subjectId: string;
  subjects: CatalogItem[];
  topics: string;
  criteria: string;
  geminiVariant: "flash" | "pro";
  readmeTemplate: ReadmeTemplateId;
  lastAutoSaved: string | null;
  loadingTopics: boolean;
  onSetSubjectId: (id: string) => void;
  onUpdateTopics: (topics: string) => void;
  onUpdateCriteria: (criteria: string) => void;
  onSelectGeminiVariant: (variant: "flash" | "pro") => void;
  onSelectReadmeTemplate: (id: ReadmeTemplateId) => void;
  onSetMarkdown: (value: string) => void;
  onGenerate: () => Promise<boolean>;
  onOpenPreview: () => void;
  onClear: () => void;
  onContinueToQuestions: () => void;
}

export function ReadmePanel({
  markdown,
  loading,
  canGenerate,
  error,
  subjectId,
  subjects,
  topics,
  criteria,
  geminiVariant,
  readmeTemplate,
  lastAutoSaved,
  loadingTopics,
  onSetSubjectId,
  onUpdateTopics,
  onUpdateCriteria,
  onSelectGeminiVariant,
  onSelectReadmeTemplate,
  onSetMarkdown,
  onGenerate,
  onOpenPreview,
  onClear,
  onContinueToQuestions,
}: ReadmePanelProps) {
  // Estado de vista: "form" (solo parámetros) o "result" (solo el README)
  const [viewState, setViewState] = useState<"form" | "result">(() =>
    markdown.trim() ? "result" : "form",
  );
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);

  // Al terminar de generar con éxito, transicionar a "result"
  async function handleGenerateClick() {
    const success = await onGenerate();
    if (success) {
      setViewState("result");
    }
  }

  const activeSubjectName = subjects.find((s) => s.id === subjectId)?.name ?? subjectId;

  // VISTA 1: CONFIGURACIÓN DE PARÁMETROS (Solo se ve esto)
  if (viewState === "form") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        {/* Encabezado con Botón de Generar en la parte superior */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                Paso 1
              </span>
              <h2 className="text-base font-bold text-zinc-950">
                Configurar Temario y Documentación
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Selecciona la materia y ajusta los temas. Se guardan automáticamente al escribir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Indicador de auto-guardado */}
            {loadingTopics ? (
              <span className="text-[11px] font-medium text-zinc-400">Cargando temario...</span>
            ) : lastAutoSaved ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
                <CheckCircle2 className="h-3 w-3" />
                Guardado automático
              </span>
            ) : (
              <span className="text-[11px] text-zinc-400">Se guarda solo al escribir</span>
            )}

            {/* Ver README previo si ya existe */}
            {markdown.trim() ? (
              <button
                type="button"
                onClick={() => setViewState("result")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
              >
                <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
                Ver README generado
              </button>
            ) : null}

            {/* Botón para abrir el Modal de Parámetros Avanzados */}
            <button
              type="button"
              onClick={() => setAdvancedModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-2xs"
              title="Configurar Modelo Gemini, Plantilla y Criterios"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500" />
              <span>Parámetros Avanzados</span>
            </button>

            {/* BOTÓN DE GENERAR DOCUMENTACIÓN EN LA PARTE SUPERIOR */}
            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={!canGenerate || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>{loading ? "Generando con IA..." : "Generar Documentación con IA"}</span>
            </button>
          </div>
        </div>

        {/* Formulario limpio: solo Materia y Temas */}
        <div className="mt-4 space-y-4">
          {/* Selector de Materia */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700">Materia Académica</label>
            <select
              value={subjectId}
              onChange={(e) => onSetSubjectId(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-900 outline-none focus:border-indigo-400 focus:bg-white"
            >
              <option value="">Selecciona materia...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Temas a Evaluar */}
          <div>
            <div className="flex items-center justify-between pb-1">
              <label className="block text-xs font-semibold text-zinc-700">
                Temas a Evaluar
              </label>
              <span className="text-[10px] text-zinc-400">Se guardan permanentemente para esta materia</span>
            </div>
            <textarea
              value={topics}
              onChange={(e) => onUpdateTopics(e.target.value)}
              rows={8}
              placeholder="Ejemplo:&#10;1. Introducción a TypeScript y tipos de datos&#10;2. Interfaces, Types y Enums&#10;3. React Hooks: useState, useEffect, custom hooks&#10;4. Consumo de APIs y manejo de errores"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs leading-relaxed text-zinc-900 outline-none focus:border-indigo-400 focus:bg-white"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        {/* Modal de Parámetros Avanzados (Modelo Gemini, Plantilla y Criterios) */}
        <ReadmeAdvancedModal
          open={advancedModalOpen}
          onClose={() => setAdvancedModalOpen(false)}
          geminiVariant={geminiVariant}
          readmeTemplate={readmeTemplate}
          criteria={criteria}
          onSelectGeminiVariant={onSelectGeminiVariant}
          onSelectReadmeTemplate={onSelectReadmeTemplate}
          onUpdateCriteria={onUpdateCriteria}
        />
      </div>
    );
  }

  // VISTA 2: RESULTADO DEL README (Solo se ve el README generado)
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm animate-in fade-in-50 duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Paso 1: Documentación Lista
            </span>
            <span className="text-xs font-bold text-zinc-900">
              {activeSubjectName}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Revisa o edita la guía generada. Cuando estés listo, avanza a generar las preguntas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewState("form")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            title="Volver a editar parámetros o temas"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Editar Parámetros / Temas
          </button>
          <button
            type="button"
            onClick={onOpenPreview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Vista previa
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(markdown)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </button>
          <button
            type="button"
            onClick={() => downloadMarkdown(markdown, "README_GENERADO.md")}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar
          </button>
          <button
            type="button"
            onClick={() => {
              onClear();
              setViewState("form");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Eraser className="h-3.5 w-3.5" />
            Limpiar
          </button>
        </div>
      </div>

      <div className="mt-4">
        <textarea
          value={markdown}
          onChange={(e) => onSetMarkdown(e.target.value)}
          rows={16}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 font-mono text-xs leading-relaxed text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
        />
      </div>

      {/* Botón de transición directa al Paso 2 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
        <button
          type="button"
          onClick={() => setViewState("form")}
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 underline"
        >
          ← Modificar temas o materia
        </button>

        <button
          type="button"
          onClick={onContinueToQuestions}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
        >
          <span>Siguiente: Generar Preguntas (Paso 2)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
