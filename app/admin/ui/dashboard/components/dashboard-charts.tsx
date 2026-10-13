"use client";

import { useMemo } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DashboardData } from "../types";

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
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

export interface DashboardChartsProps {
  data: DashboardData;
  workloadWeek: {
    perDay: Array<{
      fullLabel: string;
      occupiedHours: number;
      freeHours: number;
    }>;
  };
  driveSummary: {
    cesde: number;
    sena: number;
    broken: number;
  };
}

export function DashboardCharts({ data, workloadWeek, driveSummary }: DashboardChartsProps) {
  const activity14Data = useMemo(
    () => data.activity14.labels.map((label, idx) => ({ label, value: data.activity14.values[idx] ?? 0 })),
    [data.activity14.labels, data.activity14.values],
  );

  const drivePieData = useMemo(
    () => [
      { label: "CESDE", value: driveSummary.cesde, fill: "#0284c7" },
      { label: "SENA", value: driveSummary.sena, fill: "#16a34a" },
      { label: "Sin sincronizar", value: driveSummary.broken, fill: "#f59e0b" },
    ],
    [driveSummary.broken, driveSummary.cesde, driveSummary.sena],
  );

  const attemptsStatusData = useMemo(
    () => [
      { label: "En progreso", value: data.counts.attemptsInProgress, fill: "#6366f1" },
      { label: "Enviados", value: data.counts.attemptsSubmitted, fill: "#10b981" },
      { label: "Anulados", value: data.counts.attemptsAnnulled, fill: "#ef4444" },
    ],
    [data.counts.attemptsAnnulled, data.counts.attemptsInProgress, data.counts.attemptsSubmitted],
  );

  return (
    <div className="space-y-6">
      {/* Fila 1: Carga horaria semanal + Drive distribución */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Carga horaria semanal</CardTitle>
            <CardDescription>
              Horas ocupadas vs libres en ventana de jornada. Excluye festivos colombianos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadWeek.perDay} barCategoryGap={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                  <XAxis dataKey="fullLabel" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatChartValue(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatChartValue(v)} />
                  <Bar dataKey="occupiedHours" name="Ocupado (h)" fill="#6366f1" shape={<Bar3DShape />} />
                  <Bar dataKey="freeHours" name="Libre (h)" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución de Drive</CardTitle>
            <CardDescription>Workspaces institucionales y estado de salud.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v) => formatChartValue(v)} />
                  <Pie
                    data={drivePieData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={54}
                    outerRadius={88}
                    paddingAngle={4}
                  >
                    {drivePieData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid gap-2 text-xs">
              {drivePieData.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.fill }} />
                    {row.label}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCompactNumber(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fila 2: Actividad de exámenes + Estados + Histograma de notas */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Actividad (14 días)</CardTitle>
            <CardDescription>Envíos diarios de exámenes completados.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity14Data}>
                  <defs>
                    <linearGradient id="attemptsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => formatChartValue(v)} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatChartValue(v)} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#6366f1"
                    fill="url(#attemptsGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estados de intentos</CardTitle>
            <CardDescription>Distribución general de evaluaciones.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v) => formatChartValue(v)} />
                  <Pie
                    data={attemptsStatusData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={46}
                    outerRadius={76}
                    paddingAngle={4}
                  >
                    {attemptsStatusData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 grid gap-1.5 text-xs">
              {attemptsStatusData.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.fill }} />
                    {row.label}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCompactNumber(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución de notas</CardTitle>
            <CardDescription>Histograma de calificaciones (escala 0 a 5).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.gradeDist} barCategoryGap={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatChartValue(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatChartValue(v)} />
                  <Bar dataKey="value" name="Intentos" fill="#10b981" shape={<Bar3DShape />} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
