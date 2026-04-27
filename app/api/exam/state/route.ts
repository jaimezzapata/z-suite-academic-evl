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

  if (!publishedExamId) return NextResponse.json({ error: "Falta publishedExamId." }, { status: 400 });
  if (!/^\d{6}$/.test(accessCode)) return NextResponse.json({ error: "El codigo debe tener 6 digitos." }, { status: 400 });

  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const snap = await adminDb.collection("publishedExams").doc(publishedExamId).get();
  if (!snap.exists) return NextResponse.json({ error: "No se encontro el examen." }, { status: 404 });
  const row = snap.data() as Record<string, unknown>;
  if (toString(row.accessCode, "") !== accessCode) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  return NextResponse.json(
    {
      ok: true,
      exam: {
        id: publishedExamId,
        status: toString(row.status, "published"),
        questionCount: Math.max(1, toNumber(row.questionCount, 1)),
        timeLimitMinutes: Math.max(1, toNumber(row.timeLimitMinutes, 60)),
        documentationMarkdown: toString(row.documentationMarkdown, ""),
        fraudEnabled: toBoolean(row.fraudEnabled, true),
      },
    },
    { status: 200 },
  );
}

