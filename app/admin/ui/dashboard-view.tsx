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
import { firestore } from "@/lib/firebase/client";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";


type MetricCard = {
  label: string;
  value: string;
  trend: string;
  trendPositive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  series: number[];
};

type GroupProgress = {
  group: string;
  value: number;
};

type ReportRow = {
  exam: string;
  group: string;
  submissions: number;
  avg: string;
  status: string;
};

type DashboardData = {
  metricCards: MetricCard[];
  completionByGroup: GroupProgress[];
  recentReports: ReportRow[];
  submissionsSeries: Array<{ label: string; value: number }>;
  statusDistribution: Array<{ label: string; value: number; color: string }>;
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

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatShortDay(date: Date) {
  return date.toLocaleDateString("es-CO", { month: "2-digit", day: "2-digit" });
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildSeriesFromValue(value: number) {
  const base = Math.max(1, value);
  const a = base * 0.65;
  const b = base * 0.72;
  const c = base * 0.78;
  const d = base * 0.74;
  const e = base * 0.82;
  const f = base * 0.88;
  return [a, b, c, d, e, f].map((x) => Math.round(x));
}

function Sparkline({ series, stroke = "#4f46e5" }: { series: number[]; stroke?: string }) {
  const width = 96;
  const height = 32;
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 1);
  const range = Math.max(1, max - min);
  const points = series
    .map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * (width - 2) + 1;
      const y = height - 1 - ((v - min) / range) * (height - 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function LineChart({
  series,
  stroke = "#7c3aed",
}: {
  series: Array<{ label: string; value: number }>;
  stroke?: string;
}) {
  const width = 560;
  const height = 160;
  const values = series.map((s) => s.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = Math.max(1, max - min);
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * (width - 24) + 12;
      const y = height - 18 - ((v - min) / range) * (height - 28);
      return { x, y, v, label: series[i]?.label ?? "" };
    });
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  return (
    <div className="w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        <path d={`M 12 ${height - 18} H ${width - 12}`} stroke="#e2e8f0" strokeWidth="1" />
        <path d={d} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="4" fill={stroke} opacity="0.85" />
          </g>
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-7 gap-2 text-center text-[11px] text-zinc-600">
        {series.map((s) => (
          <div key={s.label} className="truncate">
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Donut({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const radius = 42;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        {items.map((it) => {
          const fraction = it.value / total;
          const length = circumference * fraction;
          const dasharray = `${length} ${circumference - length}`;
          const dashoffset = -offset;
          offset += length;
          return (
            <circle
              key={it.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={it.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          );
        })}
        <circle cx="60" cy="60" r={radius - stroke} fill="white" />
        <text x="60" y="58" textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">
          {total}
        </text>
        <text x="60" y="74" textAnchor="middle" fontSize="10" fill="#6b7280">
          intentos
        </text>
      </svg>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2 text-sm text-zinc-700">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} />
            <span className="min-w-0 truncate">{it.label}</span>
            <span className="ml-auto font-semibold text-zinc-900">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardView() {
  const [reportPage, setReportPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>({
    metricCards: [
      {
        label: "Plantillas",
        value: "-",
        trend: "cargando",
        trendPositive: true,
        icon: ClipboardList,
        tint: "bg-white",
        series: [3, 4, 4, 5, 6, 7],
      },
      {
        label: "Banco preguntas",
        value: "-",
        trend: "cargando",
        trendPositive: true,
        icon: BookOpen,
        tint: "bg-white",
        series: [2, 3, 4, 5, 6, 7],
      },
      {
        label: "Intentos",
        value: "-",
        trend: "cargando",
        trendPositive: true,
        icon: Users,
        tint: "bg-white",
        series: [2, 2, 3, 4, 5, 6],
      },
      {
        label: "Envíos",
        value: "-",
        trend: "cargando",
        trendPositive: true,
        icon: TrendingUp,
        tint: "bg-white",
        series: [1, 2, 2, 3, 4, 5],
      },
    ],
    completionByGroup: [],
    recentReports: [],
    submissionsSeries: [],
    statusDistribution: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const [
          examTemplatesCountSnap,
          questionCountSnap,
          attemptCountSnap,
          submittedAttemptCountSnap,
          publishedExamCountSnap,
          groupDocsSnap,
          questionDocsSnap,
          templateDocsSnap,
          recentAttemptsSnap,
        ] = await Promise.all([
          getCountFromServer(collection(firestore, "examTemplates")),
          getCountFromServer(collection(firestore, "questions")),
          getCountFromServer(collection(firestore, "attempts")),
          getCountFromServer(
            query(collection(firestore, "attempts"), where("status", "==", "submitted")),
          ),
          getCountFromServer(collection(firestore, "publishedExams")),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(12))),
          getDocs(query(collection(firestore, "questions"), limit(500))),
          getDocs(query(collection(firestore, "examTemplates"), limit(20))),
          getDocs(query(collection(firestore, "attempts"), orderBy("submittedAt", "desc"), limit(120))),
        ]);

        const groups = groupDocsSnap.docs.map((d) => ({
          id: d.id,
          name: safeToString(d.data().name, d.id),
        }));

        const questionCountByGroup = new Map<string, number>();
        questionDocsSnap.docs.forEach((docSnap) => {
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

        const templates = templateDocsSnap.docs.map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: safeToString(row.name, docSnap.id),
            groupId: safeToString(row.groupId, "sin-grupo"),
          };
        });

        const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
        const attemptsByTemplate = new Map<string, { count: number; grades: number[] }>();
        const attemptsByDay = new Map<number, number>();
        const statusCount = new Map<string, number>();
        let fraudTotal = 0;
        recentAttemptsSnap.docs.forEach((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const templateId = safeToString(
            row.examTemplateId ?? row.templateId ?? row.examId,
            "desconocido",
          );
          if (templateId === "desconocido") return;
          const current = attemptsByTemplate.get(templateId) ?? { count: 0, grades: [] };
          current.count += 1;
          const grade = normalizeGradeTo5(row);
          if (grade !== null) current.grades.push(grade);
          attemptsByTemplate.set(templateId, current);

          const status = safeToString(row.status, "unknown");
          statusCount.set(status, (statusCount.get(status) ?? 0) + 1);
          fraudTotal += toNumber(row.fraudTabSwitches) + toNumber(row.fraudClipboardAttempts);

          const submittedAt = row.submittedAt as unknown;
          const d =
            submittedAt && typeof submittedAt === "object" && "toDate" in (submittedAt as any)
              ? (submittedAt as any).toDate()
              : null;
          if (d instanceof Date && Number.isFinite(d.getTime())) {
            const dayKey = startOfDay(d).getTime();
            attemptsByDay.set(dayKey, (attemptsByDay.get(dayKey) ?? 0) + 1);
          }
        });

        const recentReports: ReportRow[] = templates.slice(0, 18).map((t) => {
          const agg = attemptsByTemplate.get(t.id) ?? { count: 0, grades: [] };
          const avg =
            agg.grades.length > 0
              ? `${(agg.grades.reduce((a, b) => a + b, 0) / agg.grades.length).toFixed(2)} / 5`
              : "Sin nota";
          const status =
            agg.count >= 30 ? "Alto trafico" : agg.count >= 10 ? "Estable" : "Bajo trafico";
          return {
            exam: t.name,
            group: groupNameById.get(t.groupId) ?? t.groupId,
            submissions: agg.count,
            avg,
            status,
          };
        });

        const metrics: MetricCard[] = [
          {
            label: "Plantillas",
            value: String(examTemplatesCountSnap.data().count),
            trend: `${publishedExamCountSnap.data().count} exámenes publicados`,
            trendPositive: true,
            icon: ClipboardList,
            tint: "bg-white",
            series: buildSeriesFromValue(examTemplatesCountSnap.data().count),
          },
          {
            label: "Preguntas en banco",
            value: String(questionCountSnap.data().count),
            trend: "Crecimiento acumulado",
            trendPositive: true,
            icon: BookOpen,
            tint: "bg-white",
            series: buildSeriesFromValue(questionCountSnap.data().count),
          },
          {
            label: "Intentos registrados",
            value: String(attemptCountSnap.data().count),
            trend: "Historico total",
            trendPositive: true,
            icon: Users,
            tint: "bg-white",
            series: buildSeriesFromValue(attemptCountSnap.data().count),
          },
          {
            label: "Intentos enviados",
            value: String(submittedAttemptCountSnap.data().count),
            trend: "Estado: submitted",
            trendPositive: true,
            icon: TrendingUp,
            tint: "bg-white",
            series: buildSeriesFromValue(submittedAttemptCountSnap.data().count),
          },
        ];

        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return startOfDay(d);
        });
        const submissionsSeries = days.map((d) => ({
          label: formatShortDay(d),
          value: attemptsByDay.get(d.getTime()) ?? 0,
        }));

        const statusDistribution = [
          { label: "submitted", value: statusCount.get("submitted") ?? 0, color: "#34d399" },
          { label: "in_progress", value: statusCount.get("in_progress") ?? 0, color: "#60a5fa" },
          { label: "submitted_expired", value: statusCount.get("submitted_expired") ?? 0, color: "#fbbf24" },
          { label: "submitted_fraud", value: statusCount.get("submitted_fraud") ?? 0, color: "#fb7185" },
        ].filter((x) => x.value > 0);

        if (!cancelled) {
          const fraudCard: MetricCard = {
            label: "Fraude (120 últimos)",
            value: String(fraudTotal),
            trend: "Suma pestaña + copiar/pegar",
            trendPositive: fraudTotal === 0,
            icon: Activity,
            tint: "bg-white",
            series: buildSeriesFromValue(Math.max(1, fraudTotal)),
          };
          setData({
            metricCards: [...metrics, fraudCard].slice(0, 4),
            completionByGroup,
            recentReports,
            submissionsSeries,
            statusDistribution,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError("No fue posible leer datos de Firestore. Revisa reglas/permisos de admin.");
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

  const REPORTS_PER_PAGE = 4;
  const totalReportPages = Math.max(1, Math.ceil(data.recentReports.length / REPORTS_PER_PAGE));
  const safeReportPage = Math.min(reportPage, totalReportPages);
  const paginatedReports = useMemo(() => {
    const start = (safeReportPage - 1) * REPORTS_PER_PAGE;
    return data.recentReports.slice(start, start + REPORTS_PER_PAGE);
  }, [data.recentReports, safeReportPage]);
  const reportInsight = useMemo(() => {
    const total = data.recentReports.reduce((acc, r) => acc + r.submissions, 0);
    const avg = data.recentReports.length ? total / data.recentReports.length : 0;
    const highTraffic = data.recentReports.filter((r) => r.status === "Alto trafico").length;
    return {
      totalSubmissions: total,
      avgSubmissions: avg,
      highTraffic,
    };
  }, [data.recentReports]);

  useEffect(() => {
    if (reportPage > totalReportPages) setReportPage(totalReportPages);
  }, [reportPage, totalReportPages]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
              <Sparkles className="h-4 w-4" />
              Panel académico
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">Resumen visual</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Métricas, tendencias y estado operativo con colores para lectura rápida.
            </p>
          </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { href: "/admin", label: "Dashboard", icon: LayoutDashboard, tint: "bg-white text-zinc-700 ring-zinc-200" },
              { href: "/admin/bank", label: "Banco", icon: BookOpen, tint: "bg-white text-zinc-700 ring-zinc-200" },
              { href: "/admin/templates", label: "Exámenes", icon: ClipboardList, tint: "bg-white text-zinc-700 ring-zinc-200" },
              { href: "/admin/results", label: "Resultados", icon: BarChart3, tint: "bg-white text-zinc-700 ring-zinc-200" },
            ].map((x) => {
              const Icon = x.icon;
              return (
                <Link
                  key={x.href}
                  href={x.href}
                  className={`group flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ring-1 transition hover:-translate-y-0.5 ${x.tint}`}
                >
                  <Icon className="h-4 w-4 opacity-90" />
                  <span className="truncate">{x.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metricCards.map((card) => (
          <article
            key={card.label}
            className={`relative overflow-hidden rounded-3xl ${card.tint} p-4 shadow-sm ring-1 ring-zinc-200`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-700">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">{card.value}</p>
                <p className={`mt-2 text-xs font-semibold ${card.trendPositive ? "text-emerald-700" : "text-rose-700"}`}>
                  {card.trend}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-50 ring-1 ring-zinc-200">
                  <card.icon className="h-5 w-5 text-zinc-800" />
                </div>
                <Sparkline series={card.series} stroke={card.trendPositive ? "#10b981" : "#ef4444"} />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-950">
                <BarChart3 className="h-5 w-5 text-indigo-700" />
                Reportes recientes
              </h2>
              <p className="text-sm text-zinc-600">Vista por tarjetas con estado y promedio por examen.</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
              Página {safeReportPage} de {totalReportPages}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {data.recentReports.length ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {paginatedReports.map((row, idx) => {
                  return (
                    <article
                      key={`${row.exam}-${row.group}`}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                      <p className="truncate text-sm font-semibold text-zinc-950">{row.exam}</p>
                      <p className="mt-1 truncate text-xs text-zinc-600">{row.group}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-700">
                        <div className="rounded-lg bg-zinc-50 px-2 py-1 ring-1 ring-zinc-200">
                          Envios: <span className="font-semibold text-zinc-900">{row.submissions}</span>
                        </div>
                        <div className="rounded-lg bg-zinc-50 px-2 py-1 ring-1 ring-zinc-200">
                          Prom: <span className="font-semibold text-zinc-900">{row.avg}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                          {row.status}
                        </span>
                        <span className="text-[11px] text-zinc-500">Ficha {idx + 1 + (safeReportPage - 1) * REPORTS_PER_PAGE}</span>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200">
                <button
                  type="button"
                  onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                  disabled={safeReportPage <= 1}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-50"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalReportPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReportPage(p)}
                      className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold ${
                        p === safeReportPage ? "bg-indigo-600 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setReportPage((p) => Math.min(totalReportPages, p + 1))}
                  disabled={safeReportPage >= totalReportPages}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
              {loading ? "Cargando reportes..." : "Aun no hay datos suficientes para reportes."}
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-950">
            <Users className="h-5 w-5 text-emerald-700" />
            Análisis por grupo
          </h2>
          <p className="text-sm text-zinc-500">Distribución del banco de preguntas por grupo.</p>
          <div className="mt-4 space-y-4">
            {data.completionByGroup.map((item) => (
              <div key={item.group}>
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                  <span>{item.group}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-zinc-900"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
            {!data.completionByGroup.length ? (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando analisis..." : "No hay grupos/preguntas para analizar."}
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-950">
            <Activity className="h-5 w-5 text-fuchsia-700" />
            Resumen operativo
          </h2>
          <p className="text-sm text-zinc-600">Indicadores derivados de datos reales del panel.</p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
              <p className="text-xs font-semibold text-indigo-700">Reportes visibles</p>
              <p className="mt-1 text-base font-semibold text-zinc-900">{paginatedReports.length}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
              <p className="text-xs font-semibold text-sky-700">Envíos en reportes</p>
              <p className="mt-1 text-base font-semibold text-zinc-900">{reportInsight.totalSubmissions}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
              <p className="text-xs font-semibold text-emerald-700">Promedio envíos/examen</p>
              <p className="mt-1 text-base font-semibold text-zinc-900">{reportInsight.avgSubmissions.toFixed(1)}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
              <p className="text-xs font-semibold text-fuchsia-700">Exámenes alto tráfico</p>
              <p className="mt-1 text-base font-semibold text-zinc-900">{reportInsight.highTraffic}</p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mt-5 grid gap-4">
            <div className="rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Envíos últimos 7 días</p>
                  <p className="text-xs text-zinc-600">Tendencia de actividad reciente</p>
                </div>
              </div>
              {data.submissionsSeries.length ? (
                <div className="mt-3">
                  <LineChart series={data.submissionsSeries} stroke="#7c3aed" />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-white/70 px-4 py-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200/60">
                  {loading ? "Cargando tendencia..." : "No hay datos suficientes para tendencia."}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
              <p className="text-sm font-semibold text-zinc-900">Distribución de estados (últimos 120)</p>
              <p className="text-xs text-zinc-600">Cómo se reparten los intentos recientes</p>
              <div className="mt-4">
                {data.statusDistribution.length ? (
                  <Donut items={data.statusDistribution} />
                ) : (
                  <div className="rounded-2xl bg-white/70 px-4 py-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200/60">
                    {loading ? "Cargando distribución..." : "No hay datos suficientes para distribución."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
