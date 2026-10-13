"use client";

import { ExternalLink } from "lucide-react";
import type { DriveWorkspaceRow, WeekGroupItem } from "../types";
import { formatDays, formatDateRange } from "../services/drive-service";

interface DriveWorkspaceDetailProps {
  selectedWorkspace: DriveWorkspaceRow | null;
  selectedWeeksByDay: WeekGroupItem[];
  selectedNodesLoading: boolean;
  selectedNodesError: string | null;
}

export function DriveWorkspaceDetail({
  selectedWorkspace,
  selectedWeeksByDay,
  selectedNodesLoading,
  selectedNodesError,
}: DriveWorkspaceDetailProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Detalle de estructura</h2>
          <p className="text-sm text-zinc-500">Consulta las carpetas generadas y las semanas detectadas.</p>
        </div>
      </div>

      {!selectedWorkspace ? (
        <div className="mt-4 rounded-xl bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
          Selecciona una estructura para ver su detalle.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5">
            <p className="text-sm font-semibold text-zinc-950">
              {selectedWorkspace.subjectName} · {selectedWorkspace.groupName}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {selectedWorkspace.institution} · {selectedWorkspace.period} · {selectedWorkspace.campus} ·{" "}
              {formatDays(selectedWorkspace.dayOfWeek1, selectedWorkspace.dayOfWeek2)} · {selectedWorkspace.jornada}
            </p>
            {selectedWorkspace.institution === "CESDE" ? (
              <p className="mt-1 text-xs text-zinc-600">
                Tipo: {selectedWorkspace.cesdeGroupType === "EMPRESARIAL" ? "Empresarial" : "Regular"}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-600">
              Fechas: {formatDateRange(selectedWorkspace.startDate, selectedWorkspace.endDate)}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {selectedWorkspace.drive.groupFolderUrl ? (
                <a
                  href={selectedWorkspace.drive.groupFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir clase
                </a>
              ) : null}
              {selectedWorkspace.drive.adminFolderUrl ? (
                <a
                  href={selectedWorkspace.drive.adminFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir privada
                </a>
              ) : null}
              {selectedWorkspace.drive.publicFolderUrl ? (
                <a
                  href={selectedWorkspace.drive.publicFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir publica
                </a>
              ) : null}
            </div>
          </div>

          {selectedNodesError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {selectedNodesError}
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold text-zinc-950">Semanas detectadas</h3>
            <p className="mt-1 text-sm text-zinc-500">Estas carpetas se reconstruyen a partir de `getStructure`.</p>
            <div className="mt-3 space-y-3">
              {selectedNodesLoading ? (
                <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
                  Cargando semanas...
                </div>
              ) : selectedWeeksByDay.length ? (
                selectedWeeksByDay.map((group) => (
                  <div key={group.weekdayLabel} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        {group.weekdayLabel}
                      </h4>
                      <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                        {group.weeks.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {group.weeks.map((week) => (
                        <div key={week.pathKey} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-zinc-950">{week.name}</p>
                              <p className="mt-0.5 text-[11px] text-zinc-500">{week.dateLabel || week.pathKey}</p>
                            </div>
                            {typeof week.meta?.week === "number" ? (
                              <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                                {week.meta.week}
                              </span>
                            ) : null}
                          </div>
                          {week.driveFolderUrl ? (
                            <a
                              href={week.driveFolderUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex h-7.5 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Abrir
                            </a>
                          ) : (
                            <p className="mt-2 text-[11px] text-zinc-400">Sin enlace disponible</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
                  No hay semanas sincronizadas todavía para esta estructura.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
