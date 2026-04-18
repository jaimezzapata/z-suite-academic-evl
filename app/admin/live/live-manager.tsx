"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Ban, MessageSquareText, Search, KeyRound, Send, X } from "lucide-react";
import { firestore } from "@/lib/firebase/client";
import { IconButton } from "@/app/admin/ui/icon-button";

type PublishedExamRow = {
  id: string;
  name: string;
  accessCode: string;
  status: string;
  questionCount: number;
  timeLimitMinutes: number;
};

type AttemptRow = {
  id: string;
  status: string;
  studentFullName: string;
  email: string;
  documentId: string;
  adminMessage: string | null;
};

function toString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function LiveManager() {
  const [rows, setRows] = useState<PublishedExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [attemptsExam, setAttemptsExam] = useState<PublishedExamRow | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [savingAttemptId, setSavingAttemptId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = query(collection(firestore, "publishedExams"), orderBy("publishedAt", "desc"), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const row = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: toString(row.name, d.id),
              accessCode: toString(row.accessCode, "------"),
              status: toString(row.status, "published"),
              questionCount: toNumber(row.questionCount, 0),
              timeLimitMinutes: toNumber(row.timeLimitMinutes, 60),
            };
          }),
        );
        setLoading(false);
      },
      () => {
        setError("No fue posible leer examenes publicados.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.accessCode.includes(q));
  }, [rows, search]);

  async function closeExam(row: PublishedExamRow) {
    setClosingId(row.id);
    setError(null);
    try {
      await updateDoc(doc(firestore, "publishedExams", row.id), {
        status: "closed",
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      setError("No fue posible cerrar el examen.");
    } finally {
      setClosingId(null);
    }
  }

  function openAttempts(row: PublishedExamRow) {
    setAttemptsExam(row);
    setAttemptsOpen(true);
  }

  useEffect(() => {
    if (!attemptsOpen || !attemptsExam) return;
    setAttemptsLoading(true);
    setError(null);
    const q = query(
      collection(firestore, "attempts"),
      where("publishedExamId", "==", attemptsExam.id),
      orderBy("createdAt", "desc"),
      limit(200),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAttempts(
          snap.docs.map((d) => {
            const row = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              status: toString(row.status, "in_progress"),
              studentFullName: toString(row.studentFullName, "Estudiante"),
              email: toString(row.email, ""),
              documentId: toString(row.documentId, ""),
              adminMessage: toString(row.adminMessage, "") || null,
            };
          }),
        );
        setAttemptsLoading(false);
      },
      () => {
        setError("No fue posible leer intentos del examen.");
        setAttemptsLoading(false);
      },
    );
    return () => unsub();
  }, [attemptsOpen, attemptsExam]);

  async function sendMessage(attemptId: string) {
    const msg = (messageDrafts[attemptId] ?? "").trim();
    if (!msg) return;
    setSavingAttemptId(attemptId);
    setError(null);
    try {
      await updateDoc(doc(firestore, "attempts", attemptId), {
        adminMessage: msg,
        adminMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setMessageDrafts((p) => ({ ...p, [attemptId]: "" }));
    } catch {
      setError("No fue posible enviar el mensaje.");
    } finally {
      setSavingAttemptId(null);
    }
  }

  async function annulAttempt(attemptId: string) {
    setSavingAttemptId(attemptId);
    setError(null);
    try {
      await updateDoc(doc(firestore, "attempts", attemptId), {
        status: "annulled",
        earnedPoints: 0,
        grade0to5: 0,
        grade0to50: 0,
        annulledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      setError("No fue posible anular el intento.");
    } finally {
      setSavingAttemptId(null);
    }
  }

  async function getAttemptsCount(examId: string) {
    const snap = await getCountFromServer(
      query(collection(firestore, "attempts"), where("publishedExamId", "==", examId)),
    );
    return snap.data().count;
  }

  const [attemptsById, setAttemptsById] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    async function loadCounts() {
      const entries = await Promise.all(
        rows.slice(0, 30).map(async (r) => [r.id, await getAttemptsCount(r.id)] as const),
      );
      if (!cancelled) setAttemptsById(Object.fromEntries(entries));
    }
    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Examenes publicados</h1>
          <p className="mt-1 text-sm text-zinc-600">Gestiona codigos, estado y monitoreo.</p>
        </div>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Buscar</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-zinc-400 sm:w-64"
              placeholder="Nombre o codigo"
            />
          </div>
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          Cargando...
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((row) => {
            const closed = row.status === "closed";
            const annulled = row.status === "annulled";
            return (
              <article key={row.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-950">{row.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {row.questionCount} preguntas • {row.timeLimitMinutes} min
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                      annulled
                        ? "bg-rose-50 text-rose-700 ring-rose-200"
                        : closed
                        ? "bg-zinc-100 text-zinc-700 ring-zinc-200"
                        : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    }`}
                  >
                    {annulled ? "Anulado" : closed ? "Cerrado" : "Publicado"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Codigo</p>
                    <p className="text-lg font-semibold tracking-[0.2em] text-zinc-900">{row.accessCode}</p>
                  </div>
                  <KeyRound className="h-5 w-5 text-zinc-500" />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    Intentos: <span className="font-semibold text-zinc-800">{attemptsById[row.id] ?? 0}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <IconButton
                      onClick={() => openAttempts(row)}
                      disabled={closingId === row.id}
                      className="h-8 w-8"
                      aria-label="Gestionar estudiantes"
                      title="Gestionar estudiantes"
                    >
                      <MessageSquareText className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      variant="danger"
                      onClick={() => closeExam(row)}
                      disabled={closed || annulled || closingId === row.id}
                      className="h-8 w-8"
                      aria-label="Cerrar examen"
                      title="Cerrar examen"
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          No hay examenes publicados.
        </div>
      )}

      {attemptsOpen && attemptsExam ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setAttemptsOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-4xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-950">
                  Estudiantes • {attemptsExam.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Mensajes unidireccionales (docente → estudiante) y anulacion por estudiante.
                </p>
              </div>
              <IconButton
                onClick={() => setAttemptsOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="mt-4 space-y-2">
              {attemptsLoading ? (
                <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                  Cargando...
                </div>
              ) : attempts.length ? (
                attempts.map((a) => {
                  const disabled = savingAttemptId === a.id;
                  const draft = messageDrafts[a.id] ?? "";
                  const annulled = a.status === "annulled";
                  return (
                    <div key={a.id} className="rounded-2xl border border-zinc-200 bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-950">{a.studentFullName}</p>
                          <p className="mt-1 truncate text-xs text-zinc-600">{a.email}</p>
                          <p className="mt-1 truncate text-xs text-zinc-500">{a.documentId}</p>
                        </div>
                        <span
                          className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                            annulled
                              ? "bg-rose-50 text-rose-700 ring-rose-200"
                              : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                          }`}
                        >
                          {annulled ? "Anulado" : a.status}
                        </span>
                      </div>

                      {a.adminMessage ? (
                        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                          {a.adminMessage}
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-zinc-700">Mensaje</span>
                          <input
                            value={draft}
                            onChange={(e) => setMessageDrafts((p) => ({ ...p, [a.id]: e.target.value }))}
                            className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                            placeholder="Mensaje al estudiante"
                            disabled={disabled}
                          />
                        </label>
                        <div className="flex items-center justify-end gap-2">
                          <IconButton
                            variant="primary"
                            onClick={() => void sendMessage(a.id)}
                            disabled={disabled || !draft.trim()}
                            className="h-9 w-9"
                            aria-label="Enviar mensaje"
                            title="Enviar mensaje"
                          >
                            <Send className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            variant="danger"
                            onClick={() => void annulAttempt(a.id)}
                            disabled={disabled || annulled}
                            className="h-9 w-9"
                            aria-label="Anular intento"
                            title="Anular intento"
                          >
                            <Ban className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                  Aun no hay intentos.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
