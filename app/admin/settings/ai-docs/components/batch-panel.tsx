"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Edit3,
  Eraser,
  FileCode,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { downloadJson } from "../services/ai-docs-service";
import { QUESTION_TYPE_OPTIONS } from "../types";

interface BatchPanelProps {
  batchJson: string;
  batchLoading: boolean;
  canGenerateBatch: boolean;
  batchError: string | null;
  batchModelUsed: string | null;
  markdown: string;
  questionCount: number;
  allowedQuestionTypes: string[];
  importingToBank: boolean;
  bankImportSuccessCount: number | null;
  onSetQuestionCount: (count: number) => void;
  onToggleAllowedType: (type: string) => void;
  onClear: () => void;
  onGenerateBatch: () => Promise<boolean>;
  onImportToBank: () => Promise<void>;
  onGoToReadme: () => void;
  onContinueToExam: () => void;
}

type ParsedQuestion = {
  id?: string;
  statement?: string;
  type?: string;
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  explanation?: string;
  points?: number;
  puzzle?: Record<string, unknown>;
  answerRules?: Record<string, unknown>;
};

export function BatchPanel({
  batchJson,
  batchLoading,
  canGenerateBatch,
  batchError,
  batchModelUsed,
  markdown,
  questionCount,
  allowedQuestionTypes,
  importingToBank,
  bankImportSuccessCount,
  onSetQuestionCount,
  onToggleAllowedType,
  onClear,
  onGenerateBatch,
  onImportToBank,
  onGoToReadme,
  onContinueToExam,
}: BatchPanelProps) {
  // Estado de vista: "form" (solo parámetros) o "result" (solo preguntas generadas)
  const [viewState, setViewState] = useState<"form" | "result">(() =>
    batchJson.trim() ? "result" : "form",
  );

  // Sub-pestaña para la vista de resultado: "cards" (tarjetas legibles) o "json" (código)
  const [resultSubTab, setResultSubTab] = useState<"cards" | "json">("cards");

  const parsedQuestions = useMemo<ParsedQuestion[]>(() => {
    if (!batchJson) return [];
    try {
      const data = JSON.parse(batchJson) as { questions?: ParsedQuestion[] };
      return Array.isArray(data.questions) ? data.questions : [];
    } catch {
      return [];
    }
  }, [batchJson]);

  const parsedCount = parsedQuestions.length;

  // Manejo de generación: apenas termina con éxito pasa a ver únicamente el resultado
  async function handleGenerateClick() {
    const success = await onGenerateBatch();
    if (success) {
      setViewState("result");
    }
  }

  // Avanzar al examen asegurando que las preguntas queden en el banco
  async function handleContinueToExam() {
    if (batchJson.trim() && bankImportSuccessCount === null) {
      await onImportToBank();
    }
    onContinueToExam();
  }

  // VISTA 1: CONFIGURACIÓN DE PARÁMETROS (Solo se ve esto, sin preguntas abajo)
  if (viewState === "form") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                Paso 2
              </span>
              <h2 className="text-base font-bold text-zinc-950">
                Configurar Parámetros de Preguntas
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Las preguntas se formularán con IA tomando como base la documentación generada en el Paso 1.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onGoToReadme}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a Documentación
            </button>

            {batchJson.trim() && parsedCount > 0 ? (
              <button
                type="button"
                onClick={() => setViewState("result")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
              >
                <ListChecks className="h-3.5 w-3.5 text-zinc-500" />
                Ver preguntas generadas ({parsedCount})
              </button>
            ) : null}

            {/* BOTÓN DE GENERAR PREGUNTAS EN LA PARTE SUPERIOR */}
            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={!canGenerateBatch || batchLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>{batchLoading ? "Generando con IA..." : "Generar Preguntas con IA"}</span>
            </button>
          </div>
        </div>

        {!markdown.trim() ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <p className="font-semibold">Falta la documentación fuente</p>
            <p className="mt-0.5">
              Primero genera el temario en el Paso 1 para que las preguntas se alineen estrictamente a esos contenidos.
            </p>
            <button
              type="button"
              onClick={onGoToReadme}
              className="mt-2 inline-flex items-center gap-1 font-bold underline underline-offset-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Ir al Paso 1 (Documentación & Temario)
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700">
                  Cantidad de Preguntas a Generar
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={questionCount}
                  onChange={(e) => onSetQuestionCount(Number(e.target.value || 20))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-indigo-400 focus:bg-white"
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Recomendado: entre 10 y 45 preguntas por evaluación.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">
                  Tipos de Pregunta Permitidos
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {QUESTION_TYPE_OPTIONS.map((opt) => {
                    const checked = allowedQuestionTypes.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                          checked
                            ? "border-zinc-900 bg-zinc-900 text-white font-medium"
                            : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleAllowedType(opt.id)}
                          className="hidden"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {batchError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {batchError}
              </div>
            ) : null}

            {/* Botón de Generar Preguntas */}
            <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
              <button
                type="button"
                onClick={onGoToReadme}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 underline"
              >
                ← Volver a Documentación
              </button>

              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={!canGenerateBatch || batchLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 text-amber-400" />
                {batchLoading ? "Generando preguntas con IA..." : "Generar Preguntas con IA"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VISTA 2: RESULTADO DE PREGUNTAS (Solo se ven las preguntas / JSON generado)
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm animate-in fade-in-50 duration-200">
      {/* Barra superior del resultado */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Paso 2: Preguntas Listas
            </span>
            <span className="text-xs font-bold text-zinc-900">
              {parsedCount} {parsedCount === 1 ? "pregunta generada" : "preguntas generadas"}
            </span>
            {batchModelUsed ? (
              <span className="text-[11px] text-zinc-400">· Modelo: {batchModelUsed}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Revisa las preguntas, guárdalas en el Banco de Preguntas o continúa directo al Examen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewState("form")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            title="Volver a configurar cantidad o tipos"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Editar Parámetros
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(batchJson)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar JSON
          </button>
          <button
            type="button"
            onClick={() => downloadJson(batchJson, "PREGUNTAS_BANCO.json")}
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

      {/* Banner de guardado en el banco */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-emerald-950">
              {bankImportSuccessCount != null
                ? `¡${bankImportSuccessCount} preguntas guardadas en el Banco exitosamente!`
                : "Guardar lote en el Banco de Preguntas"}
            </p>
            <p className="text-[11px] text-emerald-800">
              {bankImportSuccessCount != null
                ? "Disponibles en el banco de preguntas para este y futuros exámenes."
                : "Registra estas preguntas en Firestore para enriquecer el repositorio académico."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onImportToBank()}
          disabled={importingToBank}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
        >
          <Database className="h-3.5 w-3.5" />
          {importingToBank ? "Guardando..." : "Guardar en Banco"}
        </button>
      </div>

      {/* Selector de visualización: Tarjetas Legibles vs JSON Crudo */}
      <div className="mt-4 flex items-center gap-2 border-b border-zinc-100 pb-2">
        <button
          type="button"
          onClick={() => setResultSubTab("cards")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
            resultSubTab === "cards"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <ListChecks className="h-3.5 w-3.5" />
          Vista Previa de Preguntas ({parsedCount})
        </button>
        <button
          type="button"
          onClick={() => setResultSubTab("json")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
            resultSubTab === "json"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <FileCode className="h-3.5 w-3.5" />
          JSON Crudo
        </button>
      </div>

      {/* Contenido según la sub-pestaña */}
      {resultSubTab === "cards" ? (
        <div className="mt-3 max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {parsedQuestions.map((q, idx) => (
            <div
              key={q.id || `q-${idx}`}
              className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2 border-b border-zinc-200/60 pb-2">
                <span className="font-bold text-zinc-900">
                  #{idx + 1}. {q.statement || "Sin enunciado"}
                </span>
                <span className="shrink-0 rounded-md bg-zinc-200/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                  {q.type || "single_choice"}
                </span>
              </div>

              {Array.isArray(q.options) && q.options.length > 0 ? (
                <div className="mt-2.5 space-y-1.5">
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className={`flex items-start gap-2 rounded-lg p-2 text-xs transition ${
                        opt.isCorrect
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-950 font-medium"
                          : "border border-zinc-100 bg-white text-zinc-700"
                      }`}
                    >
                      <span className="font-bold text-[11px]">
                        {opt.id.toUpperCase()}:
                      </span>
                      <span className="flex-1">{opt.text}</span>
                      {opt.isCorrect ? (
                        <span className="shrink-0 rounded bg-emerald-200 px-1.5 py-0.2 text-[9px] font-bold text-emerald-900">
                          Correcta
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Render puzzle_order */}
              {q.type === "puzzle_order" && Array.isArray((q.puzzle as Record<string, unknown>)?.items) ? (
                <div className="mt-2.5 space-y-1.5">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Secuencia esperada:</p>
                  {((q.puzzle as Record<string, unknown>).items as Array<{ id?: string; text?: string; correctPosition?: number }>)
                    .sort((a, b) => (a.correctPosition || 0) - (b.correctPosition || 0))
                    .map((it, pIdx) => (
                      <div key={it.id || pIdx} className="flex items-center gap-2 rounded-lg bg-white border border-zinc-200 p-2 text-xs">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-600 text-white font-bold text-[10px]">
                          {it.correctPosition ?? pIdx + 1}°
                        </span>
                        <span>{it.text}</span>
                      </div>
                    ))}
                </div>
              ) : null}

              {/* Render puzzle_match */}
              {q.type === "puzzle_match" && Array.isArray((q.puzzle as Record<string, unknown>)?.pairs) ? (
                <div className="mt-2.5 space-y-1.5">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Parejas correspondientes:</p>
                  {((q.puzzle as Record<string, unknown>).pairs as Array<{ leftId?: string; rightId?: string }>).map((pair, pIdx) => {
                    const lefts = ((q.puzzle as Record<string, unknown>)?.leftItems as Array<{ id?: string; text?: string }>) || [];
                    const rights = ((q.puzzle as Record<string, unknown>)?.rightItems as Array<{ id?: string; text?: string }>) || [];
                    const leftText = lefts.find((l) => l.id === pair.leftId)?.text || pair.leftId;
                    const rightText = rights.find((r) => r.id === pair.rightId)?.text || pair.rightId;
                    return (
                      <div key={pIdx} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-zinc-200 p-2 text-xs">
                        <span className="font-semibold text-zinc-800">{leftText}</span>
                        <span className="text-zinc-400">→</span>
                        <span className="font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">{rightText}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* Render open_concept */}
              {(q.type === "open_concept" || q.type === "open_text") && (q.answerRules as Record<string, unknown>)?.keywords ? (
                <div className="mt-2.5 rounded-lg bg-white border border-zinc-200 p-2.5 text-xs space-y-1.5">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Rúbrica de evaluación:</p>
                  <div className="flex flex-wrap gap-1">
                    {(((q.answerRules as Record<string, unknown>).keywords as Array<{ term?: string; weight?: number }>) || []).map((k, kIdx) => (
                      <span key={kIdx} className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                        {k.term} ({k.weight}x)
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {q.explanation ? (
                <p className="mt-2 text-[11px] text-zinc-500 italic">
                  Explicación: {q.explanation}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 max-h-[520px] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3.5">
          <pre className="font-mono text-xs text-zinc-900 whitespace-pre-wrap leading-relaxed">
            {batchJson}
          </pre>
        </div>
      )}

      {/* Botones de navegación inferior */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
        <button
          type="button"
          onClick={() => setViewState("form")}
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 underline"
        >
          ← Modificar parámetros de preguntas
        </button>

        <button
          type="button"
          onClick={handleContinueToExam}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
        >
          <span>Siguiente: Crear Examen (Paso 3)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
