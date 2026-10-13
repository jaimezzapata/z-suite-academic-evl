"use client";

import { ExternalLink, Folder, RefreshCw, Trash2 } from "lucide-react";
import { getSubjectTechnologyMeta } from "@/lib/subject-tech-branding";
import type { DriveWorkspaceRow } from "../types";
import { formatDays, getDriveActionTone } from "../services/drive-service";

interface DriveWorkspacesListProps {
  institutionTab: "CESDE" | "SENA";
  onTabChange: (tab: "CESDE" | "SENA") => void;
  displayWorkspaces: DriveWorkspaceRow[];
  tabWorkspaces: DriveWorkspaceRow[];
  selectedWorkspaceId: string;
  onSelectWorkspaceId: (id: string) => void;
  workspaceSyncingId: string | null;
  onSyncWorkspace: (ws: DriveWorkspaceRow) => void;
  onDeleteWorkspace: (ws: DriveWorkspaceRow) => void;
  loading: boolean;
}

export function DriveWorkspacesList({
  institutionTab,
  onTabChange,
  displayWorkspaces,
  tabWorkspaces,
  selectedWorkspaceId,
  onSelectWorkspaceId,
  workspaceSyncingId,
  onSyncWorkspace,
  onDeleteWorkspace,
  loading,
}: DriveWorkspacesListProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Estructuras creadas</h2>
          <p className="text-sm text-zinc-500">Selecciona una pestaña para ver los grupos de CESDE o SENA.</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
          <Folder className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["CESDE", "SENA"] as const).map((tab) => {
          const count = displayWorkspaces.filter((w) => w.institution === tab).length;
          const active = institutionTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                active
                  ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <span>{tab}</span>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tabWorkspaces.length ? (
          tabWorkspaces.map((workspace) => {
            const techMeta = getSubjectTechnologyMeta(workspace.subjectName);
            const PrimaryIcon = techMeta?.primaryIcon;
            const SecondaryIcon = techMeta?.secondaryIcon;
            const actionTone = getDriveActionTone(workspace.subjectName);
            const isSelected = selectedWorkspaceId === workspace.id;

            return (
              <div
                key={workspace.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectWorkspaceId(isSelected ? "" : workspace.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectWorkspaceId(isSelected ? "" : workspace.id);
                  }
                }}
                className={`group relative overflow-hidden rounded-xl border p-3 text-left shadow-sm transition cursor-pointer focus:outline-none ${
                  isSelected
                    ? techMeta?.driveSelectedClassName ?? "border-indigo-200 ring-4 ring-indigo-500/10"
                    : techMeta?.driveCardClassName ?? "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {techMeta && PrimaryIcon ? (
                  <div className={`pointer-events-none absolute -bottom-2 -right-2 ${techMeta.watermarkClassName}`}>
                    <PrimaryIcon className="h-12 w-12" />
                  </div>
                ) : null}

                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {techMeta && PrimaryIcon ? (
                          <span
                            className={`inline-flex items-center rounded-full border px-1 py-0.5 ${techMeta.badgeClassName}`}
                            aria-label={techMeta.label}
                            title={techMeta.label}
                          >
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-1 ${techMeta.iconWrapClassName}`}>
                              <PrimaryIcon className={techMeta.iconClassName} />
                              {SecondaryIcon ? <SecondaryIcon className={techMeta.iconClassName} /> : null}
                            </span>
                          </span>
                        ) : null}
                        <span className="inline-flex rounded-full border border-zinc-200 bg-white/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
                          {workspace.institution}
                        </span>
                      </div>

                      <p className="mt-1.5 truncate text-[13px] font-bold tracking-tight text-zinc-950">
                        {workspace.subjectName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-600">{workspace.groupName}</p>

                      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-zinc-600">
                        <p className="truncate">
                          <span className="font-semibold text-zinc-700">{workspace.period}</span> · {workspace.campus}
                        </p>
                        <p className="truncate text-right">
                          {workspace.weekCount}{" "}
                          {workspace.institution === "CESDE" && workspace.cesdeGroupType === "EMPRESARIAL"
                            ? "ses."
                            : "sem."}
                        </p>
                        <p className="col-span-2 truncate">
                          {formatDays(workspace.dayOfWeek1, workspace.dayOfWeek2)} · {workspace.jornada}
                        </p>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {workspace.institution === "CESDE" ? (
                          <span className="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-700">
                            {workspace.cesdeGroupType === "EMPRESARIAL" ? "CESDE empresarial" : "CESDE regular"}
                          </span>
                        ) : null}
                        {workspace.health?.broken ? (
                          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">
                            Requiere sincronizacion
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                        techMeta?.iconWrapClassName ?? "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {techMeta && PrimaryIcon ? (
                        <PrimaryIcon className="h-3.5 w-3.5" />
                      ) : (
                        <Folder className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </div>

                  {!workspace.optimistic ? (
                    <div className="mt-2 border-t border-zinc-200/70 pt-2">
                      <div className="flex flex-wrap gap-1.5">
                        {workspace.drive.groupFolderUrl ? (
                          <a
                            href={workspace.drive.groupFolderUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className={`inline-flex h-7 min-w-[74px] flex-1 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-semibold ${actionTone.link}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Clase
                          </a>
                        ) : null}
                        {workspace.drive.adminFolderUrl ? (
                          <a
                            href={workspace.drive.adminFolderUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className={`inline-flex h-7 min-w-[74px] flex-1 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-semibold ${actionTone.link}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Privada
                          </a>
                        ) : null}
                        {workspace.drive.publicFolderUrl ? (
                          <a
                            href={workspace.drive.publicFolderUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className={`inline-flex h-7 min-w-[74px] flex-1 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-semibold ${actionTone.link}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Publica
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onSyncWorkspace(workspace);
                          }}
                          disabled={workspaceSyncingId === workspace.id}
                          className={`inline-flex h-7 min-w-[88px] flex-1 items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionTone.primary}`}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {workspaceSyncingId === workspace.id ? "Sincronizando..." : "Sincronizar"}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onDeleteWorkspace(workspace);
                          }}
                          className={`inline-flex h-7 min-w-[88px] flex-1 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-semibold transition ${actionTone.danger}`}
                        >
                          <Trash2 className="h-3 w-3" />
                          Quitar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
            {loading ? "Cargando..." : `Aun no hay estructuras creadas para ${institutionTab}.`}
          </div>
        )}
      </div>
    </section>
  );
}
