"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { collection, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  CalendarDays,
  Clock3,
  DoorOpen,
  ExternalLink,
  Folder,
  FolderPlus,
  GraduationCap,
  Hash,
  Layers3,
  MapPinned,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";
import { getSubjectTechnologyMeta } from "@/lib/subject-tech-branding";

type CatalogItem = { id: string; name: string };

type DriveWorkspaceRow = {
  id: string;
  institution: string;
  cesdeGroupType: "REGULAR" | "EMPRESARIAL" | string;
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  period: string;
  campus: string;
  jornada: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  startTime: string;
  endTime: string;
  day2StartTime: string;
  day2EndTime: string;
  weekCount: number;
  startDate: string;
  endDate: string;
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
  optimistic?: boolean;
};

type DriveNodeRow = {
  pathKey: string;
  name: string;
  kind: string;
  driveFolderUrl: string;
  meta?: { week?: number };
};

type DriveFormSectionProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
};

const WORKLOAD_FOCUS_STORAGE_KEY = "workload-focus";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCesdeGroupType(value: unknown) {
  return toString(value, "").trim().toUpperCase() === "EMPRESARIAL" ? "EMPRESARIAL" : "REGULAR";
}

const WEEK_DAY_OPTIONS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"] as const;

function toWorkspaceRow(id: string, data: Record<string, unknown>): DriveWorkspaceRow {
  const drive = (data.drive as Record<string, unknown> | undefined) ?? {};
  const health = (data.health as Record<string, unknown> | undefined) ?? undefined;
  return {
    id,
    institution: toString(data.institution, ""),
    cesdeGroupType: normalizeCesdeGroupType(data.cesdeGroupType),
    subjectId: toString(data.subjectId, ""),
    subjectName: toString(data.subjectName, toString(data.subjectId, id)),
    groupId: toString(data.groupId, ""),
    groupName: toString(data.groupName, toString(data.groupId, "")),
    period: toString(data.period, ""),
    campus: toString(data.campus, ""),
    jornada: toString(data.jornada, ""),
    dayOfWeek1: toString(data.dayOfWeek1, ""),
    dayOfWeek2: toString(data.dayOfWeek2, ""),
    startTime: toString(data.startTime, ""),
    endTime: toString(data.endTime, ""),
    day2StartTime: toString(data.day2StartTime, ""),
    day2EndTime: toString(data.day2EndTime, ""),
    weekCount: toNumber(data.weekCount, 0),
    startDate: toString(data.startDate, ""),
    endDate: toString(data.endDate, ""),
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

function formatDateRange(startDate: string, endDate: string) {
  if (startDate && endDate) return `${startDate} -> ${endDate}`;
  return startDate || endDate || "-";
}

function formatScheduleRange(dayLabel: string, startTime: string, endTime: string) {
  if (!dayLabel) return "";
  if (startTime && endTime) return `${dayLabel} ${startTime} - ${endTime}`;
  return dayLabel;
}

function parseLocalDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every((n) => Number.isFinite(n))) return null;
  return new Date(year, month - 1, day);
}

function dayNameFromIsoDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return "";
  return ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"][date.getDay()] ?? "";
}

function resolveScheduleDays(args: {
  institution: "CESDE" | "SENA";
  cesdeGroupType: "REGULAR" | "EMPRESARIAL";
  startDate: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
}) {
  const usesManualWeekdays = args.institution === "SENA" || (args.institution === "CESDE" && args.cesdeGroupType === "EMPRESARIAL");
  return {
    usesManualWeekdays,
    dayOfWeek1: args.dayOfWeek1 || dayNameFromIsoDate(args.startDate),
    dayOfWeek2: usesManualWeekdays ? args.dayOfWeek2 : "",
  };
}

const WEEKDAY_ORDER = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"] as const;

