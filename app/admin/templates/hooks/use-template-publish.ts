"use client";

import { useMemo, useState } from "react";
import { useFeedback } from "@/app/feedback-provider";
import type { ExamTemplateRow, PreviewQuestion } from "../types";
import {
  fetchEligibleQuestionsForTemplate,
  publishExamToFirestore,
  shuffleArray,
} from "../services/exam-template-service";

type UseTemplatePublishParams = {
  namesById: Map<string, string>;
  feedback: ReturnType<typeof useFeedback>;
  showError: (message: string) => void;
};

export function useTemplatePublish({
  namesById,
  feedback,
  showError,
}: UseTemplatePublishParams) {
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<ExamTemplateRow | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [eligiblePool, setEligiblePool] = useState<PreviewQuestion[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<PreviewQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [previewViewMode, setPreviewViewMode] = useState<"single" | "all">("single");
  const [manualSwapIndex, setManualSwapIndex] = useState<number | null>(null);
  const [swapSearchTerm, setSwapSearchTerm] = useState("");
  const [swapDifficultyFilter, setSwapDifficultyFilter] = useState("all");
  const [showDocsPreview, setShowDocsPreview] = useState(false);

  async function openPublish(row: ExamTemplateRow) {
    setPublishTarget(row);
    setPublishMessage(null);
    setPreviewError(null);
    setPublishOpen(true);
    setPreviewLoading(true);
    setSelectedQuestions([]);
    setEligiblePool([]);
    setActiveQuestionIndex(0);
    setPreviewViewMode("single");
    setManualSwapIndex(null);
    setSwapSearchTerm("");
    setSwapDifficultyFilter("all");
    setShowDocsPreview(false);

    try {
      const publishSubjectName = namesById.get(`subjects:${row.subjectId}`) ?? row.subjectId;
      const { eligible, candidatesCount } = await fetchEligibleQuestionsForTemplate(row.subjectId, row.momentId);

      if (candidatesCount === 0) {
        setPreviewError(
          `No se encontraron preguntas publicadas para la materia seleccionada (${publishSubjectName}). ID esperado: ${row.subjectId}.`,
        );
        return;
      }

      if (eligible.length < row.questionCount) {
        setPreviewError(
          `No hay suficientes preguntas para publicar. En materia: ${candidatesCount}, en momento (regla Mx): ${eligible.length}. Requeridas: ${row.questionCount}.`,
        );
        setEligiblePool(eligible);
        setSelectedQuestions(eligible);
        return;
      }

      setEligiblePool(eligible);
      const selected = shuffleArray(eligible).slice(0, row.questionCount);
      setSelectedQuestions(selected);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar las preguntas para la vista previa.";
      setPreviewError(msg);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePublishModal() {
    setPublishOpen(false);
    setPublishTarget(null);
    setPublishMessage(null);
  }

  function reShuffleAll() {
    if (!publishTarget || eligiblePool.length < publishTarget.questionCount) return;
    const next = shuffleArray(eligiblePool).slice(0, publishTarget.questionCount);
    setSelectedQuestions(next);
    setActiveQuestionIndex(0);
    feedback.success("Preguntas re-mezcladas aleatoriamente del banco.");
  }

  function handleQuickSwap(index: number) {
    const currentSelectedIds = new Set(selectedQuestions.map((q) => q.id));
    const availableUnused = eligiblePool.filter((q) => !currentSelectedIds.has(q.id));

    if (availableUnused.length === 0) {
      feedback.warning("No hay más preguntas disponibles en el banco para reemplazar.");
      return;
    }

    const randomNew = availableUnused[Math.floor(Math.random() * availableUnused.length)];
    const updated = [...selectedQuestions];
    updated[index] = randomNew;
    setSelectedQuestions(updated);
    feedback.success(`Pregunta #${index + 1} reemplazada por otra del banco.`);
  }

  function handleSelectReplacement(replacement: PreviewQuestion) {
    if (manualSwapIndex === null) return;
    const updated = [...selectedQuestions];
    updated[manualSwapIndex] = replacement;
    setSelectedQuestions(updated);
    feedback.success(`Pregunta #${manualSwapIndex + 1} actualizada con la pregunta seleccionada.`);
    setManualSwapIndex(null);
    setSwapSearchTerm("");
  }

  const unusedQuestions = useMemo(() => {
    if (manualSwapIndex === null) return [];
    const selectedIds = new Set(selectedQuestions.map((q) => q.id));
    return eligiblePool.filter((q) => !selectedIds.has(q.id));
  }, [eligiblePool, selectedQuestions, manualSwapIndex]);

  const filteredUnusedQuestions = useMemo(() => {
    let list = unusedQuestions;
    if (swapDifficultyFilter !== "all") {
      list = list.filter((q) => (q.difficulty || "").toLowerCase() === swapDifficultyFilter.toLowerCase());
    }
    if (swapSearchTerm.trim()) {
      const term = swapSearchTerm.toLowerCase();
      list = list.filter((q) => (q.statement || "").toLowerCase().includes(term));
    }
    return list;
  }, [unusedQuestions, swapDifficultyFilter, swapSearchTerm]);

  const remainingUnusedCount = useMemo(() => {
    const selectedIds = new Set(selectedQuestions.map((q) => q.id));
    return eligiblePool.filter((q) => !selectedIds.has(q.id)).length;
  }, [eligiblePool, selectedQuestions]);

  async function publishExam() {
    if (!publishTarget) return;
    if (selectedQuestions.length === 0) {
      showError("No hay preguntas seleccionadas para publicar.");
      return;
    }
    setPublishing(true);
    setPublishMessage(null);

    try {
      const accessCode = await publishExamToFirestore(publishTarget, selectedQuestions);
      setPublishMessage(`Examen publicado. Código de acceso: ${accessCode}`);
      feedback.success(`Examen publicado con código ${accessCode}.`);
      setPublishOpen(false);
      setPublishTarget(null);
    } catch {
      showError("No fue posible publicar el examen.");
    } finally {
      setPublishing(false);
    }
  }

  return {
    publishOpen,
    publishTarget,
    publishing,
    publishMessage,
    previewLoading,
    previewError,
    eligiblePool,
    selectedQuestions,
    activeQuestionIndex,
    previewViewMode,
    manualSwapIndex,
    swapSearchTerm,
    swapDifficultyFilter,
    showDocsPreview,
    filteredUnusedQuestions,
    remainingUnusedCount,
    openPublish,
    closePublishModal,
    reShuffleAll,
    handleQuickSwap,
    handleSelectReplacement,
    setActiveQuestionIndex,
    setPreviewViewMode,
    setManualSwapIndex,
    setSwapSearchTerm,
    setSwapDifficultyFilter,
    setShowDocsPreview,
    publishExam,
  };
}
