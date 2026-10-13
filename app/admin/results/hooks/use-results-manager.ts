"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResultRow, SortKey, SortDir, StatusFilter, ExportFormat } from "../types";
import {
  fetchResultsData,
  deleteAttemptDoc,
  deleteBulkAttemptDocs,
  parseWrongDetail,
} from "../services/results-service";
import {
  exportResultsCsv,
  exportResultsExcel,
  exportResultsPdf,
  exportAttemptPdf as exportAttemptPdfService,
  exportSelectedAttemptsZip as exportSelectedAttemptsZipService,
} from "../services/results-export-service";

export function useResultsManager() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [examCodeFilter, setExamCodeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [onlyWithWrong, setOnlyWithWrong] = useState(false);
  const [onlyWithFraud, setOnlyWithFraud] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(0);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Record<string, true>>({});

  // Exports state
  const [exporting, setExporting] = useState<ExportFormat>("");
  const [exportingAttemptId, setExportingAttemptId] = useState<string | null>(null);
  const [exportingBulkZip, setExportingBulkZip] = useState(false);

  // Modals state
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResultRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const computed = await fetchResultsData();
        if (!cancelled) setRows(computed);
      } catch {
        if (!cancelled) setError("No fue posible cargar resultados desde Firestore.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const code = examCodeFilter.trim();
    return rows.filter((r) => {
      const bySearch =
        !q ||
        [r.examName, r.studentFullName, r.documentId, r.email, r.status, r.examCode].some((field) =>
          field.toLowerCase().includes(q),
        );
      const byCode = !code || r.examCode.includes(code);
      const byStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "fraud"
            ? r.status.toLowerCase().includes("fraud")
            : statusFilter === "submitted"
              ? r.status.toLowerCase().includes("submitted")
              : statusFilter === "annulled"
                ? r.status.toLowerCase().includes("annul")
                : r.status.toLowerCase().includes("in_progress");
      const byWrong = !onlyWithWrong || r.wrongCount > 0;
      const byFraud = !onlyWithFraud || r.fraudTotal > 0;
      return bySearch && byCode && byStatus && byWrong && byFraud;
    });
  }, [rows, search, examCodeFilter, statusFilter, onlyWithWrong, onlyWithFraud]);

  const visibleRows = useMemo(() => {
    const copy = [...filteredRows];
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (r: ResultRow) => {
      if (sortKey === "submittedAt") return r.submittedAt?.getTime?.() ?? 0;
      if (sortKey === "grade0to5") return r.grade0to5;
      if (sortKey === "grade0to50") return r.grade0to50;
      if (sortKey === "fraudTotal") return r.fraudTotal;
      if (sortKey === "wrongCount") return r.wrongCount;
      if (sortKey === "examName") return r.examName;
      if (sortKey === "examCode") return r.examCode;
      if (sortKey === "studentFullName") return r.studentFullName;
      if (sortKey === "status") return r.status;
      return 0;
    };
    copy.sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "es") * dir;
    });
    return copy;
  }, [filteredRows, sortKey, sortDir]);

  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = useMemo(() => {
    const start = safePage * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, safePage]);

  const selectedWrong = useMemo(() => {
    if (!selectedRow) return [];
    return selectedRow.wrongDetails.map(parseWrongDetail);
  }, [selectedRow]);

  const selectedCount = useMemo(() => Object.keys(selectedIds).length, [selectedIds]);
  const selectedRows = useMemo(
    () => visibleRows.filter((r) => Boolean(selectedIds[r.id])),
    [visibleRows, selectedIds],
  );
  const allVisibleSelected = useMemo(() => {
    if (!pagedRows.length) return false;
    return pagedRows.every((r) => Boolean(selectedIds[r.id]));
  }, [pagedRows, selectedIds]);

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => {
        const next = { ...prev };
        pagedRows.forEach((r) => {
          next[r.id] = true;
        });
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = { ...prev };
        pagedRows.forEach((r) => {
          delete next[r.id];
        });
        return next;
      });
    }
  }

  function toggleSelectRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (checked) next[id] = true;
      else delete next[id];
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds({});
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "grade0to5" || key === "grade0to50" || key === "fraudTotal" || key === "wrongCount" || key === "submittedAt" ? "desc" : "asc");
    }
    setPage(0);
  }

  async function confirmDeleteAttempt() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAttemptDoc(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      setSelectedRow((prev) => (prev?.id === deleteTarget.id ? null : prev));
    } catch {
      setDeleteError("No fue posible eliminar este intento. Revisa reglas/permisos de Firestore.");
    } finally {
      setDeleting(false);
    }
  }

  async function confirmBulkDelete() {
    const ids = Object.keys(selectedIds);
    if (!ids.length) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBulkAttemptDocs(ids);
      setRows((prev) => prev.filter((r) => !selectedIds[r.id]));
      setSelectedIds({});
      setBulkDeleteOpen(false);
      setSelectedRow((prev) => (prev && selectedIds[prev.id] ? null : prev));
    } catch {
      setDeleteError("No fue posible eliminar en masa. Revisa reglas/permisos de Firestore.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(format: "csv" | "excel" | "pdf") {
    setExporting(format);
    setError(null);
    try {
      if (format === "csv") exportResultsCsv(visibleRows);
      if (format === "excel") await exportResultsExcel(visibleRows);
      if (format === "pdf") await exportResultsPdf(visibleRows);
    } catch {
      setError(`No fue posible exportar en formato ${format.toUpperCase()}.`);
    } finally {
      setExporting("");
    }
  }

  async function exportAttemptPdf(row: ResultRow) {
    setExportingAttemptId(row.id);
    setError(null);
    try {
      await exportAttemptPdfService(row);
    } catch {
      setError("No fue posible generar el PDF del intento.");
    } finally {
      setExportingAttemptId(null);
    }
  }

  async function exportSelectedAttemptsZip() {
    if (!selectedRows.length) return;
    setExportingBulkZip(true);
    setError(null);
    try {
      await exportSelectedAttemptsZipService(selectedRows);
    } catch {
      setError("No fue posible generar el archivo ZIP de los seleccionados.");
    } finally {
      setExportingBulkZip(false);
    }
  }

  return {
    rows,
    visibleRows,
    pagedRows,
    loading,
    error,
    setError,

    // Filter controls
    search,
    setSearch,
    examCodeFilter,
    setExamCodeFilter,
    statusFilter,
    setStatusFilter,
    onlyWithWrong,
    setOnlyWithWrong,
    onlyWithFraud,
    setOnlyWithFraud,

    // Sort controls
    sortKey,
    sortDir,
    toggleSort,

    // Pagination
    page,
    safePage,
    pageCount,
    setPage,

    // Selection controls
    selectedIds,
    selectedCount,
    allVisibleSelected,
    toggleSelectAll,
    toggleSelectRow,
    clearSelection,

    // Modals
    selectedRow,
    setSelectedRow,
    selectedWrong,
    deleteTarget,
    setDeleteTarget,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    deleting,
    deleteError,
    setDeleteError,
    confirmDeleteAttempt,
    confirmBulkDelete,

    // Exports
    exporting,
    exportingAttemptId,
    exportingBulkZip,
    handleExport,
    exportAttemptPdf,
    exportSelectedAttemptsZip,
  };
}
