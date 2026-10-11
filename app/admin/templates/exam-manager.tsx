"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  doc,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { normalizeSentenceText } from "@/lib/text/normalize";
import {
  LayoutGrid,
  Table2,
  Filter,
  SquarePen,
  Plus,
  Save,
  X,
  Power,
  Trash2,
  SendHorizontal,
  KeyRound,
  Eye,
  RefreshCw,
  ArrowLeftRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Search,
  BookOpen,
  Clock,
  Layers,
  FileText,
} from "lucide-react";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";
import { IconButton } from "@/app/admin/ui/icon-button";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError, reportFormSuccess } from "@/lib/form-feedback";

import type { CatalogItem, ExamTemplateRow, PublishedRef, PreviewQuestion } from "@/types";

function normalizeStatementMarkdown(statement: string) {
  const raw = typeof statement === "string" ? statement : "";
  if (!raw.includes("```")) return raw;
  return raw
    .replace(/```(\w+)[ \t]+/g, "```$1\n")
    .replace(/([^\n])```/g, "$1\n```");
}

function getQuestionTypeLabel(type?: string) {
  switch (type) {
    case "single_choice":
      return "Selección única";
    case "multiple_choice":
      return "Selección múltiple";
    case "puzzle_order":
      return "Ordenar";
    case "puzzle_match":
      return "Emparejar";
    case "puzzle_blank":
      return "Completar espacios";
    case "open_text":
      return "Texto libre";
    default:
      return type || "Pregunta";
  }
}

function getDifficultyBadge(diff?: string) {
  switch (diff?.toLowerCase()) {
    case "easy":
    case "fácil":
    case "facil":
      return { label: "Fácil", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "medium":
    case "media":
      return { label: "Media", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "hard":
    case "difícil":
    case "dificil":
      return { label: "Difícil", cls: "bg-rose-50 text-rose-700 border-rose-200" };
    default:
      return { label: diff || "General", cls: "bg-zinc-50 text-zinc-700 border-zinc-200" };
  }
}

function momentRank(id: unknown) {
  const s = typeof id === "string" ? id.trim().toLowerCase() : "";
  const m = /^m(\d+)$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function buildExamName(params: {
  subject?: string;
  group?: string;
  site?: string;
  shift?: string;
  moment?: string;
}) {
  const parts = [params.site, params.subject, params.group, params.shift, params.moment].filter(Boolean);
  return parts.join(" - ") || "Nuevo examen";
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer el archivo."));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  });
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-800">{label}</p>
        {description ? <p className="truncate text-xs text-zinc-500">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          value ? "bg-zinc-900" : "bg-zinc-200"
        }`}
        aria-pressed={value}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            value ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export function ExamManager() {
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

  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [institution, setInstitution] = useState<"CESDE" | "SENA">("CESDE");
  const [momentId, setMomentId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [questionCount, setQuestionCount] = useState(45);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [active, setActive] = useState(true);
  const [fraudEnabled, setFraudEnabled] = useState(true);
  const [documentationMarkdown, setDocumentationMarkdown] = useState("");
  const [docFileName, setDocFileName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    try {
      const raw = localStorage.getItem("zse:adminTemplatesView");
      return raw === "cards" ? "cards" : "table";
    } catch {
      return "table";
    }
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [filterMomentId, setFilterMomentId] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("");
  const [filterShiftId, setFilterShiftId] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterPublished, setFilterPublished] = useState<"all" | "published" | "not_published">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamTemplateRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<ExamTemplateRow | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishedByTemplate, setPublishedByTemplate] = useState<Record<string, PublishedRef>>({});

  // Preview & exam adjustments state
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

  const subjectName = namesById.get(`subjects:${subjectId}`) ?? "";
  const groupName =
    (institution === "SENA" ? namesById.get(`fichas:${groupId}`) : namesById.get(`groups:${groupId}`)) ?? "";
  const momentName = namesById.get(`moments:${momentId}`) ?? "";
  const siteName = namesById.get(`sites:${siteId}`) ?? "";
  const shiftName = namesById.get(`shifts:${shiftId}`) ?? "";

  const autoName = useMemo(
    () =>
      buildExamName({
        subject: subjectName,
        group: groupName,
        site: siteName,
        shift: shiftName,
        moment: momentName,
      }),
    [subjectName, momentName, groupName, siteName, shiftName],
  );

  function showError(message: string) {
    return reportFormError({ message, feedback, setMessage: setError });
  }

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setError(null);
      try {
        const [subjectsSnap, groupsSnap, fichasSnap, momentsSnap, sitesSnap, shiftsSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(200))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(200))),
          getDocs(query(collection(firestore, "fichas"), orderBy("name"), limit(600))),
          getDocs(query(collection(firestore, "moments"), orderBy("name"), limit(50))),
          getDocs(query(collection(firestore, "sites"), orderBy("name"), limit(50))),
          getDocs(query(collection(firestore, "shifts"), orderBy("name"), limit(50))),
        ]);

        if (cancelled) return;

        setSubjects(subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setGroups(groupsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setFichas(fichasSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setMoments(momentsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setSites(sitesSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setShifts(shiftsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
      } catch {
        if (!cancelled) setError("No fue posible cargar catalogos. Revisa reglas/permisos.");
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

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
        setError("No fue posible leer examenes. Revisa reglas/permisos de Firestore.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  async function importDocumentationFile(file: File) {
    setError(null);
    try {
      if (file.size > 1024 * 1024) {
        showError("El archivo es muy grande. Maximo recomendado: 1MB.");
        return;
      }
      const text = await readFileAsText(file);
      setDocumentationMarkdown(text);
      setDocFileName(file.name);
    } catch {
      showError("No fue posible cargar el archivo de documentacion.");
    }
  }

  async function createExamTemplate() {
    if (!shiftId || !siteId || !momentId || !groupId || !subjectId) {
      showError(`Completa Materia, ${institution === "SENA" ? "Ficha" : "Grupo"}, Momento, Sede y Jornada.`);
      return;
    }
    if (!Number.isFinite(questionCount) || questionCount < 1 || questionCount > 200) {
      showError("La cantidad de preguntas debe estar entre 1 y 200.");
      return;
    }
    if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 240) {
      showError("Tiempo inválido. Rango recomendado: 1 a 240 minutos.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const nameRes = normalizeSentenceText(autoName);
      if (!nameRes.ok) {
        showError(nameRes.error);
        return;
      }
      await addDoc(collection(firestore, "examTemplates"), {
        name: nameRes.value,
        institution,
        subjectId,
        groupId,
        momentId,
        siteId,
        shiftId,
        questionCount,
        timeLimitMinutes,
        documentationMarkdown: documentationMarkdown.trim(),
        fraudEnabled,
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
        active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setQuestionCount(45);
      setTimeLimitMinutes(60);
      setActive(true);
      setFraudEnabled(true);
      setDocumentationMarkdown("");
      setDocFileName(null);
      setCreateOpen(false);
      feedback.success("Examen creado correctamente.");
    } catch {
      showError("No fue posible crear el examen. Revisa permisos o conexion.");
    } finally {
      setCreating(false);
    }
  }

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

  function shuffleArray<T>(arr: T[]) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  async function generateUniqueAccessCode() {
    for (let i = 0; i < 15; i += 1) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const snap = await getDocs(query(collection(firestore, "publishedExams"), where("accessCode", "==", code), limit(1)));
      if (snap.empty) return code;
    }
    throw new Error("No fue posible generar un codigo unico.");
  }

  async function openPublish(row: ExamTemplateRow) {
    setPublishTarget(row);
    setPublishMessage(null);
    setError(null);
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
      const questionSnap = await getDocs(
        query(
          collection(firestore, "questions"),
          where("subjectId", "==", row.subjectId),
          where("status", "==", "published"),
          limit(1200),
        ),
      );

      const candidates = questionSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      })) as PreviewQuestion[];

      if (candidates.length === 0) {
        setPreviewError(
          `No se encontraron preguntas publicadas para la materia seleccionada (${publishSubjectName}). ID esperado: ${row.subjectId}. Verifica que las preguntas importadas usen exactamente ese subjectId y que el catálogo de materias sea la fuente de verdad.`,
        );
        return;
      }

      const examRank = momentRank(row.momentId);
      const eligible = candidates.filter((q) => {
        const momentIds = Array.isArray(q.momentIds)
          ? (q.momentIds as unknown[])
          : typeof q.momentIds === "string"
            ? [q.momentIds]
            : typeof q.momentId === "string"
              ? [q.momentId]
              : [];

        if (momentIds.length === 0) {
          return true;
        }

        if (examRank === null) {
          return momentIds.includes(row.momentId);
        }

        return momentIds.some((m) => {
          const r = momentRank(m);
          return r !== null && r <= examRank;
        });
      });

      if (eligible.length < row.questionCount) {
        setPreviewError(
          `No hay suficientes preguntas para publicar para este examen. En materia: ${candidates.length}, en momento (regla Mx): ${eligible.length}. Requeridas: ${row.questionCount}.`,
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
    setError(null);
    setPublishMessage(null);

    try {
      const accessCode = await generateUniqueAccessCode();

      const publishedRef = await addDoc(collection(firestore, "publishedExams"), {
        templateId: publishTarget.id,
        templateName: publishTarget.name,
        name: publishTarget.name,
        institution: publishTarget.institution,
        subjectId: publishTarget.subjectId,
        groupId: publishTarget.groupId,
        momentId: publishTarget.momentId,
        siteId: publishTarget.siteId,
        shiftId: publishTarget.shiftId,
        questionCount: selectedQuestions.length,
        timeLimitMinutes: publishTarget.timeLimitMinutes || 60,
        documentationMarkdown: publishTarget.documentationMarkdown || "",
        fraudEnabled: publishTarget.fraudEnabled,
        accessCode,
        status: "published",
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(firestore);
      selectedQuestions.forEach((q, index) => {
        const qRef = doc(firestore, "publishedExams", publishedRef.id, "questions", q.id);
        batch.set(qRef, {
          ...q,
          questionId: q.id,
          order: index + 1,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();

      setPublishMessage(`Examen publicado. Codigo de acceso: ${accessCode}`);
      feedback.success(`Examen publicado con código ${accessCode}.`);
      setPublishOpen(false);
      setPublishTarget(null);
    } catch {
      showError("No fue posible publicar el examen.");
    } finally {
      setPublishing(false);
    }
  }

  function openEdit(row: ExamTemplateRow) {
    setError(null);
    setEditId(row.id);
    setInstitution(row.institution);
    setSubjectId(row.subjectId);
    setGroupId(row.groupId);
    setMomentId(row.momentId);
    setSiteId(row.siteId);
    setShiftId(row.shiftId);
    setQuestionCount(row.questionCount);
    setTimeLimitMinutes(row.timeLimitMinutes || 60);
    setActive(row.active);
    setFraudEnabled(row.fraudEnabled);
    setDocumentationMarkdown(row.documentationMarkdown || "");
    setDocFileName(null);
    setEditOpen(true);
  }

  async function openDelete(row: ExamTemplateRow) {
    setError(null);
    setDeleteTarget(row);
    setDeleteConfirm("");
    setDeleteBlockReason(null);
    setDeleteOpen(true);

    try {
      const [byExamTemplateId, byTemplateId] = await Promise.all([
        getCountFromServer(
          query(collection(firestore, "attempts"), where("examTemplateId", "==", row.id)),
        ),
        getCountFromServer(query(collection(firestore, "attempts"), where("templateId", "==", row.id))),
      ]);
      const total = byExamTemplateId.data().count + byTemplateId.data().count;
      if (total > 0) {
        setDeleteBlockReason("No se puede eliminar: existen intentos asociados a este examen.");
      }
    } catch {
      setDeleteBlockReason("No fue posible verificar intentos asociados. Revisa permisos.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteConfirm.trim().toUpperCase() !== "ELIMINAR") return;
    if (deleteBlockReason) return;

    setDeleting(true);
    setError(null);
    try {
      const publishedSnap = await getDocs(
        query(collection(firestore, "publishedExams"), where("templateId", "==", deleteTarget.id), limit(200)),
      );
      const publishedIds = publishedSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .filter((r) => toString((r as Record<string, unknown>).status, "published") === "published")
        .map((r) => (r as { id: string }).id);
      await Promise.all(
        publishedIds.map(async (id) => {
          await updateDoc(doc(firestore, "publishedExams", id), {
            status: "closed",
            closedAt: serverTimestamp(),
            closedReason: "template_deleted",
            updatedAt: serverTimestamp(),
          });
        }),
      );
      await deleteDoc(doc(firestore, "examTemplates", deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeleteConfirm("");
      feedback.success("Examen eliminado correctamente.");
    } catch {
      showError("No fue posible eliminar el examen. Revisa permisos.");
    } finally {
      setDeleting(false);
    }
  }

  async function saveEdit() {
    if (!editId) return;
    if (!subjectId || !siteId || !shiftId || !momentId || !groupId) {
      showError(`Completa Materia, ${institution === "SENA" ? "Ficha" : "Grupo"}, Momento, Sede y Jornada.`);
      return;
    }
    if (!Number.isFinite(questionCount) || questionCount < 1 || questionCount > 200) {
      showError("La cantidad de preguntas debe estar entre 1 y 200.");
      return;
    }
    if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 240) {
      showError("Tiempo inválido. Rango recomendado: 1 a 240 minutos.");
      return;
    }

    setEditing(true);
    setError(null);
    try {
      const nameRes = normalizeSentenceText(autoName);
      if (!nameRes.ok) {
        showError(nameRes.error);
        return;
      }
      await updateDoc(doc(firestore, "examTemplates", editId), {
        name: nameRes.value,
        institution,
        subjectId,
        groupId,
        momentId,
        siteId,
        shiftId,
        questionCount,
        timeLimitMinutes,
        documentationMarkdown: documentationMarkdown.trim(),
        active,
        fraudEnabled,
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
              documentationMarkdown: documentationMarkdown.trim(),
              fraudEnabled,
              questionCount,
              timeLimitMinutes,
              templateName: nameRes.value,
              name: nameRes.value,
              updatedAt: serverTimestamp(),
            });
          }),
      );
      setEditOpen(false);
      setEditId(null);
      reportFormSuccess({ message: "Examen actualizado correctamente.", feedback });
    } catch {
      showError("No fue posible guardar cambios del examen.");
    } finally {
      setEditing(false);
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const pub = publishedByTemplate[r.id];
      if (filterSubjectId && r.subjectId !== filterSubjectId) return false;
      if (filterGroupId && r.groupId !== filterGroupId) return false;
      if (filterMomentId && r.momentId !== filterMomentId) return false;
      if (filterSiteId && r.siteId !== filterSiteId) return false;
      if (filterShiftId && r.shiftId !== filterShiftId) return false;
      if (filterActive === "active" && !r.active) return false;
      if (filterActive === "inactive" && r.active) return false;
      if (filterPublished === "published" && !pub) return false;
      if (filterPublished === "not_published" && pub) return false;

      if (!q) return true;
      const subject = namesById.get(`subjects:${r.subjectId}`) ?? r.subjectId;
      const group =
        (r.institution === "SENA" ? namesById.get(`fichas:${r.groupId}`) : namesById.get(`groups:${r.groupId}`)) ??
        r.groupId;
      const moment = namesById.get(`moments:${r.momentId}`) ?? r.momentId;
      const site = namesById.get(`sites:${r.siteId}`) ?? r.siteId;
      const shift = namesById.get(`shifts:${r.shiftId}`) ?? r.shiftId;
      return (
        r.name.toLowerCase().includes(q) ||
        subject.toLowerCase().includes(q) ||
        group.toLowerCase().includes(q) ||
        moment.toLowerCase().includes(q) ||
        site.toLowerCase().includes(q) ||
        shift.toLowerCase().includes(q)
      );
    });
  }, [
    rows,
    search,
    namesById,
    publishedByTemplate,
    filterSubjectId,
    filterGroupId,
    filterMomentId,
    filterSiteId,
    filterShiftId,
    filterActive,
    filterPublished,
  ]);

  function clearFilters() {
    setFilterSubjectId("");
    setFilterGroupId("");
    setFilterMomentId("");
    setFilterSiteId("");
    setFilterShiftId("");
    setFilterActive("all");
    setFilterPublished("all");
  }

  function ActionIconButton({
    title,
    onClick,
    disabled,
    tone,
    children,
  }: {
    title: string;
    onClick: () => void;
    disabled?: boolean;
    tone: "neutral" | "primary" | "danger";
    children: React.ReactNode;
  }) {
    const base =
      "inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-50";
    const variant =
      tone === "danger"
        ? "text-rose-600 hover:bg-rose-50"
        : tone === "primary"
          ? "text-zinc-900 hover:bg-zinc-100"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${base} ${variant}`}
        aria-label={title}
        title={title}
      >
        {children}
      </button>
    );
  }

  useEffect(() => {
    try {
      localStorage.setItem("zse:adminTemplatesView", viewMode);
    } catch {}
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncViewport);
      return () => media.removeEventListener("change", syncViewport);
    }
    media.addListener(syncViewport);
    return () => media.removeListener(syncViewport);
  }, []);

  const effectiveViewMode = isMobile ? "cards" : viewMode;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Examenes</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Crea y administra examenes por jornada, sede, momento y grupo. Define cantidad de preguntas y activa/inactiva.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Buscar</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, grupo, sede..."
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 sm:w-72"
            />
          </label>
          {isMobile ? (
            <div className="inline-flex h-11 items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-600">
              En móvil se muestran cards
            </div>
          ) : (
            <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                  viewMode === "table" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
                aria-pressed={viewMode === "table"}
              >
                <Table2 className="h-4 w-4" />
                Tabla
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                  viewMode === "cards" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
                aria-pressed={viewMode === "cards"}
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
            </div>
          )}
          <IconButton
            onClick={() => setFiltersOpen((v) => !v)}
            className="h-11 w-11"
            aria-label="Filtros"
            title="Filtros"
          >
            <Filter className="h-5 w-5" />
          </IconButton>
          <IconButton
            variant="primary"
            onClick={() => {
              setTimeLimitMinutes(60);
              setDocumentationMarkdown("");
              setDocFileName(null);
              setInstitution("CESDE");
              setGroupId("");
              setFraudEnabled(true);
              setCreateOpen(true);
            }}
            className="h-11 w-11 shrink-0"
            aria-label="Crear examen"
            title="Crear examen"
          >
            <Plus className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      {filtersOpen ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Materia</span>
              <select
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
              >
                <option value="">Todas</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Grupo / Ficha</span>
              <select
                value={filterGroupId}
                onChange={(e) => setFilterGroupId(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
              >
                <option value="">Todos</option>
                <optgroup label="CESDE">
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="SENA">
                  {fichas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Momento</span>
              <select
                value={filterMomentId}
                onChange={(e) => setFilterMomentId(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
              >
                <option value="">Todos</option>
                {moments.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Sede</span>
              <select
                value={filterSiteId}
                onChange={(e) => setFilterSiteId(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
              >
                <option value="">Todas</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Jornada</span>
              <select
                value={filterShiftId}
                onChange={(e) => setFilterShiftId(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
              >
                <option value="">Todas</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Activo</span>
              <select
                value={filterActive}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === "all" || id === "active" || id === "inactive") setFilterActive(id);
                }}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Publicado</span>
              <select
                value={filterPublished}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === "all" || id === "published" || id === "not_published") setFilterPublished(id);
                }}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
              >
                <option value="all">Todos</option>
                <option value="published">Publicados</option>
                <option value="not_published">Sin publicar</option>
              </select>
            </label>
            <div className="flex items-end justify-end gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Limpiar filtros
              </button>
              <IconButton onClick={() => setFiltersOpen(false)} className="h-11 w-11" aria-label="Cerrar filtros" title="Cerrar filtros">
                <X className="h-5 w-5" />
              </IconButton>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {publishMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {publishMessage}
        </div>
      ) : null}

      <section className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 shadow-sm">
            Cargando examenes...
          </div>
        ) : filteredRows.length ? (
          effectiveViewMode === "cards" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredRows.map((row) => {
                const subject = (namesById.get(`subjects:${row.subjectId}`) ?? row.subjectId) || "N/A";
                const group =
                  ((row.institution === "SENA"
                    ? namesById.get(`fichas:${row.groupId}`)
                    : namesById.get(`groups:${row.groupId}`)) ??
                    row.groupId) ||
                  "N/A";
                const moment = (namesById.get(`moments:${row.momentId}`) ?? row.momentId) || "N/A";
                const site = (namesById.get(`sites:${row.siteId}`) ?? row.siteId) || "N/A";
                const shift = (namesById.get(`shifts:${row.shiftId}`) ?? row.shiftId) || "N/A";
                const pending = pendingCounts[row.id] ?? String(row.questionCount);
                const disabled = savingId === row.id;
                const pub = publishedByTemplate[row.id];

                return (
                  <article
                    key={row.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-tight text-zinc-950">
                          {row.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-600">
                          {subject} • {group}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {moment} • {shift} • {site}
                        </p>
                        {pub ? (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>{pub.accessCode}</span>
                            <span className="text-zinc-500">•</span>
                            <span className="uppercase">{pub.status}</span>
                          </div>
                        ) : null}
                        {row.documentationMarkdown.trim() ? (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                            Docs
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                          row.active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                        }`}
                      >
                        {row.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-zinc-700">Preguntas</span>
                        <input
                          value={pending}
                          onChange={(e) =>
                            setPendingCounts((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          onBlur={() => void saveQuestionCount(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                              void saveQuestionCount(row.id);
                            }
                          }}
                          className="h-8 w-20 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:opacity-50"
                          disabled={disabled}
                          inputMode="numeric"
                        />
                      </label>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <ActionIconButton title="Editar" tone="neutral" onClick={() => openEdit(row)} disabled={disabled}>
                          <SquarePen className="h-4 w-4" />
                        </ActionIconButton>
                        <ActionIconButton
                          title={row.active ? "Inactivar" : "Activar"}
                          tone={row.active ? "danger" : "neutral"}
                          onClick={() => toggleActive(row.id, !row.active)}
                          disabled={disabled}
                        >
                          <Power className="h-4 w-4" />
                        </ActionIconButton>
                        <ActionIconButton
                          title="Vista previa"
                          tone="neutral"
                          onClick={() => void openPublish(row)}
                          disabled={disabled}
                        >
                          <Eye className="h-4 w-4" />
                        </ActionIconButton>
                        <ActionIconButton
                          title="Publicar"
                          tone="primary"
                          onClick={() => void openPublish(row)}
                          disabled={disabled || !row.active}
                        >
                          <SendHorizontal className="h-4 w-4" />
                        </ActionIconButton>
                        <ActionIconButton title="Eliminar" tone="danger" onClick={() => void openDelete(row)} disabled={disabled}>
                          <Trash2 className="h-4 w-4" />
                        </ActionIconButton>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-1100px table-fixed text-left text-sm">
                <thead className="bg-zinc-50">
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="w-[34%] px-3 py-2">Nombre</th>
                    <th className="w-[24%] px-3 py-2">Segmentación</th>
                    <th className="w-[16%] px-3 py-2">Publicado</th>
                    <th className="w-[10%] px-3 py-2">Activo</th>
                    <th className="w-[8%] px-3 py-2">Preg.</th>
                    <th className="w-[10%] px-3 py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const subject = (namesById.get(`subjects:${row.subjectId}`) ?? row.subjectId) || "N/A";
                    const group =
                      ((row.institution === "SENA"
                        ? namesById.get(`fichas:${row.groupId}`)
                        : namesById.get(`groups:${row.groupId}`)) ??
                        row.groupId) ||
                      "N/A";
                    const moment = (namesById.get(`moments:${row.momentId}`) ?? row.momentId) || "N/A";
                    const site = (namesById.get(`sites:${row.siteId}`) ?? row.siteId) || "N/A";
                    const shift = (namesById.get(`shifts:${row.shiftId}`) ?? row.shiftId) || "N/A";
                    const pending = pendingCounts[row.id] ?? String(row.questionCount);
                    const disabled = savingId === row.id;
                    const pub = publishedByTemplate[row.id];
                    return (
                      <tr key={row.id} className="border-t border-zinc-100 align-top">
                        <td className="px-3 py-2">
                          <div className="whitespace-normal wrap-break-word font-medium text-zinc-950" title={row.name}>
                            {row.name}
                          </div>
                          {row.documentationMarkdown.trim() ? (
                            <div className="mt-1 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                              Docs
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-600">
                          <div className="whitespace-normal wrap-break-word">
                            {subject} • {group}
                          </div>
                          <div className="mt-1 whitespace-normal wrap-break-word text-zinc-500">
                            {moment} • {shift} • {site}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-700">
                          {pub ? (
                            <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                              <KeyRound className="h-3.5 w-3.5" />
                              <span>{pub.accessCode}</span>
                              <span className="text-zinc-500">•</span>
                              <span className="uppercase">{pub.status}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                              row.active
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                            }`}
                          >
                            {row.active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={pending}
                            onChange={(e) => setPendingCounts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                            onBlur={() => void saveQuestionCount(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                                void saveQuestionCount(row.id);
                              }
                            }}
                            className="h-9 w-20 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:opacity-50"
                            disabled={disabled}
                            inputMode="numeric"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <ActionIconButton title="Editar" tone="neutral" onClick={() => openEdit(row)} disabled={disabled}>
                              <SquarePen className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton
                              title={row.active ? "Inactivar" : "Activar"}
                              tone={row.active ? "danger" : "neutral"}
                              onClick={() => toggleActive(row.id, !row.active)}
                              disabled={disabled}
                            >
                              <Power className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton
                              title="Vista previa"
                              tone="neutral"
                              onClick={() => void openPublish(row)}
                              disabled={disabled}
                            >
                              <Eye className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton
                              title="Publicar"
                              tone="primary"
                              onClick={() => void openPublish(row)}
                              disabled={disabled || !row.active}
                            >
                              <SendHorizontal className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton title="Eliminar" tone="danger" onClick={() => void openDelete(row)} disabled={disabled}>
                              <Trash2 className="h-4 w-4" />
                            </ActionIconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 shadow-sm">
            No hay examenes creados aun.
          </div>
        )}
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setCreateOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Crear examen</h2>
                <p className="text-sm text-zinc-500">Completa los campos y guarda.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="hidden"
              >
                Cerrar
              </button>
              <IconButton
                onClick={() => setCreateOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Institución</span>
                <select
                  value={institution}
                  onChange={(e) => {
                    const next = e.target.value === "SENA" ? "SENA" : "CESDE";
                    setInstitution(next);
                    setGroupId("");
                  }}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="CESDE">CESDE</option>
                  <option value="SENA">SENA</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Materia</span>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">{institution === "SENA" ? "Ficha" : "Grupo"}</span>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {(institution === "SENA" ? fichas : groups).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Momento</span>
                <select
                  value={momentId}
                  onChange={(e) => setMomentId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {moments.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Sede</span>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Jornada</span>
                <select
                  value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold text-zinc-700">Nombre (automatico)</span>
                <div className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 flex items-center">
                  <span className="truncate">{autoName}</span>
                </div>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Cantidad de preguntas</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value || 0))}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Tiempo (min)</span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value || 0))}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <Toggle
                label="Activo"
                description="Si esta inactivo, no se deberia poder publicar."
                value={active}
                onChange={setActive}
              />
              <Toggle
                label="Modo fraude"
                description="Cuenta cambios de pestaña y copy/paste."
                value={fraudEnabled}
                onChange={setFraudEnabled}
              />

              <div className="grid gap-2 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-700">Documentacion (README.md)</p>
                    <p className="text-xs text-zinc-500">Se muestra al estudiante como pagina web explorables.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                      <input
                        type="file"
                        accept=".md,text/markdown,text/plain"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void importDocumentationFile(file);
                          e.currentTarget.value = "";
                        }}
                      />
                      Cargar archivo
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setDocumentationMarkdown("");
                        setDocFileName(null);
                      }}
                      className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {docFileName ? <p className="text-xs text-zinc-500">Archivo: {docFileName}</p> : null}

                <textarea
                  value={documentationMarkdown}
                  onChange={(e) => {
                    setDocumentationMarkdown(e.target.value);
                    setDocFileName(null);
                  }}
                  placeholder="# Documentacion\n\nPega aqui el contenido del README en Markdown..."
                  className="min-h-40 w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <IconButton
                variant="primary"
                onClick={createExamTemplate}
                disabled={creating}
                className="h-10 w-10"
                aria-label="Guardar examen"
                title={creating ? "Creando..." : "Guardar examen"}
              >
                <Save className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setEditOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Editar examen</h2>
                <p className="text-sm text-zinc-500">Actualiza nombre, jornada, grupo y momento.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="hidden"
              >
                Cerrar
              </button>
              <IconButton
                onClick={() => setEditOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold text-zinc-700">Nombre (automatico)</span>
                <div className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 flex items-center">
                  <span className="truncate">{autoName}</span>
                </div>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Institución</span>
                <select
                  value={institution}
                  onChange={(e) => {
                    const next = e.target.value === "SENA" ? "SENA" : "CESDE";
                    setInstitution(next);
                    setGroupId("");
                  }}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="CESDE">CESDE</option>
                  <option value="SENA">SENA</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Jornada</span>
                <select
                  value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">{institution === "SENA" ? "Ficha" : "Grupo"}</span>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {(institution === "SENA" ? fichas : groups).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Momento</span>
                <select
                  value={momentId}
                  onChange={(e) => setMomentId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {moments.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Sede</span>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Cantidad de preguntas</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value || 0))}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Tiempo (min)</span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value || 0))}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <Toggle
                label="Activo"
                description="Si esta inactivo, no se deberia poder publicar."
                value={active}
                onChange={setActive}
              />
              <Toggle
                label="Modo fraude"
                description="Cuenta cambios de pestaña y copy/paste."
                value={fraudEnabled}
                onChange={setFraudEnabled}
              />

              <div className="grid gap-2 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-700">Documentacion (README.md)</p>
                    <p className="text-xs text-zinc-500">Se muestra al estudiante como pagina web explorables.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                      <input
                        type="file"
                        accept=".md,text/markdown,text/plain"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void importDocumentationFile(file);
                          e.currentTarget.value = "";
                        }}
                      />
                      Cargar archivo
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setDocumentationMarkdown("");
                        setDocFileName(null);
                      }}
                      className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {docFileName ? <p className="text-xs text-zinc-500">Archivo: {docFileName}</p> : null}

                <textarea
                  value={documentationMarkdown}
                  onChange={(e) => {
                    setDocumentationMarkdown(e.target.value);
                    setDocFileName(null);
                  }}
                  placeholder="# Documentacion\n\nPega aqui el contenido del README en Markdown..."
                  className="min-h-40 w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <IconButton
                variant="primary"
                onClick={saveEdit}
                disabled={editing}
                className="h-10 w-10"
                aria-label="Guardar cambios"
                title={editing ? "Guardando..." : "Guardar cambios"}
              >
                <Save className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen && deleteTarget ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setDeleteOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
                  Eliminar examen
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Esta accion es permanente.
                </p>
              </div>
              <IconButton
                onClick={() => setDeleteOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="truncate text-sm font-semibold text-zinc-900">{deleteTarget.name}</p>
              <p className="mt-1 truncate text-xs text-zinc-600">
                ID interno oculto
              </p>
            </div>

            {deleteBlockReason ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {deleteBlockReason}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Escribe <strong>ELIMINAR</strong> para confirmar.
              </div>
            )}

            <div className="mt-4 grid gap-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Confirmacion</span>
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  placeholder="ELIMINAR"
                  disabled={!!deleteBlockReason || deleting}
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <IconButton
                  onClick={() => setDeleteOpen(false)}
                  className="h-10 w-10"
                  aria-label="Cancelar"
                  title="Cancelar"
                  disabled={deleting}
                >
                  <X className="h-4 w-4" />
                </IconButton>
                <IconButton
                  variant="danger"
                  onClick={confirmDelete}
                  className="h-10 w-10"
                  aria-label="Eliminar definitivamente"
                  title={deleting ? "Eliminando..." : "Eliminar definitivamente"}
                  disabled={
                    deleting ||
                    !!deleteBlockReason ||
                    deleteConfirm.trim().toUpperCase() !== "ELIMINAR"
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {publishOpen && publishTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            onClick={() => setPublishOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            aria-label="Cerrar"
          />
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-zinc-200 bg-white shadow-2xl overflow-hidden">
            {/* Header del Modal */}
            <div className="border-b border-zinc-100 bg-zinc-50/70 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                      <Eye className="h-3.5 w-3.5" />
                      Vista Previa de Examen
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">
                      {publishTarget.institution}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold tracking-tight text-zinc-950 sm:text-xl truncate">
                    {publishTarget.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    Revisa las preguntas que integrarán el examen, cámbialas si lo requieres y confirma la publicación.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    onClick={() => setPublishOpen(false)}
                    className="h-9 w-9 shrink-0"
                    aria-label="Cerrar"
                    title="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>

              {/* Badges de resumen rápido */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="font-medium text-zinc-900">
                    {namesById.get(`subjects:${publishTarget.subjectId}`) ?? publishTarget.subjectId}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  <Clock className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{publishTarget.timeLimitMinutes || 60} minutos</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  <Layers className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{selectedQuestions.length} de {publishTarget.questionCount} preguntas</span>
                </div>
                {eligiblePool.length > 0 ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 font-medium">
                    <span>{remainingUnusedCount} en reserva en banco</span>
                  </div>
                ) : null}

                {eligiblePool.length >= publishTarget.questionCount && !previewLoading ? (
                  <button
                    type="button"
                    onClick={reShuffleAll}
                    disabled={publishing}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-100 transition disabled:opacity-50"
                    title="Generar una nueva combinación aleatoria con preguntas del banco"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Re-mezclar todas
                  </button>
                ) : null}
              </div>
            </div>

            {/* Contenido principal con scroll */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-9 w-9 animate-spin rounded-full border-3 border-zinc-900 border-t-transparent" />
                  <p className="mt-4 text-sm font-semibold text-zinc-900">
                    Cargando preguntas elegibles del banco...
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Filtrando por materia y momento académico correspondiente.
                  </p>
                </div>
              ) : previewError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-rose-950">Atención al generar la vista previa</h3>
                      <p className="mt-1 text-rose-800 text-xs sm:text-sm leading-relaxed">{previewError}</p>
                    </div>
                  </div>
                </div>
              ) : selectedQuestions.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                  No hay preguntas seleccionadas para previsualizar.
                </div>
              ) : (
                <>
                  {/* Selector y modo de vista */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5">
                    {/* Botones de navegación 1..N */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
                      {selectedQuestions.map((_, idx) => {
                        const isActive = previewViewMode === "single" && activeQuestionIndex === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setActiveQuestionIndex(idx);
                              setPreviewViewMode("single");
                            }}
                            className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
                              isActive
                                ? "bg-zinc-900 text-white shadow-xs"
                                : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Switcher de vista: Individual vs Lista Completa */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-zinc-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setPreviewViewMode("single")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition ${
                          previewViewMode === "single"
                            ? "bg-zinc-900 text-white shadow-2xs"
                            : "text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        Una a una
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewViewMode("all")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition ${
                          previewViewMode === "all"
                            ? "bg-zinc-900 text-white shadow-2xs"
                            : "text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        Ver todas ({selectedQuestions.length})
                      </button>
                    </div>
                  </div>

                  {/* Renderizado de preguntas */}
                  {previewViewMode === "single" ? (
                    (() => {
                      const q = selectedQuestions[activeQuestionIndex];
                      if (!q) return null;
                      const diffBadge = getDifficultyBadge(q.difficulty);

                      return (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-2xs">
                          {/* Encabezado de la pregunta */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-900">
                                Pregunta {activeQuestionIndex + 1} de {selectedQuestions.length}
                              </span>
                              <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                                {getQuestionTypeLabel(q.type)}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${diffBadge.cls}`}
                              >
                                {diffBadge.label}
                              </span>
                              <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                                {q.points ?? 1} pt{((q.points ?? 1) !== 1 ? "s" : "")}
                              </span>
                            </div>

                            {/* Acciones de reemplazo */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleQuickSwap(activeQuestionIndex)}
                                disabled={remainingUnusedCount === 0 || publishing}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-40"
                                title="Reemplazar por otra pregunta aleatoria del banco"
                              >
                                <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
                                Cambiar al azar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setManualSwapIndex(activeQuestionIndex);
                                  setSwapSearchTerm("");
                                  setSwapDifficultyFilter("all");
                                }}
                                disabled={remainingUnusedCount === 0 || publishing}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 transition disabled:opacity-40"
                                title="Seleccionar pregunta específica del banco de preguntas"
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                                Elegir del banco...
                              </button>
                            </div>
                          </div>

                          {/* Enunciado de la pregunta con MarkdownViewer */}
                          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                              Enunciado:
                            </p>
                            <MarkdownViewer
                              markdown={normalizeStatementMarkdown(q.statement || "Sin enunciado")}
                              className="prose-sm max-w-none text-zinc-900 leading-relaxed"
                            />
                          </div>

                          {/* Opciones de respuesta */}
                          {Array.isArray(q.options) && q.options.length > 0 ? (
                            <div className="mt-4 space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                Opciones de respuesta (la respuesta correcta está destacada):
                              </p>
                              <div className="grid gap-2">
                                {q.options.map((opt, optIdx) => {
                                  const letter = String.fromCharCode(65 + optIdx);
                                  const isCorrect = Boolean(opt.isCorrect);
                                  return (
                                    <div
                                      key={opt.id || optIdx}
                                      className={`flex items-start gap-3 rounded-xl border p-3 text-xs sm:text-sm transition ${
                                        isCorrect
                                          ? "border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium ring-1 ring-emerald-300/60"
                                          : "border-zinc-200 bg-white text-zinc-700"
                                      }`}
                                    >
                                      <span
                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                          isCorrect
                                            ? "bg-emerald-600 text-white"
                                            : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                      <div className="flex-1 min-w-0 pt-0.5 leading-snug">
                                        <MarkdownViewer markdown={opt.text} className="prose-sm max-w-none" />
                                      </div>
                                      {isCorrect ? (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          Correcta
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          {/* Puzzles u otros tipos si aplican */}
                          {q.type === "puzzle_order" && q.puzzle ? (
                            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                              <p className="font-semibold text-zinc-900 mb-2">Orden correcto de elementos:</p>
                              <div className="space-y-1.5">
                                {(((q.puzzle.items as Array<Record<string, unknown>>) ?? [])).map((item, iIdx) => (
                                  <div key={iIdx} className="flex items-center gap-2 rounded-lg bg-white border border-zinc-200 p-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800 text-[11px] font-bold text-white">
                                      {iIdx + 1}
                                    </span>
                                    <span>{String(item.text ?? item.content ?? "")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Navegación anterior / siguiente */}
                          <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3">
                            <button
                              type="button"
                              onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                              disabled={activeQuestionIndex === 0}
                              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-40"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Anterior
                            </button>
                            <span className="text-xs text-zinc-500 font-medium">
                              {activeQuestionIndex + 1} / {selectedQuestions.length}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveQuestionIndex((prev) =>
                                  Math.min(selectedQuestions.length - 1, prev + 1),
                                )
                              }
                              disabled={activeQuestionIndex === selectedQuestions.length - 1}
                              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-40"
                            >
                              Siguiente
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    /* Vista completa de todas las preguntas */
                    <div className="space-y-4">
                      {selectedQuestions.map((q, idx) => {
                        const diffBadge = getDifficultyBadge(q.difficulty);
                        return (
                          <div key={q.id || idx} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-900">
                                  Pregunta {idx + 1}
                                </span>
                                <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                                  {getQuestionTypeLabel(q.type)}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${diffBadge.cls}`}
                                >
                                  {diffBadge.label}
                                </span>
                                <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                                  {q.points ?? 1} pt{((q.points ?? 1) !== 1 ? "s" : "")}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleQuickSwap(idx)}
                                  disabled={remainingUnusedCount === 0 || publishing}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-40"
                                  title="Reemplazar por otra al azar"
                                >
                                  <RefreshCw className="h-3 w-3 text-zinc-500" />
                                  Al azar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setManualSwapIndex(idx);
                                    setSwapSearchTerm("");
                                    setSwapDifficultyFilter("all");
                                  }}
                                  disabled={remainingUnusedCount === 0 || publishing}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 transition disabled:opacity-40"
                                  title="Elegir del banco..."
                                >
                                  <ArrowLeftRight className="h-3 w-3" />
                                  Elegir...
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3">
                              <MarkdownViewer
                                markdown={normalizeStatementMarkdown(q.statement || "Sin enunciado")}
                                className="prose-sm max-w-none text-zinc-900 leading-relaxed"
                              />
                            </div>

                            {Array.isArray(q.options) && q.options.length > 0 ? (
                              <div className="mt-3 space-y-1.5">
                                {q.options.map((opt, optIdx) => {
                                  const letter = String.fromCharCode(65 + optIdx);
                                  const isCorrect = Boolean(opt.isCorrect);
                                  return (
                                    <div
                                      key={opt.id || optIdx}
                                      className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition ${
                                        isCorrect
                                          ? "border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium"
                                          : "border-zinc-200 bg-white text-zinc-700"
                                      }`}
                                    >
                                      <span
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                                          isCorrect
                                            ? "bg-emerald-600 text-white"
                                            : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                      <span className="flex-1 min-w-0 pt-0.5">{opt.text}</span>
                                      {isCorrect ? (
                                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-800">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Correcta
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Documentación / Temario adjunto si existe */}
                  {publishTarget.documentationMarkdown ? (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-zinc-600" />
                          <span className="text-xs font-semibold text-zinc-900">
                            Documentación / Guía adjunta al examen
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDocsPreview(!showDocsPreview)}
                          className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 underline"
                        >
                          {showDocsPreview ? "Ocultar" : "Mostrar documento"}
                        </button>
                      </div>
                      {showDocsPreview ? (
                        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 max-h-60 overflow-y-auto">
                          <MarkdownViewer
                            markdown={publishTarget.documentationMarkdown}
                            className="prose-sm max-w-none text-zinc-800"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {/* Selector manual de reemplazo (Overlay modal) */}
            {manualSwapIndex !== null ? (
              <div className="absolute inset-0 z-20 flex flex-col bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-zinc-950">
                      Reemplazar Pregunta #{manualSwapIndex + 1}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Selecciona una pregunta disponible del banco para esta materia y momento académico.
                    </p>
                  </div>
                  <IconButton
                    onClick={() => setManualSwapIndex(null)}
                    className="h-8 w-8"
                    aria-label="Cerrar selector"
                  >
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>

                {/* Filtro y buscador */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      value={swapSearchTerm}
                      onChange={(e) => setSwapSearchTerm(e.target.value)}
                      placeholder="Buscar por texto del enunciado..."
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-xs outline-none focus:border-zinc-400 focus:bg-white transition"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {(["all", "easy", "medium", "hard"] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setSwapDifficultyFilter(diff)}
                        className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
                          swapDifficultyFilter === diff
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        {diff === "all" ? "Todas" : diff === "easy" ? "Fácil" : diff === "medium" ? "Media" : "Difícil"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista de preguntas disponibles */}
                <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {filteredUnusedQuestions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-500">
                      No se encontraron preguntas disponibles con los filtros actuales.
                    </div>
                  ) : (
                    filteredUnusedQuestions.map((candidate) => {
                      const diffBadge = getDifficultyBadge(candidate.difficulty);
                      return (
                        <div
                          key={candidate.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3.5 hover:bg-zinc-50 hover:border-zinc-300 transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                                {getQuestionTypeLabel(candidate.type)}
                              </span>
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${diffBadge.cls}`}
                              >
                                {diffBadge.label}
                              </span>
                              <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                                {candidate.points ?? 1} pt(s)
                              </span>
                            </div>
                            <p className="line-clamp-2 text-xs text-zinc-800 leading-relaxed">
                              {candidate.statement || "Sin enunciado"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectReplacement(candidate)}
                            className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 transition"
                          >
                            Seleccionar
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-3 border-t border-zinc-100 pt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setManualSwapIndex(null)}
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            {/* Footer del Modal */}
            <div className="border-t border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">
                {selectedQuestions.length > 0 ? (
                  <span>
                    Total: <strong className="text-zinc-900 font-semibold">{selectedQuestions.length} preguntas</strong> listas para publicar.
                  </span>
                ) : (
                  <span>Configuración de examen</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPublishOpen(false)}
                  disabled={publishing}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-100 transition disabled:opacity-50"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={publishExam}
                  disabled={publishing || previewLoading || selectedQuestions.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  <SendHorizontal className="h-4 w-4" />
                  {publishing ? "Publicando examen..." : "Confirmar y Publicar Examen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
