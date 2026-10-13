import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  BookOpen,
  CircleHelp,
  FileQuestion,
  Puzzle,
} from "lucide-react";
import { firestore } from "@/lib/firebase/client";
import type {
  CatalogItem,
  BankDashboardStats,
  QuestionTableRow,
  EditQuestion,
  QuestionOption,
  AnswerRules,
} from "../types";

export function safeToString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function safeToNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => unknown }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

export function formatDateCompact(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleString("es-CO", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

export function typeLabel(type: string) {
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

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    published: "Publicada",
    draft: "Borrador",
    archived: "Archivada",
  };
  return map[status] ?? status;
}

export function difficultyLabel(diff: string) {
  const map: Record<string, string> = {
    easy: "Fácil",
    medium: "Media",
    hard: "Difícil",
  };
  return map[diff] ?? diff;
}

export function badgeTone(value: string) {
  if (value === "published") return "bg-emerald-50 text-emerald-700";
  if (value === "draft") return "bg-amber-50 text-amber-700";
  if (value === "archived") return "bg-zinc-100 text-zinc-700";
  return "bg-zinc-100 text-zinc-700";
}

export function iconForType(type: string) {
  if (type === "open_concept") return BookOpen;
  if (type === "single_choice" || type === "multiple_choice") return CircleHelp;
  if (type.startsWith("puzzle_")) return Puzzle;
  return FileQuestion;
}

export function buildEmptyEditQuestion(
  id: string,
  type: string,
  defaultMomentId?: string,
  defaultSubjectId?: string,
): EditQuestion {
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
    subjectId: defaultSubjectId || "",
    groupIds: [],
    momentIds: defaultMomentId ? [defaultMomentId] : [],
    tags: [],
    options: defaultOptions,
    partialCredit: type === "multiple_choice",
    answerRules: { maxWords: 120, passThreshold: 0, keywords: [{ term: "", weight: 1 }] },
    puzzleText: "{}",
  };
}

export async function fetchBankCatalogs() {
  const settled = await Promise.allSettled([
    getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(400))),
    getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(400))),
    getDocs(query(collection(firestore, "moments"), orderBy("name"), limit(200))),
  ]);

  const subjectsSnap = settled[0].status === "fulfilled" ? settled[0].value : null;
  const groupsSnap = settled[1].status === "fulfilled" ? settled[1].value : null;
  const momentsSnap = settled[2].status === "fulfilled" ? settled[2].value : null;

  const subjects: CatalogItem[] = subjectsSnap?.docs
    ? subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data()))
    : [];
  const groups: CatalogItem[] = groupsSnap?.docs
    ? groupsSnap.docs.map((d) => toCatalogItem(d.id, d.data()))
    : [];
  const moments: CatalogItem[] = momentsSnap?.docs
    ? momentsSnap.docs.map((d) => toCatalogItem(d.id, d.data()))
    : [];

  return { subjects, groups, moments };
}

export const BANK_CACHE_KEY = "zse:bankMetricsCache:v1";
export const BANK_CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchBankMetricsFromFirestore() {
  const types = [
    "single_choice",
    "multiple_choice",
    "open_concept",
    "puzzle_order",
    "puzzle_match",
    "puzzle_cloze",
  ] as const;
  const difficulties = ["easy", "medium", "hard"] as const;

  const settled = await Promise.allSettled([
    getCountFromServer(collection(firestore, "questions")),
    getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "published"))),
    getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "draft"))),
    getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "archived"))),
    ...types.map((t) => getCountFromServer(query(collection(firestore, "questions"), where("type", "==", t)))),
    ...difficulties.map((d) =>
      getCountFromServer(query(collection(firestore, "questions"), where("difficulty", "==", d))),
    ),
  ]);

  const hasFailures = settled.some((s) => s.status === "rejected");

  const getSettledCount = (idx: number): number => {
    const s = settled[idx];
    return s && s.status === "fulfilled" ? s.value.data().count : 0;
  };

  const total = getSettledCount(0);
  const published = getSettledCount(1);
  const draft = getSettledCount(2);
  const archived = getSettledCount(3);

  const baseOffset = 4;
  const byType = types.map((t, idx) => ({
    label: typeLabel(t),
    value: getSettledCount(baseOffset + idx),
  }));

  const diffOffset = baseOffset + types.length;
  const byDifficulty = difficulties.map((d, idx) => ({
    label: difficultyLabel(d),
    value: getSettledCount(diffOffset + idx),
  }));

  const counts = { total, published, draft, archived };

  return { counts, byType, byDifficulty, hasFailures };
}

