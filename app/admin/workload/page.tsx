"use client";

import { useWorkloadData } from "./hooks/use-workload-data";
import { WorkloadHeader } from "./components/workload-header";
import { WorkloadListView } from "./components/workload-list-view";
import { WorkloadCalendarView } from "./components/workload-calendar-view";
import { WorkloadPayrollView } from "./components/workload-payroll-view";
import { WorkloadFiltersModal } from "./components/workload-filters-modal";
import { WorkloadPayrollModal } from "./components/workload-payroll-modal";
import { WorkloadFormModal } from "./components/workload-form-modal";

export default function AdminWorkloadPage() {
  const {
    loading,
    error,
    success,
    isMobile,
    subjects,
    groups,
    fichas,
    sites,
    shifts,
    rows,
    payrollStatements,
    tab,
    viewMode,
    effectiveViewMode,
    modalOpen,
    filtersOpen,
    editingId,
    form,
    filters,
    calendarWeekStart,
    payrollRangeStart,
    payrollRangeEnd,
    cesdeHourlyRate,
    senaMonthlySalary,
    selectedPayrollStatement,
    draggingCalendarEvent,
    calendarDropTarget,
    movingCalendarEventId,
    filterAudienceOptions,
    classroomOptions,
    filteredRows,
    counts,
    hourTotals,
    audienceOptions,
    currentDurationMinutes,
    currentAcademicHours,
    currentWeeklySessionCount,
    currentWeeklyAcademicHours,
    calendarDays,
    calendarHolidayMap,
    calendarEvents,
    payrollSummary,
    summaryCards,
    // Actions
    setTab,
    setViewMode,
    setModalOpen,
    setFiltersOpen,
    setCalendarWeekStart,
    setPayrollRangeStart,
    setPayrollRangeEnd,
    setCesdeHourlyRate,
    setSenaMonthlySalary,
    setSelectedPayrollStatement,
    setCalendarDropTarget,
    applyTab,
    updateFilter,
    resetFilters,
    openCreate,
    openCreateFromCalendar,
    openEdit,
    closeModal,
    updateFormField,
    saveRow,
    removeRow,
    readDraggedCalendarEvent,
    handleCalendarDragStart,
    handleCalendarDragEnd,
    moveCalendarEventToSlot,
    movePayrollFortnight,
    savePayrollStatement,
    removePayrollStatement,
    downloadCalendarPdf,
    downloadGeneralScheduleCsv,
    downloadGeneralSchedulePdf,
    downloadPayrollStatementPdf,
  } = useWorkloadData();

  return (
    <div className="space-y-4 pb-6">
      {/* Header, Stats, Tabs & View Switcher */}
      <WorkloadHeader
        viewMode={viewMode}
        effectiveViewMode={effectiveViewMode}
        tab={tab}
        counts={counts}
        totalRows={rows.length}
        filteredCount={filteredRows.length}
        subjectsCount={subjects.length}
        loading={loading}
        error={error}
        success={success}
        summaryCards={summaryCards}
        payrollSummary={payrollSummary}
        isMobile={isMobile}
        onTabChange={applyTab}
        onViewModeChange={setViewMode}
        onOpenCreate={() => openCreate()}
        onOpenFilters={() => setFiltersOpen(true)}
        onDownloadPdf={() => void downloadGeneralSchedulePdf()}
        onDownloadCsv={downloadGeneralScheduleCsv}
      />

      {/* Main View Switcher */}
      {effectiveViewMode === "list" ? (
        <WorkloadListView
          rows={filteredRows}
          tab={tab}
          loading={loading}
          onEdit={openEdit}
          onRemove={(row) => void removeRow(row)}
        />
      ) : effectiveViewMode === "payroll" ? (
        <WorkloadPayrollView
          payrollRangeStart={payrollRangeStart}
          payrollRangeEnd={payrollRangeEnd}
          cesdeHourlyRate={cesdeHourlyRate}
          senaMonthlySalary={senaMonthlySalary}
          payrollSummary={payrollSummary}
          payrollStatements={payrollStatements}
          loading={loading}
          onRangeStartChange={setPayrollRangeStart}
          onRangeEndChange={setPayrollRangeEnd}
          onCesdeRateChange={setCesdeHourlyRate}
          onSenaSalaryChange={setSenaMonthlySalary}
          onMoveFortnight={movePayrollFortnight}
          onSaveStatement={() => void savePayrollStatement()}
          onSelectStatement={setSelectedPayrollStatement}
          onDownloadStatementPdf={(st) => void downloadPayrollStatementPdf(st)}
          onRemoveStatement={(st) => void removePayrollStatement(st)}
        />
      ) : (
        <WorkloadCalendarView
          tab={tab}
          calendarWeekStart={calendarWeekStart}
          calendarDays={calendarDays}
          calendarHolidayMap={calendarHolidayMap}
          calendarEvents={calendarEvents}
          loading={loading}
          movingCalendarEventId={movingCalendarEventId}
          draggingCalendarEvent={draggingCalendarEvent}
          calendarDropTarget={calendarDropTarget}
          onPrevWeek={() => setCalendarWeekStart((prev) => new Date(prev.getTime() - 7 * 86400000))}
          onNextWeek={() => setCalendarWeekStart((prev) => new Date(prev.getTime() + 7 * 86400000))}
          onCurrentWeek={() => setCalendarWeekStart(new Date())}
          onDownloadPdf={() => void downloadCalendarPdf()}
          onOpenCreateFromCalendar={openCreateFromCalendar}
          onEdit={openEdit}
          onRemove={(row) => void removeRow(row)}
          onDragStart={handleCalendarDragStart}
          onDragEnd={handleCalendarDragEnd}
          onDropSlot={(day, startMinutes, dragged) => void moveCalendarEventToSlot(day, startMinutes, dragged)}
          onSetDropTarget={setCalendarDropTarget}
          readDraggedCalendarEvent={readDraggedCalendarEvent}
        />
      )}

      {/* Assignment Creation / Editing Modal */}
      {modalOpen ? (
        <WorkloadFormModal
          isOpen={modalOpen}
          editingId={editingId}
          form={form}
          subjects={subjects}
          audienceOptions={audienceOptions}
          sites={sites}
          shifts={shifts}
          currentDurationMinutes={currentDurationMinutes}
          currentAcademicHours={currentAcademicHours}
          currentWeeklySessionCount={currentWeeklySessionCount}
          currentWeeklyAcademicHours={currentWeeklyAcademicHours}
          onClose={closeModal}
          onUpdateField={updateFormField}
          onSave={() => void saveRow()}
        />
      ) : null}

      {/* Saved Payroll Statement Detail Modal */}
      {selectedPayrollStatement ? (
        <WorkloadPayrollModal
          statement={selectedPayrollStatement}
          onClose={() => setSelectedPayrollStatement(null)}
          onDownloadPdf={(st) => void downloadPayrollStatementPdf(st)}
        />
      ) : null}

      {/* Filters Modal */}
      {filtersOpen ? (
        <WorkloadFiltersModal
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          tab={tab}
          filters={filters}
          subjects={subjects}
          filterAudienceOptions={filterAudienceOptions}
          sites={sites}
          shifts={shifts}
          classroomOptions={classroomOptions}
          onUpdateFilter={updateFilter}
          onResetFilters={resetFilters}
        />
      ) : null}
    </div>
  );
}
