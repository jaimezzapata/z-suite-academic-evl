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

type MetricCard = {
  label: string;
  value: string;
  trend: string;
  trendPositive: boolean;
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

export function DashboardView() {
  const [goalPerDay, setGoalPerDay] = useState(120);
  const [alertWhenRemainingBelowPct, setAlertWhenRemainingBelowPct] = useState(30);
  const [defaultScale, setDefaultScale] = useState("both");
  const [mobileCompact, setMobileCompact] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>({
    metricCards: [
      { label: "Examenes activos", value: "-", trend: "cargando", trendPositive: true },
      { label: "Preguntas en banco", value: "-", trend: "cargando", trendPositive: true },
      { label: "Intentos registrados", value: "-", trend: "cargando", trendPositive: true },
      { label: "Intentos enviados", value: "-", trend: "cargando", trendPositive: true },
    ],
    completionByGroup: [],
    recentReports: [],
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
        });

        const recentReports: ReportRow[] = templates.slice(0, 6).map((t) => {
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

        const metricCards: MetricCard[] = [
          {
            label: "Examenes activos",
            value: String(examTemplatesCountSnap.data().count),
            trend: "Plantillas disponibles",
            trendPositive: true,
          },
          {
            label: "Preguntas en banco",
            value: String(questionCountSnap.data().count),
            trend: "Crecimiento acumulado",
            trendPositive: true,
          },
          {
            label: "Intentos registrados",
            value: String(attemptCountSnap.data().count),
            trend: "Historico total",
            trendPositive: true,
          },
          {
            label: "Intentos enviados",
            value: String(submittedAttemptCountSnap.data().count),
            trend: "Estado: submitted",
            trendPositive: true,
          },
        ];

        if (!cancelled) {
          setData({ metricCards, completionByGroup, recentReports });
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

  const forecast = useMemo(() => {
    const completionRate = 0.84;
    const projected = Math.round(goalPerDay * completionRate);
    return `${projected}/${goalPerDay}`;
  }, [goalPerDay]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metricCards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{card.value}</p>
            <p
              className={`mt-2 text-xs font-medium ${
                card.trendPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {card.trend}
            </p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Reportes recientes</h2>
              <p className="text-sm text-zinc-500">Resumen rapido de los ultimos examenes aplicados.</p>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {data.recentReports.length ? (
            <>
              <div className="mt-4 grid gap-3 lg:hidden">
                {data.recentReports.map((row) => (
                  <div
                    key={`${row.exam}-${row.group}`}
                    className="rounded-xl border border-zinc-200 bg-white p-3"
                  >
                    <p className="truncate text-sm font-semibold text-zinc-950">{row.exam}</p>
                    <p className="mt-1 truncate text-xs text-zinc-600">{row.group}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600">
                      <div className="rounded-lg bg-zinc-50 px-2 py-1">
                        Envios: <span className="font-semibold text-zinc-900">{row.submissions}</span>
                      </div>
                      <div className="rounded-lg bg-zinc-50 px-2 py-1">
                        Prom: <span className="font-semibold text-zinc-900">{row.avg}</span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 hidden lg:block">
                <table className="w-full table-fixed text-left">
                  <thead>
                    <tr className="text-xs text-zinc-500">
                      <th className="w-[38%] pb-3 font-medium">Examen</th>
                      <th className="w-[26%] pb-3 font-medium">Grupo</th>
                      <th className="w-[12%] pb-3 font-medium">Envios</th>
                      <th className="w-[14%] pb-3 font-medium">Promedio</th>
                      <th className="w-[10%] pb-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentReports.map((row) => (
                      <tr
                        key={`${row.exam}-${row.group}`}
                        className="border-t border-zinc-100 text-sm text-zinc-700"
                      >
                        <td className="py-3 pr-3 font-medium text-zinc-900">
                          <div className="truncate">{row.exam}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="truncate">{row.group}</div>
                        </td>
                        <td className="py-3 pr-3">{row.submissions}</td>
                        <td className="py-3 pr-3">
                          <div className="truncate">{row.avg}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
              {loading ? "Cargando reportes..." : "Aun no hay datos suficientes para reportes."}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Analisis por grupo</h2>
          <p className="text-sm text-zinc-500">Distribucion del banco de preguntas por grupo.</p>
          <div className="mt-4 space-y-3">
            {data.completionByGroup.map((item) => (
              <div key={item.group}>
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                  <span>{item.group}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
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
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Controles ajustables</h2>
          <p className="text-sm text-zinc-500">Personaliza la vista del dashboard.</p>

          <div className="mt-4 space-y-4">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-800">Meta diaria de intentos</span>
              <input
                type="number"
                min={10}
                max={600}
                value={goalPerDay}
                onChange={(e) => setGoalPerDay(Number(e.target.value || 0))}
                className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-800">Alerta de tiempo (porcentaje restante)</span>
              <select
                value={String(alertWhenRemainingBelowPct)}
                onChange={(e) => setAlertWhenRemainingBelowPct(Number(e.target.value))}
                className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              >
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
                <option value="25">25%</option>
                <option value="30">30%</option>
                <option value="40">40%</option>
                <option value="50">50%</option>
              </select>
              <p className="text-xs text-zinc-500">
                Ej: 30% significa alertar cuando quede menos del 30% del tiempo del examen.
              </p>
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-800">Escala predeterminada de nota</span>
              <select
                value={defaultScale}
                onChange={(e) => setDefaultScale(e.target.value)}
                className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              >
                <option value="both">0-5 y 0-50</option>
                <option value="0_5">Solo 0-5</option>
                <option value="0_50">Solo 0-50</option>
              </select>
            </label>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800">Modo compacto en moviles</p>
                <p className="truncate text-xs text-zinc-500">Reduce espacios para pantallas pequenas.</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileCompact((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  mobileCompact ? "bg-zinc-900" : "bg-zinc-200"
                }`}
                aria-pressed={mobileCompact}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    mobileCompact ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Resumen operativo</h2>
          <p className="text-sm text-zinc-500">Lectura rapida para decisiones en tiempo real.</p>

          <div className="mt-4 space-y-3 text-sm text-zinc-700">
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Proyeccion de finalizacion del dia: <strong>{forecast}</strong>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Escala activa para nuevos examenes: <strong>{defaultScale}</strong>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Alerta cuando el tiempo restante sea menor al <strong>{alertWhenRemainingBelowPct}%</strong>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Experiencia movil: <strong>{mobileCompact ? "compacta" : "expandida"}</strong>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
