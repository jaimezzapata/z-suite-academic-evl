"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  FileArchive,
  FileCode2,
  FileText,
  Folder,
  FolderPlus,
  FolderUp,
  Image as ImageIcon,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { firestore, firebaseAuth } from "@/lib/firebase/client";

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
  shift: string;
  weekCount: number;
  startDate: string;
  endDate: string;
  stats?: { totalFiles?: number; docsFiles?: number; starredFiles?: number };
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
};

type DriveFileRow = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  webViewLink: string;
  workspaceId: string;
  pathKey: string;
  starred: boolean;
  updatedAt: Date | null;
};

type DriveMetaStats = {
  totalFiles: number;
  docsFiles: number;
  starredFiles: number;
  workspaces: number;
};

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toWorkspaceRow(id: string, data: Record<string, unknown>): DriveWorkspaceRow {
  const drive = (data.drive as Record<string, unknown> | undefined) ?? {};
  const stats = (data.stats as Record<string, unknown> | undefined) ?? undefined;
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
    shift: toString(data.shift, ""),
    weekCount: toNumber(data.weekCount, 0),
    startDate: toString(data.startDate, ""),
    endDate: toString(data.endDate, ""),
    stats: stats
      ? {
          totalFiles: toNumber(stats.totalFiles, 0),
          docsFiles: toNumber(stats.docsFiles, 0),
          starredFiles: toNumber(stats.starredFiles, 0),
        }
      : undefined,
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

function toDate(value: unknown): Date | null {
  if (!value || typeof value !== "object") return null;
  try {
    if ("toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate();
    }
  } catch {
    return null;
  }
  return null;
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function fileKind(mimeType: string) {
  const m = mimeType.toLowerCase();
  if (m.includes("pdf") || m.startsWith("application/vnd.google-apps")) return "doc";
  if (m.startsWith("image/")) return "image";
  if (m.includes("zip") || m.includes("rar") || m.includes("7z")) return "archive";
  if (m.includes("javascript") || m.includes("typescript") || m.includes("json") || m.includes("text/")) return "code";
  return "file";
}

export function DriveDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [workspaces, setWorkspaces] = useState<DriveWorkspaceRow[]>([]);
  const [metaStats, setMetaStats] = useState<DriveMetaStats>({ totalFiles: 0, docsFiles: 0, starredFiles: 0, workspaces: 0 });
  const [recentFiles, setRecentFiles] = useState<DriveFileRow[]>([]);

  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [institution, setInstitution] = useState<"CESDE" | "SENA">("CESDE");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [period, setPeriod] = useState("2026-01");
  const [campus, setCampus] = useState("Medellin");
  const shift = "";
  const [mode, setMode] = useState<"fixedWeeks" | "range">("fixedWeeks");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadWorkspace, setUploadWorkspace] = useState<DriveWorkspaceRow | null>(null);
  const [uploadNodes, setUploadNodes] = useState<DriveNodeRow[]>([]);
  const [uploadPathKey, setUploadPathKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "doc" | "image" | "archive" | "code">("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [refreshTick, setRefreshTick] = useState(0);
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [driveConnectError, setDriveConnectError] = useState<string | null>(null);
  const [pendingWorkspaceDelete, setPendingWorkspaceDelete] = useState<DriveWorkspaceRow | null>(null);
  const [workspaceDeleteError, setWorkspaceDeleteError] = useState<string | null>(null);
  const [workspaceDeletingId, setWorkspaceDeletingId] = useState<string | null>(null);
  const [workspaceValidatingId, setWorkspaceValidatingId] = useState<string | null>(null);
  const [workspaceValidateError, setWorkspaceValidateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setFilesError(null);
      try {
        const [subjectsSnap, groupsSnap, fichasSnap, workspacesCountSnap, workspacesSnap, statsSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "fichas"), orderBy("name"), limit(800))),
          getCountFromServer(collection(firestore, "driveWorkspaces")),
          getDocs(query(collection(firestore, "driveWorkspaces"), orderBy("updatedAt", "desc"), limit(30))),
          getDoc(doc(firestore, "driveMeta", "stats")),
        ]);
        if (cancelled) return;

        setSubjects(subjectsSnap.docs.map((d) => ({ id: d.id, name: toString(d.data()?.name, d.id) })));
        setGroups(groupsSnap.docs.map((d) => ({ id: d.id, name: toString(d.data()?.name, d.id) })));
        setFichas(fichasSnap.docs.map((d) => ({ id: d.id, name: toString(d.data()?.name, d.id) })));
        setWorkspaceCount(workspacesCountSnap.data().count);
        setWorkspaces(workspacesSnap.docs.map((d) => toWorkspaceRow(d.id, d.data() as Record<string, unknown>)));

        if (statsSnap.exists()) {
          const row = statsSnap.data() as Record<string, unknown>;
          setMetaStats({
            totalFiles: toNumber(row.totalFiles, 0),
            docsFiles: toNumber(row.docsFiles, 0),
            starredFiles: toNumber(row.starredFiles, 0),
            workspaces: toNumber(row.workspaces, workspacesCountSnap.data().count),
          });
        } else {
          setMetaStats((prev) => ({ ...prev, workspaces: workspacesCountSnap.data().count }));
        }

        try {
          const filesSnap = await getDocs(
            query(collection(firestore, "driveFiles"), orderBy("updatedAt", "desc"), limit(24)),
          );
          if (cancelled) return;
          setRecentFiles(
            filesSnap.docs.map((d) => {
              const row = d.data() as Record<string, unknown>;
              return {
                id: toString(row.id, d.id),
                name: toString(row.name, d.id),
                mimeType: toString(row.mimeType, "application/octet-stream"),
                size: typeof row.size === "number" && Number.isFinite(row.size) ? row.size : null,
                webViewLink: toString(row.webViewLink, ""),
                workspaceId: toString(row.workspaceId, ""),
                pathKey: toString(row.pathKey, ""),
                starred: row.starred === true,
                updatedAt: toDate(row.updatedAt),
              };
            }),
          );
        } catch (err) {
          if (process.env.NODE_ENV !== "production") console.error("[drive] recent files error", err);
          setFilesError("No fue posible cargar los archivos recientes.");
          setRecentFiles([]);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error("[drive] load error", err);
        if (!cancelled) setError("No fue posible cargar el módulo de Drive.");
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
    async function loadStatus() {
      setDriveConnectError(null);
      try {
        const user = firebaseAuth.currentUser;
        if (!user) {
          setDriveConnected(false);
          return;
        }
        const token = await user.getIdToken(true);
        const res = await fetch("/api/admin/drive/oauth/status", {
          method: "GET",
          headers: { authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok) {
          if (!cancelled) {
            setDriveConnected(false);
            setDriveConnectError(typeof data?.error === "string" ? data.error : `No fue posible validar Drive (HTTP ${res.status}).`);
          }
          return;
        }
        if (!cancelled) setDriveConnected(Boolean(data?.connected));
      } catch {
        if (!cancelled) {
          setDriveConnected(false);
          setDriveConnectError("No fue posible validar la conexión a Drive.");
        }
      }
    }
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  async function connectDrive() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setDriveConnectError("Debes iniciar sesión como admin.");
      return;
    }
    setDriveConnectError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/drive/oauth/url", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setDriveConnectError(typeof data?.error === "string" ? data.error : `No fue posible iniciar conexión (HTTP ${res.status}).`);
        return;
      }
      const url = typeof data?.url === "string" ? data.url : "";
      if (!url) {
        setDriveConnectError("No fue posible iniciar conexión.");
        return;
      }
      window.location.href = url;
    } catch {
      setDriveConnectError("No fue posible iniciar la conexión a Drive.");
    }
  }

  async function validateWorkspace(ws: DriveWorkspaceRow) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setWorkspaceValidateError("Debes iniciar sesión como admin.");
      return;
    }
    setWorkspaceValidatingId(ws.id);
    setWorkspaceValidateError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/drive/workspaces/validate", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId: ws.id }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setWorkspaceValidateError(typeof data?.error === "string" ? data.error : `No fue posible validar (HTTP ${res.status}).`);
        return;
      }
      setRefreshTick((x) => x + 1);
    } catch {
      setWorkspaceValidateError("No fue posible validar la estructura.");
    } finally {
      setWorkspaceValidatingId(null);
    }
  }

  async function deleteWorkspaceFromPanel(ws: DriveWorkspaceRow) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setWorkspaceDeleteError("Debes iniciar sesión como admin.");
      return;
    }
    setWorkspaceDeletingId(ws.id);
    setWorkspaceDeleteError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/drive/workspaces/delete", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId: ws.id }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setWorkspaceDeleteError(typeof data?.error === "string" ? data.error : `No fue posible eliminar (HTTP ${res.status}).`);
        return;
      }
      setPendingWorkspaceDelete(null);
      setWorkspaces((prev) => prev.filter((w) => w.id !== ws.id));
      setRefreshTick((x) => x + 1);
    } catch {
      setWorkspaceDeleteError("No fue posible eliminar del panel.");
    } finally {
      setWorkspaceDeletingId(null);
    }
  }

  const canCreate = useMemo(() => {
    if (!subjectId || !groupId || !period.trim() || !campus.trim() || !startDate.trim()) return false;
    if (mode === "range" && !endDate.trim()) return false;
    return true;
  }, [campus, endDate, groupId, mode, period, startDate, subjectId]);

  async function createStructure() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setCreateError("Debes iniciar sesión como admin.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/drive/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          institution,
          subjectId,
          groupId,
          period,
          campus,
          shift,
          mode,
          startDate,
          endDate: mode === "range" ? endDate : "",
        }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setCreateError(typeof data?.error === "string" ? data.error : `No fue posible crear (HTTP ${res.status}).`);
        return;
      }
      setCreateOpen(false);
      setRefreshTick((x) => x + 1);
    } catch {
      setCreateError("No fue posible crear la estructura en Drive.");
    } finally {
      setCreating(false);
    }
  }

  async function loadUploadNodes(ws: DriveWorkspaceRow) {
    const snap = await getDocs(query(collection(firestore, "driveWorkspaces", ws.id, "nodes"), limit(300)));
    const nodes = snap.docs
      .map((d) => d.data() as Record<string, unknown>)
      .map((n) => ({
        pathKey: toString(n.pathKey, ""),
        name: toString(n.name, ""),
        kind: toString(n.kind, ""),
        driveFolderUrl: toString(n.driveFolderUrl, ""),
      }))
      .filter((n) => n.pathKey && n.kind);
    setUploadNodes(nodes);
    const week = nodes.find((n) => n.kind === "week");
    setUploadPathKey(week?.pathKey || "publica");
  }

  async function openUpload(ws?: DriveWorkspaceRow) {
    setUploadFile(null);
    setUploadError(null);
    setUploadNodes([]);
    setUploadPathKey("publica");
    setUploadWorkspace(ws ?? null);
    setUploadOpen(true);
    try {
      if (ws) await loadUploadNodes(ws);
    } catch {
      setUploadError("No fue posible cargar destinos de Drive.");
    }
  }

  function closeUpload() {
    if (uploading) return;
    setUploadOpen(false);
    setUploadWorkspace(null);
    setUploadNodes([]);
    setUploadPathKey("");
    setUploadFile(null);
    setUploadError(null);
  }

  const uploadOptions = useMemo(() => {
    const nodes = uploadNodes;
    const weeks = nodes.filter((n) => n.kind === "week");
    const admin = nodes.find((n) => n.kind === "admin");
    const pub = nodes.find((n) => n.kind === "public");

    const options: Array<{ value: string; label: string }> = [];
    if (admin) options.push({ value: admin.pathKey, label: "admin" });
    if (pub) options.push({ value: pub.pathKey, label: "publica (raíz)" });
    weeks.forEach((w) => options.push({ value: w.pathKey, label: w.name || w.pathKey }));
    return options;
  }, [uploadNodes]);

  async function submitUpload() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setUploadError("Debes iniciar sesión como admin.");
      return;
    }
    if (!uploadWorkspace) return;
    if (!uploadPathKey.trim()) {
      setUploadError("Selecciona un destino.");
      return;
    }
    if (!uploadFile) {
      setUploadError("Selecciona un archivo.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const token = await user.getIdToken(true);
      const form = new FormData();
      form.set("workspaceId", uploadWorkspace.id);
      form.set("pathKey", uploadPathKey);
      form.set("file", uploadFile);

      const res = await fetch("/api/admin/drive/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setUploadError(typeof data?.error === "string" ? data.error : `No fue posible subir (HTTP ${res.status}).`);
        return;
      }
      closeUpload();
      setRefreshTick((x) => x + 1);
    } catch {
      setUploadError("No fue posible subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  const workspaceNameById = useMemo(() => new Map(workspaces.map((w) => [w.id, w.subjectName])), [workspaces]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recentFiles
      .filter((f) => {
        if (selectedWorkspaceId && f.workspaceId !== selectedWorkspaceId) return false;
        if (starredOnly && !f.starred) return false;
        if (typeFilter !== "all" && fileKind(f.mimeType) !== typeFilter) return false;
        if (q && !f.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        const at = a.updatedAt ? a.updatedAt.getTime() : 0;
        const bt = b.updatedAt ? b.updatedAt.getTime() : 0;
        return bt - at;
      });
  }, [recentFiles, search, selectedWorkspaceId, sort, starredOnly, typeFilter]);

  const folderCards = useMemo(() => {
    return workspaces.map((w) => {
      const totalFiles = w.stats?.totalFiles ?? 0;
      return { ...w, totalFiles };
    });
  }, [workspaces]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Drive Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Vista completa de tus archivos organizados por materia, grupo y semana.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {driveConnected === true ? null : (
            <button
              type="button"
              onClick={() => void connectDrive()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <ExternalLink className="h-4 w-4" />
              Conectar Drive
            </button>
          )}
          <button
            type="button"
            onClick={() => void openUpload()}
            disabled={driveConnected !== true}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Upload className="h-4 w-4" />
            Subir archivo
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            disabled={driveConnected !== true}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            <FolderPlus className="h-4 w-4" />
            Crear estructura
          </button>
        </div>
      </div>

      {driveConnected === false ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Conecta tu Drive personal para poder crear carpetas y subir archivos (usa tu cuota de Google One).
        </div>
      ) : null}
      {driveConnectError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {driveConnectError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Total de archivos</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            {loading ? "-" : formatCompactNumber(metaStats.totalFiles)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">En todas las estructuras</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">PDFs / Documentos</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            {loading ? "-" : formatCompactNumber(metaStats.docsFiles)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Incluye Google Docs</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Marcados con ⭐</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            {loading ? "-" : formatCompactNumber(metaStats.starredFiles)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Favoritos</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Carpetas activas</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            {loading ? "-" : formatCompactNumber(workspaceCount)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Estructuras creadas</p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Carpetas</h2>
            <p className="text-sm text-zinc-500">Acceso rápido por materia y grupo.</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
            <Folder className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folderCards.length ? (
            folderCards.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => setSelectedWorkspaceId((prev) => (prev === ws.id ? "" : ws.id))}
                className={`group rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                  selectedWorkspaceId === ws.id
                    ? "border-indigo-200 ring-4 ring-indigo-500/10"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-950">{ws.subjectName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {ws.institution} · {ws.period} · {ws.campus}
                      {ws.shift ? ` · ${ws.shift}` : ""} · {ws.groupName}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{ws.totalFiles} archivos</p>
                    {ws.health?.broken ? (
                      <p className="mt-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        Enlace roto
                      </p>
                    ) : null}
                  </div>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white">
                    <Folder className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void openUpload(ws);
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800"
                  >
                    <FolderUp className="h-4 w-4" />
                    Subir
                  </button>
                  {ws.drive.publicFolderUrl ? (
                    <a
                      href={ws.drive.publicFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void validateWorkspace(ws);
                    }}
                    disabled={workspaceValidatingId === ws.id}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {workspaceValidatingId === ws.id ? "Validando..." : "Validar"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setWorkspaceDeleteError(null);
                      setPendingWorkspaceDelete(ws);
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar del panel
                  </button>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
              {loading ? "Cargando..." : "Aún no hay estructuras creadas."}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Archivos</h2>
            <p className="text-sm text-zinc-500">Recientes y filtrables.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar archivos..."
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
              />
            </div>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 sm:w-[260px]"
            >
              <option value="">Todas las carpetas</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.subjectName} · {w.groupName}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all" || v === "doc" || v === "image" || v === "archive" || v === "code") setTypeFilter(v);
              }}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 sm:w-[190px]"
            >
              <option value="all">Todos</option>
              <option value="doc">Documentos</option>
              <option value="code">Código</option>
              <option value="image">Imágenes</option>
              <option value="archive">Comprimidos</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value === "name" ? "name" : "recent")}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 sm:w-[170px]"
            >
              <option value="recent">Más recientes</option>
              <option value="name">Nombre</option>
            </select>
            <button
              type="button"
              onClick={() => setStarredOnly((v) => !v)}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                starredOnly
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              <Star className="h-4 w-4" />
              Destacados
            </button>
          </div>
        </div>

        {filesError ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {filesError}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredFiles.length ? (
            filteredFiles.map((f) => {
              const kind = fileKind(f.mimeType);
              const Icon =
                kind === "doc"
                  ? FileText
                  : kind === "image"
                    ? ImageIcon
                    : kind === "archive"
                      ? FileArchive
                      : kind === "code"
                        ? FileCode2
                        : FileText;
              const folderLabel = workspaceNameById.get(f.workspaceId) ?? f.workspaceId;
              return (
                <div key={f.id} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <button
                      type="button"
                      disabled
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition ${
                        f.starred ? "border-amber-200 bg-amber-50 text-amber-700" : "border-zinc-200 bg-white text-zinc-400"
                      }`}
                      title="Destacar (próximo)"
                      aria-label="Destacar"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="px-4 pb-4">
                    <p className="line-clamp-2 text-sm font-semibold text-zinc-950">{f.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{folderLabel}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        {kind === "doc"
                          ? "DOC"
                          : kind === "image"
                            ? "IMG"
                            : kind === "archive"
                              ? "ZIP"
                              : kind === "code"
                                ? "CODE"
                                : "FILE"}
                      </span>
                      {f.webViewLink ? (
                        <a
                          href={f.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Abrir
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-400">Sin link</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              {loading ? "Cargando..." : "No hay archivos para mostrar con esos filtros."}
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {uploadOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeUpload}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950">Subir archivo</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {uploadWorkspace ? `${uploadWorkspace.subjectName} · ${uploadWorkspace.groupName}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeUpload}
                  className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                  disabled={uploading}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-5 py-4">
                {uploadError ? (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {uploadError}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs font-semibold text-zinc-700">Estructura</span>
                    <select
                      value={uploadWorkspace?.id ?? ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        const ws = workspaces.find((w) => w.id === id) ?? null;
                        setUploadWorkspace(ws);
                        setUploadNodes([]);
                        setUploadPathKey("publica");
                        if (ws) {
                          setUploadError(null);
                          void loadUploadNodes(ws).catch(() => setUploadError("No fue posible cargar destinos de Drive."));
                        }
                      }}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">Selecciona una estructura</option>
                      {workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.subjectName} · {w.groupName} · {w.period}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs font-semibold text-zinc-700">Destino</span>
                    <select
                      value={uploadPathKey}
                      onChange={(e) => setUploadPathKey(e.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      {uploadWorkspace ? (
                        uploadOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))
                      ) : (
                        <option value="">Selecciona una estructura primero</option>
                      )}
                    </select>
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs font-semibold text-zinc-700">Archivo</span>
                    <input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={closeUpload}
                  disabled={uploading}
                  className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void submitUpload()}
                  disabled={uploading || !uploadFile || !uploadPathKey.trim() || !uploadWorkspace}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FolderUp className="h-4 w-4" />
                  {uploading ? "Subiendo..." : "Subir a Drive"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

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
                  <p className="mt-1 text-xs text-zinc-500">Plantilla por institución con semanas y fechas.</p>
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
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {createError}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Institución</span>
                    <select
                      value={institution}
                      onChange={(e) => {
                        const next = e.target.value === "SENA" ? "SENA" : "CESDE";
                        setInstitution(next);
                        setGroupId("");
                      }}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="CESDE">CESDE (18 semanas, M1–M3)</option>
                      <option value="SENA">SENA (11 semanas)</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Materia</span>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
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
                    <span className="text-xs font-semibold text-zinc-700">{institution === "SENA" ? "Ficha" : "Grupo"}</span>
                    <select
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">{institution === "SENA" ? "Selecciona ficha" : "Selecciona grupo"}</option>
                      {(institution === "SENA" ? fichas : groups).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Periodo</span>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
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
                      onChange={(e) => setCampus(e.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="Medellin">Medellin</option>
                      <option value="Bello">Bello</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Modo de calendario</span>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value === "range" ? "range" : "fixedWeeks")}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="fixedWeeks">Inicio + semanas exactas</option>
                      <option value="range">Inicio + fin (validación)</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Fecha inicio</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    />
                  </label>

                  {mode === "range" ? (
                    <label className="grid gap-1 sm:col-span-2">
                      <span className="text-xs font-semibold text-zinc-700">Fecha fin</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                      />
                    </label>
                  ) : null}
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
                  {creating ? "Creando..." : "Crear estructura en Drive"}
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
                  <p className="mt-1 text-sm text-zinc-600">Esto no borra carpetas en Drive, solo el registro en el panel.</p>
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
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {workspaceDeleteError}
                  </div>
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
