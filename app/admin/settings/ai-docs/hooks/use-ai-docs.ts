"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { useFeedback } from "@/app/feedback-provider";
import { buildExamName } from "@/app/admin/templates/services/exam-template-service";
import type {
  AiDocsTab,
  CatalogItem,
  ExamPipelineFormData,
  ReadmeTemplateId,
} from "../types";
import {
  CUSTOM_TEMPLATE_CRITERIA,
  STANDARD_DETAILED_TEMPLATE_CONTEXT,
  STANDARD_DETAILED_TEMPLATE_CRITERIA,
} from "../templates";
import {
  extractReadmeBatchMetadata,
  generateQuestionBatchApi,
  generateReadmeApi,
  toCatalogItem,
} from "../services/ai-docs-service";
import { useAcademicTopics } from "./use-academic-topics";
import {
  createExamFromPipeline,
  importBatchJsonToBank,
} from "../services/pipeline-exam-service";

export function useAiDocs() {
  const feedback = useFeedback();

  // Wizard active step: "readme" (Paso 1) | "batch" (Paso 2) | "exam" (Paso 3)
  const [tab, setTab] = useState<AiDocsTab>("readme");

  // Step 1: Readme config
  const [geminiVariant, setGeminiVariant] = useState<"flash" | "pro">("flash");
  const [readmeTemplate, setReadmeTemplate] = useState<ReadmeTemplateId>("custom");
  const [topics, setTopics] = useState("");
  const [criteria, setCriteria] = useState(CUSTOM_TEMPLATE_CRITERIA);
  const [audience, setAudience] = useState("Estudiantes de educación superior");
  const [context, setContext] = useState("");
  const [lengthHint, setLengthHint] = useState<"corta" | "media" | "larga">("media");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [markdown, setMarkdown] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("zse:ai:readmeMarkdown") ?? "";
    } catch {
      return "";
    }
  });

  const [readmeModelUsed, setReadmeModelUsed] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("zse:ai:readmeModelUsed");
    } catch {
      return null;
    }
  });

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Catalogs
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);
  const [moments, setMoments] = useState<CatalogItem[]>([]);
  const [sites, setSites] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Selections
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [momentId, setMomentId] = useState("");
  const [questionCount, setQuestionCount] = useState(45);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [allowedQuestionTypes, setAllowedQuestionTypes] = useState<string[]>([
    "single_choice",
    "multiple_choice",
    "open_concept",
  ]);

  // Step 2: Batch JSON
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [importingToBank, setImportingToBank] = useState(false);
  const [bankImportSuccessCount, setBankImportSuccessCount] = useState<number | null>(null);

  const [batchJson, setBatchJson] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("zse:ai:batchJson") ?? "";
    } catch {
      return "";
    }
  });

  const [batchModelUsed, setBatchModelUsed] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("zse:ai:batchModelUsed");
    } catch {
      return null;
    }
  });

  // Step 3: Exam creation
  const [examForm, setExamForm] = useState<ExamPipelineFormData>({
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
  });
  const [creatingExam, setCreatingExam] = useState(false);
  const [examResult, setExamResult] = useState<{ templateId: string; name: string } | null>(null);
  const [examError, setExamError] = useState<string | null>(null);

  const subjectName = useMemo(() => {
    return subjects.find((s) => s.id === subjectId)?.name ?? subjectId;
  }, [subjects, subjectId]);

  // Sub-hook: Auto-guardado y auto-carga de temarios por materia
  const {
    topicsList,
    loadingTopics,
    lastAutoSaved,
    autoSave,
    forceSaveNow,
  } = useAcademicTopics({
    subjectId,
    subjectName,
    onApplyTopics: (savedTopics, savedCriteria) => {
      setTopics(savedTopics);
      if (savedCriteria) setCriteria(savedCriteria);
    },
  });

  // Manejador para cuando el usuario escribe temas (guarda solo)
  function handleUpdateTopics(newTopics: string) {
    setTopics(newTopics);
    autoSave(newTopics, criteria);
  }

  function handleUpdateCriteria(newCriteria: string) {
    setCriteria(newCriteria);
    autoSave(topics, newCriteria);
  }

  // Storage persistence
  useEffect(() => {
    try {
      if (markdown) localStorage.setItem("zse:ai:readmeMarkdown", markdown);
      else localStorage.removeItem("zse:ai:readmeMarkdown");
    } catch {}
  }, [markdown]);

  useEffect(() => {
    try {
      if (readmeModelUsed) localStorage.setItem("zse:ai:readmeModelUsed", readmeModelUsed);
      else localStorage.removeItem("zse:ai:readmeModelUsed");
    } catch {}
  }, [readmeModelUsed]);

  useEffect(() => {
    try {
      if (batchJson) localStorage.setItem("zse:ai:batchJson", batchJson);
      else localStorage.removeItem("zse:ai:batchJson");
    } catch {}
  }, [batchJson]);

  useEffect(() => {
    try {
      if (batchModelUsed) localStorage.setItem("zse:ai:batchModelUsed", batchModelUsed);
      else localStorage.removeItem("zse:ai:batchModelUsed");
    } catch {}
  }, [batchModelUsed]);

  // Sincronizar selección de materia con examForm
  useEffect(() => {
    setExamForm((prev) => ({
      ...prev,
      subjectId: subjectId || prev.subjectId,
      groupId: groupId || prev.groupId,
      momentId: momentId || prev.momentId,
      questionCount: questionCount || prev.questionCount,
      timeLimitMinutes: timeLimitMinutes || prev.timeLimitMinutes,
    }));
  }, [subjectId, groupId, momentId, questionCount, timeLimitMinutes]);

  // Cargar catálogos
  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setCatalogError(null);
      try {
        const [
          subjectsSnap,
          groupsSnap,
          fichasSnap,
          momentsSnap,
          sitesSnap,
          shiftsSnap,
        ] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(200))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(200))),
          getDocs(query(collection(firestore, "fichas"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "moments"), orderBy("name"), limit(50))),
          getDocs(query(collection(firestore, "sites"), orderBy("name"), limit(50))),
          getDocs(query(collection(firestore, "shifts"), orderBy("name"), limit(50))),
        ]);
        if (cancelled) return;
        const subList = subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data()));
        setSubjects(subList);
        setGroups(groupsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setFichas(fichasSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setMoments(momentsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setSites(sitesSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setShifts(shiftsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));

        if (subList.length > 0 && !subjectId) {
          setSubjectId(subList[0].id);
        }
      } catch {
        if (!cancelled) setCatalogError("No fue posible cargar catálogos. Revisa reglas/permisos.");
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const canGenerate = useMemo(
    () => topics.trim().length > 0 && criteria.trim().length > 0 && !!subjectId && !loading,
    [topics, criteria, subjectId, loading],
  );

  const readmeBatchMetadata = useMemo(() => extractReadmeBatchMetadata(markdown), [markdown]);

  const canGenerateBatch = useMemo(() => {
    return !batchLoading && !!markdown.trim();
  }, [batchLoading, markdown]);

  async function generate() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return false;
    }

    if (!topics.trim()) {
      setError("Indica los temas que abordará la materia.");
      return false;
    }

    // Auto-guardar temario en Firestore para que nunca se pierda
    await forceSaveNow(topics, criteria);

    setLoading(true);
    setError(null);

    const activeSubName = subjects.find((s) => s.id === subjectId)?.name ?? subjectId;
    const activeGrpName = groups.find((g) => g.id === groupId)?.name ?? (groupId || "Grupo General");
    const activeMomName = moments.find((m) => m.id === momentId)?.name ?? (momentId || "M1");

    const result = await generateReadmeApi(user, {
      topics: topics.trim(),
      criteria: criteria.trim(),
      audience: audience.trim(),
      context: context.trim(),
      lengthHint,
      modelVariant: geminiVariant,
      readmeTemplate,
      subjectId,
      subjectName: activeSubName,
      groupId: groupId || "general",
      groupName: activeGrpName,
      momentId: momentId || "m1",
      momentName: activeMomName,
      questionCount,
      timeLimitMinutes,
      gradingScale: "0_50",
      allowedQuestionTypes,
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "No fue posible generar el README.");
      return false;
    }
    setReadmeModelUsed(result.modelUsed ?? null);
    setMarkdown(result.markdown ?? "");
    feedback.success("Documentación y temario generados exitosamente.");
    return true;
  }

  async function generateQuestionBatch() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setBatchError("Debes iniciar sesión como admin.");
      return false;
    }
    if (!markdown.trim()) {
      setBatchError("No hay documentación previa para generar preguntas.");
      return false;
    }

    setBatchLoading(true);
    setBatchError(null);

    const result = await generateQuestionBatchApi(
      user,
      geminiVariant,
      markdown,
      questionCount,
      allowedQuestionTypes,
    );
    setBatchLoading(false);

    if (!result.ok) {
      setBatchError(result.error ?? "No fue posible generar las preguntas.");
      return false;
    }
    setBatchModelUsed(result.modelUsed ?? null);
    const jsonStr = result.payload ? JSON.stringify(result.payload, null, 2) : "";
    setBatchJson(jsonStr);

    // Auto-guardar automáticamente las preguntas en el Banco de Firestore
    if (jsonStr) {
      try {
        const activeMom = momentId || "m1";
        const importRes = await importBatchJsonToBank(jsonStr, subjectId, activeMom);
        if (importRes.ok) {
          setBankImportSuccessCount(importRes.savedCount);
          feedback.success(`¡${importRes.savedCount} preguntas generadas y guardadas en el Banco de Preguntas!`);
          return true;
        }
      } catch (err) {
        console.error("Auto import error:", err);
      }
    }

    setBankImportSuccessCount(null);
    feedback.success("Preguntas generadas exitosamente con IA.");
    return true;
  }

  async function importToBank() {
    if (!batchJson) return;
    setImportingToBank(true);
    try {
      const activeMom = momentId || "m1";
      const res = await importBatchJsonToBank(batchJson, subjectId, activeMom);
      if (!res.ok) {
        feedback.error(res.error || "No fue posible importar preguntas al banco.");
        return;
      }
      setBankImportSuccessCount(res.savedCount);
      feedback.success(`¡Se guardaron ${res.savedCount} preguntas en el Banco exitosamente!`);
    } finally {
      setImportingToBank(false);
    }
  }

  function updateExamFormField<K extends keyof ExamPipelineFormData>(
    key: K,
    value: ExamPipelineFormData[K],
  ) {
    setExamForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "institution") {
        next.groupId = "";
      }
      return next;
    });
  }

  async function createExamTemplateFromPipeline() {
    setCreatingExam(true);
    setExamError(null);
    try {
      const activeSub = subjects.find((s) => s.id === examForm.subjectId)?.name ?? examForm.subjectId;
      const activeGrp =
        (examForm.institution === "SENA"
          ? fichas.find((f) => f.id === examForm.groupId)?.name
          : groups.find((g) => g.id === examForm.groupId)?.name) ?? examForm.groupId;
      const activeMom = moments.find((m) => m.id === examForm.momentId)?.name ?? examForm.momentId;
      const activeSit = sites.find((s) => s.id === examForm.siteId)?.name ?? examForm.siteId;
      const activeShf = shifts.find((s) => s.id === examForm.shiftId)?.name ?? examForm.shiftId;

      const autoName = buildExamName({
        subject: activeSub,
        group: activeGrp,
        site: activeSit,
        shift: activeShf,
        moment: activeMom,
      });

      // Garantizar que las preguntas generadas en el pipeline queden guardadas en el banco
      if (batchJson.trim()) {
        try {
          await importBatchJsonToBank(batchJson, examForm.subjectId, examForm.momentId || "m1");
        } catch (e) {
          console.error("Auto import error during exam creation:", e);
        }
      }

      const res = await createExamFromPipeline(examForm, autoName, markdown);
      if (!res.ok || !res.templateId) {
        setExamError(res.error || "Error al crear la plantilla del examen.");
        return false;
      }

      setExamResult({ templateId: res.templateId, name: res.name || autoName });
      feedback.success("¡Plantilla de examen creada y vinculada correctamente!");
      return true;
    } finally {
      setCreatingExam(false);
    }
  }

  function toggleAllowedType(type: string) {
    setAllowedQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  function applyReadmeTemplate(templateId: ReadmeTemplateId) {
    if (templateId === "custom") {
      setCriteria(CUSTOM_TEMPLATE_CRITERIA);
      setLengthHint("larga");
      return;
    }
    if (templateId === "standard_detailed_v1") {
      setCriteria(STANDARD_DETAILED_TEMPLATE_CRITERIA);
      setContext((prev) =>
        prev.trim() ? `${STANDARD_DETAILED_TEMPLATE_CONTEXT}\n\n${prev}` : STANDARD_DETAILED_TEMPLATE_CONTEXT,
      );
      setLengthHint("larga");
    }
  }

  function clearReadme() {
    setMarkdown("");
    setReadmeModelUsed(null);
    setError(null);
  }

  function clearBatch() {
    setBatchJson("");
    setBatchModelUsed(null);
    setBatchError(null);
    setBankImportSuccessCount(null);
  }

  return {
    tab,
    setTab,
    geminiVariant,
    setGeminiVariant,
    readmeTemplate,
    setReadmeTemplate,
    topics,
    criteria,
    audience,
    setAudience,
    context,
    setContext,
    lengthHint,
    setLengthHint,
    loading,
    error,
    markdown,
    setMarkdown,
    readmeModelUsed,
    previewModalOpen,
    setPreviewModalOpen,
    subjects,
    groups,
    fichas,
    moments,
    sites,
    shifts,
    catalogError,
    subjectId,
    setSubjectId,
    subjectName,
    groupId,
    setGroupId,
    momentId,
    setMomentId,
    questionCount,
    setQuestionCount,
    timeLimitMinutes,
    setTimeLimitMinutes,
    allowedQuestionTypes,
    toggleAllowedType,
    batchLoading,
    batchError,
    batchJson,
    batchModelUsed,
    importingToBank,
    bankImportSuccessCount,
    canGenerate,
    readmeBatchMetadata,
    canGenerateBatch,
    generate,
    generateQuestionBatch,
    importToBank,
    applyReadmeTemplate,
    clearReadme,
    clearBatch,
    // Auto-save topics
    lastAutoSaved,
    loadingTopics,
    topicsList,
    handleUpdateTopics,
    handleUpdateCriteria,
    // Step 3 exam
    examForm,
    creatingExam,
    examResult,
    examError,
    updateExamFormField,
    createExamTemplateFromPipeline,
  };
}
