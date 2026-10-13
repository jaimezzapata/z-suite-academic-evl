"use client";

import {
  Building2,
  CalendarDays,
  Clock3,
  DoorOpen,
  GraduationCap,
  MapPinned,
  Pencil,
  Trash2,
  FolderSync,
} from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import type { TeachingLoadRow, InstitutionTab } from "../types";
import { getSubjectTechnologyMeta } from "@/lib/subject-tech-branding";
import {
  formatDateRange,
  formatHours,
  formatScheduleSummary,
  getWeeklyAcademicHours,
  getWeeklySessionCount,
} from "../services/workload-date-utils";

interface WorkloadListViewProps {
  rows: TeachingLoadRow[];
  tab: InstitutionTab;
  loading: boolean;
  onEdit: (row: TeachingLoadRow) => void;
  onRemove: (row: TeachingLoadRow) => void;
}

export function WorkloadListView({
  rows,
  tab,
  loading,
  onEdit,
  onRemove,
}: WorkloadListViewProps) {
  if (!rows.length) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title={loading ? "Cargando carga horaria..." : `No hay registros para ${tab}`}
          description={
            loading
              ? "Obteniendo las cargas y franjas horarias registradas..."
              : "No se encontraron asignaciones con los filtros y la institución seleccionada."
          }
        />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {rows.map((row) => {
        const techMeta = getSubjectTechnologyMeta(row.subjectName);
        const PrimaryIcon = techMeta?.primaryIcon;
        const SecondaryIcon = techMeta?.secondaryIcon;

        return (
          <div
            key={row.id}
            className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900/70 p-4 sm:p-5 shadow-sm transition-all hover:shadow-md ${
              techMeta?.listCardClassName ?? "border-slate-200 dark:border-white/10"
            }`}
          >
            {techMeta && PrimaryIcon ? (
              <div className={`pointer-events-none absolute -bottom-6 -right-4 ${techMeta.watermarkClassName}`}>
                <PrimaryIcon className="h-28 w-28 opacity-10" />
              </div>
            ) : null}

            <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Header Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={row.institution.toUpperCase() === "SENA" ? "sena" : "cesde"}
                    size="sm"
                  >
                    {row.institution}
                  </Badge>

                  {techMeta && PrimaryIcon ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${techMeta.badgeClassName}`}
                      title={techMeta.label}
                    >
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${techMeta.iconWrapClassName}`}>
                        <PrimaryIcon className={techMeta.iconClassName} />
                        {SecondaryIcon ? <SecondaryIcon className={techMeta.iconClassName} /> : null}
                      </span>
                    </span>
                  ) : null}

                  <h3 className="text-base font-bold text-foreground">{row.subjectName}</h3>

                  <Badge variant="default" size="sm">
                    {row.audienceType === "ficha" ? `Ficha ${row.audienceName}` : row.audienceName}
                  </Badge>

                  {row.institution === "CESDE" ? (
                    <Badge variant="cesde" size="sm">
                      {row.cesdeGroupType === "EMPRESARIAL" ? "CESDE empresarial" : "CESDE regular"}
                    </Badge>
                  ) : null}

                  <Badge variant="outline" size="sm">
                    {row.period || "SIN PERIODO"}
                  </Badge>

                  <Badge
                    variant={
                      row.driveStatus === "linked"
                        ? "success"
                        : row.driveStatus === "error"
                          ? "warning"
                          : "default"
                    }
                    size="sm"
                  >
                    {row.driveStatus === "linked"
                      ? "DRIVE VINCULADO"
                      : row.driveStatus === "error"
                        ? "DRIVE CON ERROR"
                        : "DRIVE PENDIENTE"}
                  </Badge>
                </div>

                {/* Metadata Details Chips */}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground/65">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPinned className="h-3.5 w-3.5 text-primary" />
                    {row.siteName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    {row.shiftName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    {row.dayOfWeek2 ? `${row.dayOfWeek1} y ${row.dayOfWeek2}` : row.dayOfWeek1 || "Sin día"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <DoorOpen className="h-3.5 w-3.5 text-primary" />
                    Salón {row.classroom}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    {formatDateRange(row.startDate, row.endDate)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Clock3 className="h-3.5 w-3.5 text-primary" />
                    {formatScheduleSummary(row)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-primary" />
                    {row.dayOfWeek2
                      ? `${row.durationMinutes} min + ${row.day2DurationMinutes || row.durationMinutes} min`
                      : `${row.durationMinutes} min reloj`}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    {row.dayOfWeek2
                      ? `${formatHours(row.academicHours)} h + ${formatHours(row.day2AcademicHours || row.academicHours)} h`
                      : `${formatHours(row.academicHours)} h ${row.institution === "CESDE" ? "académicas" : "registradas"}`}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatHours(getWeeklyAcademicHours(row))} h/semana
                    {getWeeklySessionCount(row) > 1 ? ` (${getWeeklySessionCount(row)} jornadas)` : ""}
                  </span>

                  {row.drivePublicFolderUrl ? (
                    <a
                      href={row.drivePublicFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                    >
                      <FolderSync className="h-3.5 w-3.5" />
                      Abrir Drive
                    </a>
                  ) : null}

                  {row.driveStatus === "error" && row.driveErrorMessage ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      {row.driveErrorMessage}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(row)}
                  className="h-8.5 px-3 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onRemove(row)}
                  className="h-8.5 px-3 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
