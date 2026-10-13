"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";
import type {
  CatalogItem,
  ExamTemplateRow,
  PublishedRef,
} from "../types";
import {
  checkTemplateAttemptsCount,
  deleteTemplateFromDb,
  fetchExamCatalogs,
  toBoolean,
  toNumber,
  toString,
} from "../services/exam-template-service";
import { useTemplateFilters } from "./use-template-filters";
import { useTemplateForm } from "./use-template-form";
import { useTemplatePublish } from "./use-template-publish";

export function useExamManager() {
  const feedback = useFeedback();

  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);
  const [moments, setMoments] = useState<CatalogItem[]>([]);
  const [sites, setSites] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);

  const [rows, setRows] = useState<ExamTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Record<string, string>>({});

  // Delete modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamTemplateRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Published exams lookup
  const [publishedByTemplate, setPublishedByTemplate] = useState<Record<string, PublishedRef>>({});

  function showError(message: string) {
    return reportFormError({ message, feedback, setMessage: setError });
  }

  // Load catalogs
  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setError(null);
      try {
        const data = await fetchExamCatalogs();
        if (cancelled) return;
        setSubjects(data.subjects);
        setGroups(data.groups);
        setFichas(data.fichas);
        setMoments(data.moments);
        setSites(data.sites);
        setShifts(data.shifts);
      } catch {
        if (!cancelled) setError("No fue posible cargar catálogos. Revisa reglas/permisos.");
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen to publishedExams
  useEffect(() => {
    const q = query(collection(firestore, "publishedExams"), orderBy("publishedAt", "desc"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      const next: Record<string, PublishedRef> = {};
      snap.docs.forEach((d) => {
        const row = d.data() as Record<string, unknown>;
        const templateId = toString(row.templateId, "");
        if (!templateId || next[templateId]) return;
        next[templateId] = {
          accessCode: toString(row.accessCode, "------"),
          status: toString(row.status, "published"),
        };
      });
      setPublishedByTemplate(next);
    });
    return () => unsub();
  }, []);

  // Listen to examTemplates
  useEffect(() => {
    const q = query(collection(firestore, "examTemplates"), orderBy("createdAt", "desc"), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setError(null);
        setRows(
          snap.docs.map((d) => {
            const row = d.data() as Record<string, unknown>;
            const instRaw = toString(row.institution, "CESDE").toUpperCase();
            const institution = instRaw === "SENA" ? "SENA" : "CESDE";
            return {
              id: d.id,
              name: toString(row.name, d.id),
              institution,
              subjectId: toString(row.subjectId, ""),
              groupId: toString(row.groupId, ""),
              momentId: toString(row.momentId, ""),
              siteId: toString(row.siteId, ""),
              shiftId: toString(row.shiftId, ""),
              questionCount: toNumber(row.questionCount, 45),
              timeLimitMinutes: toNumber(row.timeLimitMinutes, 60),
              active: toBoolean(row.active, true),
              fraudEnabled: toBoolean(row.fraudEnabled, true),
              documentationMarkdown: typeof row.documentationMarkdown === "string" ? row.documentationMarkdown : "",
            };
          }),
        );
        setLoading(false);
      },
      () => {
        setError("No fue posible leer exámenes. Revisa reglas/permisos de Firestore.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const namesById = useMemo(() => {
    const m = new Map<string, string>();
    subjects.forEach((x) => m.set(`subjects:${x.id}`, x.name));
    groups.forEach((x) => m.set(`groups:${x.id}`, x.name));
    fichas.forEach((x) => m.set(`fichas:${x.id}`, x.name));
    moments.forEach((x) => m.set(`moments:${x.id}`, x.name));
    sites.forEach((x) => m.set(`sites:${x.id}`, x.name));
    shifts.forEach((x) => m.set(`shifts:${x.id}`, x.name));
    return m;
  }, [subjects, groups, fichas, moments, sites, shifts]);

  // Sub-hook: Filters & search
  const filtersState = useTemplateFilters({
    rows,
    namesById,
    publishedByTemplate,
  });

  // Sub-hook: Form & template creation/edit
  const formState = useTemplateForm({
    namesById,
    feedback,
    showError,
  });

  // Sub-hook: Publish preview & execution
  const publishState = useTemplatePublish({
    namesById,
    feedback,
    showError,
  });

  // Inline row updates
  async function saveQuestionCount(id: string) {
    const raw = pendingCounts[id];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value > 200) {
      showError("La cantidad de preguntas debe estar entre 1 y 200.");
      return;
    }
    setSavingId(id);
    try {
      await updateDoc(doc(firestore, "examTemplates", id), {
        questionCount: value,
        updatedAt: serverTimestamp(),
      });
      const publishedSnap = await getDocs(
        query(
          collection(firestore, "publishedExams"),
          where("templateId", "==", id),
          limit(200),
        ),
      );
      await Promise.all(
        publishedSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string })
          .filter((r) => toString((r as Record<string, unknown>).status, "published") === "published")
          .map(async (r) => {
            await updateDoc(doc(firestore, "publishedExams", r.id), {
              questionCount: value,
              updatedAt: serverTimestamp(),
            });
          }),
      );
      feedback.success("Cantidad de preguntas actualizada.");
    } catch {
      showError("No fue posible actualizar la cantidad de preguntas.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    setSavingId(id);
    try {
      await updateDoc(doc(firestore, "examTemplates", id), { active: next, updatedAt: serverTimestamp() });
      feedback.success(next ? "Examen activado." : "Examen inactivado.");
    } catch {
      showError("No fue posible actualizar el estado del examen.");
    } finally {
      setSavingId(null);
    }
  }

  function setPendingCountForId(id: string, value: string) {
    setPendingCounts((prev) => ({ ...prev, [id]: value }));
  }

  // Delete modal actions
  async function openDelete(row: ExamTemplateRow) {
    setError(null);
    setDeleteTarget(row);
    setDeleteConfirm("");
    setDeleteBlockReason(null);
    setDeleteOpen(true);

    try {
      const count = await checkTemplateAttemptsCount(row.id);
      if (count > 0) {
        setDeleteBlockReason("No se puede eliminar: existen intentos asociados a este examen.");
      }
    } catch {
      setDeleteBlockReason("No fue posible verificar intentos asociados. Revisa permisos.");
    }
  }

  function closeDeleteModal() {
    setDeleteOpen(false);
    setDeleteTarget(null);
    setDeleteConfirm("");
    setDeleteBlockReason(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteConfirm.trim().toUpperCase() !== "ELIMINAR") return;
    if (deleteBlockReason) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteTemplateFromDb(deleteTarget.id);
      closeDeleteModal();
      feedback.success("Examen eliminado correctamente.");
    } catch {
      showError("No fue posible eliminar el examen. Revisa permisos.");
    } finally {
      setDeleting(false);
    }
  }

  return {
    subjects,
    groups,
    fichas,
    moments,
    sites,
    shifts,
    rows,
    loading,
    error,
    namesById,
    savingId,
    pendingCounts,
    publishedByTemplate,

    // Filters & view
    ...filtersState,

    // Form modal
    ...formState,

    // Delete modal
    deleteOpen,
    deleteTarget,
    deleteConfirm,
    deleteBlockReason,
    deleting,
    openDelete,
    closeDeleteModal,
    setDeleteConfirm,
    confirmDelete,

    // Publish & preview
    ...publishState,

    // Row inline actions
    saveQuestionCount,
    setPendingCountForId,
    toggleActive,
  };
}