function parseFolderDate(folderName: string) {
  const match = folderName.match(/\((\d{2})\/(\d{2})\/(\d{4})\)/);
  if (!match) return null;
  const day = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const year = Number.parseInt(match[3]!, 10);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatFolderDate(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getWeekdayLabelFromDate(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-CO", { weekday: "long" })
    .format(date)
    .replace(/^\w/, (char) => char.toUpperCase())
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getWeekdayOrder(label: string) {
  const index = WEEKDAY_ORDER.indexOf(label as (typeof WEEKDAY_ORDER)[number]);
  return index === -1 ? WEEKDAY_ORDER.length : index;
}

function makeWorkspaceId(parts: string[]) {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("__")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 250);
}

function makeManualWorkspaceId(args: {
  institution: string;
  period: string;
  siteName: string;
  shiftName: string;
  groupId: string;
  subjectId: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
}) {
  return makeWorkspaceId([
    args.institution.toUpperCase(),
    args.period,
    args.siteName.toUpperCase(),
    args.shiftName.toUpperCase(),
    args.groupId,
    args.subjectId,
    args.dayOfWeek1.toUpperCase(),
    args.dayOfWeek2.toUpperCase() || "SIN_SEGUNDO_DIA",
  ]);
}

function getDriveActionTone(subjectName: string) {
  const techMeta = getSubjectTechnologyMeta(subjectName);
  if (!techMeta) {
    return {
      link: "border-zinc-200 bg-white/90 text-zinc-700 hover:bg-white",
      primary: "border-zinc-300 bg-zinc-900 text-white hover:bg-zinc-800",
      danger: "border-zinc-200 bg-white/90 text-zinc-700 hover:bg-zinc-50",
    };
  }

  const palette = techMeta.badgeClassName
    .replace("text-", "hover:text-")
    .replace("bg-", "hover:bg-");

  return {
    link: `${techMeta.badgeClassName} hover:brightness-[0.99]`,
    primary: `${techMeta.iconWrapClassName} border border-current/10 hover:brightness-95`,
    danger: `${techMeta.badgeClassName} border-dashed hover:brightness-[0.99]`,
    palette,
  };
}

function DriveFormSection({
  icon: Icon,
  title,
  description,
  children,
}: DriveFormSectionProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3">
      <div className="flex items-start gap-2.5">
        <div className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function DriveDashboard() {
  const feedback = useFeedback();
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<DriveWorkspaceRow[]>([]);
  const [optimisticWorkspaces, setOptimisticWorkspaces] = useState<DriveWorkspaceRow[]>([]);
  const [optimisticDeletedWorkspaceIds, setOptimisticDeletedWorkspaceIds] = useState<string[]>([]);
  const [institutionTab, setInstitutionTab] = useState<"CESDE" | "SENA">("CESDE");

  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);
  const [sites, setSites] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [institution, setInstitution] = useState<"CESDE" | "SENA">("CESDE");
  const [cesdeGroupType, setCesdeGroupType] = useState<"REGULAR" | "EMPRESARIAL">("REGULAR");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [period, setPeriod] = useState("2026-01");
  const [siteId, setSiteId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [dayOfWeek1, setDayOfWeek1] = useState("Lunes");
  const [dayOfWeek2, setDayOfWeek2] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [day2StartTime, setDay2StartTime] = useState("");
  const [day2EndTime, setDay2EndTime] = useState("");
  const [classroom, setClassroom] = useState("");
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
  const loading = catalogsLoading || workspacesLoading;
  const schedulePreview = resolveScheduleDays({
    institution,
    cesdeGroupType,
    startDate,
    dayOfWeek1,
    dayOfWeek2,
  });
  const { usesManualWeekdays, dayOfWeek1: resolvedDayOfWeek1, dayOfWeek2: resolvedDayOfWeek2 } = schedulePreview;

  useEffect(() => {
    let cancelled = false;
    async function loadCatalogs() {
      setCatalogsLoading(true);
      setError(null);
      try {
        const [subjectsSnap, groupsSnap, fichasSnap, sitesSnap, shiftsSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "fichas"), orderBy("name"), limit(800))),
          getDocs(query(collection(firestore, "sites"), orderBy("name"), limit(100))),
          getDocs(query(collection(firestore, "shifts"), orderBy("name"), limit(100))),
        ]);
        if (cancelled) return;

        setSubjects(subjectsSnap.docs.map((doc) => ({ id: doc.id, name: toString(doc.data()?.name, doc.id) })));
        setGroups(groupsSnap.docs.map((doc) => ({ id: doc.id, name: toString(doc.data()?.name, doc.id) })));
        setFichas(fichasSnap.docs.map((doc) => ({ id: doc.id, name: toString(doc.data()?.name, doc.id) })));
        setSites(sitesSnap.docs.map((doc) => ({ id: doc.id, name: toString(doc.data()?.name, doc.id) })));
        setShifts(shiftsSnap.docs.map((doc) => ({ id: doc.id, name: toString(doc.data()?.name, doc.id) })));
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error("[drive] load error", err);
        if (!cancelled) setError("No fue posible cargar el modulo de estructuras.");
      } finally {
        if (!cancelled) setCatalogsLoading(false);
      }
    }
    void loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(firestore, "driveWorkspaces"), orderBy("updatedAt", "desc"), limit(100)),
      (snap) => {
        const rows = snap.docs.map((doc) => toWorkspaceRow(doc.id, doc.data() as Record<string, unknown>));
        setWorkspaces(rows);
        setOptimisticWorkspaces((current) => current.filter((item) => !rows.some((row) => row.id === item.id)));
        setOptimisticDeletedWorkspaceIds((current) => current.filter((id) => rows.some((row) => row.id === id)));
        setWorkspacesLoading(false);
        setError(null);
      },
      (err) => {
        if (process.env.NODE_ENV !== "production") console.error("[drive] workspaces realtime error", err);
        setWorkspacesLoading(false);
        setError("No fue posible cargar el modulo de estructuras.");
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setSelectedNodes([]);
      setSelectedNodesError(null);
      return;
    }

    setSelectedNodesLoading(true);
    setSelectedNodesError(null);
    const unsubscribe = onSnapshot(
      query(collection(firestore, "driveWorkspaces", selectedWorkspaceId, "nodes"), orderBy("pathKey"), limit(300)),
      (snap) => {
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
        setSelectedNodesLoading(false);
      },
      (err) => {
        if (process.env.NODE_ENV !== "production") console.error("[drive] nodes realtime error", err);
        setSelectedNodes([]);
        setSelectedNodesError("No fue posible cargar las semanas de la estructura seleccionada.");
        setSelectedNodesLoading(false);
      },
    );
    return unsubscribe;
  }, [selectedWorkspaceId]);

  function showCreateError(message: string) {
    return reportFormError({ message, feedback, setMessage: setCreateError });
  }

  async function createStructure() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      showCreateError("Debes iniciar sesion como admin.");
      return;
    }
    if (!subjectId) {
      showCreateError("Debes seleccionar una materia.");
      return;
    }
    if (!groupId) {
      showCreateError(institution === "SENA" ? "Debes seleccionar una ficha." : "Debes seleccionar un grupo.");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(period.trim())) {
      showCreateError("El periodo debe tener formato YYYY-PP, por ejemplo 2026-01.");
      return;
    }
    if (!siteId) {
      showCreateError("Debes seleccionar una sede.");
      return;
    }
    if (!shiftId) {
      showCreateError("Debes seleccionar una jornada.");
      return;
    }
    const scheduleDays = resolveScheduleDays({
      institution,
      cesdeGroupType,
      startDate,
      dayOfWeek1: dayOfWeek1.trim(),
      dayOfWeek2: dayOfWeek2.trim(),
    });
    const scheduleDayOfWeek1 = scheduleDays.dayOfWeek1;
    const scheduleDayOfWeek2 = scheduleDays.dayOfWeek2;

    if (!scheduleDayOfWeek1) {
      showCreateError("Debes seleccionar el día principal.");
      return;
    }
    if (!startDate.trim() || !endDate.trim()) {
      showCreateError("Debes indicar fecha de inicio y fecha de fin.");
      return;
    }
    if (!startTime.trim() || !endTime.trim()) {
      showCreateError("Debes indicar hora de inicio y hora de fin.");
      return;
    }
    if (!classroom.trim()) {
      showCreateError("Debes indicar el salón.");
      return;
    }
    const resolvedDay2Start = scheduleDayOfWeek2 ? day2StartTime.trim() || startTime.trim() : "";
    const resolvedDay2End = scheduleDayOfWeek2 ? day2EndTime.trim() || endTime.trim() : "";

    if (usesManualWeekdays) {
      if (!endDate.trim()) {
        showCreateError(
          institution === "SENA"
            ? "Para SENA debes indicar la fecha de fin."
            : "Para CESDE empresarial debes indicar la fecha de fin.",
        );
        return;
      }
      if (scheduleDayOfWeek2 && scheduleDayOfWeek2 === scheduleDayOfWeek1) {
        showCreateError("El segundo día no puede ser igual al primero.");
        return;
      }
    }
    if (endDate < startDate) {
      showCreateError("La fecha de fin no puede ser menor que la fecha de inicio.");
      return;
    }
    if (endTime <= startTime) {
      showCreateError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }
    if (scheduleDayOfWeek2 && resolvedDay2End <= resolvedDay2Start) {
      showCreateError("La hora de fin del segundo día debe ser posterior a la hora de inicio.");
      return;
    }

    const selectedSite = sites.find((item) => item.id === siteId);
    const selectedShift = shifts.find((item) => item.id === shiftId);
    if (!selectedSite) {
      showCreateError("Debes seleccionar una sede válida.");
      return;
    }
    if (!selectedShift) {
      showCreateError("Debes seleccionar una jornada válida.");
      return;
    }

    const selectedSubject = subjects.find((item) => item.id === subjectId)?.name || subjectId;
    const selectedGroup =
      (institution === "SENA" ? fichas : groups).find((item) => item.id === groupId)?.name || groupId;
    const requestedWorkspaceId = makeManualWorkspaceId({
      institution,
      period,
      siteName: selectedSite.name,
      shiftName: selectedShift.name,
      groupId,
      subjectId,
      dayOfWeek1: scheduleDayOfWeek1,
      dayOfWeek2: scheduleDayOfWeek2,
    });
    const optimisticWorkspace: DriveWorkspaceRow = {
      id: requestedWorkspaceId,
      institution,
      cesdeGroupType: institution === "CESDE" ? cesdeGroupType : "",
      subjectId,
      subjectName: selectedSubject,
      groupId,
      groupName: selectedGroup,
      period,
      campus: selectedSite.name,
      jornada: selectedShift.name,
      dayOfWeek1: scheduleDayOfWeek1,
      dayOfWeek2: scheduleDayOfWeek2,
      startTime,
      endTime,
      day2StartTime: resolvedDay2Start,
      day2EndTime: resolvedDay2End,
      weekCount: institution === "CESDE" ? 18 : 11,
      startDate,
      endDate,
      year: Number.parseInt(period.slice(0, 4), 10) || 0,
      periodCode: period.slice(5),
      health: { broken: false, issues: [], lastCheckedAt: new Date() },
      drive: {},
      optimistic: true,
    };

    flushSync(() => {
      setCreateError(null);
      setCreateOpen(false);
      setInstitutionTab(institution);
      setSelectedWorkspaceId(requestedWorkspaceId);
      setOptimisticWorkspaces((current) => [
        optimisticWorkspace,
        ...current.filter((item) => item.id !== requestedWorkspaceId),
      ]);
    });

    window.setTimeout(() => {
      void (async () => {
        try {
          const token = await user.getIdToken();
          const response = await fetch("/api/admin/drive/bootstrap", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify({
              workspaceId: requestedWorkspaceId,
              institution,
              cesdeGroupType,
              subjectId,
              groupId,
              siteId,
              shiftId,
              period,
              campus: selectedSite.name,
              jornada: selectedShift.name,
              dayOfWeek1: scheduleDayOfWeek1,
              dayOfWeek2: scheduleDayOfWeek2,
              startDate,
              endDate,
              startTime,
              endTime,
              day2StartTime: resolvedDay2Start,
              day2EndTime: resolvedDay2End,
              classroom: classroom.trim().toUpperCase(),
            }),
          });
          const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
          if (!response.ok) {
            throw new Error(
              typeof data?.error === "string" ? data.error : `No fue posible crear (HTTP ${response.status}).`,
            );
          }
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                WORKLOAD_FOCUS_STORAGE_KEY,
                JSON.stringify({
                  institution,
                  startDate,
                }),
              );
            } catch {}
          }
          setOptimisticWorkspaces((current) => current.filter((item) => item.id !== requestedWorkspaceId));
          feedback.success("Estructura creada y vinculada correctamente.");
        } catch (err) {
          setOptimisticWorkspaces((current) => current.filter((item) => item.id !== requestedWorkspaceId));
          feedback.error(err instanceof Error ? err.message : "No fue posible crear la estructura.");
        }
      })();
    }, 0);
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
      const token = await user.getIdToken();
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

    flushSync(() => {
      setWorkspaceDeleteError(null);
      setPendingWorkspaceDelete(null);
      setWorkspaceDeletingId(ws.id);
      setOptimisticDeletedWorkspaceIds((current) => (current.includes(ws.id) ? current : [...current, ws.id]));
      setSelectedWorkspaceId((current) => (current === ws.id ? "" : current));
    });

    window.setTimeout(() => {
      void (async () => {
        try {
          const token = await user.getIdToken();
          const response = await fetch("/api/admin/drive/workspaces/delete", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify({ workspaceId: ws.id }),
          });
          const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
          if (!response.ok && response.status !== 404) {
            throw new Error(typeof data?.error === "string" ? data.error : `No fue posible eliminar (HTTP ${response.status}).`);
          }
          feedback.success(
            data?.deletedTeachingLoad === true
              ? "Estructura enviada a la papelera de Drive y carga horaria retirada del calendario."
              : "Estructura enviada a la papelera de Drive y eliminada del panel.",
          );
        } catch (err) {
          setOptimisticDeletedWorkspaceIds((current) => current.filter((id) => id !== ws.id));
          setWorkspaceDeleteError(err instanceof Error ? err.message : "No fue posible eliminar del panel.");
          feedback.error(err instanceof Error ? err.message : "No fue posible eliminar del panel.");
        } finally {
          setWorkspaceDeletingId(null);
        }
      })();
    }, 0);
  }

  const displayWorkspaces = useMemo(() => {
    const hiddenIds = new Set(optimisticDeletedWorkspaceIds);
    const confirmedVisible = workspaces.filter((workspace) => !hiddenIds.has(workspace.id));
    const confirmedIds = new Set(confirmedVisible.map((workspace) => workspace.id));
    return [
      ...optimisticWorkspaces.filter((workspace) => !hiddenIds.has(workspace.id) && !confirmedIds.has(workspace.id)),
      ...confirmedVisible,
    ];
  }, [optimisticDeletedWorkspaceIds, optimisticWorkspaces, workspaces]);

  const summary = useMemo(() => {
    const totalWeeks = displayWorkspaces.reduce((acc, workspace) => acc + workspace.weekCount, 0);
    const cesde = displayWorkspaces.filter((workspace) => workspace.institution === "CESDE").length;
    const sena = displayWorkspaces.filter((workspace) => workspace.institution === "SENA").length;
    const broken = displayWorkspaces.filter((workspace) => workspace.health?.broken).length;
    return { totalWeeks, cesde, sena, broken };
  }, [displayWorkspaces]);

  const tabWorkspaces = useMemo(
    () => displayWorkspaces.filter((workspace) => workspace.institution === institutionTab),
    [displayWorkspaces, institutionTab],
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
  const selectedWeeksByDay = useMemo(() => {
    const groups = new Map<
      string,
      Array<
        DriveNodeRow & {
          parsedDate: Date | null;
          dateLabel: string;
        }
      >
    >();

    selectedWeeks.forEach((week) => {
      const parsedDate = parseFolderDate(week.name);
      const weekdayLabel = getWeekdayLabelFromDate(parsedDate) || "Sin dia";
      const current = groups.get(weekdayLabel) ?? [];
      current.push({
        ...week,
        parsedDate,
        dateLabel: formatFolderDate(parsedDate),
      });
      groups.set(weekdayLabel, current);
    });

    return Array.from(groups.entries())
      .map(([weekdayLabel, weeks]) => ({
        weekdayLabel,
        weeks: weeks.sort((a, b) => {
          if (a.parsedDate && b.parsedDate) return a.parsedDate.getTime() - b.parsedDate.getTime();
          if (a.parsedDate) return -1;
          if (b.parsedDate) return 1;
          return (a.meta?.week ?? 0) - (b.meta?.week ?? 0);
        }),
      }))
      .sort((a, b) => {
        const orderDiff = getWeekdayOrder(a.weekdayLabel) - getWeekdayOrder(b.weekdayLabel);
        if (orderDiff !== 0) return orderDiff;
        return a.weekdayLabel.localeCompare(b.weekdayLabel, "es");
      });
  }, [selectedWeeks]);

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
              setCesdeGroupType("REGULAR");
              setSiteId("");
              setShiftId("");
              setDayOfWeek1("Lunes");
              setDayOfWeek2("");
              setStartDate("");
              setEndDate("");
              setStartTime("");
              setEndTime("");
              setDay2StartTime("");
              setDay2EndTime("");
              setClassroom("");
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
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            {loading ? "-" : formatCompactNumber(displayWorkspaces.length)}
          </p>
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
            const count = displayWorkspaces.filter((workspace) => workspace.institution === tab).length;
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

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                className={`group relative overflow-hidden rounded-xl border p-3 text-left shadow-sm transition cursor-pointer focus:outline-none ${
                  selectedWorkspaceId === workspace.id
                    ? getSubjectTechnologyMeta(workspace.subjectName)?.driveSelectedClassName ?? "border-indigo-200 ring-4 ring-indigo-500/10"
                    : getSubjectTechnologyMeta(workspace.subjectName)?.driveCardClassName ?? "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {(() => {
                  const techMeta = getSubjectTechnologyMeta(workspace.subjectName);
                  const PrimaryIcon = techMeta?.primaryIcon;
                  const SecondaryIcon = techMeta?.secondaryIcon;
                  const actionTone = getDriveActionTone(workspace.subjectName);
                  return (
                    <>
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

                            <p className="mt-1.5 truncate text-[13px] font-bold tracking-tight text-zinc-950">{workspace.subjectName}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-600">{workspace.groupName}</p>

                            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-zinc-600">
                              <p className="truncate">
                                <span className="font-semibold text-zinc-700">{workspace.period}</span> · {workspace.campus}
                              </p>
                              <p className="truncate text-right">{workspace.weekCount} {workspace.institution === "CESDE" && workspace.cesdeGroupType === "EMPRESARIAL" ? "ses." : "sem."}</p>
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

                          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${techMeta?.iconWrapClassName ?? "bg-zinc-100 text-zinc-700"}`}>
                            {techMeta && PrimaryIcon ? <PrimaryIcon className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
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
                                void syncWorkspace(workspace);
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
                                setWorkspaceDeleteError(null);
                                setPendingWorkspaceDelete(workspace);
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
                    </>
                  );
                })()}
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
              <p className="mt-1 text-xs text-zinc-600">Fechas: {formatDateRange(selectedWorkspace.startDate, selectedWorkspace.endDate)}</p>
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
                  <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">Cargando semanas...</div>
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
              onClick={() => setCreateOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-[min(96vw,1480px)] max-w-none overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
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
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 py-4">
                {createError ? (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</div>
                ) : null}

                <div className="space-y-3">
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
                    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm">
                          <Sparkles className="h-3.5 w-3.5" />
                          Configuración guiada de estructura
                        </div>
                        <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950">
                          {subjects.find((subject) => subject.id === subjectId)?.name ?? "Selecciona la materia"}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          {institution} · {institution === "SENA" ? "Ficha" : "Grupo"} ·{" "}
                          {(institution === "SENA" ? fichas : groups).find((item) => item.id === groupId)?.name ??
                            "Pendiente"}{" "}
                          · {period}
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-2 sm:w-[560px]">
                        <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Sede</p>
                          <p className="mt-1 text-xs font-semibold text-zinc-800">
                            {sites.find((site) => site.id === siteId)?.name ?? "Sin definir"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Jornada</p>
                          <p className="mt-1 text-xs font-semibold text-zinc-800">
                            {shifts.find((shift) => shift.id === shiftId)?.name ?? "Sin definir"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Días</p>
                          <p className="mt-1 text-xs font-semibold text-zinc-800">
                            {resolvedDayOfWeek2 ? `${resolvedDayOfWeek1} y ${resolvedDayOfWeek2}` : resolvedDayOfWeek1 || "Pendiente"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Horario</p>
                          <p className="mt-1 text-xs font-semibold text-zinc-800">
                            {startTime && endTime ? `${startTime} - ${endTime}` : "Pendiente"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-3">
                    <DriveFormSection
                      icon={Layers3}
                      title="Base académica"
                      description="Define la institución, la materia y la agrupación que recibirán el encarpetado."
                    >
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Institución</span>
                      <select
                        value={institution}
                        onChange={(event) => {
                          const next = event.target.value === "SENA" ? "SENA" : "CESDE";
                          setInstitution(next);
                          setGroupId("");
                          if (next === "SENA") {
                            setCesdeGroupType("REGULAR");
                          }
                        }}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="CESDE">CESDE</option>
                        <option value="SENA">SENA</option>
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Materia</span>
                      <select
                        value={subjectId}
                        onChange={(event) => setSubjectId(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="">Selecciona materia</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {institution === "CESDE" ? (
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-zinc-700">Tipo de grupo CESDE</span>
                        <select
                          value={cesdeGroupType}
                          onChange={(event) => {
                            const next = event.target.value === "EMPRESARIAL" ? "EMPRESARIAL" : "REGULAR";
                            setCesdeGroupType(next);
                            if (next === "REGULAR") {
                              setDayOfWeek2("");
                              setEndDate("");
                            }
                          }}
                          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                        >
                          <option value="REGULAR">Regular</option>
                          <option value="EMPRESARIAL">Empresarial</option>
                        </select>
                      </label>
                    ) : null}

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">{institution === "SENA" ? "Ficha" : "Grupo"}</span>
                      <select
                        value={groupId}
                        onChange={(event) => setGroupId(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="">{institution === "SENA" ? "Selecciona ficha" : "Selecciona grupo"}</option>
                        {(institution === "SENA" ? fichas : groups).map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="text-xs font-semibold text-zinc-700">Periodo</span>
                      <select
                        value={period}
                        onChange={(event) => setPeriod(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="2026-01">2026-01</option>
                        <option value="2026-02">2026-02</option>
                      </select>
                    </label>
                    </DriveFormSection>

                    <DriveFormSection
                      icon={Building2}
                      title="Operación y ubicación"
                      description="Configura dónde se impartirá la carga y cómo se identificará dentro del panel."
                    >
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Sede</span>
                      <select
                        value={siteId}
                        onChange={(event) => setSiteId(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="">Selecciona sede</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Jornada</span>
                      <select
                        value={shiftId}
                        onChange={(event) => setShiftId(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="">Selecciona jornada</option>
                        {shifts.map((shift) => (
                          <option key={shift.id} value={shift.id}>
                            {shift.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="text-xs font-semibold text-zinc-700">Salón</span>
                      <input
                        type="text"
                        value={classroom}
                        onChange={(event) => setClassroom(event.target.value)}
                        placeholder="Ej. A-203"
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>
                    </DriveFormSection>

                    <DriveFormSection
                      icon={CalendarDays}
                      title="Programación académica"
                      description="Estos datos alimentan tanto el Drive como el calendario vinculado."
                    >
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Día 1</span>
                      <select
                        value={resolvedDayOfWeek1}
                        onChange={(event) => setDayOfWeek1(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50 disabled:opacity-60"
                        disabled={!usesManualWeekdays}
                      >
                        {WEEK_DAY_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Día 2 (opcional)</span>
                      <select
                        value={resolvedDayOfWeek2}
                            onChange={(event) => {
                              const next = event.target.value;
                              setDayOfWeek2(next);
                              if (!next) {
                                setDay2StartTime("");
                                setDay2EndTime("");
                              }
                            }}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50 disabled:opacity-60"
                        disabled={!usesManualWeekdays}
                      >
                        <option value="">Sin segundo día</option>
                        {WEEK_DAY_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={`grid gap-1.5 ${institution === "CESDE" && cesdeGroupType === "EMPRESARIAL" ? "" : "sm:col-span-2"}`}>
                      <span className="text-xs font-semibold text-zinc-700">Fecha inicio</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) => {
                          const nextDate = event.target.value;
                          setStartDate(nextDate);
                          if (!dayOfWeek1.trim()) {
                            const inferredDay = dayNameFromIsoDate(nextDate);
                            if (inferredDay) setDayOfWeek1(inferredDay);
                          }
                        }}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Fecha fin</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>

                    <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-zinc-700">Hora día 1</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>

                    <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-zinc-700">Fin día 1</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>
                        {resolvedDayOfWeek2 ? (
                          <>
                            <label className="grid gap-1.5">
                              <span className="text-xs font-semibold text-zinc-700">Hora día 2</span>
                              <input
                                type="time"
                                value={day2StartTime}
                                onChange={(event) => setDay2StartTime(event.target.value)}
                                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                              />
                            </label>

                            <label className="grid gap-1.5">
                              <span className="text-xs font-semibold text-zinc-700">Fin día 2</span>
                              <input
                                type="time"
                                value={day2EndTime}
                                onChange={(event) => setDay2EndTime(event.target.value)}
                                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                              />
                            </label>
                          </>
                        ) : null}
                    </DriveFormSection>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Materia
                      </div>
                      <p className="mt-2 text-sm font-semibold text-zinc-800">
                        {subjects.find((subject) => subject.id === subjectId)?.name ?? "Pendiente"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                        {institution === "SENA" ? <Hash className="h-3.5 w-3.5" /> : <Layers3 className="h-3.5 w-3.5" />}
                        {institution === "SENA" ? "Ficha" : "Grupo"}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-zinc-800">
                        {(institution === "SENA" ? fichas : groups).find((item) => item.id === groupId)?.name ?? "Pendiente"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                        <MapPinned className="h-3.5 w-3.5" />
                        Ubicación
                      </div>
                      <p className="mt-2 text-sm font-semibold text-zinc-800">
                        {sites.find((site) => site.id === siteId)?.name ?? "Sede"} · {shifts.find((shift) => shift.id === shiftId)?.name ?? "Jornada"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        Horario
                      </div>
                      <p className="mt-2 text-sm font-semibold text-zinc-800">
                            {startTime && endTime
                              ? resolvedDayOfWeek2
                                ? `${formatScheduleRange(resolvedDayOfWeek1, startTime, endTime)} | ${formatScheduleRange(
                                    resolvedDayOfWeek2,
                                    day2StartTime || startTime,
                                    day2EndTime || endTime,
                                  )}`
                                : `${startTime} - ${endTime}`
                              : "Pendiente"}
                      </p>
                    </div>
                  </div>

                  {!usesManualWeekdays ? (
                    <p className="mt-3 text-xs text-zinc-500">
                      El día principal se calcula automáticamente a partir de la fecha de inicio para mantener el calendario sincronizado.
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
                  {institution === "CESDE" && cesdeGroupType === "EMPRESARIAL"
                    ? "CESDE empresarial: se crearán sesiones por fechas reales dentro del rango seleccionado, según 1 o 2 días a la semana, y además se registrará automáticamente en carga horaria."
                    : institution === "SENA"
                          ? "SENA: puedes seleccionar 1 o 2 días por semana. Si no llenas el horario del día 2, se reutiliza el del día 1."
                      : "CESDE regular: se conserva la lógica estándar del Apps Script y la estructura también quedará enlazada al calendario."}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void createStructure()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  <FolderPlus className="h-4 w-4" />
                  Crear estructura
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
                  <p className="mt-1 text-sm text-zinc-600">
                    Se quitará el registro local de Drive y, si está vinculado, también desaparecerá de carga horaria.
                  </p>
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
