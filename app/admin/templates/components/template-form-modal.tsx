"use client";

import React from "react";
import { Save, X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import { Toggle } from "./common";
import type { CatalogItem, ExamFormData } from "../types";

type TemplateFormModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  form: ExamFormData;
  autoName: string;
  subjects: CatalogItem[];
  groups: CatalogItem[];
  fichas: CatalogItem[];
  moments: CatalogItem[];
  sites: CatalogItem[];
  shifts: CatalogItem[];
  submitting: boolean;
  error: string | null;
  onUpdateField: <K extends keyof ExamFormData>(field: K, value: ExamFormData[K]) => void;
  onImportDoc: (file: File) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function TemplateFormModal({
  isOpen,
  mode,
  form,
  autoName,
  subjects,
  groups,
  fichas,
  moments,
  sites,
  shifts,
  submitting,
  error,
  onUpdateField,
  onImportDoc,
  onSubmit,
  onClose,
}: TemplateFormModalProps) {
  if (!isOpen) return null;

  const isEdit = mode === "edit";
  const title = isEdit ? "Editar examen" : "Crear examen";
  const subtitle = isEdit
    ? "Modifica los campos del examen y guarda."
    : "Completa los campos y guarda.";

  return (
    <div className="fixed inset-0 z-50 animate-in fade-in-50 duration-150">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-2xs"
        aria-label="Cerrar"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">{title}</h2>
            <p className="text-sm text-zinc-500">{subtitle}</p>
          </div>
          <IconButton
            onClick={onClose}
            className="h-9 w-9"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Institución</span>
            <select
              value={form.institution}
              onChange={(e) => {
                const next = e.target.value === "SENA" ? "SENA" : "CESDE";
                onUpdateField("institution", next);
                onUpdateField("groupId", "");
              }}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            >
              <option value="CESDE">CESDE</option>
              <option value="SENA">SENA</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Materia</span>
            <select
              value={form.subjectId}
              onChange={(e) => onUpdateField("subjectId", e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
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
            <span className="text-xs font-semibold text-zinc-700">
              {form.institution === "SENA" ? "Ficha" : "Grupo"}
            </span>
            <select
              value={form.groupId}
              onChange={(e) => onUpdateField("groupId", e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">Seleccionar</option>
              {(form.institution === "SENA" ? fichas : groups).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Momento</span>
            <select
              value={form.momentId}
              onChange={(e) => onUpdateField("momentId", e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
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
            <span className="text-xs font-semibold text-zinc-700">Sede</span>
            <select
              value={form.siteId}
              onChange={(e) => onUpdateField("siteId", e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">Seleccionar</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Jornada</span>
            <select
              value={form.shiftId}
              onChange={(e) => onUpdateField("shiftId", e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">Seleccionar</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-1 sm:col-span-2">
            <span className="text-xs font-semibold text-zinc-700">Nombre (automático)</span>
            <div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800">
              <span className="truncate">{autoName}</span>
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Cantidad de preguntas</span>
            <input
              type="number"
              min={1}
              max={200}
              value={form.questionCount}
              onChange={(e) => onUpdateField("questionCount", Number(e.target.value || 0))}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Tiempo (min)</span>
            <input
              type="number"
              min={1}
              max={240}
              value={form.timeLimitMinutes}
              onChange={(e) => onUpdateField("timeLimitMinutes", Number(e.target.value || 0))}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          <Toggle
            label="Activo"
            description="Si está inactivo, no se debería poder publicar."
            value={form.active}
            onChange={(val) => onUpdateField("active", val)}
          />
          <Toggle
            label="Modo fraude"
            description="Cuenta cambios de pestaña y copy/paste."
            value={form.fraudEnabled}
            onChange={(val) => onUpdateField("fraudEnabled", val)}
          />

          <div className="grid gap-2 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-700">Documentación (README.md)</p>
                <p className="text-xs text-zinc-500">Se muestra al estudiante como página web explorable.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                  <input
                    type="file"
                    accept=".md,text/markdown,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onImportDoc(file);
                      e.currentTarget.value = "";
                    }}
                  />
                  Cargar archivo
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateField("documentationMarkdown", "");
                    onUpdateField("docFileName", null);
                  }}
                  className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {form.docFileName ? (
              <p className="text-xs text-zinc-500">Archivo: {form.docFileName}</p>
            ) : null}

            <textarea
              value={form.documentationMarkdown}
              onChange={(e) => {
                onUpdateField("documentationMarkdown", e.target.value);
                onUpdateField("docFileName", null);
              }}
              placeholder="# Documentación&#10;&#10;Pega aquí el contenido del README en Markdown..."
              className="min-h-40 w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <IconButton
            variant="primary"
            onClick={onSubmit}
            disabled={submitting}
            className="h-10 w-10"
            aria-label={isEdit ? "Guardar cambios" : "Guardar examen"}
            title={submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar examen"}
          >
            <Save className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
