import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { normalizeSentenceText } from "@/lib/text/normalize";
import type { ExamPipelineFormData } from "../types";

export type ImportBatchResult = {
  ok: boolean;
  savedCount: number;
  error?: string;
};

export async function importBatchJsonToBank(
  batchJson: string,
  defaultSubjectId?: string,
  defaultMomentId?: string,
): Promise<ImportBatchResult> {
  try {
    const raw = JSON.parse(batchJson) as Record<string, unknown>;
    const questions = Array.isArray(raw.questions) ? raw.questions : [];

    if (questions.length === 0) {
      return { ok: false, savedCount: 0, error: "El JSON no contiene un arreglo de preguntas ('questions')." };
    }

    const batch = writeBatch(firestore);
    let count = 0;

    for (const item of questions) {
      if (!item || typeof item !== "object") continue;
      const q = item as Record<string, unknown>;
      const statement = typeof q.statement === "string" ? q.statement.trim() : "";
      if (!statement) continue;

      const qSubjectId = typeof q.subjectId === "string" && q.subjectId.trim() ? q.subjectId.trim() : defaultSubjectId || "";
      const qMomentId = typeof q.momentId === "string" && q.momentId.trim() ? q.momentId.trim() : defaultMomentId || "";

      const ref = doc(collection(firestore, "questions"));
      const docPayload: Record<string, unknown> = {
        statement,
        type: typeof q.type === "string" ? q.type : "single_choice",
        difficulty: typeof q.difficulty === "string" ? q.difficulty : "medium",
        points: typeof q.points === "number" ? q.points : 1,
        subjectId: qSubjectId,
        momentIds: qMomentId ? [qMomentId] : [],
        groupIds: Array.isArray(q.groupIds) ? q.groupIds : [],
        options: Array.isArray(q.options) ? q.options : [],
        explanation: typeof q.explanation === "string" ? q.explanation : "",
        status: "published",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (q.puzzle && typeof q.puzzle === "object") {
        docPayload.puzzle = q.puzzle;
      }
      if (q.answerRules && typeof q.answerRules === "object") {
        docPayload.answerRules = q.answerRules;
      }
      if (Array.isArray(q.tags)) {
        docPayload.tags = q.tags;
      }
      if (typeof q.partialCredit === "boolean") {
        docPayload.partialCredit = q.partialCredit;
      }

      batch.set(ref, docPayload);
      count++;
      if (count >= 400) break; // Firestore batch limit is 500
    }

    if (count === 0) {
      return { ok: false, savedCount: 0, error: "No se encontraron preguntas válidas para guardar." };
    }

    await batch.commit();
    return { ok: true, savedCount: count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al procesar el JSON.";
    return { ok: false, savedCount: 0, error: msg };
  }
}

export async function createExamFromPipeline(
  form: ExamPipelineFormData,
  autoName: string,
  documentationMarkdown: string,
): Promise<{ ok: boolean; templateId?: string; name?: string; error?: string }> {
  try {
    if (!form.subjectId || !form.groupId || !form.momentId || !form.siteId || !form.shiftId) {
      return { ok: false, error: "Completa Materia, Grupo/Ficha, Momento, Sede y Jornada." };
    }

    const nameRes = normalizeSentenceText(autoName);
    if (!nameRes.ok) {
      return { ok: false, error: nameRes.error };
    }

    const docRef = await addDoc(collection(firestore, "examTemplates"), {
      name: nameRes.value,
      institution: form.institution,
      subjectId: form.subjectId,
      groupId: form.groupId,
      momentId: form.momentId,
      siteId: form.siteId,
      shiftId: form.shiftId,
      questionCount: form.questionCount,
      timeLimitMinutes: form.timeLimitMinutes,
      documentationMarkdown: documentationMarkdown.trim(),
      fraudEnabled: form.fraudEnabled,
      allowedQuestionTypes: [
        "single_choice",
        "multiple_choice",
        "open_concept",
        "puzzle_order",
        "puzzle_match",
        "puzzle_cloze",
      ],
      accessCode: { mode: "generated_6_digits" },
      resultPolicy: { showScoreAfterSubmit: true, showAnswersAfterSubmit: false },
      gradingScale: "both",
      studentRequiredFields: ["fullName", "documentId", "email"],
      active: form.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { ok: true, templateId: docRef.id, name: nameRes.value };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible crear la plantilla del examen.";
    return { ok: false, error: msg };
  }
}
