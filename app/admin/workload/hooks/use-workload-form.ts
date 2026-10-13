"use client";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError, reportFormSuccess } from "@/lib/form-feedback";
import type {
  CatalogItem,
  InstitutionTab,
  TeachingLoadForm,
  TeachingLoadRow,
} from "../types";
import {
  CALENDAR_END_MINUTES,
  CALENDAR_SLOT_MINUTES,
  calculateAcademicHours,
  dayNameFromIsoDate,
  diffMinutes,
  getWeeklyAcademicHours,
  getWeeklySessionCount,
  isoDate,
  minutesToTimeString,
  normalizeCesdeGroupType,
  normalizeInstitutionTab,
  parseLocalDate,
  periodFromDate,
  startOfWeek,
  usesManualWeekdays,
} from "../services/workload-date-utils";
import { createOrLinkDriveForTeachingLoad } from "../services/workload-service";

export const EMPTY_FORM: TeachingLoadForm = {
  institution: "CESDE",
  cesdeGroupType: "REGULAR",
  period: periodFromDate(isoDate(new Date())),
  subjectId: "",
  audienceId: "",
  siteId: "",
  shiftId: "",
  startDate: "",
  endDate: "",
  dayOfWeek1: "",
  dayOfWeek2: "",
  startTime: "",
  endTime: "",
  day2StartTime: "",
  day2EndTime: "",
  classroom: "",
};

