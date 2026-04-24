import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const publishedExamId = toString(body?.publishedExamId, "").trim();
  const accessCode = toString(body?.accessCode, "").trim();

  const studentFirstName = toString(body?.studentFirstName, "").trim();
  const studentLastName = toString(body?.studentLastName, "").trim();
  const studentFullName = toString(body?.studentFullName, "").trim();
  const documentId = toString(body?.documentId, "").trim();
  const email = toString(body?.email, "").trim().toLowerCase();

  const examTemplateId = toString(body?.examTemplateId, "").trim() || null;
  const templateId = toString(body?.templateId, "").trim() || null;
  const examName = toString(body?.examName, "Examen").trim();
  const questionCount = Math.max(1, Math.min(300, toNumber(body?.questionCount, 0)));
  const questionOrder = Array.isArray(body?.questionOrder)
    ? (body?.questionOrder as unknown[]).map((x) => (typeof x === "string" ? x : "")).filter(Boolean)
    : [];

  if (!publishedExamId) return NextResponse.json({ error: "Falta publishedExamId." }, { status: 400 });
  if (!/^\d{6}$/.test(accessCode)) return NextResponse.json({ error: "El codigo debe tener 6 digitos." }, { status: 400 });
  if (!studentFirstName || !studentLastName || !studentFullName) {
    return NextResponse.json({ error: "Datos de estudiante incompletos." }, { status: 400 });
  }
  if (!documentId) return NextResponse.json({ error: "Documento es obligatorio." }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Correo invalido." }, { status: 400 });
  if (!questionCount || questionOrder.length === 0) {
    return NextResponse.json({ error: "No fue posible inicializar el intento." }, { status: 400 });
  }

  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    const publishedRef = adminDb.collection("publishedExams").doc(publishedExamId);
    const attemptRef = adminDb.collection("attempts").doc();

    const lockEmailId = `${publishedExamId}:email:${email}`;
    const lockDocId = `${publishedExamId}:doc:${documentId}`;
    const lockEmailRef = adminDb.collection("attemptLocks").doc(lockEmailId);
    const lockDocRef = adminDb.collection("attemptLocks").doc(lockDocId);

    const res = await adminDb.runTransaction(async (tx) => {
      const publishedSnap = await tx.get(publishedRef);
      if (!publishedSnap.exists) {
        return { ok: false as const, error: "No se encontro el examen publicado." };
      }
      const published = publishedSnap.data() as Record<string, unknown>;
      const status = toString(published.status, "published");
      const code = toString(published.accessCode, "");
      if (status !== "published" || code !== accessCode) {
        return { ok: false as const, error: "No se encontro un examen publicado con ese codigo." };
      }

      const [emailLockSnap, docLockSnap] = await Promise.all([tx.get(lockEmailRef), tx.get(lockDocRef)]);
      if (emailLockSnap.exists || docLockSnap.exists) {
        return { ok: false as const, error: "Ya existe un intento registrado con ese correo o documento. Solo se permite un intento." };
      }

      const fraudEnabled = toBoolean(published.fraudEnabled, true);
      const now = Date.now();

      tx.create(attemptRef, {
        publishedExamId,
        examTemplateId,
        templateId,
        examName,
        accessCode,
        fraudEnabled,
        studentFirstName,
        studentLastName,
        studentFullName,
        documentId,
        email,
        status: "in_progress",
        questionCount,
        answers: {},
        questionOrder,
        currentQuestionIndex: 0,
        fraudTabSwitches: 0,
        fraudClipboardAttempts: 0,
        startedAt: new Date(now),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });

      tx.create(lockEmailRef, { attemptId: attemptRef.id, createdAt: new Date(now) });
      tx.create(lockDocRef, { attemptId: attemptRef.id, createdAt: new Date(now) });

      return { ok: true as const, attemptId: attemptRef.id, startedAtMs: now, fraudEnabled };
    });

    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
    return NextResponse.json({ ok: true, attemptId: res.attemptId, startedAtMs: res.startedAtMs, fraudEnabled: res.fraudEnabled }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "No fue posible validar el intento unico. Intenta de nuevo." }, { status: 500 });
  }
}

