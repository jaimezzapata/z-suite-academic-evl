"use client";

import { Sparkles } from "lucide-react";
import type { CatalogItem, ReadmeTemplateId } from "../types";
import { QUESTION_TYPE_OPTIONS, README_TEMPLATE_OPTIONS } from "../types";
import { ModalShell } from "./modal-shell";

interface ReadmeConfigModalProps {
  open: boolean;
  onClose: () => void;
  readmeTemplate: ReadmeTemplateId;
  onSelectReadmeTemplate: (id: ReadmeTemplateId) => void;
  onApplyReadmeTemplate: (id: ReadmeTemplateId) => void;
  geminiVariant: "flash" | "pro";
  onSelectGeminiVariant: (variant: "flash" | "pro") => void;
  topics: string;
  onSetTopics: (value: string) => void;
  criteria: string;
  onSetCriteria: (value: string) => void;
  audience: string;
  onSetAudience: (value: string) => void;
  lengthHint: "corta" | "media" | "larga";
  onSetLengthHint: (value: "corta" | "media" | "larga") => void;
  context: string;
  onSetContext: (value: string) => void;
  catalogError: string | null;
  subjectId: string;
  onSetSubjectId: (value: string) => void;
  groupId: string;
  onSetGroupId: (value: string) => void;
  momentId: string;
  onSetMomentId: (value: string) => void;
  questionCount: number;
  onSetQuestionCount: (value: number) => void;
  timeLimitMinutes: number;
  onSetTimeLimitMinutes: (value: number) => void;
  allowedQuestionTypes: string[];
  onToggleAllowedType: (type: string) => void;
  subjects: CatalogItem[];
  groups: CatalogItem[];
  moments: CatalogItem[];
  readmeModelUsed: string | null;
  canGenerate: boolean;
  loading: boolean;
  onGenerate: () => Promise<boolean>;
}

export function ReadmeConfigModal({
  open,
  onClose,
  readmeTemplate,
  onSelectReadmeTemplate,
  onApplyReadmeTemplate,
  geminiVariant,
  onSelectGeminiVariant,
  topics,
  onSetTopics,
  criteria,
  onSetCriteria,
  audience,
  onSetAudience,
  lengthHint,
  onSetLengthHint,
  context,
  onSetContext,
  catalogError,
  subjectId,
  onSetSubjectId,
  groupId,
  onSetGroupId,
  momentId,
  onSetMomentId,
  questionCount,
  onSetQuestionCount,
  timeLimitMinutes,
  onSetTimeLimitMinutes,
  allowedQuestionTypes,
  onToggleAllowedType,
  subjects,
  groups,
  moments,
  readmeModelUsed,
  canGenerate,
  loading,
  onGenerate,
}: ReadmeConfigModalProps) {
  return (
    <ModalShell
      open={open}
      title="Configurar README"
      subtitle="Define plantilla, temas y criterios. Luego genera y verás el resultado en la vista principal."
      onClose={onClose}
    >
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Plantilla README</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={readmeTemplate}
                onChange={(e) => onSelectReadmeTemplate(e.target.value as ReadmeTemplateId)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 sm:w-auto"
              >
                {README_TEMPLATE_OPTIONS.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onApplyReadmeTemplate(readmeTemplate)}
                className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                {readmeTemplate === "custom" ? "Restablecer plantilla" : "Aplicar plantilla"}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {README_TEMPLATE_OPTIONS.find((tpl) => tpl.id === readmeTemplate)?.description}
            </p>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Modelo</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800">
                Gemini
              </div>
              <div className="inline-flex w-fit items-center rounded-xl border border-zinc-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => onSelectGeminiVariant("flash")}
                  className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                    geminiVariant === "flash" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Flash
                </button>
                <button
                  type="button"
                  onClick={() => onSelectGeminiVariant("pro")}
                  className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                    geminiVariant === "pro" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Pro
                </button>
              </div>
            </div>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Temas</span>
            <textarea
              value={topics}
              onChange={(e) => onSetTopics(e.target.value)}
              rows={6}
              placeholder={"Tema 1: ...\nTema 2: ...\nTema 3: ..."}
              className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Criterios</span>
            <textarea
              value={criteria}
              onChange={(e) => onSetCriteria(e.target.value)}
              rows={10}
              placeholder={"Formato, tono, secciones obligatorias, profundidad, ejemplos, etc."}
              className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Audiencia</span>
              <input
                value={audience}
                onChange={(e) => onSetAudience(e.target.value)}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                placeholder="Ej: estudiantes de grado 10"
              />
            </label>
            <div className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Longitud</span>
              <select
                value={lengthHint}
                onChange={(e) => onSetLengthHint(e.target.value as typeof lengthHint)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="corta">Corta</option>
                <option value="media">Media</option>
                <option value="larga">Larga</option>
              </select>
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Contexto (opcional)</span>
            <textarea
              value={context}
              onChange={(e) => onSetContext(e.target.value)}
              rows={3}
              placeholder="Ej: enfoque por competencias, palabras clave, rubrica, etc."
              className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </label>

          {catalogError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {catalogError}
            </div>
          ) : null}

          <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Metadatos del JSON</p>
              <p className="mt-1 text-xs text-zinc-500">
                Estos datos se incrustan dentro del README y luego el JSON se genera únicamente a partir de ese bloque.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Materia</span>
                <select
                  value={subjectId}
                  onChange={(e) => onSetSubjectId(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Grupo</span>
                <select
                  value={groupId}
                  onChange={(e) => onSetGroupId(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Momento</span>
                <select
                  value={momentId}
                  onChange={(e) => onSetMomentId(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {moments.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Preguntas</span>
                <input
                  type="number"
                  value={questionCount}
                  onChange={(e) => onSetQuestionCount(Number(e.target.value))}
                  min={1}
                  max={200}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Tiempo (min)</span>
                <input
                  type="number"
                  value={timeLimitMinutes}
                  onChange={(e) => onSetTimeLimitMinutes(Number(e.target.value))}
                  min={1}
                  max={300}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
              </label>
            </div>

            <div className="grid gap-2">
              <p className="text-xs font-semibold text-zinc-700">Tipos permitidos</p>
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPE_OPTIONS.map((t) => {
                  const active = allowedQuestionTypes.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onToggleAllowedType(t.id)}
                      className={`h-9 rounded-xl px-3 text-sm font-semibold transition ${
                        active
                          ? "bg-zinc-900 text-white"
                          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500">
                Seleccionados: {allowedQuestionTypes.join(", ") || "Ninguno"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-xs text-zinc-500">
              <span className="font-semibold text-zinc-700">Gemini</span>
              {readmeModelUsed ? <span className="text-zinc-400"> · {readmeModelUsed}</span> : null}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await onGenerate();
                  if (ok) onClose();
                }}
                disabled={!canGenerate || loading}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {loading ? "Generando..." : "Generar README"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
