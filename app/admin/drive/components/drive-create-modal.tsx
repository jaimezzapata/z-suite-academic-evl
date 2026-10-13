"use client";

import type { ComponentType, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  CalendarDays,
  Clock3,
  FolderPlus,
  GraduationCap,
  Hash,
  Layers3,
  MapPinned,
  Sparkles,
  X,
} from "lucide-react";
import type { CatalogItem } from "../types";
import {
  WEEK_DAY_OPTIONS,
  dayNameFromIsoDate,
  formatScheduleRange,
} from "../services/drive-service";

type DriveFormSectionProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
};

function DriveFormSection({
  icon: Icon,
  title,
  description,
  children,
}: DriveFormSectionProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3">
      <div className="flex items-start gap-2.5">
        <div className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

interface DriveCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  createError: string | null;
  subjects: CatalogItem[];
  groups: CatalogItem[];
  fichas: CatalogItem[];
  sites: CatalogItem[];
  shifts: CatalogItem[];
  institution: "CESDE" | "SENA";
  setInstitution: (val: "CESDE" | "SENA") => void;
  cesdeGroupType: "REGULAR" | "EMPRESARIAL";
  setCesdeGroupType: (val: "REGULAR" | "EMPRESARIAL") => void;
  subjectId: string;
  setSubjectId: (val: string) => void;
  groupId: string;
  setGroupId: (val: string) => void;
  period: string;
  setPeriod: (val: string) => void;
  siteId: string;
  setSiteId: (val: string) => void;
  shiftId: string;
  setShiftId: (val: string) => void;
  dayOfWeek1: string;
  setDayOfWeek1: (val: string) => void;
  dayOfWeek2: string;
  setDayOfWeek2: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  startTime: string;
  setStartTime: (val: string) => void;
  endTime: string;
  setEndTime: (val: string) => void;
  day2StartTime: string;
  setDay2StartTime: (val: string) => void;
  day2EndTime: string;
  setDay2EndTime: (val: string) => void;
  classroom: string;
  setClassroom: (val: string) => void;
  usesManualWeekdays: boolean;
  resolvedDayOfWeek1: string;
  resolvedDayOfWeek2: string;
}

