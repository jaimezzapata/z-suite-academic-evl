"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { normalizeSentenceText } from "@/lib/text/normalize";
import { Check, Copy, Pencil, Plus, Power, Search } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";
import type { CatalogRow, FilterStatus } from "../types";
import {
  toRow,
  toStableId,
  createCatalogDoc,
  updateCatalogDocName,
  toggleCatalogDocActive,
} from "../services/catalogs-service";
import { ModalShell } from "./modal-shell";

interface CollectionPanelProps {
  title: string;
  description: string;
  collectionName: string;
  compactHeader?: boolean;
}

export function CollectionPanel({
  title,
  description,
  collectionName,
  compactHeader = false,
}: CollectionPanelProps) {
  const feedback = useFeedback();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
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

  function showError(message: string) {
    return reportFormError({ message, feedback, setMessage: setError });
  }

  async function create() {
    const res = normalizeSentenceText(newName);
    if (!res.ok) {
      showError(res.error);
      return;
    }
    const baseId = toStableId(res.value);
    if (!baseId) {
      showError("ID inválido. Usa letras, números y guion bajo.");
      return;
    }

    const byId = rows.find((r) => r.id.toLowerCase() === baseId.toLowerCase());
    if (byId) {
      showError(`Ya existe: "${byId.name}" (ID: ${byId.id}). Edita el existente.`);
      return;
    }

    const normalizedName = res.value.trim().toLowerCase();
    const byName = rows.find((r) => r.name.trim().toLowerCase() === normalizedName);
    if (byName) {
      showError(`Ya existe: "${byName.name}" (ID: ${byName.id}). Edita el existente.`);
      return;
    }

    setSavingId("__new__");
    setError(null);
    try {
      await createCatalogDoc(collectionName, baseId, res.value);
      setNewName("");
      setCreateOpen(false);
      feedback.success(`${title} creado correctamente.`);
    } catch {
      showError(`No fue posible crear en ${collectionName}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function saveName(id: string) {
    const res = normalizeSentenceText(editName ?? "");
    if (!res.ok) {
      showError(res.error);
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      await updateCatalogDocName(collectionName, id, res.value);
      setEditId(null);
      setEditName("");
      setEditOpen(false);
      feedback.success(`${title} actualizado correctamente.`);
    } catch {
      showError(`No fue posible guardar cambios en ${collectionName}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    setSavingId(id);
    setError(null);
    try {
      await toggleCatalogDocActive(collectionName, id, next);
      feedback.success(next ? `${title} activado.` : `${title} inactivado.`);
    } catch {
      showError(`No fue posible actualizar estado en ${collectionName}.`);
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
      showError("No fue posible copiar el ID.");
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {rows.length} registros
            </p>
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
          <>
            {/* Mobile View (< md) */}
            <div className="space-y-3 md:hidden">
              {filtered.map((r) => {
                const disabled = savingId === r.id;
                return (
                  <div key={r.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">{r.name}</p>
                        <p className="mt-1 break-all font-mono text-xs text-zinc-600">{r.id}</p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${
                          r.active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                        }`}
                      >
                        {r.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void copyId(r.id)}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                        title="Copiar ID"
                        aria-label="Copiar ID"
                      >
                        {copiedId === r.id ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Copiar ID
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setEditId(r.id);
                          setEditName(r.name);
                          setEditOpen(true);
                        }}
                        disabled={disabled}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(r.id, !r.active)}
                        disabled={disabled}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Power className="h-4 w-4" />
                        {r.active ? "Inactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden overflow-hidden rounded-xl border border-zinc-200 md:block">
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
                          {copiedId === r.id ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${
                          r.active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-zinc-100 text-zinc-700 ring-zinc-200"
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
          </>
        ) : (
          <div className="rounded-xl bg-zinc-50 px-3 py-5 text-center text-sm text-zinc-500">
            Sin registros. Crea el primero con “Nuevo”.
          </div>
        )}
      </div>

      {createOpen ? (
        <ModalShell title={`Nuevo ${title}`} onClose={() => setCreateOpen(false)}>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Nombre</p>
              <p className="mt-1 text-xs text-zinc-500">
                Se genera un ID estable automáticamente (se usa en selects/segmentación).
              </p>
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
              <p className="mt-1 font-mono text-sm font-semibold text-zinc-900">
                {createPreview.ok ? createPreview.id || "—" : "—"}
              </p>
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
                disabled={savingId === "__new__"}
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
