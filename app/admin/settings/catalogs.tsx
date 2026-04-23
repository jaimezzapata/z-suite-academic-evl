"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
import {
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  GraduationCap,
  Hash,
  Layers,
  Pencil,
  Plus,
  Power,
  Search,
  Users,
  X,
} from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";

type Row = {
  id: string;
  name: string;
  active: boolean;
};

type FichaRow = {
  id: string;
  number: string;
  trimesterId: string;
  active: boolean;
};

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-zinc-950">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

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

function toFichaRow(id: string, data: Record<string, unknown>): FichaRow {
  const number = typeof data.number === "string" && data.number.trim() ? data.number.trim() : id;
  const active = typeof data.active === "boolean" ? data.active : true;
  const trimesterId = typeof data.trimesterId === "string" ? data.trimesterId : "";
  return { id, number, trimesterId, active };
}

function isValidFichaNumber(value: string) {
  const v = value.trim();
  if (!/^\d+$/.test(v)) return false;
  return v.length >= 7 && v.length <= 9;
}

function CollectionPanel({
  title,
  description,
  collectionName,
  compactHeader = false,
}: {
  title: string;
  description: string;
  collectionName: string;
  compactHeader?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
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
    return rows
      .filter((r) => {
        if (filter === "active") return r.active;
        if (filter === "inactive") return !r.active;
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
      });
  }, [rows, search, filter]);

  const createPreview = useMemo(() => {
    const res = normalizeSentenceText(newName);
    if (!res.ok) return { ok: false as const, id: "", name: "" };
    const id = toStableId(res.value);
    return { ok: true as const, id, name: res.value };
  }, [newName]);

  const editRow = useMemo(() => {
    if (!editId) return null;
    return rows.find((r) => r.id === editId) ?? null;
  }, [editId, rows]);

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
      setCreateOpen(false);
    } catch {
      setError(`No fue posible crear en ${collectionName}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function saveName(id: string) {
    const res = normalizeSentenceText(editName ?? "");
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
      setEditId(null);
      setEditName("");
      setEditOpen(false);
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

  async function copyId(id: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1200);
    } catch {
      setError("No fue posible copiar el ID.");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!compactHeader ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold tracking-tight text-zinc-950">{title}</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                {rows.length}
              </span>
            </div>
            <p className="mt-0.5 hidden text-[11px] text-zinc-500 sm:block">{description}</p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{rows.length} registros</p>
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Buscar por nombre o ID"
            />
          </div>

          <div className="relative w-full sm:w-36">
            <select
              value={filter}
              onChange={(e) => {
                const id = e.target.value;
                if (id === "all" || id === "active" || id === "inactive") setFilter(id);
              }}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          <div className="relative w-full sm:w-56">
            <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Agregar y Enter"
              disabled={savingId === "__new__"}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setNewName("");
              setCreateOpen(true);
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-2">
        {loading ? (
          <div className="rounded-xl bg-zinc-50 px-3 py-5 text-center text-sm text-zinc-500">
            Cargando...
          </div>
        ) : filtered.length ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <div className="grid grid-cols-[1fr_150px_84px_112px] items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-semibold text-zinc-600">
              <div className="text-zinc-600">Nombre</div>
              <div className="text-zinc-600">ID</div>
              <div className="text-zinc-600">Estado</div>
              <div className="text-right text-zinc-600">Acciones</div>
            </div>

            <div className="max-h-[52vh] overflow-y-auto">
              {filtered.map((r) => {
                const disabled = savingId === r.id;
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_150px_84px_112px] items-center gap-3 border-b border-zinc-100 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{r.name}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs text-zinc-700">{r.id}</span>
                      <button
                        type="button"
                        onClick={() => void copyId(r.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        title="Copiar ID"
                        aria-label="Copiar ID"
                      >
                        {copiedId === r.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>

                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${
                        r.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                      }`}
                    >
                      {r.active ? "Activo" : "Inactivo"}
                    </span>

                    <div className="flex items-center justify-end gap-2">
                      <IconButton
                        onClick={() => {
                          setError(null);
                          setEditId(r.id);
                          setEditName(r.name);
                          setEditOpen(true);
                        }}
                        disabled={disabled}
                        className="h-8 w-8 rounded-lg"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        variant={r.active ? "danger" : "secondary"}
                        onClick={() => toggleActive(r.id, !r.active)}
                        disabled={disabled}
                        className="h-8 w-8 rounded-lg"
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
          <div className="rounded-xl bg-zinc-50 px-3 py-5 text-center text-sm text-zinc-500">
            Sin registros. Crea el primero con “Nuevo”.
          </div>
        )}
      </div>

      {createOpen ? (
        <ModalShell
          title={`Nuevo ${title}`}
          onClose={() => {
            setCreateOpen(false);
          }}
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Nombre</p>
              <p className="mt-1 text-xs text-zinc-500">Se genera un ID estable automáticamente (se usa en selects/segmentación).</p>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void create();
                }}
                className="mt-3 h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                placeholder={`Ej: ${title === "Materias" ? "Front 1" : "Nueva opción"}`}
                disabled={savingId === "__new__"}
                autoFocus
              />
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">ID</p>
              <p className="mt-1 font-mono text-sm font-semibold text-zinc-900">{createPreview.ok ? createPreview.id || "—" : "—"}</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void create()}
                disabled={!newName.trim() || savingId === "__new__"}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingId === "__new__" ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {editOpen && editId ? (
        <ModalShell
          title={`Editar ${title}`}
          onClose={() => {
            setEditOpen(false);
            setEditId(null);
            setEditName("");
          }}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">ID</p>
              <p className="mt-1 font-mono text-sm font-semibold text-zinc-900">{editId}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-zinc-900">Nombre</p>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editId) void saveName(editId);
                }}
                className="mt-3 h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                autoFocus
                disabled={savingId === editId}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (editRow) void toggleActive(editRow.id, !editRow.active);
                }}
                disabled={!editRow || savingId === editId}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editRow?.active ? "Inactivar" : "Activar"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditId(null);
                    setEditName("");
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editId) void saveName(editId);
                  }}
                  disabled={!editName.trim() || savingId === editId}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingId === editId ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function FichasPanel({ compactHeader = false }: { compactHeader?: boolean }) {
  const [rows, setRows] = useState<FichaRow[]>([]);
  const [trimesters, setTrimesters] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newTrimesterId, setNewTrimesterId] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editTrimesterId, setEditTrimesterId] = useState("");

  useEffect(() => {
    const q = query(collection(firestore, "fichas"), orderBy("number"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => toFichaRow(d.id, d.data() as Record<string, unknown>)));
        setLoading(false);
      },
      () => {
        setError("No fue posible leer fichas. Revisa reglas/permisos.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(firestore, "trimesters"), orderBy("name"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTrimesters(snap.docs.map((d) => toRow(d.id, d.data() as Record<string, unknown>)));
      },
      () => {
        setTrimesters([]);
      },
    );
    return () => unsub();
  }, []);

  const trimesterNameById = useMemo(() => {
    const m = new Map<string, string>();
    trimesters.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [trimesters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === "active") return r.active;
        if (filter === "inactive") return !r.active;
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.number} ${r.id} ${trimesterNameById.get(r.trimesterId) ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
  }, [filter, rows, search, trimesterNameById]);

  async function copyId(id: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1200);
    } catch {
      setError("No fue posible copiar la ficha.");
    }
  }

  async function create() {
    const number = newNumber.trim();
    if (!isValidFichaNumber(number)) {
      setError("La ficha debe ser numérica y tener 7 a 9 dígitos.");
      return;
    }
    const byId = rows.find((r) => r.id === number);
    if (byId) {
      setError(`Ya existe la ficha ${byId.number}.`);
      return;
    }
    setSavingId("__new__");
    setError(null);
    try {
      await setDoc(doc(collection(firestore, "fichas"), number), {
        id: number,
        number,
        name: number,
        trimesterId: newTrimesterId || null,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewNumber("");
      setNewTrimesterId("");
      setCreateOpen(false);
    } catch {
      setError("No fue posible crear la ficha.");
    } finally {
      setSavingId(null);
    }
  }

  async function save() {
    if (!editId) return;
    const number = editNumber.trim();
    if (!isValidFichaNumber(number)) {
      setError("La ficha debe ser numérica y tener 7 a 9 dígitos.");
      return;
    }
    setSavingId(editId);
    setError(null);
    try {
      if (number !== editId) {
        setError("No se puede cambiar el número de ficha (ID). Crea una nueva ficha si necesitas otro número.");
        return;
      }
      await updateDoc(doc(firestore, "fichas", editId), {
        number,
        name: number,
        trimesterId: editTrimesterId || null,
        updatedAt: serverTimestamp(),
      });
      setEditOpen(false);
      setEditId(null);
      setEditNumber("");
      setEditTrimesterId("");
    } catch {
      setError("No fue posible guardar la ficha.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    setSavingId(id);
    setError(null);
    try {
      await updateDoc(doc(firestore, "fichas", id), {
        active: next,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setError("No fue posible actualizar el estado.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!compactHeader ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold tracking-tight text-zinc-950">Fichas</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">{rows.length}</span>
            </div>
            <p className="mt-0.5 hidden text-[11px] text-zinc-500 sm:block">Segmentación SENA (7–9 dígitos) asociada a trimestre.</p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{rows.length} registros</p>
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Buscar ficha..."
            />
          </div>

          <div className="relative w-full sm:w-36">
            <select
              value={filter}
              onChange={(e) => {
                const id = e.target.value;
                if (id === "all" || id === "active" || id === "inactive") setFilter(id);
              }}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          <div className="relative w-full sm:w-56">
            <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Ficha y Enter"
              disabled={savingId === "__new__"}
              inputMode="numeric"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setNewNumber("");
              setNewTrimesterId("");
              setCreateOpen(true);
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="mt-2">
        {loading ? (
          <div className="rounded-xl bg-zinc-50 px-3 py-5 text-center text-sm text-zinc-500">Cargando...</div>
        ) : filtered.length ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <div className="grid grid-cols-[1fr_140px_84px_112px] items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-semibold text-zinc-600">
              <div>Ficha</div>
              <div>Trimestre</div>
              <div>Estado</div>
              <div className="text-right">Acciones</div>
            </div>
            <div className="max-h-[52vh] overflow-y-auto">
              {filtered.map((r) => {
                const disabled = savingId === r.id;
                const trimesterName = trimesterNameById.get(r.trimesterId) ?? (r.trimesterId ? r.trimesterId : "—");
                return (
                  <div key={r.id} className="grid grid-cols-[1fr_140px_84px_112px] items-center gap-3 border-b border-zinc-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-zinc-900">{r.number}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-700">{trimesterName}</p>
                    </div>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${
                        r.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                      }`}
                    >
                      {r.active ? "Activo" : "Inactivo"}
                    </span>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void copyId(r.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        title="Copiar ficha"
                        aria-label="Copiar ficha"
                      >
                        {copiedId === r.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <IconButton
                        onClick={() => {
                          setError(null);
                          setEditId(r.id);
                          setEditNumber(r.number);
                          setEditTrimesterId(r.trimesterId);
                          setEditOpen(true);
                        }}
                        disabled={disabled}
                        className="h-8 w-8 rounded-lg"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        variant={r.active ? "danger" : "secondary"}
                        onClick={() => void toggleActive(r.id, !r.active)}
                        disabled={disabled}
                        className="h-8 w-8 rounded-lg"
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
          <div className="rounded-xl bg-zinc-50 px-3 py-5 text-center text-sm text-zinc-500">Sin fichas. Crea la primera con “Nuevo”.</div>
        )}
      </div>

      {createOpen ? (
        <ModalShell
          title="Nueva ficha (SENA)"
          onClose={() => {
            setCreateOpen(false);
          }}
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Número de ficha</p>
              <p className="mt-1 text-xs text-zinc-500">Debe tener 7 a 9 dígitos. Ej: 3456789</p>
              <input
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void create();
                }}
                className="mt-3 h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                placeholder="Ej: 3456789"
                autoFocus
                disabled={savingId === "__new__"}
                inputMode="numeric"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Trimestre (opcional)</p>
              <div className="mt-3">
                <select
                  value={newTrimesterId}
                  onChange={(e) => setNewTrimesterId(e.target.value)}
                  className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
                >
                  <option value="">Sin trimestre</option>
                  {trimesters
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void create()}
                disabled={!newNumber.trim() || savingId === "__new__"}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingId === "__new__" ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {editOpen && editId ? (
        <ModalShell
          title="Editar ficha"
          onClose={() => {
            setEditOpen(false);
            setEditId(null);
            setEditNumber("");
            setEditTrimesterId("");
          }}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">ID</p>
              <p className="mt-1 font-mono text-sm font-semibold text-zinc-900">{editId}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Número</p>
              <input
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                className="mt-3 h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                disabled
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Trimestre (opcional)</p>
              <div className="mt-3">
                <select
                  value={editTrimesterId}
                  onChange={(e) => setEditTrimesterId(e.target.value)}
                  disabled={savingId === editId}
                  className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Sin trimestre</option>
                  {trimesters
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const row = rows.find((x) => x.id === editId) ?? null;
                  if (row) void toggleActive(row.id, !row.active);
                }}
                disabled={savingId === editId}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {(rows.find((x) => x.id === editId)?.active ?? true) ? "Inactivar" : "Activar"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditId(null);
                    setEditNumber("");
                    setEditTrimesterId("");
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={savingId === editId}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingId === editId ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
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
          icon: GraduationCap,
        },
        {
          key: "fichas",
          title: "Fichas (SENA)",
          description: "Fichas numéricas (7–9 dígitos) asociadas a trimestre.",
          collectionName: "fichas",
          icon: Hash,
        },
        {
          key: "sites",
          title: "Sedes",
          description: "Lugares o sedes disponibles para examenes.",
          collectionName: "sites",
          icon: Building2,
        },
        {
          key: "shifts",
          title: "Jornadas",
          description: "Jornada o turno (manana, tarde, noche).",
          collectionName: "shifts",
          icon: Layers,
        },
        {
          key: "trimesters",
          title: "Trimestres (SENA)",
          description: "Trimestres para fichas y planeación SENA.",
          collectionName: "trimesters",
          icon: CalendarDays,
        },
        {
          key: "moments",
          title: "Momentos",
          description: "Momentos de evaluacion (M1, M2, recuperacion).",
          collectionName: "moments",
          icon: ClipboardList,
        },
        {
          key: "groups",
          title: "Grupos",
          description: "Grupos o cursos (por ejemplo 10A Manana).",
          collectionName: "groups",
          icon: Users,
        },
      ] as const,
    [],
  );

  const [activeKey, setActiveKey] = useState<(typeof catalogs)[number]["key"]>("subjects");
  const active = catalogs.find((c) => c.key === activeKey) ?? catalogs[0];
  const ActiveIcon = active.icon;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Catálogos</h1>
        <p className="mt-1 text-sm text-zinc-600">Datos base para segmentación de exámenes y banco.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {catalogs.map((c) => {
          const selected = c.key === activeKey;
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveKey(c.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                selected
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <div className={`grid h-7 w-7 place-items-center rounded-lg ${selected ? "bg-white/10" : "bg-zinc-100"}`}>
                <Icon className={`h-4 w-4 ${selected ? "text-white" : "text-zinc-700"}`} />
              </div>
              {c.title}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-900 text-white">
                <ActiveIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-950">{active.title}</p>
                <p className="text-xs text-zinc-500">{active.description}</p>
              </div>
            </div>
          </div>
        </div>

        {active.key === "fichas" ? (
          <FichasPanel compactHeader />
        ) : (
          <CollectionPanel
            key={active.collectionName}
            title={active.title}
            description={active.description}
            collectionName={active.collectionName}
            compactHeader
          />
        )}
      </div>
    </div>
  );
}
