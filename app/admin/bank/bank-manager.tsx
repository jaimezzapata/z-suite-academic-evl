"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { ChevronDown, ChevronUp, Filter, Import, Loader2, Search } from "lucide-react";
import { firestore } from "@/lib/firebase/client";
import { JsonImporter } from "./json-importer";

type CatalogItem = { id: string; name: string; active: boolean };

type BankQuestion = {
  id: string;
  type: string;
  statement: string;
  subjectId: string;
  groupIds: string[];
  momentIds: string[];
  difficulty: string;
  points: number;
  status: string;
  tags: string[];
  createdAt: Date | null;
};

function toString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return ((value as { toDate: () => Date }).toDate() as Date) ?? null;
  }
  return null;
}

function previewText(value: string, max = 140) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function formatDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function labelForType(type: string) {
  const t = type.toLowerCase();
  if (t === "single_choice") return "Selección única";
  if (t === "multiple_choice") return "Selección múltiple";
  if (t === "open_concept") return "Abierta";
  if (t === "puzzle_order") return "Ordenar";
  if (t === "puzzle_match") return "Emparejar";
  if (t === "puzzle_cloze") return "Completar";
  return type;
}

function labelForDifficulty(diff: string) {
  const d = diff.toLowerCase();
  if (d === "easy") return "Fácil";
  if (d === "medium") return "Media";
  if (d === "hard") return "Difícil";
  return diff;
}

function statusPill(status: string) {
  const s = status.toLowerCase();
  if (s === "published") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "draft") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (s === "archived") return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

