"use client";

import React from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  ListOrdered,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";
import { normalizeStatementMarkdown } from "../../services/exam-template-service";
import type { PreviewQuestion } from "../../types";
import { getDifficultyBadge, getQuestionTypeLabel } from "./publish-utils";

type PublishQuestionCardProps = {
  question: PreviewQuestion;
  index: number;
  totalCount?: number;
  isSingleMode?: boolean;
  canSwap: boolean;
  publishing: boolean;
  onQuickSwap: (idx: number) => void;
  onOpenManualSwap: (idx: number) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
};

export function PublishQuestionCard({
  question: q,
  index,
  totalCount,
  isSingleMode = false,
  canSwap,
  publishing,
  onQuickSwap,
  onOpenManualSwap,
  onNavigatePrev,
  onNavigateNext,
}: PublishQuestionCardProps) {
  const diffBadge = getDifficultyBadge(q.difficulty);

  const puzzle = q.puzzle as Record<string, unknown> | undefined;
  const answerRules = q.answerRules as Record<string, unknown> | undefined;

  // Items para puzzle_order
  const orderItems = Array.isArray(puzzle?.items)
    ? (puzzle.items as Array<{ id?: string; text?: string; correctPosition?: number }>)
    : [];

  // Items para puzzle_match
  const leftItems = Array.isArray(puzzle?.leftItems)
    ? (puzzle.leftItems as Array<{ id?: string; text?: string }>)
    : [];
  const rightItems = Array.isArray(puzzle?.rightItems)
    ? (puzzle.rightItems as Array<{ id?: string; text?: string }>)
    : [];
  const pairs = Array.isArray(puzzle?.pairs)
    ? (puzzle.pairs as Array<{ leftId?: string; rightId?: string }>)
    : [];

  // Slots para puzzle_cloze
  const templateText = typeof puzzle?.templateText === "string" ? puzzle.templateText : "";
  const slots = Array.isArray(puzzle?.slots)
    ? (puzzle.slots as Array<{ slotId?: string; correctOptionId?: string; options?: Array<{ id?: string; text?: string }> }>)
    : [];

  // Keywords para open_concept
  const keywords = Array.isArray(answerRules?.keywords)
    ? (answerRules.keywords as Array<{ term?: string; weight?: number }>)
    : [];
  const maxWords = typeof answerRules?.maxWords === "number" ? answerRules.maxWords : 60;
  const passThreshold = typeof answerRules?.passThreshold === "number" ? answerRules.passThreshold : 0.6;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs sm:p-5">
      {/* Barra superior de metadata y acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-900">
            {isSingleMode && totalCount ? `Pregunta ${index + 1} de ${totalCount}` : `Pregunta ${index + 1}`}
          </span>
          <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {getQuestionTypeLabel(q.type)}
          </span>
          <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${diffBadge.cls}`}>
            {diffBadge.label}
          </span>
          <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {q.points ?? 1} pt{((q.points ?? 1) !== 1 ? "s" : "")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onQuickSwap(index)}
            disabled={!canSwap || publishing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-40"
            title="Reemplazar por otra pregunta aleatoria del banco"
          >
            <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
            {isSingleMode ? "Cambiar al azar" : "Al azar"}
          </button>
          <button
            type="button"
            onClick={() => onOpenManualSwap(index)}
            disabled={!canSwap || publishing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 transition disabled:opacity-40"
            title="Seleccionar pregunta específica del banco de preguntas"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {isSingleMode ? "Elegir del banco..." : "Elegir..."}
          </button>
        </div>
      </div>

      {/* Enunciado */}
      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Enunciado:
        </p>
        <MarkdownViewer
          markdown={normalizeStatementMarkdown(q.statement || "Sin enunciado")}
          className="prose-sm max-w-none leading-relaxed text-zinc-900"
        />
      </div>

      {/* Caso 1: Opciones tradicionales (single_choice, multiple_choice, true_false) */}
      {Array.isArray(q.options) && q.options.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Opciones de respuesta:
          </p>
          <div className="grid gap-2">
            {q.options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const isCorrect = Boolean(opt.isCorrect);
              return (
                <div
                  key={opt.id || optIdx}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-xs sm:text-sm transition ${
                    isCorrect
                      ? "border-emerald-300 bg-emerald-50/70 font-medium text-emerald-950 ring-1 ring-emerald-300/60"
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      isCorrect
                        ? "bg-emerald-600 text-white"
                        : "border border-zinc-200 bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {letter}
                  </span>
                  <div className="flex-1 min-w-0 pt-0.5 leading-snug">
                    <MarkdownViewer markdown={opt.text} className="prose-sm max-w-none" />
                  </div>
                  {isCorrect ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Correcta
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Caso 2: Pregunta de Ordenar (puzzle_order) */}
      {q.type === "puzzle_order" && orderItems.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <ListOrdered className="h-3.5 w-3.5" />
            <span>Secuencia y orden correcto esperado:</span>
          </div>
          <div className="space-y-2">
            {[...orderItems]
              .sort((a, b) => (a.correctPosition || 0) - (b.correctPosition || 0))
              .map((it, posIdx) => (
                <div
                  key={it.id || posIdx}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs"
                >
                  <span className="flex h-6 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-[11px]">
                    {it.correctPosition ?? posIdx + 1}°
                  </span>
                  <span className="font-medium text-zinc-900 flex-1">{it.text}</span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {/* Caso 3: Pregunta de Emparejar (puzzle_match) */}
      {q.type === "puzzle_match" && pairs.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <ArrowRight className="h-3.5 w-3.5" />
            <span>Relaciones / Parejas correctas:</span>
          </div>
          <div className="grid gap-2">
            {pairs.map((p, pIdx) => {
              const leftText = leftItems.find((l) => l.id === p.leftId)?.text || p.leftId;
              const rightText = rightItems.find((r) => r.id === p.rightId)?.text || p.rightId;
              return (
                <div
                  key={pIdx}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs"
                >
                  <div className="font-semibold text-zinc-900 bg-white border border-zinc-200 rounded-lg px-2.5 py-1">
                    {leftText}
                  </div>
                  <ArrowRight className="h-4 w-4 text-indigo-500 shrink-0" />
                  <div className="font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                    {rightText}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Caso 4: Pregunta de Completar Espacios (puzzle_cloze) */}
      {q.type === "puzzle_cloze" && (templateText || slots.length > 0) ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Texto con espacios y respuestas:
          </p>
          {templateText ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800 font-mono">
              {templateText}
            </div>
          ) : null}
          <div className="space-y-1.5 pt-1">
            {slots.map((s, sIdx) => {
              const correctOpt = s.options?.find((o) => o.id === s.correctOptionId)?.text || s.correctOptionId;
              return (
                <div key={s.slotId || sIdx} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-xs">
                  <span className="font-bold text-zinc-600 uppercase text-[10px]">{s.slotId}:</span>
                  <span className="font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                    {correctOpt}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Caso 5: Pregunta Abierta (open_concept o open_text) */}
      {(q.type === "open_concept" || q.type === "open_text") && (keywords.length > 0 || maxWords) ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <KeyRound className="h-3.5 w-3.5" />
            <span>Rúbrica de evaluación conceptual (IA):</span>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
              <span>Límite máx: <strong>{maxWords} palabras</strong></span>
              <span>·</span>
              <span>Umbral mínimo: <strong>{Math.round(passThreshold * 100)}%</strong></span>
            </div>
            {keywords.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-zinc-500">Palabras clave requeridas:</span>
                {keywords.map((k, kIdx) => (
                  <span
                    key={kIdx}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-800"
                  >
                    {k.term} <span className="text-[9px] text-indigo-500">({k.weight ?? 1}x)</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Navegación anterior / siguiente solo en modo individual */}
      {isSingleMode && onNavigatePrev && onNavigateNext && totalCount ? (
        <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3">
          <button
            type="button"
            onClick={onNavigatePrev}
            disabled={index === 0}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-xs font-medium text-zinc-500">
            {index + 1} / {totalCount}
          </span>
          <button
            type="button"
            onClick={onNavigateNext}
            disabled={index === totalCount - 1}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-40"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
