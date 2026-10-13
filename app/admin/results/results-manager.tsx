"use client";

import { useResultsManager } from "./hooks/use-results-manager";
import { ResultsHeader } from "./components/results-header";
import { ResultsFilters } from "./components/results-filters";
import { ResultsTableView } from "./components/results-table-view";
import { ResultDetailModal } from "./components/result-detail-modal";
import { ResultDeleteModal } from "./components/result-delete-modal";
import { ResultBulkDeleteModal } from "./components/result-bulk-delete-modal";

export function ResultsManager() {
  const {
    visibleRows,
    pagedRows,
    loading,
    error,
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
    sortKey,
    toggleSort,
    page,
    safePage,
    pageCount,
    setPage,
    selectedIds,
    selectedCount,
    allVisibleSelected,
    toggleSelectAll,
    toggleSelectRow,
    clearSelection,
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
    exporting,
    exportingAttemptId,
    exportingBulkZip,
    handleExport,
    exportAttemptPdf,
    exportSelectedAttemptsZip,
  } = useResultsManager();

  return (
    <div className="space-y-5">
      <ResultsHeader
        loading={loading}
        hasRows={visibleRows.length > 0}
        exporting={exporting}
        onExport={handleExport}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <ResultsFilters
          examCodeFilter={examCodeFilter}
          setExamCodeFilter={setExamCodeFilter}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onlyWithWrong={onlyWithWrong}
          setOnlyWithWrong={setOnlyWithWrong}
          onlyWithFraud={onlyWithFraud}
          setOnlyWithFraud={setOnlyWithFraud}
          loading={loading}
          totalResults={visibleRows.length}
          selectedCount={selectedCount}
          exportingBulkZip={exportingBulkZip}
          exportingAttemptId={exportingAttemptId}
          onExportSelectedZip={() => void exportSelectedAttemptsZip()}
          onOpenBulkDelete={() => {
            setDeleteError(null);
            setBulkDeleteOpen(true);
          }}
          onClearSelection={clearSelection}
          setPage={setPage}
        />

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <ResultsTableView
          loading={loading}
          visibleRowsCount={visibleRows.length}
          pagedRows={pagedRows}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelectRow={toggleSelectRow}
          sortKey={sortKey}
          onToggleSort={toggleSort}
          onSelectRow={setSelectedRow}
          onExportAttemptPdf={(row) => void exportAttemptPdf(row)}
          exportingAttemptId={exportingAttemptId}
          exportingBulkZip={exportingBulkZip}
          onDeleteTarget={(row) => {
            setDeleteError(null);
            setDeleteTarget(row);
          }}
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      </section>

      <ResultDetailModal
        selectedRow={selectedRow}
        selectedWrong={selectedWrong}
        onClose={() => setSelectedRow(null)}
        onExportPdf={(row) => void exportAttemptPdf(row)}
        exportingAttemptId={exportingAttemptId}
        onDelete={(row) => {
          setDeleteError(null);
          setDeleteTarget(row);
        }}
      />

      <ResultDeleteModal
        deleteTarget={deleteTarget}
        deleting={deleting}
        deleteError={deleteError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteAttempt()}
      />

      <ResultBulkDeleteModal
        isOpen={bulkDeleteOpen}
        selectedCount={selectedCount}
        deleting={deleting}
        deleteError={deleteError}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void confirmBulkDelete()}
      />
    </div>
  );
}
