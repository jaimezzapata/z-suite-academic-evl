"use client";

import { useLiveManager } from "./hooks/use-live-manager";
import { LiveHeader } from "./components/live-header";
import { LiveExamsMapView } from "./components/live-exams-map-view";
import { LiveExamsTableView } from "./components/live-exams-table-view";
import { LiveAttemptsModal } from "./components/live-attempts-modal";
import { LiveAnnulModal } from "./components/live-annul-modal";
import { LiveTimeModal } from "./components/live-time-modal";

export function LiveManager() {
  const {
    filtered,
    loading,
    error,
    search,
    setSearch,
    isMobile,
    viewMode,
    setViewMode,
    effectiveViewMode,
    quickCode,
    setQuickCode,
    quickCodeError,
    setQuickCodeError,
    quickCodeLoading,
    openByQuickCode,
    quickSuggestions,
    closingId,
    closeExam,
    timeOpen,
    setTimeOpen,
    timeTarget,
    timeDraft,
    setTimeDraft,
    timeSaving,
    timeError,
    openTime,
    saveTime,
    attemptsOpen,
    setAttemptsOpen,
    attemptsExam,
    openAttempts,
    attempts,
    attemptsLoading,
    attemptSearch,
    setAttemptSearch,
    filteredAttempts,
    selectedAttemptId,
    setSelectedAttemptId,
    selectedAttempt,
    attemptMetrics,
    messageDrafts,
    setMessageDrafts,
    savingAttemptId,
    sendMessage,
    annulOpen,
    setAnnulOpen,
    annulTarget,
    annulDraft,
    setAnnulDraft,
    openAnnul,
    confirmAnnul,
  } = useLiveManager();

  return (
    <div className="space-y-4">
      <LiveHeader
        isMobile={isMobile}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        onSearchChange={setSearch}
        error={error}
      />

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          Cargando...
        </div>
      ) : filtered.length ? (
        effectiveViewMode === "map" ? (
          <LiveExamsMapView
            filtered={filtered}
            closingId={closingId}
            onOpenAttempts={openAttempts}
            onOpenTime={openTime}
            onCloseExam={(row) => void closeExam(row)}
            quickCode={quickCode}
            onQuickCodeChange={(val) => {
              setQuickCodeError(null);
              setQuickCode(val);
            }}
            quickCodeError={quickCodeError}
            quickCodeLoading={quickCodeLoading}
            onOpenByQuickCode={() => void openByQuickCode()}
            onClearQuickCode={() => {
              setQuickCode("");
              setQuickCodeError(null);
            }}
            quickSuggestions={quickSuggestions}
            onSelectSuggestion={(row) => {
              setQuickCode(row.accessCode);
              setQuickCodeError(null);
              openAttempts(row);
            }}
          />
        ) : (
          <LiveExamsTableView
            filtered={filtered}
            closingId={closingId}
            onOpenAttempts={openAttempts}
            onOpenTime={openTime}
            onCloseExam={(row) => void closeExam(row)}
          />
        )
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          No hay exámenes publicados.
        </div>
      )}

      <LiveAttemptsModal
        isOpen={attemptsOpen}
        onClose={() => setAttemptsOpen(false)}
        attemptsExam={attemptsExam}
        attempts={attempts}
        attemptsLoading={attemptsLoading}
        attemptSearch={attemptSearch}
        onAttemptSearchChange={setAttemptSearch}
        filteredAttempts={filteredAttempts}
        selectedAttemptId={selectedAttemptId}
        onSelectAttemptId={setSelectedAttemptId}
        selectedAttempt={selectedAttempt}
        attemptMetrics={attemptMetrics}
        messageDrafts={messageDrafts}
        onMessageDraftChange={(attemptId, text) =>
          setMessageDrafts((prev) => ({ ...prev, [attemptId]: text }))
        }
        savingAttemptId={savingAttemptId}
        onSendMessage={(attemptId) => void sendMessage(attemptId)}
        onOpenAnnul={openAnnul}
      />

      <LiveAnnulModal
        isOpen={annulOpen}
        onClose={() => setAnnulOpen(false)}
        annulTarget={annulTarget}
        annulDraft={annulDraft}
        onAnnulDraftChange={setAnnulDraft}
        savingAttemptId={savingAttemptId}
        onConfirm={() => void confirmAnnul()}
      />

      <LiveTimeModal
        isOpen={timeOpen}
        onClose={() => setTimeOpen(false)}
        timeTarget={timeTarget}
        timeDraft={timeDraft}
        onTimeDraftChange={setTimeDraft}
        timeSaving={timeSaving}
        timeError={timeError}
        onSave={() => void saveTime()}
      />
    </div>
  );
}
