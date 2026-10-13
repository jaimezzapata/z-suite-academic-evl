"use client";

import type { ComponentType, ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  Clock3,
  GraduationCap,
  Group,
  Hash,
  Layers3,
  MapPinned,
  Plus,
  Save,
  Sparkles,
} from "lucide-react";
import { Modal, Button, Select, Input } from "@/components/ui";
import type {
  CatalogItem,
  TeachingLoadForm,
} from "../types";
import {
  WEEK_DAY_OPTIONS,
  calculateAcademicHours,
  dayNameFromIsoDate,
  diffMinutes,
  formatHours,
  formatTimeRange,
  usesManualWeekdays,
} from "../services/workload-date-utils";

interface WorkloadFormModalProps {
  isOpen: boolean;
  editingId: string | null;
  form: TeachingLoadForm;
  subjects: CatalogItem[];
  audienceOptions: CatalogItem[];
  sites: CatalogItem[];
  shifts: CatalogItem[];
  currentDurationMinutes: number;
  currentAcademicHours: number;
  currentWeeklySessionCount: number;
  currentWeeklyAcademicHours: number;
  onClose: () => void;
  onUpdateField: <K extends keyof TeachingLoadForm>(key: K, value: TeachingLoadForm[K]) => void;
  onSave: () => void;
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
    <section className="rounded-2xl border border-border bg-slate-50/50 dark:bg-slate-800/30 p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl bg-white dark:bg-slate-800 text-foreground shadow-sm ring-1 ring-border">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-foreground">{title}</h4>
          <p className="mt-0.5 text-[11px] text-foreground/55">{description}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function WorkloadFormModal({
  isOpen,
  editingId,
  form,
  subjects,
  audienceOptions,
  sites,
  shifts,
  currentDurationMinutes,
  currentAcademicHours,
  currentWeeklySessionCount,
  currentWeeklyAcademicHours,
  onClose,
  onUpdateField,
  onSave,
}: WorkloadFormModalProps) {
  const isEditing = Boolean(editingId);
  const selectedSubject = subjects.find((item) => item.id === form.subjectId);
  const selectedAudience = audienceOptions.find((item) => item.id === form.audienceId);
  const selectedSite = sites.find((item) => item.id === form.siteId);
  const selectedShift = shifts.find((item) => item.id === form.shiftId);

  const manualWeekdays = usesManualWeekdays({
    institution: form.institution,
    cesdeGroupType: form.cesdeGroupType,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar carga horaria" : "Nueva carga horaria"}
      description="Registra horarios, materias y periodicidad por institución."
      size="xl"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={onSave}>
            {isEditing ? <Save className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
            {isEditing ? "Guardar cambios" : "Registrar carga"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Live Config Summary Banner */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-gradient-to-r from-slate-50 via-purple-50/30 to-emerald-50/20 dark:from-slate-800/40 dark:via-purple-950/20 dark:to-emerald-950/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-foreground/75 shadow-sm">
                <Sparkles className="h-3 w-3 text-primary" />
                Configuración guiada
              </div>
              <h3 className="mt-2 text-base font-bold tracking-tight text-foreground truncate">
                {selectedSubject?.name ?? "Selecciona la materia"}
              </h3>
              <p className="mt-0.5 text-xs text-foreground/60">
                {form.institution} &middot;{" "}
                {form.institution === "SENA"
                  ? selectedAudience ? `Ficha ${selectedAudience.name}` : "Ficha pendiente"
                  : selectedAudience?.name ?? "Grupo pendiente"}{" "}
                &middot; {form.period.trim() || "Periodo"}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:w-[480px]">
              <div className="rounded-xl border border-border bg-white dark:bg-slate-800 p-2 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Sede</p>
                <p className="mt-0.5 text-xs font-bold text-foreground truncate">
                  {selectedSite?.name ?? "Pendiente"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white dark:bg-slate-800 p-2 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Jornada</p>
                <p className="mt-0.5 text-xs font-bold text-foreground truncate">
                  {selectedShift?.name ?? "Pendiente"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white dark:bg-slate-800 p-2 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Horario</p>
                <p className="mt-0.5 text-xs font-bold text-foreground truncate">
                  {formatTimeRange(form.startTime, form.endTime)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white dark:bg-slate-800 p-2 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Sesiones</p>
                <p className="mt-0.5 text-xs font-bold text-foreground">
                  {currentWeeklySessionCount} {currentWeeklySessionCount === 1 ? "jornada" : "jornadas"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Form Sections */}
        <div className="grid gap-3.5 xl:grid-cols-3">
          {/* Base académica */}
          <WorkloadFormSection
            icon={Layers3}
            title="Base académica"
            description="Institución, materia y audiencia."
          >
            <Select
              label="Institución"
              value={form.institution}
              onChange={(e) => onUpdateField("institution", e.target.value as "CESDE" | "SENA")}
            >
              <option value="CESDE">CESDE</option>
              <option value="SENA">SENA</option>
            </Select>

            <Select
              label="Materia"
              value={form.subjectId}
              onChange={(e) => onUpdateField("subjectId", e.target.value)}
            >
              <option value="">Selecciona materia</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>

            <Input
              type="text"
              label="Periodo"
              placeholder="Ej. 2026-01"
              value={form.period}
              onChange={(e) => onUpdateField("period", e.target.value.toUpperCase())}
            />

            <Select
              label={form.institution === "SENA" ? "Ficha" : "Grupo"}
              value={form.audienceId}
              onChange={(e) => onUpdateField("audienceId", e.target.value)}
            >
              <option value="">{form.institution === "SENA" ? "Selecciona ficha" : "Selecciona grupo"}</option>
              {audienceOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {form.institution === "SENA" ? `Ficha ${item.name}` : item.name}
                </option>
              ))}
            </Select>

            {form.institution === "CESDE" ? (
              <div className="md:col-span-2">
                <Select
                  label="Tipo de grupo CESDE"
                  value={form.cesdeGroupType}
                  onChange={(e) => onUpdateField("cesdeGroupType", e.target.value as "REGULAR" | "EMPRESARIAL")}
                >
                  <option value="REGULAR">Regular</option>
                  <option value="EMPRESARIAL">Empresarial</option>
                </Select>
              </div>
            ) : null}
          </WorkloadFormSection>

          {/* Ubicación operativa */}
          <WorkloadFormSection
            icon={Building2}
            title="Ubicación operativa"
            description="Sede, jornada y salón."
          >
            <Select
              label="Sede"
              value={form.siteId}
              onChange={(e) => onUpdateField("siteId", e.target.value)}
            >
              <option value="">Selecciona sede</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </Select>

            <Select
              label="Jornada"
              value={form.shiftId}
              onChange={(e) => onUpdateField("shiftId", e.target.value)}
            >
              <option value="">Selecciona jornada</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </Select>

            <div className="md:col-span-2">
              <Input
                type="text"
                label="Salón"
                placeholder="Ej. A-203"
                value={form.classroom}
                onChange={(e) => onUpdateField("classroom", e.target.value)}
              />
            </div>
          </WorkloadFormSection>

          {/* Agenda de la carga */}
          <WorkloadFormSection
            icon={CalendarDays}
            title="Agenda de la carga"
            description="Fechas y horarios de ejecución."
          >
            <Input
              type="date"
              label="Fecha inicio"
              value={form.startDate}
              onChange={(e) => onUpdateField("startDate", e.target.value)}
            />

            <Input
              type="date"
              label="Fecha fin"
              value={form.endDate}
              onChange={(e) => onUpdateField("endDate", e.target.value)}
            />

            <Input
              type="time"
              label="Hora día 1"
              value={form.startTime}
              onChange={(e) => onUpdateField("startTime", e.target.value)}
            />

            <Input
              type="time"
              label="Fin día 1"
              value={form.endTime}
              onChange={(e) => onUpdateField("endTime", e.target.value)}
            />

            {manualWeekdays ? (
              <>
                <Select
                  label="Día 1"
                  value={form.dayOfWeek1}
                  onChange={(e) => onUpdateField("dayOfWeek1", e.target.value)}
                >
                  <option value="">Selecciona día</option>
                  {WEEK_DAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Día 2 (opcional)"
                  value={form.dayOfWeek2}
                  onChange={(e) => onUpdateField("dayOfWeek2", e.target.value)}
                >
                  <option value="">Sin segundo día</option>
                  {WEEK_DAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </Select>

                {form.dayOfWeek2 ? (
                  <>
                    <Input
                      type="time"
                      label="Hora día 2"
                      value={form.day2StartTime}
                      onChange={(e) => onUpdateField("day2StartTime", e.target.value)}
                    />
                    <Input
                      type="time"
                      label="Fin día 2"
                      value={form.day2EndTime}
                      onChange={(e) => onUpdateField("day2EndTime", e.target.value)}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </WorkloadFormSection>
        </div>

        {/* Informative Note */}
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 px-3.5 py-2.5 text-xs text-foreground/65">
          {form.institution === "CESDE" && form.cesdeGroupType === "EMPRESARIAL"
            ? "CESDE empresarial: define fecha de inicio, fin y hasta 2 días. La carga se ajusta según las jornadas, Drive mantiene una estructura unificada."
            : form.institution === "CESDE"
              ? "CESDE regular: lógica estándar con encarpetado por semanas y bloque de 45 min por hora académica."
              : "SENA: hasta 2 días por semana. Cada hora equivale a 60 min cronológicos."}
        </div>

        {/* Live Chips Summary */}
        <div className="grid gap-2 rounded-xl border border-border bg-slate-50/40 dark:bg-slate-800/20 px-3.5 py-3 text-xs text-foreground/70 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex items-center gap-1.5 truncate">
            <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{selectedSubject?.name ?? "Materia"}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            {form.institution === "SENA" ? <Hash className="h-3.5 w-3.5 text-primary shrink-0" /> : <Group className="h-3.5 w-3.5 text-primary shrink-0" />}
            <span className="truncate">
              {form.institution === "SENA"
                ? selectedAudience ? `Ficha ${selectedAudience.name}` : "Ficha"
                : selectedAudience?.name ?? "Grupo"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <MapPinned className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{selectedSite?.name ?? "Sede"}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{selectedShift?.name ?? "Jornada"}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">
              {manualWeekdays
                ? form.dayOfWeek2
                  ? `${form.dayOfWeek1 || "Día 1"} y ${form.dayOfWeek2}`
                  : form.dayOfWeek1 || "Día 1"
                : dayNameFromIsoDate(form.startDate) || "Día 1"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Clock3 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">
              {currentDurationMinutes
                ? `${currentDurationMinutes} min -> ${formatHours(currentAcademicHours)} h`
                : "Duración"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 truncate sm:col-span-2">
            <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate font-semibold text-primary">
              {currentDurationMinutes
                ? `${currentWeeklySessionCount} ses/sem -> ${formatHours(currentWeeklyAcademicHours)} h/semana`
                : "Carga semanal"}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
