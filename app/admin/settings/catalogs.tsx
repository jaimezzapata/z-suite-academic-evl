"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { normalizeSentenceText } from "@/lib/text/normalize";
import { Plus, Save, Power } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";

type Row = {
  id: string;
  name: string;
  active: boolean;
};

function toRow(id: string, data: Record<string, unknown>): Row {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  const active = typeof data.active === "boolean" ? data.active : true;
  return { id, name, active };
}

function Section({
  title,
  description,
  collectionName,
}: {
  title: string;
  description: string;
  collectionName: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = query(collection(firestore, collectionName), orderBy("name"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => toRow(d.id, d.data() as Record<string, unknown>)));
        setLoading(false);
      },
      () => {
        setError(`No fue posible leer ${collectionName}. Revisa reglas/permisos.`);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [collectionName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [rows, search]);

  async function create() {
    const res = normalizeSentenceText(newName);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    try {
      await addDoc(collection(firestore, collectionName), {
        name: res.value,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewName("");
    } catch {
      setError(`No fue posible crear en ${collectionName}.`);
    }
  }

  async function saveName(id: string) {
    const res = normalizeSentenceText(draftNames[id] ?? "");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      await updateDoc(doc(firestore, collectionName, id), {
        name: res.value,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setError(`No fue posible guardar cambios en ${collectionName}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    setSavingId(id);
    setError(null);
    try {
      await updateDoc(doc(firestore, collectionName, id), {
        active: next,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setError(`No fue posible actualizar estado en ${collectionName}.`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-950">{title}</h2>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Buscar</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 sm:w-56"
            placeholder="Nombre"
          />
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-3">
        {loading ? (
          <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
            Cargando...
          </div>
        ) : filtered.length ? (
          <div className="rounded-xl border border-zinc-200">
            <div className="hidden grid-cols-[1fr_120px_168px] gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600 sm:grid">
              <div className="min-w-0">Nombre</div>
              <div>Estado</div>
              <div className="text-right">Acciones</div>
            </div>

            <div className="grid gap-2 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_168px] sm:items-center">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  placeholder={`Nuevo ${title.toLowerCase()}`}
                />
                <div className="hidden sm:block" />
                <div className="flex justify-end">
                  <IconButton
                    variant="primary"
                    onClick={create}
                    disabled={!newName.trim()}
                    className="h-9 w-9"
                    aria-label={`Crear ${title}`}
                    title={`Crear ${title}`}
                  >
                    <Plus className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>

              <div className="h-px bg-zinc-200" />

              {filtered.map((r) => {
                const disabled = savingId === r.id;
                const draft = draftNames[r.id] ?? r.name;
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_168px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <input
                        value={draft}
                        onChange={(e) => setDraftNames((p) => ({ ...p, [r.id]: e.target.value }))}
                        className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:opacity-50"
                        disabled={disabled}
                      />
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          r.active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                        }`}
                      >
                        {r.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <IconButton
                        onClick={() => saveName(r.id)}
                        disabled={disabled}
                        className="h-8 w-8"
                        aria-label="Guardar"
                        title="Guardar"
                      >
                        <Save className="h-4 w-4" />
                      </IconButton>

                      <IconButton
                        variant={r.active ? "danger" : "secondary"}
                        onClick={() => toggleActive(r.id, !r.active)}
                        disabled={disabled}
                        className="h-8 w-8"
                        aria-label={r.active ? "Inactivar" : "Activar"}
                        title={r.active ? "Inactivar" : "Activar"}
                      >
                        <Power className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
            Sin registros.
          </div>
        )}
      </div>
    </section>
  );
}

export function CatalogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Catalogos</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Crea, edita, lista y gestiona sedes, momentos, grupos y jornadas.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section
          title="Materias"
          description="Materias o asignaturas (por ejemplo Frontend 1)."
          collectionName="subjects"
        />
        <Section
          title="Sedes"
          description="Lugares o sedes disponibles para examenes."
          collectionName="sites"
        />
        <Section
          title="Jornadas"
          description="Jornada o turno (manana, tarde, noche)."
          collectionName="shifts"
        />
        <Section
          title="Momentos"
          description="Momentos de evaluacion (M1, M2, recuperacion)."
          collectionName="moments"
        />
        <Section
          title="Grupos"
          description="Grupos o cursos (por ejemplo 10A Manana)."
          collectionName="groups"
        />
      </div>
    </div>
  );
}
