import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const docId = toString(body?.docId, "").trim();
    const title = toString(body?.title, "").trim();
    const markdown = toString(body?.markdown, "").trim();
    if (!docId || !title || !markdown) {
      return NextResponse.json({ error: "Debes indicar cuadernillo, título y contenido." }, { status: 400 });
    }

    const bytes = Buffer.byteLength(markdown, "utf8");
    if (bytes > 900 * 1024) {
      return NextResponse.json(
        {
          error: `El capítulo es demasiado grande para Firestore (≈${Math.round(bytes / 1024)} KB). Divide el contenido.`,
        },
        { status: 400 },
      );
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminSnap = await adminDb.collection("admins").doc(uid).get();
    if (!adminSnap.exists) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const docRef = adminDb.collection("studyDocs").doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return NextResponse.json({ error: "Cuadernillo no encontrado." }, { status: 404 });

    const docData = docSnap.data() as Record<string, unknown>;
    if (toString(docData.docKind, "") !== "booklet") {
      return NextResponse.json({ error: "El documento no corresponde a un cuadernillo." }, { status: 400 });
    }

    const lastChapterSnap = await docRef.collection("entries").orderBy("weekIndex", "desc").limit(1).get();
    const last = lastChapterSnap.docs[0]?.data() as Record<string, unknown> | undefined;
    const lastIndex = typeof last?.weekIndex === "number" && Number.isFinite(last.weekIndex) ? Math.floor(last.weekIndex) : 0;
    const chapterIndex = lastIndex + 1;
    const entryId = `C${String(chapterIndex).padStart(2, "0")}`;

    await docRef.collection("entries").doc(entryId).set(
      {
        institution: toString(docData.institution, ""),
        subjectId: toString(docData.subjectId, ""),
        subjectName: toString(docData.subjectName, ""),
        groupId: toString(docData.groupId, ""),
        groupName: toString(docData.groupName, ""),
        weekIndex: chapterIndex,
        weekLabel: `C${chapterIndex}`,
        chapterIndex,
        title,
        markdown,
        publishMode: "replace",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        publishedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      },
      { merge: true },
    );

    await docRef.set(
      {
        chaptersCount: chapterIndex,
        weeksTotal: chapterIndex,
        cutoffWeek: chapterIndex,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, chapterIndex, chapterId: entryId }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible agregar el capítulo.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

