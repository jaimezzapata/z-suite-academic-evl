"use client";

import React from "react";
import { useBankDashboard } from "./hooks/use-bank-dashboard";
import { BankHeader } from "./components/bank-header";
import { BankSummaryView } from "./components/bank-summary-view";
import { BankTableView } from "./components/bank-table-view";
import { BankQuestionModal } from "./components/bank-question-modal";
import { BankDeleteModal } from "./components/bank-delete-modal";
import { BankWipeModal } from "./components/bank-wipe-modal";

export function BankDashboard() {
  const b = useBankDashboard();

  return (
    <div className="space-y-6">
      {/* Encabezado con selector de vista (Resumen / Tabla) y KPI Total */}
      <BankHeader
        view={b.view}
        onViewChange={b.setView}
        totalCount={b.data.counts.total}
        metricsLoading={b.metricsLoading}
        metricsLoaded={b.metricsLoaded}
        statusSpark={b.statusSpark}
      />

      {/* Alerta de error global */}
      {b.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {b.error}
        </div>
      ) : null}

      {/* Vista de Resumen y Métricas */}
      {b.view === "summary" ? (
        <BankSummaryView
          data={b.data}
          metricsLoading={b.metricsLoading}
          metricsLoaded={b.metricsLoaded}
          metricsWarning={b.metricsWarning}
          subjects={b.subjects}
          moments={b.moments}
          selectedSubjectId={b.selectedSubjectId}
          onSelectSubjectId={b.setSelectedSubjectId}
          selectedMomentId={b.selectedMomentId}
          onSelectMomentId={b.setSelectedMomentId}
          search={b.search}
          onSearchChange={b.setSearch}
          previewLoading={b.previewLoading}
          previewError={b.previewError}
          pagedPreview={b.pagedPreview}
          previewPage={b.previewPage}
          previewPageCount={b.previewPageCount}
          onPageChange={b.setPreviewPage}
          onOpenEdit={b.openEdit}
          loading={b.loading}
        />
      ) : (
        /* Vista de Listado / Tabla */
        <BankTableView
          tableLoading={b.tableLoading}
          tableError={b.tableError}
          tableSourceCount={b.tableSource.length}
          filteredCount={b.filteredTable.length}
          pagedTable={b.pagedTable}
          tablePage={b.tablePage}
          tablePageCount={b.tablePageCount}
          onPageChange={b.setTablePage}
          subjects={b.subjects}
          moments={b.moments}
          selectedSubjectId={b.selectedSubjectId}
          onSelectSubjectId={b.setSelectedSubjectId}
          selectedMomentId={b.selectedMomentId}
          onSelectMomentId={b.setSelectedMomentId}
          tableStatus={b.tableStatus}
          onTableStatusChange={b.setTableStatus}
          tableType={b.tableType}
          onTableTypeChange={b.setTableType}
          tableDifficulty={b.tableDifficulty}
          onTableDifficultyChange={b.setTableDifficulty}
          tableSearch={b.tableSearch}
          onTableSearchChange={b.setTableSearch}
          subjectNameById={b.subjectNameById}
          momentNameById={b.momentNameById}
          onReload={() => void b.reloadTable()}
          onOpenCreate={b.openCreate}
          onOpenWipe={b.openWipe}
          onOpenEdit={(id) => void b.openEdit(id)}
          onOpenDelete={b.openDelete}
        />
      )}

      {/* Modal de creación y edición de pregunta */}
      <BankQuestionModal
        isOpen={b.editOpen}
        mode={b.editMode}
        question={b.editQuestion}
        loading={b.editLoading}
        saving={b.saving}
        error={b.editError}
        subjects={b.subjects}
        groups={b.groups}
        moments={b.moments}
        onClose={b.closeEdit}
        onSave={() => void b.saveEdit()}
        onChangeQuestion={b.setEditQuestion}
      />

      {/* Modal de confirmación para eliminar pregunta individual */}
      <BankDeleteModal
        isOpen={!!b.pendingDelete}
        target={b.pendingDelete}
        deleting={!!b.deletingId}
        error={b.deleteError}
        onClose={() => b.setPendingDelete(null)}
        onConfirm={() => void b.confirmDelete()}
      />

      {/* Modal de confirmación para vaciado de la colección questions */}
      <BankWipeModal
        isOpen={b.wipeOpen}
        confirmText={b.wipeConfirm}
        onConfirmTextChange={b.setWipeConfirm}
        wiping={b.wipingAll}
        error={b.wipeError}
        onClose={() => (b.wipingAll ? null : b.setWipeOpen(false))}
        onConfirm={() => void b.wipeAllQuestions()}
      />
    </div>
  );
}