export function useWorkloadForm({
  tab,
  rows,
  subjects,
  groups,
  fichas,
  sites,
  shifts,
  setTab,
  setViewMode,
  setCalendarWeekStart,
  resetFilters,
  setError,
  setSuccess,
}: {
  tab: InstitutionTab;
  rows: TeachingLoadRow[];
  subjects: CatalogItem[];
  groups: CatalogItem[];
  fichas: CatalogItem[];
  sites: CatalogItem[];
  shifts: CatalogItem[];
  setTab: (t: InstitutionTab) => void;
  setViewMode: (v: "list" | "calendar" | "payroll") => void;
  setCalendarWeekStart: (d: Date) => void;
  resetFilters: () => void;
  setError: (err: string | null) => void;
  setSuccess: (msg: string | null) => void;
}) {
  const feedback = useFeedback();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeachingLoadForm>(EMPTY_FORM);

  const audienceOptions = useMemo(
    () => (form.institution === "SENA" ? fichas : groups),
    [fichas, form.institution, groups],
  );

  const currentDurationMinutes = useMemo(
    () => Math.max(0, diffMinutes(form.startTime, form.endTime)),
    [form.endTime, form.startTime],
  );

  const currentAcademicHours = useMemo(() => {
    if (!currentDurationMinutes) return 0;
    return calculateAcademicHours(currentDurationMinutes, form.institution);
  }, [currentDurationMinutes, form.institution]);

  const currentWeeklySessionCount = useMemo(
    () =>
      getWeeklySessionCount({
        institution: form.institution,
        startDate: form.startDate,
        cesdeGroupType: form.cesdeGroupType,
        dayOfWeek1: form.dayOfWeek1.trim() || dayNameFromIsoDate(form.startDate) || "",
        dayOfWeek2: form.dayOfWeek2.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        durationMinutes: currentDurationMinutes,
        academicHours: currentAcademicHours,
        day2StartTime: form.day2StartTime.trim(),
        day2EndTime: form.day2EndTime.trim(),
      }),
    [
      currentAcademicHours,
      currentDurationMinutes,
      form.cesdeGroupType,
      form.day2EndTime,
      form.day2StartTime,
      form.dayOfWeek1,
      form.dayOfWeek2,
      form.endTime,
      form.institution,
      form.startDate,
      form.startTime,
    ],
  );

  const currentWeeklyAcademicHours = useMemo(
    () =>
      getWeeklyAcademicHours({
        institution: form.institution,
        startDate: form.startDate,
        cesdeGroupType: form.cesdeGroupType,
        dayOfWeek1: form.dayOfWeek1.trim() || dayNameFromIsoDate(form.startDate) || "",
        dayOfWeek2: form.dayOfWeek2.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        durationMinutes: currentDurationMinutes,
        academicHours: currentAcademicHours,
        day2StartTime: form.day2StartTime.trim(),
        day2EndTime: form.day2EndTime.trim(),
      }),
    [
      currentAcademicHours,
      currentDurationMinutes,
      form.cesdeGroupType,
      form.day2EndTime,
      form.day2StartTime,
      form.dayOfWeek1,
      form.dayOfWeek2,
      form.endTime,
      form.institution,
      form.startDate,
      form.startTime,
    ],
  );

  function showValidationError(message: string) {
    return reportFormError({ message, feedback, setMessage: setError });
  }

  function resetForm(nextInstitution: "CESDE" | "SENA" = tab === "ALL" ? "CESDE" : tab) {
    setForm({ ...EMPTY_FORM, institution: nextInstitution });
    setEditingId(null);
  }

  function openCreate(seed?: Partial<TeachingLoadForm>) {
    resetForm(normalizeInstitutionTab(tab));
    setError(null);
    setSuccess(null);
    if (seed) {
      setForm((prev) => ({ ...prev, ...seed }));
    }
    setModalOpen(true);
  }

  function openCreateFromCalendar(day: Date, startMinutes: number) {
    const startTime = minutesToTimeString(startMinutes);
    const endTime = minutesToTimeString(Math.min(startMinutes + CALENDAR_SLOT_MINUTES, CALENDAR_END_MINUTES));
    const date = isoDate(day);
    openCreate({
      institution: normalizeInstitutionTab(tab),
      period: periodFromDate(date),
      startDate: date,
      endDate: date,
      dayOfWeek1: dayNameFromIsoDate(date) || "",
      startTime,
      endTime,
    });
  }

  function openEdit(row: TeachingLoadRow) {
    setEditingId(row.id);
    setForm({
      institution: (row.institution?.toUpperCase() === "SENA" ? "SENA" : "CESDE") as "CESDE" | "SENA",
      cesdeGroupType: normalizeCesdeGroupType(row.cesdeGroupType),
      period: row.period || periodFromDate(row.startDate),
      subjectId: row.subjectId,
      audienceId: row.audienceId,
      siteId: row.siteId,
      shiftId: row.shiftId,
      startDate: row.startDate,
      endDate: row.endDate,
      dayOfWeek1: row.dayOfWeek1 || dayNameFromIsoDate(row.startDate) || "",
      dayOfWeek2: row.dayOfWeek2 || "",
      startTime: row.startTime,
      endTime: row.endTime,
      day2StartTime: row.day2StartTime || "",
      day2EndTime: row.day2EndTime || "",
      classroom: row.classroom,
    });
    setError(null);
    setSuccess(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm(normalizeInstitutionTab(tab));
  }

  function updateFormField<K extends keyof TeachingLoadForm>(key: K, value: TeachingLoadForm[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "institution") {
        next.audienceId = "";
        if (value === "SENA") {
          next.cesdeGroupType = "REGULAR";
        }
      }
      if (key === "cesdeGroupType" && value === "REGULAR") {
        next.dayOfWeek2 = "";
        next.day2StartTime = "";
        next.day2EndTime = "";
      }
      if (key === "dayOfWeek2" && !String(value).trim()) {
        next.day2StartTime = "";
        next.day2EndTime = "";
      }
      if (key === "startDate") {
        if (!prev.period.trim()) next.period = periodFromDate(String(value));
        if (!next.dayOfWeek1.trim()) {
          next.dayOfWeek1 = dayNameFromIsoDate(String(value)) || next.dayOfWeek1;
        }
      }
      return next;
    });
  }

  async function saveRow() {
    const currentRow = editingId ? rows.find((row) => row.id === editingId) ?? null : null;
    const subject = subjects.find((item) => item.id === form.subjectId);
    const audience = audienceOptions.find((item) => item.id === form.audienceId);
    const site = sites.find((item) => item.id === form.siteId);
    const shift = shifts.find((item) => item.id === form.shiftId);

    if (!subject) {
      showValidationError("Debes seleccionar una materia.");
      return;
    }
    if (!site) {
      showValidationError("Debes seleccionar una sede.");
      return;
    }
    if (!audience) {
      showValidationError(form.institution === "SENA" ? "Debes seleccionar una ficha." : "Debes seleccionar un grupo.");
      return;
    }
    if (!shift) {
      showValidationError("Debes seleccionar una jornada.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      showValidationError("Debes ingresar fecha de inicio y fecha de fin.");
      return;
    }
    if (form.endDate < form.startDate) {
      showValidationError("La fecha de fin no puede ser menor que la fecha de inicio.");
      return;
    }
    if (!form.startTime || !form.endTime) {
      showValidationError("Debes ingresar hora de inicio y hora de fin.");
      return;
    }
    if (form.endTime <= form.startTime) {
      showValidationError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }
    const durationMinutes = diffMinutes(form.startTime, form.endTime);
    if (durationMinutes <= 0) {
      showValidationError("La franja horaria no es válida.");
      return;
    }
    const period = form.period.trim().toUpperCase();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      showValidationError("El periodo debe tener formato YYYY-PP, por ejemplo 2026-01.");
      return;
    }
    if (!form.classroom.trim()) {
      showValidationError("Debes ingresar el salón.");
      return;
    }
    const cesdeGroupType = form.institution === "CESDE" ? form.cesdeGroupType : "REGULAR";
    const manualWeekdays = usesManualWeekdays({
      institution: form.institution,
      cesdeGroupType,
    });
    const academicHours = calculateAcademicHours(durationMinutes, form.institution);
    const dayOfWeek1 = form.dayOfWeek1.trim() || dayNameFromIsoDate(form.startDate) || "";
    if (!dayOfWeek1) {
      showValidationError("No fue posible resolver el día principal de la carga.");
      return;
    }
    const dayOfWeek2 = manualWeekdays ? form.dayOfWeek2.trim() : "";
    if (manualWeekdays && dayOfWeek2 && dayOfWeek2 === dayOfWeek1) {
      showValidationError("El segundo día no puede ser igual al primero.");
      return;
    }
    const resolvedDay2StartTime = dayOfWeek2 ? form.day2StartTime.trim() || form.startTime : "";
    const resolvedDay2EndTime = dayOfWeek2 ? form.day2EndTime.trim() || form.endTime : "";
    const day2DurationMinutes = dayOfWeek2 ? diffMinutes(resolvedDay2StartTime, resolvedDay2EndTime) : 0;
    if (dayOfWeek2 && day2DurationMinutes <= 0) {
      showValidationError("La franja horaria del segundo día no es válida.");
      return;
    }
    const day2AcademicHours = dayOfWeek2 ? calculateAcademicHours(day2DurationMinutes, form.institution) : 0;
    const weeklyAcademicHours = getWeeklyAcademicHours({
      institution: form.institution,
      startDate: form.startDate,
      cesdeGroupType,
      dayOfWeek1,
      dayOfWeek2,
      startTime: form.startTime,
      endTime: form.endTime,
      durationMinutes,
      academicHours,
      day2StartTime: resolvedDay2StartTime,
      day2EndTime: resolvedDay2EndTime,
      day2DurationMinutes,
      day2AcademicHours,
    });

    const isEditing = Boolean(editingId);
    const savedId = editingId ?? doc(collection(firestore, "teachingLoads")).id;
    const classroom = form.classroom.trim().toUpperCase();
    const payload = {
      institution: form.institution,
      cesdeGroupType: form.institution === "CESDE" ? cesdeGroupType : "",
      period,
      subjectId: subject.id,
      subjectName: subject.name,
      audienceId: audience.id,
      audienceName: audience.name,
      audienceType: form.institution === "SENA" ? "ficha" : "group",
      siteId: site.id,
      siteName: site.name,
      shiftId: shift.id,
      shiftName: shift.name,
      startDate: form.startDate,
      endDate: form.endDate,
      startTime: form.startTime,
      endTime: form.endTime,
      day2StartTime: dayOfWeek2 ? resolvedDay2StartTime : "",
      day2EndTime: dayOfWeek2 ? resolvedDay2EndTime : "",
      classroom,
      durationMinutes,
      academicHours,
      day2DurationMinutes,
      day2AcademicHours,
      weeklyAcademicHours,
      dayOfWeek1,
      dayOfWeek2,
      active: true,
      updatedAt: serverTimestamp(),
    };
    const hasLinkedDrive = Boolean(currentRow?.driveWorkspaceId?.trim());
    const focusDate = parseLocalDate(form.startDate);

    flushSync(() => {
      setError(null);
      setSuccess(null);
      closeModal();
    });

    window.setTimeout(() => {
      void (async () => {
        try {
          if (isEditing) {
            await updateDoc(doc(firestore, "teachingLoads", savedId), payload);
          } else {
            await setDoc(doc(firestore, "teachingLoads", savedId), {
              id: savedId,
              ...payload,
              driveWorkspaceId: "",
              driveStatus: "pending",
              driveErrorMessage: "",
              drivePublicFolderUrl: "",
              createdAt: serverTimestamp(),
            });
          }

          flushSync(() => {
            setTab(form.institution);
            setViewMode("calendar");
            resetFilters();
            if (focusDate) {
              setCalendarWeekStart(startOfWeek(focusDate));
            }
          });

          if (hasLinkedDrive) {
            setSuccess("Carga horaria actualizada correctamente. La estructura de Drive existente se conserva.");
            feedback.success("Carga horaria actualizada correctamente.");
            return;
          }

          await updateDoc(doc(firestore, "teachingLoads", savedId), {
            driveStatus: "pending",
            driveErrorMessage: "",
            updatedAt: serverTimestamp(),
          });

          try {
            const driveResult = await createOrLinkDriveForTeachingLoad({
              loadId: savedId,
              institution: form.institution,
              cesdeGroupType,
              period,
              subjectId: subject.id,
              audienceId: audience.id,
              siteName: site.name,
              shiftName: shift.name,
              startDate: form.startDate,
              endDate: form.endDate,
              dayOfWeek1,
              dayOfWeek2,
              startTime: form.startTime,
              endTime: form.endTime,
              day2StartTime: dayOfWeek2 ? resolvedDay2StartTime : "",
              day2EndTime: dayOfWeek2 ? resolvedDay2EndTime : "",
            });
            await updateDoc(doc(firestore, "teachingLoads", savedId), {
              driveWorkspaceId: driveResult.workspaceId,
              driveStatus: "linked",
              driveErrorMessage: "",
              drivePublicFolderUrl: driveResult.publicFolderUrl,
              updatedAt: serverTimestamp(),
            });
            setSuccess(
              isEditing
                ? "Carga horaria actualizada y estructura de Drive vinculada."
                : "Carga horaria registrada y estructura de Drive creada.",
            );
            feedback.success(isEditing ? "Carga horaria actualizada y Drive vinculado." : "Carga horaria registrada y Drive creado.");
          } catch (driveError) {
            const driveMessage =
              driveError instanceof Error ? driveError.message : "No fue posible crear la estructura de Drive.";
            await updateDoc(doc(firestore, "teachingLoads", savedId), {
              driveWorkspaceId: "",
              driveStatus: "error",
              driveErrorMessage: driveMessage,
              updatedAt: serverTimestamp(),
            });
            reportFormError({
              message: `La carga se guardó, pero Drive falló: ${driveMessage}`,
              feedback,
              setMessage: setError,
            });
            reportFormSuccess({
              message: `${isEditing ? "Carga horaria actualizada" : "Carga horaria registrada"}, pero la estructura de Drive no pudo crearse automáticamente.`,
              feedback,
              setMessage: setSuccess,
            });
          }
        } catch {
          reportFormError({
            message: "No fue posible guardar la carga horaria.",
            feedback,
            setMessage: setError,
          });
        }
      })();
    }, 0);
  }

  return {
    modalOpen,
    setModalOpen,
    editingId,
    form,
    audienceOptions,
    currentDurationMinutes,
    currentAcademicHours,
    currentWeeklySessionCount,
    currentWeeklyAcademicHours,
    openCreate,
    openCreateFromCalendar,
    openEdit,
    closeModal,
    updateFormField,
    saveRow,
  };
}
