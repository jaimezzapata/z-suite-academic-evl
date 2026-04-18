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
  setDoc,
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

function toStableId(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function toRow(id: string, data: Record<string, unknown>): Row {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  const active = typeof data.active === "boolean" ? data.active : true;
  return { id, name, active };
}

function CollectionPanel({
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
    const baseId = toStableId(res.value);
    if (!baseId) {
      setError("ID inválido. Usa letras, números y guion bajo.");
      return;
    }

    const byId = rows.find((r) => r.id.toLowerCase() === baseId.toLowerCase());
    if (byId) {
      setError(`Ya existe: "${byId.name}" (ID: ${byId.id}). Edita el existente.`);
      return;
    }

    const normalizedName = res.value.trim().toLowerCase();
    const byName = rows.find((r) => r.name.trim().toLowerCase() === normalizedName);
    if (byName) {
      setError(`Ya existe: "${byName.name}" (ID: ${byName.id}). Edita el existente.`);
      return;
    }

    setSavingId("__new__");
    setError(null);
    try {
      await setDoc(doc(collection(firestore, collectionName), baseId), {
        id: baseId,
        name: res.value,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewName("");
    } catch {
      setError(`No fue posible crear en ${collectionName}.`);
    } finally {
      setSavingId(null);
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold tracking-tight text-zinc-950">{title}</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
              {rows.length}
            </span>
          </div>
          <p className="mt-0.5 hidden text-[11px] text-zinc-500 sm:block">{description}</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[220px_1fr_auto] sm:items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            className="h-8 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 sm:w-[220px]"
            placeholder={`Nuevo ${title.toLowerCase()}`}
            disabled={savingId === "__new__"}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 sm:w-56"
            placeholder="Buscar"
          />
          <IconButton
            variant="primary"
            onClick={create}
            disabled={!newName.trim() || savingId === "__new__"}
            className="h-8 w-8"
            aria-label={`Crear ${title}`}
            title={`Crear ${title}`}
          >
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {error ? (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-2">
        {loading ? (
          <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
            Cargando...
          </div>
        ) : filtered.length ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <div className="grid grid-cols-[1fr_84px_96px] items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-2 py-2 text-[11px] font-semibold text-zinc-600 sm:grid-cols-[1fr_110px_120px]">
              <div className="text-zinc-600">Nombre</div>
              <div className="text-zinc-600">Activo</div>
              <div className="text-right text-zinc-600">Acciones</div>
            </div>

            <div className="max-h-[52vh] overflow-y-auto">
              {filtered.map((r) => {
                const disabled = savingId === r.id;
                const draft = draftNames[r.id] ?? r.name;
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_84px_96px] items-center gap-2 border-b border-zinc-100 px-2 py-2 sm:grid-cols-[1fr_110px_120px]"
                  >
                    <input
                      value={draft}
                      onChange={(e) => setDraftNames((p) => ({ ...p, [r.id]: e.target.value }))}
                      className="h-8 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:opacity-50"
                      disabled={disabled}
                    />

                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${
                        r.active
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                      }`}
                    >
                      {r.active ? "Sí" : "No"}
                    </span>

                    <div className="flex items-center justify-end gap-2">
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
          <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
            Sin registros.
          </div>
        )}
      </div>
    </section>
  );
}

export function CatalogsPage() {
  const catalogs = useMemo(
    () =>
      [
        {
          key: "subjects",
          title: "Materias",
          description: "Materias o asignaturas (por ejemplo Front 1).",
          collectionName: "subjects",
        },
        {
          key: "sites",
          title: "Sedes",
          description: "Lugares o sedes disponibles para examenes.",
          collectionName: "sites",
        },
        {
          key: "shifts",
          title: "Jornadas",
          description: "Jornada o turno (manana, tarde, noche).",
          collectionName: "shifts",
        },
        {
          key: "moments",
          title: "Momentos",
          description: "Momentos de evaluacion (M1, M2, recuperacion).",
          collectionName: "moments",
        },
        {
          key: "groups",
          title: "Grupos",
          description: "Grupos o cursos (por ejemplo 10A Manana).",
          collectionName: "groups",
        },
      ] as const,
    [],
  );

  const [activeKey, setActiveKey] = useState<(typeof catalogs)[number]["key"]>("subjects");
  const active = catalogs.find((c) => c.key === activeKey) ?? catalogs[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Catalogos</h1>
          <p className="mt-1 text-sm text-zinc-600">Gestiona datos base de la app.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
          <div className="grid gap-1">
            {catalogs.map((c) => {
              const active = c.key === activeKey;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActiveKey(c.key)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                    active ? "bg-zinc-950 text-white" : "text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {c.title}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">
          <CollectionPanel
            title={active.title}
            description={active.description}
            collectionName={active.collectionName}
          />
        </div>
      </div>
    </div>
  );
}