export function BankManager() {
  const [tab, setTab] = useState<"browse" | "import">("browse");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [moments, setMoments] = useState<CatalogItem[]>([]);

  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [momentId, setMomentId] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState("");

  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [subjectsSnap, groupsSnap, momentsSnap, qSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name", "asc"), limit(500))),
          getDocs(query(collection(firestore, "groups"), orderBy("name", "asc"), limit(500))),
          getDocs(query(collection(firestore, "moments"), orderBy("name", "asc"), limit(500))),
          getDocs(query(collection(firestore, "questions"), orderBy("createdAt", "desc"), limit(800))),
        ]);

        const s = subjectsSnap.docs.map((d) => {
          const row = d.data() as Record<string, unknown>;
          return { id: d.id, name: toString(row.name, d.id), active: Boolean(row.active) };
        });
        const g = groupsSnap.docs.map((d) => {
          const row = d.data() as Record<string, unknown>;
          return { id: d.id, name: toString(row.name, d.id), active: Boolean(row.active) };
        });
        const m = momentsSnap.docs.map((d) => {
          const row = d.data() as Record<string, unknown>;
          return { id: d.id, name: toString(row.name, d.id), active: Boolean(row.active) };
        });

        const qs = qSnap.docs.map((d) => {
          const row = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            type: toString(row.type, "single_choice"),
            statement: toString(row.statement, ""),
            subjectId: toString(row.subjectId, ""),
            groupIds: Array.isArray(row.groupIds) ? (row.groupIds as unknown[]).map((x) => toString(x)).filter(Boolean) : [],
            momentIds: Array.isArray(row.momentIds) ? (row.momentIds as unknown[]).map((x) => toString(x)).filter(Boolean) : [],
            difficulty: toString(row.difficulty, "easy"),
            points: toNumber(row.points, 1),
            status: toString(row.status, "published"),
            tags: Array.isArray(row.tags) ? (row.tags as unknown[]).map((x) => toString(x)).filter(Boolean) : [],
            createdAt: toDate(row.createdAt),
          } satisfies BankQuestion;
        });

        if (!cancelled) {
          setSubjects(s);
          setGroups(g);
          setMoments(m);
          setQuestions(qs);
        }
      } catch {
        if (!cancelled) setError("No fue posible cargar el banco. Revisa permisos/reglas o conexión.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const subjectNameById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s.name])), [subjects]);
  const groupNameById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g.name])), [groups]);
  const momentNameById = useMemo(() => Object.fromEntries(moments.map((m) => [m.id, m.name])), [moments]);

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => set.add(q.type));
    return Array.from(set).sort();
  }, [questions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (subjectId && item.subjectId !== subjectId) return false;
      if (groupId && !item.groupIds.includes(groupId)) return false;
      if (momentId && !item.momentIds.includes(momentId)) return false;
      if (type && item.type !== type) return false;
      if (difficulty && item.difficulty !== difficulty) return false;
      if (status && item.status !== status) return false;
      if (!q) return true;
      const subjectName = subjectNameById[item.subjectId] ?? "";
      const haystack = [
        item.id,
        item.statement,
        item.type,
        item.difficulty,
        item.status,
        subjectName,
        ...item.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [questions, search, subjectId, groupId, momentId, type, difficulty, status, subjectNameById]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const key = sort.key;
    const cmpText = (a: string, b: string) =>
      a.localeCompare(b, "es-CO", { numeric: true, sensitivity: "base" }) * dir;
    const list = [...filtered];
    list.sort((a, b) => {
      if (key === "id") return cmpText(a.id, b.id);
      if (key === "statement") return cmpText(a.statement, b.statement);
      if (key === "subject") return cmpText(subjectNameById[a.subjectId] ?? a.subjectId, subjectNameById[b.subjectId] ?? b.subjectId);
      if (key === "type") return cmpText(a.type, b.type);
      if (key === "difficulty") return cmpText(a.difficulty, b.difficulty);
      if (key === "status") return cmpText(a.status, b.status);
      if (key === "points") return (a.points - b.points) * dir;
      if (key === "createdAt") return ((a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)) * dir;
      return 0;
    });
    return list;
  }, [filtered, sort.dir, sort.key, subjectNameById]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [safePage, sorted]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
    setPage(1);
  }

  function SortHeader({ label, sortKey }: { label: string; sortKey: string }) {
    const active = sort.key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1 text-left font-medium text-zinc-500 hover:text-zinc-700"
      >
        <span>{label}</span>
        {active ? (
          sort.dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : null}
      </button>
    );
  }

  const stats = useMemo(() => {
    const total = questions.length;
    const shown = filtered.length;
    const publishedCount = filtered.filter((q) => q.status === "published").length;
    return { total, shown, publishedCount };
  }, [filtered, questions.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Banco de preguntas</h1>
          <p className="mt-1 text-sm text-zinc-600">Explora, filtra y revisa preguntas por materia, grupo y momento.</p>
        </div>
        <div className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab("browse")}
            className={`h-9 rounded-xl px-4 text-sm font-semibold ${
              tab === "browse" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Explorar
          </button>
          <button
            type="button"
            onClick={() => setTab("import")}
            className={`h-9 rounded-xl px-4 text-sm font-semibold ${
              tab === "import" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Importar
          </button>
        </div>
      </div>

      {tab === "import" ? (
        <JsonImporter />
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-2 lg:flex-row">
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por enunciado, tags o ID..."
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Materia</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Grupo</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={momentId}
                    onChange={(e) => setMomentId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Momento</option>
                    {moments.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Tipo</option>
                    {availableTypes.map((t) => (
                      <option key={t} value={t}>
                        {labelForType(t)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Dificultad</option>
                    <option value="easy">Fácil</option>
                    <option value="medium">Media</option>
                    <option value="hard">Difícil</option>
                  </select>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Estado</option>
                    <option value="published">Publicado</option>
                    <option value="draft">Borrador</option>
                    <option value="archived">Archivado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <div className="inline-flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                  <Filter className="h-4 w-4 text-zinc-500" />
                  {stats.shown}/{stats.total} • publicadas {stats.publishedCount}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSubjectId("");
                    setGroupId("");
                    setMomentId("");
                    setType("");
                    setDifficulty("");
                    setStatus("");
                    setPage(1);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando banco...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                        <th className="px-3 py-2">
                          <SortHeader label="ID" sortKey="id" />
                        </th>
                        <th className="px-3 py-2">
                          <SortHeader label="Enunciado" sortKey="statement" />
                        </th>
                        <th className="px-3 py-2">
                          <SortHeader label="Materia" sortKey="subject" />
                        </th>
                        <th className="px-3 py-2">
                          <SortHeader label="Tipo" sortKey="type" />
                        </th>
                        <th className="px-3 py-2">
                          <SortHeader label="Dificultad" sortKey="difficulty" />
                        </th>
                        <th className="px-3 py-2">
                          <SortHeader label="Puntos" sortKey="points" />
                        </th>
                        <th className="px-3 py-2">
                          <SortHeader label="Estado" sortKey="status" />
                        </th>
                        <th className="px-3 py-2">
                          <SortHeader label="Creada" sortKey="createdAt" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((q) => (
                        <tr key={q.id} className="border-b border-zinc-100 align-top">
                          <td className="px-3 py-2 font-mono text-xs text-zinc-700">{q.id}</td>
                          <td className="px-3 py-2 text-zinc-900">
                            <p className="max-w-[520px]">{previewText(q.statement)}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {q.tags.slice(0, 4).map((t) => (
                                <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-zinc-700">{subjectNameById[q.subjectId] ?? q.subjectId ?? "-"}</td>
                          <td className="px-3 py-2 text-zinc-700">{labelForType(q.type)}</td>
                          <td className="px-3 py-2 text-zinc-700">{labelForDifficulty(q.difficulty)}</td>
                          <td className="px-3 py-2 font-semibold text-zinc-900">{q.points.toFixed(1)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusPill(q.status)}`}>
                              {q.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{formatDate(q.createdAt)}</td>
                        </tr>
                      ))}
                      {!paginated.length ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-10 text-center text-sm text-zinc-500">
                            No hay preguntas con esos filtros.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-zinc-600">
                    Página {safePage} de {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Import className="h-4 w-4" />
        Importación disponible en la pestaña “Importar”.
      </div>
    </div>
  );
}

