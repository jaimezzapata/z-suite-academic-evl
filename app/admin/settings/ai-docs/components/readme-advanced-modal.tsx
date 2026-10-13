"use client";

import { Bot, SlidersHorizontal, Sparkles } from "lucide-react";
import { ModalShell } from "./modal-shell";
import type { ReadmeTemplateId } from "../types";
import { README_TEMPLATE_OPTIONS } from "../types";

interface ReadmeAdvancedModalProps {
  open: boolean;
  onClose: () => void;
  geminiVariant: "flash" | "pro";
  readmeTemplate: ReadmeTemplateId;
  criteria: string;
  onSelectGeminiVariant: (variant: "flash" | "pro") => void;
  onSelectReadmeTemplate: (id: ReadmeTemplateId) => void;
  onUpdateCriteria: (criteria: string) => void;
}

export function ReadmeAdvancedModal({
  open,
  onClose,
  geminiVariant,
  readmeTemplate,
  criteria,
  onSelectGeminiVariant,
  onSelectReadmeTemplate,
  onUpdateCriteria,
}: ReadmeAdvancedModalProps) {
  return (
    <ModalShell
      open={open}
      title="Parámetros Avanzados de IA"
      subtitle="Personaliza el modelo de Gemini, el formato de la plantilla y los criterios de evaluación académica."
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Modelo Gemini */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-indigo-600" />
              <label className="text-xs font-bold text-zinc-900">Modelo Gemini</label>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Selecciona el motor de inteligencia artificial.
            </p>
            <select
              value={geminiVariant}
              onChange={(e) => onSelectGeminiVariant(e.target.value as "flash" | "pro")}
              className="mt-2.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-900 outline-none focus:border-indigo-400 focus:bg-white"
            >
              <option value="flash">Gemini 2.5 Flash (Rápido y preciso - Recomendado)</option>
              <option value="pro">Gemini 2.5 Pro (Razonamiento profundo)</option>
            </select>
          </div>

          {/* Plantilla de Documento */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
              <label className="text-xs font-bold text-zinc-900">Plantilla de Documento</label>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Estructura base con la que se redactará la guía.
            </p>
            <select
              value={readmeTemplate}
              onChange={(e) => onSelectReadmeTemplate(e.target.value as ReadmeTemplateId)}
              className="mt-2.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-900 outline-none focus:border-indigo-400 focus:bg-white"
            >
              {README_TEMPLATE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Criterios de Evaluación */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-1">
            <label className="text-xs font-bold text-zinc-900">
              Criterios de Evaluación y Reglas de Salida
            </label>
            <span className="text-[10px] text-zinc-400">Instrucciones al modelo</span>
          </div>
          <p className="text-[11px] text-zinc-500 mb-2">
            Pautas pedagógicas, formato Markdown y restricciones para la redacción de la guía.
          </p>
          <textarea
            value={criteria}
            onChange={(e) => onUpdateCriteria(e.target.value)}
            rows={7}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-900 outline-none focus:border-indigo-400 focus:bg-white"
          />
        </div>

        {/* Botón de cierre y confirmación */}
        <div className="flex items-center justify-end border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 transition"
          >
            Guardar Parámetros y Cerrar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
