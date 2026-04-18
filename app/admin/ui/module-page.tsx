"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, getDocs, limit, query } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";

type ModulePageProps = {
  title: string;
  description: string;
  primaryCollection: string;
  secondaryCollection?: string;
};

type PreviewRow = {
  id: string;
  label: string;
};

function toLabel(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function ModulePage({
  title,
  description,
  primaryCollection,
  secondaryCollection,
}: ModulePageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [primaryCount, setPrimaryCount] = useState(0);
  const [secondaryCount, setSecondaryCount] = useState<number | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [primaryCountSnap, primaryPreviewSnap, secondaryCountSnap] = await Promise.all([
          getCountFromServer(collection(firestore, primaryCollection)),
          getDocs(query(collection(firestore, primaryCollection), limit(8))),
          secondaryCollection
            ? getCountFromServer(collection(firestore, secondaryCollection))
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setPrimaryCount(primaryCountSnap.data().count);
        setSecondaryCount(secondaryCountSnap ? secondaryCountSnap.data().count : null);
        setPreviewRows(
          primaryPreviewSnap.docs.map((d) => {
            const row = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              label: toLabel(row.name ?? row.statement ?? row.title, d.id),
            };
          }),
        );
      } catch {
        if (!cancelled) {
          setError("No fue posible leer datos de Firestore para este modulo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [primaryCollection, secondaryCollection]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{title}</h1>
        <p className="mt-1 text-sm text-zinc-600">{description}</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Registros en {primaryCollection}</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {loading ? "..." : primaryCount}
          </p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">
            {secondaryCollection ? `Registros en ${secondaryCollection}` : "Estado de sincronizacion"}
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {secondaryCollection ? (loading ? "..." : secondaryCount ?? 0) : loading ? "..." : "OK"}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Vista rapida</h2>
        <p className="text-sm text-zinc-500">Primeros registros detectados en este modulo.</p>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {previewRows.length ? (
            previewRows.map((row) => (
              <div
                key={row.id}
                className="rounded-xl bg-zinc-50 px-3 py-2 text-sm"
              >
                <span className="truncate text-zinc-800">{row.label}</span>
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
              {loading ? "Cargando datos..." : "No hay registros aun en esta coleccion."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
