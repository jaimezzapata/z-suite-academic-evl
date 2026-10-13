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

type TemplatesTableViewProps = {
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

export function TemplatesTableView({
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
}: TemplatesTableViewProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm">
        No hay exámenes que coincidan con los criterios de búsqueda.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
        <thead className="bg-zinc-50">
          <tr className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            <th className="w-[34%] px-3 py-2">Nombre</th>
            <th className="w-[24%] px-3 py-2">Segmentación</th>
            <th className="w-[16%] px-3 py-2">Publicado</th>
            <th className="w-[10%] px-3 py-2">Activo</th>
            <th className="w-[8%] px-3 py-2">Preg.</th>
            <th className="w-[10%] px-3 py-2 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
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
              <tr key={row.id} className="border-t border-zinc-100 align-top transition-colors hover:bg-zinc-50/50">
                <td className="px-3 py-2">
                  <div className="whitespace-normal break-words font-medium text-zinc-950" title={row.name}>
                    {row.name}
                  </div>
                  {row.documentationMarkdown?.trim() ? (
                    <div className="mt-1 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                      Docs
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">
                  <div className="whitespace-normal break-words">
                    {subject} • {group}
                  </div>
                  <div className="mt-1 whitespace-normal break-words text-zinc-500">
                    {moment} • {shift} • {site}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-700">
                  {pub ? (
                    <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>{pub.accessCode}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="uppercase">{pub.status}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                      row.active
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                    }`}
                  >
                    {row.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-3 py-2">
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
                    className="h-9 w-20 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:opacity-50"
                    disabled={disabled}
                    inputMode="numeric"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
