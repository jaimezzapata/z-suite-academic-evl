"use client";

import { useMemo, useState } from "react";
import { firebaseAuth } from "@/lib/firebase/client";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canConfirm = useMemo(() => confirm.trim().toUpperCase() === "ELIMINAR TODO", [confirm]);

  async function wipe() {
    if (!canConfirm) return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/wipe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: "ELIMINAR TODO" }),
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

  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-zinc-950">Danger Zone</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Elimina datos operativos de Firestore (preguntas, plantillas, publicados, intentos, catálogos y{" "}
            documentación/cuadernillos) y conserva <strong>admins</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setConfirm("");
            setDone(false);
            setError(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          <Trash2 className="h-4 w-4" />
          Limpiar Firestore
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Acción irreversible</p>
            <p className="mt-1 text-xs text-amber-800">
              Esto borrará colecciones completas (incluyendo subcolecciones) y no se puede deshacer.
            </p>
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button type="button" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-16 sm:bottom-auto sm:rounded-3xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Confirmar limpieza</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Escribe <strong>ELIMINAR TODO</strong> para confirmar.
                </p>
              </div>
              <IconButton onClick={() => setOpen(false)} className="h-9 w-9" aria-label="Cerrar" title="Cerrar">
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            {done ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Limpieza completada. Puedes recargar el panel y volver a sembrar catálogos/preguntas.
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
                placeholder="ELIMINAR TODO"
                disabled={loading || done}
              />
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void wipe()}
                disabled={!canConfirm || loading || done}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Eliminando..." : "Eliminar todo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

