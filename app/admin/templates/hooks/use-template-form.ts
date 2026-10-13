"use client";

import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormSuccess } from "@/lib/form-feedback";
import { normalizeSentenceText } from "@/lib/text/normalize";
import type { ExamFormData, ExamTemplateRow } from "../types";
import {
  buildExamName,
  readFileAsText,
  toString,
} from "../services/exam-template-service";

const INITIAL_FORM: ExamFormData = {
  institution: "CESDE",
  subjectId: "",
  groupId: "",
  momentId: "",
  siteId: "",
  shiftId: "",
  questionCount: 45,
  timeLimitMinutes: 60,
  active: true,
  fraudEnabled: true,
  documentationMarkdown: "",
  docFileName: null,
};

type UseTemplateFormParams = {
  namesById: Map<string, string>;
  feedback: ReturnType<typeof useFeedback>;
  showError: (message: string) => void;
};

export function useTemplateForm({
  namesById,
  feedback,
  showError,
}: UseTemplateFormParams) {
  const [form, setForm] = useState<ExamFormData>(INITIAL_FORM);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);

  const autoName = useMemo(() => {
    const subjectName = namesById.get(`subjects:${form.subjectId}`) ?? "";
    const groupName =
      (form.institution === "SENA"
        ? namesById.get(`fichas:${form.groupId}`)
        : namesById.get(`groups:${form.groupId}`)) ?? "";
    const momentName = namesById.get(`moments:${form.momentId}`) ?? "";
    const siteName = namesById.get(`sites:${form.siteId}`) ?? "";
    const shiftName = namesById.get(`shifts:${form.shiftId}`) ?? "";

    return buildExamName({
      subject: subjectName,
      group: groupName,
      site: siteName,
      shift: shiftName,
      moment: momentName,
    });
  }, [namesById, form]);

  function updateFormField<K extends keyof ExamFormData>(key: K, value: ExamFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "institution") {
        next.groupId = "";
      }
      return next;
    });
  }

  async function importDocumentationFile(file: File) {
    try {
      if (file.size > 1024 * 1024) {
        showError("El archivo es muy grande. Máximo recomendado: 1MB.");
        return;
      }
      const text = await readFileAsText(file);
      setForm((prev) => ({
        ...prev,
        documentationMarkdown: text,
        docFileName: file.name,
      }));
    } catch {
      showError("No fue posible cargar el archivo de documentación.");
    }
  }

  function openCreate() {
    setForm(INITIAL_FORM);
    setEditId(null);
    setCreateOpen(true);
  }

  function openEdit(row: ExamTemplateRow) {
    setEditId(row.id);
    setForm({
      institution: row.institution,
      subjectId: row.subjectId,
      groupId: row.groupId,
      momentId: row.momentId,
      siteId: row.siteId,
      shiftId: row.shiftId,
      questionCount: row.questionCount,
      timeLimitMinutes: row.timeLimitMinutes || 60,
      active: row.active,
      fraudEnabled: row.fraudEnabled,
      documentationMarkdown: row.documentationMarkdown || "",
      docFileName: null,
    });
    setEditOpen(true);
  }

  function closeFormModal() {
    setCreateOpen(false);
    setEditOpen(false);
    setEditId(null);
  }

  async function createExamTemplate() {
    if (!form.shiftId || !form.siteId || !form.momentId || !form.groupId || !form.subjectId) {
      showError(`Completa Materia, ${form.institution === "SENA" ? "Ficha" : "Grupo"}, Momento, Sede y Jornada.`);
      return;
    }
    if (!Number.isFinite(form.questionCount) || form.questionCount < 1 || form.questionCount > 200) {
      showError("La cantidad de preguntas debe estar entre 1 y 200.");
      return;
    }
    if (!Number.isFinite(form.timeLimitMinutes) || form.timeLimitMinutes < 1 || form.timeLimitMinutes > 240) {
      showError("Tiempo inválido. Rango recomendado: 1 a 240 minutos.");
      return;
    }

    setCreating(true);
    try {
      const nameRes = normalizeSentenceText(autoName);
      if (!nameRes.ok) {
        showError(nameRes.error);
        return;
      }
      await addDoc(collection(firestore, "examTemplates"), {
        name: nameRes.value,
        institution: form.institution,
        subjectId: form.subjectId,
        groupId: form.groupId,
        momentId: form.momentId,
        siteId: form.siteId,
        shiftId: form.shiftId,
        questionCount: form.questionCount,
        timeLimitMinutes: form.timeLimitMinutes,
        documentationMarkdown: form.documentationMarkdown.trim(),
        fraudEnabled: form.fraudEnabled,
        allowedQuestionTypes: [
          "single_choice",
          "multiple_choice",
          "open_concept",
          "puzzle_order",
          "puzzle_match",
          "puzzle_cloze",
        ],
        accessCode: { mode: "generated_6_digits" },
        resultPolicy: { showScoreAfterSubmit: true, showAnswersAfterSubmit: false },
        gradingScale: "both",
        studentRequiredFields: ["fullName", "documentId", "email"],
        active: form.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      closeFormModal();
      feedback.success("Examen creado correctamente.");
    } catch {
      showError("No fue posible crear el examen. Revisa permisos o conexión.");
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit() {
    if (!editId) return;
    if (!form.subjectId || !form.siteId || !form.shiftId || !form.momentId || !form.groupId) {
      showError(`Completa Materia, ${form.institution === "SENA" ? "Ficha" : "Grupo"}, Momento, Sede y Jornada.`);
      return;
    }
    if (!Number.isFinite(form.questionCount) || form.questionCount < 1 || form.questionCount > 200) {
      showError("La cantidad de preguntas debe estar entre 1 y 200.");
      return;
    }
    if (!Number.isFinite(form.timeLimitMinutes) || form.timeLimitMinutes < 1 || form.timeLimitMinutes > 240) {
      showError("Tiempo inválido. Rango recomendado: 1 a 240 minutos.");
      return;
    }

    setEditing(true);
    try {
      const nameRes = normalizeSentenceText(autoName);
      if (!nameRes.ok) {
        showError(nameRes.error);
        return;
      }
      await updateDoc(doc(firestore, "examTemplates", editId), {
        name: nameRes.value,
        institution: form.institution,
        subjectId: form.subjectId,
        groupId: form.groupId,
        momentId: form.momentId,
        siteId: form.siteId,
        shiftId: form.shiftId,
        questionCount: form.questionCount,
        timeLimitMinutes: form.timeLimitMinutes,
        documentationMarkdown: form.documentationMarkdown.trim(),
        active: form.active,
        fraudEnabled: form.fraudEnabled,
        updatedAt: serverTimestamp(),
      });
      const publishedSnap = await getDocs(
        query(
          collection(firestore, "publishedExams"),
          where("templateId", "==", editId),
          limit(200),
        ),
      );
      await Promise.all(
        publishedSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string })
          .filter((r) => toString((r as Record<string, unknown>).status, "published") === "published")
          .map(async (r) => {
            await updateDoc(doc(firestore, "publishedExams", r.id), {
              documentationMarkdown: form.documentationMarkdown.trim(),
              fraudEnabled: form.fraudEnabled,
              questionCount: form.questionCount,
              timeLimitMinutes: form.timeLimitMinutes,
              templateName: nameRes.value,
              name: nameRes.value,
              updatedAt: serverTimestamp(),
            });
          }),
      );
      closeFormModal();
      reportFormSuccess({ message: "Examen actualizado correctamente.", feedback });
    } catch {
      showError("No fue posible guardar cambios del examen.");
    } finally {
      setEditing(false);
    }
  }

  return {
    form,
    createOpen,
    editOpen,
    editId,
    creating,
    editing,
    autoName,
    updateFormField,
    importDocumentationFile,
    openCreate,
    openEdit,
    closeFormModal,
    createExamTemplate,
    saveEdit,
  };
}
