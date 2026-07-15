"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { firestore } from "@/lib/firebase/client";
import { useAuth } from "@/app/providers";
import { getColombiaHolidayName } from "@/lib/colombia-holidays";
import { getTeachingLoadSessions } from "@/lib/teaching-load-sessions";

type DashboardData = {
  counts: {
    templatesTotal: number;
    templatesActive: number;
    publishedActive: number;
    publishedClosed: number;
    questionsTotal: number;
    questionsPublished: number;
    questionsDraft: number;
    questionsArchived: number;
    subjectsTotal: number;
    groupsTotal: number;
    fichasTotal: number;
    sitesTotal: number;
    shiftsTotal: number;
    momentsTotal: number;
    studyDocsActive: number;
    driveWorkspacesTotal: number;
    teachingLoadsTotal: number;
    teachingLoadsActive: number;
    teachingHoursTotal: number;
    teachingHoursCesde: number;
    teachingHoursSena: number;
    attemptsTotal: number;
    attemptsSubmitted: number;
    attemptsInProgress: number;
    attemptsFraudSubmitted: number;
    attemptsAnnulled: number;
  };
  activity14: { labels: string[]; values: number[] };
  gradeDist: { label: string; value: number }[];
  summary7: { avgGrade: number | null; fraudAttempts: number; submittedAttempts: number };
  topExams7: { exam: string; group: string; submissions: number; avg: string }[];
  latestAttempts: {
    when: string;
    exam: string;
    student: string;
    grade: string;
    status: string;
    fraud: number;
  }[];
};

type TeachingLoadRow = {
  id: string;
  institution: string;
  cesdeGroupType: string;
  subjectName: string;
  audienceName: string;
  audienceType: string;
  siteName: string;
  shiftName: string;
  startDate: string;
  endDate: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  driveWorkspaceId: string;
  startTime: string;
  endTime: string;
  day2StartTime: string;
  day2EndTime: string;
  classroom: string;
  durationMinutes: number;
  academicHours: number;
  day2DurationMinutes: number;
  day2AcademicHours: number;
  active: boolean;
};

type DriveWorkspaceRow = {
  id: string;
  institution: string;
  subjectName: string;
  groupName: string;
  period: string;
  campus: string;
  jornada: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  weekCount: number;
  healthBroken: boolean;
};

function normalizeGradeTo5(item: Record<string, unknown>) {
  const candidates = [
    item.grade0to5,
    item.score0to5,
    item.finalScore5,
    item.grade5,
    item.score5,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
  }
  if (typeof item.grade0to50 === "number" && Number.isFinite(item.grade0to50)) {
    return item.grade0to50 / 10;
  }
  if (typeof item.score0to50 === "number" && Number.isFinite(item.score0to50)) {
    return item.score0to50 / 10;
  }
  return null;
}

function safeToString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getFirestoreErrorCode(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code;
  }
  return "unknown";
}

function countFromAggregateSnap(value: unknown) {
  try {
    if (value && typeof value === "object" && "data" in value) {
      const dataFn = (value as { data?: unknown }).data;
      if (typeof dataFn === "function") {
        const data = (dataFn as () => unknown)();
        if (data && typeof data === "object" && "count" in data) {
          const c = (data as { count?: unknown }).count;
          if (typeof c === "number" && Number.isFinite(c)) return c;
        }
      }
    }
  } catch {}
  return 0;
}

