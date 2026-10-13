import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { AcademicTopic } from "../types";

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * Obtiene el temario guardado automáticamente para una materia específica.
 */
export async function getTopicForSubject(subjectId: string): Promise<AcademicTopic | null> {
  if (!subjectId || !subjectId.trim()) return null;
  const sid = subjectId.trim();

  try {
    // 1. Intentar por ID directo de documento
    const directRef = doc(firestore, "academicTopics", sid);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      const data = directSnap.data() as Record<string, unknown>;
      return {
        id: directSnap.id,
        subjectId: safeString(data.subjectId, sid),
        subjectName: safeString(data.subjectName, "Materia"),
        title: safeString(data.title, "Temario"),
        topics: safeString(data.topics),
        criteria: safeString(data.criteria),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }

    // 2. Fallback a consulta por campo subjectId
    const q = query(
      collection(firestore, "academicTopics"),
      where("subjectId", "==", sid),
      orderBy("updatedAt", "desc"),
      limit(1),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        subjectId: safeString(data.subjectId, sid),
        subjectName: safeString(data.subjectName, "Materia"),
        title: safeString(data.title, "Temario"),
        topics: safeString(data.topics),
        criteria: safeString(data.criteria),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }

    return null;
  } catch (err) {
    console.error("Error al obtener temario por materia:", err);
    return null;
  }
}

/**
 * Guarda o actualiza automáticamente el temario de una materia sin intervención manual.
 */
export async function autoSaveTopicForSubject(
  subjectId: string,
  subjectName: string,
  topics: string,
  criteria: string,
): Promise<void> {
  if (!subjectId || !subjectId.trim() || !topics.trim()) return;
  const sid = subjectId.trim();

  try {
    const directRef = doc(firestore, "academicTopics", sid);
    await setDoc(
      directRef,
      {
        subjectId: sid,
        subjectName: subjectName.trim() || "Materia",
        title: `Temario: ${subjectName.trim() || sid}`,
        topics: topics.trim(),
        criteria: criteria.trim(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("Error al auto-guardar temario:", err);
  }
}

/**
 * Obtiene la lista de temarios guardados para selector opcional si existen múltiples.
 */
export async function fetchTopicsForSubject(subjectId?: string): Promise<AcademicTopic[]> {
  try {
    const col = collection(firestore, "academicTopics");
    let q = query(col, orderBy("updatedAt", "desc"), limit(50));

    if (subjectId && subjectId.trim()) {
      q = query(col, where("subjectId", "==", subjectId.trim()), limit(50));
    }

    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        subjectId: safeString(data.subjectId),
        subjectName: safeString(data.subjectName, "Materia"),
        title: safeString(data.title, "Sin título"),
        topics: safeString(data.topics),
        criteria: safeString(data.criteria),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
  } catch {
    return [];
  }
}
