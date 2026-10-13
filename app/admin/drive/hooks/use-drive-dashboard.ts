"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { collection, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";
import type {
  CatalogItem,
  DriveWorkspaceRow,
  DriveNodeRow,
  DriveDashboardSummary,
  WeekGroupItem,
} from "../types";
import {
  toString,
  toNumber,
  toWorkspaceRow,
  resolveScheduleDays,
  makeManualWorkspaceId,
  parseFolderDate,
  formatFolderDate,
  getWeekdayLabelFromDate,
  getWeekdayOrder,
  WORKLOAD_FOCUS_STORAGE_KEY,
  bootstrapDriveApi,
  validateDriveWorkspaceApi,
  deleteDriveWorkspaceApi,
} from "../services/drive-service";

export function useDriveDashboard() {
  const feedback = useFeedback();

  // Loading & error
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [workspaces, setWorkspaces] = useState<DriveWorkspaceRow[]>([]);
  const [optimisticWorkspaces, setOptimisticWorkspaces] = useState<DriveWorkspaceRow[]>([]);
  const [optimisticDeletedWorkspaceIds, setOptimisticDeletedWorkspaceIds] = useState<string[]>([]);
  const [institutionTab, setInstitutionTab] = useState<"CESDE" | "SENA">("CESDE");

  // Catalogs
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);
  const [sites, setSites] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);

  // Structure Creation Form
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

  // Selected workspace detail & nodes
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedNodes, setSelectedNodes] = useState<DriveNodeRow[]>([]);
  const [selectedNodesLoading, setSelectedNodesLoading] = useState(false);
  const [selectedNodesError, setSelectedNodesError] = useState<string | null>(null);

  // Deletion modal
  const [pendingWorkspaceDelete, setPendingWorkspaceDelete] = useState<DriveWorkspaceRow | null>(null);
  const [workspaceDeleteError, setWorkspaceDeleteError] = useState<string | null>(null);
  const [workspaceDeletingId, setWorkspaceDeletingId] = useState<string | null>(null);

  // Sync state
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

  // Load catalogs
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

        setSubjects(subjectsSnap.docs.map((d) => ({ id: d.id, name: toString(d.data()?.name, d.id) })));
        setGroups(groupsSnap.docs.map((d) => ({ id: d.id, name: toString(d.data()?.name, d.id) })));
        setFichas(fichasSnap.docs.map((d) => ({ id: d.id, name: toString(d.data()?.name, d.id) })));
        setSites(sitesSnap.docs.map((d) => ({ id: d.id, name: toString(d.data()?.name, d.id) })));
        setShifts(shiftsSnap.docs.map((d) => ({ id: d.id, name: toString(d.data()?.name, d.id) })));
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

  // Realtime workspaces listener
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(firestore, "driveWorkspaces"), orderBy("updatedAt", "desc"), limit(100)),
      (snap) => {
        const rows = snap.docs.map((d) => toWorkspaceRow(d.id, d.data() as Record<string, unknown>));
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

  // Realtime nodes listener for selected workspace
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
          .map((d) => d.data() as Record<string, unknown>)
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

  const displayWorkspaces = useMemo(() => {
    const hiddenIds = new Set(optimisticDeletedWorkspaceIds);
    const confirmedVisible = workspaces.filter((w) => !hiddenIds.has(w.id));
    const confirmedIds = new Set(confirmedVisible.map((w) => w.id));
    return [
      ...optimisticWorkspaces.filter((w) => !hiddenIds.has(w.id) && !confirmedIds.has(w.id)),
      ...confirmedVisible,
    ];
  }, [optimisticDeletedWorkspaceIds, optimisticWorkspaces, workspaces]);

  const summary: DriveDashboardSummary = useMemo(() => {
    const totalWeeks = displayWorkspaces.reduce((acc, w) => acc + w.weekCount, 0);
    const cesde = displayWorkspaces.filter((w) => w.institution === "CESDE").length;
    const sena = displayWorkspaces.filter((w) => w.institution === "SENA").length;
    const broken = displayWorkspaces.filter((w) => w.health?.broken).length;
    return { totalWeeks, cesde, sena, broken };
  }, [displayWorkspaces]);

  const tabWorkspaces = useMemo(
    () => displayWorkspaces.filter((w) => w.institution === institutionTab),
    [displayWorkspaces, institutionTab],
  );

  useEffect(() => {
    if (!tabWorkspaces.length) {
      if (selectedWorkspaceId) setSelectedWorkspaceId("");
      return;
    }
    if (!selectedWorkspaceId || !tabWorkspaces.some((w) => w.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(tabWorkspaces[0]!.id);
    }
  }, [institutionTab, selectedWorkspaceId, tabWorkspaces]);

  const selectedWorkspace = useMemo(
    () => tabWorkspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, tabWorkspaces],
  );

  const selectedWeeks = useMemo(
    () =>
      selectedNodes
        .filter((node) => node.kind === "week")
        .sort((a, b) => (a.meta?.week ?? 0) - (b.meta?.week ?? 0)),
    [selectedNodes],
  );

  const selectedWeeksByDay: WeekGroupItem[] = useMemo(() => {
    const groupsMap = new Map<
      string,
      Array<DriveNodeRow & { parsedDate: Date | null; dateLabel: string }>
    >();

    selectedWeeks.forEach((week) => {
      const parsedDate = parseFolderDate(week.name);
      const weekdayLabel = getWeekdayLabelFromDate(parsedDate) || "Sin dia";
      const current = groupsMap.get(weekdayLabel) ?? [];
      current.push({
        ...week,
        parsedDate,
        dateLabel: formatFolderDate(parsedDate),
      });
      groupsMap.set(weekdayLabel, current);
    });

    return Array.from(groupsMap.entries())
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

  function showCreateError(message: string) {
    return reportFormError({ message, feedback, setMessage: setCreateError });
  }

  function openCreateForm() {
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
          await bootstrapDriveApi(
            {
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
            },
            token,
          );

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
      await validateDriveWorkspaceApi(ws.id, token);
    } catch (err) {
      setWorkspaceSyncError(err instanceof Error ? err.message : "No fue posible sincronizar la estructura.");
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
          const data = await deleteDriveWorkspaceApi(ws.id, token);
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

  return {
    loading,
    error,

    // Catalogs
    subjects,
    groups,
    fichas,
    sites,
    shifts,

    // Workspace list & metrics
    institutionTab,
    setInstitutionTab,
    displayWorkspaces,
    tabWorkspaces,
    summary,

    // Selection & Node weeks
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    selectedWorkspace,
    selectedWeeksByDay,
    selectedNodesLoading,
    selectedNodesError,

    // Create modal state & actions
    createOpen,
    setCreateOpen,
    openCreateForm,
    institution,
    setInstitution,
    cesdeGroupType,
    setCesdeGroupType,
    subjectId,
    setSubjectId,
    groupId,
    setGroupId,
    period,
    setPeriod,
    siteId,
    setSiteId,
    shiftId,
    setShiftId,
    dayOfWeek1,
    setDayOfWeek1,
    dayOfWeek2,
    setDayOfWeek2,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    day2StartTime,
    setDay2StartTime,
    day2EndTime,
    setDay2EndTime,
    classroom,
    setClassroom,
    createError,
    usesManualWeekdays,
    resolvedDayOfWeek1,
    resolvedDayOfWeek2,
    createStructure,

    // Sync action
    workspaceSyncingId,
    workspaceSyncError,
    syncWorkspace,

    // Delete modal & action
    pendingWorkspaceDelete,
    setPendingWorkspaceDelete,
    workspaceDeletingId,
    workspaceDeleteError,
    deleteWorkspaceFromPanel,
  };
}
