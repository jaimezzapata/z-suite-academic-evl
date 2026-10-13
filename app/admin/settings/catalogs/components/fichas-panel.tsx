"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { Check, Copy, Pencil, Plus, Power, Search } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";
import type { CatalogRow, FichaRow, FilterStatus } from "../types";
import {
  toRow,
  toFichaRow,
  isValidFichaNumber,
  createFichaDoc,
  updateFichaDocTrimester,
  toggleFichaDocActive,
} from "../services/catalogs-service";
import { ModalShell } from "./modal-shell";

interface FichasPanelProps {
  compactHeader?: boolean;
}

export function FichasPanel({ compactHeader = false }: FichasPanelProps) {
  const feedback = useFeedback();
  const [rows, setRows] = useState<FichaRow[]>([]);
  const [trimesters, setTrimesters] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
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
    const unsub = onSnapshot(q, (snap) => {
      setTrimesters(snap.docs.map((d) => toRow(d.id, d.data() as Record<string, unknown>)));
    });
    return () => unsub();
  }, []);

  const trimesterNameById = useMemo(() => {
    const map = new Map<string, string>();
    trimesters.forEach((t) => map.set(t.id, t.name));
    return map;
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
        const trimesterName = trimesterNameById.get(r.trimesterId) ?? "";
        return (
          r.number.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          trimesterName.toLowerCase().includes(q)
        );
      });
  }, [rows, search, filter, trimesterNameById]);

  function showError(message: string) {
    return reportFormError({ message, feedback, setMessage: setError });
  }

  async function create() {
    const num = newNumber.trim();
    if (!isValidFichaNumber(num)) {
      showError("Ficha inválida. Debe tener 7 a 9 dígitos numéricos (ej: 3456789).");
      return;
    }

    const byNumber = rows.find((r) => r.number === num);
    if (byNumber) {
      showError(`La ficha "${num}" ya existe (ID: ${byNumber.id}). Edita la existente.`);
      return;
    }

    setSavingId("__new__");
    setError(null);
    try {
      await createFichaDoc(num, num, newTrimesterId || "");
      setNewNumber("");
      setNewTrimesterId("");
      setCreateOpen(false);
      feedback.success("Ficha creada correctamente.");
    } catch {
      showError("No fue posible crear la ficha.");
    } finally {
      setSavingId(null);
    }
  }

  async function save() {
    if (!editId) return;
    setSavingId(editId);
    setError(null);
    try {
      await updateFichaDocTrimester(editId, editTrimesterId || "");
      setEditOpen(false);
      setEditId(null);
      setEditNumber("");
      setEditTrimesterId("");
      feedback.success("Ficha actualizada correctamente.");
    } catch {
      showError("No fue posible guardar cambios en la ficha.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    setSavingId(id);
    setError(null);
    try {
      await toggleFichaDocActive(id, next);
      feedback.success(next ? "Ficha activada." : "Ficha inactivada.");
    } catch {
      showError("No fue posible actualizar estado de la ficha.");
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
      showError("No fue posible copiar la ficha.");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!compactHeader ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold tracking-tight text-zinc-950">Fichas (SENA)</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                {rows.length}
              </span>
            </div>
            <p className="mt-0.5 hidden text-[11px] text-zinc-500 sm:block">
              Fichas numéricas (7–9 dígitos) asociadas a trimestre.
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {rows.length} fichas
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
                const trimesterName =
                  trimesterNameById.get(r.trimesterId) ?? (r.trimesterId ? r.trimesterId : "—");
                return (
                  <div key={r.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-zinc-900">{r.number}</p>
                        <p className="mt-1 text-xs text-zinc-600">Trimestre: {trimesterName}</p>
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
                        title="Copiar ficha"
                        aria-label="Copiar ficha"
                      >
                        {copiedId === r.id ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Copiar ficha
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setEditId(r.id);
                          setEditNumber(r.number);
                          setEditTrimesterId(r.trimesterId);
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
              <div className="grid grid-cols-[1fr_140px_84px_112px] items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-semibold text-zinc-600">
                <div>Ficha</div>
                <div>Trimestre</div>
                <div>Estado</div>
                <div className="text-right">Acciones</div>
              </div>
              <div className="max-h-[52vh] overflow-y-auto">
                {filtered.map((r) => {
                  const disabled = savingId === r.id;
                  const trimesterName =
                    trimesterNameById.get(r.trimesterId) ?? (r.trimesterId ? r.trimesterId : "—");
                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-[1fr_140px_84px_112px] items-center gap-3 border-b border-zinc-100 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold text-zinc-900">{r.number}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-700">{trimesterName}</p>
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
                        <button
                          type="button"
                          onClick={() => void copyId(r.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                          title="Copiar ficha"
                          aria-label="Copiar ficha"
                        >
                          {copiedId === r.id ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
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
          </>
        ) : (
          <div className="rounded-xl bg-zinc-50 px-3 py-5 text-center text-sm text-zinc-500">
            Sin fichas. Crea la primera con “Nuevo”.
          </div>
        )}
      </div>

      {createOpen ? (
        <ModalShell title="Nueva ficha (SENA)" onClose={() => setCreateOpen(false)}>
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
