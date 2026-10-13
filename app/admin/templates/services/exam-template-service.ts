import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { CatalogItem, ExamTemplateRow, PreviewQuestion, ExamFormData } from "../types";

export function normalizeStatementMarkdown(statement: string) {
  const raw = typeof statement === "string" ? statement : "";
  if (!raw.includes("```")) return raw;
  return raw
    .replace(/```(\w+)[ \t]+/g, "```$1\n")
    .replace(/([^\n])```/g, "$1\n```");
}

export function getQuestionTypeLabel(type?: string) {
  switch (type) {
    case "single_choice":
      return "Selección única";
    case "multiple_choice":
      return "Selección múltiple";
    case "puzzle_order":
      return "Ordenar";
    case "puzzle_match":
      return "Emparejar";
    case "puzzle_blank":
      return "Completar espacios";
    case "open_text":
      return "Texto libre";
    default:
      return type || "Pregunta";
  }
}

export function getDifficultyBadge(diff?: string) {
  switch (diff?.toLowerCase()) {
    case "easy":
    case "fácil":
    case "facil":
      return { label: "Fácil", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "medium":
    case "media":
      return { label: "Media", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "hard":
    case "difícil":
    case "dificil":
      return { label: "Difícil", cls: "bg-rose-50 text-rose-700 border-rose-200" };
    default:
      return { label: diff || "General", cls: "bg-zinc-50 text-zinc-700 border-zinc-200" };
  }
}

export function momentRank(id: unknown) {
  const s = typeof id === "string" ? id.trim().toLowerCase() : "";
  const m = /^m(\d+)$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

export function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function toString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function buildExamName(params: {
  subject?: string;
  group?: string;
  site?: string;
  shift?: string;
  moment?: string;
}) {
  const parts = [params.site, params.subject, params.group, params.shift, params.moment].filter(Boolean);
  return parts.join(" - ") || "Nuevo examen";
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer el archivo."));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  });
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function generateUniqueAccessCode(): Promise<string> {
  for (let i = 0; i < 15; i += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const snap = await getDocs(query(collection(firestore, "publishedExams"), where("accessCode", "==", code), limit(1)));
    if (snap.empty) return code;
  }
  throw new Error("No fue posible generar un código único.");
}

export async function fetchExamCatalogs() {
  const [subjectsSnap, groupsSnap, fichasSnap, momentsSnap, sitesSnap, shiftsSnap] = await Promise.all([
    getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(200))),
    getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(200))),
    getDocs(query(collection(firestore, "fichas"), orderBy("name"), limit(600))),
    getDocs(query(collection(firestore, "moments"), orderBy("name"), limit(50))),
    getDocs(query(collection(firestore, "sites"), orderBy("name"), limit(50))),
    getDocs(query(collection(firestore, "shifts"), orderBy("name"), limit(50))),
  ]);

  return {
    subjects: subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data())),
    groups: groupsSnap.docs.map((d) => toCatalogItem(d.id, d.data())),
    fichas: fichasSnap.docs.map((d) => toCatalogItem(d.id, d.data())),
    moments: momentsSnap.docs.map((d) => toCatalogItem(d.id, d.data())),
    sites: sitesSnap.docs.map((d) => toCatalogItem(d.id, d.data())),
    shifts: shiftsSnap.docs.map((d) => toCatalogItem(d.id, d.data())),
  };
}

export async function fetchEligibleQuestionsForTemplate(
  subjectId: string,
  momentId: string,
): Promise<{ eligible: PreviewQuestion[]; candidatesCount: number }> {
  const questionSnap = await getDocs(
    query(
      collection(firestore, "questions"),
      where("subjectId", "==", subjectId),
      where("status", "==", "published"),
      limit(1200),
    ),
  );

  const candidates = questionSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  })) as PreviewQuestion[];

  const examRank = momentRank(momentId);
  const eligible = candidates.filter((q) => {
    const momentIds = Array.isArray(q.momentIds)
      ? (q.momentIds as unknown[])
      : typeof q.momentIds === "string"
        ? [q.momentIds]
        : typeof q.momentId === "string"
          ? [q.momentId]
          : [];

    if (momentIds.length === 0) return true;
    if (examRank === null) return momentIds.includes(momentId);

    return momentIds.some((m) => {
      const r = momentRank(m);
      return r !== null && r <= examRank;
    });
  });

  return { eligible, candidatesCount: candidates.length };
}

export async function publishExamToFirestore(
  target: ExamTemplateRow,
  selectedQuestions: PreviewQuestion[],
): Promise<string> {
  const accessCode = await generateUniqueAccessCode();

  const publishedRef = await addDoc(collection(firestore, "publishedExams"), {
    templateId: target.id,
    templateName: target.name,
    name: target.name,
    institution: target.institution,
    subjectId: target.subjectId,
    groupId: target.groupId,
    momentId: target.momentId,
    siteId: target.siteId,
    shiftId: target.shiftId,
    questionCount: selectedQuestions.length,
    timeLimitMinutes: target.timeLimitMinutes || 60,
    documentationMarkdown: target.documentationMarkdown || "",
    fraudEnabled: target.fraudEnabled,
    accessCode,
    status: "published",
    publishedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(firestore);
  selectedQuestions.forEach((q, index) => {
    const qRef = doc(firestore, "publishedExams", publishedRef.id, "questions", q.id);
    batch.set(qRef, {
      ...q,
      questionId: q.id,
      order: index + 1,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();

  return accessCode;
}

export async function checkTemplateAttemptsCount(templateId: string): Promise<number> {
  const [byExamTemplateId, byTemplateId] = await Promise.all([
    getCountFromServer(
      query(collection(firestore, "attempts"), where("examTemplateId", "==", templateId)),
    ),
    getCountFromServer(
      query(collection(firestore, "attempts"), where("templateId", "==", templateId)),
    ),
  ]);
  return byExamTemplateId.data().count + byTemplateId.data().count;
}

export async function deleteTemplateFromDb(templateId: string): Promise<void> {
  const publishedSnap = await getDocs(
    query(collection(firestore, "publishedExams"), where("templateId", "==", templateId), limit(200)),
  );
  const publishedIds = publishedSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .filter((r) => toString((r as Record<string, unknown>).status, "published") === "published")
    .map((r) => (r as { id: string }).id);

  await Promise.all(
    publishedIds.map(async (id) => {
      await updateDoc(doc(firestore, "publishedExams", id), {
        status: "closed",
        closedAt: serverTimestamp(),
        closedReason: "template_deleted",
        updatedAt: serverTimestamp(),
      });
    }),
  );

  await deleteDoc(doc(firestore, "examTemplates", templateId));
}
