"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Boxes,
  CircleHelp,
  Copy,
  FileQuestion,
  Layers,
  Pencil,
  Plus,
  Puzzle,
  Sparkles,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { MinimalPagination } from "@/app/admin/ui/minimal-pagination";

type Stat = { label: string; value: number };
type CatalogItem = { id: string; name: string };

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

type QuestionOption = { id: string; text: string; isCorrect?: boolean };
type AnswerRules = {
  maxWords?: number;
  passThreshold?: number;
  keywords?: Array<{ term: string; weight: number }>;
};

type QuestionTableRow = {
  id: string;
  statement: string;
  status: string;
  type: string;
  difficulty: string;
  points: number | null;
  subjectId: string;
  groupIds: string[];
  momentIds: string[];
  updatedAt: Date | null;
};

type EditQuestion = {
  id: string;
  type: string;
  statement: string;
  points: number;
  difficulty: string;
  status: string;
  subjectId: string;
  groupIds: string[];
  momentIds: string[];
  tags: string[];
  options: QuestionOption[];
  partialCredit: boolean;
  answerRules: AnswerRules;
  puzzleText: string;
};

function safeToString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function safeToNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as any).toDate === "function") {
    try {
      return (value as any).toDate() as Date;
    } catch {
      return null;
    }
  }
  return null;
}

