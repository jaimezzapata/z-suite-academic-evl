import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeSlug(input: string) {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return base || "cuadernillo";
}

function buildAccessCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

type ChapterInput = {
  title: string;
  markdown: string;
};

function readChapters(input: unknown): ChapterInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const title = toString(r.title, "").trim();
      const markdown = toString(r.markdown, "").trim();
      if (!title || !markdown) return null;
      return { title, markdown } satisfies ChapterInput;
    })
    .filter((x): x is ChapterInput => Boolean(x));
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const institution = toString(body?.institution, "CESDE").trim().toUpperCase();
    const siteId = toString(body?.siteId, "").trim();
    const shiftId = toString(body?.shiftId, "").trim();
    const groupId = toString(body?.groupId, "").trim();
    const subjectId = toString(body?.subjectId, "").trim();
    const titleInput = toString(body?.title, "").trim();
    const sessionDaysRaw = Math.floor(toNumber(body?.sessionDays, 120));
    const sessionDays = Math.max(1, Math.min(365, sessionDaysRaw));
    const chapters = readChapters(body?.chapters);

    if (!siteId || !shiftId || !groupId || !subjectId) {
      return NextResponse.json(
        { error: "Debes seleccionar institución, sede, jornada, grupo y materia." },
        { status: 400 },
      );
    }
    if (!chapters.length) {
      return NextResponse.json({ error: "Debes agregar al menos un capítulo README." }, { status: 400 });
    }

    for (const chapter of chapters) {
      const bytes = Buffer.byteLength(chapter.markdown, "utf8");
      if (bytes > 900 * 1024) {
        return NextResponse.json(
          {
            error:
              `El capítulo "${chapter.title}" es demasiado grande para Firestore (≈${Math.round(bytes / 1024)} KB). ` +
              "Divide el contenido en más capítulos.",
          },
          { status: 400 },
        );
      }
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminSnap = await adminDb.collection("admins").doc(uid).get();
    if (!adminSnap.exists) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [subjectSnap, groupSnap, siteSnap, shiftSnap] = await Promise.all([
      adminDb.collection("subjects").doc(subjectId).get(),
      adminDb.collection("groups").doc(groupId).get(),
      adminDb.collection("sites").doc(siteId).get(),
      adminDb.collection("shifts").doc(shiftId).get(),
    ]);

    const subjectName = toString(subjectSnap.data()?.name, subjectId);
    const groupName = toString(groupSnap.data()?.name, groupId);
    const siteName = toString(siteSnap.data()?.name, siteId);
    const shiftName = toString(shiftSnap.data()?.name, shiftId);
    const bookletTitle = titleInput || `${subjectName} · ${groupName}`;

    const now = Date.now().toString(36).slice(-6);
    const slugBase = normalizeSlug(`${institution}-${subjectName}-${groupName}-${siteName}`);
    const slug = `${slugBase}-${now}`;
    const accessCode = buildAccessCode();

    const docRef = adminDb.collection("studyDocs").doc();
    const docId = docRef.id;

    const batch = adminDb.batch();
    batch.set(docRef, {
      docId,
      docKind: "booklet",
      institution,
      siteId,
      siteName,
      shiftId,
      shiftName,
      groupId,
      groupName,
      subjectId,
      subjectName,
      slug,
      title: bookletTitle,
      accessCode,
      accessMode: "code",
      sessionPolicy: "custom",
      sessionDays,
      weeksTotal: chapters.length,
      cutoffWeek: chapters.length,
      cutoffMoment: null,
      chaptersCount: chapters.length,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      publishedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    });

    chapters.forEach((chapter, idx) => {
      const chapterIndex = idx + 1;
      const entryId = `C${String(chapterIndex).padStart(2, "0")}`;
      batch.set(docRef.collection("entries").doc(entryId), {
        institution,
        subjectId,
        subjectName,
        groupId,
        groupName,
        weekIndex: chapterIndex,
        weekLabel: `C${chapterIndex}`,
        chapterIndex,
        title: chapter.title,
        markdown: chapter.markdown,
        publishMode: "replace",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        publishedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      });
    });

    await batch.commit();

    return NextResponse.json(
      {
        ok: true,
        docId,
        slug,
        title: bookletTitle,
        accessCode,
        urlPath: `/study/${slug}`,
        chaptersCount: chapters.length,
      },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible crear el cuadernillo.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

