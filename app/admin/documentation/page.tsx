"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { BookOpen, Copy, ExternalLink, RefreshCw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { firestore } from "@/lib/firebase/client";
import { firebaseAuth } from "@/lib/firebase/client";
import { AnimatePresence, motion } from "framer-motion";

type CatalogItem = { id: string; name: string };
type StudyDocRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  institution: "CESDE" | "SENA" | string;
  slug: string;
  accessCode: string;
  cutoffWeek: number | null;
  cutoffMoment: string;
  active: boolean;
};

function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export default function AdminDocumentationHubPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [docs, setDocs] = useState<StudyDocRow[]>([]);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StudyDocRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [subjectsSnap, docsSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "studyDocs"), where("active", "==", true), limit(800))),
        ]);
        if (cancelled) return;
        setSubjects(subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setDocs(
          docsSnap.docs.map((d) => {
            const row = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              subjectId: safeString(row.subjectId, ""),
              subjectName: safeString(row.subjectName, ""),
              institution: safeString(row.institution, ""),
              slug: safeString(row.slug, ""),
              accessCode: safeString(row.accessCode, ""),
              cutoffWeek: safeNumber(row.cutoffWeek),
              cutoffMoment: safeString(row.cutoffMoment, ""),
              active: row.active === true,
            };
          }),
        );
      } catch {
        if (!cancelled) setError("No fue posible cargar la central de documentación.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const docsBySubject = useMemo(() => {
    const map = new Map<string, StudyDocRow[]>();
    docs.forEach((d) => {
      const key = d.subjectId || "sin-materia";
      map.set(key, [...(map.get(key) ?? []), d]);
    });
    return map;
  }, [docs]);

  async function deleteDoc(row: StudyDocRow) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    setDeleteLoadingId(row.id);
    setError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/docs/delete", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ docId: row.id }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `No fue posible eliminar (HTTP ${res.status}).`);
        return;
      }
      setDocs((prev) => prev.filter((d) => d.id !== row.id));
      setPendingDelete(null);
    } catch {
      setError("No fue posible eliminar la documentación.");
    } finally {
      setDeleteLoadingId(null);
    }
  }

  function buildAbsolute(urlPath: string) {
    if (typeof window === "undefined") return urlPath;
    return `${window.location.origin}${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Documentación</h1>
            <p className="mt-1 text-sm text-zinc-600">Central para publicar y compartir documentación por materia.</p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-900 text-white">
            <BookOpen className="h-5 w-5" />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">{loading ? "Cargando..." : `${subjects.length} materias`}</p>
          <Link
            href="/admin/settings/ai-docs"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <BookOpen className="h-4 w-4" />
            Generar / Publicar
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-950">Materias</h2>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full table-fixed text-left">
            <thead className="bg-zinc-50">
              <tr className="text-xs text-zinc-500">
                <th className="w-[38%] px-3 py-2 font-medium">Materia</th>
                <th className="w-[62%] px-3 py-2 font-medium">Publicaciones</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const rows = (docsBySubject.get(s.id) ?? []).sort((a, b) => a.institution.localeCompare(b.institution));
                return (
                  <tr key={s.id} className="border-t border-zinc-100 text-sm">
                    <td className="px-3 py-3 align-top">
                      <div className="font-medium text-zinc-900">{s.name}</div>
                      <div className="text-xs text-zinc-500">{s.id}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {rows.length ? (
                        <div className="space-y-2">
                          {rows.map((d) => {
                            const urlPath = `/study/${d.slug}`;
                            const url = buildAbsolute(urlPath);
                            const cutoff =
                              d.institution === "CESDE"
                                ? `${d.cutoffWeek ? `S${d.cutoffWeek}` : "-"} ${d.cutoffMoment ? `· ${d.cutoffMoment}` : ""}`.trim()
                                : d.cutoffWeek
                                  ? `Semana ${d.cutoffWeek}`
                                  : "-";
                            return (
                              <div key={d.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-zinc-900">{d.institution}</div>
                                    <div className="mt-0.5 text-xs text-zinc-500">Hasta: {cutoff || "-"}</div>
                                    <div className="mt-1 truncate text-xs text-zinc-500">{urlPath}</div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <a
                                      href={urlPath}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      Abrir
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => navigator.clipboard.writeText(url)}
                                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                    >
                                      <Copy className="h-4 w-4" />
                                      URL
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => navigator.clipboard.writeText(d.accessCode)}
                                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                    >
                                      <Copy className="h-4 w-4" />
                                      Código
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPendingDelete(d)}
                                      disabled={deleteLoadingId === d.id}
                                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      {deleteLoadingId === d.id ? "Eliminando..." : "Eliminar"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500">Sin publicación aún.</div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!subjects.length ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-sm text-zinc-500">
                    {loading ? "Cargando..." : "No hay materias."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {pendingDelete ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
              onClick={() => (deleteLoadingId ? null : setPendingDelete(null))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950">Eliminar documentación</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Esta acción es irreversible. Se borrarán las semanas publicadas y sus revisiones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => (deleteLoadingId ? null : setPendingDelete(null))}
                  className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                  disabled={!!deleteLoadingId}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-5 py-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-500">Materia</span>
                    <span className="text-sm font-semibold text-zinc-900">
                      {pendingDelete.subjectName || pendingDelete.subjectId || "-"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-500">Institución</span>
                    <span className="text-sm font-semibold text-zinc-900">{pendingDelete.institution || "-"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-500">URL</span>
                    <span className="text-sm font-semibold text-zinc-900">/study/{pendingDelete.slug || "-"}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  disabled={!!deleteLoadingId}
                  className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void deleteDoc(pendingDelete)}
                  disabled={deleteLoadingId === pendingDelete.id}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteLoadingId === pendingDelete.id ? "Eliminando..." : "Eliminar definitivamente"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