export async function fetchBankSampleData(
  selectedSubjectId: string,
  selectedMomentId: string,
  subjects: CatalogItem[],
  groups: CatalogItem[],
  moments: CatalogItem[],
) {
  const constraints = selectedSubjectId
    ? [where("subjectId", "==", selectedSubjectId), limit(500)]
    : [orderBy("updatedAt", "desc"), limit(220)];

  const snap = await getDocs(query(collection(firestore, "questions"), ...(constraints as any)));

  const momentFilter = selectedMomentId.trim();
  const docsRaw = snap.docs;
  const filteredDocsRaw = momentFilter
    ? docsRaw.filter((d) => {
        const row = d.data() as Record<string, unknown>;
        const ids = Array.isArray(row.momentIds) ? (row.momentIds as unknown[]) : [];
        const legacy = typeof row.momentId === "string" ? row.momentId : "";
        return ids.includes(momentFilter) || legacy === momentFilter;
      })
    : docsRaw;

  const filteredDocs = [...filteredDocsRaw].sort((a, b) => {
    const aDate = toDate(a.data().updatedAt);
    const bDate = toDate(b.data().updatedAt);
    const aTime = aDate ? aDate.getTime() : 0;
    const bTime = bDate ? bDate.getTime() : 0;
    return bTime - aTime;
  });

  const preview = filteredDocs.slice(0, 48).map((d) => {
    const row = d.data() as Record<string, unknown>;
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
  const missingStatus = previewDocs.filter((d) => !safeToString(d.data().status, "")).length;
  const missingPoints = previewDocs.filter((d) => safeToNumber(d.data().points) === null).length;
  const missingGroups = previewDocs.filter((d) => {
    const ids = d.data().groupIds as unknown;
    return !Array.isArray(ids) || ids.length === 0;
  }).length;
  const missingMoments = previewDocs.filter((d) => {
    const ids = d.data().momentIds as unknown;
    const legacy = d.data().momentId as unknown;
    const legacyOk = typeof legacy === "string" && legacy.trim();
    return (!Array.isArray(ids) || ids.length === 0) && !legacyOk;
  }).length;

  const subjectCounts = new Map<string, number>();
  const groupCounts = new Map<string, number>();
  const momentCounts = new Map<string, number>();
  previewDocs.forEach((d) => {
    const row = d.data() as Record<string, unknown>;
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

  return {
    preview,
    topSubjects,
    topGroups,
    topMoments,
    quality: { missingStatus, missingPoints, missingGroups, missingMoments },
  };
}

export async function fetchBankTableRows(maxCount = 500): Promise<QuestionTableRow[]> {
  const snap = await getDocs(
    query(collection(firestore, "questions"), orderBy("updatedAt", "desc"), limit(maxCount)),
  );
  return snap.docs.map((d) => {
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
}

export async function fetchQuestionDetails(id: string): Promise<EditQuestion> {
  const snap = await getDoc(doc(firestore, "questions", id));
  if (!snap.exists()) {
    throw new Error("La pregunta no existe.");
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

  return {
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
    partialCredit: row.partialCredit === false ? false : type === "multiple_choice" ? true : row.partialCredit === true,
    answerRules,
    puzzleText,
  };
}

export async function saveQuestionToDb(q: EditQuestion, mode: "create" | "edit") {
  const statement = q.statement.trim();
  if (!statement) throw new Error("El enunciado es obligatorio.");
  if (!q.subjectId.trim()) throw new Error("La materia es obligatoria.");
  if (!q.momentIds.length) throw new Error("Debes seleccionar al menos un momento.");

  if (q.type === "single_choice") {
    const opts = q.options.filter((o) => o.text.trim());
    const correctCount = opts.filter((o) => o.isCorrect).length;
    if (opts.length < 2) throw new Error("Selección única requiere mínimo 2 opciones.");
    if (correctCount !== 1) throw new Error("Selección única requiere exactamente 1 opción correcta.");
  }
  if (q.type === "multiple_choice") {
    const opts = q.options.filter((o) => o.text.trim());
    const correctCount = opts.filter((o) => o.isCorrect).length;
    if (opts.length < 3) throw new Error("Selección múltiple requiere mínimo 3 opciones.");
    if (correctCount < 1) throw new Error("Selección múltiple requiere al menos 1 opción correcta.");
  }
  if (q.type === "open_concept") {
    const keywords = q.answerRules?.keywords ?? [];
    if (!keywords.length) throw new Error("Pregunta abierta requiere al menos una palabra clave.");
  }

  let puzzle: Record<string, unknown> | null = null;
  if (q.type.startsWith("puzzle_")) {
    try {
      puzzle = q.puzzleText.trim() ? (JSON.parse(q.puzzleText) as Record<string, unknown>) : {};
    } catch {
      throw new Error("El JSON del puzzle no es válido.");
    }
  }

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

  if (mode === "create") {
    await setDoc(doc(firestore, "questions", q.id), { ...payload, createdAt: serverTimestamp() }, { merge: true });
  } else {
    await updateDoc(doc(firestore, "questions", q.id), payload);
  }
}

export async function deleteQuestionFromDb(id: string) {
  await deleteDoc(doc(firestore, "questions", id));
}

export async function wipeAllQuestionsApi(token: string) {
  const res = await fetch("/api/admin/wipe-collection", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: "questions", confirm: "ELIMINAR" }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const message =
      typeof payload?.error === "string" ? payload.error : "No fue posible eliminar todas las preguntas.";
    throw new Error(message);
  }
}
