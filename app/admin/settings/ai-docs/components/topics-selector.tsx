"use client";

import React, { useState } from "react";
import { Bookmark, BookmarkCheck, Plus, Trash2, X } from "lucide-react";
import type { AcademicTopic } from "../types";

type TopicsSelectorProps = {
  subjectName: string;
  topicsList: AcademicTopic[];
  loadingTopics: boolean;
  selectedTopicId: string | null;
  onSelectTopic: (id: string) => void;
  onSaveCurrentTopic: (customTitle?: string) => Promise<string | undefined>;
  onRemoveTopic: (id: string) => Promise<void>;
  savingTopic: boolean;
};

export function TopicsSelector({
  subjectName,
  topicsList,
  loadingTopics,
  selectedTopicId,
  onSelectTopic,
  onSaveCurrentTopic,
  onRemoveTopic,
  savingTopic,
}: TopicsSelectorProps) {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleConfirmSave() {
    if (!newTitle.trim()) {
      setSaveError("Ingresa un título para el temario.");
      return;
    }
    setSaveError(null);
    try {
      await onSaveCurrentTopic(newTitle.trim());
      setNewTitle("");
      setSaveModalOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar el temario.");
    }
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-bold text-zinc-900">
            Biblioteca de Temarios Guardados {subjectName ? `(${subjectName})` : ""}
          </span>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
            {topicsList.length} guardados
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setSaveError(null);
            setNewTitle("");
            setSaveModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-800 shadow-2xs hover:bg-indigo-50 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Guardar temario actual
        </button>
      </div>

      {loadingTopics ? (
        <div className="py-2 text-xs text-zinc-500">Cargando temarios guardados...</div>
      ) : topicsList.length === 0 ? (
        <p className="pt-1 text-xs text-zinc-500">
          No hay temarios guardados para esta materia. Puedes redactar los temas abajo y guardarlos para reutilizarlos en cualquier momento.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
          {topicsList.map((item) => {
            const isSelected = item.id === selectedTopicId;
            return (
              <div
                key={item.id}
                className={`group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                  isSelected
                    ? "border-indigo-400 bg-indigo-600 text-white font-semibold shadow-xs"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectTopic(item.id)}
                  className="flex items-center gap-1 text-left"
                  title="Cargar este temario"
                >
                  {isSelected ? (
                    <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-600" />
                  )}
                  <span>{item.title}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`¿Eliminar el temario "${item.title}"?`)) {
                      void onRemoveTopic(item.id);
                    }
                  }}
                  className={`rounded p-0.5 transition ${
                    isSelected
                      ? "text-indigo-200 hover:text-white"
                      : "text-zinc-400 hover:text-rose-600"
                  }`}
                  title="Eliminar temario guardado"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para guardar temario */}
      {saveModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl animate-in fade-in-50 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Guardar Temario</h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Guarda los temas y criterios actuales para reutilizarlos en futuras evaluaciones.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700">
                  Título del Temario o Unidad
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej: Unidad 1: Fundamentos y Conceptos Clave"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-indigo-400 focus:bg-white"
                  autoFocus
                />
              </div>

              {saveError ? (
                <p className="text-xs font-semibold text-rose-600">{saveError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="rounded-xl border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmSave()}
                  disabled={savingTopic}
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingTopic ? "Guardando..." : "Guardar en biblioteca"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
