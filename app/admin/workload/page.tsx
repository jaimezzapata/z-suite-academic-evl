"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Clock3,
  Edit3,
  DoorOpen,
  Group,
  GraduationCap,
  Hash,
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";

type CatalogItem = { id: string; name: string };

type TeachingLoadRow = {
  id: string;
  institution: "CESDE" | "SENA" | string;
  period: string;
  subjectId: string;
  subjectName: string;
  audienceId: string;
  audienceName: string;
  audienceType: "group" | "ficha" | string;
  siteId: string;
  siteName: string;
  shiftId: string;
  shiftName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  classroom: string;
  durationMinutes: number;
  academicHours: number;
  dayOfWeek1: string;
  dayOfWeek2: string;
  driveWorkspaceId: string;
  driveStatus: string;
  driveErrorMessage: string;
  drivePublicFolderUrl: string;
  active: boolean;
};

type TeachingLoadForm = {
  institution: "CESDE" | "SENA";
  period: string;
  subjectId: string;
  audienceId: string;
  siteId: string;
  shiftId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  classroom: string;
};

type WorkloadFilters = {
  subjectId: string;
  audienceId: string;
  siteId: string;
  shiftId: string;
  classroom: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FORM: TeachingLoadForm = {
  institution: "CESDE",
  period: `${new Date().getFullYear()}-01`,
  subjectId: "",
  audienceId: "",
  siteId: "",
  shiftId: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  classroom: "",
};

const EMPTY_FILTERS: WorkloadFilters = {
  subjectId: "",
  audienceId: "",
  siteId: "",
  shiftId: "",
  classroom: "",
  dateFrom: "",
  dateTo: "",
};

function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function sortByName(items: CatalogItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function formatDateRange(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "Sin fechas";
  if (startDate && endDate) return `${startDate} -> ${endDate}`;
  return startDate || endDate;
}

function formatTimeRange(startTime: string, endTime: string) {
  if (!startTime && !endTime) return "Sin horario";
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  return startTime || endTime;
}

function diffMinutes(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((n) => !Number.isFinite(n))) return 0;
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function formatHours(value: number) {
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function parseLocalDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every((n) => Number.isFinite(n))) return null;
  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function isSameOrAfterDay(target: Date, reference: Date) {
  return new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() >=
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
}

function isSameOrBeforeDay(target: Date, reference: Date) {
  return new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() <=
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayNameFromIsoDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return "";
  return ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"][date.getDay()] ?? "";
}

function periodFromDate(value: string) {
  const year = value.slice(0, 4);
  return /^\d{4}$/.test(year) ? `${year}-01` : `${new Date().getFullYear()}-01`;
}

function normalizeInstitutionTab(value: "CESDE" | "SENA" | "ALL") {
  return value === "SENA" ? "SENA" : "CESDE";
}

function makeTeachingLoadWorkspaceId(loadId: string) {
  return `teaching_load__${loadId}`;
}

function minutesFromTime(value: string) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (![hour, minute].every((n) => Number.isFinite(n))) return null;
  return hour * 60 + minute;
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(date);
}

function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(date);
}

function formatWeekRange(startDate: Date) {
  const endDate = addDays(startDate, 6);
  const startLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(endDate);
  return `${startLabel} - ${endLabel}`;
}