export function DriveCreateModal({
  isOpen,
  onClose,
  onSubmit,
  createError,
  subjects,
  groups,
  fichas,
  sites,
  shifts,
  institution,
  setInstitution,
  cesdeGroupType,
  setCesdeGroupType,
  subjectId,
  setSubjectId,
  groupId,
  setGroupId,
  period,
  setPeriod,
  siteId,
  setSiteId,
  shiftId,
  setShiftId,
  dayOfWeek1,
  setDayOfWeek1,
  dayOfWeek2,
  setDayOfWeek2,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  day2StartTime,
  setDay2StartTime,
  day2EndTime,
  setDay2EndTime,
  classroom,
  setClassroom,
  usesManualWeekdays,
  resolvedDayOfWeek1,
  resolvedDayOfWeek2,
}: DriveCreateModalProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="relative w-[min(96vw,1480px)] max-w-none overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-950">Crear estructura</p>
                <p className="mt-1 text-xs text-zinc-500">Formulario alineado con el Apps Script de Google.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 py-4">
              {createError ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {createError}
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
                  <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm">
                        <Sparkles className="h-3.5 w-3.5" />
                        Configuración guiada de estructura
                      </div>
                      <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950">
                        {subjects.find((s) => s.id === subjectId)?.name ?? "Selecciona la materia"}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {institution} · {institution === "SENA" ? "Ficha" : "Grupo"} ·{" "}
                        {(institution === "SENA" ? fichas : groups).find((item) => item.id === groupId)?.name ??
                          "Pendiente"}{" "}
                        · {period}
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:w-[560px]">
                      <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Sede</p>
                        <p className="mt-1 text-xs font-semibold text-zinc-800">
                          {sites.find((s) => s.id === siteId)?.name ?? "Sin definir"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Jornada</p>
                        <p className="mt-1 text-xs font-semibold text-zinc-800">
                          {shifts.find((s) => s.id === shiftId)?.name ?? "Sin definir"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Días</p>
                        <p className="mt-1 text-xs font-semibold text-zinc-800">
                          {resolvedDayOfWeek2
                            ? `${resolvedDayOfWeek1} y ${resolvedDayOfWeek2}`
                            : resolvedDayOfWeek1 || "Pendiente"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Horario</p>
                        <p className="mt-1 text-xs font-semibold text-zinc-800">
                          {startTime && endTime ? `${startTime} - ${endTime}` : "Pendiente"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-3">
                  <DriveFormSection
                    icon={Layers3}
                    title="Base académica"
                    description="Define la institución, la materia y la agrupación que recibirán el encarpetado."
                  >
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Institución</span>
                      <select
                        value={institution}
                        onChange={(event) => {
                          const next = event.target.value === "SENA" ? "SENA" : "CESDE";
                          setInstitution(next);
                          setGroupId("");
                          if (next === "SENA") {
                            setCesdeGroupType("REGULAR");
                          }
                        }}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="CESDE">CESDE</option>
                        <option value="SENA">SENA</option>
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Materia</span>
                      <select
                        value={subjectId}
                        onChange={(event) => setSubjectId(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="">Selecciona materia</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {institution === "CESDE" ? (
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-zinc-700">Tipo de grupo CESDE</span>
                        <select
                          value={cesdeGroupType}
                          onChange={(event) => {
                            const next = event.target.value === "EMPRESARIAL" ? "EMPRESARIAL" : "REGULAR";
                            setCesdeGroupType(next);
                            if (next === "REGULAR") {
                              setDayOfWeek2("");
                              setEndDate("");
                            }
                          }}
                          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                        >
                          <option value="REGULAR">Regular</option>
                          <option value="EMPRESARIAL">Empresarial</option>
                        </select>
                      </label>
                    ) : null}

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">
                        {institution === "SENA" ? "Ficha" : "Grupo"}
                      </span>
                      <select
                        value={groupId}
                        onChange={(event) => setGroupId(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="">{institution === "SENA" ? "Selecciona ficha" : "Selecciona grupo"}</option>
                        {(institution === "SENA" ? fichas : groups).map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="text-xs font-semibold text-zinc-700">Periodo</span>
                      <select
                        value={period}
                        onChange={(event) => setPeriod(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="2026-01">2026-01</option>
                        <option value="2026-02">2026-02</option>
                      </select>
                    </label>
                  </DriveFormSection>

                  <DriveFormSection
                    icon={Building2}
                    title="Operación y ubicación"
                    description="Configura dónde se impartirá la carga y cómo se identificará dentro del panel."
                  >
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Sede</span>
                      <select
                        value={siteId}
                        onChange={(event) => setSiteId(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="">Selecciona sede</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Jornada</span>
                      <select
                        value={shiftId}
                        onChange={(event) => setShiftId(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      >
                        <option value="">Selecciona jornada</option>
                        {shifts.map((shift) => (
                          <option key={shift.id} value={shift.id}>
                            {shift.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="text-xs font-semibold text-zinc-700">Salón</span>
                      <input
                        type="text"
                        value={classroom}
                        onChange={(event) => setClassroom(event.target.value)}
                        placeholder="Ej. A-203"
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>
                  </DriveFormSection>

                  <DriveFormSection
                    icon={CalendarDays}
                    title="Programación académica"
                    description="Estos datos alimentan tanto el Drive como el calendario vinculado."
                  >
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Día 1</span>
                      <select
                        value={resolvedDayOfWeek1}
                        onChange={(event) => setDayOfWeek1(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50 disabled:opacity-60"
                        disabled={!usesManualWeekdays}
                      >
                        {WEEK_DAY_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Día 2 (opcional)</span>
                      <select
                        value={resolvedDayOfWeek2}
                        onChange={(event) => {
                          const next = event.target.value;
                          setDayOfWeek2(next);
                          if (!next) {
                            setDay2StartTime("");
                            setDay2EndTime("");
                          }
                        }}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50 disabled:opacity-60"
                        disabled={!usesManualWeekdays}
                      >
                        <option value="">Sin segundo día</option>
                        {WEEK_DAY_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label
                      className={`grid gap-1.5 ${
                        institution === "CESDE" && cesdeGroupType === "EMPRESARIAL" ? "" : "sm:col-span-2"
                      }`}
                    >
                      <span className="text-xs font-semibold text-zinc-700">Fecha inicio</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) => {
                          const nextDate = event.target.value;
                          setStartDate(nextDate);
                          if (!dayOfWeek1.trim()) {
                            const inferredDay = dayNameFromIsoDate(nextDate);
                            if (inferredDay) setDayOfWeek1(inferredDay);
                          }
                        }}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Fecha fin</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Hora día 1</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700">Fin día 1</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                      />
                    </label>

                    {resolvedDayOfWeek2 ? (
                      <>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-zinc-700">Hora día 2</span>
                          <input
                            type="time"
                            value={day2StartTime}
                            onChange={(event) => setDay2StartTime(event.target.value)}
                            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                          />
                        </label>

                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-zinc-700">Fin día 2</span>
                          <input
                            type="time"
                            value={day2EndTime}
                            onChange={(event) => setDay2EndTime(event.target.value)}
                            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-zinc-50"
                          />
                        </label>
                      </>
                    ) : null}
                  </DriveFormSection>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                      <GraduationCap className="h-3.5 w-3.5" />
                      Materia
                    </div>
                    <p className="mt-2 text-sm font-semibold text-zinc-800">
                      {subjects.find((s) => s.id === subjectId)?.name ?? "Pendiente"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                      {institution === "SENA" ? <Hash className="h-3.5 w-3.5" /> : <Layers3 className="h-3.5 w-3.5" />}
                      {institution === "SENA" ? "Ficha" : "Grupo"}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-zinc-800">
                      {(institution === "SENA" ? fichas : groups).find((item) => item.id === groupId)?.name ?? "Pendiente"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                      <MapPinned className="h-3.5 w-3.5" />
                      Ubicación
                    </div>
                    <p className="mt-2 text-sm font-semibold text-zinc-800">
                      {sites.find((s) => s.id === siteId)?.name ?? "Sede"} ·{" "}
                      {shifts.find((s) => s.id === shiftId)?.name ?? "Jornada"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      Horario
                    </div>
                    <p className="mt-2 text-sm font-semibold text-zinc-800">
                      {startTime && endTime
                        ? resolvedDayOfWeek2
                          ? `${formatScheduleRange(resolvedDayOfWeek1, startTime, endTime)} | ${formatScheduleRange(
                              resolvedDayOfWeek2,
                              day2StartTime || startTime,
                              day2EndTime || endTime,
                            )}`
                          : `${startTime} - ${endTime}`
                        : "Pendiente"}
                    </p>
                  </div>
                </div>

                {!usesManualWeekdays ? (
                  <p className="mt-3 text-xs text-zinc-500">
                    El día principal se calcula automáticamente a partir de la fecha de inicio para mantener el calendario sincronizado.
                  </p>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
                {institution === "CESDE" && cesdeGroupType === "EMPRESARIAL"
                  ? "CESDE empresarial: se crearán sesiones por fechas reales dentro del rango seleccionado, según 1 o 2 días a la semana, y además se registrará automáticamente en carga horaria."
                  : institution === "SENA"
                    ? "SENA: puedes seleccionar 1 o 2 días por semana. Si no llenas el horario del día 2, se reutiliza el del día 1."
                    : "CESDE regular: se conserva la lógica estándar del Apps Script y la estructura también quedará enlazada al calendario."}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <FolderPlus className="h-4 w-4" />
                Crear estructura
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
