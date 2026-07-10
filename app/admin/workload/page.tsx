"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
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
  BadgeDollarSign,
  Building2,
  Calculator,
  CalendarDays,
  CalendarRange,
  Clock3,
  Eye,
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
  Sparkles,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
  Layers3,
} from "lucide-react";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError, reportFormSuccess } from "@/lib/form-feedback";
import { getSubjectTechnologyMeta } from "@/lib/subject-tech-branding";
import { getColombiaHolidayName } from "@/lib/colombia-holidays";

type CatalogItem = { id: string; name: string };

type TeachingLoadRow = {
  id: string;
  institution: "CESDE" | "SENA" | string;
  cesdeGroupType: "REGULAR" | "EMPRESARIAL" | string;
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
  weeklyAcademicHours: number;
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
  cesdeGroupType: "REGULAR" | "EMPRESARIAL";
  period: string;
  subjectId: string;
  audienceId: string;
  siteId: string;
  shiftId: string;
  startDate: string;
  endDate: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
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

type PayrollStatementItem = {
  loadId: string;
  subjectId: string;
  subjectName: string;
  audienceId: string;
  audienceName: string;
  audienceType: string;
  siteId: string;
  siteName: string;
  shiftId: string;
  shiftName: string;
  period: string;
  classroom: string;
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  academicHours: number;
  hourlyRate: number;
  estimatedValue: number;
  cesdeGroupType: string;
};

type PayrollStatementRow = {
  id: string;
  rangeStart: string;
  rangeEnd: string;
  hourlyRate: number;
  totalHours: number;
  totalValue: number;
  itemCount: number;
  items: PayrollStatementItem[];
  createdByEmail: string;
  createdByName: string;
  createdAtLabel: string;
};

const EMPTY_FORM: TeachingLoadForm = {
  institution: "CESDE",
  cesdeGroupType: "REGULAR",
  period: periodFromDate(isoDate(new Date())),
  subjectId: "",
  audienceId: "",
  siteId: "",
  shiftId: "",
  startDate: "",
  endDate: "",
  dayOfWeek1: "",
  dayOfWeek2: "",
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

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  DOMINGO: 0,
  DOM: 0,
  LUNES: 1,
  LUN: 1,
  MARTES: 2,
  MAR: 2,
  MIERCOLES: 3,
  MIE: 3,
  JUEVES: 4,
  JUE: 4,
  VIERNES: 5,
  VIE: 5,
  SABADO: 6,
  SAB: 6,
};

function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeWeekdayLabel(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function weekdayIndexFromName(value: string) {
  const normalized = normalizeWeekdayLabel(value);
  if (!normalized) return null;
  return WEEKDAY_INDEX_BY_NAME[normalized] ?? null;
}

function getRowWeekdayIndexes(row: Pick<TeachingLoadRow, "dayOfWeek1" | "dayOfWeek2" | "startDate">) {
  const selected = new Set<number>();
  [row.dayOfWeek1, row.dayOfWeek2].forEach((value) => {
    const index = weekdayIndexFromName(value);
    if (index !== null) selected.add(index);
  });
  if (!selected.size) {
    const fallbackIndex = weekdayIndexFromName(dayNameFromIsoDate(row.startDate));
    if (fallbackIndex !== null) selected.add(fallbackIndex);
  }
  return selected;
}

function normalizeCesdeGroupType(value: unknown) {
  return toString(value, "").trim().toUpperCase() === "EMPRESARIAL" ? "EMPRESARIAL" : "REGULAR";
}

function getWeeklySessionCount(values: {
  institution: string;
  cesdeGroupType: string;
  dayOfWeek2: string;
}) {
  const institution = (values.institution || "CESDE").toUpperCase();
  const cesdeGroupType = normalizeCesdeGroupType(values.cesdeGroupType);
  return institution === "CESDE" && cesdeGroupType === "EMPRESARIAL" && values.dayOfWeek2 ? 2 : 1;
}

function getWeeklyAcademicHours(values: {
  institution: string;
  cesdeGroupType: string;
  dayOfWeek2: string;
  academicHours: number;
  weeklyAcademicHours?: number;
}) {
  if (typeof values.weeklyAcademicHours === "number" && Number.isFinite(values.weeklyAcademicHours)) {
    return values.weeklyAcademicHours;
  }
  return roundHours(values.academicHours * getWeeklySessionCount(values));
}

function sortByName(items: CatalogItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

const WEEK_DAY_OPTIONS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"] as const;

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

function WorkloadFormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface px-3 py-3">
      <div className="flex items-start gap-2.5">
        <div className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl bg-white text-foreground shadow-sm ring-1 ring-border">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-foreground/55">{description}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2.5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function diffMinutes(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((n) => !Number.isFinite(n))) return 0;
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function calculateAcademicHours(durationMinutes: number, institution: string) {
  const minutesPerHour = institution === "CESDE" ? 45 : 60;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  return Math.max(0, Math.floor(durationMinutes / minutesPerHour));
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function formatHours(value: number) {
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLongDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value || "-";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
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

function currentFortnightRange() {
  const now = new Date();
  return fortnightRangeFromDate(now);
}

function fortnightRangeFromDate(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  if (day <= 15) {
    return {
      start: isoDate(new Date(year, month, 1)),
      end: isoDate(new Date(year, month, 15)),
    };
  }
  return {
    start: isoDate(new Date(year, month, 16)),
    end: isoDate(new Date(year, month + 1, 0)),
  };
}


function shiftFortnightRange(rangeStart: string, direction: -1 | 1) {
  const baseDate = parseLocalDate(rangeStart) ?? new Date();
  return fortnightRangeFromDate(addDays(baseDate, direction * 16));
}

function dayNameFromIsoDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return "";
  return ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"][date.getDay()] ?? "";
}

function periodFromDate(value: string) {
  const parsed = parseLocalDate(value);
  if (parsed) {
    const periodCode = parsed.getMonth() + 1 >= 7 ? "02" : "01";
    return `${parsed.getFullYear()}-${periodCode}`;
  }
  const fallbackDate = new Date();
  const fallbackPeriodCode = fallbackDate.getMonth() + 1 >= 7 ? "02" : "01";
  return `${fallbackDate.getFullYear()}-${fallbackPeriodCode}`;
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

function safeNumberFromInput(value: string) {
  const normalized = value.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTimestampLabel(value: unknown) {
  if (!value || typeof value !== "object") return "";
  try {
    if ("toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
      const date = (value as { toDate: () => Date }).toDate();
      return new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }
  } catch {}
  return "";
}

function buildPayrollOccurrences(row: TeachingLoadRow, rangeStart: string, rangeEnd: string, hourlyRate: number) {
  const start = parseLocalDate(rangeStart);
  const end = parseLocalDate(rangeEnd);
  const rowStart = parseLocalDate(row.startDate);
  const rowEnd = parseLocalDate(row.endDate) ?? rowStart;
  if (!start || !end || !rowStart || !rowEnd) return [] as PayrollStatementItem[];
  if (end < start) return [] as PayrollStatementItem[];
  const effectiveStart = isSameOrAfterDay(rowStart, start) ? rowStart : start;
  const effectiveEnd = isSameOrBeforeDay(rowEnd, end) ? rowEnd : end;
  if (effectiveEnd < effectiveStart) return [] as PayrollStatementItem[];
  const weekdayIndexes = getRowWeekdayIndexes(row);
  if (!weekdayIndexes.size) return [] as PayrollStatementItem[];

  const items: PayrollStatementItem[] = [];
  for (
    let cursor = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), effectiveStart.getDate());
    isSameOrBeforeDay(cursor, effectiveEnd);
    cursor = addDays(cursor, 1)
  ) {
    if (!weekdayIndexes.has(cursor.getDay())) continue;
    const date = isoDate(cursor);
    items.push({
      loadId: row.id,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      audienceId: row.audienceId,
      audienceName: row.audienceName,
      audienceType: row.audienceType,
      siteId: row.siteId,
      siteName: row.siteName,
      shiftId: row.shiftId,
      shiftName: row.shiftName,
      period: row.period,
      classroom: row.classroom,
      date,
      dayName: dayNameFromIsoDate(date),
      startTime: row.startTime,
      endTime: row.endTime,
      academicHours: row.academicHours,
      hourlyRate,
      estimatedValue: roundHours(row.academicHours * hourlyRate),
      cesdeGroupType: row.cesdeGroupType,
    });
  }
  return items;
}

function countOccurrencesInRange(row: TeachingLoadRow, rangeStart: string, rangeEnd: string) {
  const start = parseLocalDate(rangeStart);
  const end = parseLocalDate(rangeEnd);
  const rowStart = parseLocalDate(row.startDate);
  const rowEnd = parseLocalDate(row.endDate) ?? rowStart;
  if (!start || !end || !rowStart || !rowEnd) return 0;
  if (end < start) return 0;
  const effectiveStart = isSameOrAfterDay(rowStart, start) ? rowStart : start;
  const effectiveEnd = isSameOrBeforeDay(rowEnd, end) ? rowEnd : end;
  if (effectiveEnd < effectiveStart) return 0;
  const weekdayIndexes = getRowWeekdayIndexes(row);
  if (!weekdayIndexes.size) return 0;

  let total = 0;
  for (
    let cursor = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), effectiveStart.getDate());
    isSameOrBeforeDay(cursor, effectiveEnd);
    cursor = addDays(cursor, 1)
  ) {
    if (weekdayIndexes.has(cursor.getDay())) total += 1;
  }
  return total;
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

function getEventTone(institution: string, subjectName: string) {
  return getSubjectTechnologyMeta(subjectName)?.calendarCardClassName ?? eventTone(institution);
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
      <div className="relative w-[min(96vw,1500px)] max-w-none overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs text-foreground/55">{subtitle ?? "Registra horarios por institución y materia."}</p>
          </div>
          <button type="button" onClick={onClose} className="zs-btn-secondary h-9 w-9 px-0" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const DEFAULT_PAYROLL_VALUES = {
  cesdeHourlyRate: "0",
  senaMonthlySalary: "0",
};

export default function AdminWorkloadPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const feedback = useFeedback();

  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);
  const [sites, setSites] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);
  const [rows, setRows] = useState<TeachingLoadRow[]>([]);
  const [payrollStatements, setPayrollStatements] = useState<PayrollStatementRow[]>([]);

  const [tab, setTab] = useState<"CESDE" | "SENA" | "ALL">("CESDE");
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "payroll">("calendar");
  const [modalOpen, setModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeachingLoadForm>(EMPTY_FORM);
  const [filters, setFilters] = useState<WorkloadFilters>(EMPTY_FILTERS);
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => startOfWeek(new Date()));
  const [payrollRangeStart, setPayrollRangeStart] = useState(() => currentFortnightRange().start);
  const [payrollRangeEnd, setPayrollRangeEnd] = useState(() => currentFortnightRange().end);
  const [cesdeHourlyRate, setCesdeHourlyRate] = useState(DEFAULT_PAYROLL_VALUES.cesdeHourlyRate);
  const [senaMonthlySalary, setSenaMonthlySalary] = useState(DEFAULT_PAYROLL_VALUES.senaMonthlySalary);
  const [selectedPayrollStatement, setSelectedPayrollStatement] = useState<PayrollStatementRow | null>(null);

  function showValidationError(message: string) {
    return reportFormError({ message, feedback, setMessage: setError });
  }

  function movePayrollFortnight(direction: -1 | 1) {
    const nextRange = shiftFortnightRange(payrollRangeStart || payrollRangeEnd, direction);
    setPayrollRangeStart(nextRange.start);
    setPayrollRangeEnd(nextRange.end);
  }

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
          const cesdeGroupType = normalizeCesdeGroupType(row.cesdeGroupType);
          const startTime = toString(row.startTime, "");
          const endTime = toString(row.endTime, "");
          const startDate = toString(row.startDate, "");
          const dayOfWeek2 = toString(row.dayOfWeek2, "");
          const fallbackMinutes = Math.max(0, diffMinutes(startTime, endTime));
          const fallbackAcademicHours = calculateAcademicHours(fallbackMinutes, institution);
          const academicHours =
            typeof row.academicHours === "number" && Number.isFinite(row.academicHours)
              ? row.academicHours
              : fallbackAcademicHours;
          return {
            id: d.id,
            institution,
            cesdeGroupType,
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
            academicHours,
            weeklyAcademicHours:
              typeof row.weeklyAcademicHours === "number" && Number.isFinite(row.weeklyAcademicHours)
                ? row.weeklyAcademicHours
                : roundHours(academicHours * (institution === "CESDE" && cesdeGroupType === "EMPRESARIAL" && dayOfWeek2 ? 2 : 1)),
            dayOfWeek1: toString(row.dayOfWeek1, dayNameFromIsoDate(startDate)),
            dayOfWeek2,
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

  useEffect(() => {
    const q = query(collection(firestore, "payrollStatements"), orderBy("createdAt", "desc"), limit(40));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const row = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            rangeStart: toString(row.rangeStart, ""),
            rangeEnd: toString(row.rangeEnd, ""),
            hourlyRate: typeof row.hourlyRate === "number" && Number.isFinite(row.hourlyRate) ? row.hourlyRate : 0,
            totalHours: typeof row.totalHours === "number" && Number.isFinite(row.totalHours) ? row.totalHours : 0,
            totalValue: typeof row.totalValue === "number" && Number.isFinite(row.totalValue) ? row.totalValue : 0,
            itemCount: typeof row.itemCount === "number" && Number.isFinite(row.itemCount) ? row.itemCount : 0,
            createdByEmail: toString(row.createdByEmail, ""),
            createdByName: toString(row.createdByName, ""),
            createdAtLabel: getTimestampLabel(row.createdAt),
            items: Array.isArray(row.items)
              ? row.items.map((item) => {
                  const value = item as Record<string, unknown>;
                  return {
                    loadId: toString(value.loadId, ""),
                    subjectId: toString(value.subjectId, ""),
                    subjectName: toString(value.subjectName, ""),
                    audienceId: toString(value.audienceId, ""),
                    audienceName: toString(value.audienceName, ""),
                    audienceType: toString(value.audienceType, ""),
                    siteId: toString(value.siteId, ""),
                    siteName: toString(value.siteName, ""),
                    shiftId: toString(value.shiftId, ""),
                    shiftName: toString(value.shiftName, ""),
                    period: toString(value.period, ""),
                    classroom: toString(value.classroom, ""),
                    date: toString(value.date, ""),
                    dayName: toString(value.dayName, ""),
                    startTime: toString(value.startTime, ""),
                    endTime: toString(value.endTime, ""),
                    academicHours:
                      typeof value.academicHours === "number" && Number.isFinite(value.academicHours) ? value.academicHours : 0,
                    hourlyRate: typeof value.hourlyRate === "number" && Number.isFinite(value.hourlyRate) ? value.hourlyRate : 0,
                    estimatedValue:
                      typeof value.estimatedValue === "number" && Number.isFinite(value.estimatedValue) ? value.estimatedValue : 0,
                    cesdeGroupType: toString(value.cesdeGroupType, ""),
                  } satisfies PayrollStatementItem;
                })
              : [],
          } satisfies PayrollStatementRow;
        });
        setPayrollStatements(next);
      },
      () => {
        feedback.warning("No fue posible leer el historial de colillas guardadas.");
      },
    );
    return () => unsub();
  }, [feedback]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncViewport);
      return () => media.removeEventListener("change", syncViewport);
    }
    media.addListener(syncViewport);
    return () => media.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("workload-payroll-sim");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        cesdeHourlyRate: string;
        senaMonthlySalary: string;
        payrollRangeStart: string;
        payrollRangeEnd: string;
      }>;
      if (typeof parsed.cesdeHourlyRate === "string") setCesdeHourlyRate(parsed.cesdeHourlyRate);
      if (typeof parsed.senaMonthlySalary === "string") setSenaMonthlySalary(parsed.senaMonthlySalary);
      if (typeof parsed.payrollRangeStart === "string") setPayrollRangeStart(parsed.payrollRangeStart);
      if (typeof parsed.payrollRangeEnd === "string") setPayrollRangeEnd(parsed.payrollRangeEnd);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "workload-payroll-sim",
        JSON.stringify({
          cesdeHourlyRate,
          senaMonthlySalary,
          payrollRangeStart,
          payrollRangeEnd,
        }),
      );
    } catch {}
  }, [cesdeHourlyRate, payrollRangeEnd, payrollRangeStart, senaMonthlySalary]);

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
          .reduce((sum, row) => sum + getWeeklyAcademicHours(row), 0),
      ),
      SENA: roundHours(
        rows
          .filter((row) => (row.institution || "CESDE").toUpperCase() === "SENA")
          .reduce((sum, row) => sum + getWeeklyAcademicHours(row), 0),
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
    return calculateAcademicHours(currentDurationMinutes, form.institution);
  }, [currentDurationMinutes, form.institution]);
  const currentWeeklySessionCount = useMemo(
    () =>
      getWeeklySessionCount({
        institution: form.institution,
        cesdeGroupType: form.cesdeGroupType,
        dayOfWeek2: form.dayOfWeek2.trim(),
      }),
    [form.cesdeGroupType, form.dayOfWeek2, form.institution],
  );
  const currentWeeklyAcademicHours = useMemo(
    () =>
      getWeeklyAcademicHours({
        institution: form.institution,
        cesdeGroupType: form.cesdeGroupType,
        dayOfWeek2: form.dayOfWeek2.trim(),
        academicHours: currentAcademicHours,
      }),
    [currentAcademicHours, form.cesdeGroupType, form.dayOfWeek2, form.institution],
  );
  const effectiveViewMode = isMobile && viewMode === "calendar" ? "list" : viewMode;
  const payrollHourlyRateValue = useMemo(() => safeNumberFromInput(cesdeHourlyRate), [cesdeHourlyRate]);
  const senaMonthlySalaryValue = useMemo(() => safeNumberFromInput(senaMonthlySalary), [senaMonthlySalary]);

  const calendarDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(calendarWeekStart, index)),
    [calendarWeekStart],
  );
  const calendarHolidayMap = useMemo(
    () =>
      new Map<string, string>(
        calendarDays.flatMap((day) => {
          const holidayName = getColombiaHolidayName(day);
          return holidayName ? [[isoDate(day), holidayName] as [string, string]] : [];
        }),
      ),
    [calendarDays],
  );

  const calendarEvents = useMemo(() => {
    return filteredRows
      .flatMap((row) => {
        const rangeStart = parseLocalDate(row.startDate);
        const rangeEnd = parseLocalDate(row.endDate) ?? rangeStart;
        const startMinutes = minutesFromTime(row.startTime);
        const endMinutes = minutesFromTime(row.endTime);
        if (!rangeStart || !rangeEnd || startMinutes === null || endMinutes === null) return [];
        if (endMinutes <= startMinutes) return [];
        const weekdayIndexes = getRowWeekdayIndexes(row);
        if (!weekdayIndexes.size) return [];
        const topMinutes = Math.max(0, startMinutes - CALENDAR_START_MINUTES);
        const clampedEnd = Math.min(endMinutes, CALENDAR_END_MINUTES);
        const clampedStart = Math.max(startMinutes, CALENDAR_START_MINUTES);
        const blockMinutes = Math.max(30, clampedEnd - clampedStart);
        const top = `${(topMinutes / (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES)) * 100}%`;
        const height = `${(blockMinutes / (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES)) * 100}%`;
        return calendarDays.flatMap((day, dayIndex) => {
          const dayKey = isoDate(day);
          if (calendarHolidayMap.has(dayKey)) return [];
          if (!weekdayIndexes.has(day.getDay())) return [];
          if (!isSameOrAfterDay(day, rangeStart) || !isSameOrBeforeDay(day, rangeEnd)) return [];
          return [
            {
              id: `${row.id}-${dayKey}`,
              row,
              dayIndex,
              top,
              height,
              tone: getEventTone(row.institution, row.subjectName),
              subjectName: row.subjectName,
              audienceName: row.audienceType === "ficha" ? `Ficha ${row.audienceName}` : row.audienceName,
              classroom: row.classroom,
              timeRange: formatTimeRange(row.startTime, row.endTime),
              hoursLabel: `${formatHours(row.academicHours)} h`,
              dateRange: formatDateRange(row.startDate, row.endDate),
              shortDateRange: formatCompactDateRange(row.startDate, row.endDate),
            },
          ];
        });
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [calendarDays, calendarHolidayMap, filteredRows]);

  const calendarSummary = useMemo(() => {
    const cesdeLoadIds = new Set<string>();
    const senaLoadIds = new Set<string>();
    let cesdeHours = 0;
    let senaHours = 0;

    calendarEvents.forEach((event) => {
      const institution = (event.row.institution || "CESDE").toUpperCase();
      if (institution === "SENA") {
        senaLoadIds.add(event.row.id);
        senaHours += event.row.academicHours;
        return;
      }
      cesdeLoadIds.add(event.row.id);
      cesdeHours += event.row.academicHours;
    });

    return {
      totalLoads: cesdeLoadIds.size + senaLoadIds.size,
      cesdeLoads: cesdeLoadIds.size,
      senaLoads: senaLoadIds.size,
      totalEvents: calendarEvents.length,
      cesdeHours: roundHours(cesdeHours),
      senaHours: roundHours(senaHours),
    };
  }, [calendarEvents]);

  const payrollSummary = useMemo(() => {
    const cesdeRows = filteredRows.filter((row) => (row.institution || "CESDE").toUpperCase() === "CESDE");
    const senaRows = filteredRows.filter((row) => (row.institution || "CESDE").toUpperCase() === "SENA");

    const cesdeBreakdown = cesdeRows
      .map((row) => {
        const occurrences = countOccurrencesInRange(row, payrollRangeStart, payrollRangeEnd);
        const programmedHours = roundHours(occurrences * row.academicHours);
        const estimatedValue = roundHours(programmedHours * payrollHourlyRateValue);
        return {
          row,
          occurrences,
          programmedHours,
          estimatedValue,
        };
      })
      .filter((item) => item.occurrences > 0)
      .sort((a, b) => b.estimatedValue - a.estimatedValue || b.programmedHours - a.programmedHours);

    const cesdeHours = roundHours(cesdeBreakdown.reduce((sum, item) => sum + item.programmedHours, 0));
    const cesdeEstimated = roundHours(cesdeBreakdown.reduce((sum, item) => sum + item.estimatedValue, 0));
    const senaMonthlyReference = senaRows.length ? senaMonthlySalaryValue : 0;
    const senaQuincenaReference = roundHours(senaMonthlyReference / 2);

    return {
      cesdeBreakdown,
      cesdeLoads: cesdeBreakdown.length,
      cesdeHours,
      cesdeEstimated,
      senaLoads: senaRows.length,
      senaMonthlyReference,
      senaQuincenaReference,
      totalMixedReference: roundHours(cesdeEstimated + senaQuincenaReference),
    };
  }, [filteredRows, payrollHourlyRateValue, payrollRangeEnd, payrollRangeStart, senaMonthlySalaryValue]);

  const currentPayrollStatementItems = useMemo(
    () =>
      filteredRows
        .filter((row) => (row.institution || "CESDE").toUpperCase() === "CESDE")
        .flatMap((row) => buildPayrollOccurrences(row, payrollRangeStart, payrollRangeEnd, payrollHourlyRateValue))
        .sort((a, b) => `${a.date}|${a.startTime}|${a.subjectName}`.localeCompare(`${b.date}|${b.startTime}|${b.subjectName}`, "es")),
    [filteredRows, payrollHourlyRateValue, payrollRangeEnd, payrollRangeStart],
  );

  const summaryCards = useMemo(() => {
    if (effectiveViewMode === "payroll") {
      return {
        totalLabel: "Rango de nómina",
        totalValue: `${payrollRangeStart || "--"} -> ${payrollRangeEnd || "--"}`,
        totalHint: "Corte editable para la simulación",
        cesdeCount: `${formatHours(payrollSummary.cesdeHours)} h`,
        cesdeHours: payrollHourlyRateValue
          ? `${formatCurrency(payrollSummary.cesdeEstimated)} estimado`
          : "Define valor hora CESDE",
        senaCount: `${payrollSummary.senaLoads}`,
        senaHours: senaMonthlySalaryValue
          ? `${formatCurrency(payrollSummary.senaMonthlyReference)} mensual fijo`
          : "Define salario mensual SENA",
      };
    }
    if (effectiveViewMode === "calendar") {
      return {
        totalLabel: "Cargas visibles",
        totalValue: loading ? "-" : `${calendarSummary.totalLoads}`,
        totalHint: loading ? "-" : `${calendarSummary.totalEvents} bloque(s) en la semana`,
        cesdeCount: loading ? "-" : `${calendarSummary.cesdeLoads}`,
        cesdeHours: loading ? "-" : `${formatHours(calendarSummary.cesdeHours)} h académicas`,
        senaCount: loading ? "-" : `${calendarSummary.senaLoads}`,
        senaHours: loading ? "-" : `${formatHours(calendarSummary.senaHours)} h registradas`,
      };
    }

    return {
      totalLabel: "Cargas registradas",
      totalValue: loading ? "-" : `${rows.length}`,
      totalHint: "Vista completa del módulo",
      cesdeCount: loading ? "-" : `${counts.CESDE}`,
      cesdeHours: loading ? "-" : `${formatHours(hourTotals.CESDE)} h académicas/semana`,
      senaCount: loading ? "-" : `${counts.SENA}`,
      senaHours: loading ? "-" : `${formatHours(hourTotals.SENA)} h registradas/semana`,
    };
  }, [
    calendarSummary,
    counts.CESDE,
    counts.SENA,
    effectiveViewMode,
    hourTotals.CESDE,
    hourTotals.SENA,
    loading,
    payrollHourlyRateValue,
    payrollRangeEnd,
    payrollRangeStart,
    payrollSummary.cesdeEstimated,
    payrollSummary.cesdeHours,
    payrollSummary.senaLoads,
    payrollSummary.senaMonthlyReference,
    rows.length,
    senaMonthlySalaryValue,
  ]);

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
      cesdeGroupType: normalizeCesdeGroupType(row.cesdeGroupType),
      period: row.period || periodFromDate(row.startDate),
      subjectId: row.subjectId,
      audienceId: row.audienceId,
      siteId: row.siteId,
      shiftId: row.shiftId,
      startDate: row.startDate,
      endDate: row.endDate,
      dayOfWeek1: row.dayOfWeek1 || dayNameFromIsoDate(row.startDate) || "",
      dayOfWeek2: row.dayOfWeek2 || "",
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
    resetForm(normalizeInstitutionTab(tab));
  }

  function updateField<K extends keyof TeachingLoadForm>(key: K, value: TeachingLoadForm[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "institution") {
        next.audienceId = "";
        if (value === "SENA") {
          next.cesdeGroupType = "REGULAR";
          next.dayOfWeek2 = "";
        }
      }
      if (key === "cesdeGroupType" && value === "REGULAR") {
        next.dayOfWeek2 = "";
      }
      if (key === "startDate" && !prev.period.trim()) next.period = periodFromDate(String(value));
      return next;
    });
  }

  async function createOrLinkDriveForRow(args: {
    loadId: string;
    institution: "CESDE" | "SENA";
    cesdeGroupType: "REGULAR" | "EMPRESARIAL";
    period: string;
    subjectId: string;
    audienceId: string;
    siteName: string;
    shiftName: string;
    startDate: string;
    endDate: string;
    dayOfWeek1: string;
    dayOfWeek2: string;
  }) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      throw new Error("La carga se guardó, pero no hay sesión activa para crear la estructura de Drive.");
    }

    const token = await user.getIdToken();
    const workspaceId = makeTeachingLoadWorkspaceId(args.loadId);
    const response = await fetch("/api/admin/drive/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        workspaceId,
        sourceTeachingLoadId: args.loadId,
        institution: args.institution,
        cesdeGroupType: args.cesdeGroupType,
        subjectId: args.subjectId,
        groupId: args.audienceId,
        period: args.period,
        campus: args.siteName,
        jornada: args.shiftName,
        dayOfWeek1: args.dayOfWeek1,
        dayOfWeek2: args.dayOfWeek2,
        startDate: args.startDate,
        endDate: args.endDate,
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
      showValidationError("Debes seleccionar una materia.");
      return;
    }
    if (!site) {
      showValidationError("Debes seleccionar una sede.");
      return;
    }
    if (!audience) {
      showValidationError(form.institution === "SENA" ? "Debes seleccionar una ficha." : "Debes seleccionar un grupo.");
      return;
    }
    if (!shift) {
      showValidationError("Debes seleccionar una jornada.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      showValidationError("Debes ingresar fecha de inicio y fecha de fin.");
      return;
    }
    if (form.endDate < form.startDate) {
      showValidationError("La fecha de fin no puede ser menor que la fecha de inicio.");
      return;
    }
    if (!form.startTime || !form.endTime) {
      showValidationError("Debes ingresar hora de inicio y hora de fin.");
      return;
    }
    if (form.endTime <= form.startTime) {
      showValidationError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }
    const durationMinutes = diffMinutes(form.startTime, form.endTime);
    if (durationMinutes <= 0) {
      showValidationError("La franja horaria no es válida.");
      return;
    }
    const period = form.period.trim().toUpperCase();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      showValidationError("El periodo debe tener formato YYYY-PP, por ejemplo 2026-01.");
      return;
    }
    if (!form.classroom.trim()) {
      showValidationError("Debes ingresar el salón.");
      return;
    }
    const cesdeGroupType = form.institution === "CESDE" ? form.cesdeGroupType : "REGULAR";
    const academicHours = calculateAcademicHours(durationMinutes, form.institution);
    const dayOfWeek1 =
      form.institution === "CESDE" && cesdeGroupType === "EMPRESARIAL"
        ? form.dayOfWeek1.trim()
        : dayNameFromIsoDate(form.startDate) || "";
    if (!dayOfWeek1) {
      showValidationError("No fue posible resolver el día principal de la carga.");
      return;
    }
    const dayOfWeek2 =
      form.institution === "CESDE" && cesdeGroupType === "EMPRESARIAL" ? form.dayOfWeek2.trim() : "";
    if (form.institution === "CESDE" && cesdeGroupType === "EMPRESARIAL" && dayOfWeek2 && dayOfWeek2 === dayOfWeek1) {
      showValidationError("El segundo día no puede ser igual al primero.");
      return;
    }
    const weeklyAcademicHours = getWeeklyAcademicHours({
      institution: form.institution,
      cesdeGroupType,
      dayOfWeek2,
      academicHours,
    });

    const isEditing = Boolean(editingId);
    const savedId = editingId ?? doc(collection(firestore, "teachingLoads")).id;
    const classroom = form.classroom.trim().toUpperCase();
    const payload = {
      institution: form.institution,
      cesdeGroupType: form.institution === "CESDE" ? cesdeGroupType : "",
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
      classroom,
      durationMinutes,
      academicHours,
      weeklyAcademicHours,
      dayOfWeek1,
      dayOfWeek2,
      active: true,
      updatedAt: serverTimestamp(),
    };
    const hasLinkedDrive = Boolean(currentRow?.driveWorkspaceId?.trim());

    flushSync(() => {
      setError(null);
      setSuccess(null);
      closeModal();
    });

    window.setTimeout(() => {
      void (async () => {
        try {
          if (isEditing) {
            await updateDoc(doc(firestore, "teachingLoads", savedId), payload);
          } else {
            await setDoc(doc(firestore, "teachingLoads", savedId), {
              id: savedId,
              ...payload,
              driveWorkspaceId: "",
              driveStatus: "pending",
              driveErrorMessage: "",
              drivePublicFolderUrl: "",
              createdAt: serverTimestamp(),
            });
          }

          if (hasLinkedDrive) {
            setSuccess("Carga horaria actualizada correctamente. La estructura de Drive existente se conserva.");
            feedback.success("Carga horaria actualizada correctamente.");
            return;
          }

          await updateDoc(doc(firestore, "teachingLoads", savedId), {
            driveStatus: "pending",
            driveErrorMessage: "",
            updatedAt: serverTimestamp(),
          });
          try {
            const driveResult = await createOrLinkDriveForRow({
              loadId: savedId,
              institution: form.institution,
              cesdeGroupType,
              period,
              subjectId: subject.id,
              audienceId: audience.id,
              siteName: site.name,
              shiftName: shift.name,
              startDate: form.startDate,
              endDate: form.endDate,
              dayOfWeek1,
              dayOfWeek2,
            });
            await updateDoc(doc(firestore, "teachingLoads", savedId), {
              driveWorkspaceId: driveResult.workspaceId,
              driveStatus: "linked",
              driveErrorMessage: "",
              drivePublicFolderUrl: driveResult.publicFolderUrl,
              updatedAt: serverTimestamp(),
            });
            setSuccess(isEditing ? "Carga horaria actualizada y estructura de Drive vinculada." : "Carga horaria registrada y estructura de Drive creada.");
            feedback.success(isEditing ? "Carga horaria actualizada y Drive vinculado." : "Carga horaria registrada y Drive creado.");
          } catch (driveError) {
            const driveMessage =
              driveError instanceof Error ? driveError.message : "No fue posible crear la estructura de Drive.";
            await updateDoc(doc(firestore, "teachingLoads", savedId), {
              driveWorkspaceId: "",
              driveStatus: "error",
              driveErrorMessage: driveMessage,
              updatedAt: serverTimestamp(),
            });
            reportFormError({
              message: `La carga se guardó, pero Drive falló: ${driveMessage}`,
              feedback,
              setMessage: setError,
            });
            reportFormSuccess({
              message: `${isEditing ? "Carga horaria actualizada" : "Carga horaria registrada"}, pero la estructura de Drive no pudo crearse automáticamente.`,
              feedback,
              setMessage: setSuccess,
            });
          }
        } catch {
          reportFormError({
            message: "No fue posible guardar la carga horaria.",
            feedback,
            setMessage: setError,
          });
        }
      })();
    }, 0);
  }

  async function removeRow(row: TeachingLoadRow) {
    const confirmed = await feedback.confirm({
      title: "Eliminar carga horaria",
      description: row.driveWorkspaceId
        ? `Se eliminará ${row.subjectName} en ${row.siteName} para ${row.audienceName} y también se quitará su vínculo del panel de Drive.`
        : `Se eliminará ${row.subjectName} en ${row.siteName} para ${row.audienceName}.`,
      confirmLabel: "Eliminar carga",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    try {
      const user = firebaseAuth.currentUser;
      if (!user) {
        reportFormError({
          message: "Debes iniciar sesión como admin para eliminar la carga horaria.",
          feedback,
          setMessage: setError,
        });
        return;
      }

      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/workload/delete", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ teachingLoadId: row.id }),
      });
      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        reportFormError({
          message: typeof data?.error === "string" ? data.error : "No fue posible eliminar la carga horaria.",
          feedback,
          setMessage: setError,
        });
        return;
      }

      const deletedWorkspace = data?.deletedWorkspace === true;
      const successMessage = deletedWorkspace
        ? "Carga horaria eliminada y estructura de Drive retirada del panel."
        : "Carga horaria eliminada.";
      setSuccess(successMessage);
      feedback.success(successMessage);
    } catch {
      reportFormError({
        message: "No fue posible eliminar la carga horaria.",
        feedback,
        setMessage: setError,
      });
    }
  }

  async function downloadPayrollStatementPdf(statement: PayrollStatementRow) {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const marginX = 36;
      let cursorY = 42;

      doc.setFontSize(18);
      doc.text("Colilla de pago CESDE", marginX, cursorY);
      cursorY += 18;
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(`Corte: ${formatLongDate(statement.rangeStart)} - ${formatLongDate(statement.rangeEnd)}`, marginX, cursorY);
      cursorY += 14;
      doc.text(`Generada: ${statement.createdAtLabel || "-"}`, marginX, cursorY);
      cursorY += 14;
      doc.text(`Generó: ${statement.createdByName || statement.createdByEmail || "-"}`, marginX, cursorY);
      cursorY += 24;

      autoTable(doc, {
        startY: cursorY,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.5 },
        headStyles: { fillColor: [248, 245, 255], textColor: [77, 53, 140] },
        head: [["Fecha", "Materia", "Grupo", "Sede", "Jornada", "Hora", "Salón", "Horas", "Vlr hora", "Valor"]],
        body: statement.items.map((item) => [
          `${item.date} (${item.dayName})`,
          item.subjectName,
          item.audienceType === "ficha" ? `Ficha ${item.audienceName}` : item.audienceName,
          item.siteName,
          item.shiftName,
          `${item.startTime} - ${item.endTime}`,
          item.classroom || "-",
          formatHours(item.academicHours),
          formatCurrency(item.hourlyRate),
          formatCurrency(item.estimatedValue),
        ]),
        foot: [["", "", "", "", "", "", "Total", formatHours(statement.totalHours), "", formatCurrency(statement.totalValue)]],
      });

      doc.save(`colilla-cesde-${statement.rangeStart}-${statement.rangeEnd}.pdf`);
    } catch {
      feedback.error("No fue posible generar el PDF de la colilla.");
    }
  }

  async function savePayrollStatement() {
    if (!payrollRangeStart || !payrollRangeEnd) {
      showValidationError("Debes definir el rango quincenal para guardar la colilla.");
      return;
    }
    const payrollStartDate = parseLocalDate(payrollRangeStart);
    const payrollEndDate = parseLocalDate(payrollRangeEnd);
    if (!payrollStartDate || !payrollEndDate) {
      showValidationError("Las fechas de la quincena no tienen un formato válido.");
      return;
    }
    if (payrollEndDate.getTime() < payrollStartDate.getTime()) {
      showValidationError("La fecha final de la quincena no puede ser menor a la fecha inicial.");
      return;
    }
    if (!payrollHourlyRateValue) {
      showValidationError("Debes indicar el valor hora CESDE para guardar la colilla.");
      return;
    }
    if (!currentPayrollStatementItems.length) {
      showValidationError("No hay jornadas CESDE en el rango seleccionado para generar la colilla.");
      return;
    }

    try {
      const actor = firebaseAuth.currentUser;
      const statementRef = doc(collection(firestore, "payrollStatements"));
      const createdByName = actor?.displayName || actor?.email || "Administrador";
      const createdByEmail = actor?.email || "";
      const totalHours = roundHours(currentPayrollStatementItems.reduce((sum, item) => sum + item.academicHours, 0));
      const totalValue = roundHours(currentPayrollStatementItems.reduce((sum, item) => sum + item.estimatedValue, 0));

      await setDoc(statementRef, {
        id: statementRef.id,
        source: "workload-payroll",
        institution: "CESDE",
        rangeStart: payrollRangeStart,
        rangeEnd: payrollRangeEnd,
        hourlyRate: payrollHourlyRateValue,
        totalHours,
        totalValue,
        itemCount: currentPayrollStatementItems.length,
        items: currentPayrollStatementItems,
        createdByName,
        createdByEmail,
        createdAt: serverTimestamp(),
      });

      feedback.success("Colilla quincenal guardada en el historial.");
      setSuccess("Colilla quincenal guardada correctamente.");
    } catch {
      reportFormError({
        message: "No fue posible guardar la colilla quincenal.",
        feedback,
        setMessage: setError,
      });
    }
  }

  async function removePayrollStatement(statement: PayrollStatementRow) {
    const confirmed = await feedback.confirm({
      title: "Eliminar colilla",
      description: `Se eliminará la colilla del periodo ${statement.rangeStart} - ${statement.rangeEnd}. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar colilla",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteDoc(doc(firestore, "payrollStatements", statement.id));
      feedback.success("Colilla eliminada del historial.");
      setSuccess("Colilla eliminada correctamente.");
    } catch {
      reportFormError({
        message: "No fue posible eliminar la colilla.",
        feedback,
        setMessage: setError,
      });
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
    <div className="space-y-4 pb-6">
      <section className="zs-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Carga horaria</h1>
            <p className="mt-1 text-sm text-foreground/55">
              {viewMode === "calendar"
                ? "Agenda semanal por institución con creación rápida desde la cuadrícula."
                : viewMode === "payroll"
                  ? "Simula la nómina con horas programadas de CESDE y salario fijo mensual de SENA."
                  : "Registra franjas horarias por institución, sede, jornada, salón y materia."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="zs-btn-secondary h-9 px-3 text-xs">
              <RefreshCw className="h-4 w-4" />
              Recargar
            </button>
            <button type="button" onClick={() => openCreate()} className="zs-btn-primary h-9 px-3 text-xs">
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

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="zs-card-muted px-3 py-3">
            <p className="text-xs text-foreground/55">{summaryCards.totalLabel}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{summaryCards.totalValue}</p>
            <p className="mt-1 text-xs text-foreground/55">{summaryCards.totalHint}</p>
          </article>
          <article className="zs-card-muted px-3 py-3">
            <p className="text-xs text-foreground/55">CESDE</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-fuchsia-700">{summaryCards.cesdeCount}</p>
            <p className="mt-1 text-xs text-foreground/55">{summaryCards.cesdeHours}</p>
          </article>
          <article className="zs-card-muted px-3 py-3">
            <p className="text-xs text-foreground/55">SENA</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-700">{summaryCards.senaCount}</p>
            <p className="mt-1 text-xs text-foreground/55">{summaryCards.senaHours}</p>
          </article>
          <article className="zs-card-muted px-3 py-3">
            <p className="text-xs text-foreground/55">
              {effectiveViewMode === "payroll" ? "Mixto estimado" : "Materias activas"}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {effectiveViewMode === "payroll" ? formatCurrency(payrollSummary.totalMixedReference) : loading ? "-" : subjects.length}
            </p>
            <p className="mt-1 text-xs text-foreground/55">
              {effectiveViewMode === "payroll" ? "CESDE quincena + referencia SENA / 2" : "Disponibles para asignación"}
            </p>
          </article>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
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
            {isMobile ? (
              <div className="inline-flex rounded-2xl border border-border bg-surface p-1">
                {([
                  { id: "list", label: "Registros" },
                  { id: "payroll", label: "Nómina" },
                ] as const).map((item) => {
                  const active = effectiveViewMode === item.id;
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
            ) : (
              <div className="inline-flex rounded-2xl border border-border bg-surface p-1">
                {([
                  { id: "calendar", label: "Calendario" },
                  { id: "list", label: "Registros" },
                  { id: "payroll", label: "Nómina" },
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
            )}
          </div>
        </div>

        {effectiveViewMode === "list" ? (
          <div className="mt-4 space-y-3">
            {filteredRows.map((row) => (
              <div
                key={row.id}
                className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${
                  getSubjectTechnologyMeta(row.subjectName)?.listCardClassName ?? "border-border"
                }`}
              >
                {(() => {
                  const techMeta = getSubjectTechnologyMeta(row.subjectName);
                  const PrimaryIcon = techMeta?.primaryIcon;
                  const SecondaryIcon = techMeta?.secondaryIcon;
                  return (
                <>
                  {techMeta && PrimaryIcon ? (
                    <div className={`pointer-events-none absolute -bottom-6 -right-4 ${techMeta.watermarkClassName}`}>
                      <PrimaryIcon className="h-24 w-24" />
                    </div>
                  ) : null}
                <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white">
                        {row.institution}
                      </span>
                      {techMeta && PrimaryIcon ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 ${techMeta.badgeClassName}`}
                          aria-label={techMeta.label}
                          title={techMeta.label}
                        >
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-1 ${techMeta.iconWrapClassName}`}>
                            <PrimaryIcon className={techMeta.iconClassName} />
                            {SecondaryIcon ? <SecondaryIcon className={techMeta.iconClassName} /> : null}
                          </span>
                        </span>
                      ) : null}
                      <span className="text-sm font-semibold text-foreground">{row.subjectName}</span>
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground/75">
                        {row.audienceType === "ficha" ? `Ficha ${row.audienceName}` : row.audienceName}
                      </span>
                      {row.institution === "CESDE" ? (
                        <span className="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700">
                          {row.cesdeGroupType === "EMPRESARIAL" ? "CESDE empresarial" : "CESDE regular"}
                        </span>
                      ) : null}
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
                        {row.dayOfWeek2 ? `${row.dayOfWeek1} y ${row.dayOfWeek2}` : row.dayOfWeek1 || "Sin día"}
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
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatHours(getWeeklyAcademicHours(row))} h/semana
                        {getWeeklySessionCount(row) > 1 ? ` (${getWeeklySessionCount(row)} jornadas)` : ""}
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
                </>
                  );
                })()}
              </div>
            ))}

            {!filteredRows.length ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-foreground/55">
                {loading ? "Cargando carga horaria..." : `No hay registros para ${tab} con los filtros actuales.`}
              </div>
            ) : null}
          </div>
        ) : effectiveViewMode === "payroll" ? (
          <div className="mt-4 space-y-4">
            <div className="zs-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight text-foreground">Vista nómina</p>
                  <p className="mt-1 text-sm text-foreground/55">
                    Simulación operativa: CESDE se calcula por horas programadas en la quincena y SENA se trata como salario fijo mensual.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-foreground/70">
                    Corte: {payrollRangeStart}
                    {" -> "}
                    {payrollRangeEnd}
                  </div>
                  <button
                    type="button"
                    onClick={() => movePayrollFortnight(-1)}
                    className="zs-btn-secondary h-9 px-3 text-xs"
                    aria-label="Retroceder una quincena"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => movePayrollFortnight(1)}
                    className="zs-btn-secondary h-9 px-3 text-xs"
                    aria-label="Avanzar una quincena"
                  >
                    Siguiente
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => void savePayrollStatement()} className="zs-btn-primary h-9 px-3 text-xs">
                    <Save className="h-4 w-4" />
                    Guardar colilla
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[1.25fr_1fr]">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                      <CalendarRange className="h-3.5 w-3.5" />
                      Inicio quincena
                    </span>
                    <input
                      type="date"
                      value={payrollRangeStart}
                      onChange={(e) => setPayrollRangeStart(e.target.value)}
                      className="zs-input"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                      <CalendarRange className="h-3.5 w-3.5" />
                      Fin quincena
                    </span>
                    <input
                      type="date"
                      value={payrollRangeEnd}
                      onChange={(e) => setPayrollRangeEnd(e.target.value)}
                      className="zs-input"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fuchsia-700">
                      <BadgeDollarSign className="h-3.5 w-3.5" />
                      Valor hora CESDE
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cesdeHourlyRate}
                      onChange={(e) => setCesdeHourlyRate(e.target.value)}
                      placeholder="Ej. 25000"
                      className="zs-input"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      <Wallet className="h-3.5 w-3.5" />
                      Salario mensual SENA
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={senaMonthlySalary}
                      onChange={(e) => setSenaMonthlySalary(e.target.value)}
                      placeholder="Ej. 3200000"
                      className="zs-input"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <article className="zs-card-muted px-3 py-3">
                    <p className="text-xs text-foreground/55">Horas CESDE en quincena</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-fuchsia-700">
                      {formatHours(payrollSummary.cesdeHours)} h
                    </p>
                    <p className="mt-1 text-xs text-foreground/55">{payrollSummary.cesdeLoads} carga(s) con programación</p>
                  </article>
                  <article className="zs-card-muted px-3 py-3">
                    <p className="text-xs text-foreground/55">CESDE estimado quincena</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-fuchsia-700">
                      {formatCurrency(payrollSummary.cesdeEstimated)}
                    </p>
                    <p className="mt-1 text-xs text-foreground/55">Bruto simulado con valor hora editable</p>
                  </article>
                  <article className="zs-card-muted px-3 py-3">
                    <p className="text-xs text-foreground/55">SENA mensual fijo</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-700">
                      {formatCurrency(payrollSummary.senaMonthlyReference)}
                    </p>
                    <p className="mt-1 text-xs text-foreground/55">{payrollSummary.senaLoads} carga(s) SENA visibles</p>
                  </article>
                  <article className="zs-card-muted px-3 py-3">
                    <p className="text-xs text-foreground/55">Referencia mixta</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                      {formatCurrency(payrollSummary.totalMixedReference)}
                    </p>
                    <p className="mt-1 text-xs text-foreground/55">CESDE quincena + SENA / 2</p>
                  </article>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <section className="zs-card p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold tracking-tight text-foreground">Detalle CESDE por carga</p>
                    <p className="mt-1 text-sm text-foreground/55">
                      Se cuentan solo las clases o sesiones que realmente caen dentro del rango seleccionado.
                    </p>
                  </div>
                  <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground/70">
                    {payrollSummary.cesdeBreakdown.length} fila(s)
                  </span>
                </div>

                <div className="mt-4 grid gap-2.5 xl:grid-cols-3 2xl:grid-cols-4">
                  {payrollSummary.cesdeBreakdown.length ? (
                    payrollSummary.cesdeBreakdown.map((item) => (
                      <article key={item.row.id} className="rounded-xl border border-border bg-white px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold leading-4 text-foreground">{item.row.subjectName}</p>
                            <p className="mt-0.5 truncate text-[11px] text-foreground/55">
                              {item.row.audienceType === "ficha" ? `Ficha ${item.row.audienceName}` : item.row.audienceName} · {item.row.siteName} · {item.row.shiftName}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[13px] font-semibold leading-4 text-fuchsia-700">{formatCurrency(item.estimatedValue)}</p>
                            <p className="mt-0.5 text-[10px] text-foreground/55">{formatHours(item.programmedHours)} h</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-foreground/60">
                          <span className="inline-flex rounded-full border border-border bg-surface px-1.5 py-0.5">
                            {item.occurrences} {item.occurrences === 1 ? "clase" : "sesiones"}
                          </span>
                          <span className="inline-flex rounded-full border border-border bg-surface px-1.5 py-0.5">
                            {item.row.dayOfWeek2 ? `${item.row.dayOfWeek1} y ${item.row.dayOfWeek2}` : item.row.dayOfWeek1}
                          </span>
                          <span className="inline-flex rounded-full border border-border bg-surface px-1.5 py-0.5">
                            {formatTimeRange(item.row.startTime, item.row.endTime)}
                          </span>
                          <span className="inline-flex rounded-full border border-border bg-surface px-1.5 py-0.5">
                            {item.row.classroom || "Sin salón"}
                          </span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-foreground/55">
                      {loading ? "Calculando nómina..." : "No hay horas CESDE programadas en el rango seleccionado."}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section className="zs-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight text-foreground">Historial de colillas</p>
                  <p className="mt-1 text-sm text-foreground/55">
                    Cada corte guardado conserva su detalle para consulta futura y descarga en PDF.
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground/70">
                  {payrollStatements.length} registro(s)
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {payrollStatements.length ? (
                  payrollStatements.map((statement) => (
                    <article key={statement.id} className="rounded-2xl border border-border bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            Colilla {statement.createdAtLabel ? `· ${statement.createdAtLabel}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-foreground/55">
                            {statement.rangeStart} - {statement.rangeEnd}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[168px_110px_132px_148px]">
                          <div className="flex h-12 flex-col justify-center rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3">
                            <p className="text-[10px] leading-none text-fuchsia-700/75">Total</p>
                            <p className="mt-1 text-sm font-semibold leading-none text-fuchsia-700">{formatCurrency(statement.totalValue)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedPayrollStatement(statement)}
                            className="zs-btn-secondary h-12 justify-center px-3 text-xs"
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => void downloadPayrollStatementPdf(statement)}
                            className="zs-btn-secondary h-12 justify-center px-3 text-xs"
                          >
                            <Save className="h-4 w-4" />
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => void removePayrollStatement(statement)}
                            className="zs-btn-danger-soft h-12 justify-center px-3 text-xs"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-foreground/55">
                    Todavía no has guardado colillas quincenales.
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-4">
            <div className="zs-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight text-foreground">
                    {tab === "ALL" ? "Calendario general" : `Calendario ${tab}`}
                  </p>
                  <p className="mt-1 text-sm text-foreground/55">
                    Vista semanal de 6:00 am a 9:30 pm con acceso directo para crear, editar o eliminar cargas.
                  </p>
                </div>
                <div className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-foreground/70">
                  {formatWeekRange(calendarWeekStart)}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="zs-card-muted px-3 py-3">
                  <p className="text-xs text-foreground/55">Rango horario</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">6:00 am - 9:30 pm</p>
                  <p className="mt-1 text-xs text-foreground/55">{tab === "ALL" ? "CESDE + SENA" : tab}</p>
                </div>
                <div className="zs-card-muted px-3 py-3">
                  <p className="text-xs text-foreground/55">Registros visibles</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                    {loading ? "-" : calendarEvents.length}
                  </p>
                  <p className="mt-1 text-xs text-foreground/55">En la semana seleccionada</p>
                </div>
                <div className="zs-card-muted px-3 py-3">
                  <p className="text-xs text-foreground/55">Instituciones</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-foreground/60">
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
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCalendarWeekStart((prev) => addDays(prev, -7))}
                    className="zs-btn-secondary h-9 px-3 text-xs"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Semana anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarWeekStart(startOfWeek(new Date()))}
                    className="zs-btn-secondary h-9 px-3 text-xs"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarWeekStart((prev) => addDays(prev, 7))}
                    className="zs-btn-secondary h-9 px-3 text-xs"
                  >
                    Semana siguiente
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[1024px] overflow-hidden rounded-2xl border border-border bg-white">
                  <div className="grid grid-cols-[78px_repeat(7,minmax(0,1fr))] border-b border-border bg-surface">
                    <div className="border-r border-border px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/45">
                      Hora
                    </div>
                    {calendarDays.map((day) => {
                      const holidayName = calendarHolidayMap.get(isoDate(day));
                      return (
                        <div
                          key={isoDate(day)}
                          className={`border-r border-border px-2 py-2 last:border-r-0 ${holidayName ? "bg-amber-50/80" : ""}`}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/45">{formatWeekday(day)}</p>
                          <p className="mt-0.5 text-xs font-semibold text-foreground">{formatDayMonth(day)}</p>
                          {holidayName ? (
                            <span
                              className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                              title={holidayName}
                            >
                              Festivo
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid h-[960px] md:h-[1020px] xl:h-[1120px] grid-cols-[78px_repeat(7,minmax(0,1fr))]">
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
                      const holidayName = calendarHolidayMap.get(isoDate(day));
                      const items = calendarEvents.filter((event) => event.dayIndex === dayIndex);
                      return (
                        <div
                          key={isoDate(day)}
                          className={`relative h-full border-r border-border last:border-r-0 ${holidayName ? "bg-amber-50/35" : ""}`}
                        >
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
                          {holidayName ? (
                            <div className="pointer-events-none absolute inset-x-2 top-3 z-10 rounded-xl border border-amber-200 bg-amber-100/95 px-2 py-2 text-center shadow-sm">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">Festivo</p>
                              <p className="mt-1 text-[10px] text-amber-900/80">{holidayName}</p>
                            </div>
                          ) : null}

                          {items.map((event) => (
                            (() => {
                              const techMeta = getSubjectTechnologyMeta(event.subjectName);
                              const PrimaryIcon = techMeta?.primaryIcon;
                              const SecondaryIcon = techMeta?.secondaryIcon;
                              return (
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
                              className={`absolute left-1.5 right-1.5 z-10 overflow-hidden rounded-xl border px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-primary/20 ${event.tone}`}
                                  style={{ top: event.top, height: event.height, minHeight: "92px" }}
                                >
                                  {techMeta && PrimaryIcon ? (
                                    <div className={`pointer-events-none absolute -bottom-3 -right-2 ${techMeta.watermarkClassName}`}>
                                      <PrimaryIcon className="h-14 w-14" />
                                    </div>
                                  ) : null}
                                  <div className="relative z-10 flex items-start justify-between gap-1.5">
                                    <div className="min-w-0 pr-1">
                                      {techMeta && PrimaryIcon ? (
                                        <div className="mb-1 flex items-center gap-1.5">
                                          <span
                                            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-1 ${techMeta.iconWrapClassName}`}
                                            aria-label={techMeta.label}
                                            title={techMeta.label}
                                          >
                                            <PrimaryIcon className="h-3 w-3" />
                                            {SecondaryIcon ? <SecondaryIcon className="h-3 w-3" /> : null}
                                          </span>
                                        </div>
                                      ) : null}
                                      <p className="text-[10px] font-semibold leading-3.5">{event.subjectName}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEdit(event.row);
                                        }}
                                        className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/70 text-current transition hover:bg-white"
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
                                        className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/70 text-current transition hover:bg-white"
                                        aria-label="Eliminar carga"
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="relative z-10 mt-1.5 space-y-1 text-[9px] leading-3.5">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="inline-flex rounded-full border border-white/70 bg-white/70 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide opacity-90">
                                        {event.row.siteName || "Sin sede"}
                                      </span>
                                    </div>
                                    <p className="whitespace-normal opacity-85">
                                      {event.audienceName} | {event.classroom || "N/A"}
                                    </p>
                                    <p className="whitespace-normal font-medium">
                                      {event.timeRange} | {event.hoursLabel}
                                    </p>
                                    <p className="whitespace-normal opacity-75">{event.shortDateRange}</p>
                                  </div>
                                </div>
                              );
                            })()
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
          </div>
        )}
      </section>

      {modalOpen ? (
        <ModalShell title={editingId ? "Editar carga horaria" : "Nueva carga horaria"} onClose={closeModal}>
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(246,244,255,0.92),rgba(251,251,248,1))] px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-foreground/75 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    Configuración guiada de carga
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                    {subjects.find((item) => item.id === form.subjectId)?.name ?? "Selecciona la materia"}
                  </h3>
                  <p className="mt-1 text-sm text-foreground/60">
                    {form.institution} ·{" "}
                    {form.institution === "SENA"
                      ? audienceOptions.find((item) => item.id === form.audienceId)?.name
                        ? `Ficha ${audienceOptions.find((item) => item.id === form.audienceId)?.name}`
                        : "Ficha pendiente"
                      : audienceOptions.find((item) => item.id === form.audienceId)?.name ?? "Grupo pendiente"}{" "}
                    · {form.period.trim() || "Periodo"}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 md:w-[620px]">
                  <div className="rounded-2xl border border-border bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40">Sede</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {sites.find((item) => item.id === form.siteId)?.name ?? "Pendiente"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40">Jornada</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {shifts.find((item) => item.id === form.shiftId)?.name ?? "Pendiente"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40">Horario</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">{formatTimeRange(form.startTime, form.endTime)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40">Sesiones</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {currentWeeklySessionCount} jornada{currentWeeklySessionCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <WorkloadFormSection
                icon={Layers3}
                title="Base académica"
                description="Relaciona institución, materia y grupo para construir la carga desde el origen."
              >
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Institución</span>
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
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Materia</span>
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
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Periodo</span>
                <input
                  type="text"
                  value={form.period}
                  onChange={(e) => updateField("period", e.target.value.toUpperCase())}
                  placeholder="2026-01"
                  className="zs-input"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  {form.institution === "SENA" ? "Ficha" : "Grupo"}
                </span>
                <select value={form.audienceId} onChange={(e) => updateField("audienceId", e.target.value)} className="zs-input">
                  <option value="">{form.institution === "SENA" ? "Selecciona una ficha" : "Selecciona un grupo"}</option>
                  {audienceOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {form.institution === "SENA" ? `Ficha ${item.name}` : item.name}
                    </option>
                  ))}
                </select>
              </label>

              {form.institution === "CESDE" ? (
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Tipo de grupo CESDE</span>
                  <select
                    value={form.cesdeGroupType}
                    onChange={(e) => updateField("cesdeGroupType", e.target.value as "REGULAR" | "EMPRESARIAL")}
                    className="zs-input"
                  >
                    <option value="REGULAR">Regular</option>
                    <option value="EMPRESARIAL">Empresarial</option>
                  </select>
                </label>
              ) : null}
              </WorkloadFormSection>

              <WorkloadFormSection
                icon={Building2}
                title="Ubicación operativa"
                description="Define la sede, la jornada y el salón donde se ejecutará la carga."
              >
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Sede</span>
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
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Jornada</span>
                <select value={form.shiftId} onChange={(e) => updateField("shiftId", e.target.value)} className="zs-input">
                  <option value="">Selecciona una jornada</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Salón</span>
                <input
                  type="text"
                  value={form.classroom}
                  onChange={(e) => updateField("classroom", e.target.value)}
                  placeholder="Ej. A-203"
                  className="zs-input"
                />
              </label>
              </WorkloadFormSection>

              <WorkloadFormSection
                icon={CalendarDays}
                title="Agenda de la carga"
                description="Organiza fechas, horarios y frecuencia semanal según el tipo de grupo."
              >
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Fecha de inicio</span>
                <input type="date" value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} className="zs-input" />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Fecha de fin</span>
                <input type="date" value={form.endDate} onChange={(e) => updateField("endDate", e.target.value)} className="zs-input" />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Hora de inicio</span>
                <input type="time" value={form.startTime} onChange={(e) => updateField("startTime", e.target.value)} className="zs-input" />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Hora de fin</span>
                <input type="time" value={form.endTime} onChange={(e) => updateField("endTime", e.target.value)} className="zs-input" />
              </label>

              {form.institution === "CESDE" && form.cesdeGroupType === "EMPRESARIAL" ? (
                <>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Día 1</span>
                    <select value={form.dayOfWeek1} onChange={(e) => updateField("dayOfWeek1", e.target.value)} className="zs-input">
                      <option value="">Selecciona día</option>
                      {WEEK_DAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Día 2 (opcional)</span>
                    <select value={form.dayOfWeek2} onChange={(e) => updateField("dayOfWeek2", e.target.value)} className="zs-input">
                      <option value="">Sin segundo día</option>
                      {WEEK_DAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              </WorkloadFormSection>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface px-4 py-3 text-xs text-foreground/65">
            {form.institution === "CESDE" && form.cesdeGroupType === "EMPRESARIAL"
              ? "CESDE empresarial: define fecha de inicio, fecha de fin y hasta 2 días por semana. La carga semanal se ajusta según las jornadas configuradas, pero Drive mantiene una única estructura por grupo."
              : form.institution === "CESDE"
                ? "CESDE regular: se conserva la lógica estándar del encarpetado por semanas."
                : "SENA: se conserva la lógica estándar actual del módulo y del encarpetado."}
          </div>

          <div className="mt-4 grid gap-2 rounded-2xl border border-border bg-surface px-4 py-3 md:grid-cols-5">
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <GraduationCap className="h-4 w-4" />
              <span>{subjects.find((item) => item.id === form.subjectId)?.name ?? "Materia"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <CalendarDays className="h-4 w-4" />
              <span>{form.period.trim() || "Periodo"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              {form.institution === "SENA" ? <Hash className="h-4 w-4" /> : <Group className="h-4 w-4" />}
              <span>
                {form.institution === "SENA"
                  ? audienceOptions.find((item) => item.id === form.audienceId)?.name
                    ? `Ficha ${audienceOptions.find((item) => item.id === form.audienceId)?.name}`
                    : "Ficha"
                  : audienceOptions.find((item) => item.id === form.audienceId)?.name ?? "Grupo"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <MapPinned className="h-4 w-4" />
              <span>{sites.find((item) => item.id === form.siteId)?.name ?? "Sede"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <Building2 className="h-4 w-4" />
              <span>{shifts.find((item) => item.id === form.shiftId)?.name ?? "Jornada"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <Clock3 className="h-4 w-4" />
              <span>{formatTimeRange(form.startTime, form.endTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <CalendarDays className="h-4 w-4" />
              <span>
                {form.institution === "CESDE" && form.cesdeGroupType === "EMPRESARIAL"
                  ? form.dayOfWeek2
                    ? `${form.dayOfWeek1 || "Día 1"} y ${form.dayOfWeek2}`
                    : form.dayOfWeek1 || "Día principal"
                  : dayNameFromIsoDate(form.startDate) || "Día principal"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/70 md:col-span-2">
              <Clock3 className="h-4 w-4" />
              <span>
                {currentDurationMinutes ? `${currentDurationMinutes} min reloj` : "Duración"}
                {currentDurationMinutes
                  ? ` -> ${formatHours(currentAcademicHours)} h ${form.institution === "CESDE" ? "académicas (45 min)" : "registradas"}`
                  : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/70 md:col-span-2">
              <CalendarDays className="h-4 w-4" />
              <span>
                {currentDurationMinutes
                  ? `${currentWeeklySessionCount} jornada${currentWeeklySessionCount === 1 ? "" : "s"} por semana -> ${formatHours(currentWeeklyAcademicHours)} h/semana`
                  : "Carga semanal"}
              </span>
            </div>
            {form.institution === "CESDE" ? (
              <div className="flex items-center gap-2 text-xs text-foreground/70">
                <Group className="h-4 w-4" />
                <span>{form.cesdeGroupType === "EMPRESARIAL" ? "CESDE empresarial" : "CESDE regular"}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={closeModal} className="zs-btn-secondary">
              Cancelar
            </button>
            <button type="button" onClick={() => void saveRow()} className="zs-btn-primary">
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Guardar cambios" : "Registrar carga"}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {selectedPayrollStatement ? (
        <ModalShell
          title={`Colilla ${selectedPayrollStatement.rangeStart} - ${selectedPayrollStatement.rangeEnd}`}
          subtitle={`Detalle discriminado del corte guardado el ${selectedPayrollStatement.createdAtLabel}.`}
          onClose={() => setSelectedPayrollStatement(null)}
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="zs-card-muted px-3 py-3">
                <p className="text-xs text-foreground/55">Período</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {selectedPayrollStatement.rangeStart} - {selectedPayrollStatement.rangeEnd}
                </p>
              </div>
              <div className="zs-card-muted px-3 py-3">
                <p className="text-xs text-foreground/55">Valor hora</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatCurrency(selectedPayrollStatement.hourlyRate)}
                </p>
              </div>
              <div className="zs-card-muted px-3 py-3">
                <p className="text-xs text-foreground/55">Horas liquidadas</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatHours(selectedPayrollStatement.totalHours)} h
                </p>
              </div>
              <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-3">
                <p className="text-xs text-fuchsia-700/75">Total liquidado</p>
                <p className="mt-1 text-sm font-semibold text-fuchsia-700">
                  {formatCurrency(selectedPayrollStatement.totalValue)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Detalle de clases liquidadas</p>
                  <p className="mt-1 text-xs text-foreground/55">
                    {selectedPayrollStatement.itemCount} registro(s) incluidos en la colilla.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void downloadPayrollStatementPdf(selectedPayrollStatement)}
                  className="zs-btn-secondary h-9 px-3 text-xs"
                >
                  <Save className="h-4 w-4" />
                  Descargar PDF
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-surface text-foreground/55">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Materia</th>
                      <th className="px-3 py-2 font-semibold">Grupo</th>
                      <th className="px-3 py-2 font-semibold">Sede</th>
                      <th className="px-3 py-2 font-semibold">Jornada</th>
                      <th className="px-3 py-2 font-semibold">Fecha</th>
                      <th className="px-3 py-2 font-semibold">Horario</th>
                      <th className="px-3 py-2 font-semibold">Salón</th>
                      <th className="px-3 py-2 font-semibold text-right">Horas</th>
                      <th className="px-3 py-2 font-semibold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPayrollStatement.items.map((item, index) => (
                      <tr key={`${item.loadId}-${item.date}-${index}`} className="border-t border-border/70">
                        <td className="px-3 py-2.5 font-medium text-foreground">{item.subjectName}</td>
                        <td className="px-3 py-2.5 text-foreground/70">
                          {item.audienceType === "ficha" ? `Ficha ${item.audienceName}` : item.audienceName}
                        </td>
                        <td className="px-3 py-2.5 text-foreground/70">{item.siteName}</td>
                        <td className="px-3 py-2.5 text-foreground/70">{item.shiftName}</td>
                        <td className="px-3 py-2.5 text-foreground/70">
                          {item.date} · {item.dayName}
                        </td>
                        <td className="px-3 py-2.5 text-foreground/70">{formatTimeRange(item.startTime, item.endTime)}</td>
                        <td className="px-3 py-2.5 text-foreground/70">{item.classroom || "-"}</td>
                        <td className="px-3 py-2.5 text-right text-foreground/70">{formatHours(item.academicHours)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-fuchsia-700">
                          {formatCurrency(item.estimatedValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
