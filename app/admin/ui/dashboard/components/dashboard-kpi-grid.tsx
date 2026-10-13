"use client";

import {
  BookOpen,
  Calendar,
  Clock,
  FileCheck,
  FolderSync,
  GraduationCap,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import type { DashboardData } from "../types";

export interface DashboardKpiGridProps {
  data: DashboardData;
  loading: boolean;
  driveLinkedTotal: number;
  workloadWeek: {
    driveWorkspaceCount: number;
    occupancy: number;
    totalAcademicHours: number;
    totalOccurrences: number;
    busiestDay: { label: string; dateLabel?: string; scheduledHours: number };
    lightestDay: { label: string; dateLabel?: string; scheduledHours: number };
  };
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatHoursValue(value: number) {
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

export function DashboardKpiGrid({
  data,
  loading,
  driveLinkedTotal,
  workloadWeek,
}: DashboardKpiGridProps) {
  const avgGrade7 = data.summary7.avgGrade;
  const fraud7 = data.summary7.fraudAttempts;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <StatCard
        title="Drive vinculados"
        value={loading ? "..." : formatCompactNumber(driveLinkedTotal)}
        subtitle={loading ? "Cargando..." : `${workloadWeek.driveWorkspaceCount} en esta semana`}
        icon={<FolderSync className="w-5 h-5" />}
        accentColor="sky"
      />

      <StatCard
        title="Ocupación semanal"
        value={loading ? "..." : `${Math.round(workloadWeek.occupancy * 100)}%`}
        subtitle={
          loading
            ? "Cargando..."
            : `${formatHoursValue(workloadWeek.totalAcademicHours)} h · ${workloadWeek.totalOccurrences} clases`
        }
        icon={<Clock className="w-5 h-5" />}
        accentColor="indigo"
      />

      <StatCard
        title="Día más copado"
        value={loading ? "..." : workloadWeek.busiestDay.label}
        subtitle={
          loading ? "Cargando..." : `${formatHoursValue(workloadWeek.busiestDay.scheduledHours)} h asignadas`
        }
        icon={<Calendar className="w-5 h-5" />}
        accentColor="amber"
      />

      <StatCard
        title="Día más suave"
        value={loading ? "..." : workloadWeek.lightestDay.label}
        subtitle={
          loading ? "Cargando..." : `${formatHoursValue(workloadWeek.lightestDay.scheduledHours)} h asignadas`
        }
        icon={<Sparkles className="w-5 h-5" />}
        accentColor="emerald"
      />

      <StatCard
        title="Exámenes activos"
        value={loading ? "..." : formatCompactNumber(data.counts.publishedActive)}
        subtitle={loading ? "Cargando..." : `${formatCompactNumber(data.counts.publishedClosed)} cerrados`}
        icon={<FileCheck className="w-5 h-5" />}
        accentColor="indigo"
      />

      <StatCard
        title="Intentos (7 días)"
        value={loading ? "..." : formatCompactNumber(data.summary7.submittedAttempts)}
        subtitle={loading ? "Cargando..." : `${formatCompactNumber(fraud7)} con fraude`}
        icon={<TrendingUp className="w-5 h-5" />}
        accentColor={fraud7 > 0 ? "rose" : "emerald"}
      />

      <StatCard
        title="Promedio (7 días)"
        value={loading ? "..." : avgGrade7 === null ? "-" : `${avgGrade7.toFixed(2)} / 5`}
        subtitle={loading ? "Cargando..." : `${data.counts.templatesActive} plantillas activas`}
        icon={<GraduationCap className="w-5 h-5" />}
        accentColor="emerald"
      />
    </section>
  );
}