function formatDateCompact(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleString("es-CO", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
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
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [moments, setMoments] = useState<CatalogItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedMomentId, setSelectedMomentId] = useState("");
  const [view, setView] = useState<"summary" | "table">("table");

  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableSource, setTableSource] = useState<QuestionTableRow[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const [tableStatus, setTableStatus] = useState("");
  const [tableType, setTableType] = useState("");
  const [tableDifficulty, setTableDifficulty] = useState("");
  const [pendingDelete, setPendingDelete] = useState<QuestionTableRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<"edit" | "create">("edit");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState<EditQuestion | null>(null);
  const [saving, setSaving] = useState(false);
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
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(400))),
          getDocs(query(collection(firestore, "moments"), orderBy("name"), limit(200))),
        ]);

        const typeSnaps = rest.slice(0, types.length);
        const difficultySnaps = rest.slice(types.length, types.length + difficulties.length);
        const subjectsSnap = rest[types.length + difficulties.length] as any;
        const groupsSnap = rest[types.length + difficulties.length + 1] as any;
        const momentsSnap = rest[types.length + difficulties.length + 2] as any;

        const subjectNameById = new Map<string, string>(
          (subjectsSnap?.docs ?? []).map((d: any) => [d.id, safeToString(d.data()?.name, d.id)]),
        );
        const groupNameById = new Map<string, string>(
          (groupsSnap?.docs ?? []).map((d: any) => [d.id, safeToString(d.data()?.name, d.id)]),
        );
        const momentNameById = new Map<string, string>(
          (momentsSnap?.docs ?? []).map((d: any) => [d.id, safeToString(d.data()?.name, d.id)]),
        );

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
          topSubjects: [],
          topGroups: [],
          topMoments: [],
          quality: { missingStatus: 0, missingPoints: 0, missingGroups: 0, missingMoments: 0 },
          preview: [],
        };

        if (cancelled) return;
        setSubjects((subjectsSnap?.docs ?? []).map((d: any) => toCatalogItem(d.id, d.data?.() ?? {})));
        setGroups((groupsSnap?.docs ?? []).map((d: any) => toCatalogItem(d.id, d.data?.() ?? {})));
        setMoments((momentsSnap?.docs ?? []).map((d: any) => toCatalogItem(d.id, d.data?.() ?? {})));
        setData((prev) => ({
          ...prev,
          counts: next.counts,
          byType: next.byType,
          byDifficulty: next.byDifficulty,
        }));
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

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const constraints = selectedSubjectId
          ? [where("subjectId", "==", selectedSubjectId), limit(500)]
          : [orderBy("updatedAt", "desc"), limit(220)];
        const snap = await getDocs(query(collection(firestore, "questions"), ...(constraints as any)));

        const momentFilter = selectedMomentId.trim();
        const docsRaw = snap.docs as any[];
        const filteredDocsRaw = momentFilter
          ? docsRaw.filter((d) => {
              const row = (d.data?.() ?? {}) as Record<string, unknown>;
              const ids = Array.isArray(row.momentIds) ? (row.momentIds as unknown[]) : [];
              const legacy = typeof row.momentId === "string" ? row.momentId : "";
              return ids.includes(momentFilter) || legacy === momentFilter;
            })
          : docsRaw;

        const filteredDocs = [...filteredDocsRaw].sort((a, b) => {
          const aDate = toDate(a.data?.()?.updatedAt);
          const bDate = toDate(b.data?.()?.updatedAt);
          const aTime = aDate ? aDate.getTime() : 0;
          const bTime = bDate ? bDate.getTime() : 0;
          return bTime - aTime;
        });

        const preview = filteredDocs.slice(0, 48).map((d) => {
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

        const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
        const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
        const momentNameById = new Map(moments.map((m) => [m.id, m.name]));

        const previewDocs = filteredDocs.slice(0, 48);
        const missingStatus = previewDocs.filter((d) => !safeToString(d.data?.()?.status, "")).length;
        const missingPoints = previewDocs.filter((d) => safeToNumber(d.data?.()?.points) === null).length;
        const missingGroups = previewDocs.filter((d) => {
          const ids = (d.data?.()?.groupIds ?? []) as unknown;
          return !Array.isArray(ids) || ids.length === 0;
        }).length;
        const missingMoments = previewDocs.filter((d) => {
          const ids = (d.data?.()?.momentIds ?? []) as unknown;
          const legacy = d.data?.()?.momentId as unknown;
          const legacyOk = typeof legacy === "string" && legacy.trim();
          return (!Array.isArray(ids) || ids.length === 0) && !legacyOk;
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
          const legacyMoment = typeof row.momentId === "string" ? row.momentId : "";
          if (legacyMoment) momentCounts.set(legacyMoment, (momentCounts.get(legacyMoment) ?? 0) + 1);
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

        if (cancelled) return;
        setData((prev) => ({
          ...prev,
          preview,
          topSubjects,
          topGroups,
          topMoments,
          quality: { missingStatus, missingPoints, missingGroups, missingMoments },
        }));
      } catch {
        if (!cancelled) setPreviewError("No fue posible cargar la muestra de preguntas para explorar.");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    if (view !== "summary") return () => void 0;
    if (!loading) void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [groups, loading, moments, selectedMomentId, selectedSubjectId, subjects, view]);

  async function openEdit(id: string) {
    setEditMode("edit");
    setEditOpen(true);
    setEditLoading(true);
    setEditError(null);
    try {
      const snap = await getDoc(doc(firestore, "questions", id));
      if (!snap.exists()) {
        setEditError("La pregunta no existe.");
        return;
      }
      const row = snap.data() as Record<string, unknown>;
      const type = safeToString(row.type, "open_concept");
      const options = Array.isArray(row.options) ? (row.options as unknown[]) : [];
      const normalizedOptions: QuestionOption[] = options
        .map((o) => (o && typeof o === "object" ? (o as Record<string, unknown>) : {}))
        .map((o, idx) => ({
          id: safeToString(o.id, `opt_${idx + 1}`),
          text: safeToString(o.text, ""),
          isCorrect: o.isCorrect === true,
        }));

      const groupIds = Array.isArray(row.groupIds) ? (row.groupIds as unknown[]).filter((x) => typeof x === "string") : [];
      const momentIdsRaw = Array.isArray(row.momentIds) ? (row.momentIds as unknown[]).filter((x) => typeof x === "string") : [];
      const legacyMoment = typeof row.momentId === "string" ? row.momentId.trim() : "";
      const momentIds = legacyMoment && !momentIdsRaw.includes(legacyMoment) ? [...momentIdsRaw, legacyMoment] : momentIdsRaw;
      const tags = Array.isArray(row.tags) ? (row.tags as unknown[]).filter((x) => typeof x === "string") : [];

      const answerRules = (row.answerRules && typeof row.answerRules === "object" ? (row.answerRules as AnswerRules) : {}) ?? {};
      const puzzle = row.puzzle && typeof row.puzzle === "object" ? (row.puzzle as Record<string, unknown>) : {};
      const puzzleText = JSON.stringify(puzzle ?? {}, null, 2);

      const q: EditQuestion = {
        id,
        type,
        statement: safeToString(row.statement, ""),
        points: safeToNumber(row.points) ?? 1,
        difficulty: safeToString(row.difficulty, "medium"),
        status: safeToString(row.status, "draft"),
        subjectId: safeToString(row.subjectId, ""),
        groupIds: groupIds as string[],
        momentIds: momentIds as string[],
        tags: tags as string[],
        options: normalizedOptions,
        partialCredit: row.partialCredit === true,
        answerRules,
        puzzleText,
      };
      setEditQuestion(q);
    } catch {
      setEditError("No fue posible cargar la pregunta.");
    } finally {
      setEditLoading(false);
    }
  }

  function closeEdit() {
    if (saving) return;
    setEditOpen(false);
    setEditQuestion(null);
    setEditError(null);
    setEditMode("edit");
  }

  async function saveEdit() {
    if (!editQuestion) return;
    const q = editQuestion;
    const statement = q.statement.trim();
    if (!statement) {
      setEditError("El enunciado es obligatorio.");
      return;
    }
    if (!q.subjectId.trim()) {
      setEditError("La materia es obligatoria.");
      return;
    }
    if (!q.momentIds.length) {
      setEditError("Debes seleccionar al menos un momento.");
      return;
    }

    if (q.type === "single_choice") {
      const opts = q.options.filter((o) => o.text.trim());
      const correctCount = opts.filter((o) => o.isCorrect).length;
      if (opts.length < 2) {
        setEditError("Selección única requiere mínimo 2 opciones.");
        return;
      }
      if (correctCount !== 1) {
        setEditError("Selección única requiere exactamente 1 opción correcta.");
        return;
      }
    }
    if (q.type === "multiple_choice") {
      const opts = q.options.filter((o) => o.text.trim());
      const correctCount = opts.filter((o) => o.isCorrect).length;
      if (opts.length < 3) {
        setEditError("Selección múltiple requiere mínimo 3 opciones.");
        return;
      }
      if (correctCount < 1) {
        setEditError("Selección múltiple requiere al menos 1 opción correcta.");
        return;
      }
    }
    if (q.type === "open_concept") {
      const keywords = q.answerRules?.keywords ?? [];
      if (!keywords.length) {
        setEditError("Pregunta abierta requiere al menos una palabra clave.");
        return;
      }
    }

    let puzzle: Record<string, unknown> | null = null;
    if (q.type.startsWith("puzzle_")) {
      try {
        puzzle = q.puzzleText.trim() ? (JSON.parse(q.puzzleText) as Record<string, unknown>) : {};
      } catch {
        setEditError("El JSON del puzzle no es válido.");
        return;
      }
    }

    setSaving(true);
    setEditError(null);
    try {
      const payload: Record<string, unknown> = {
        id: q.id,
        type: q.type,
        statement: statement,
        points: Math.max(0, Math.floor(q.points)),
        difficulty: q.difficulty,
        status: q.status,
        subjectId: q.subjectId,
        groupIds: q.groupIds,
        momentIds: q.momentIds,
        tags: q.tags,
        updatedAt: serverTimestamp(),
      };

      if (q.type === "single_choice" || q.type === "multiple_choice") {
        payload.options = q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: !!o.isCorrect }));
        if (q.type === "multiple_choice") payload.partialCredit = q.partialCredit;
      }
      if (q.type === "open_concept") {
        payload.answerRules = q.answerRules ?? {};
      }
      if (q.type.startsWith("puzzle_")) {
        payload.puzzle = puzzle ?? {};
      }

      if (editMode === "create") {
        await setDoc(doc(firestore, "questions", q.id), { ...payload, createdAt: serverTimestamp() }, { merge: true });
      } else {
        await updateDoc(doc(firestore, "questions", q.id), payload);
      }

      setTableSource((prev) => {
        const updatedAt = new Date();
        const nextRow: QuestionTableRow = {
          id: q.id,
          statement,
          status: q.status,
          type: q.type,
          difficulty: q.difficulty,
          points: q.points,
          subjectId: q.subjectId,
          groupIds: q.groupIds,
          momentIds: q.momentIds,
          updatedAt,
        };
        const exists = prev.some((x) => x.id === q.id);
        if (exists) return prev.map((x) => (x.id === q.id ? nextRow : x));
        return [nextRow, ...prev];
      });

      setData((prev) => ({
        ...prev,
        preview: prev.preview.some((p) => p.id === q.id)
          ? prev.preview.map((p) =>
              p.id === q.id
                ? {
                    ...p,
                    statement: statement,
                    status: q.status,
                    difficulty: q.difficulty,
                    points: q.points,
                    subjectId: q.subjectId,
                  }
                : p,
            )
          : [
              {
                id: q.id,
                statement: statement,
                status: q.status,
                type: q.type,
                difficulty: q.difficulty,
                points: q.points,
                subjectId: q.subjectId,
              },
              ...prev.preview,
            ],
      }));
      setEditOpen(false);
      setEditQuestion(null);
      setEditMode("edit");
    } catch {
      setEditError("No fue posible guardar la pregunta.");
    } finally {
      setSaving(false);
    }
  }

  async function reloadTable() {
    setTableLoading(true);
    setTableError(null);
    try {
      const snap = await getDocs(query(collection(firestore, "questions"), orderBy("updatedAt", "desc"), limit(500)));
      const rows: QuestionTableRow[] = snap.docs.map((d) => {
        const row = d.data() as Record<string, unknown>;
        const groupIds = Array.isArray(row.groupIds) ? (row.groupIds as unknown[]).filter((x) => typeof x === "string") : [];
        const momentIdsRaw = Array.isArray(row.momentIds) ? (row.momentIds as unknown[]).filter((x) => typeof x === "string") : [];
        const legacyMoment = typeof row.momentId === "string" ? row.momentId.trim() : "";
        const momentIds = legacyMoment && !momentIdsRaw.includes(legacyMoment) ? [...momentIdsRaw, legacyMoment] : momentIdsRaw;
        return {
          id: d.id,
          statement: safeToString(row.statement, d.id),
          status: safeToString(row.status, "draft"),
          type: safeToString(row.type, "open_concept"),
          difficulty: safeToString(row.difficulty, "medium"),
          points: safeToNumber(row.points),
          subjectId: safeToString(row.subjectId, ""),
          groupIds: groupIds as string[],
          momentIds: momentIds as string[],
          updatedAt: toDate(row.updatedAt),
        };
      });
      setTableSource(rows);
    } catch {
      setTableError("No fue posible cargar el listado de preguntas.");
    } finally {
      setTableLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "table") return;
    if (tableSource.length) return;
    void reloadTable();
  }, [tableSource.length, view]);

  const subjectNameById = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const momentNameById = useMemo(() => new Map(moments.map((m) => [m.id, m.name])), [moments]);

  const filteredTable = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return tableSource.filter((r) => {
      if (selectedSubjectId && r.subjectId !== selectedSubjectId) return false;
      if (selectedMomentId && !r.momentIds.includes(selectedMomentId)) return false;
      if (tableStatus && r.status !== tableStatus) return false;
      if (tableType && r.type !== tableType) return false;
      if (tableDifficulty && r.difficulty !== tableDifficulty) return false;
      if (q && !r.statement.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [selectedMomentId, selectedSubjectId, tableDifficulty, tableSearch, tableSource, tableStatus, tableType]);

  const tablePageSize = 20;
  const tablePageCount = Math.max(1, Math.ceil(filteredTable.length / tablePageSize));
  const pagedTable = useMemo(() => {
    const start = tablePage * tablePageSize;
    return filteredTable.slice(start, start + tablePageSize);
  }, [filteredTable, tablePage]);

  useEffect(() => {
    setTablePage(0);
  }, [selectedSubjectId, selectedMomentId, tableStatus, tableType, tableDifficulty, tableSearch]);

  useEffect(() => {
    if (tablePage <= tablePageCount - 1) return;
    setTablePage(Math.max(0, tablePageCount - 1));
  }, [tablePage, tablePageCount]);

  function buildEmptyEditQuestion(id: string, type: string): EditQuestion {
    const defaultMoment = moments[0]?.id ? [moments[0].id] : [];
    const defaultOptions: QuestionOption[] =
      type === "multiple_choice"
        ? [
            { id: "opt_1", text: "", isCorrect: false },
            { id: "opt_2", text: "", isCorrect: false },
            { id: "opt_3", text: "", isCorrect: false },
          ]
        : type === "single_choice"
          ? [
              { id: "opt_1", text: "", isCorrect: true },
              { id: "opt_2", text: "", isCorrect: false },
            ]
          : [];

    return {
      id,
      type,
      statement: "",
      points: 1,
      difficulty: "medium",
      status: "draft",
      subjectId: selectedSubjectId || "",
      groupIds: [],
      momentIds: selectedMomentId ? [selectedMomentId] : defaultMoment,
      tags: [],
      options: defaultOptions,
      partialCredit: false,
      answerRules: { maxWords: 120, passThreshold: 0, keywords: [{ term: "", weight: 1 }] },
      puzzleText: "{}",
    };
  }

  function openCreate() {
    const ref = doc(collection(firestore, "questions"));
    setEditMode("create");
    setEditOpen(true);
    setEditLoading(false);
    setEditError(null);
    setEditQuestion(buildEmptyEditQuestion(ref.id, "single_choice"));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    setDeleteError(null);
    try {
      await deleteDoc(doc(firestore, "questions", pendingDelete.id));
      setTableSource((prev) => prev.filter((x) => x.id !== pendingDelete.id));
      setData((prev) => ({ ...prev, preview: prev.preview.filter((p) => p.id !== pendingDelete.id) }));
      setPendingDelete(null);
    } catch {
      setDeleteError("No fue posible eliminar la pregunta.");
    } finally {
      setDeletingId(null);
    }
  }

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setView("summary")}
              className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                view === "summary" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Resumen
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                view === "table" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Tabla
            </button>
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
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {view === "summary" ? (
        <>
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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 sm:w-[240px]"
            >
              <option value="">Todas las materias</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={selectedMomentId}
              onChange={(e) => setSelectedMomentId(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 sm:w-[220px]"
            >
              <option value="">Todos los momentos</option>
              {moments.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por enunciado..."
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 sm:w-[360px]"
            />
          </div>
        </div>

        {previewError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {previewError}
          </div>
        ) : null}

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
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-zinc-500">
                      ID: <span className="font-mono text-zinc-700">{p.id}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(p.id)}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        <Copy className="h-4 w-4" />
                        Copiar ID
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEdit(p.id)}
                        className="inline-flex h-8 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500 lg:col-span-2">
              {loading || previewLoading ? "Cargando..." : "No hay preguntas para mostrar con ese filtro."}
            </div>
          )}
        </div>

        <MinimalPagination pageCount={previewPageCount} page={previewPage} onChange={setPreviewPage} />
      </section>
        </>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Listado</h2>
              <p className="text-sm text-zinc-500">Administra preguntas: filtra, edita, crea y elimina.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void reloadTable()}
                className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Recargar
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4" />
                Crear pregunta
              </button>
            </div>
          </div>

          {tableError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {tableError}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
            >
              <option value="">Todas las materias</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={selectedMomentId}
              onChange={(e) => setSelectedMomentId(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
            >
              <option value="">Todos los momentos</option>
              {moments.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={tableStatus}
              onChange={(e) => setTableStatus(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
            >
              <option value="">Todos los estados</option>
              <option value="published">Publicada</option>
              <option value="draft">Borrador</option>
              <option value="archived">Archivada</option>
            </select>
            <select
              value={tableType}
              onChange={(e) => setTableType(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
            >
              <option value="">Todos los tipos</option>
              <option value="single_choice">Selección única</option>
              <option value="multiple_choice">Selección múltiple</option>
              <option value="open_concept">Abierta</option>
              <option value="puzzle_order">Ordenar</option>
              <option value="puzzle_match">Emparejar</option>
              <option value="puzzle_cloze">Completar</option>
            </select>
            <input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Buscar por enunciado..."
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400"
            />
            <select
              value={tableDifficulty}
              onChange={(e) => setTableDifficulty(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-400 lg:col-span-2"
            >
              <option value="">Todas las dificultades</option>
              <option value="easy">Fácil</option>
              <option value="medium">Media</option>
              <option value="hard">Difícil</option>
            </select>
            <div className="flex items-center justify-between gap-2 lg:col-span-3">
              <p className="text-xs text-zinc-500">
                {tableLoading ? "Cargando..." : `${filteredTable.length} preguntas`}
              </p>
              <p className="text-xs text-zinc-500">
                Fuente: últimas {tableSource.length} actualizadas
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 sm:hidden">
            {pagedTable.map((r) => {
              const subjectName = subjectNameById.get(r.subjectId) ?? (r.subjectId || "-");
              const momentsLabel = r.momentIds
                .map((id) => momentNameById.get(id) ?? id)
                .slice(0, 2)
                .join(", ");
              const momentsExtra = Math.max(0, r.momentIds.length - 2);
              return (
                <div key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 line-clamp-2">{r.statement || "-"}</div>
                      <div className="mt-1 text-xs text-zinc-500">{subjectName}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {typeLabel(r.type)}
                        </span>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {difficultyLabel(r.difficulty)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-zinc-600">
                        {momentsLabel || "-"}
                        {momentsExtra ? <span className="ml-1 text-zinc-500">(+{momentsExtra} más)</span> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void openEdit(r.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        aria-label="Editar pregunta"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDelete(r);
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        aria-label="Eliminar pregunta"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!pagedTable.length ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">
                {tableLoading ? "Cargando..." : "No hay preguntas para mostrar con esos filtros."}
              </div>
            ) : null}
            <MinimalPagination pageCount={tablePageCount} page={tablePage} onChange={setTablePage} />
          </div>

          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-zinc-200 sm:block">
            <table className="min-w-[900px] w-full text-left">
              <thead className="bg-zinc-50">
                <tr className="text-xs text-zinc-500">
                  <th className="px-3 py-2 font-medium">Pregunta</th>
                  <th className="px-3 py-2 font-medium">Materia</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Momentos</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagedTable.map((r) => {
                  const subjectName = subjectNameById.get(r.subjectId) ?? (r.subjectId || "-");
                  const momentsLabel = r.momentIds
                    .map((id) => momentNameById.get(id) ?? id)
                    .slice(0, 2)
                    .join(", ");
                  const momentsExtra = Math.max(0, r.momentIds.length - 2);
                  return (
                    <tr key={r.id} className="border-t border-zinc-100 text-sm">
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium text-zinc-900 line-clamp-2">{r.statement || "-"}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="text-sm font-medium text-zinc-900">{subjectName}</div>
                        <div className="mt-1 text-xs text-zinc-500">{r.subjectId || "-"}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="text-sm font-medium text-zinc-900">{typeLabel(r.type)}</div>
                        <div className="mt-1 text-xs text-zinc-500">{difficultyLabel(r.difficulty)}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="text-sm text-zinc-900">{momentsLabel || "-"}</div>
                        {momentsExtra ? <div className="mt-1 text-xs text-zinc-500">+{momentsExtra} más</div> : null}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void openEdit(r.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                            aria-label="Editar pregunta"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setPendingDelete(r);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            aria-label="Eliminar pregunta"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!pagedTable.length ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-zinc-500">
                      {tableLoading ? "Cargando..." : "No hay preguntas para mostrar con esos filtros."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="min-w-[900px] border-t border-zinc-100 bg-white">
              <MinimalPagination pageCount={tablePageCount} page={tablePage} onChange={setTablePage} />
            </div>
          </div>
        </section>
      )}

      <AnimatePresence>
        {editOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeEdit}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950">{editMode === "create" ? "Crear pregunta" : "Editar pregunta"}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    ID: <span className="font-mono text-zinc-700">{editQuestion?.id || "-"}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                  disabled={saving}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
                {editError ? (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {editError}
                  </div>
                ) : null}

                {editLoading || !editQuestion ? (
                  <div className="rounded-xl bg-zinc-50 px-3 py-10 text-center text-sm text-zinc-500">Cargando...</div>
                ) : (
                  <div className="grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-zinc-700">Materia</span>
                        <select
                          value={editQuestion.subjectId}
                          onChange={(e) => setEditQuestion((p) => (p ? { ...p, subjectId: e.target.value } : p))}
                          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                        >
                          <option value="">Selecciona materia</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-zinc-700">Estado</span>
                        <select
                          value={editQuestion.status}
                          onChange={(e) => setEditQuestion((p) => (p ? { ...p, status: e.target.value } : p))}
                          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                        >
                          <option value="draft">Borrador</option>
                          <option value="published">Publicada</option>
                          <option value="archived">Archivada</option>
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-zinc-700">Tipo</span>
                        {editMode === "create" ? (
                          <select
                            value={editQuestion.type}
                            onChange={(e) =>
                              setEditQuestion((p) => {
                                if (!p) return p;
                                const next = buildEmptyEditQuestion(p.id, e.target.value);
                                return {
                                  ...next,
                                  subjectId: p.subjectId,
                                  groupIds: p.groupIds,
                                  momentIds: p.momentIds,
                                  status: p.status,
                                  difficulty: p.difficulty,
                                  points: p.points,
                                  statement: p.statement,
                                };
                              })
                            }
                            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                          >
                            <option value="single_choice">Selección única</option>
                            <option value="multiple_choice">Selección múltiple</option>
                            <option value="open_concept">Abierta</option>
                            <option value="puzzle_order">Ordenar</option>
                            <option value="puzzle_match">Emparejar</option>
                            <option value="puzzle_cloze">Completar</option>
                          </select>
                        ) : (
                          <input
                            value={typeLabel(editQuestion.type)}
                            readOnly
                            className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none"
                          />
                        )}
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-zinc-700">Dificultad</span>
                        <select
                          value={editQuestion.difficulty}
                          onChange={(e) => setEditQuestion((p) => (p ? { ...p, difficulty: e.target.value } : p))}
                          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                        >
                          <option value="easy">Fácil</option>
                          <option value="medium">Media</option>
                          <option value="hard">Difícil</option>
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-zinc-700">Puntos</span>
                        <input
                          type="number"
                          value={editQuestion.points}
                          onChange={(e) => setEditQuestion((p) => (p ? { ...p, points: Number(e.target.value) } : p))}
                          min={0}
                          max={100}
                          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                        />
                      </label>
                    </div>

                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-zinc-700">Enunciado</span>
                      <textarea
                        value={editQuestion.statement}
                        onChange={(e) => setEditQuestion((p) => (p ? { ...p, statement: e.target.value } : p))}
                        rows={4}
                        className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="text-xs font-semibold text-zinc-700">Momentos</p>
                        <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
                          {moments.map((m) => {
                            const active = editQuestion.momentIds.includes(m.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() =>
                                  setEditQuestion((p) => {
                                    if (!p) return p;
                                    const next = active ? p.momentIds.filter((x) => x !== m.id) : [...p.momentIds, m.id];
                                    return { ...p, momentIds: next };
                                  })
                                }
                                className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                                  active
                                    ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                                }`}
                              >
                                {m.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="text-xs font-semibold text-zinc-700">Grupos</p>
                        <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
                          {groups.map((g) => {
                            const active = editQuestion.groupIds.includes(g.id);
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() =>
                                  setEditQuestion((p) => {
                                    if (!p) return p;
                                    const next = active ? p.groupIds.filter((x) => x !== g.id) : [...p.groupIds, g.id];
                                    return { ...p, groupIds: next };
                                  })
                                }
                                className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                                  active
                                    ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                                }`}
                              >
                                {g.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {editQuestion.type === "single_choice" || editQuestion.type === "multiple_choice" ? (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-zinc-700">Opciones</p>
                          {editQuestion.type === "multiple_choice" ? (
                            <button
                              type="button"
                              onClick={() => setEditQuestion((p) => (p ? { ...p, partialCredit: !p.partialCredit } : p))}
                              className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
                                editQuestion.partialCredit
                                  ? "bg-zinc-900 text-white"
                                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                              }`}
                            >
                              Crédito parcial
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-3 space-y-2">
                          {editQuestion.options.map((o, idx) => (
                            <div key={`${o.id}-${idx}`} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditQuestion((p) => {
                                    if (!p) return p;
                                    const next = [...p.options];
                                    if (p.type === "single_choice") {
                                      next.forEach((x, i) => (next[i] = { ...x, isCorrect: i === idx }));
                                    } else {
                                      next[idx] = { ...next[idx], isCorrect: !next[idx].isCorrect };
                                    }
                                    return { ...p, options: next };
                                  })
                                }
                                className={`h-10 w-10 shrink-0 rounded-xl border text-sm font-bold ${
                                  o.isCorrect
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                                }`}
                                aria-label="Marcar correcta"
                              >
                                ✓
                              </button>
                              <input
                                value={o.text}
                                onChange={(e) =>
                                  setEditQuestion((p) => {
                                    if (!p) return p;
                                    const next = [...p.options];
                                    next[idx] = { ...next[idx], text: e.target.value };
                                    return { ...p, options: next };
                                  })
                                }
                                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                                placeholder={`Opción ${idx + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditQuestion((p) => {
                                    if (!p) return p;
                                    const next = p.options.filter((_, i) => i !== idx);
                                    return { ...p, options: next };
                                  })
                                }
                                className="h-10 shrink-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setEditQuestion((p) => {
                                if (!p) return p;
                                const nextId = `opt_${p.options.length + 1}`;
                                return { ...p, options: [...p.options, { id: nextId, text: "", isCorrect: false }] };
                              })
                            }
                            className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            Agregar opción
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {editQuestion.type === "open_concept" ? (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="text-xs font-semibold text-zinc-700">Reglas de respuesta</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1">
                            <span className="text-xs font-semibold text-zinc-700">Máx. palabras</span>
                            <input
                              type="number"
                              value={editQuestion.answerRules.maxWords ?? 120}
                              onChange={(e) =>
                                setEditQuestion((p) =>
                                  p ? { ...p, answerRules: { ...p.answerRules, maxWords: Number(e.target.value) } } : p,
                                )
                              }
                              min={1}
                              max={500}
                              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-xs font-semibold text-zinc-700">Umbral (0-1)</span>
                            <input
                              type="number"
                              value={editQuestion.answerRules.passThreshold ?? 0}
                              onChange={(e) =>
                                setEditQuestion((p) =>
                                  p ? { ...p, answerRules: { ...p.answerRules, passThreshold: Number(e.target.value) } } : p,
                                )
                              }
                              min={0}
                              max={1}
                              step={0.05}
                              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                            />
                          </label>
                        </div>
                        <div className="mt-3 space-y-2">
                          {(editQuestion.answerRules.keywords ?? []).map((k, idx) => (
                            <div key={`${k.term}-${idx}`} className="grid gap-2 sm:grid-cols-[1fr_120px_110px]">
                              <input
                                value={k.term}
                                onChange={(e) =>
                                  setEditQuestion((p) => {
                                    if (!p) return p;
                                    const next = [...(p.answerRules.keywords ?? [])];
                                    next[idx] = { ...next[idx], term: e.target.value };
                                    return { ...p, answerRules: { ...p.answerRules, keywords: next } };
                                  })
                                }
                                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                                placeholder="Término"
                              />
                              <input
                                type="number"
                                value={k.weight}
                                onChange={(e) =>
                                  setEditQuestion((p) => {
                                    if (!p) return p;
                                    const next = [...(p.answerRules.keywords ?? [])];
                                    next[idx] = { ...next[idx], weight: Number(e.target.value) };
                                    return { ...p, answerRules: { ...p.answerRules, keywords: next } };
                                  })
                                }
                                min={0}
                                step={0.1}
                                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                                placeholder="Peso"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditQuestion((p) => {
                                    if (!p) return p;
                                    const next = (p.answerRules.keywords ?? []).filter((_, i) => i !== idx);
                                    return { ...p, answerRules: { ...p.answerRules, keywords: next } };
                                  })
                                }
                                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setEditQuestion((p) => {
                                if (!p) return p;
                                const next = [...(p.answerRules.keywords ?? []), { term: "", weight: 1 }];
                                return { ...p, answerRules: { ...p.answerRules, keywords: next } };
                              })
                            }
                            className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            Agregar palabra clave
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {editQuestion.type.startsWith("puzzle_") ? (
                      <label className="grid gap-1 rounded-2xl border border-zinc-200 bg-white p-4">
                        <span className="text-xs font-semibold text-zinc-700">Puzzle (JSON)</span>
                        <textarea
                          value={editQuestion.puzzleText}
                          onChange={(e) => setEditQuestion((p) => (p ? { ...p, puzzleText: e.target.value } : p))}
                          rows={10}
                          className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400"
                        />
                      </label>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={saving || editLoading || !editQuestion}
                  className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Guardando..." : editMode === "create" ? "Crear pregunta" : "Guardar cambios"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
              onClick={() => (deletingId ? null : setPendingDelete(null))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950">Eliminar pregunta</p>
                  <p className="mt-1 text-sm text-zinc-600">Esta acción es irreversible.</p>
                </div>
                <button
                  type="button"
                  onClick={() => (deletingId ? null : setPendingDelete(null))}
                  className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                  disabled={!!deletingId}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-5 py-4">
                {deleteError ? (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {deleteError}
                  </div>
                ) : null}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-xs font-semibold text-zinc-500">ID</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-zinc-900">{pendingDelete.id}</p>
                  <p className="mt-3 text-xs font-semibold text-zinc-500">Enunciado</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900 line-clamp-3">{pendingDelete.statement || "-"}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  disabled={!!deletingId}
                  className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deletingId === pendingDelete.id}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingId === pendingDelete.id ? "Eliminando..." : "Eliminar definitivamente"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
