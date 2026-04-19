"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Boxes,
  CircleHelp,
  Copy,
  FileQuestion,
  Layers,
  Puzzle,
  Sparkles,
  Tags,
} from "lucide-react";
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { MinimalPagination } from "@/app/admin/ui/minimal-pagination";

type Stat = { label: string; value: number };

type BankData = {
  counts: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  };
  byType: Stat[];
  byDifficulty: Stat[];
  topSubjects: { label: string; value: number }[];
  topGroups: { label: string; value: number }[];
  topMoments: { label: string; value: number }[];
  quality: {
    missingStatus: number;
    missingPoints: number;
    missingGroups: number;
    missingMoments: number;
  };
  preview: {
    id: string;
    statement: string;
    status: string;
    type: string;
    difficulty: string;
    points: number | null;
    subjectId: string;
  }[];
};

function safeToString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function safeToNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function buildSparkPath(values: number[], w: number, h: number) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = values.length === 1 ? 0 : w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function MiniSparkline({ values }: { values: number[] }) {
  const path = useMemo(() => buildSparkPath(values, 88, 22), [values]);
  if (!values.length) return <div className="h-6 w-[92px] rounded-md bg-zinc-100" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values.map((v, i) => {
    const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 88;
    const y = 22 - ((v - min) / span) * 22;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const area = `M 0 22 L ${points.join(" ")} L 88 22 Z`.replaceAll(" ", " ");
  return (
    <svg viewBox="0 0 88 22" className="h-6 w-[92px]">
      <path d={area} className="fill-zinc-100" />
      <path d={path} className="stroke-zinc-800 fill-none" strokeWidth={2} />
    </svg>
  );
}

function Donut({
  items,
}: {
  items: { label: string; value: number; tone: "emerald" | "amber" | "zinc" | "indigo" | "sky" }[];
}) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const r = 16;
  const c = 2 * Math.PI * r;
  const toneToStroke = (tone: "emerald" | "amber" | "zinc" | "indigo" | "sky") =>
    tone === "emerald"
      ? "stroke-emerald-500"
      : tone === "amber"
        ? "stroke-amber-500"
        : tone === "indigo"
          ? "stroke-indigo-500"
          : tone === "sky"
            ? "stroke-sky-500"
            : "stroke-zinc-700";
  const segments = items.reduce(
    (acc, it) => {
      const frac = it.value / total;
      const dash = frac * c;
      const dasharray = `${dash.toFixed(2)} ${(c - dash).toFixed(2)}`;
      const next = {
        label: it.label,
        tone: it.tone,
        dasharray,
        dashoffset: (-acc.offset).toFixed(2),
      };
      return { offset: acc.offset + dash, segs: [...acc.segs, next] };
    },
    {
      offset: 0,
      segs: [] as { label: string; tone: "emerald" | "amber" | "zinc" | "indigo" | "sky"; dasharray: string; dashoffset: string }[],
    },
  ).segs;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 44 44" className="h-16 w-16 -rotate-90">
        <circle cx="22" cy="22" r={r} className="stroke-zinc-100" strokeWidth="8" fill="none" />
        {segments.map((seg) => (
          <circle
            key={seg.label}
            cx="22"
            cy="22"
            r={r}
            className={toneToStroke(seg.tone)}
            strokeWidth="8"
            fill="none"
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.dashoffset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="min-w-0 space-y-1 text-sm">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-4">
            <span className="truncate text-zinc-700">{it.label}</span>
            <span className="shrink-0 font-semibold text-zinc-900">
              {formatCompactNumber(it.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="space-y-1">
          <div className="flex items-center justify-between gap-4 text-xs text-zinc-600">
            <span className="truncate">{it.label}</span>
            <span className="font-semibold text-zinc-900">{formatCompactNumber(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900"
              style={{ width: `${Math.round((it.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    single_choice: "Selección única",
    multiple_choice: "Selección múltiple",
    open_concept: "Abierta",
    puzzle_order: "Ordenar",
    puzzle_match: "Emparejar",
    puzzle_cloze: "Completar",
  };
  return map[type] ?? type;
}

function statusLabel(status: string) {
  const map: Record<string, string> = { published: "Publicada", draft: "Borrador", archived: "Archivada" };
  return map[status] ?? status;
}

function difficultyLabel(diff: string) {
  const map: Record<string, string> = { easy: "Fácil", medium: "Media", hard: "Difícil" };
  return map[diff] ?? diff;
}

function badgeTone(value: string) {
  if (value === "published") return "bg-emerald-50 text-emerald-700";
  if (value === "draft") return "bg-amber-50 text-amber-700";
  if (value === "archived") return "bg-zinc-100 text-zinc-700";
  return "bg-zinc-100 text-zinc-700";
}

function iconForType(type: string) {
  if (type === "open_concept") return BookOpen;
  if (type === "single_choice" || type === "multiple_choice") return CircleHelp;
  if (type.startsWith("puzzle_")) return Puzzle;
  return FileQuestion;
}

export function BankDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  const [data, setData] = useState<BankData>({
    counts: { total: 0, published: 0, draft: 0, archived: 0 },
    byType: [],
    byDifficulty: [],
    topSubjects: [],
    topGroups: [],
    topMoments: [],
    quality: { missingStatus: 0, missingPoints: 0, missingGroups: 0, missingMoments: 0 },
    preview: [],
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const types = [
          "single_choice",
          "multiple_choice",
          "open_concept",
          "puzzle_order",
          "puzzle_match",
          "puzzle_cloze",
        ] as const;
        const difficulties = ["easy", "medium", "hard"] as const;

        const [
          totalSnap,
          publishedSnap,
          draftSnap,
          archivedSnap,
          ...rest
        ] = await Promise.all([
          getCountFromServer(collection(firestore, "questions")),
          getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "published"))),
          getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "draft"))),
          getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "archived"))),
          ...types.map((t) =>
            getCountFromServer(query(collection(firestore, "questions"), where("type", "==", t))),
          ),
          ...difficulties.map((d) =>
            getCountFromServer(query(collection(firestore, "questions"), where("difficulty", "==", d))),
          ),
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(80))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(120))),
          getDocs(query(collection(firestore, "moments"), orderBy("name"), limit(120))),
          getDocs(query(collection(firestore, "questions"), orderBy("updatedAt", "desc"), limit(48))),
        ]);

        const typeSnaps = rest.slice(0, types.length);
        const difficultySnaps = rest.slice(types.length, types.length + difficulties.length);
        const subjectsSnap = rest[types.length + difficulties.length] as any;
        const groupsSnap = rest[types.length + difficulties.length + 1] as any;
        const momentsSnap = rest[types.length + difficulties.length + 2] as any;
        const previewSnap = rest[types.length + difficulties.length + 3] as any;

        const subjectNameById = new Map<string, string>(
          (subjectsSnap?.docs ?? []).map((d: any) => [d.id, safeToString(d.data()?.name, d.id)]),
        );
        const groupNameById = new Map<string, string>(
          (groupsSnap?.docs ?? []).map((d: any) => [d.id, safeToString(d.data()?.name, d.id)]),
        );
        const momentNameById = new Map<string, string>(
          (momentsSnap?.docs ?? []).map((d: any) => [d.id, safeToString(d.data()?.name, d.id)]),
        );

        const previewDocs = (previewSnap?.docs ?? []) as any[];
        const preview = previewDocs.map((d) => {
          const row = (d.data?.() ?? {}) as Record<string, unknown>;
          return {
            id: d.id,
            statement: safeToString(row.statement, d.id),
            status: safeToString(row.status, "draft"),
            type: safeToString(row.type, "open_concept"),
            difficulty: safeToString(row.difficulty, "medium"),
            points: safeToNumber(row.points),
            subjectId: safeToString(row.subjectId, "sin-materia"),
          };
        });

        const missingStatus = previewDocs.filter((d) => !safeToString(d.data?.()?.status, "")).length;
        const missingPoints = previewDocs.filter((d) => safeToNumber(d.data?.()?.points) === null).length;
        const missingGroups = previewDocs.filter((d) => {
          const ids = (d.data?.()?.groupIds ?? []) as unknown;
          return !Array.isArray(ids) || ids.length === 0;
        }).length;
        const missingMoments = previewDocs.filter((d) => {
          const ids = (d.data?.()?.momentIds ?? []) as unknown;
          return !Array.isArray(ids) || ids.length === 0;
        }).length;

        const subjectCounts = new Map<string, number>();
        const groupCounts = new Map<string, number>();
        const momentCounts = new Map<string, number>();
        previewDocs.forEach((d) => {
          const row = (d.data?.() ?? {}) as Record<string, unknown>;
          const subjectId = safeToString(row.subjectId, "");
          if (subjectId) subjectCounts.set(subjectId, (subjectCounts.get(subjectId) ?? 0) + 1);

          const groupIds = Array.isArray(row.groupIds) ? row.groupIds : [];
          groupIds.forEach((id) => {
            if (typeof id !== "string") return;
            groupCounts.set(id, (groupCounts.get(id) ?? 0) + 1);
          });

          const momentIds = Array.isArray(row.momentIds) ? row.momentIds : [];
          momentIds.forEach((id) => {
            if (typeof id !== "string") return;
            momentCounts.set(id, (momentCounts.get(id) ?? 0) + 1);
          });
        });

        const topSubjects = Array.from(subjectCounts.entries())
          .map(([id, value]) => ({ label: subjectNameById.get(id) ?? id, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6);
        const topGroups = Array.from(groupCounts.entries())
          .map(([id, value]) => ({ label: groupNameById.get(id) ?? id, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6);
        const topMoments = Array.from(momentCounts.entries())
          .map(([id, value]) => ({ label: momentNameById.get(id) ?? id, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6);

        const byType = types.map((t, idx) => ({
          label: typeLabel(t),
          value: (typeSnaps[idx] as any).data?.()?.count ?? 0,
        }));

        const byDifficulty = difficulties.map((d, idx) => ({
          label: difficultyLabel(d),
          value: (difficultySnaps[idx] as any).data?.()?.count ?? 0,
        }));

        const next: BankData = {
          counts: {
            total: totalSnap.data().count,
            published: publishedSnap.data().count,
            draft: draftSnap.data().count,
            archived: archivedSnap.data().count,
          },
          byType,
          byDifficulty,
          topSubjects,
          topGroups,
          topMoments,
          quality: { missingStatus, missingPoints, missingGroups, missingMoments },
          preview,
        };

        if (!cancelled) setData(next);
      } catch {
        if (!cancelled) setError("No fue posible leer datos de Firestore para el banco de preguntas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPreview = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.preview;
    return data.preview.filter((p) => p.statement.toLowerCase().includes(q));
  }, [data.preview, search]);

  const previewPageSize = 6;
  const previewPageCount = Math.max(1, Math.ceil(filteredPreview.length / previewPageSize));
  const pagedPreview = useMemo(() => {
    const start = previewPage * previewPageSize;
    return filteredPreview.slice(start, start + previewPageSize);
  }, [filteredPreview, previewPage]);

  useEffect(() => {
    setPreviewPage(0);
  }, [search]);

  useEffect(() => {
    if (previewPage <= previewPageCount - 1) return;
    setPreviewPage(Math.max(0, previewPageCount - 1));
  }, [previewPage, previewPageCount]);

  const statusSpark = useMemo(
    () => [data.counts.published, data.counts.draft, data.counts.archived],
    [data.counts],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Banco de preguntas</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Visualiza cobertura, distribución y calidad del banco. Importa lotes JSON cuando lo necesites.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Total
              </p>
              <p className="text-xl font-semibold tracking-tight text-zinc-950">
                {loading ? "..." : formatCompactNumber(data.counts.total)}
              </p>
            </div>
            <MiniSparkline values={statusSpark} />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Publicadas</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                {loading ? "-" : formatCompactNumber(data.counts.published)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Listas para aplicar</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Borrador</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                {loading ? "-" : formatCompactNumber(data.counts.draft)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Pendientes de revisión</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <Copy className="h-5 w-5" />
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Archivadas</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                {loading ? "-" : formatCompactNumber(data.counts.archived)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Fuera de uso</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Calidad rápida (muestra)</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600">
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Sin puntos:{" "}
              <span className="font-semibold text-zinc-900">
                {loading ? "-" : data.quality.missingPoints}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Sin estado:{" "}
              <span className="font-semibold text-zinc-900">
                {loading ? "-" : data.quality.missingStatus}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Sin grupos:{" "}
              <span className="font-semibold text-zinc-900">
                {loading ? "-" : data.quality.missingGroups}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              Sin momentos:{" "}
              <span className="font-semibold text-zinc-900">
                {loading ? "-" : data.quality.missingMoments}
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Estado</h2>
              <p className="text-sm text-zinc-500">Distribución por publicación.</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
              <Tags className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <Donut
              items={[
                { label: "Publicadas", value: data.counts.published, tone: "emerald" },
                { label: "Borrador", value: data.counts.draft, tone: "amber" },
                { label: "Archivadas", value: data.counts.archived, tone: "zinc" },
              ]}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Tipos</h2>
              <p className="text-sm text-zinc-500">Qué se está creando en el banco.</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
              <FileQuestion className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            {data.byType.length ? (
              <BarList items={data.byType} />
            ) : (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando..." : "Sin datos."}
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Dificultad</h2>
          <p className="text-sm text-zinc-500">Balance por nivel.</p>
          <div className="mt-4">
            {data.byDifficulty.length ? (
              <BarList items={data.byDifficulty} />
            ) : (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando..." : "Sin datos."}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Top materias</h2>
          <p className="text-sm text-zinc-500">Más contenido en la muestra.</p>
          <div className="mt-4">
            {data.topSubjects.length ? (
              <BarList items={data.topSubjects} />
            ) : (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando..." : "Sin datos."}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Cobertura</h2>
          <p className="text-sm text-zinc-500">Grupos y momentos más usados.</p>
          <div className="mt-4 space-y-4">
            {data.topGroups.length ? (
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Grupos</p>
                <div className="mt-2">
                  <BarList items={data.topGroups} />
                </div>
              </div>
            ) : null}
            {data.topMoments.length ? (
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Momentos</p>
                <div className="mt-2">
                  <BarList items={data.topMoments} />
                </div>
              </div>
            ) : null}
            {!data.topGroups.length && !data.topMoments.length ? (
              <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "Cargando..." : "Sin datos."}
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Explorar (muestra)</h2>
            <p className="text-sm text-zinc-500">Revisión rápida de preguntas recientes.</p>
          </div>
          <div className="w-full sm:w-[360px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por enunciado..."
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pagedPreview.length ? (
            pagedPreview.map((p) => {
              const Icon = iconForType(p.type);
              return (
                <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {difficultyLabel(p.difficulty)}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {p.points === null ? "Sin puntos" : `${p.points} pts`}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-950">{p.statement}</p>
                      <p className="mt-1 text-xs text-zinc-500">{typeLabel(p.type)}</p>
                    </div>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500 lg:col-span-2">
              {loading ? "Cargando..." : "No hay preguntas para mostrar con ese filtro."}
            </div>
          )}
        </div>

        <MinimalPagination pageCount={previewPageCount} page={previewPage} onChange={setPreviewPage} />
      </section>
    </div>
  );
}
