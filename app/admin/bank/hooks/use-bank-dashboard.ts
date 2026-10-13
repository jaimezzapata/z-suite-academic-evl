"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import type {
  CatalogItem,
  BankDashboardStats,
  QuestionTableRow,
  EditQuestion,
  BankViewMode,
} from "../types";
import {
  BANK_CACHE_KEY,
  BANK_CACHE_TTL_MS,
  buildEmptyEditQuestion,
  deleteQuestionFromDb,
  fetchBankCatalogs,
  fetchBankMetricsFromFirestore,
  fetchBankSampleData,
  fetchBankTableRows,
  fetchQuestionDetails,
  saveQuestionToDb,
  wipeAllQuestionsApi,
} from "../services/bank-service";

export function useBankDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<BankViewMode>("table");

  // Catálogos
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [moments, setMoments] = useState<CatalogItem[]>([]);

  // Filtros globales para muestra/exploración
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedMomentId, setSelectedMomentId] = useState("");

  // Métricas y Resumen
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const [metricsWarning, setMetricsWarning] = useState<string | null>(null);

  const [data, setData] = useState<BankDashboardStats>({
    counts: { total: 0, published: 0, draft: 0, archived: 0 },
    byType: [],
    byDifficulty: [],
    topSubjects: [],
    topGroups: [],
    topMoments: [],
    quality: { missingStatus: 0, missingPoints: 0, missingGroups: 0, missingMoments: 0 },
    preview: [],
  });

  // Muestra interactiva en resumen
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(0);

  // Tabla completa
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableSource, setTableSource] = useState<QuestionTableRow[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const [tableStatus, setTableStatus] = useState("");
  const [tableType, setTableType] = useState("");
  const [tableDifficulty, setTableDifficulty] = useState("");

  // Edición / Creación
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<"edit" | "create">("edit");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState<EditQuestion | null>(null);
  const [saving, setSaving] = useState(false);

  // Eliminación individual
  const [pendingDelete, setPendingDelete] = useState<QuestionTableRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Vaciado total de la colección
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipingAll, setWipingAll] = useState(false);

  // Carga inicial de catálogos
  useEffect(() => {
    let cancelled = false;
    async function loadCatalogs() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchBankCatalogs();
        if (cancelled) return;
        setSubjects(res.subjects);
        setGroups(res.groups);
        setMoments(res.moments);
      } catch {
        if (!cancelled) setMetricsWarning("No fue posible cargar catálogos del banco en este momento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  // Carga de métricas para la vista Resumen
  useEffect(() => {
    if (view !== "summary") return;
    if (metricsLoading || metricsLoaded) return;

    let cancelled = false;

    async function loadMetrics() {
      setMetricsLoading(true);
      setMetricsWarning(null);
      try {
        try {
          const raw = localStorage.getItem(BANK_CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const at = typeof parsed.at === "number" ? parsed.at : 0;
            if (Date.now() - at < BANK_CACHE_TTL_MS) {
              const cachedCounts = parsed.counts as any;
              const cachedByType = parsed.byType as any;
              const cachedByDifficulty = parsed.byDifficulty as any;
              if (cachedCounts && cachedByType && cachedByDifficulty) {
                setData((prev) => ({
                  ...prev,
                  counts: cachedCounts,
                  byType: cachedByType,
                  byDifficulty: cachedByDifficulty,
                }));
                setMetricsLoaded(true);
                return;
              }
            }
          }
        } catch {}

        const res = await fetchBankMetricsFromFirestore();
        if (cancelled) return;

        if (res.hasFailures) {
          setMetricsWarning("Algunas métricas no pudieron cargarse. El listado de preguntas sigue disponible.");
        }

        setData((prev) => ({
          ...prev,
          counts: res.counts,
          byType: res.byType,
          byDifficulty: res.byDifficulty,
        }));
        setMetricsLoaded(true);

        try {
          localStorage.setItem(
            BANK_CACHE_KEY,
            JSON.stringify({
              at: Date.now(),
              counts: res.counts,
              byType: res.byType,
              byDifficulty: res.byDifficulty,
            }),
          );
        } catch {}
      } catch {
        if (!cancelled) {
          setMetricsWarning(
            "No fue posible cargar métricas del banco en este momento. El listado de preguntas sigue disponible.",
          );
        }
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    }

    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [metricsLoaded, metricsLoading, view]);

  // Carga de muestra para la vista Resumen
  useEffect(() => {
    if (view !== "summary" || loading) return;

    let cancelled = false;
    async function loadSample() {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const sample = await fetchBankSampleData(
          selectedSubjectId,
          selectedMomentId,
          subjects,
          groups,
          moments,
        );
        if (cancelled) return;
        setData((prev) => ({
          ...prev,
          preview: sample.preview,
          topSubjects: sample.topSubjects,
          topGroups: sample.topGroups,
          topMoments: sample.topMoments,
          quality: sample.quality,
        }));
      } catch {
        if (!cancelled) setPreviewError("No fue posible cargar la muestra de preguntas para explorar.");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    void loadSample();
    return () => {
      cancelled = true;
    };
  }, [groups, loading, moments, selectedMomentId, selectedSubjectId, subjects, view]);

  // Carga de filas para la tabla
  async function reloadTable() {
    setTableLoading(true);
    setTableError(null);
    try {
      const rows = await fetchBankTableRows(500);
      setTableSource(rows);
    } catch {
      setTableError("No fue posible cargar el listado de preguntas.");
    } finally {
      setTableLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "table") return;
    if (tableSource.length) return;
    void reloadTable();
  }, [tableSource.length, view]);

  // Filtros y paginación de la tabla
  const subjectNameById = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const momentNameById = useMemo(() => new Map(moments.map((m) => [m.id, m.name])), [moments]);

  const filteredTable = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return tableSource.filter((r) => {
      if (selectedSubjectId && r.subjectId !== selectedSubjectId) return false;
      if (selectedMomentId && !r.momentIds.includes(selectedMomentId)) return false;
      if (tableStatus && r.status !== tableStatus) return false;
      if (tableType && r.type !== tableType) return false;
      if (tableDifficulty && r.difficulty !== tableDifficulty) return false;
      if (q && !r.statement.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [selectedMomentId, selectedSubjectId, tableDifficulty, tableSearch, tableSource, tableStatus, tableType]);

  const tablePageSize = 20;
  const tablePageCount = Math.max(1, Math.ceil(filteredTable.length / tablePageSize));
  const pagedTable = useMemo(() => {
    const start = tablePage * tablePageSize;
    return filteredTable.slice(start, start + tablePageSize);
  }, [filteredTable, tablePage]);

  useEffect(() => {
    setTablePage(0);
  }, [selectedSubjectId, selectedMomentId, tableStatus, tableType, tableDifficulty, tableSearch]);

  useEffect(() => {
    if (tablePage <= tablePageCount - 1) return;
    setTablePage(Math.max(0, tablePageCount - 1));
  }, [tablePage, tablePageCount]);

  // Muestra paginada en resumen
  const filteredPreview = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.preview;
    return data.preview.filter((p) => p.statement.toLowerCase().includes(q));
  }, [data.preview, search]);

  const previewPageSize = 6;
  const previewPageCount = Math.max(1, Math.ceil(filteredPreview.length / previewPageSize));
  const pagedPreview = useMemo(() => {
    const start = previewPage * previewPageSize;
    return filteredPreview.slice(start, start + previewPageSize);
  }, [filteredPreview, previewPage]);

  useEffect(() => {
    setPreviewPage(0);
  }, [search]);

  useEffect(() => {
    if (previewPage <= previewPageCount - 1) return;
    setPreviewPage(Math.max(0, previewPageCount - 1));
  }, [previewPage, previewPageCount]);

  const statusSpark = useMemo(
    () => [data.counts.published, data.counts.draft, data.counts.archived],
    [data.counts],
  );

  // Acciones de edición
  async function openEdit(id: string) {
    setEditMode("edit");
    setEditOpen(true);
    setEditLoading(true);
    setEditError(null);
    try {
      const q = await fetchQuestionDetails(id);
      setEditQuestion(q);
    } catch {
      setEditError("No fue posible cargar la pregunta.");
    } finally {
      setEditLoading(false);
    }
  }

  function openCreate() {
    const ref = doc(collection(firestore, "questions"));
    setEditMode("create");
    setEditOpen(true);
    setEditLoading(false);
    setEditError(null);
    setEditQuestion(buildEmptyEditQuestion(ref.id, "single_choice", selectedMomentId || moments[0]?.id, selectedSubjectId));
  }

  function closeEdit() {
    if (saving) return;
    setEditOpen(false);
    setEditQuestion(null);
    setEditError(null);
    setEditMode("edit");
  }

  async function saveEdit() {
    if (!editQuestion) return;
    setSaving(true);
    setEditError(null);
    try {
      await saveQuestionToDb(editQuestion, editMode);

      setTableSource((prev) => {
        const nextRow: QuestionTableRow = {
          id: editQuestion.id,
          statement: editQuestion.statement.trim(),
          status: editQuestion.status,
          type: editQuestion.type,
          difficulty: editQuestion.difficulty,
          points: editQuestion.points,
          subjectId: editQuestion.subjectId,
          groupIds: editQuestion.groupIds,
          momentIds: editQuestion.momentIds,
          updatedAt: new Date(),
        };
        const exists = prev.some((x) => x.id === editQuestion.id);
        if (exists) return prev.map((x) => (x.id === editQuestion.id ? nextRow : x));
        return [nextRow, ...prev];
      });

      setData((prev) => ({
        ...prev,
        preview: prev.preview.some((p) => p.id === editQuestion.id)
          ? prev.preview.map((p) =>
              p.id === editQuestion.id
                ? {
                    ...p,
                    statement: editQuestion.statement.trim(),
                    status: editQuestion.status,
                    difficulty: editQuestion.difficulty,
                    points: editQuestion.points,
                    subjectId: editQuestion.subjectId,
                  }
                : p,
            )
          : [
              {
                id: editQuestion.id,
                statement: editQuestion.statement.trim(),
                status: editQuestion.status,
                type: editQuestion.type,
                difficulty: editQuestion.difficulty,
                points: editQuestion.points,
                subjectId: editQuestion.subjectId,
              },
              ...prev.preview,
            ],
      }));

      setEditOpen(false);
      setEditQuestion(null);
      setEditMode("edit");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No fue posible guardar la pregunta.";
      setEditError(msg);
    } finally {
      setSaving(false);
    }
  }

  // Acciones de eliminación
  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    setDeleteError(null);
    try {
      await deleteQuestionFromDb(pendingDelete.id);
      setTableSource((prev) => prev.filter((x) => x.id !== pendingDelete.id));
      setData((prev) => ({ ...prev, preview: prev.preview.filter((p) => p.id !== pendingDelete.id) }));
      setPendingDelete(null);
    } catch {
      setDeleteError("No fue posible eliminar la pregunta.");
    } finally {
      setDeletingId(null);
    }
  }

  async function wipeAllQuestions() {
    if (wipeConfirm.trim().toUpperCase() !== "ELIMINAR") return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      setWipeError("Debes iniciar sesión como admin.");
      return;
    }
    setWipingAll(true);
    setWipeError(null);
    try {
      const token = await user.getIdToken(true);
      await wipeAllQuestionsApi(token);

      setData({
        counts: { total: 0, published: 0, draft: 0, archived: 0 },
        byType: [],
        byDifficulty: [],
        topSubjects: [],
        topGroups: [],
        topMoments: [],
        quality: { missingStatus: 0, missingPoints: 0, missingGroups: 0, missingMoments: 0 },
        preview: [],
      });
      setTableSource([]);
      setTablePage(0);
      setPreviewPage(0);
      setTableError(null);
      setPreviewError(null);
      setSearch("");
      setTableSearch("");
      setPendingDelete(null);
      setDeleteError(null);
      setWipeOpen(false);
      setWipeConfirm("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No fue posible eliminar todas las preguntas.";
      setWipeError(msg);
    } finally {
      setWipingAll(false);
    }
  }

  function openDelete(row: QuestionTableRow) {
    setDeleteError(null);
    setPendingDelete(row);
  }

  function openWipe() {
    setWipeError(null);
    setWipeConfirm("");
    setWipeOpen(true);
  }

  return {
    loading,
    error,
    view,
    setView,
    subjects,
    groups,
    moments,
    selectedSubjectId,
    setSelectedSubjectId,
    selectedMomentId,
    setSelectedMomentId,
    subjectNameById,
    momentNameById,
    // Metrics
    data,
    metricsLoading,
    metricsLoaded,
    metricsWarning,
    statusSpark,
    // Sample / Preview
    previewLoading,
    previewError,
    search,
    setSearch,
    previewPage,
    setPreviewPage,
    previewPageCount,
    pagedPreview,
    // Table
    tableLoading,
    tableError,
    tableSource,
    tableSearch,
    setTableSearch,
    tableStatus,
    setTableStatus,
    tableType,
    setTableType,
    tableDifficulty,
    setTableDifficulty,
    tablePage,
    setTablePage,
    tablePageCount,
    filteredTable,
    pagedTable,
    reloadTable,
    // Question Modal
    editOpen,
    editMode,
    editLoading,
    editError,
    editQuestion,
    saving,
    openEdit,
    openCreate,
    closeEdit,
    saveEdit,
    setEditQuestion,
    // Delete Modal
    pendingDelete,
    setPendingDelete,
    deleteError,
    setDeleteError,
    deletingId,
    openDelete,
    confirmDelete,
    // Wipe Modal
    wipeOpen,
    setWipeOpen,
    wipeConfirm,
    setWipeConfirm,
    wipeError,
    setWipeError,
    wipingAll,
    openWipe,
    wipeAllQuestions,
  };
}
