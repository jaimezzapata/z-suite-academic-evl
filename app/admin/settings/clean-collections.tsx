"use client";

import { useMemo, useState } from "react";
import { Trash2, CheckCircle2 } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase/client";

type CollectionItem = {
  name: string;
  label: string;
  description: string;
  tone: "neutral" | "danger";
};

const COLLECTIONS: CollectionItem[] = [
  { name: "attempts", label: "Intentos", description: "Resultados e intentos de exámenes", tone: "danger" },
  { name: "publishedExams", label: "Exámenes publicados", description: "Publicaciones/códigos de examen", tone: "danger" },
  { name: "examTemplates", label: "Plantillas de examen", description: "Estructura y configuración de exámenes", tone: "danger" },
  { name: "questions", label: "Banco de preguntas", description: "Preguntas y sus metadatos", tone: "danger" },
  { name: "studyDocs", label: "Documentación", description: "Cuadernillos y capítulos (entries/revisions)", tone: "danger" },
  { name: "subjects", label: "Materias", description: "Catálogo de materias", tone: "neutral" },
  { name: "groups", label: "Grupos (CESDE)", description: "Catálogo de grupos", tone: "neutral" },
  { name: "fichas", label: "Fichas (SENA)", description: "Catálogo de fichas (7–9 dígitos)", tone: "neutral" },
  { name: "sites", label: "Sedes", description: "Catálogo de sedes", tone: "neutral" },
  { name: "shifts", label: "Jornadas", description: "Catálogo de jornadas", tone: "neutral" },
  { name: "moments", label: "Momentos", description: "Catálogo de momentos", tone: "neutral" },
  { name: "trimesters", label: "Trimestres (SENA)", description: "Catálogo de trimestres", tone: "neutral" },
];

export function CleanCollections() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selectedItem = useMemo(() => COLLECTIONS.find((c) => c.name === selected) ?? null, [selected]);
  const canConfirm = useMemo(() => confirm.trim().toUpperCase() === "ELIMINAR" && !!selected, [confirm, selected]);

  async function wipeOne() {
    if (!canConfirm) return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/wipe-collection", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: selected, confirm: "ELIMINAR" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const msg = typeof data?.error === "string" ? data.error : "No fue posible completar la limpieza.";
        setError(msg);
        return;
      }
      setDone(true);
    } catch {
      setError("No fue posible completar la limpieza.");
    } finally {
      setLoading(false);
    }
  }

  function openFor(name: string) {
    setOpen(true);
    setSelected(name);
    setConfirm("");
    setDone(false);
    setError(null);
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-zinc-950">Limpiar por colección</h2>
          <p className="mt-1 text-sm text-zinc-600">Borra una colección completa (incluyendo subcolecciones) sin tocar el resto.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COLLECTIONS.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => openFor(c.name)}
            className={`group rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              c.tone === "danger" ? "border-rose-200 hover:border-rose-300" : "border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-950">{c.label}</p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{c.description}</p>
              </div>
              <div
                className={`grid h-10 w-10 place-items-center rounded-2xl ring-1 transition ${
                  c.tone === "danger"
                    ? "bg-rose-50 text-rose-700 ring-rose-100 group-hover:bg-rose-100"
                    : "bg-zinc-50 text-zinc-700 ring-zinc-100 group-hover:bg-zinc-100"
                }`}
                aria-hidden="true"
              >
                <Trash2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-mono text-[11px] text-zinc-400">{c.name}</div>
          </button>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button type="button" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-16 sm:bottom-auto sm:rounded-3xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Limpiar colección</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {selectedItem ? (
                    <>
                      Vas a eliminar <strong>{selectedItem.label}</strong>.
                    </>
                  ) : (
                    "Selecciona una colección."
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {selectedItem ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold text-zinc-600">Detalle</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{selectedItem.label}</p>
                <p className="mt-1 text-xs text-zinc-600">{selectedItem.description}</p>
                <p className="mt-2 font-mono text-[11px] text-zinc-500">{selected}</p>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="text-sm font-semibold">Acción irreversible</p>
              <p className="mt-1 text-xs text-amber-800">Esto borrará documentos y subcolecciones dentro de la colección seleccionada.</p>
            </div>

            {done ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                Limpieza completada.
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            <label className="mt-4 grid gap-1">
              <span className="text-xs font-semibold text-zinc-700">Confirmación</span>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-10 rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                placeholder="Escribe ELIMINAR"
              />
            </label>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canConfirm || loading}
                onClick={() => void wipeOne()}
                className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedItem?.tone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-zinc-900 hover:bg-zinc-800"
                }`}
              >
                {loading ? "Limpiando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
