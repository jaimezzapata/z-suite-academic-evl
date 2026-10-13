"use client";

import React from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { buildEmptyEditQuestion, typeLabel } from "../services/bank-service";
import type { CatalogItem, EditQuestion } from "../types";

type BankQuestionModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  question: EditQuestion | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  subjects: CatalogItem[];
  groups: CatalogItem[];
  moments: CatalogItem[];
  onClose: () => void;
  onSave: () => void;
  onChangeQuestion: React.Dispatch<React.SetStateAction<EditQuestion | null>>;
};

export function BankQuestionModal({
  isOpen,
  mode,
  question,
  loading,
  saving,
  error,
  subjects,
  groups,
  moments,
  onClose,
  onSave,
  onChangeQuestion,
}: BankQuestionModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-950">
                {mode === "create" ? "Crear pregunta" : "Editar pregunta"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                ID: <span className="font-mono text-zinc-700">{question?.id || "-"}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60 transition"
              disabled={saving}
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
            {error ? (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {loading || !question ? (
              <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
                Cargando información de la pregunta...
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Materia</span>
                    <select
                      value={question.subjectId}
                      onChange={(e) =>
                        onChangeQuestion((p) => (p ? { ...p, subjectId: e.target.value } : p))
                      }
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">Selecciona materia</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Estado</span>
                    <select
                      value={question.status}
                      onChange={(e) =>
                        onChangeQuestion((p) => (p ? { ...p, status: e.target.value } : p))
                      }
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="draft">Borrador</option>
                      <option value="published">Publicada</option>
                      <option value="archived">Archivada</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Tipo</span>
                    {mode === "create" ? (
                      <select
                        value={question.type}
                        onChange={(e) =>
                          onChangeQuestion((p) => {
                            if (!p) return p;
                            const next = buildEmptyEditQuestion(p.id, e.target.value);
                            return {
                              ...next,
                              subjectId: p.subjectId,
                              groupIds: p.groupIds,
                              momentIds: p.momentIds,
                              status: p.status,
                              difficulty: p.difficulty,
                              points: p.points,
                              statement: p.statement,
                            };
                          })
                        }
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                      >
                        <option value="single_choice">Selección única</option>
                        <option value="multiple_choice">Selección múltiple</option>
                        <option value="open_concept">Abierta</option>
                        <option value="puzzle_order">Ordenar</option>
                        <option value="puzzle_match">Emparejar</option>
                        <option value="puzzle_cloze">Completar</option>
                      </select>
                    ) : (
                      <input
                        value={typeLabel(question.type)}
                        readOnly
                        className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none"
                      />
                    )}
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Dificultad</span>
                    <select
                      value={question.difficulty}
                      onChange={(e) =>
                        onChangeQuestion((p) => (p ? { ...p, difficulty: e.target.value } : p))
                      }
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="easy">Fácil</option>
                      <option value="medium">Media</option>
                      <option value="hard">Difícil</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Puntos</span>
                    <input
                      type="number"
                      value={question.points}
                      onChange={(e) =>
                        onChangeQuestion((p) => (p ? { ...p, points: Number(e.target.value) } : p))
                      }
                      min={0}
                      max={100}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-700">Enunciado</span>
                  <textarea
                    value={question.statement}
                    onChange={(e) =>
                      onChangeQuestion((p) => (p ? { ...p, statement: e.target.value } : p))
                    }
                    rows={4}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs font-semibold text-zinc-700">Momentos</p>
                    <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
                      {moments.map((m) => {
                        const active = question.momentIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              onChangeQuestion((p) => {
                                if (!p) return p;
                                const next = active
                                  ? p.momentIds.filter((x) => x !== m.id)
                                  : [...p.momentIds, m.id];
                                return { ...p, momentIds: next };
                              })
                            }
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                              active
                                ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                            }`}
                          >
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs font-semibold text-zinc-700">Grupos</p>
                    <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
                      {groups.map((g) => {
                        const active = question.groupIds.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() =>
                              onChangeQuestion((p) => {
                                if (!p) return p;
                                const next = active
                                  ? p.groupIds.filter((x) => x !== g.id)
                                  : [...p.groupIds, g.id];
                                return { ...p, groupIds: next };
                              })
                            }
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                              active
                                ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                            }`}
                          >
                            {g.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Opciones para single y multiple choice */}
                {question.type === "single_choice" || question.type === "multiple_choice" ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-700">Opciones de respuesta</p>
                      {question.type === "multiple_choice" ? (
                        <button
                          type="button"
                          onClick={() =>
                            onChangeQuestion((p) => (p ? { ...p, partialCredit: !p.partialCredit } : p))
                          }
                          className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
                            question.partialCredit
                              ? "bg-zinc-900 text-white"
                              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          Crédito parcial
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {question.options.map((o, idx) => (
                        <div key={`${o.id}-${idx}`} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onChangeQuestion((p) => {
                                if (!p) return p;
                                const next = [...p.options];
                                if (p.type === "single_choice") {
                                  next.forEach((x, i) => (next[i] = { ...x, isCorrect: i === idx }));
                                } else {
                                  next[idx] = { ...next[idx], isCorrect: !next[idx].isCorrect };
                                }
                                return { ...p, options: next };
                              })
                            }
                            className={`h-10 w-10 shrink-0 rounded-xl border text-sm font-bold transition ${
                              o.isCorrect
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                            }`}
                            aria-label="Marcar correcta"
                            title="Marcar como respuesta correcta"
                          >
                            ✓
                          </button>
                          <input
                            value={o.text}
                            onChange={(e) =>
                              onChangeQuestion((p) => {
                                if (!p) return p;
                                const next = [...p.options];
                                next[idx] = { ...next[idx], text: e.target.value };
                                return { ...p, options: next };
                              })
                            }
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                            placeholder={`Opción ${idx + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onChangeQuestion((p) => {
                                if (!p) return p;
                                const next = p.options.filter((_, i) => i !== idx);
                                return { ...p, options: next };
                              })
                            }
                            className="h-10 shrink-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          onChangeQuestion((p) => {
                            if (!p) return p;
                            const nextId = `opt_${p.options.length + 1}`;
                            return { ...p, options: [...p.options, { id: nextId, text: "", isCorrect: false }] };
                          })
                        }
                        className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                      >
                        Agregar opción
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Preguntas abiertas */}
                {question.type === "open_concept" ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs font-semibold text-zinc-700">Reglas de respuesta</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-zinc-700">Máx. palabras</span>
                        <input
                          type="number"
                          value={question.answerRules.maxWords ?? 120}
                          onChange={(e) =>
                            onChangeQuestion((p) =>
                              p ? { ...p, answerRules: { ...p.answerRules, maxWords: Number(e.target.value) } } : p,
                            )
                          }
                          min={1}
                          max={500}
                          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-zinc-700">Umbral (0-1)</span>
                        <input
                          type="number"
                          value={question.answerRules.passThreshold ?? 0}
                          onChange={(e) =>
                            onChangeQuestion((p) =>
                              p ? { ...p, answerRules: { ...p.answerRules, passThreshold: Number(e.target.value) } } : p,
                            )
                          }
                          min={0}
                          max={1}
                          step={0.05}
                          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                        />
                      </label>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(question.answerRules.keywords ?? []).map((k, idx) => (
                        <div key={`${k.term}-${idx}`} className="grid gap-2 sm:grid-cols-[1fr_120px_110px]">
                          <input
                            value={k.term}
                            onChange={(e) =>
                              onChangeQuestion((p) => {
                                if (!p) return p;
                                const next = [...(p.answerRules.keywords ?? [])];
                                next[idx] = { ...next[idx], term: e.target.value };
                                return { ...p, answerRules: { ...p.answerRules, keywords: next } };
                              })
                            }
                            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                            placeholder="Término"
                          />
                          <input
                            type="number"
                            value={k.weight}
                            onChange={(e) =>
                              onChangeQuestion((p) => {
                                if (!p) return p;
                                const next = [...(p.answerRules.keywords ?? [])];
                                next[idx] = { ...next[idx], weight: Number(e.target.value) };
                                return { ...p, answerRules: { ...p.answerRules, keywords: next } };
                              })
                            }
                            min={0}
                            step={0.1}
                            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                            placeholder="Peso"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onChangeQuestion((p) => {
                                if (!p) return p;
                                const next = (p.answerRules.keywords ?? []).filter((_, i) => i !== idx);
                                return { ...p, answerRules: { ...p.answerRules, keywords: next } };
                              })
                            }
                            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          onChangeQuestion((p) => {
                            if (!p) return p;
                            const next = [...(p.answerRules.keywords ?? []), { term: "", weight: 1 }];
                            return { ...p, answerRules: { ...p.answerRules, keywords: next } };
                          })
                        }
                        className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                      >
                        Agregar palabra clave
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Puzzles */}
                {question.type.startsWith("puzzle_") ? (
                  <label className="grid gap-1 rounded-2xl border border-zinc-200 bg-white p-4">
                    <span className="text-xs font-semibold text-zinc-700">Puzzle (JSON)</span>
                    <textarea
                      value={question.puzzleText}
                      onChange={(e) =>
                        onChangeQuestion((p) => (p ? { ...p, puzzleText: e.target.value } : p))
                      }
                      rows={10}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    />
                  </label>
                ) : null}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || loading || !question}
              className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {saving ? "Guardando..." : mode === "create" ? "Crear pregunta" : "Guardar cambios"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
