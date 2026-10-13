"use client";

import React, { useMemo } from "react";
import {
  ArrowDownUp,
  Link2,
  FileText,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import type { SnapshotQuestion } from "@/types";

type ExamQuestionInputProps = {
  question: SnapshotQuestion;
  currentAnswer: unknown;
  onSetAnswer: (questionId: string, value: unknown) => void;
};

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function ExamQuestionInput({
  question: q,
  currentAnswer,
  onSetAnswer,
}: ExamQuestionInputProps) {
  // ----------------------------------------------------------------------
  // 1. SELECCIÓN ÚNICA (single_choice)
  // ----------------------------------------------------------------------
  if (q.type === "single_choice") {
    const selectedId = toString(currentAnswer, "");
    const options = Array.isArray(q.options) ? q.options : [];

    if (options.length === 0) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>Esta pregunta no contiene opciones de respuesta configuradas.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Selecciona una opción:
          </span>
          {selectedId ? (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Opción seleccionada
            </span>
          ) : (
            <span className="text-xs font-medium text-zinc-400 italic">Pendiente por responder</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isSelected = selectedId === opt.id;
            return (
              <label
                key={opt.id}
                onClick={() => onSetAnswer(q.questionId, opt.id)}
                className={`group flex cursor-pointer items-center gap-3.5 rounded-2xl border p-4 transition-all duration-200 ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/80"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"
                  }`}
                >
                  {letter}
                </div>
                <span className="min-w-0 flex-1 text-base font-normal leading-relaxed text-zinc-900">
                  {opt.text}
                </span>
                <input
                  type="radio"
                  name={`q-${q.questionId}`}
                  checked={isSelected}
                  onChange={() => onSetAnswer(q.questionId, opt.id)}
                  className="sr-only"
                />
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // 2. SELECCIÓN MÚLTIPLE (multiple_choice)
  // ----------------------------------------------------------------------
  if (q.type === "multiple_choice") {
    const selectedIds = Array.isArray(currentAnswer) ? (currentAnswer as string[]) : [];
    const options = Array.isArray(q.options) ? q.options : [];

    if (options.length === 0) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>Esta pregunta no contiene opciones de respuesta configuradas.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-800">
              Múltiple
            </span>
            <span className="text-xs font-medium text-zinc-500">
              Selecciona todas las opciones que consideres correctas:
            </span>
          </div>
          <span className="text-xs font-bold text-indigo-700">
            {selectedIds.length} seleccionada{selectedIds.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isSelected = selectedIds.includes(opt.id);
            return (
              <label
                key={opt.id}
                onClick={() => {
                  const next = isSelected
                    ? selectedIds.filter((id) => id !== opt.id)
                    : [...selectedIds, opt.id];
                  onSetAnswer(q.questionId, next);
                }}
                className={`group flex cursor-pointer items-center gap-3.5 rounded-2xl border p-4 transition-all duration-200 ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/80"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"
                  }`}
                >
                  {letter}
                </div>
                <span className="min-w-0 flex-1 text-base font-normal leading-relaxed text-zinc-900">
                  {opt.text}
                </span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    const next = isSelected
                      ? selectedIds.filter((id) => id !== opt.id)
                      : [...selectedIds, opt.id];
                    onSetAnswer(q.questionId, next);
                  }}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // 3. VERDADERO O FALSO (true_false)
  // ----------------------------------------------------------------------
  if (q.type === "true_false") {
    const selectedId = toString(currentAnswer, "");
    const tfOptions =
      Array.isArray(q.options) && q.options.length > 0
        ? q.options
        : [
            { id: "true", text: "Verdadero" },
            { id: "false", text: "Falso" },
          ];

    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Determina si la afirmación es verdadera o falsa:
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tfOptions.map((opt) => {
            const isSelected = selectedId === opt.id;
            const isTrue = opt.id === "true" || opt.text.toLowerCase().includes("verdadero");
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSetAnswer(q.questionId, opt.id)}
                className={`flex h-16 items-center justify-center rounded-2xl border text-base font-bold transition-all ${
                  isSelected
                    ? isTrue
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500 shadow-sm"
                      : "border-rose-600 bg-rose-50 text-rose-950 ring-2 ring-rose-500 shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // 4. PREGUNTA ABIERTA / CONCEPTUAL (open_concept o open_text)
  // ----------------------------------------------------------------------
  if (q.type === "open_concept" || q.type === "open_text") {
    const val = toString(currentAnswer, "");
    const wordCount = val.trim() ? val.trim().split(/\s+/).length : 0;
    const maxWords = q.answerRules?.maxWords || 80;
    const isExceeded = maxWords > 0 && wordCount > maxWords;

    return (
      <div className="space-y-3">
        {/* Banner de contexto */}
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-xs">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-indigo-950">Respuesta de Desarrollo Conceptual</p>
            <p className="mt-0.5 text-xs leading-relaxed text-indigo-800/90">
              Escribe con tus propias palabras una explicación clara y fundamentada en la documentación técnica. Se evaluará el uso de conceptos clave y razonamiento lógico.
            </p>
          </div>
        </div>

        <textarea
          value={val}
          onChange={(e) => onSetAnswer(q.questionId, e.target.value)}
          rows={5}
          className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-base leading-relaxed text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          placeholder="Escribe aquí tu respuesta detallada..."
        />

        <div className="flex items-center justify-between px-1 text-xs">
          <span className="font-medium text-zinc-500">
            {wordCount} {wordCount === 1 ? "palabra" : "palabras"} redactadas
          </span>
          {maxWords ? (
            <span
              className={`rounded-full px-2.5 py-0.5 font-bold ${
                isExceeded
                  ? "bg-rose-100 text-rose-700"
                  : wordCount > 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-zinc-100 text-zinc-600"
              }`}
            >
              Límite sugerido: {maxWords} palabras
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // 5. ORDENAR SECUENCIA (puzzle_order)
  // ----------------------------------------------------------------------
  if (q.type === "puzzle_order") {
    const rawItems = Array.isArray(q.puzzle?.items)
      ? (q.puzzle?.items as Array<Record<string, unknown>>)
      : [];
    const positionsMap = (currentAnswer as Record<string, number>) || {};
    const n = rawItems.length;

    if (n === 0) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>Esta pregunta de ordenamiento aún no tiene pasos definidos en su configuración.</p>
        </div>
      );
    }

    const assignedCount = Object.values(positionsMap).filter((pos) => pos > 0 && pos <= n).length;

    function handleSetPosition(itemId: string, newPos: number) {
      const next = { ...positionsMap };
      if (newPos === 0) {
        delete next[itemId];
      } else {
        // Si otra tarjeta ya tenía esta posición, desasignarla para evitar duplicados accidentales
        Object.keys(next).forEach((k) => {
          if (next[k] === newPos) delete next[k];
        });
        next[itemId] = newPos;
      }
      onSetAnswer(q.questionId, next);
    }

    function handleReset() {
      onSetAnswer(q.questionId, {});
    }

    return (
      <div className="space-y-4">
        {/* Cabecera con instrucciones y progreso */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
              <ArrowDownUp className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-950">Ordena los pasos secuenciales</p>
              <p className="text-[11px] text-indigo-700">
                Asigna a cada paso su posición lógica (1° al {n}°).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                assignedCount === n
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-indigo-100 text-indigo-800"
              }`}
            >
              {assignedCount}/{n} pasos ordenados
            </span>
            {assignedCount > 0 ? (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                title="Restablecer orden"
              >
                <RotateCcw className="h-3 w-3" />
                Reiniciar
              </button>
            ) : null}
          </div>
        </div>

        {/* Lista de pasos con selectores interactivos */}
        <div className="space-y-2.5">
          {rawItems.map((it, idx) => {
            const itemId = toString(it.id) || `i${idx + 1}`;
            const itemText = toString(it.text);
            const currentPos = positionsMap[itemId] || 0;
            const isAssigned = currentPos > 0;

            return (
              <div
                key={itemId}
                className={`group flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between ${
                  isAssigned
                    ? "border-indigo-300 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-200/50"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60"
                }`}
              >
                {/* Posición actual + Texto */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition ${
                      isAssigned
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
                    }`}
                  >
                    {isAssigned ? `${currentPos}°` : "-"}
                  </div>
                  <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-zinc-900">
                    {itemText}
                  </p>
                </div>

                {/* Botones de selección rápida de posición */}
                <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                  <span className="mr-1 text-[11px] font-semibold text-zinc-400">Posición:</span>
                  <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1">
                    {Array.from({ length: n }, (_, i) => i + 1).map((pos) => {
                      const isActive = currentPos === pos;
                      return (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => handleSetPosition(itemId, isActive ? 0 : pos)}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                            isActive
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-zinc-600 hover:bg-white hover:text-zinc-900"
                          }`}
                          title={`Asignar posición ${pos}°`}
                        >
                          {pos}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // 6. EMPAREJAR CONCEPTOS (puzzle_match)
  // ----------------------------------------------------------------------
  if (q.type === "puzzle_match") {
    const leftItems = Array.isArray(q.puzzle?.leftItems)
      ? (q.puzzle?.leftItems as Array<Record<string, unknown>>)
      : [];
    const rightItems = Array.isArray(q.puzzle?.rightItems)
      ? (q.puzzle?.rightItems as Array<Record<string, unknown>>)
      : [];
    const pairsMap = (currentAnswer as Record<string, string>) || {};

    if (leftItems.length === 0 || rightItems.length === 0) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>Esta pregunta de emparejamiento aún no tiene parejas definidas en su configuración.</p>
        </div>
      );
    }

    const pairedCount = leftItems.filter((l) => Boolean(pairsMap[toString(l.id)])).length;

    return (
      <div className="space-y-4">
        {/* Encabezado */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
              <Link2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-950">Emparejamiento de Conceptos</p>
              <p className="text-[11px] text-indigo-700">
                Selecciona la correspondencia correcta para cada concepto de la izquierda.
              </p>
            </div>
          </div>

          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              pairedCount === leftItems.length
                ? "bg-emerald-100 text-emerald-800"
                : "bg-indigo-100 text-indigo-800"
            }`}
          >
            {pairedCount}/{leftItems.length} relaciones completadas
          </span>
        </div>

        {/* Tarjetas de emparejamiento */}
        <div className="space-y-3">
          {leftItems.map((left, idx) => {
            const leftId = toString(left.id) || `l${idx + 1}`;
            const leftText = toString(left.text);
            const currentRightId = pairsMap[leftId] || "";
            const isPaired = Boolean(currentRightId);
            const letter = String.fromCharCode(65 + idx);

            return (
              <div
                key={leftId}
                className={`grid grid-cols-1 gap-2.5 rounded-2xl border p-3.5 transition-all duration-200 md:grid-cols-[1fr_auto_1.2fr] md:items-center ${
                  isPaired
                    ? "border-indigo-300 bg-indigo-50/30 shadow-xs"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                {/* Elemento de la izquierda */}
                <div className="flex items-center gap-2.5 rounded-xl bg-zinc-100/80 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-200 font-bold text-xs text-zinc-700">
                    {letter}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-900 leading-snug">
                    {leftText}
                  </span>
                </div>

                {/* Flecha conectora */}
                <div className="hidden md:flex items-center justify-center text-zinc-400">
                  <ArrowRight className="h-4 w-4" />
                </div>

                {/* Selector de relación de la derecha */}
                <div className="relative">
                  <select
                    value={currentRightId}
                    onChange={(e) =>
                      onSetAnswer(q.questionId, {
                        ...pairsMap,
                        [leftId]: e.target.value,
                      })
                    }
                    className={`h-11 w-full rounded-xl border px-3 text-sm font-medium outline-none transition focus:ring-2 ${
                      isPaired
                        ? "border-emerald-300 bg-emerald-50/50 text-emerald-950 focus:border-emerald-500 focus:ring-emerald-200"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 focus:border-indigo-500 focus:ring-indigo-200"
                    }`}
                  >
                    <option value="">— Seleccionar correspondencia —</option>
                    {rightItems.map((r, rIdx) => {
                      const rId = toString(r.id) || `r${rIdx + 1}`;
                      const rText = toString(r.text);
                      return (
                        <option key={rId} value={rId}>
                          {rText}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // 7. COMPLETAR ESPACIOS (puzzle_cloze)
  // ----------------------------------------------------------------------
  const templateText = toString(q.puzzle?.templateText) || toString(q.statement);
  const slots = Array.isArray(q.puzzle?.slots)
    ? (q.puzzle?.slots as Array<Record<string, unknown>>)
    : [];
  const clozeAnswers = (currentAnswer as Record<string, string>) || {};

  if (slots.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        <p>Esta pregunta no contiene espacios para completar configurados.</p>
      </div>
    );
  }

  const filledCount = slots.filter((s) => Boolean(clozeAnswers[toString(s.slotId)])).length;

  // Render interactivo integrado: reemplaza {{slot_x}} por un selector integrado
  const parsedTemplateSegments = useMemo(() => {
    if (!templateText) return [];
    return templateText.split(/(\{\{[a-zA-Z0-9_-]+\}\})/g);
  }, [templateText]);

  return (
    <div className="space-y-4">
      {/* Cabecera de estado */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-indigo-950">Completar Espacios en Blanco</p>
            <p className="text-[11px] text-indigo-700">
              Selecciona el término o valor adecuado directamente en cada espacio del texto.
            </p>
          </div>
        </div>

        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            filledCount === slots.length
              ? "bg-emerald-100 text-emerald-800"
              : "bg-indigo-100 text-indigo-800"
          }`}
        >
          {filledCount}/{slots.length} espacios completados
        </span>
      </div>

      {/* Párrafo interactivo con selectores inline */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
        <p className="text-base font-normal leading-loose text-zinc-900">
          {parsedTemplateSegments.map((segment, segIdx) => {
            const match = /^\{\{([a-zA-Z0-9_-]+)\}\}$/.exec(segment);
            if (!match) {
              return <span key={segIdx}>{segment}</span>;
            }

            const slotId = match[1];
            const slotConfig = slots.find((s) => toString(s.slotId) === slotId);
            const options = Array.isArray(slotConfig?.options)
              ? (slotConfig.options as Array<Record<string, unknown>>)
              : [];
            const currentVal = clozeAnswers[slotId] || "";
            const isFilled = Boolean(currentVal);

            return (
              <span key={segIdx} className="inline-block px-1 align-baseline">
                <select
                  value={currentVal}
                  onChange={(e) =>
                    onSetAnswer(q.questionId, {
                      ...clozeAnswers,
                      [slotId]: e.target.value,
                    })
                  }
                  className={`inline-block cursor-pointer rounded-xl border px-2.5 py-1 text-sm font-bold outline-none transition focus:ring-2 ${
                    isFilled
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-xs focus:ring-indigo-300"
                      : "border-indigo-300 border-dashed bg-indigo-50/70 text-indigo-800 hover:bg-indigo-100 focus:ring-indigo-200"
                  }`}
                >
                  <option value="" className="bg-white text-zinc-700">
                    — Elegir espacio ({slotId}) —
                  </option>
                  {options.map((opt, oIdx) => {
                    const oId = toString(opt.id) || `opt_${oIdx + 1}`;
                    const oText = toString(opt.text);
                    return (
                      <option key={oId} value={oId} className="bg-white text-zinc-900">
                        {oText}
                      </option>
                    );
                  })}
                </select>
              </span>
            );
          })}
        </p>
      </div>

      {/* Tarjetas secundarias de selección accesible para pantallas móviles */}
      <div className="space-y-2 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Opciones individuales por cada espacio:
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {slots.map((s, idx) => {
            const slotId = toString(s.slotId) || `slot_${idx + 1}`;
            const options = Array.isArray(s.options)
              ? (s.options as Array<Record<string, unknown>>)
              : [];
            const currentVal = clozeAnswers[slotId] || "";
            return (
              <div
                key={slotId}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs"
              >
                <span className="font-bold text-zinc-700">Espacio [{slotId}]:</span>
                <select
                  value={currentVal}
                  onChange={(e) =>
                    onSetAnswer(q.questionId, {
                      ...clozeAnswers,
                      [slotId]: e.target.value,
                    })
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-900 outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {options.map((opt, oIdx) => {
                    const oId = toString(opt.id) || `opt_${oIdx + 1}`;
                    return (
                      <option key={oId} value={oId}>
                        {toString(opt.text)}
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
