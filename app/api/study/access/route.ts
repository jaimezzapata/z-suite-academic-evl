import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = toString(body?.slug, "").trim();
  const code = toString(body?.code, "")
    .trim()
    .replace(/\D/g, "")
    .slice(0, 6);
  const entryId = toString(body?.entryId, "").trim();

  if (!slug || !code) {
    return NextResponse.json({ error: "Debes indicar URL y código de acceso." }, { status: 400 });
  }

  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const snap = await adminDb
    .collection("studyDocs")
    .where("slug", "==", slug)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return NextResponse.json({ error: "Documentación no encontrada o inactiva." }, { status: 404 });

  const row = snap.docs[0]?.data() as Record<string, unknown>;
  const expectedCode = toString(row.accessCode, "");
  if (!expectedCode || expectedCode !== code) {
    return NextResponse.json({ error: "Código inválido." }, { status: 401 });
  }

  const cutoffWeek =
    typeof row.cutoffWeek === "number" && Number.isFinite(row.cutoffWeek) ? Math.floor(row.cutoffWeek) : null;
  if (!cutoffWeek || cutoffWeek < 1) {
    return NextResponse.json({ error: "Documentación sin semanas publicadas." }, { status: 409 });
  }

  const docId = snap.docs[0]?.id;
  const entriesRef = adminDb.collection("studyDocs").doc(docId).collection("entries");
  const entriesSnap = await entriesRef.where("weekIndex", "<=", cutoffWeek).orderBy("weekIndex", "asc").get();

  const subjectName = toString(row.subjectName, "Materia");
  const institution = toString(row.institution, "");
  const siteName = toString(row.siteName, toString(row.siteId, ""));
  const shiftName = toString(row.shiftName, toString(row.shiftId, ""));
  const groupName = toString(row.groupName, toString(row.groupId, ""));
  const docKind = toString(row.docKind, "");
  const docTitle = toString(row.title, docKind === "booklet" ? `Cuadernillo · ${subjectName}` : "Documentación");
  const chapters = entriesSnap.docs
    .map((d) => {
      const r = d.data() as Record<string, unknown>;
      const weekIndex = typeof r.weekIndex === "number" && Number.isFinite(r.weekIndex) ? Math.floor(r.weekIndex) : 0;
      const title = toString(r.title, "").trim() || `Capítulo ${weekIndex || d.id}`;
      return { id: d.id, index: weekIndex, title };
    })
    .filter((c) => c.index >= 1);

  let chapter: { id: string; index: number; title: string; markdown: string } | null = null;
  if (entryId) {
    const entrySnap = await entriesRef.doc(entryId).get();
    if (!entrySnap.exists) {
      return NextResponse.json({ error: "Capítulo no encontrado." }, { status: 404 });
    }
    const r = entrySnap.data() as Record<string, unknown>;
    const weekIndex = typeof r.weekIndex === "number" && Number.isFinite(r.weekIndex) ? Math.floor(r.weekIndex) : 0;
    if (!weekIndex || weekIndex > cutoffWeek) {
      return NextResponse.json({ error: "Capítulo no disponible." }, { status: 409 });
    }
    const title = toString(r.title, "").trim() || entryId;
    const markdown = toString(r.markdown, "").trim();
    chapter = { id: entryId, index: weekIndex, title, markdown };
  }

  return NextResponse.json(
    {
      ok: true,
      docId,
      slug: toString(row.slug, slug),
      title: docTitle,
      subjectId: toString(row.subjectId, ""),
      subjectName,
      institution,
      siteName,
      shiftName,
      groupName,
      docKind,
      cutoffWeek,
      cutoffMoment: toString(row.cutoffMoment, ""),
      chapters,
      chapter,
      sessionDays:
        typeof row.sessionDays === "number" && Number.isFinite(row.sessionDays)
          ? Math.max(1, Math.min(365, Math.floor(row.sessionDays)))
          : 90,
    },
    { status: 200 },
  );
}
