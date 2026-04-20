import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const code = toString(body?.code, "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "El codigo debe tener 6 digitos." }, { status: 400 });
  }

  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const snap = await adminDb
    .collection("publishedExams")
    .where("accessCode", "==", code)
    .limit(5)
    .get();

  const found = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .find((row) => {
      const r = row as Record<string, unknown>;
      return toString(r.status, "published") === "published";
    });

  if (!found) {
    return NextResponse.json({ error: "No se encontro un examen publicado con ese codigo." }, { status: 404 });
  }

  const foundRow = found as Record<string, unknown> & { id: string };

  const qSnap = await adminDb
    .collection("publishedExams")
    .doc(foundRow.id)
    .collection("questions")
    .orderBy("order", "asc")
    .limit(300)
    .get();

  const questions = qSnap.docs.map((d) => {
    const row = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      questionId: toString(row.questionId, d.id),
      order: toNumber(row.order, 0),
      type: toString(row.type, "single_choice"),
      statement: toString(row.statement, ""),
      points: toNumber(row.points, 1),
      options: Array.isArray(row.options) ? row.options : undefined,
      partialCredit: Boolean(row.partialCredit),
      answerRules: (row.answerRules as Record<string, unknown> | undefined) ?? undefined,
      puzzle: (row.puzzle as Record<string, unknown> | undefined) ?? undefined,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      exam: {
        id: foundRow.id,
        templateId: toString(foundRow.templateId, ""),
        name: toString(foundRow.name, "Examen"),
        accessCode: toString(foundRow.accessCode, code),
        status: toString(foundRow.status, "published"),
        questionCount: toNumber(foundRow.questionCount, 0),
        timeLimitMinutes: toNumber(foundRow.timeLimitMinutes, 60),
        documentationMarkdown: toString(foundRow.documentationMarkdown, ""),
      },
      questions,
    },
    { status: 200 },
  );
}

