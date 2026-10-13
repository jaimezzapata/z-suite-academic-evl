"use client";

import React from "react";
import { useExamManager } from "./hooks/use-exam-manager";
import { TemplatesHeader } from "./components/templates-header";
import { TemplatesFilters } from "./components/templates-filters";
import { TemplatesTableView } from "./components/templates-table-view";
import { TemplatesCardsView } from "./components/templates-cards-view";
import { TemplateFormModal } from "./components/template-form-modal";
import { TemplateDeleteModal } from "./components/template-delete-modal";
import { TemplatePublishModal } from "./components/template-publish-modal";

export function ExamManager() {
  const m = useExamManager();

  return (
    <div className="space-y-6">
      {/* Encabezado y barra de acciones rápidas */}
      <TemplatesHeader
        search={m.search}
        onSearchChange={m.setSearch}
        isMobile={m.isMobile}
        viewMode={m.viewMode}
        onViewModeChange={m.setViewMode}
        filtersOpen={m.filtersOpen}
        onToggleFilters={() => m.setFiltersOpen(!m.filtersOpen)}
        onOpenCreate={m.openCreate}
      />

      {/* Barra colapsable de filtros */}
      <TemplatesFilters
        isOpen={m.filtersOpen}
        subjects={m.subjects}
        groups={m.groups}
        fichas={m.fichas}
        moments={m.moments}
        sites={m.sites}
        shifts={m.shifts}
        filterSubjectId={m.filterSubjectId}
        onFilterSubjectIdChange={m.setFilterSubjectId}
        filterGroupId={m.filterGroupId}
        onFilterGroupIdChange={m.setFilterGroupId}
        filterMomentId={m.filterMomentId}
        onFilterMomentIdChange={m.setFilterMomentId}
        filterSiteId={m.filterSiteId}
        onFilterSiteIdChange={m.setFilterSiteId}
        filterShiftId={m.filterShiftId}
        onFilterShiftIdChange={m.setFilterShiftId}
        filterActive={m.filterActive}
        onFilterActiveChange={m.setFilterActive}
        filterPublished={m.filterPublished}
        onFilterPublishedChange={m.setFilterPublished}
        onClearFilters={m.clearFilters}
        onClose={() => m.setFiltersOpen(false)}
      />

      {/* Mensajes de retroalimentación globales */}
      {m.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {m.error}
        </div>
      ) : null}

      {m.publishMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {m.publishMessage}
        </div>
      ) : null}

      {/* Contenido principal: Tabla o Cards */}
      <section className="space-y-4">
        {m.loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 shadow-sm">
            Cargando exámenes...
          </div>
        ) : m.effectiveViewMode === "cards" ? (
          <TemplatesCardsView
            rows={m.filteredRows}
            namesById={m.namesById}
            pendingCounts={m.pendingCounts}
            savingId={m.savingId}
            publishedByTemplate={m.publishedByTemplate}
            onPendingCountChange={m.setPendingCountForId}
            onSaveQuestionCount={m.saveQuestionCount}
            onToggleActive={m.toggleActive}
            onEdit={m.openEdit}
            onDelete={m.openDelete}
            onPublish={m.openPublish}
          />
        ) : (
          <TemplatesTableView
            rows={m.filteredRows}
            namesById={m.namesById}
            pendingCounts={m.pendingCounts}
            savingId={m.savingId}
            publishedByTemplate={m.publishedByTemplate}
            onPendingCountChange={m.setPendingCountForId}
            onSaveQuestionCount={m.saveQuestionCount}
            onToggleActive={m.toggleActive}
            onEdit={m.openEdit}
            onDelete={m.openDelete}
            onPublish={m.openPublish}
          />
        )}
      </section>

      {/* Modal unificado de creación y edición */}
      <TemplateFormModal
        isOpen={m.createOpen || m.editOpen}
        mode={m.editOpen ? "edit" : "create"}
        form={m.form}
        autoName={m.autoName}
        subjects={m.subjects}
        groups={m.groups}
        fichas={m.fichas}
        moments={m.moments}
        sites={m.sites}
        shifts={m.shifts}
        submitting={m.creating || m.editing}
        error={m.error}
        onUpdateField={m.updateFormField}
        onImportDoc={m.importDocumentationFile}
        onSubmit={m.editOpen ? m.saveEdit : m.createExamTemplate}
        onClose={m.closeFormModal}
      />

      {/* Modal de eliminación con comprobación de intentos */}
      <TemplateDeleteModal
        isOpen={m.deleteOpen}
        target={m.deleteTarget}
        confirmText={m.deleteConfirm}
        blockReason={m.deleteBlockReason}
        deleting={m.deleting}
        onConfirmChange={m.setDeleteConfirm}
        onConfirmDelete={m.confirmDelete}
        onClose={m.closeDeleteModal}
      />

      {/* Modal de vista previa y publicación de examen */}
      <TemplatePublishModal
        isOpen={m.publishOpen}
        publishTarget={m.publishTarget}
        publishing={m.publishing}
        previewLoading={m.previewLoading}
        previewError={m.previewError}
        namesById={m.namesById}
        eligiblePool={m.eligiblePool}
        selectedQuestions={m.selectedQuestions}
        activeQuestionIndex={m.activeQuestionIndex}
        previewViewMode={m.previewViewMode}
        manualSwapIndex={m.manualSwapIndex}
        swapSearchTerm={m.swapSearchTerm}
        swapDifficultyFilter={m.swapDifficultyFilter}
        showDocsPreview={m.showDocsPreview}
        filteredUnusedQuestions={m.filteredUnusedQuestions}
        remainingUnusedCount={m.remainingUnusedCount}
        onClose={m.closePublishModal}
        onPublish={m.publishExam}
        onReShuffleAll={m.reShuffleAll}
        onQuickSwap={m.handleQuickSwap}
        onSelectReplacement={m.handleSelectReplacement}
        onActiveQuestionIndexChange={m.setActiveQuestionIndex}
        onPreviewViewModeChange={m.setPreviewViewMode}
        onManualSwapIndexChange={m.setManualSwapIndex}
        onSwapSearchTermChange={m.setSwapSearchTerm}
        onSwapDifficultyFilterChange={m.setSwapDifficultyFilter}
        onShowDocsPreviewChange={m.setShowDocsPreview}
      />
    </div>
  );
}