function formatCompactDateRange(startDate: string, endDate: string) {
  const normalize = (value: string) => {
    if (!value) return "--/--";
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}`;
  };
  if (!startDate && !endDate) return "Sin fechas";
  if (startDate && endDate) return `${normalize(startDate)} - ${normalize(endDate)}`;
  return normalize(startDate || endDate);
}

const CALENDAR_START_MINUTES = 6 * 60;
const CALENDAR_END_MINUTES = 22 * 60;
const CALENDAR_SLOT_MINUTES = 30;
const CALENDAR_SLOTS = (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES) / CALENDAR_SLOT_MINUTES;

function buildTimeLabels() {
  return Array.from({ length: CALENDAR_SLOTS }, (_, index) => {
    const totalMinutes = CALENDAR_START_MINUTES + index * CALENDAR_SLOT_MINUTES;
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const suffix = hour24 >= 12 ? "pm" : "am";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  });
}

const CALENDAR_LABELS = buildTimeLabels();

function eventTone(institution: string) {
  return institution === "SENA"
    ? "border-emerald-300 bg-emerald-100 text-emerald-950"
    : "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-950";
}

function minutesToTimeString(totalMinutes: number) {
  const safe = Math.max(0, totalMinutes);
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs text-foreground/55">{subtitle ?? "Registra horarios por institución y materia."}</p>
          </div>
          <button type="button" onClick={onClose} className="zs-btn-secondary h-9 w-9 px-0" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminWorkloadPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const feedback = useFeedback();

  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);
  const [sites, setSites] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);
  const [rows, setRows] = useState<TeachingLoadRow[]>([]);

  const [tab, setTab] = useState<"CESDE" | "SENA" | "ALL">("CESDE");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [modalOpen, setModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeachingLoadForm>(EMPTY_FORM);
  const [filters, setFilters] = useState<WorkloadFilters>(EMPTY_FILTERS);
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    let cancelled = false;
    async function loadCatalogs() {
      try {
        const [subjectsSnap, groupsSnap, fichasSnap, sitesSnap, shiftsSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"))),
          getDocs(query(collection(firestore, "fichas"), orderBy("number"))),
          getDocs(query(collection(firestore, "sites"), orderBy("name"))),
          getDocs(query(collection(firestore, "shifts"), orderBy("name"))),
        ]);
        if (cancelled) return;
        setSubjects(sortByName(subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data() as Record<string, unknown>))));
        setGroups(sortByName(groupsSnap.docs.map((d) => toCatalogItem(d.id, d.data() as Record<string, unknown>))));
        setFichas(
          sortByName(
            fichasSnap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              const number = toString(data.number, d.id);
              return { id: d.id, name: number };
            }),
          ),
        );
        setSites(sortByName(sitesSnap.docs.map((d) => toCatalogItem(d.id, d.data() as Record<string, unknown>))));
        setShifts(sortByName(shiftsSnap.docs.map((d) => toCatalogItem(d.id, d.data() as Record<string, unknown>))));
      } catch {
        if (!cancelled) setError("No fue posible cargar los catálogos de materias, grupos, sedes y jornadas.");
      }
    }
    void loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = query(collection(firestore, "teachingLoads"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const row = d.data() as Record<string, unknown>;
          const institution = toString(row.institution, "CESDE");
          const startTime = toString(row.startTime, "");
          const endTime = toString(row.endTime, "");
          const startDate = toString(row.startDate, "");
          const fallbackMinutes = Math.max(0, diffMinutes(startTime, endTime));
          const fallbackAcademicHours = roundHours(fallbackMinutes / (institution === "CESDE" ? 45 : 60));
          return {
            id: d.id,
            institution,
            period: toString(row.period, periodFromDate(startDate)),
            subjectId: toString(row.subjectId, ""),
            subjectName: toString(row.subjectName, ""),
            audienceId: toString(row.audienceId, ""),
            audienceName: toString(row.audienceName, ""),
            audienceType: toString(row.audienceType, "group"),
            siteId: toString(row.siteId, ""),
            siteName: toString(row.siteName, ""),
            shiftId: toString(row.shiftId, ""),
            shiftName: toString(row.shiftName, ""),
            startDate,
            endDate: toString(row.endDate, ""),
            startTime,
            endTime,
            classroom: toString(row.classroom, ""),
            durationMinutes:
              typeof row.durationMinutes === "number" && Number.isFinite(row.durationMinutes)
                ? row.durationMinutes
                : fallbackMinutes,
            academicHours:
              typeof row.academicHours === "number" && Number.isFinite(row.academicHours)
                ? row.academicHours
                : fallbackAcademicHours,
            dayOfWeek1: toString(row.dayOfWeek1, dayNameFromIsoDate(startDate)),
            dayOfWeek2: toString(row.dayOfWeek2, ""),
            driveWorkspaceId: toString(row.driveWorkspaceId, ""),
            driveStatus: toString(row.driveStatus, "pending"),
            driveErrorMessage: toString(row.driveErrorMessage, ""),
            drivePublicFolderUrl: toString(row.drivePublicFolderUrl, ""),
            active: row.active !== false,
          } satisfies TeachingLoadRow;
        });
        setRows(
          next.sort((a, b) =>
            `${b.startDate}|${b.startTime}|${b.subjectName}`.localeCompare(`${a.startDate}|${a.startTime}|${a.subjectName}`, "es"),
          ),
        );
        setLoading(false);
      },
      () => {
        setError("No fue posible leer la carga horaria.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const rowsByInstitution = useMemo(() => {
    if (tab === "ALL") return rows;
    return rows.filter((row) => (row.institution || "CESDE").toUpperCase() === tab);
  }, [rows, tab]);

  const filterAudienceOptions = useMemo(() => {
    if (tab === "ALL") {
      const merged = [
        ...groups.map((item) => ({ id: item.id, name: item.name, kind: "group" as const })),
        ...fichas.map((item) => ({ id: item.id, name: `Ficha ${item.name}`, kind: "ficha" as const })),
      ];
      return merged.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    return (tab === "SENA" ? fichas : groups).map((item) => ({
      id: item.id,
      name: tab === "SENA" ? `Ficha ${item.name}` : item.name,
      kind: tab === "SENA" ? ("ficha" as const) : ("group" as const),
    }));
  }, [fichas, groups, tab]);

  const classroomOptions = useMemo(
    () =>
      Array.from(new Set(rowsByInstitution.map((row) => row.classroom.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [rowsByInstitution],
  );

  const filteredRows = useMemo(() => {
    return rowsByInstitution.filter((row) => {
      if (filters.subjectId && row.subjectId !== filters.subjectId) return false;
      if (filters.audienceId && row.audienceId !== filters.audienceId) return false;
      if (filters.siteId && row.siteId !== filters.siteId) return false;
      if (filters.shiftId && row.shiftId !== filters.shiftId) return false;
      if (filters.classroom && row.classroom.trim().toLowerCase() !== filters.classroom.trim().toLowerCase()) return false;
      if (filters.dateFrom && row.endDate < filters.dateFrom) return false;
      if (filters.dateTo && row.startDate > filters.dateTo) return false;
      return true;
    });
  }, [filters, rowsByInstitution]);

  const counts = useMemo(
    () => ({
      CESDE: rows.filter((row) => (row.institution || "CESDE").toUpperCase() === "CESDE").length,
      SENA: rows.filter((row) => (row.institution || "CESDE").toUpperCase() === "SENA").length,
    }),
    [rows],
  );

  const hourTotals = useMemo(
    () => ({
      CESDE: roundHours(
        rows
          .filter((row) => (row.institution || "CESDE").toUpperCase() === "CESDE")
          .reduce((sum, row) => sum + row.academicHours, 0),
      ),
      SENA: roundHours(
        rows
          .filter((row) => (row.institution || "CESDE").toUpperCase() === "SENA")
          .reduce((sum, row) => sum + row.academicHours, 0),
      ),
    }),
    [rows],
  );

  const audienceOptions = useMemo(
    () => (form.institution === "SENA" ? fichas : groups),
    [fichas, form.institution, groups],
  );

  const currentDurationMinutes = useMemo(
    () => Math.max(0, diffMinutes(form.startTime, form.endTime)),
    [form.endTime, form.startTime],
  );

  const currentAcademicHours = useMemo(() => {
    if (!currentDurationMinutes) return 0;
    return roundHours(currentDurationMinutes / (form.institution === "CESDE" ? 45 : 60));
  }, [currentDurationMinutes, form.institution]);

  const calendarDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(calendarWeekStart, index)),
    [calendarWeekStart],
  );

  const calendarEvents = useMemo(() => {
    return filteredRows
      .map((row) => {
        const rangeStart = parseLocalDate(row.startDate);
        const rangeEnd = parseLocalDate(row.endDate) ?? rangeStart;
        const startMinutes = minutesFromTime(row.startTime);
        const endMinutes = minutesFromTime(row.endTime);
        if (!rangeStart || !rangeEnd || startMinutes === null || endMinutes === null) return null;
        if (endMinutes <= startMinutes) return null;
        const dayIndex = calendarDays.findIndex((day) => {
          if (day.getDay() !== rangeStart.getDay()) return false;
          return isSameOrAfterDay(day, rangeStart) && isSameOrBeforeDay(day, rangeEnd);
        });
        if (dayIndex === -1) return null;
        const topMinutes = Math.max(0, startMinutes - CALENDAR_START_MINUTES);
        const clampedEnd = Math.min(endMinutes, CALENDAR_END_MINUTES);
        const clampedStart = Math.max(startMinutes, CALENDAR_START_MINUTES);
        const blockMinutes = Math.max(30, clampedEnd - clampedStart);
        const top = `${(topMinutes / (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES)) * 100}%`;
        const height = `${(blockMinutes / (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES)) * 100}%`;
        return {
          id: row.id,
          row,
          dayIndex,
          top,
          height,
          tone: eventTone(row.institution),
          subjectName: row.subjectName,
          audienceName: row.audienceType === "ficha" ? `Ficha ${row.audienceName}` : row.audienceName,
          classroom: row.classroom,
          timeRange: formatTimeRange(row.startTime, row.endTime),
          hoursLabel: `${formatHours(row.academicHours)} h`,
          dateRange: formatDateRange(row.startDate, row.endDate),
          shortDateRange: formatCompactDateRange(row.startDate, row.endDate),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [calendarDays, filteredRows]);

  function updateFilter<K extends keyof WorkloadFilters>(key: K, value: WorkloadFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function applyTab(nextTab: "CESDE" | "SENA" | "ALL") {
    setTab(nextTab);
    setFilters(EMPTY_FILTERS);
    const firstWithDate = rows
      .filter((row) => nextTab === "ALL" || (row.institution || "CESDE").toUpperCase() === nextTab)
      .map((row) => parseLocalDate(row.startDate))
      .find((value): value is Date => Boolean(value));
    if (firstWithDate) {
      setCalendarWeekStart(startOfWeek(firstWithDate));
    }
  }

  function resetForm(nextInstitution: "CESDE" | "SENA" = tab === "ALL" ? "CESDE" : tab) {
    setForm({ ...EMPTY_FORM, institution: nextInstitution });
    setEditingId(null);
  }

  function openCreate(seed?: Partial<TeachingLoadForm>) {
    resetForm(normalizeInstitutionTab(tab));
    setError(null);
    setSuccess(null);
    if (seed) {
      setForm((prev) => ({ ...prev, ...seed }));
    }
    setModalOpen(true);
  }

  function openEdit(row: TeachingLoadRow) {
    setEditingId(row.id);
    setForm({
      institution: (row.institution?.toUpperCase() === "SENA" ? "SENA" : "CESDE") as "CESDE" | "SENA",
      period: row.period || periodFromDate(row.startDate),
      subjectId: row.subjectId,
      audienceId: row.audienceId,
      siteId: row.siteId,
      shiftId: row.shiftId,
      startDate: row.startDate,
      endDate: row.endDate,
      startTime: row.startTime,
      endTime: row.endTime,
      classroom: row.classroom,
    });
    setError(null);
    setSuccess(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm(tab);
  }

  function updateField<K extends keyof TeachingLoadForm>(key: K, value: TeachingLoadForm[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "institution") next.audienceId = "";
      if (key === "startDate" && !prev.period.trim()) next.period = periodFromDate(String(value));
      return next;
    });
  }

  async function createOrLinkDriveForRow(args: {
    loadId: string;
    institution: "CESDE" | "SENA";
    period: string;
    subjectId: string;
    audienceId: string;
    siteName: string;
    shiftName: string;
    startDate: string;
    dayOfWeek1: string;
  }) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      throw new Error("La carga se guardó, pero no hay sesión activa para crear la estructura de Drive.");
    }

    const token = await user.getIdToken(true);
    const workspaceId = makeTeachingLoadWorkspaceId(args.loadId);
    const response = await fetch("/api/admin/drive/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        workspaceId,
        sourceTeachingLoadId: args.loadId,
        institution: args.institution,
        subjectId: args.subjectId,
        groupId: args.audienceId,
        period: args.period,
        campus: args.siteName,
        jornada: args.shiftName,
        dayOfWeek1: args.dayOfWeek1,
        dayOfWeek2: "",
        startDate: args.startDate,
      }),
    });

    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.ok) {
      const drive = (data?.drive as Record<string, unknown> | undefined) ?? {};
      return {
        workspaceId,
        publicFolderUrl: typeof drive.publicFolderUrl === "string" ? drive.publicFolderUrl : "",
        message: typeof data?.message === "string" ? data.message : "Estructura de Drive creada correctamente.",
      };
    }

    if (response.status === 409) {
      return {
        workspaceId,
        publicFolderUrl: "",
        message: "La estructura de Drive ya existía y quedó vinculada a la carga.",
      };
    }

    throw new Error(typeof data?.error === "string" ? data.error : `No fue posible crear Drive (HTTP ${response.status}).`);
  }

  async function saveRow() {
    const currentRow = editingId ? rows.find((row) => row.id === editingId) ?? null : null;
    const subject = subjects.find((item) => item.id === form.subjectId);
    const audience = audienceOptions.find((item) => item.id === form.audienceId);
    const site = sites.find((item) => item.id === form.siteId);
    const shift = shifts.find((item) => item.id === form.shiftId);

    if (!subject) {
      setError("Debes seleccionar una materia.");
      return;
    }
    if (!site) {
      setError("Debes seleccionar una sede.");
      return;
    }
    if (!audience) {
      setError(form.institution === "SENA" ? "Debes seleccionar una ficha." : "Debes seleccionar un grupo.");
      return;
    }
    if (!shift) {
      setError("Debes seleccionar una jornada.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError("Debes ingresar fecha de inicio y fecha de fin.");
      return;
    }
    if (form.endDate < form.startDate) {
      setError("La fecha de fin no puede ser menor que la fecha de inicio.");
      return;
    }
    if (!form.startTime || !form.endTime) {
      setError("Debes ingresar hora de inicio y hora de fin.");
      return;
    }
    if (form.endTime <= form.startTime) {
      setError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }
    const durationMinutes = diffMinutes(form.startTime, form.endTime);
    if (durationMinutes <= 0) {
      setError("La franja horaria no es válida.");
      return;
    }
    const period = form.period.trim().toUpperCase();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      setError("El periodo debe tener formato YYYY-PP, por ejemplo 2026-01.");
      return;
    }
    if (!form.classroom.trim()) {
      setError("Debes ingresar el salón.");
      return;
    }
    const academicHours = roundHours(durationMinutes / (form.institution === "CESDE" ? 45 : 60));
    const dayOfWeek1 = dayNameFromIsoDate(form.startDate);
    if (!dayOfWeek1) {
      setError("No fue posible resolver el día principal de la carga.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        institution: form.institution,
        period,
        subjectId: subject.id,
        subjectName: subject.name,
        audienceId: audience.id,
        audienceName: audience.name,
        audienceType: form.institution === "SENA" ? "ficha" : "group",
        siteId: site.id,
        siteName: site.name,
        shiftId: shift.id,
        shiftName: shift.name,
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        classroom: form.classroom.trim().toUpperCase(),
        durationMinutes,
        academicHours,
        dayOfWeek1,
        dayOfWeek2: "",
        active: true,
        updatedAt: serverTimestamp(),
      };

      let savedId = editingId;
      if (editingId) {
        await updateDoc(doc(firestore, "teachingLoads", editingId), payload);
      } else {
        const newRef = doc(collection(firestore, "teachingLoads"));
        savedId = newRef.id;
        await setDoc(newRef, {
          id: newRef.id,
          ...payload,
          driveWorkspaceId: "",
          driveStatus: "pending",
          driveErrorMessage: "",
          drivePublicFolderUrl: "",
          createdAt: serverTimestamp(),
        });
      }

      if (!savedId) {
        throw new Error("No fue posible resolver el identificador de la carga.");
      }

      const hasLinkedDrive = Boolean(currentRow?.driveWorkspaceId?.trim());
      if (hasLinkedDrive) {
        setSuccess("Carga horaria actualizada correctamente. La estructura de Drive existente se conserva.");
      } else {
        await updateDoc(doc(firestore, "teachingLoads", savedId), {
          driveStatus: "pending",
          driveErrorMessage: "",
          updatedAt: serverTimestamp(),
        });
        try {
          const driveResult = await createOrLinkDriveForRow({
            loadId: savedId,
            institution: form.institution,
            period,
            subjectId: subject.id,
            audienceId: audience.id,
            siteName: site.name,
            shiftName: shift.name,
            startDate: form.startDate,
            dayOfWeek1,
          });
          await updateDoc(doc(firestore, "teachingLoads", savedId), {
            driveWorkspaceId: driveResult.workspaceId,
            driveStatus: "linked",
            driveErrorMessage: "",
            drivePublicFolderUrl: driveResult.publicFolderUrl,
            updatedAt: serverTimestamp(),
          });
          setSuccess(editingId ? "Carga horaria actualizada y estructura de Drive vinculada." : "Carga horaria registrada y estructura de Drive creada.");
        } catch (driveError) {
          const driveMessage =
            driveError instanceof Error ? driveError.message : "No fue posible crear la estructura de Drive.";
          await updateDoc(doc(firestore, "teachingLoads", savedId), {
            driveWorkspaceId: "",
            driveStatus: "error",
            driveErrorMessage: driveMessage,
            updatedAt: serverTimestamp(),
          });
          setError(`La carga se guardó, pero Drive falló: ${driveMessage}`);
          setSuccess(
            `${editingId ? "Carga horaria actualizada" : "Carga horaria registrada"}, pero la estructura de Drive no pudo crearse automáticamente.`,
          );
        }
      }
      closeModal();
    } catch {
      setError("No fue posible guardar la carga horaria.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: TeachingLoadRow) {
    const confirmed = await feedback.confirm({
      title: "Eliminar carga horaria",
      description: `Se eliminará ${row.subjectName} en ${row.siteName} para ${row.audienceName}.`,
      confirmLabel: "Eliminar carga",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    try {
      await deleteDoc(doc(firestore, "teachingLoads", row.id));
      feedback.success("Carga horaria eliminada.");
    } catch {
      setError("No fue posible eliminar la carga horaria.");
      feedback.error("No fue posible eliminar la carga horaria.");
    }
  }

  function openCreateFromCalendar(day: Date, startMinutes: number) {
    const startTime = minutesToTimeString(startMinutes);
    const endTime = minutesToTimeString(Math.min(startMinutes + CALENDAR_SLOT_MINUTES, CALENDAR_END_MINUTES));
    const date = isoDate(day);
    openCreate({
      institution: normalizeInstitutionTab(tab),
      period: periodFromDate(date),
      startDate: date,
      endDate: date,
      startTime,
      endTime,
    });
  }

  return (
    <div className="flex h-[calc(100vh-10.5rem)] min-h-0 flex-col overflow-hidden">
      <section className="zs-card flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-foreground">Carga horaria</h1>
            {viewMode === "list" ? (
              <p className="mt-1 text-xs text-foreground/55">
                Registra franjas horarias por institución, sede, jornada, salón y materia.
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-foreground/65">
              <span className="inline-flex rounded-full border border-border bg-surface px-2.5 py-0.5 font-medium">
                Total: {loading ? "-" : rows.length}
              </span>
              <span className="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-0.5 font-medium text-fuchsia-800">
                CESDE: {loading ? "-" : counts.CESDE} | {loading ? "-" : `${formatHours(hourTotals.CESDE)} h`}
              </span>
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-800">
                SENA: {loading ? "-" : counts.SENA} | {loading ? "-" : `${formatHours(hourTotals.SENA)} h`}
              </span>
              <span className="inline-flex rounded-full border border-border bg-surface px-2.5 py-0.5 font-medium">
                Materias: {subjects.length}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="zs-btn-secondary h-7 px-3 text-xs">
              <RefreshCw className="h-4 w-4" />
              Recargar
            </button>
            <button type="button" onClick={openCreate} className="zs-btn-primary h-7 px-3 text-xs">
              <Plus className="h-4 w-4" />
              Nueva carga
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
        ) : null}
        {success ? (
          <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { id: "CESDE", label: "CESDE", total: counts.CESDE },
              { id: "SENA", label: "SENA", total: counts.SENA },
              { id: "ALL", label: "Todas", total: rows.length },
            ] as const).map((institution) => {
              const active = tab === institution.id;
              const total = institution.total;
              return (
                <button
                  key={institution.id}
                  type="button"
                  onClick={() => applyTab(institution.id)}
                  className={`inline-flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition ${
                    active ? "bg-zinc-950 text-white" : "border border-border bg-white text-foreground/70 hover:bg-muted"
                  }`}
                >
                  {institution.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/15 text-white" : "bg-muted text-foreground/70"}`}>
                    {total}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFiltersOpen(true)} className="zs-btn-secondary h-7 px-3 text-xs">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
            </button>
            <span className="inline-flex rounded-full border border-border bg-white px-2.5 py-0.5 text-[10px] font-medium text-foreground/70">
              {filteredRows.length} registro(s)
            </span>
            <div className="inline-flex rounded-2xl border border-border bg-surface p-1">
              {([
                { id: "calendar", label: "Calendario" },
                { id: "list", label: "Registros" },
              ] as const).map((item) => {
                const active = viewMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setViewMode(item.id)}
                  className={`inline-flex h-7 items-center rounded-xl px-3 text-xs font-semibold transition ${
                      active ? "bg-zinc-950 text-white shadow-sm" : "text-foreground/65 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {filteredRows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white">
                        {row.institution}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{row.subjectName}</span>
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground/75">
                        {row.audienceType === "ficha" ? `Ficha ${row.audienceName}` : row.audienceName}
                      </span>
                      <span className="inline-flex rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                        {row.period || "SIN PERIODO"}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          row.driveStatus === "linked"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : row.driveStatus === "error"
                              ? "border border-amber-200 bg-amber-50 text-amber-700"
                              : "border border-border bg-surface text-foreground/70"
                        }`}
                      >
                        {row.driveStatus === "linked"
                          ? "DRIVE VINCULADO"
                          : row.driveStatus === "error"
                            ? "DRIVE CON ERROR"
                            : "DRIVE PENDIENTE"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-foreground/60">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinned className="h-3.5 w-3.5" />
                        {row.siteName}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        {row.shiftName}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {row.dayOfWeek1 || "Sin día"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <DoorOpen className="h-3.5 w-3.5" />
                        Salón {row.classroom}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDateRange(row.startDate, row.endDate)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatTimeRange(row.startTime, row.endTime)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {row.durationMinutes} min reloj
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5" />
                        {formatHours(row.academicHours)} h {row.institution === "CESDE" ? "académicas" : "registradas"}
                      </span>
                      {row.drivePublicFolderUrl ? (
                        <a
                          href={row.drivePublicFolderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-primary hover:underline"
                        >
                          Abrir Drive
                        </a>
                      ) : null}
                      {row.driveStatus === "error" && row.driveErrorMessage ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700">{row.driveErrorMessage}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => openEdit(row)} className="zs-btn-secondary h-9">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>
                    <button type="button" onClick={() => void removeRow(row)} className="zs-btn-danger-soft h-9">
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!filteredRows.length ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-foreground/55">
                {loading ? "Cargando carga horaria..." : `No hay registros para ${tab} con los filtros actuales.`}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Agenda semanal</p>
                <p className="text-[10px] text-foreground/50">{tab === "ALL" ? "CESDE + SENA" : tab} | 6:00 am - 9:30 pm</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarWeekStart((prev) => addDays(prev, -7))}
                  className="zs-btn-secondary h-7 px-3 text-xs"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Semana anterior
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarWeekStart(startOfWeek(new Date()))}
                  className="zs-btn-secondary h-7 px-3 text-xs"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarWeekStart((prev) => addDays(prev, 7))}
                  className="zs-btn-secondary h-7 px-3 text-xs"
                >
                  Semana siguiente
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium text-foreground/70">
                {formatWeekRange(calendarWeekStart)}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-foreground/60">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${eventTone("CESDE")}`}>
                  <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
                  CESDE
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${eventTone("SENA")}`}>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  SENA
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
              <div className="h-full min-w-[980px] overflow-hidden rounded-2xl border border-border bg-white">
                <div className="grid grid-cols-[78px_repeat(7,minmax(0,1fr))] border-b border-border bg-surface">
                  <div className="border-r border-border px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/45">
                    Hora
                  </div>
                  {calendarDays.map((day) => (
                    <div key={isoDate(day)} className="border-r border-border px-2 py-2 last:border-r-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/45">{formatWeekday(day)}</p>
                      <p className="mt-0.5 text-xs font-semibold text-foreground">{formatDayMonth(day)}</p>
                    </div>
                  ))}
                </div>

                <div className="grid h-[calc(100%-41px)] grid-cols-[78px_repeat(7,minmax(0,1fr))]">
                  <div className="relative h-full border-r border-border bg-surface/50">
                    {CALENDAR_LABELS.map((label, index) => (
                      <div
                        key={label}
                        className="absolute left-0 right-0 border-b border-dashed border-border/70 px-2 text-[9px] text-foreground/45"
                        style={{ top: `${(index / CALENDAR_SLOTS) * 100}%`, height: `${100 / CALENDAR_SLOTS}%` }}
                      >
                        <span className="-translate-y-1/2 inline-block bg-surface/80 pr-2">{label}</span>
                      </div>
                    ))}
                  </div>

                  {calendarDays.map((day, dayIndex) => {
                    const items = calendarEvents.filter((event) => event.dayIndex === dayIndex);
                    return (
                      <div key={isoDate(day)} className="relative h-full border-r border-border last:border-r-0">
                        {Array.from({ length: CALENDAR_SLOTS }).map((_, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() =>
                              openCreateFromCalendar(day, CALENDAR_START_MINUTES + index * CALENDAR_SLOT_MINUTES)
                            }
                            className="absolute left-0 right-0 border-b border-dashed border-border/70 text-left transition hover:bg-primary/5"
                            style={{ top: `${(index / CALENDAR_SLOTS) * 100}%`, height: `${100 / CALENDAR_SLOTS}%` }}
                            aria-label={`Registrar carga el ${formatDayMonth(day)} a las ${CALENDAR_LABELS[index]}`}
                          />
                        ))}

                        {items.map((event) => (
                          <div
                            key={event.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openEdit(event.row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openEdit(event.row);
                              }
                            }}
                            className={`absolute left-1 right-1 z-10 rounded-xl border px-2 py-1.5 text-left shadow-sm transition hover:ring-2 hover:ring-primary/20 ${event.tone}`}
                            style={{ top: event.top, height: event.height, minHeight: "78px" }}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <p className="pr-1 text-[10px] font-semibold leading-3">{event.subjectName}</p>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(event.row);
                                  }}
                                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/70 text-current transition hover:bg-white"
                                  aria-label="Editar carga"
                                >
                                  <Edit3 className="h-2.5 w-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void removeRow(event.row);
                                  }}
                                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/70 text-current transition hover:bg-white"
                                  aria-label="Eliminar carga"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-0.5 space-y-0.5 text-[9px] leading-3.5">
                              <p className="whitespace-normal opacity-85">
                                {event.audienceName} | {event.classroom || "N/A"}
                              </p>
                              <p className="whitespace-normal font-medium">
                                {event.timeRange} | {event.hoursLabel}
                              </p>
                              <p className="whitespace-normal opacity-75">{event.shortDateRange}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {!calendarEvents.length ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-foreground/55">
                {loading ? "Cargando calendario..." : `No hay registros de ${tab} en la semana seleccionada.`}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {modalOpen ? (
        <ModalShell title={editingId ? "Editar carga horaria" : "Nueva carga horaria"} onClose={closeModal}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Institución</span>
              <select
                value={form.institution}
                onChange={(e) => updateField("institution", e.target.value as "CESDE" | "SENA")}
                className="zs-input"
              >
                <option value="CESDE">CESDE</option>
                <option value="SENA">SENA</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Materia</span>
              <select value={form.subjectId} onChange={(e) => updateField("subjectId", e.target.value)} className="zs-input">
                <option value="">Selecciona una materia</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Periodo</span>
              <input
                type="text"
                value={form.period}
                onChange={(e) => updateField("period", e.target.value.toUpperCase())}
                placeholder="2026-01"
                className="zs-input"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">{form.institution === "SENA" ? "Ficha" : "Grupo"}</span>
              <select value={form.audienceId} onChange={(e) => updateField("audienceId", e.target.value)} className="zs-input">
                <option value="">{form.institution === "SENA" ? "Selecciona una ficha" : "Selecciona un grupo"}</option>
                {audienceOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {form.institution === "SENA" ? `Ficha ${item.name}` : item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Sede</span>
              <select value={form.siteId} onChange={(e) => updateField("siteId", e.target.value)} className="zs-input">
                <option value="">Selecciona una sede</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Jornada</span>
              <select value={form.shiftId} onChange={(e) => updateField("shiftId", e.target.value)} className="zs-input">
                <option value="">Selecciona una jornada</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Fecha de inicio</span>
              <input type="date" value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} className="zs-input" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Fecha de fin</span>
              <input type="date" value={form.endDate} onChange={(e) => updateField("endDate", e.target.value)} className="zs-input" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Hora de inicio</span>
              <input type="time" value={form.startTime} onChange={(e) => updateField("startTime", e.target.value)} className="zs-input" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Hora de fin</span>
              <input type="time" value={form.endTime} onChange={(e) => updateField("endTime", e.target.value)} className="zs-input" />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Salón</span>
              <input
                type="text"
                value={form.classroom}
                onChange={(e) => updateField("classroom", e.target.value)}
                placeholder="Ej. A-203"
                className="zs-input"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-surface px-4 py-4 md:grid-cols-4">
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <GraduationCap className="h-4 w-4" />
              <span>{subjects.find((item) => item.id === form.subjectId)?.name ?? "Materia"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <CalendarDays className="h-4 w-4" />
              <span>{form.period.trim() || "Periodo"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              {form.institution === "SENA" ? <Hash className="h-4 w-4" /> : <Group className="h-4 w-4" />}
              <span>
                {form.institution === "SENA"
                  ? audienceOptions.find((item) => item.id === form.audienceId)?.name
                    ? `Ficha ${audienceOptions.find((item) => item.id === form.audienceId)?.name}`
                    : "Ficha"
                  : audienceOptions.find((item) => item.id === form.audienceId)?.name ?? "Grupo"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <MapPinned className="h-4 w-4" />
              <span>{sites.find((item) => item.id === form.siteId)?.name ?? "Sede"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <Building2 className="h-4 w-4" />
              <span>{shifts.find((item) => item.id === form.shiftId)?.name ?? "Jornada"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <Clock3 className="h-4 w-4" />
              <span>{formatTimeRange(form.startTime, form.endTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <CalendarDays className="h-4 w-4" />
              <span>{dayNameFromIsoDate(form.startDate) || "Día principal"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/70 md:col-span-2">
              <Clock3 className="h-4 w-4" />
              <span>
                {currentDurationMinutes ? `${currentDurationMinutes} min reloj` : "Duración"}
                {currentDurationMinutes
                  ? ` -> ${formatHours(currentAcademicHours)} h ${form.institution === "CESDE" ? "académicas (45 min)" : "registradas"}`
                  : ""}
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={closeModal} className="zs-btn-secondary" disabled={saving}>
              Cancelar
            </button>
            <button type="button" onClick={() => void saveRow()} className="zs-btn-primary" disabled={saving}>
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar carga"}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {filtersOpen ? (
        <ModalShell
          title="Filtros de carga horaria"
          subtitle={`Filtra por materia, ${tab === "ALL" ? "grupo o ficha" : tab === "SENA" ? "ficha" : "grupo"}, sede, jornada, salón y rango de fechas.`}
          onClose={() => setFiltersOpen(false)}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground/70">
                {filteredRows.length} registro(s) encontrados
              </span>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="zs-btn-secondary h-9"
              >
                Limpiar filtros
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Materia</span>
                <select value={filters.subjectId} onChange={(e) => updateFilter("subjectId", e.target.value)} className="zs-input">
                  <option value="">Todas las materias</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  {tab === "ALL" ? "Grupo / Ficha" : tab === "SENA" ? "Ficha" : "Grupo"}
                </span>
                <select value={filters.audienceId} onChange={(e) => updateFilter("audienceId", e.target.value)} className="zs-input">
                  <option value="">
                    {tab === "ALL" ? "Todos los grupos y fichas" : tab === "SENA" ? "Todas las fichas" : "Todos los grupos"}
                  </option>
                  {filterAudienceOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Sede</span>
                <select value={filters.siteId} onChange={(e) => updateFilter("siteId", e.target.value)} className="zs-input">
                  <option value="">Todas las sedes</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Jornada</span>
                <select value={filters.shiftId} onChange={(e) => updateFilter("shiftId", e.target.value)} className="zs-input">
                  <option value="">Todas las jornadas</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Salón</span>
                <select value={filters.classroom} onChange={(e) => updateFilter("classroom", e.target.value)} className="zs-input">
                  <option value="">Todos los salones</option>
                  {classroomOptions.map((classroom) => (
                    <option key={classroom} value={classroom}>
                      {classroom}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Fecha desde</span>
                <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} className="zs-input" />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Fecha hasta</span>
                <input type="date" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} className="zs-input" />
              </label>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
