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
import { BookOpen, CalendarClock, Layers, MapPin, Plus, Save, Search, Users, Power } from "lucide-react";
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
  const stats = useMemo(() => {
    const total = rows.length;
    const activeCount = rows.filter((r) => r.active).length;
    return { total, activeCount, inactiveCount: total - activeCount };
  }, [rows]);

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
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-950">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total</p>
            <p className="text-base font-semibold text-zinc-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Activos</p>
            <p className="text-base font-semibold text-emerald-700">{stats.activeCount}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Inactivos</p>
            <p className="text-base font-semibold text-zinc-700">{stats.inactiveCount}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <h3 className="text-sm font-semibold text-zinc-900">Crear nuevo</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Usa un nombre claro. El ID se genera automáticamente a partir del texto.
          </p>
          <div className="mt-3 grid gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              placeholder={`Nuevo ${title.toLowerCase()}`}
              disabled={savingId === "__new__"}
            />
            <button
              type="button"
              onClick={() => void create()}
              disabled={!newName.trim() || savingId === "__new__"}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Crear
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Buscar por nombre o ID"
            />
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">Cargando...</div>
            ) : filtered.length ? (
              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <div className="grid grid-cols-[140px_1fr_90px_120px] items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-2 py-2 text-[11px] font-semibold text-zinc-600">
                  <div>ID</div>
                  <div>Nombre</div>
                  <div>Activo</div>
                  <div className="text-right">Acciones</div>
                </div>
                <div className="max-h-[58vh] overflow-y-auto">
                  {filtered.map((r) => {
                    const disabled = savingId === r.id;
                    const draft = draftNames[r.id] ?? r.name;
                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-[140px_1fr_90px_120px] items-center gap-2 border-b border-zinc-100 px-2 py-2"
                      >
                        <div className="truncate rounded-lg bg-zinc-100 px-2 py-1 text-xs font-mono text-zinc-700">{r.id}</div>
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
              <div className="rounded-xl bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">Sin registros.</div>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
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

  const iconByKey = useMemo(
    () =>
      ({
        subjects: BookOpen,
        sites: MapPin,
        shifts: Layers,
        moments: CalendarClock,
        groups: Users,
      }) as Record<string, React.ComponentType<{ className?: string }>>,
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Catálogos</h1>
          <p className="mt-1 text-sm text-zinc-600">Nueva vista para visualizar y crear catálogos de forma más rápida.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {catalogs.map((c) => {
            const activeTab = c.key === activeKey;
            const Icon = iconByKey[c.key] ?? Layers;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setActiveKey(c.key)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  activeTab
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{c.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <CollectionPanel
        title={active.title}
        description={active.description}
        collectionName={active.collectionName}
      />
    </div>
  );
}
