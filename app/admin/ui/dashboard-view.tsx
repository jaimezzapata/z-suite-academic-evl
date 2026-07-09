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

type DashboardData = {
  counts: {
    templatesTotal: number;
    templatesActive: number;
    publishedActive: number;
    questionsTotal: number;
    questionsPublished: number;
    questionsDraft: number;
    questionsArchived: number;
    subjectsTotal: number;
    sitesTotal: number;
    shiftsTotal: number;
    momentsTotal: number;
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

function calculatePercentage(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
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

const CHART_COLORS = {
  primary: "var(--color-primary)",
  success: "#7bc7ad",
  amber: "#d9b38c",
  indigo: "#9a8fe8",
  cyan: "#88c7d8",
  zinc: "#a8a29e",
  slate: "#7c8aa0",
  grid: "var(--color-border)",
};

export function DashboardView() {
  const { loading: authLoading, isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>({
    counts: {
      templatesTotal: 0,
      templatesActive: 0,
      publishedActive: 0,
      questionsTotal: 0,
      questionsPublished: 0,
      questionsDraft: 0,
      questionsArchived: 0,
      subjectsTotal: 0,
      sitesTotal: 0,
      shiftsTotal: 0,
      momentsTotal: 0,
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
        add("sitesTotal", () => getCountFromServer(collection(firestore, "sites")));
        add("shiftsTotal", () => getCountFromServer(collection(firestore, "shifts")));
        add("momentsTotal", () => getCountFromServer(collection(firestore, "moments")));
        add("driveWorkspaces", () =>
          getDocs(query(collection(firestore, "driveWorkspaces"), orderBy("updatedAt", "desc"), limit(500))),
        );
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
        const teachingLoadDocs = docsFromQuerySnap<{ data: () => Record<string, unknown> }>(out.teachingLoads);
        const driveWorkspaceDocs = docsFromQuerySnap<{ data: () => Record<string, unknown> }>(out.driveWorkspaces);

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
            const durationMinutes =
              typeof row.durationMinutes === "number" && Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0;
            const fallbackAcademicHours =
              institution === "SENA" ? durationMinutes / 60 : durationMinutes / 45;
            const academicHours =
              typeof row.academicHours === "number" && Number.isFinite(row.academicHours)
                ? row.academicHours
                : fallbackAcademicHours;
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
          questionsTotal: questionsTotalSnap.data().count,
          questionsPublished: questionsPublishedSnap.data().count,
          questionsDraft: questionsDraftSnap.data().count,
          questionsArchived: questionsArchivedSnap.data().count,
          subjectsTotal: countFromAggregateSnap(out.subjectsTotal),
          sitesTotal: countFromAggregateSnap(out.sitesTotal),
          shiftsTotal: countFromAggregateSnap(out.shiftsTotal),
          momentsTotal: countFromAggregateSnap(out.momentsTotal),
          driveWorkspacesTotal: driveWorkspaceDocs.length,
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
  }, [authLoading, isAdmin, user]);

  const activityChartData = useMemo(
    () =>
      data.activity14.labels.map((label, idx) => ({
        label,
        value: data.activity14.values[idx] ?? 0,
      })),
    [data.activity14],
  );
  const attemptsStatusData = useMemo(
    () => [
      { label: "En progreso", value: data.counts.attemptsInProgress, fill: CHART_COLORS.indigo },
      { label: "Enviados", value: data.counts.attemptsSubmitted, fill: CHART_COLORS.primary },
      { label: "Fraude", value: data.counts.attemptsFraudSubmitted, fill: CHART_COLORS.amber },
      { label: "Anulados", value: data.counts.attemptsAnnulled, fill: CHART_COLORS.zinc },
    ],
    [
      data.counts.attemptsAnnulled,
      data.counts.attemptsFraudSubmitted,
      data.counts.attemptsInProgress,
      data.counts.attemptsSubmitted,
    ],
  );
  const activeModulesData = useMemo(
    () =>
      [
        { label: "Materias", value: data.counts.subjectsTotal, fill: CHART_COLORS.primary },
        { label: "Sedes", value: data.counts.sitesTotal, fill: CHART_COLORS.indigo },
        { label: "Jornadas", value: data.counts.shiftsTotal, fill: CHART_COLORS.cyan },
        { label: "Momentos", value: data.counts.momentsTotal, fill: CHART_COLORS.success },
        { label: "Drive", value: data.counts.driveWorkspacesTotal, fill: CHART_COLORS.amber },
        { label: "Carga activa", value: data.counts.teachingLoadsActive, fill: CHART_COLORS.zinc },
        { label: "Examenes", value: data.counts.publishedActive, fill: CHART_COLORS.success },
      ].filter((item) => loading || item.value > 0),
    [
      data.counts.driveWorkspacesTotal,
      data.counts.momentsTotal,
      data.counts.publishedActive,
      data.counts.shiftsTotal,
      data.counts.sitesTotal,
      data.counts.subjectsTotal,
      data.counts.teachingLoadsActive,
      loading,
    ],
  );
  const topExamsChartData = useMemo(
    () =>
      data.topExams7.map((row) => ({
        label: row.exam.length > 24 ? `${row.exam.slice(0, 24)}...` : row.exam,
        fullLabel: row.exam,
        group: row.group,
        submissions: row.submissions,
        avg: row.avg,
      })),
    [data.topExams7],
  );
  const activeModulesChartData = useMemo(
    () => [...activeModulesData].sort((a, b) => b.value - a.value),
    [activeModulesData],
  );
  const gradeDistData = useMemo(() => {
    const fills = ["#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];
    return data.gradeDist
      .filter((item) => loading || item.value > 0)
      .map((item, idx) => ({ ...item, fill: fills[idx % fills.length] }));
  }, [data.gradeDist, loading]);

  const avgGrade7 = data.summary7.avgGrade;
  const fraud7 = data.summary7.fraudAttempts;
  const showCompact = (value: number) => (loading ? "-" : formatCompactNumber(value));
  const showHours = (value: number) => (loading ? "-" : formatHoursValue(value));
  const showFixed = (value: number | null, digits: number) =>
    loading || value === null ? "-" : formatFixed(value, digits);
  const questionsPublishedPct = calculatePercentage(
    data.counts.questionsPublished,
    data.counts.questionsTotal,
  );
  const templatesActivePct = calculatePercentage(data.counts.templatesActive, data.counts.templatesTotal);
  const teachingLoadActivePct = calculatePercentage(
    data.counts.teachingLoadsActive,
    data.counts.teachingLoadsTotal,
  );
  const attemptSubmittedPct = calculatePercentage(
    data.counts.attemptsSubmitted,
    data.counts.attemptsTotal,
  );
  const activeModulesTotal = activeModulesChartData.length;
  const activeModuleVolume = activeModulesChartData.reduce((sum, item) => sum + item.value, 0);
  const heroMetrics = [
    {
      label: "Enviados",
      value: showCompact(data.counts.attemptsSubmitted),
      helper: `${showCompact(data.counts.attemptsInProgress)} en progreso`,
      className: "bg-sky-200/55",
    },
    {
      label: "Promedio 7 dias",
      value: avgGrade7 === null || loading ? "-" : `${formatFixed(avgGrade7, 2)} / 5`,
      helper: `${showCompact(data.summary7.submittedAttempts)} evaluaciones`,
      className: "bg-emerald-200/55",
    },
    {
      label: "Alertas recientes",
      value: showCompact(fraud7),
      helper: `${showCompact(data.counts.attemptsFraudSubmitted)} con fraude`,
      className: "bg-amber-200/55",
    },
    {
      label: "Modulos activos",
      value: loading ? "-" : `${activeModulesTotal}`,
      helper: `${showCompact(activeModuleVolume)} registros visibles`,
      className: "bg-rose-200/50",
    },
  ];
  const spotlightCards = [
    {
      title: "Banco de preguntas",
      eyebrow: "Contenido academico",
      value: showCompact(data.counts.questionsTotal),
      detailA: { label: "Publicadas", value: showCompact(data.counts.questionsPublished) },
      detailB: { label: "Borrador", value: showCompact(data.counts.questionsDraft) },
      detailC: { label: "Archivadas", value: showCompact(data.counts.questionsArchived) },
      progress: questionsPublishedPct,
      progressLabel: `${questionsPublishedPct.toFixed(0)}% publicadas`,
      accent: "bg-fuchsia-300",
      tint: "bg-fuchsia-100/70",
    },
    {
      title: "Examenes y plantillas",
      eyebrow: "Publicacion",
      value: showCompact(data.counts.publishedActive),
      detailA: { label: "Plantillas activas", value: showCompact(data.counts.templatesActive) },
      detailB: { label: "Plantillas totales", value: showCompact(data.counts.templatesTotal) },
      detailC: { label: "Actividad 7 dias", value: showCompact(data.summary7.submittedAttempts) },
      progress: templatesActivePct,
      progressLabel: `${templatesActivePct.toFixed(0)}% del catalogo activo`,
      accent: "bg-indigo-300",
      tint: "bg-indigo-100/70",
    },
    {
      title: "Carga academica",
      eyebrow: "Operacion docente",
      value: showCompact(data.counts.teachingLoadsActive),
      detailA: { label: "Horas totales", value: showHours(data.counts.teachingHoursTotal) },
      detailB: { label: "CESDE", value: showHours(data.counts.teachingHoursCesde) },
      detailC: { label: "SENA", value: showHours(data.counts.teachingHoursSena) },
      progress: teachingLoadActivePct,
      progressLabel: `${teachingLoadActivePct.toFixed(0)}% de cargas activas`,
      accent: "bg-emerald-300",
      tint: "bg-emerald-100/70",
    },
    {
      title: "Drive operativo",
      eyebrow: "Cobertura",
      value: showCompact(data.counts.driveWorkspacesTotal),
      detailA: { label: "Sedes", value: showCompact(data.counts.sitesTotal) },
      detailB: { label: "Jornadas", value: showCompact(data.counts.shiftsTotal) },
      detailC: { label: "Momentos", value: showCompact(data.counts.momentsTotal) },
      progress: attemptSubmittedPct,
      progressLabel: `${attemptSubmittedPct.toFixed(0)}% de intentos enviados`,
      accent: "bg-amber-300",
      tint: "bg-amber-100/70",
    },
  ];

  return (
    <div className="space-y-6">
      {error ? (
        <div className="whitespace-pre-line rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="zs-card overflow-hidden border border-[#E9E3DD] bg-[#FBFBF8] p-5 text-foreground">
        <div className="grid items-stretch gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {heroMetrics.map((metric) => (
              <div
                key={metric.label}
                className={`flex min-h-[148px] flex-col justify-between rounded-2xl border border-white/70 ${metric.className} p-4`}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">{metric.label}</p>
                <div>
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{metric.value}</p>
                  <p className="mt-1 text-xs text-foreground/60">{metric.helper}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[28px] border border-[#E6E0DA] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">Actividad reciente</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Envios ultimos 14 dias</h2>
              </div>
              <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {showCompact(data.summary7.submittedAttempts)} en 7 dias
              </div>
            </div>

            <div className="mt-4 h-[332px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityChartData} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(71,85,105,0.72)", fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(71,85,105,0.72)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 18,
                      borderColor: "rgba(226,232,240,1)",
                      backgroundColor: "rgba(255,255,255,0.96)",
                      color: "#0f172a",
                    }}
                    formatter={(value: number) => [formatCompactNumber(Number(value)), "Envios"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#8fbcd4" strokeWidth={3} fill="#dceef4" fillOpacity={0.95} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {spotlightCards.map((card) => (
          <article
            key={card.title}
            className={`zs-card relative overflow-hidden border border-border ${card.tint} p-5`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${card.accent}`} />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">{card.eyebrow}</p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">{card.title}</h2>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{card.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-2xl ${card.accent} opacity-95`} />
              </div>

              <div className="mt-4 space-y-3">
                <div className="h-2 overflow-hidden rounded-full bg-foreground/8">
                  <div
                    className={`h-full rounded-full ${card.accent}`}
                    style={{ width: `${Math.max(card.progress, 8)}%` }}
                  />
                </div>
                <p className="text-xs text-foreground/60">{loading ? "-" : card.progressLabel}</p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-white/75 px-3 py-3">
                  <p className="text-xs text-foreground/55">{card.detailA.label}</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{card.detailA.value}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-white/75 px-3 py-3">
                  <p className="text-xs text-foreground/55">{card.detailB.label}</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{card.detailB.value}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-white/75 px-3 py-3">
                  <p className="text-xs text-foreground/55">{card.detailC.label}</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{card.detailC.value}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="zs-card overflow-hidden border-0 p-0 xl:col-span-2">
          <div className="bg-violet-100 px-5 py-5 text-foreground">
            <h2 className="text-xl font-semibold tracking-tight">Pulso de evaluaciones</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Estado operativo de intentos, envios y señales de fraude del ecosistema.
            </p>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-violet-100 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">En progreso</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {showCompact(data.counts.attemptsInProgress)}
                </p>
                <p className="mt-1 text-xs text-foreground/60">Intentos aun abiertos.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-sky-100 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">Enviados</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {showCompact(data.counts.attemptsSubmitted)}
                </p>
                <p className="mt-1 text-xs text-foreground/60">{attemptSubmittedPct.toFixed(0)}% del total.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-amber-100 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">Fraude detectado</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {showCompact(data.counts.attemptsFraudSubmitted)}
                </p>
                <p className="mt-1 text-xs text-foreground/60">
                  {fraud7 ? `${fraud7} recientes con eventos.` : "Sin alertas recientes."}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-stone-100 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">Anulados</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {showCompact(data.counts.attemptsAnnulled)}
                </p>
                <p className="mt-1 text-xs text-foreground/60">Intentos cerrados manualmente.</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">Estados actuales</p>
                  <p className="mt-1 text-sm text-foreground/65">Comparativo por categoria.</p>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {showCompact(data.counts.attemptsTotal)} totales
                </div>
              </div>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attemptsStatusData} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: CHART_COLORS.slate, fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: CHART_COLORS.slate, fontSize: 12 }}
                      tickFormatter={(value: number) => formatCompactNumber(Number(value))}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(109, 94, 246, 0.08)" }}
                      contentStyle={{ borderRadius: 16, borderColor: CHART_COLORS.grid }}
                      formatter={(value: number) => [formatCompactNumber(Number(value)), "Intentos"]}
                    />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {attemptsStatusData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </article>

        <article className="zs-card overflow-hidden border-0 p-0">
          <div className="bg-emerald-100 px-5 py-5 text-foreground">
            <h2 className="text-xl font-semibold tracking-tight">Operacion activa</h2>
            <p className="mt-1 text-sm text-foreground/60">Solo modulos con actividad visible en el panel.</p>
          </div>

          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/60 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">Modulos visibles</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {loading ? "-" : activeModulesTotal}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/60 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">Volumen acumulado</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {showCompact(activeModuleVolume)}
                </p>
              </div>
            </div>

            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeModulesChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART_COLORS.slate, fontSize: 12 }}
                    tickFormatter={(value: number) => formatCompactNumber(Number(value))}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={96}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART_COLORS.slate, fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                    contentStyle={{ borderRadius: 16, borderColor: CHART_COLORS.grid }}
                    formatter={(value: number) => [formatCompactNumber(Number(value)), "Activos"]}
                  />
                  <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                    {activeModulesChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {activeModulesChartData.map((item) => (
                <div
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground/75"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span>{item.label}</span>
                  <span className="font-semibold text-foreground">{showCompact(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="zs-card overflow-hidden border-0 p-0 xl:col-span-2">
          <div className="bg-fuchsia-100 px-5 py-5 text-foreground">
            <h2 className="text-xl font-semibold tracking-tight">Top examenes</h2>
            <p className="mt-1 text-sm text-foreground/60">Mayor traccion en los ultimos 7 dias.</p>
          </div>

          {data.topExams7.length ? (
            <div className="p-5">
              <div className="h-80 rounded-[24px] border border-border/70 bg-[#FCFAFD] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topExamsChartData}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: CHART_COLORS.slate, fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={140}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: CHART_COLORS.slate, fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(109, 94, 246, 0.08)" }}
                      contentStyle={{ borderRadius: 16, borderColor: CHART_COLORS.grid }}
                      formatter={(value: number, _name, item) => [
                        `${formatCompactNumber(Number(value))} envios`,
                        `${item.payload.avg} promedio`,
                      ]}
                      labelFormatter={(_label, payload) => {
                        const row = payload?.[0]?.payload as
                          | { fullLabel?: string; group?: string }
                          | undefined;
                        if (!row) return "";
                        return `${row.fullLabel ?? ""} · ${row.group ?? ""}`;
                      }}
                    />
                    <Bar dataKey="submissions" radius={[0, 12, 12, 0]} fill="#c5b4f2" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {data.topExams7.slice(0, 3).map((row, idx) => (
                  <div
                    key={`${row.exam}-${row.group}`}
                    className="rounded-2xl border border-border/70 bg-white px-4 py-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        TOP {idx + 1}
                      </span>
                      <span className="text-xs text-foreground/55">{row.avg}</span>
                    </div>
                    <p className="mt-3 truncate text-base font-semibold tracking-tight text-foreground">
                      {row.exam}
                    </p>
                    <p className="mt-1 truncate text-sm text-foreground/60">{row.group}</p>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-foreground/55">Envios</p>
                        <p className="text-2xl font-semibold tracking-tight text-foreground">
                          {row.submissions}
                        </p>
                      </div>
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-fuchsia-300"
                          style={{ width: `${Math.min(100, row.submissions * 10)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-5">
              <div className="zs-card-muted px-3 py-10 text-center text-sm text-foreground/55">
                {loading ? "Cargando..." : "Aun no hay datos para top examenes."}
              </div>
            </div>
          )}
        </article>

        <article className="zs-card overflow-hidden border-0 p-0">
          <div className="bg-cyan-100 px-5 py-5 text-foreground">
            <h2 className="text-xl font-semibold tracking-tight">Distribucion de notas</h2>
            <p className="mt-1 text-sm text-foreground/60">Lectura rapida por rangos de desempeno.</p>
          </div>

          <div className="p-5">
            {gradeDistData.length ? (
              <>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        contentStyle={{ borderRadius: 16, borderColor: CHART_COLORS.grid }}
                        formatter={(value: number) => [formatCompactNumber(Number(value)), "Resultados"]}
                      />
                      <Pie
                        data={gradeDistData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={60}
                        outerRadius={92}
                        paddingAngle={3}
                      >
                        {gradeDistData.map((entry) => (
                          <Cell key={entry.label} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 space-y-2">
                  {gradeDistData.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/50 px-3 py-3"
                    >
                      <div className="flex items-center gap-2 text-sm text-foreground/70">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span>Rango {item.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{showCompact(item.value)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-muted/50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">Promedio 7 dias</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                      {avgGrade7 === null || loading ? "-" : `${showFixed(avgGrade7, 2)} / 5`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">Resultados procesados</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                      {showCompact(data.summary7.submittedAttempts)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="zs-card-muted px-3 py-10 text-center text-sm text-foreground/55">
                {loading ? "Cargando..." : "Aun no hay notas para graficar."}
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="zs-card overflow-hidden border-0 p-0">
        <div className="bg-stone-100 px-5 py-5 text-foreground">
          <h2 className="text-xl font-semibold tracking-tight">Ultimos resultados</h2>
          <p className="mt-1 text-sm text-foreground/60">Vista rapida de envios recientes y su nivel de riesgo.</p>
        </div>

        <div className="p-5">
          {data.latestAttempts.length ? (
            <>
              <div className="grid gap-3 sm:hidden">
                {data.latestAttempts.map((row) => (
                  <div
                    key={`${row.when}-${row.exam}-${row.student}`}
                    className="rounded-2xl border border-border/70 bg-white p-4 text-sm text-foreground/70 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.exam}</p>
                        <p className="mt-1 text-xs text-foreground/55">{row.status}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-foreground/60">
                        {row.when}
                      </span>
                    </div>
                    <p className="mt-3 truncate text-sm">{row.student}</p>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{row.grade}</span>
                      <span className={row.fraud > 0 ? "font-semibold text-amber-700" : "text-foreground/55"}>
                        Fraude: {row.fraud}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-[24px] border border-border/70 bg-white sm:block">
                <table className="w-full table-fixed text-left">
                  <thead className="bg-slate-50 text-xs text-foreground/55">
                    <tr>
                      <th className="w-[14%] px-4 py-3 font-medium">Fecha</th>
                      <th className="w-[32%] px-4 py-3 font-medium">Examen</th>
                      <th className="w-[26%] px-4 py-3 font-medium">Estudiante</th>
                      <th className="w-[14%] px-4 py-3 font-medium">Nota</th>
                      <th className="w-[14%] px-4 py-3 font-medium">Fraude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestAttempts.map((row) => (
                      <tr
                        key={`${row.when}-${row.exam}-${row.student}`}
                        className="border-t border-border/60 text-sm text-foreground/72"
                      >
                        <td className="px-4 py-3 text-xs text-foreground/60">{row.when}</td>
                        <td className="px-4 py-3">
                          <div className="truncate font-medium text-foreground">{row.exam}</div>
                          <div className="truncate text-xs text-foreground/55">{row.status}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="truncate">{row.student}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{row.grade}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              row.fraud > 0
                                ? "inline-flex rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-700"
                                : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/60"
                            }
                          >
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
            <div className="zs-card-muted px-3 py-10 text-center text-sm text-foreground/55">
              {loading ? "Cargando..." : "Aun no hay envios para mostrar."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
