"use client";

import { AlertTriangle, Ban, Search, Send, UserRound, X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import type { PublishedExamRow, AttemptRow, AttemptMetrics } from "../types";
import { countAnswered, formatPercent, clampNumber } from "../services/live-service";

interface LiveAttemptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  attemptsExam: PublishedExamRow | null;
  attempts: AttemptRow[];
  attemptsLoading: boolean;
  attemptSearch: string;
  onAttemptSearchChange: (value: string) => void;
  filteredAttempts: AttemptRow[];
  selectedAttemptId: string | null;
  onSelectAttemptId: (id: string) => void;
  selectedAttempt: AttemptRow | null;
  attemptMetrics: AttemptMetrics;
  messageDrafts: Record<string, string>;
  onMessageDraftChange: (attemptId: string, text: string) => void;
  savingAttemptId: string | null;
  onSendMessage: (attemptId: string) => void;
  onOpenAnnul: (a: AttemptRow) => void;
}

export function LiveAttemptsModal({
  isOpen,
  onClose,
  attemptsExam,
  attempts,
  attemptsLoading,
  attemptSearch,
  onAttemptSearchChange,
  filteredAttempts,
  selectedAttemptId,
  onSelectAttemptId,
  selectedAttempt,
  attemptMetrics,
  messageDrafts,
  onMessageDraftChange,
  savingAttemptId,
  onSendMessage,
  onOpenAnnul,
}: LiveAttemptsModalProps) {
  if (!isOpen || !attemptsExam) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-950">
              Estudiantes • {attemptsExam.name}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Mensajes unidireccionales (docente → estudiante) y anulación por estudiante.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                Intentos {attemptMetrics.totals.total}
              </div>
              <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                En progreso {attemptMetrics.totals.inProgress}
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Finalizados {attemptMetrics.totals.submitted}
              </div>
              <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                Anulados {attemptMetrics.totals.annulled}
              </div>
              <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                Sospechosos {attemptMetrics.totals.suspicious}
              </div>
              <div className="rounded-full bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                Progreso prom. {formatPercent(attemptMetrics.avgProgressInProgress)}
              </div>
            </div>
          </div>
          <IconButton
            onClick={onClose}
            className="h-9 w-9"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mt-4 grid h-[70vh] grid-cols-1 gap-3 sm:grid-cols-[320px_1fr]">
          {/* Left panel: attempts list */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Lista</p>
              <div className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                {attempts.length}
              </div>
            </div>
            <div className="mt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  value={attemptSearch}
                  onChange={(e) => onAttemptSearchChange(e.target.value)}
                  className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-zinc-400"
                  placeholder="Buscar estudiante"
                />
              </div>
            </div>

            <div className="mt-3 max-h-[56vh] space-y-2 overflow-y-auto">
              {attemptsLoading ? (
                <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                  Cargando...
                </div>
              ) : filteredAttempts.length ? (
                filteredAttempts.map((a) => {
                  const active = a.id === selectedAttemptId;
                  const annulled = a.status === "annulled";
                  const answered = countAnswered(a.answers);
                  const total = Math.max(0, a.questionCount);
                  const progressPct = total ? (answered / total) * 100 : 0;
                  const fraudEvents =
                    Math.max(0, a.fraudTabSwitches) + Math.max(0, a.fraudClipboardAttempts);
                  const suspicious =
                    a.status === "submitted_fraud" || a.fraudForcedFail || fraudEvents >= 6;

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelectAttemptId(a.id)}
                      className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-indigo-200 bg-indigo-50"
                          : "border-zinc-200 bg-white hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-950">
                            {a.studentFullName}
                          </p>
                          <p className="mt-1 truncate text-xs text-zinc-600">{a.email}</p>
                          <p className="mt-1 truncate text-[11px] text-zinc-500">
                            {formatPercent(progressPct)} • {answered}/{total || 0} respuestas
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                            annulled
                              ? "bg-rose-50 text-rose-700 ring-rose-200"
                              : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                          }`}
                        >
                          {annulled ? "Anulado" : a.status}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${clampNumber(progressPct, 0, 100)}%` }}
                        />
                      </div>
                      {suspicious ? (
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Eventos {fraudEvents}
                        </div>
                      ) : null}
                      <p className="mt-1 truncate text-[11px] text-zinc-500">{a.documentId}</p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                  Aún no hay intentos.
                </div>
              )}
            </div>
          </div>

          {/* Right panel: selected attempt detail & interaction */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            {selectedAttempt ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-950">
                      {selectedAttempt.studentFullName}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">{selectedAttempt.email}</p>
                    <p className="mt-1 text-xs text-zinc-500">{selectedAttempt.documentId}</p>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                      {selectedAttempt.status === "annulled" ? "Anulado" : selectedAttempt.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Progreso
                    </p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">
                      {(() => {
                        const answered = countAnswered(selectedAttempt.answers);
                        const total = Math.max(0, selectedAttempt.questionCount);
                        const pct = total ? (answered / total) * 100 : 0;
                        return `${formatPercent(pct)} • ${answered}/${total || 0}`;
                      })()}
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{
                          width: `${(() => {
                            const answered = countAnswered(selectedAttempt.answers);
                            const total = Math.max(0, selectedAttempt.questionCount);
                            const pct = total ? (answered / total) * 100 : 0;
                            return clampNumber(pct, 0, 100);
                          })()}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-zinc-600">
                      Pregunta actual: {Math.max(0, selectedAttempt.currentQuestionIndex) + 1} /{" "}
                      {Math.max(0, selectedAttempt.questionCount)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Fraude
                    </p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">
                      Eventos{" "}
                      {Math.max(0, selectedAttempt.fraudTabSwitches) +
                        Math.max(0, selectedAttempt.fraudClipboardAttempts)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Pestañas {Math.max(0, selectedAttempt.fraudTabSwitches)} • Portapapeles{" "}
                      {Math.max(0, selectedAttempt.fraudClipboardAttempts)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Penalización {selectedAttempt.fraudPenalty0to5.toFixed(1)} / 5
                      {selectedAttempt.fraudForcedFail ? " • Forzar 0" : ""}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Última actividad:{" "}
                      {selectedAttempt.updatedAtMs
                        ? new Date(selectedAttempt.updatedAtMs).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                </div>

                {attemptMetrics.suspiciousTop.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                      Sospechosos (top)
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {attemptMetrics.suspiciousTop.map((item) => (
                        <button
                          key={item.attempt.id}
                          type="button"
                          onClick={() => onSelectAttemptId(item.attempt.id)}
                          className="flex items-start justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-left ring-1 ring-amber-200 hover:bg-white"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {item.attempt.studentFullName}
                            </p>
                            <p className="mt-1 text-xs text-amber-900/80">
                              Eventos {item.fraudEvents} • {formatPercent(item.progressPct)}
                            </p>
                          </div>
                          <AlertTriangle className="h-4 w-4 text-amber-800" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedAttempt.adminMessage ? (
                  <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                      Mensaje enviado
                    </p>
                    <p className="mt-2">{selectedAttempt.adminMessage}</p>
                  </div>
                ) : null}

                {selectedAttempt.annulReason ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                      Motivo de anulación
                    </p>
                    <p className="mt-2">{selectedAttempt.annulReason}</p>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Mensaje</span>
                    <input
                      value={messageDrafts[selectedAttempt.id] ?? ""}
                      onChange={(e) => onMessageDraftChange(selectedAttempt.id, e.target.value)}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                      placeholder="Mensaje al estudiante"
                      disabled={savingAttemptId === selectedAttempt.id}
                    />
                  </label>
                  <div className="flex items-center justify-end gap-2">
                    <IconButton
                      variant="primary"
                      onClick={() => onSendMessage(selectedAttempt.id)}
                      disabled={savingAttemptId === selectedAttempt.id}
                      className="h-10 w-10"
                      aria-label="Enviar mensaje"
                      title="Enviar mensaje"
                    >
                      <Send className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      variant="danger"
                      onClick={() => onOpenAnnul(selectedAttempt)}
                      disabled={
                        savingAttemptId === selectedAttempt.id ||
                        selectedAttempt.status === "annulled"
                      }
                      className="h-10 w-10"
                      aria-label="Anular intento"
                      title="Anular intento"
                    >
                      <Ban className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
                  <div className="flex items-start gap-3">
                    <UserRound className="mt-0.5 h-5 w-5 text-zinc-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Accesos rápidos</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Selecciona estudiante en la lista para abrir chat y acciones, sin depender del scroll.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
                Selecciona un estudiante para ver el chat.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
