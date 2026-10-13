"use client";

import React from "react";
import {
  Eye,
  KeyRound,
  Power,
  SendHorizontal,
  SquarePen,
  Trash2,
} from "lucide-react";
import { ActionIconButton } from "./common";
import type { ExamTemplateRow, PublishedRef } from "../types";

type TemplatesCardsViewProps = {
  rows: ExamTemplateRow[];
  namesById: Map<string, string>;
  pendingCounts: Record<string, string>;
  savingId: string | null;
  publishedByTemplate: Record<string, PublishedRef>;
  onPendingCountChange: (id: string, val: string) => void;
  onSaveQuestionCount: (id: string) => void;
  onToggleActive: (id: string, next: boolean) => void;
  onEdit: (row: ExamTemplateRow) => void;
  onDelete: (row: ExamTemplateRow) => void;
  onPublish: (row: ExamTemplateRow) => void;
};

export function TemplatesCardsView({
  rows,
  namesById,
  pendingCounts,
  savingId,
  publishedByTemplate,
  onPendingCountChange,
  onSaveQuestionCount,
  onToggleActive,
  onEdit,
  onDelete,
  onPublish,
}: TemplatesCardsViewProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm">
        No hay exámenes que coincidan con los criterios de búsqueda.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {rows.map((row) => {
        const subject = (namesById.get(`subjects:${row.subjectId}`) ?? row.subjectId) || "N/A";
        const group =
          ((row.institution === "SENA"
            ? namesById.get(`fichas:${row.groupId}`)
            : namesById.get(`groups:${row.groupId}`)) ??
            row.groupId) ||
          "N/A";
        const moment = (namesById.get(`moments:${row.momentId}`) ?? row.momentId) || "N/A";
        const site = (namesById.get(`sites:${row.siteId}`) ?? row.siteId) || "N/A";
        const shift = (namesById.get(`shifts:${row.shiftId}`) ?? row.shiftId) || "N/A";
        const pending = pendingCounts[row.id] ?? String(row.questionCount);
        const disabled = savingId === row.id;
        const pub = publishedByTemplate[row.id];

        return (
          <article
            key={row.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-zinc-950">
                  {row.name}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-600">
                  {subject} • {group}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {moment} • {shift} • {site}
                </p>
                {pub ? (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{pub.accessCode}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="uppercase">{pub.status}</span>
                  </div>
                ) : null}
                {row.documentationMarkdown?.trim() ? (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                    Docs
                  </div>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                  row.active
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                }`}
              >
                {row.active ? "Activo" : "Inactivo"}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Preguntas</span>
                <input
                  value={pending}
                  onChange={(e) => onPendingCountChange(row.id, e.target.value)}
                  onBlur={() => void onSaveQuestionCount(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                      void onSaveQuestionCount(row.id);
                    }
                  }}
                  className="h-8 w-20 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:opacity-50"
                  disabled={disabled}
                  inputMode="numeric"
                />
              </label>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <ActionIconButton title="Editar" tone="neutral" onClick={() => onEdit(row)} disabled={disabled}>
                  <SquarePen className="h-4 w-4" />
                </ActionIconButton>
                <ActionIconButton
                  title={row.active ? "Inactivar" : "Activar"}
                  tone={row.active ? "danger" : "neutral"}
                  onClick={() => onToggleActive(row.id, !row.active)}
                  disabled={disabled}
                >
                  <Power className="h-4 w-4" />
                </ActionIconButton>
                <ActionIconButton
                  title="Vista previa"
                  tone="neutral"
                  onClick={() => onPublish(row)}
                  disabled={disabled}
                >
                  <Eye className="h-4 w-4" />
                </ActionIconButton>
                <ActionIconButton
                  title="Publicar"
                  tone="primary"
                  onClick={() => onPublish(row)}
                  disabled={disabled || !row.active}
                >
                  <SendHorizontal className="h-4 w-4" />
                </ActionIconButton>
                <ActionIconButton title="Eliminar" tone="danger" onClick={() => onDelete(row)} disabled={disabled}>
                  <Trash2 className="h-4 w-4" />
                </ActionIconButton>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
