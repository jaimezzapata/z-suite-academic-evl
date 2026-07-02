"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Folder, FolderPlus, RefreshCw, Trash2, X } from "lucide-react";
import { firebaseAuth, firestore } from "@/lib/firebase/client";

type CatalogItem = { id: string; name: string };

type DriveWorkspaceRow = {
  id: string;
  institution: string;
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  period: string;
  campus: string;
  jornada: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  weekCount: number;
  startDate: string;
  year: number;
  periodCode: string;
  health?: { broken?: boolean; issues?: unknown[]; lastCheckedAt?: unknown };
  drive: {
    groupFolderUrl?: string;
    adminFolderUrl?: string;
    publicFolderUrl?: string;
    groupFolderId?: string;
    adminFolderId?: string;
    publicFolderId?: string;
  };
};

type DriveNodeRow = {
  pathKey: string;
  name: string;
  kind: string;
  driveFolderUrl: string;
  meta?: { week?: number };
};

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toWorkspaceRow(id: string, data: Record<string, unknown>): DriveWorkspaceRow {
  const drive = (data.drive as Record<string, unknown> | undefined) ?? {};
  const health = (data.health as Record<string, unknown> | undefined) ?? undefined;
  return {
    id,
    institution: toString(data.institution, ""),
    subjectId: toString(data.subjectId, ""),
    subjectName: toString(data.subjectName, toString(data.subjectId, id)),
    groupId: toString(data.groupId, ""),
    groupName: toString(data.groupName, toString(data.groupId, "")),
    period: toString(data.period, ""),
    campus: toString(data.campus, ""),
    jornada: toString(data.jornada, ""),
    dayOfWeek1: toString(data.dayOfWeek1, ""),
    dayOfWeek2: toString(data.dayOfWeek2, ""),
    weekCount: toNumber(data.weekCount, 0),
    startDate: toString(data.startDate, ""),
    year: toNumber(data.year, 0),
    periodCode: toString(data.periodCode, ""),
    health: health
      ? {
          broken: Boolean(health.broken),
          issues: Array.isArray(health.issues) ? health.issues : undefined,
          lastCheckedAt: health.lastCheckedAt,
        }
      : undefined,
    drive: {
      groupFolderUrl: toString(drive.groupFolderUrl, ""),
      adminFolderUrl: toString(drive.adminFolderUrl, ""),
      publicFolderUrl: toString(drive.publicFolderUrl, ""),
      groupFolderId: toString(drive.groupFolderId, ""),
      adminFolderId: toString(drive.adminFolderId, ""),
      publicFolderId: toString(drive.publicFolderId, ""),
    },
  };
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDays(day1: string, day2: string) {
  if (day1 && day2) return `${day1} y ${day2}`;
  return day1 || "-";
}

export function DriveDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [workspaces, setWorkspaces] = useState<DriveWorkspaceRow[]>([]);
  const [institutionTab, setInstitutionTab] = useState<"CESDE" | "SENA">("CESDE");

  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [institution, setInstitution] = useState<"CESDE" | "SENA">("CESDE");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [period, setPeriod] = useState("2026-01");
  const [campus, setCampus] = useState("Medellin");
  const [jornada, setJornada] = useState("Manana");
  const [dayOfWeek1, setDayOfWeek1] = useState("Lunes");
  const [dayOfWeek2, setDayOfWeek2] = useState("");
  const [startDate, setStartDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedNodes, setSelectedNodes] = useState<DriveNodeRow[]>([]);
  const [selectedNodesLoading, setSelectedNodesLoading] = useState(false);
  const [selectedNodesError, setSelectedNodesError] = useState<string | null>(null);

  const [pendingWorkspaceDelete, setPendingWorkspaceDelete] = useState<DriveWorkspaceRow | null>(null);
  const [workspaceDeleteError, setWorkspaceDeleteError] = useState<string | null>(null);
  const [workspaceDeletingId, setWorkspaceDeletingId] = useState<string | null>(null);
  const [workspaceSyncingId, setWorkspaceSyncingId] = useState<string | null>(null);
  const [workspaceSyncError, setWorkspaceSyncError] = useState<string | null>(null);

  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [subjectsSnap, groupsSnap, fichasSnap, workspacesCountSnap, workspacesSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "fichas"), orderBy("name"), limit(800))),
          getCountFromServer(collection(firestore, "driveWorkspaces")),
          getDocs(query(collection(firestore, "driveWorkspaces"), orderBy("updatedAt", "desc"), limit(100))),
        ]);
        if (cancelled) return;

        const rows = workspacesSnap.docs.map((doc) => toWorkspaceRow(doc.id, doc.data() as Record<string, unknown>));
        setSubjects(subjectsSnap.docs.map((doc) => ({ id: doc.id, name: toString(doc.data()?.name, doc.id) })));
        setGroups(groupsSnap.docs.map((doc) => ({ id: doc.id, name: toString(doc.data()?.name, doc.id) })));
        setFichas(fichasSnap.docs.map((doc) => ({ id: doc.id, name: toString(doc.data()?.name, doc.id) })));
        setWorkspaceCount(workspacesCountSnap.data().count);
        setWorkspaces(rows);

      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error("[drive] load error", err);
        if (!cancelled) setError("No fue posible cargar el modulo de estructuras.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;
    async function loadSelectedNodes() {
      if (!selectedWorkspaceId) {
        setSelectedNodes([]);
        setSelectedNodesError(null);
        return;
      }

      setSelectedNodesLoading(true);
      setSelectedNodesError(null);
      try {
        const snap = await getDocs(
          query(collection(firestore, "driveWorkspaces", selectedWorkspaceId, "nodes"), orderBy("pathKey"), limit(300)),
        );
        if (cancelled) return;
        const rows = snap.docs
          .map((doc) => doc.data() as Record<string, unknown>)
          .map((node) => ({
            pathKey: toString(node.pathKey, ""),
            name: toString(node.name, ""),
            kind: toString(node.kind, ""),
            driveFolderUrl: toString(node.driveFolderUrl, ""),
            meta:
              node.meta && typeof node.meta === "object"
                ? { week: toNumber((node.meta as Record<string, unknown>).week, 0) || undefined }
                : undefined,
          }))
          .filter((node) => node.pathKey && node.kind);
        setSelectedNodes(rows);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error("[drive] nodes error", err);
        if (!cancelled) {
          setSelectedNodes([]);
          setSelectedNodesError("No fue posible cargar las semanas de la estructura seleccionada.");
        }
      } finally {
        if (!cancelled) setSelectedNodesLoading(false);
      }
    }
    void loadSelectedNodes();
    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceId, refreshTick]);

  const canCreate = useMemo(() => {
    return Boolean(subjectId && groupId && period.trim() && campus.trim() && jornada.trim() && dayOfWeek1.trim() && startDate.trim());
  }, [campus, dayOfWeek1, groupId, jornada, period, startDate, subjectId]);

  async function createStructure() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setCreateError("Debes iniciar sesion como admin.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/drive/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          institution,
          subjectId,
          groupId,
          period,
          campus,
          jornada,
          dayOfWeek1,
          dayOfWeek2,
          startDate,
        }),
      });
      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        setCreateError(typeof data?.error === "string" ? data.error : `No fue posible crear (HTTP ${response.status}).`);
        return;
      }
      setCreateOpen(false);
      setRefreshTick((value) => value + 1);
    } catch {
      setCreateError("No fue posible crear la estructura.");
    } finally {
      setCreating(false);
    }
  }

  async function syncWorkspace(ws: DriveWorkspaceRow) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setWorkspaceSyncError("Debes iniciar sesion como admin.");
      return;
    }

    setWorkspaceSyncingId(ws.id);
    setWorkspaceSyncError(null);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/drive/workspaces/validate", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId: ws.id }),
      });
      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        setWorkspaceSyncError(typeof data?.error === "string" ? data.error : `No fue posible sincronizar (HTTP ${response.status}).`);
        return;
      }
      setRefreshTick((value) => value + 1);
    } catch {
      setWorkspaceSyncError("No fue posible sincronizar la estructura.");
    } finally {
      setWorkspaceSyncingId(null);
    }
  }

  async function deleteWorkspaceFromPanel(ws: DriveWorkspaceRow) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setWorkspaceDeleteError("Debes iniciar sesion como admin.");
      return;
    }

    setWorkspaceDeletingId(ws.id);
    setWorkspaceDeleteError(null);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/drive/workspaces/delete", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId: ws.id }),
      });
      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        setWorkspaceDeleteError(typeof data?.error === "string" ? data.error : `No fue posible eliminar (HTTP ${response.status}).`);
        return;
      }
      setPendingWorkspaceDelete(null);
      setRefreshTick((value) => value + 1);
    } catch {
      setWorkspaceDeleteError("No fue posible eliminar del panel.");
    } finally {
      setWorkspaceDeletingId(null);
    }
  }

  const summary = useMemo(() => {
    const totalWeeks = workspaces.reduce((acc, workspace) => acc + workspace.weekCount, 0);
    const cesde = workspaces.filter((workspace) => workspace.institution === "CESDE").length;
    const sena = workspaces.filter((workspace) => workspace.institution === "SENA").length;
    const broken = workspaces.filter((workspace) => workspace.health?.broken).length;
    return { totalWeeks, cesde, sena, broken };
  }, [workspaces]);

  const tabWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.institution === institutionTab),
    [institutionTab, workspaces],
  );

  useEffect(() => {
    if (!tabWorkspaces.length) {
      if (selectedWorkspaceId) setSelectedWorkspaceId("");
      return;
    }
    if (!selectedWorkspaceId || !tabWorkspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(tabWorkspaces[0]!.id);
    }
  }, [institutionTab, selectedWorkspaceId, tabWorkspaces]);

  const selectedWorkspace = useMemo(
    () => tabWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, tabWorkspaces],
  );
  const selectedWeeks = useMemo(
    () =>
      selectedNodes
        .filter((node) => node.kind === "week")
        .sort((a, b) => (a.meta?.week ?? 0) - (b.meta?.week ?? 0)),
    [selectedNodes],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Estructuras Drive</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Crea, consulta y sincroniza las estructuras academicas generadas por tu Apps Script.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <FolderPlus className="h-4 w-4" />
            Crear estructura
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {workspaceSyncError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{workspaceSyncError}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Estructuras</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{loading ? "-" : formatCompactNumber(workspaceCount)}</p>
          <p className="mt-1 text-xs text-zinc-500">Registradas en el panel</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Semanas detectadas</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{loading ? "-" : formatCompactNumber(summary.totalWeeks)}</p>
          <p className="mt-1 text-xs text-zinc-500">Sincronizadas desde Apps Script</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">CESDE / SENA</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{loading ? "-" : `${summary.cesde} / ${summary.sena}`}</p>
          <p className="mt-1 text-xs text-zinc-500">Distribucion por institucion</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Pendientes de revision</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{loading ? "-" : formatCompactNumber(summary.broken)}</p>
          <p className="mt-1 text-xs text-zinc-500">Con error de sincronizacion</p>
        </div>
      </section>

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
            const count = workspaces.filter((workspace) => workspace.institution === tab).length;
            const active = institutionTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setInstitutionTab(tab)}
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

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tabWorkspaces.length ? (
            tabWorkspaces.map((workspace) => (
              <div
                key={workspace.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedWorkspaceId((prev) => (prev === workspace.id ? "" : workspace.id))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedWorkspaceId((prev) => (prev === workspace.id ? "" : workspace.id));
                  }
                }}
                className={`group rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                  selectedWorkspaceId === workspace.id
                    ? "border-indigo-200 ring-4 ring-indigo-500/10"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                } cursor-pointer focus:outline-none focus:ring-4 focus:ring-indigo-500/10`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-950">{workspace.subjectName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{workspace.groupName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {workspace.institution} · {workspace.period} · {workspace.campus}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDays(workspace.dayOfWeek1, workspace.dayOfWeek2)} · {workspace.jornada}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{workspace.weekCount} semanas</p>
                    {workspace.health?.broken ? (
                      <p className="mt-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        Requiere sincronizacion
                      </p>
                    ) : null}
                  </div>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white">
                    <Folder className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {workspace.drive.groupFolderUrl ? (
                    <a
                      href={workspace.drive.groupFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Clase
                    </a>
                  ) : null}
                  {workspace.drive.adminFolderUrl ? (
                    <a
                      href={workspace.drive.adminFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Privada
                    </a>
                  ) : null}
                  {workspace.drive.publicFolderUrl ? (
                    <a
                      href={workspace.drive.publicFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Publica
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void syncWorkspace(workspace);
                    }}
                    disabled={workspaceSyncingId === workspace.id}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {workspaceSyncingId === workspace.id ? "Sincronizando..." : "Sincronizar"}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setWorkspaceDeleteError(null);
                      setPendingWorkspaceDelete(workspace);
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
              {loading ? "Cargando..." : `Aun no hay estructuras creadas para ${institutionTab}.`}
            </div>
          )}
        </div>
      </section>

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
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-950">
                {selectedWorkspace.subjectName} · {selectedWorkspace.groupName}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {selectedWorkspace.institution} · {selectedWorkspace.period} · {selectedWorkspace.campus} ·{" "}
                {formatDays(selectedWorkspace.dayOfWeek1, selectedWorkspace.dayOfWeek2)} · {selectedWorkspace.jornada}
              </p>
              <p className="mt-1 text-sm text-zinc-600">Inicio: {selectedWorkspace.startDate || "-"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedWorkspace.drive.groupFolderUrl ? (
                  <a
                    href={selectedWorkspace.drive.groupFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir clase
                  </a>
                ) : null}
                {selectedWorkspace.drive.adminFolderUrl ? (
                  <a
                    href={selectedWorkspace.drive.adminFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir privada
                  </a>
                ) : null}
                {selectedWorkspace.drive.publicFolderUrl ? (
                  <a
                    href={selectedWorkspace.drive.publicFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <ExternalLink className="h-4 w-4" />
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
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {selectedNodesLoading ? (
                  <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">Cargando semanas...</div>
                ) : selectedWeeks.length ? (
                  selectedWeeks.map((week) => (
                    <div key={week.pathKey} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <p className="text-sm font-semibold text-zinc-950">{week.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{week.pathKey}</p>
                      {week.driveFolderUrl ? (
                        <a
                          href={week.driveFolderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Abrir
                        </a>
                      ) : (
                        <p className="mt-3 text-xs text-zinc-400">Sin enlace disponible</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
                    No hay semanas sincronizadas todavia para esta estructura.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {createOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => (creating ? null : setCreateOpen(false))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950">Crear estructura</p>
                  <p className="mt-1 text-xs text-zinc-500">Formulario alineado con el Apps Script de Google.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                  disabled={creating}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
                {createError ? (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Institucion</span>
                    <select
                      value={institution}
                      onChange={(event) => {
                        const next = event.target.value === "SENA" ? "SENA" : "CESDE";
                        setInstitution(next);
                        setGroupId("");
                      }}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="CESDE">CESDE</option>
                      <option value="SENA">SENA</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Materia</span>
                    <select
                      value={subjectId}
                      onChange={(event) => setSubjectId(event.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">Selecciona materia</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">{institution === "SENA" ? "Ficha" : "Grupo"}</span>
                    <select
                      value={groupId}
                      onChange={(event) => setGroupId(event.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">{institution === "SENA" ? "Selecciona ficha" : "Selecciona grupo"}</option>
                      {(institution === "SENA" ? fichas : groups).map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Periodo</span>
                    <select
                      value={period}
                      onChange={(event) => setPeriod(event.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="2026-01">2026-01</option>
                      <option value="2026-02">2026-02</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Sede</span>
                    <select
                      value={campus}
                      onChange={(event) => setCampus(event.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="Medellin">Medellin</option>
                      <option value="Bello">Bello</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Jornada</span>
                    <select
                      value={jornada}
                      onChange={(event) => setJornada(event.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="Manana">Manana</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noche">Noche</option>
                      <option value="Sabado">Sabado</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Dia 1</span>
                    <select
                      value={dayOfWeek1}
                      onChange={(event) => setDayOfWeek1(event.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="Lunes">Lunes</option>
                      <option value="Martes">Martes</option>
                      <option value="Miercoles">Miercoles</option>
                      <option value="Jueves">Jueves</option>
                      <option value="Viernes">Viernes</option>
                      <option value="Sabado">Sabado</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Dia 2 (opcional)</span>
                    <select
                      value={dayOfWeek2}
                      onChange={(event) => setDayOfWeek2(event.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">Sin segundo dia</option>
                      <option value="Lunes">Lunes</option>
                      <option value="Martes">Martes</option>
                      <option value="Miercoles">Miercoles</option>
                      <option value="Jueves">Jueves</option>
                      <option value="Viernes">Viernes</option>
                      <option value="Sabado">Sabado</option>
                    </select>
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs font-semibold text-zinc-700">Fecha inicio</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                  className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void createStructure()}
                  disabled={!canCreate || creating}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FolderPlus className="h-4 w-4" />
                  {creating ? "Creando..." : "Crear estructura"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingWorkspaceDelete ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => (workspaceDeletingId ? null : setPendingWorkspaceDelete(null))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950">Eliminar del panel</p>
                  <p className="mt-1 text-sm text-zinc-600">Esto no borra carpetas en Drive, solo el registro local en Firestore.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingWorkspaceDelete(null)}
                  className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                  disabled={!!workspaceDeletingId}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-5 py-4">
                {workspaceDeleteError ? (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{workspaceDeleteError}</div>
                ) : null}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-xs font-semibold text-zinc-500">Estructura</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    {pendingWorkspaceDelete.institution} · {pendingWorkspaceDelete.period} · {pendingWorkspaceDelete.campus} ·{" "}
                    {pendingWorkspaceDelete.groupName}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-zinc-500">ID</p>
                  <p className="mt-1 font-mono text-xs text-zinc-700">{pendingWorkspaceDelete.id}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setPendingWorkspaceDelete(null)}
                  disabled={!!workspaceDeletingId}
                  className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void deleteWorkspaceFromPanel(pendingWorkspaceDelete)}
                  disabled={workspaceDeletingId === pendingWorkspaceDelete.id}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {workspaceDeletingId === pendingWorkspaceDelete.id ? "Eliminando..." : "Eliminar del panel"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
