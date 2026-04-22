"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { BookOpen, ClipboardList, BarChart3, Activity, Bot, Settings2, Folder } from "lucide-react";

type GroupProgress = {
  group: string;
  value: number;
};

type DashboardData = {
  counts: {
    templatesTotal: number;
    templatesActive: number;
    publishedActive: number;
    questionsTotal: number;
    questionsPublished: number;
    questionsDraft: number;
    questionsArchived: number;
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
  completionByGroup: GroupProgress[];
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
    return <div className="h-6 w-[92px] rounded-md bg-zinc-100" />;
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
    <svg viewBox="0 0 88 22" className="h-6 w-[92px]">
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
          className="w-2 rounded-sm bg-zinc-900/90"
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

export function DashboardView() {
  const quickLinks: Array<{
    href: string;
    label: string;
    hint: string;
    icon: typeof BookOpen;
  }> = [
    { href: "/admin/bank", label: "Banco", hint: "Preguntas e importación", icon: BookOpen },
    { href: "/admin/templates", label: "Exámenes", hint: "Plantillas y gestión", icon: ClipboardList },
    { href: "/admin/drive", label: "Drive", hint: "Archivos y estructura", icon: Folder },
    { href: "/admin/results", label: "Resultados", hint: "Notas y trazabilidad", icon: BarChart3 },
    { href: "/admin/live", label: "Activos", hint: "Códigos y monitoreo", icon: Activity },
    { href: "/admin/settings/ai-docs", label: "IA", hint: "README y JSON", icon: Bot },
    { href: "/admin/settings", label: "Ajustes", hint: "Catálogos y configuración", icon: Settings2 },
  ];

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
    completionByGroup: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
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
        add("groups", () => getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(12))));
        add("questionsSample", () => getDocs(query(collection(firestore, "questions"), limit(500))));
        add("templatesSample", () => getDocs(query(collection(firestore, "examTemplates"), limit(60))));
        add("attemptsRecent", () =>
          getDocs(query(collection(firestore, "attempts"), orderBy("submittedAt", "desc"), limit(500))),
        );

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
        const questionDocs = docsFromQuerySnap<{ data: () => Record<string, unknown> }>(out.questionsSample);
        const templateDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.templatesSample);
        const attemptDocs = docsFromQuerySnap<{ data: () => Record<string, unknown> }>(out.attemptsRecent);

        const groups = groupDocs.map((d) => ({
          id: d.id,
          name: safeToString(d.data().name, d.id),
        }));

        const questionCountByGroup = new Map<string, number>();
        questionDocs.forEach((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const groupIds = Array.isArray(row.groupIds) ? row.groupIds : [];
          groupIds.forEach((id) => {
            if (typeof id !== "string") return;
            questionCountByGroup.set(id, (questionCountByGroup.get(id) ?? 0) + 1);
          });
        });

        const maxGroupQuestions = Math.max(...Array.from(questionCountByGroup.values()), 1);
        const completionByGroup: GroupProgress[] = groups.map((g) => ({
          group: g.name,
          value: Math.round(((questionCountByGroup.get(g.id) ?? 0) / maxGroupQuestions) * 100),
        }));

        const templates = templateDocs.map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: safeToString(row.name, docSnap.id),
            groupId: safeToString(row.groupId, "sin-grupo"),
          };
        });

        const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
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
          questionsTotal: countFromAggregateSnap(out.questionsTotal),
          questionsPublished: countFromAggregateSnap(out.questionsPublished),
          questionsDraft: countFromAggregateSnap(out.questionsDraft),
          questionsArchived: countFromAggregateSnap(out.questionsArchived),
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
            completionByGroup,
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
  }, []);

  const avgGrade7 = data.summary7.avgGrade;
  const fraud7 = data.summary7.fraudAttempts;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="whitespace-pre-line rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Accesos directos</h2>
          <p className="text-sm text-zinc-500">Navega rápido a los módulos clave del panel.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{item.hint}</p>
                  </div>
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Exámenes publicados</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                {loading ? "-" : formatCompactNumber(data.counts.publishedActive)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Activos (status: published)</p>
            </div>
            <MiniSparkline values={data.activity14.values.slice(-10)} tone="indigo" />
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Plantillas de examen</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            {loading ? "-" : formatCompactNumber(data.counts.templatesTotal)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
            <span>Activas</span>
            <span className="font-semibold text-zinc-900">
              {loading ? "-" : formatCompactNumber(data.counts.templatesActive)}
            </span>
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Banco de preguntas</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            {loading ? "-" : formatCompactNumber(data.counts.questionsTotal)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
            <span>Publicadas</span>
            <span className="font-semibold text-zinc-900">
              {loading ? "-" : formatCompactNumber(data.counts.questionsPublished)}
            </span>
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Resultados (7 días)</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                {avgGrade7 === null ? "-" : `${formatFixed(avgGrade7, 2)} / 5`}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {data.summary7.submittedAttempts ? `${data.summary7.submittedAttempts} envíos` : "Sin envíos"}
              </p>
            </div>
            <MiniSparkline values={data.gradeDist.map((b) => b.value)} tone="emerald" />
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Estado de intentos</h2>
          <p className="text-sm text-zinc-500">Resumen por estados y fraude.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-zinc-50 px-3 py-3">
              <p className="text-xs text-zinc-500">En progreso</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {loading ? "-" : formatCompactNumber(data.counts.attemptsInProgress)}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-3">
              <p className="text-xs text-zinc-500">Enviados (todos)</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {loading ? "-" : formatCompactNumber(data.counts.attemptsSubmitted)}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-3">
              <p className="text-xs text-zinc-500">Fraude (enviado)</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {loading ? "-" : formatCompactNumber(data.counts.attemptsFraudSubmitted)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {fraud7 ? `${fraud7} con eventos` : "Sin eventos en recientes"}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-3">
              <p className="text-xs text-zinc-500">Anulados</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {loading ? "-" : formatCompactNumber(data.counts.attemptsAnnulled)}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Banco</h2>
          <p className="text-sm text-zinc-500">Estado de preguntas y distribución por grupo.</p>

          <div className="mt-4">
            <Donut
              items={[
                { label: "Publicadas", value: data.counts.questionsPublished, tone: "emerald" },
                { label: "Borrador", value: data.counts.questionsDraft, tone: "amber" },
                { label: "Archivadas", value: data.counts.questionsArchived, tone: "zinc" },
              ]}
            />
          </div>

          <div className="mt-5 space-y-3">
            {data.completionByGroup.map((item) => (
              <div key={item.group}>
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                  <span className="truncate">{item.group}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-zinc-900" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
            {!data.completionByGroup.length ? (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando análisis..." : "No hay grupos/preguntas para analizar."}
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Top exámenes (7 días)</h2>
          <p className="text-sm text-zinc-500">Por cantidad de envíos y promedio de nota.</p>
          {data.topExams7.length ? (
            <div className="mt-4 space-y-3">
              {data.topExams7.map((row) => (
                <div key={`${row.exam}-${row.group}`} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-950">{row.exam}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-600">{row.group}</p>
                    </div>
                    <div className="text-right text-xs text-zinc-600">
                      <div>
                        <span className="font-semibold text-zinc-900">{row.submissions}</span> envíos
                      </div>
                      <div className="mt-1">{row.avg}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
              {loading ? "Cargando..." : "Aún no hay datos para top exámenes."}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Últimos resultados</h2>
          <p className="text-sm text-zinc-500">Vista rápida de envíos recientes.</p>
          {data.latestAttempts.length ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
              <table className="w-full table-fixed text-left">
                <thead className="bg-zinc-50">
                  <tr className="text-xs text-zinc-500">
                    <th className="w-[14%] px-3 py-2 font-medium">Fecha</th>
                    <th className="w-[34%] px-3 py-2 font-medium">Examen</th>
                    <th className="w-[28%] px-3 py-2 font-medium">Estudiante</th>
                    <th className="w-[14%] px-3 py-2 font-medium">Nota</th>
                    <th className="w-[10%] px-3 py-2 font-medium">Fraude</th>
                  </tr>
                </thead>
                <tbody>
                  {data.latestAttempts.map((row) => (
                    <tr key={`${row.when}-${row.exam}-${row.student}`} className="border-t border-zinc-100 text-sm text-zinc-700">
                      <td className="px-3 py-2 text-xs text-zinc-600">{row.when}</td>
                      <td className="px-3 py-2">
                        <div className="truncate font-medium text-zinc-900">{row.exam}</div>
                        <div className="truncate text-xs text-zinc-500">{row.status}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate">{row.student}</div>
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{row.grade}</td>
                      <td className="px-3 py-2">
                        <span className={row.fraud > 0 ? "font-semibold text-amber-700" : "text-zinc-500"}>
                          {row.fraud}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
              {loading ? "Cargando..." : "Aún no hay envíos para mostrar."}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
