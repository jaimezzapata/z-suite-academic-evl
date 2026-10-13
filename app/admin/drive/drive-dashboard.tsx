"use client";

import { useDriveDashboard } from "./hooks/use-drive-dashboard";
import { DriveHeader } from "./components/drive-header";
import { DriveKpiSummary } from "./components/drive-kpi-summary";
import { DriveWorkspacesList } from "./components/drive-workspaces-list";
import { DriveWorkspaceDetail } from "./components/drive-workspace-detail";
import { DriveCreateModal } from "./components/drive-create-modal";
import { DriveDeleteModal } from "./components/drive-delete-modal";

export function DriveDashboard() {
  const {
    loading,
    error,
    subjects,
    groups,
    fichas,
    sites,
    shifts,
    institutionTab,
    setInstitutionTab,
    displayWorkspaces,
    tabWorkspaces,
    summary,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    selectedWorkspace,
    selectedWeeksByDay,
    selectedNodesLoading,
    selectedNodesError,
    createOpen,
    setCreateOpen,
    openCreateForm,
    institution,
    setInstitution,
    cesdeGroupType,
    setCesdeGroupType,
    subjectId,
    setSubjectId,
    groupId,
    setGroupId,
    period,
    setPeriod,
    siteId,
    setSiteId,
    shiftId,
    setShiftId,
    dayOfWeek1,
    setDayOfWeek1,
    dayOfWeek2,
    setDayOfWeek2,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    day2StartTime,
    setDay2StartTime,
    day2EndTime,
    setDay2EndTime,
    classroom,
    setClassroom,
    createError,
    usesManualWeekdays,
    resolvedDayOfWeek1,
    resolvedDayOfWeek2,
    createStructure,
    workspaceSyncingId,
    workspaceSyncError,
    syncWorkspace,
    pendingWorkspaceDelete,
    setPendingWorkspaceDelete,
    workspaceDeletingId,
    workspaceDeleteError,
    deleteWorkspaceFromPanel,
  } = useDriveDashboard();

  return (
    <div className="space-y-6">
      <DriveHeader
        onOpenCreate={openCreateForm}
        error={error}
        workspaceSyncError={workspaceSyncError}
      />

      <DriveKpiSummary
        loading={loading}
        summary={summary}
        totalWorkspaces={displayWorkspaces.length}
      />

      <DriveWorkspacesList
        institutionTab={institutionTab}
        onTabChange={setInstitutionTab}
        displayWorkspaces={displayWorkspaces}
        tabWorkspaces={tabWorkspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        onSelectWorkspaceId={setSelectedWorkspaceId}
        workspaceSyncingId={workspaceSyncingId}
        onSyncWorkspace={(ws) => void syncWorkspace(ws)}
        onDeleteWorkspace={(ws) => setPendingWorkspaceDelete(ws)}
        loading={loading}
      />

      <DriveWorkspaceDetail
        selectedWorkspace={selectedWorkspace}
        selectedWeeksByDay={selectedWeeksByDay}
        selectedNodesLoading={selectedNodesLoading}
        selectedNodesError={selectedNodesError}
      />

      <DriveCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={() => void createStructure()}
        createError={createError}
        subjects={subjects}
        groups={groups}
        fichas={fichas}
        sites={sites}
        shifts={shifts}
        institution={institution}
        setInstitution={setInstitution}
        cesdeGroupType={cesdeGroupType}
        setCesdeGroupType={setCesdeGroupType}
        subjectId={subjectId}
        setSubjectId={setSubjectId}
        groupId={groupId}
        setGroupId={setGroupId}
        period={period}
        setPeriod={setPeriod}
        siteId={siteId}
        setSiteId={setSiteId}
        shiftId={shiftId}
        setShiftId={setShiftId}
        dayOfWeek1={dayOfWeek1}
        setDayOfWeek1={setDayOfWeek1}
        dayOfWeek2={dayOfWeek2}
        setDayOfWeek2={setDayOfWeek2}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        startTime={startTime}
        setStartTime={setStartTime}
        endTime={endTime}
        setEndTime={setEndTime}
        day2StartTime={day2StartTime}
        setDay2StartTime={setDay2StartTime}
        day2EndTime={day2EndTime}
        setDay2EndTime={setDay2EndTime}
        classroom={classroom}
        setClassroom={setClassroom}
        usesManualWeekdays={usesManualWeekdays}
        resolvedDayOfWeek1={resolvedDayOfWeek1}
        resolvedDayOfWeek2={resolvedDayOfWeek2}
      />

      <DriveDeleteModal
        pendingWorkspaceDelete={pendingWorkspaceDelete}
        workspaceDeletingId={workspaceDeletingId}
        workspaceDeleteError={workspaceDeleteError}
        onClose={() => setPendingWorkspaceDelete(null)}
        onConfirm={(ws) => void deleteWorkspaceFromPanel(ws)}
      />
    </div>
  );
}