function docsFromQuerySnap<T = unknown>(value: unknown): T[] {
  if (value && typeof value === "object" && "docs" in value) {
    const docs = (value as { docs?: unknown }).docs;
    if (Array.isArray(docs)) return docs as T[];
  }
  return [];
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatFixed(value: number, digits: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

function formatHoursValue(value: number) {
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
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
  next.setHours(0, 0, 0, 0);
  return next;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every((n) => Number.isFinite(n))) return null;
  return new Date(year, month - 1, day);
}

function isSameOrAfterDay(target: Date, reference: Date) {
  return new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() >=
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
}

function isSameOrBeforeDay(target: Date, reference: Date) {
  return new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() <=
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
}

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

function normalizeWeekdayLabel(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function minutesFromTimeLoose(value: string) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const hasPm = /\bp\.?\s*m\.?\b|\bpm\b/.test(trimmed);
  const hasAm = /\ba\.?\s*m\.?\b|\bam\b/.test(trimmed);
  if (hasPm && hour < 12) hour += 12;
  if (hasAm && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatWeekRange(startDate: Date) {
  const endDate = addDays(startDate, 6);
  const startLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(endDate);
  return `${startLabel} - ${endLabel}`;
}

function formatWeekdayShort(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(date);
}

function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(date);
}

function formatTimeMinutes(value: number) {
  const safe = Math.max(0, value);
  const hour24 = Math.floor(safe / 60);
  const minute = safe % 60;
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function computeDurationMinutes(institution: string, durationMinutesRaw: number, startTime: string, endTime: string) {
  if (Number.isFinite(durationMinutesRaw) && durationMinutesRaw > 0) return durationMinutesRaw;
  const startMinutes = minutesFromTimeLoose(startTime);
  const endMinutes = minutesFromTimeLoose(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return 0;
  return endMinutes - startMinutes;
}

function computeAcademicHours(institution: string, academicHoursRaw: unknown, durationMinutes: number) {
  if (typeof academicHoursRaw === "number" && Number.isFinite(academicHoursRaw) && academicHoursRaw > 0) {
    return academicHoursRaw;
  }
  const minutesPerHour = institution.toUpperCase() === "SENA" ? 60 : 45;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  return Math.max(0, Math.floor(durationMinutes / minutesPerHour));
}

function formatChartValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return formatCompactNumber(value);
  if (typeof value === "string" && value.trim()) return value;
  return "-";
}

function Bar3DShape(props: Record<string, unknown>) {
  const x = typeof props.x === "number" ? props.x : 0;
  const y = typeof props.y === "number" ? props.y : 0;
  const width = typeof props.width === "number" ? props.width : 0;
  const height = typeof props.height === "number" ? props.height : 0;
  const fill = typeof props.fill === "string" ? props.fill : "currentColor";
  if (width <= 0 || height <= 0) return null;
  const depth = Math.min(10, Math.max(4, Math.round(width * 0.18)));
  const sideFill = `${fill}CC`;
  const topFill = `${fill}AA`;
  const front = `M${x},${y + height} L${x},${y} L${x + width},${y} L${x + width},${y + height} Z`;
  const top = `M${x},${y} L${x + depth},${y - depth} L${x + width + depth},${y - depth} L${x + width},${y} Z`;
  const side = `M${x + width},${y} L${x + width + depth},${y - depth} L${x + width + depth},${y + height - depth} L${x + width},${y + height} Z`;
  return (
    <g>
      <path d={top} fill={topFill} />
      <path d={side} fill={sideFill} />
      <path d={front} fill={fill} />
    </g>
  );
}

function toDateFromTimestamp(value: unknown) {
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

function buildSparkPath(values: number[], w: number, h: number) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = values.length === 1 ? 0 : w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function MiniSparkline({
  values,
  tone,
}: {
  values: number[];
  tone: "zinc" | "emerald" | "indigo";
}) {
  const path = useMemo(() => buildSparkPath(values, 88, 22), [values]);
  const stroke =
    tone === "emerald" ? "stroke-emerald-600" : tone === "indigo" ? "stroke-indigo-600" : "stroke-zinc-700";
  const fill =
    tone === "emerald"
      ? "fill-emerald-50"
      : tone === "indigo"
        ? "fill-indigo-50"
        : "fill-zinc-100";
  if (!values.length) {
    return <div className="h-6 w-92px rounded-md bg-zinc-100" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values.map((v, i) => {
    const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 88;
    const y = 22 - ((v - min) / span) * 22;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const area = `M 0 22 L ${points.join(" ")} L 88 22 Z`.replaceAll(" ", " ");
  return (
    <svg viewBox="0 0 88 22" className="h-6 w-92px">
      <path d={area} className={fill} />
      <path d={path} className={`${stroke} fill-none`} strokeWidth={2} />
    </svg>
  );
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-14 items-end gap-1">
      {values.map((v, idx) => (
        <div
          key={idx}
          className="w-2 rounded-sm bg-primary"
          style={{ height: `${Math.round((v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Donut({
  items,
}: {
  items: { label: string; value: number; tone: "zinc" | "emerald" | "amber" }[];
}) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const r = 16;
  const c = 2 * Math.PI * r;
  const toneToStroke = (tone: "zinc" | "emerald" | "amber") =>
    tone === "emerald" ? "stroke-emerald-500" : tone === "amber" ? "stroke-amber-500" : "stroke-zinc-700";
  const segments = items.reduce(
    (acc, it) => {
      const frac = it.value / total;
      const dash = frac * c;
      const dasharray = `${dash.toFixed(2)} ${(c - dash).toFixed(2)}`;
      const next = {
        label: it.label,
        tone: it.tone,
        dasharray,
        dashoffset: (-acc.offset).toFixed(2),
      };
      return { offset: acc.offset + dash, segs: [...acc.segs, next] };
    },
    {
      offset: 0,
      segs: [] as { label: string; tone: "zinc" | "emerald" | "amber"; dasharray: string; dashoffset: string }[],
    },
  ).segs;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 44 44" className="h-16 w-16 -rotate-90">
        <circle cx="22" cy="22" r={r} className="stroke-zinc-100" strokeWidth="8" fill="none" />
        {segments.map((seg) => (
          <circle
            key={seg.label}
            cx="22"
            cy="22"
            r={r}
            className={toneToStroke(seg.tone)}
            strokeWidth="8"
            fill="none"
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.dashoffset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="min-w-0 space-y-1 text-sm">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-4">
            <span className="truncate text-zinc-700">{it.label}</span>
            <span className="shrink-0 font-semibold text-zinc-900">
              {formatCompactNumber(it.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  valueMeta,
}: {
  label: string;
  value: React.ReactNode;
  subtitle: React.ReactNode;
  valueMeta?: React.ReactNode;
}) {
  return (
    <article className="zs-card flex min-h-[106px] flex-col justify-between p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/45">{label}</p>
      <div className="mt-2 flex flex-1 flex-col justify-end">
        <p className="text-2xl font-semibold leading-none tracking-tight text-foreground">{value}</p>
        {valueMeta ? (
          <div className="mt-2">
            <span className="inline-flex rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/60">
              {valueMeta}
            </span>
          </div>
        ) : null}
      </div>
      <p className="mt-2 truncate text-[11px] leading-tight text-foreground/55">{subtitle}</p>
    </article>
  );
}

export function DashboardView() {
  const { loading: authLoading, isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [teachingLoads, setTeachingLoads] = useState<TeachingLoadRow[]>([]);
  const [driveWorkspaces, setDriveWorkspaces] = useState<DriveWorkspaceRow[]>([]);
  const [data, setData] = useState<DashboardData>({
    counts: {
      templatesTotal: 0,
      templatesActive: 0,
      publishedActive: 0,
      publishedClosed: 0,
      questionsTotal: 0,
      questionsPublished: 0,
      questionsDraft: 0,
      questionsArchived: 0,
      subjectsTotal: 0,
      groupsTotal: 0,
      fichasTotal: 0,
      sitesTotal: 0,
      shiftsTotal: 0,
      momentsTotal: 0,
      studyDocsActive: 0,
      driveWorkspacesTotal: 0,
      teachingLoadsTotal: 0,
      teachingLoadsActive: 0,
      teachingHoursTotal: 0,
      teachingHoursCesde: 0,
      teachingHoursSena: 0,
      attemptsTotal: 0,
      attemptsSubmitted: 0,
      attemptsInProgress: 0,
      attemptsFraudSubmitted: 0,
      attemptsAnnulled: 0,
    },
    activity14: { labels: [], values: [] },
    gradeDist: [],
    summary7: { avgGrade: null, fraudAttempts: 0, submittedAttempts: 0 },
    topExams7: [],
    latestAttempts: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (authLoading) {
        setLoading(true);
        return;
      }
      if (!user || !isAdmin) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      let issuesHint: string | null = null;
      try {
        const debug =
          process.env.NODE_ENV !== "production" ||
          (typeof window !== "undefined" &&
            (new URLSearchParams(window.location.search).has("debug") ||
              window.localStorage.getItem("debug-dashboard") === "1"));
        const submittedStatuses = new Set(["submitted", "submitted_expired", "submitted_fraud"]);
        const now = new Date();
        const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        if (debug) {
          console.log("[dashboard] load start", {
            now: now.toISOString(),
            start7: start7.toISOString(),
            submittedStatuses: Array.from(submittedStatuses),
          });
        }

        const trace = (key: string, promise: Promise<unknown>) => {
          if (!debug) return promise;
          console.log(`[dashboard] ${key} -> start`);
          return promise
            .then((v) => {
              console.log(`[dashboard] ${key} -> ok`);
              return v;
            })
            .catch((e) => {
              console.error(`[dashboard] ${key} -> fail`, e);
              throw e;
            });
        };

        const fetches: Record<string, Promise<unknown>> = {};
        const add = (key: string, factory: () => Promise<unknown>) => {
          try {
            fetches[key] = trace(key, factory());
          } catch (e) {
            if (debug) console.error(`[dashboard] ${key} -> sync fail`, e);
            throw e;
          }
        };

        add("templatesTotal", () => getCountFromServer(collection(firestore, "examTemplates")));
        add("templatesActive", () =>
          getCountFromServer(query(collection(firestore, "examTemplates"), where("active", "==", true))),
        );
        add("publishedActive", () =>
          getCountFromServer(query(collection(firestore, "publishedExams"), where("status", "==", "published"))),
        );
        add("publishedClosed", () =>
          getCountFromServer(query(collection(firestore, "publishedExams"), where("status", "==", "closed"))),
        );
        add("questionsTotal", () => getCountFromServer(collection(firestore, "questions")));
        add("questionsPublished", () =>
          getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "published"))),
        );
        add("questionsDraft", () =>
          getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "draft"))),
        );
        add("questionsArchived", () =>
          getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "archived"))),
        );
        add("subjectsTotal", () => getCountFromServer(collection(firestore, "subjects")));
        add("groupsTotal", () => getCountFromServer(collection(firestore, "groups")));
        add("fichasTotal", () => getCountFromServer(collection(firestore, "fichas")));
        add("sitesTotal", () => getCountFromServer(collection(firestore, "sites")));
        add("shiftsTotal", () => getCountFromServer(collection(firestore, "shifts")));
        add("momentsTotal", () => getCountFromServer(collection(firestore, "moments")));
        add("studyDocsActive", () =>
          getCountFromServer(query(collection(firestore, "studyDocs"), where("active", "==", true))),
        );
        add("driveWorkspacesTotal", () => getCountFromServer(collection(firestore, "driveWorkspaces")));
        add("driveWorkspaces", () => getDocs(collection(firestore, "driveWorkspaces")));
        add("teachingLoads", () => getDocs(collection(firestore, "teachingLoads")));
        add("attemptsTotal", () => getCountFromServer(collection(firestore, "attempts")));
        add("attemptsSubmitted", () =>
          getCountFromServer(
            query(collection(firestore, "attempts"), where("status", "in", Array.from(submittedStatuses))),
          ),
        );
        add("attemptsInProgress", () =>
          getCountFromServer(query(collection(firestore, "attempts"), where("status", "==", "in_progress"))),
        );
        add("attemptsFraudSubmitted", () =>
          getCountFromServer(query(collection(firestore, "attempts"), where("status", "==", "submitted_fraud"))),
        );
        add("attemptsAnnulled", () =>
          getCountFromServer(query(collection(firestore, "attempts"), where("status", "==", "annulled"))),
        );
        add("groups", () => getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(300))));
        add("fichas", () => getDocs(query(collection(firestore, "fichas"), orderBy("name"), limit(800))));
        add("templatesSample", () => getDocs(query(collection(firestore, "examTemplates"), limit(60))));
        add("attemptsRecent", () =>
          getDocs(query(collection(firestore, "attempts"), orderBy("submittedAt", "desc"), limit(500))),
        );

        const [questionsTotalSnap, questionsPublishedSnap, questionsDraftSnap, questionsArchivedSnap] =
          await Promise.all([
            getCountFromServer(collection(firestore, "questions")),
            getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "published"))),
            getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "draft"))),
            getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "archived"))),
          ]);

        const entries = Object.entries(fetches);
        const settled = await Promise.allSettled(entries.map(([, p]) => p));
        const issues: string[] = [];
        const out: Record<string, unknown> = {};
        settled.forEach((res, idx) => {
          const key = entries[idx]?.[0] ?? "unknown";
          if (res.status === "fulfilled") out[key] = res.value;
          else issues.push(`${key} (${getFirestoreErrorCode(res.reason)})`);
        });

        if (issues.length) {
          issuesHint = `Sin permisos o reglas bloqueando lecturas en: \n${issues.map((i) => `- ${i}`).join("\n")}`;
          setError(issuesHint);
        }
        if (debug) {
          console.log("[dashboard] settled", {
            ok: entries.map(([k]) => k).filter((k) => k in out),
            issues,
          });
        }

        const groupDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.groups);
        const fichaDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.fichas);
        const templateDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.templatesSample);
        const attemptDocs = docsFromQuerySnap<{ data: () => Record<string, unknown> }>(out.attemptsRecent);
        const teachingLoadDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.teachingLoads);
        const driveWorkspaceDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.driveWorkspaces);

        const groups = groupDocs.map((d) => ({
          id: d.id,
          name: safeToString(d.data().name, d.id),
        }));
        const fichas = fichaDocs.map((d) => ({
          id: d.id,
          name: safeToString(d.data().name, d.id),
        }));

        const templates = templateDocs.map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: safeToString(row.name, docSnap.id),
            groupId: safeToString(row.groupId, "sin-grupo"),
          };
        });

        const teachingLoadSummary = teachingLoadDocs.reduce(
          (acc, docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            const institution = safeToString(row.institution, "CESDE").toUpperCase();
            const durationMinutesRaw =
              typeof row.durationMinutes === "number" && Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0;
            const durationMinutes = computeDurationMinutes(
              institution,
              durationMinutesRaw,
              safeToString(row.startTime, ""),
              safeToString(row.endTime, ""),
            );
            const academicHours = computeAcademicHours(institution, row.academicHours, durationMinutes);
            const active = typeof row.active === "boolean" ? row.active : true;
            acc.total += 1;
            if (active) acc.active += 1;
            acc.hoursTotal += academicHours;
            if (institution === "SENA") acc.hoursSena += academicHours;
            else acc.hoursCesde += academicHours;
            return acc;
          },
          { total: 0, active: 0, hoursTotal: 0, hoursCesde: 0, hoursSena: 0 },
        );

        const teachingLoadRows: TeachingLoadRow[] = teachingLoadDocs.map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const institution = safeToString(row.institution, "CESDE").toUpperCase();
          const durationMinutesRaw =
            typeof row.durationMinutes === "number" && Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0;
          const day2DurationMinutesRaw =
            typeof row.day2DurationMinutes === "number" && Number.isFinite(row.day2DurationMinutes) ? row.day2DurationMinutes : 0;
          const startTime = safeToString(row.startTime, "");
          const endTime = safeToString(row.endTime, "");
          const day2StartTime = safeToString(row.day2StartTime, "");
          const day2EndTime = safeToString(row.day2EndTime, "");
          const durationMinutes = computeDurationMinutes(institution, durationMinutesRaw, startTime, endTime);
          const academicHours = computeAcademicHours(institution, row.academicHours, durationMinutes);
          const day2DurationMinutes = computeDurationMinutes(
            institution,
            day2DurationMinutesRaw,
            day2StartTime,
            day2EndTime,
          );
          const day2AcademicHours = computeAcademicHours(institution, row.day2AcademicHours, day2DurationMinutes);
          return {
            id: docSnap.id,
            institution,
            cesdeGroupType: safeToString(row.cesdeGroupType, ""),
            subjectName: safeToString(row.subjectName, safeToString(row.subjectId, "Materia")),
            audienceName: safeToString(row.audienceName, safeToString(row.audienceId, "Grupo")),
            audienceType: safeToString(row.audienceType, "group"),
            siteName: safeToString(row.siteName, safeToString(row.siteId, "")),
            shiftName: safeToString(row.shiftName, safeToString(row.shiftId, "")),
            startDate: safeToString(row.startDate, ""),
            endDate: safeToString(row.endDate, ""),
            dayOfWeek1: safeToString(row.dayOfWeek1, ""),
            dayOfWeek2: safeToString(row.dayOfWeek2, ""),
            driveWorkspaceId: safeToString(row.driveWorkspaceId, ""),
            startTime,
            endTime,
            day2StartTime,
            day2EndTime,
            classroom: safeToString(row.classroom, ""),
            durationMinutes,
            academicHours,
            day2DurationMinutes,
            day2AcademicHours,
            active: typeof row.active === "boolean" ? row.active : true,
          };
        });

        const driveWorkspaceRows: DriveWorkspaceRow[] = driveWorkspaceDocs.map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const health = (row.health as Record<string, unknown> | undefined) ?? {};
          return {
            id: docSnap.id,
            institution: safeToString(row.institution, ""),
            subjectName: safeToString(row.subjectName, safeToString(row.subjectId, "Materia")),
            groupName: safeToString(row.groupName, safeToString(row.groupId, "Grupo")),
            period: safeToString(row.period, ""),
            campus: safeToString(row.campus, ""),
            jornada: safeToString(row.jornada, ""),
            dayOfWeek1: safeToString(row.dayOfWeek1, ""),
            dayOfWeek2: safeToString(row.dayOfWeek2, ""),
            weekCount: typeof row.weekCount === "number" && Number.isFinite(row.weekCount) ? row.weekCount : 0,
            healthBroken: Boolean(health.broken),
          };
        });

        const groupNameById = new Map([...groups, ...fichas].map((g) => [g.id, g.name]));
        const templateNameById = new Map(templates.map((t) => [t.id, t.name]));
        const templateGroupById = new Map(templates.map((t) => [t.id, t.groupId]));

        const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const activityDays: { key: string; label: string }[] = Array.from({ length: 14 }).map((_, idx) => {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          d.setDate(d.getDate() - (13 - idx));
          return {
            key: dayKey(d),
            label: new Intl.DateTimeFormat("es-CO", { month: "short", day: "2-digit" }).format(d),
          };
        });
        const activityByDay = new Map(activityDays.map((d) => [d.key, 0]));

        const attemptsByTemplate7 = new Map<string, { count: number; grades: number[] }>();
        const gradeBins = [
          { label: "0-1", value: 0 },
          { label: "1-2", value: 0 },
          { label: "2-3", value: 0 },
          { label: "3-4", value: 0 },
          { label: "4-5", value: 0 },
        ];

        let gradeSum7 = 0;
        let gradeCount7 = 0;
        let fraudAttempts7 = 0;
        let submittedAttempts7 = 0;

        const latestAttempts: DashboardData["latestAttempts"] = [];

        attemptDocs.forEach((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const status = safeToString(row.status, "desconocido");
          const submittedAt = toDateFromTimestamp(row.submittedAt);
          if (!submittedAt) return;

          const isSubmitted = submittedStatuses.has(status);
          if (isSubmitted) {
            const key = dayKey(submittedAt);
            if (activityByDay.has(key)) activityByDay.set(key, (activityByDay.get(key) ?? 0) + 1);
          }

          const grade = normalizeGradeTo5(row);
          if (grade !== null) {
            const idx = Math.min(Math.max(Math.floor(grade), 0), 4);
            gradeBins[idx] = { ...gradeBins[idx], value: gradeBins[idx].value + 1 };
          }

          const fraud =
            (typeof row.fraudTabSwitches === "number" ? row.fraudTabSwitches : 0) +
            (typeof row.fraudClipboardAttempts === "number" ? row.fraudClipboardAttempts : 0);

          if (submittedAt >= start7 && isSubmitted) {
            submittedAttempts7 += 1;
            if (fraud > 0) fraudAttempts7 += 1;
            if (grade !== null) {
              gradeSum7 += grade;
              gradeCount7 += 1;
            }
            const templateId = safeToString(
              row.examTemplateId ?? row.templateId ?? row.examId,
              "desconocido",
            );
            if (templateId !== "desconocido") {
              const current = attemptsByTemplate7.get(templateId) ?? { count: 0, grades: [] };
              current.count += 1;
              if (grade !== null) current.grades.push(grade);
              attemptsByTemplate7.set(templateId, current);
            }
          }

          if (latestAttempts.length < 10) {
            const examName =
              safeToString(row.examName, "") ||
              safeToString(row.templateName, "") ||
              templateNameById.get(
                safeToString(row.examTemplateId ?? row.templateId ?? row.examId, ""),
              ) ||
              safeToString(row.accessCode, "Examen");
            const student =
              safeToString(row.studentFullName, "") ||
              `${safeToString(row.studentFirstName, "")} ${safeToString(row.studentLastName, "")}`.trim() ||
              safeToString(row.email, "Estudiante");
            latestAttempts.push({
              when: new Intl.DateTimeFormat("es-CO", { month: "short", day: "2-digit" }).format(
                submittedAt,
              ),
              exam: examName,
              student,
              grade: grade === null ? "-" : `${formatFixed(grade, 2)} / 5`,
              status,
              fraud,
            });
          }
        });

        const topExams7 = Array.from(attemptsByTemplate7.entries())
          .map(([templateId, agg]) => {
            const avg =
              agg.grades.length > 0
                ? `${(agg.grades.reduce((a, b) => a + b, 0) / agg.grades.length).toFixed(2)} / 5`
                : "-";
            const name = templateNameById.get(templateId) ?? templateId;
            const groupId = templateGroupById.get(templateId) ?? "sin-grupo";
            return {
              exam: name,
              group: groupNameById.get(groupId) ?? groupId,
              submissions: agg.count,
              avg,
            };
          })
          .sort((a, b) => b.submissions - a.submissions)
          .slice(0, 8);

        const activity14 = {
          labels: activityDays.map((d) => d.label),
          values: activityDays.map((d) => activityByDay.get(d.key) ?? 0),
        };

        const summary7: DashboardData["summary7"] = {
          avgGrade: gradeCount7 ? gradeSum7 / gradeCount7 : null,
          fraudAttempts: fraudAttempts7,
          submittedAttempts: submittedAttempts7,
        };

        const counts: DashboardData["counts"] = {
          templatesTotal: countFromAggregateSnap(out.templatesTotal),
          templatesActive: countFromAggregateSnap(out.templatesActive),
          publishedActive: countFromAggregateSnap(out.publishedActive),
          publishedClosed: countFromAggregateSnap(out.publishedClosed),
          questionsTotal: questionsTotalSnap.data().count,
          questionsPublished: questionsPublishedSnap.data().count,
          questionsDraft: questionsDraftSnap.data().count,
          questionsArchived: questionsArchivedSnap.data().count,
          subjectsTotal: countFromAggregateSnap(out.subjectsTotal),
          groupsTotal: countFromAggregateSnap(out.groupsTotal),
          fichasTotal: countFromAggregateSnap(out.fichasTotal),
          sitesTotal: countFromAggregateSnap(out.sitesTotal),
          shiftsTotal: countFromAggregateSnap(out.shiftsTotal),
          momentsTotal: countFromAggregateSnap(out.momentsTotal),
          studyDocsActive: countFromAggregateSnap(out.studyDocsActive),
          driveWorkspacesTotal: countFromAggregateSnap(out.driveWorkspacesTotal),
          teachingLoadsTotal: teachingLoadSummary.total,
          teachingLoadsActive: teachingLoadSummary.active,
          teachingHoursTotal: teachingLoadSummary.hoursTotal,
          teachingHoursCesde: teachingLoadSummary.hoursCesde,
          teachingHoursSena: teachingLoadSummary.hoursSena,
          attemptsTotal: countFromAggregateSnap(out.attemptsTotal),
          attemptsSubmitted: countFromAggregateSnap(out.attemptsSubmitted),
          attemptsInProgress: countFromAggregateSnap(out.attemptsInProgress),
          attemptsFraudSubmitted: countFromAggregateSnap(out.attemptsFraudSubmitted),
          attemptsAnnulled: countFromAggregateSnap(out.attemptsAnnulled),
        };

        if (!cancelled) {
          setTeachingLoads(teachingLoadRows);
          setDriveWorkspaces(driveWorkspaceRows);
          setData({
            counts,
            activity14,
            gradeDist: gradeBins,
            summary7,
            topExams7,
            latestAttempts,
          });
        }
      } catch (err) {
        if (!cancelled) {
          const code = getFirestoreErrorCode(err);
          const message =
            err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
              ? (err as { message: string }).message
              : "";
          if (typeof window !== "undefined") {
            console.error("[dashboard] load failed", { code, message, err });
          }
          setError(
            issuesHint ??
              `No fue posible leer datos de Firestore (${code}).${message ? ` ${message}` : ""}`,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, refreshKey, user]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)), [weekStart]);
  const holidayByDateKey = useMemo(() => {
    return new Map(
      weekDays.flatMap((day) => {
        const holidayName = getColombiaHolidayName(day);
        return holidayName ? [[isoDate(day), holidayName] as [string, string]] : [];
      }),
    );
  }, [weekDays]);
  const workWindow = useMemo(() => ({ startMinutes: 6 * 60, endMinutes: 22 * 60 }), []);
  const weekWorkMinutes = useMemo(() => {
    const perDay = workWindow.endMinutes - workWindow.startMinutes;
    const holidayCount = weekDays.reduce((acc, day) => (holidayByDateKey.has(isoDate(day)) ? acc + 1 : acc), 0);
    return Math.max(0, (7 - holidayCount) * perDay);
  }, [holidayByDateKey, weekDays, workWindow.endMinutes, workWindow.startMinutes]);

  const workloadWeek = useMemo(() => {
    const occupiedIntervalsByDay = new Map<number, Array<[number, number]>>();
    const scheduledHoursByDay = new Map<number, number>();
    const driveWorkspaceIds = new Set<string>();
    let totalOccurrences = 0;

    teachingLoads
      .filter((row) => row.active)
      .forEach((row) => {
        const rowStart = parseLocalDate(row.startDate);
        const rowEnd = parseLocalDate(row.endDate) ?? rowStart;
        if (!rowStart || !rowEnd) return;
        const sessions = getTeachingLoadSessions(row);
        if (!sessions.length) return;

        weekDays.forEach((day) => {
          const dateKey = isoDate(day);
          if (holidayByDateKey.has(dateKey)) return;
          if (!isSameOrAfterDay(day, rowStart) || !isSameOrBeforeDay(day, rowEnd)) return;
          sessions.forEach((session) => {
            if (session.weekdayIndex !== day.getDay()) return;
            const startMinutes = minutesFromTimeLoose(session.startTime);
            const endMinutes = minutesFromTimeLoose(session.endTime);
            if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;
            const clampedStart = Math.max(startMinutes, workWindow.startMinutes);
            const clampedEnd = Math.min(endMinutes, workWindow.endMinutes);
            if (clampedEnd <= clampedStart) return;
            const dayIndex = day.getDay();
            const current = occupiedIntervalsByDay.get(dayIndex) ?? [];
            current.push([clampedStart, clampedEnd]);
            occupiedIntervalsByDay.set(dayIndex, current);
            scheduledHoursByDay.set(dayIndex, (scheduledHoursByDay.get(dayIndex) ?? 0) + session.academicHours);
            if (row.driveWorkspaceId) driveWorkspaceIds.add(row.driveWorkspaceId);
            totalOccurrences += 1;
          });
        });
      });

    const mergeIntervals = (intervals: Array<[number, number]>) => {
      const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
      const merged: Array<[number, number]> = [];
      sorted.forEach((interval) => {
        const last = merged[merged.length - 1];
        if (!last || interval[0] > last[1]) merged.push(interval);
        else last[1] = Math.max(last[1], interval[1]);
      });
      return merged;
    };

    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const labels = new Map<number, string>([
      [1, "Lun"],
      [2, "Mar"],
      [3, "Mié"],
      [4, "Jue"],
      [5, "Vie"],
      [6, "Sáb"],
      [0, "Dom"],
    ]);

    const perDay = dayOrder.map((dayIndex) => {
      const dayDate = weekDays.find((day) => day.getDay() === dayIndex);
      const dayDateLabel = dayDate ? formatDayMonth(dayDate) : "";
      const intervals = mergeIntervals(occupiedIntervalsByDay.get(dayIndex) ?? []);
      const occupiedMinutes = intervals.reduce((acc, [s, e]) => acc + (e - s), 0);
      const freeMinutes = Math.max(0, workWindow.endMinutes - workWindow.startMinutes - occupiedMinutes);
      const occupiedHours = occupiedMinutes / 60;
      const freeHours = freeMinutes / 60;
      const scheduledHours = scheduledHoursByDay.get(dayIndex) ?? 0;
      return {
        dayIndex,
        label: labels.get(dayIndex) ?? `${dayIndex}`,
        dateLabel: dayDateLabel,
        fullLabel: dayDateLabel ? `${labels.get(dayIndex) ?? `${dayIndex}`} ${dayDateLabel}` : labels.get(dayIndex) ?? `${dayIndex}`,
        occupiedHours,
        freeHours,
        scheduledHours,
      };
    });

    const nonHolidayDayCount = weekDays.reduce((acc, day) => (holidayByDateKey.has(isoDate(day)) ? acc : acc + 1), 0);
    const totalOccupiedMinutes = perDay.reduce((acc, d) => acc + d.occupiedHours * 60, 0);
    const totalFreeMinutes = Math.max(0, nonHolidayDayCount * (workWindow.endMinutes - workWindow.startMinutes) - totalOccupiedMinutes);
    const occupancy = weekWorkMinutes ? totalOccupiedMinutes / weekWorkMinutes : 0;
    const totalAcademicHours = perDay.reduce((acc, d) => acc + d.scheduledHours, 0);
    const busiest = perDay.reduce((a, b) => (b.scheduledHours > a.scheduledHours ? b : a), perDay[0]!);
    const lightest = perDay.reduce((a, b) => (b.scheduledHours < a.scheduledHours ? b : a), perDay[0]!);

    return {
      perDay,
      totalOccurrences,
      driveWorkspaceCount: driveWorkspaceIds.size,
      totalAcademicHours,
      totalOccupiedHours: totalOccupiedMinutes / 60,
      totalFreeHours: totalFreeMinutes / 60,
      occupancy,
      busiestDay: busiest,
      lightestDay: lightest,
    };
  }, [holidayByDateKey, teachingLoads, weekDays, weekWorkMinutes, workWindow.endMinutes, workWindow.startMinutes]);

  const driveLinkedTotal = useMemo(() => {
    const ids = new Set<string>();
    teachingLoads.forEach((row) => {
      if (row.driveWorkspaceId) ids.add(row.driveWorkspaceId);
    });
    return ids.size;
  }, [teachingLoads]);

  const weekTimeline = useMemo(() => {
    const itemsByDate = new Map<
      string,
      Array<{
        id: string;
        startMinutes: number;
        endMinutes: number;
        timeLabel: string;
        subjectName: string;
        audienceName: string;
        institution: string;
        siteName: string;
        shiftName: string;
        classroom: string;
      }>
    >();

    teachingLoads
      .filter((row) => row.active)
      .forEach((row) => {
        const rowStart = parseLocalDate(row.startDate);
        const rowEnd = parseLocalDate(row.endDate) ?? rowStart;
        if (!rowStart || !rowEnd) return;
        const sessions = getTeachingLoadSessions(row);
        if (!sessions.length) return;

        weekDays.forEach((day) => {
          const dateKey = isoDate(day);
          if (holidayByDateKey.has(dateKey)) return;
          if (!isSameOrAfterDay(day, rowStart) || !isSameOrBeforeDay(day, rowEnd)) return;
          sessions.forEach((session) => {
            if (session.weekdayIndex !== day.getDay()) return;
            const startMinutes = minutesFromTimeLoose(session.startTime);
            const endMinutes = minutesFromTimeLoose(session.endTime);
            if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;
            const bucket = itemsByDate.get(dateKey) ?? [];
            bucket.push({
              id: `${row.id}-${session.slot}-${dateKey}`,
              startMinutes,
              endMinutes,
              timeLabel: `${formatTimeMinutes(startMinutes)} - ${formatTimeMinutes(endMinutes)}`,
              subjectName: row.subjectName,
              audienceName: row.audienceName,
              institution: row.institution,
              siteName: row.siteName,
              shiftName: row.shiftName,
              classroom: row.classroom,
            });
            itemsByDate.set(dateKey, bucket);
          });
        });
      });

    return weekDays.map((day) => {
      const dateKey = isoDate(day);
      const holidayName = holidayByDateKey.get(dateKey) ?? null;
      const items = (itemsByDate.get(dateKey) ?? []).sort((a, b) => {
        if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
        return a.subjectName.localeCompare(b.subjectName, "es");
      });
      return {
        dateKey,
        weekdayLabel: formatWeekdayShort(day),
        dayLabel: formatDayMonth(day),
        holidayName,
        items,
      };
    });
  }, [holidayByDateKey, teachingLoads, weekDays]);

  const todaySchedule = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = isoDate(today);
    const holidayName = getColombiaHolidayName(today) ?? null;
    const items: Array<{
      id: string;
      startMinutes: number;
      endMinutes: number;
      timeLabel: string;
      subjectName: string;
      audienceName: string;
      institution: string;
      siteName: string;
      shiftName: string;
      classroom: string;
    }> = [];

    if (!holidayName) {
      teachingLoads
        .filter((row) => row.active)
        .forEach((row) => {
          const rowStart = parseLocalDate(row.startDate);
          const rowEnd = parseLocalDate(row.endDate) ?? rowStart;
          if (!rowStart || !rowEnd) return;
          if (!isSameOrAfterDay(today, rowStart) || !isSameOrBeforeDay(today, rowEnd)) return;
          getTeachingLoadSessions(row).forEach((session) => {
            if (session.weekdayIndex !== today.getDay()) return;
            const startMinutes = minutesFromTimeLoose(session.startTime);
            const endMinutes = minutesFromTimeLoose(session.endTime);
            if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;
            items.push({
              id: `${row.id}-${session.slot}-${todayKey}`,
              startMinutes,
              endMinutes,
              timeLabel: `${formatTimeMinutes(startMinutes)} - ${formatTimeMinutes(endMinutes)}`,
              subjectName: row.subjectName,
              audienceName: row.audienceName,
              institution: row.institution,
              siteName: row.siteName,
              shiftName: row.shiftName,
              classroom: row.classroom,
            });
          });
        });
    }

    items.sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      return a.subjectName.localeCompare(b.subjectName, "es");
    });

    return {
      dateKey: todayKey,
      weekdayLabel: formatWeekdayShort(today),
      dayLabel: new Intl.DateTimeFormat("es-CO", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }).format(today),
      holidayName,
      items,
    };
  }, [teachingLoads]);

  const driveSummary = useMemo(() => {
    const totalWeeks = driveWorkspaces.reduce((acc, ws) => acc + (Number.isFinite(ws.weekCount) ? ws.weekCount : 0), 0);
    const broken = driveWorkspaces.filter((ws) => ws.healthBroken).length;
    const cesde = driveWorkspaces.filter((ws) => ws.institution.toUpperCase() === "CESDE").length;
    const sena = driveWorkspaces.filter((ws) => ws.institution.toUpperCase() === "SENA").length;
    const days = new Map<string, number>();
    driveWorkspaces.forEach((ws) => {
      const key = normalizeWeekdayLabel(ws.dayOfWeek1) || "SIN_DIA";
      days.set(key, (days.get(key) ?? 0) + 1);
    });
    const topDay = Array.from(days.entries()).sort((a, b) => b[1] - a[1])[0] ?? ["-", 0];
    return { totalWeeks, broken, cesde, sena, topDayLabel: topDay[0], topDayCount: topDay[1] };
  }, [driveWorkspaces]);

  const avgGrade7 = data.summary7.avgGrade;
  const fraud7 = data.summary7.fraudAttempts;
  const activity14Data = useMemo(
    () => data.activity14.labels.map((label, idx) => ({ label, value: data.activity14.values[idx] ?? 0 })),
    [data.activity14.labels, data.activity14.values],
  );
  const drivePieData = useMemo(
    () => [
      { label: "CESDE", value: driveSummary.cesde, fill: "#a855f7" },
      { label: "SENA", value: driveSummary.sena, fill: "#10b981" },
      { label: "Broken", value: driveSummary.broken, fill: "#f59e0b" },
    ],
    [driveSummary.broken, driveSummary.cesde, driveSummary.sena],
  );
  const attemptsStatusData = useMemo(
    () => [
      { label: "En progreso", value: data.counts.attemptsInProgress, fill: "#6366f1" },
      { label: "Enviados", value: data.counts.attemptsSubmitted, fill: "#0ea5e9" },
      { label: "Anulados", value: data.counts.attemptsAnnulled, fill: "#f43f5e" },
    ],
    [data.counts.attemptsAnnulled, data.counts.attemptsInProgress, data.counts.attemptsSubmitted],
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div className="whitespace-pre-line rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="zs-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold tracking-tight text-foreground">Dashboard</p>
            <p className="mt-1 text-sm text-foreground/55">Métricas reales de Drive, carga horaria y exámenes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-foreground/70">
              Semana: {formatWeekRange(weekStart)}
            </div>
            <button type="button" onClick={() => setWeekStart((prev) => addDays(prev, -7))} className="zs-btn-secondary h-9 px-3 text-xs">
              Semana anterior
            </button>
            <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} className="zs-btn-secondary h-9 px-3 text-xs">
              Hoy
            </button>
            <button type="button" onClick={() => setWeekStart((prev) => addDays(prev, 7))} className="zs-btn-secondary h-9 px-3 text-xs">
              Semana siguiente
            </button>
            <button type="button" onClick={() => setRefreshKey((k) => k + 1)} className="zs-btn-primary h-9 px-3 text-xs">
              Actualizar
            </button>
          </div>
        </div>
        {holidayByDateKey.size ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground/60">
            <span className="font-semibold text-foreground/70">Festivos en la semana:</span>
            {Array.from(holidayByDateKey.entries()).map(([dateKey, name]) => (
              <span key={dateKey} className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                {dateKey} · {name}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <KpiCard
          label="Drive vinculados"
          value={loading ? "-" : formatCompactNumber(driveLinkedTotal)}
          subtitle={loading ? "-" : `${formatCompactNumber(workloadWeek.driveWorkspaceCount)} en esta semana`}
        />
        <KpiCard
          label="Ocupación semanal"
          value={loading ? "-" : `${Math.round(workloadWeek.occupancy * 100)}%`}
          subtitle={
            loading
              ? "-"
              : `${formatHoursValue(workloadWeek.totalAcademicHours)} h académicas · ${workloadWeek.totalOccurrences} sesiones`
          }
        />
        <KpiCard
          label="Día más copado"
          value={loading ? "-" : workloadWeek.busiestDay.label}
          valueMeta={loading ? null : workloadWeek.busiestDay.dateLabel}
          subtitle={loading ? "-" : `${formatHoursValue(workloadWeek.busiestDay.scheduledHours)} h académicas`}
        />
        <KpiCard
          label="Día más suave"
          value={loading ? "-" : workloadWeek.lightestDay.label}
          valueMeta={loading ? null : workloadWeek.lightestDay.dateLabel}
          subtitle={loading ? "-" : `${formatHoursValue(workloadWeek.lightestDay.scheduledHours)} h académicas`}
        />
        <KpiCard
          label="Exámenes activos"
          value={loading ? "-" : formatCompactNumber(data.counts.publishedActive)}
          subtitle={loading ? "-" : `${formatCompactNumber(data.counts.publishedClosed)} cerrados`}
        />
        <KpiCard
          label="Intentos (7 días)"
          value={loading ? "-" : formatCompactNumber(data.summary7.submittedAttempts)}
          subtitle={loading ? "-" : `${formatCompactNumber(fraud7)} con fraude`}
        />
        <KpiCard
          label="Promedio (7 días)"
          value={loading ? "-" : avgGrade7 === null ? "-" : `${formatFixed(avgGrade7, 2)} / 5`}
          subtitle={loading ? "-" : `${formatCompactNumber(data.counts.templatesActive)} plantillas activas`}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="zs-card p-5 xl:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Carga horaria semanal (visual)</h2>
          <p className="text-sm text-foreground/55">Tiempo ocupado vs libre (6:00 am - 10:00 pm). Excluye festivos.</p>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadWeek.perDay} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="fullLabel" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatChartValue(v)} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatChartValue(v)} />
                <Bar dataKey="occupiedHours" name="Ocupado (h)" fill="#a855f7" shape={<Bar3DShape />} />
                <Bar dataKey="freeHours" name="Libre (h)" fill="#e5e7eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="zs-card p-5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Drive (distribución)</h2>
          <p className="text-sm text-foreground/55">Workspaces por institución + estado.</p>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(v) => formatChartValue(v)} />
                <Pie data={drivePieData} dataKey="value" nameKey="label" innerRadius={54} outerRadius={92} paddingAngle={3}>
                  {drivePieData.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {drivePieData.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-foreground/70">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.fill }} />
                  {row.label}
                </span>
                <span className="font-semibold text-foreground">{formatCompactNumber(row.value)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="zs-card p-5 xl:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Actividad de exámenes (14 días)</h2>
          <p className="text-sm text-foreground/55">Envíos por día (intentos enviados).</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity14Data}>
                <defs>
                  <linearGradient id="attemptsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatChartValue(v)} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatChartValue(v)} />
                <Area type="monotone" dataKey="value" stroke="#0ea5e9" fill="url(#attemptsGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="zs-card p-5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Estados de intentos</h2>
          <p className="text-sm text-foreground/55">Distribución global por estado.</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(v) => formatChartValue(v)} />
                <Pie data={attemptsStatusData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={92} paddingAngle={3}>
                  {attemptsStatusData.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {attemptsStatusData.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-foreground/70">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.fill }} />
                  {row.label}
                </span>
                <span className="font-semibold text-foreground">{formatCompactNumber(row.value)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="zs-card p-5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Distribución de notas</h2>
          <p className="text-sm text-foreground/55">Histograma sobre intentos recientes.</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.gradeDist} barCategoryGap={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatChartValue(v)} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatChartValue(v)} />
                <Bar dataKey="value" name="Intentos" fill="#10b981" shape={<Bar3DShape />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="zs-card p-5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Top exámenes (7 días)</h2>
          <p className="text-sm text-foreground/55">Por cantidad de envíos y promedio de nota.</p>
          {data.topExams7.length ? (
            <div className="mt-4 space-y-3">
              {data.topExams7.map((row) => (
                <div key={`${row.exam}-${row.group}`} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.exam}</p>
                      <p className="mt-0.5 truncate text-xs text-foreground/65">{row.group}</p>
                    </div>
                    <div className="text-right text-xs text-foreground/65">
                      <div>
                        <span className="font-semibold text-foreground">{row.submissions}</span> envíos
                      </div>
                      <div className="mt-1">{row.avg}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 zs-card-muted px-3 py-6 text-center text-sm text-foreground/55">
              {loading ? "Cargando..." : "Aún no hay datos para top exámenes."}
            </div>
          )}
        </article>

        <article className="zs-card p-5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Últimos resultados</h2>
          <p className="text-sm text-foreground/55">Vista rápida de envíos recientes.</p>
          {data.latestAttempts.length ? (
            <>
              <div className="mt-4 space-y-3 sm:hidden">
                {data.latestAttempts.map((row) => (
                  <div
                    key={`${row.when}-${row.exam}-${row.student}`}
                    className="rounded-xl border border-border bg-surface p-3 text-sm text-foreground/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.exam}</p>
                        <p className="mt-1 text-xs text-foreground/55">{row.status}</p>
                      </div>
                      <span className="shrink-0 text-xs text-foreground/55">{row.when}</span>
                    </div>
                    <p className="mt-3 truncate text-sm">{row.student}</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{row.grade}</span>
                      <span className={row.fraud > 0 ? "font-semibold text-amber-700" : "text-foreground/55"}>
                        Fraude: {row.fraud}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 hidden overflow-hidden rounded-xl border border-border bg-surface sm:block">
                <table className="w-full table-fixed text-left">
                  <thead className="bg-muted">
                    <tr className="text-xs text-foreground/55">
                      <th className="w-[14%] px-3 py-2 font-medium">Fecha</th>
                      <th className="w-[34%] px-3 py-2 font-medium">Examen</th>
                      <th className="w-[28%] px-3 py-2 font-medium">Estudiante</th>
                      <th className="w-[14%] px-3 py-2 font-medium">Nota</th>
                      <th className="w-[10%] px-3 py-2 font-medium">Fraude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestAttempts.map((row) => (
                      <tr
                        key={`${row.when}-${row.exam}-${row.student}`}
                        className="border-t border-border/60 text-sm text-foreground/70"
                      >
                        <td className="px-3 py-2 text-xs text-foreground/65">{row.when}</td>
                        <td className="px-3 py-2">
                          <div className="truncate font-medium text-foreground">{row.exam}</div>
                          <div className="truncate text-xs text-foreground/55">{row.status}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="truncate">{row.student}</div>
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">{row.grade}</td>
                        <td className="px-3 py-2">
                          <span className={row.fraud > 0 ? "font-semibold text-amber-700" : "text-foreground/55"}>
                            {row.fraud}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="mt-4 zs-card-muted px-3 py-6 text-center text-sm text-foreground/55">
              {loading ? "Cargando..." : "Aún no hay envíos para mostrar."}
            </div>
          )}
        </article>
      </section>

      <section className="zs-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Hoy en agenda</h2>
            <p className="text-sm text-foreground/55">
              {todaySchedule.dayLabel.charAt(0).toUpperCase() + todaySchedule.dayLabel.slice(1)} · orden cronológico del día actual.
            </p>
          </div>
          <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground/70">
            {todaySchedule.items.length} materia(s)
          </span>
        </div>

        {todaySchedule.holidayName ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900/85">
            Hoy es festivo: {todaySchedule.holidayName}
          </div>
        ) : todaySchedule.items.length ? (
          <div className="mt-4 space-y-3">
            {todaySchedule.items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          item.institution.toUpperCase() === "SENA"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-fuchsia-100 text-fuchsia-800"
                        }`}
                      >
                        {item.institution}
                      </span>
                      <p className="truncate text-sm font-semibold text-foreground">{item.subjectName}</p>
                    </div>
                    <p className="mt-1 text-xs text-foreground/60">
                      {item.audienceName} · {item.siteName || "Sin sede"} · {item.shiftName || "Sin jornada"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">{item.timeLabel}</p>
                    <p className="mt-0.5 text-xs text-foreground/55">{item.classroom || "Sin salón"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-foreground/55">
            No tienes materias programadas para hoy.
          </div>
        )}
      </section>

      <section className="zs-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Materias por día</h2>
            <p className="text-sm text-foreground/55">Orden cronológico según la semana seleccionada (excluye festivos).</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {weekTimeline.map((day) => (
            <div key={day.dateKey} className="rounded-2xl border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/45">
                    {day.weekdayLabel}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">{day.dayLabel}</p>
                </div>
                {day.holidayName ? (
                  <span className="inline-flex shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title={day.holidayName}>
                    Festivo
                  </span>
                ) : null}
              </div>

              {day.holidayName ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900/80">
                  {day.holidayName}
                </div>
              ) : day.items.length ? (
                <div className="mt-3 space-y-2">
                  {day.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-foreground">{item.subjectName}</p>
                          <p className="mt-0.5 truncate text-[10px] text-foreground/60">
                            {item.audienceName} · {item.siteName} · {item.shiftName}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-semibold text-foreground/70">{item.timeLabel}</p>
                          <p className="mt-0.5 text-[10px] text-foreground/55">{item.classroom || "-"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-border bg-white/60 px-3 py-3 text-center text-[11px] text-foreground/55">
                  Sin programación
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
