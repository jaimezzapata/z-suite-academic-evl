import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

type SessionPolicy = "trimester" | "semester" | "custom";
type PublishMode = "append" | "replace";
type Institution = "CESDE" | "SENA";

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
  return base || "materia";
}

function buildAccessCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function formatDateLabel(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(input: string) {
  const value = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const subjectId = toString(body?.subjectId, "").trim();
    const subjectName = toString(body?.subjectName, "").trim();
    const markdown = toString(body?.markdown, "").trim();
    const institutionRaw = toString(body?.institution, "").trim().toUpperCase();
    const institution: Institution = institutionRaw === "SENA" ? "SENA" : "CESDE";
    const weekIndex = Math.floor(toNumber(body?.weekIndex, 0));
    const dateIso = toString(body?.dateIso, "").trim();
    const momentIdRaw = toString(body?.momentId, "").trim().toUpperCase();
    const momentId = momentIdRaw === "M1" || momentIdRaw === "M2" || momentIdRaw === "M3" ? momentIdRaw : "";
    const sessionPolicyRaw = toString(body?.sessionPolicy, "trimester").trim().toLowerCase();
    const sessionPolicy: SessionPolicy =
      sessionPolicyRaw === "semester" ? "semester" : sessionPolicyRaw === "custom" ? "custom" : "trimester";
    const sessionDaysRaw = Math.floor(toNumber(body?.sessionDays, sessionPolicy === "semester" ? 180 : 90));
    const sessionDays = Math.max(1, Math.min(365, sessionDaysRaw));
    const regenerateCode = body?.regenerateCode === true;
    const publishModeRaw = toString(body?.publishMode, "append").trim().toLowerCase();
    const publishMode: PublishMode = publishModeRaw === "replace" ? "replace" : "append";
    const appendTitle = toString(body?.appendTitle, "").trim();

    if (!subjectId) return NextResponse.json({ error: "Debes seleccionar la materia." }, { status: 400 });
    if (!markdown) return NextResponse.json({ error: "No hay README para publicar." }, { status: 400 });
    if (institution === "CESDE") {
      if (!(weekIndex >= 1 && weekIndex <= 18)) {
        return NextResponse.json({ error: "En CESDE debes seleccionar semana (S1 a S18)." }, { status: 400 });
      }
      if (!parseIsoDate(dateIso)) {
        return NextResponse.json({ error: "En CESDE debes indicar la fecha (YYYY-MM-DD)." }, { status: 400 });
      }
      if (!momentId) {
        return NextResponse.json({ error: "En CESDE debes asociar el Momento (M1, M2 o M3)." }, { status: 400 });
      }
    } else {
      if (!(weekIndex >= 1 && weekIndex <= 11)) {
        return NextResponse.json({ error: "En SENA debes seleccionar semana (1 a 11)." }, { status: 400 });
      }
      if (!parseIsoDate(dateIso)) {
        return NextResponse.json({ error: "En SENA debes indicar la fecha (YYYY-MM-DD)." }, { status: 400 });
      }
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminSnap = await adminDb.collection("admins").doc(uid).get();
    if (!adminSnap.exists) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const subjectDoc = await adminDb.collection("subjects").doc(subjectId).get();
    const subjectNameResolved =
      subjectName ||
      (subjectDoc.exists ? toString(subjectDoc.data()?.name, "").trim() : "") ||
      subjectId;

    const docId = `${institution}_${subjectId}`;
    const docRef = adminDb.collection("studyDocs").doc(docId);
    const current = await docRef.get();
    const currentData = current.exists ? (current.data() as Record<string, unknown>) : null;

    const existingCode = toString(currentData?.accessCode, "");
    const accessCode = regenerateCode || !existingCode ? buildAccessCode() : existingCode;
    const slug = `${institution.toLowerCase()}-${normalizeSlug(subjectNameResolved || subjectId)}`;

    const now = new Date();
    const entryId = `W${String(weekIndex).padStart(2, "0")}`;
    const entryRef = docRef.collection("entries").doc(entryId);
    const entrySnap = await entryRef.get();
    const existingEntryMarkdown = entrySnap.exists ? toString(entrySnap.data()?.markdown, "").trim() : "";
    const dateLabel = parseIsoDate(dateIso) ? dateIso : formatDateLabel(now);
    const entryTitle =
      institution === "CESDE"
        ? `S${weekIndex} · ${dateLabel} · ${momentId}`
        : `Semana ${weekIndex} · ${dateLabel}`;

    const nextEntryMarkdown =
      publishMode === "replace" || !existingEntryMarkdown
        ? markdown
        : `${existingEntryMarkdown}\n\n---\n\n### ${appendTitle ? appendTitle : `Actualización ${formatDateLabel(now)}`}\n\n${markdown}\n`;

    const bytes = Buffer.byteLength(nextEntryMarkdown, "utf8");
    if (bytes > 900 * 1024) {
      return NextResponse.json(
        {
          error:
            `El contenido de esta semana es demasiado grande para Firestore (≈${Math.round(bytes / 1024)} KB). ` +
            `Recomendación: usa "Reemplazar todo" para esa semana o divide el contenido en otra semana.`,
        },
        { status: 400 },
      );
    }

    if (entrySnap.exists && existingEntryMarkdown && existingEntryMarkdown !== nextEntryMarkdown) {
      const revisionId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await entryRef.collection("revisions").doc(revisionId).set({
        createdAt: FieldValue.serverTimestamp(),
        createdBy: uid,
        subjectId,
        subjectName: subjectNameResolved,
        institution,
        weekIndex,
        dateIso,
        momentId: institution === "CESDE" ? momentId : null,
        publishMode,
        previousMarkdown: existingEntryMarkdown,
      });
    }

    await entryRef.set(
      {
        institution,
        subjectId,
        subjectName: subjectNameResolved,
        weekIndex,
        weekLabel: institution === "CESDE" ? `S${weekIndex}` : `W${weekIndex}`,
        dateIso,
        momentId: institution === "CESDE" ? momentId : null,
        title: entryTitle,
        markdown: nextEntryMarkdown,
        publishMode,
        updatedAt: FieldValue.serverTimestamp(),
        publishedAt: FieldValue.serverTimestamp(),
        createdAt: entrySnap.exists
          ? entrySnap.data()?.createdAt ?? FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
        updatedBy: uid,
      },
      { merge: true },
    );

    const cutoffWeek = weekIndex;

    await docRef.set(
      {
        docId,
        institution,
        subjectId,
        subjectName: subjectNameResolved,
        slug,
        title: `Documentación ${subjectNameResolved}`,
        accessCode,
        accessMode: "code",
        sessionPolicy,
        sessionDays,
        weeksTotal: institution === "CESDE" ? 18 : 11,
        cutoffWeek,
        cutoffMoment: institution === "CESDE" ? momentId : null,
        active: true,
        updatedAt: FieldValue.serverTimestamp(),
        publishedAt: FieldValue.serverTimestamp(),
        createdAt: current.exists
          ? currentData?.createdAt ?? FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
        updatedBy: uid,
        publishMode,
      },
      { merge: true },
    );

    return NextResponse.json(
      {
        ok: true,
        subjectId,
        subjectName: subjectNameResolved,
        institution,
        slug,
        urlPath: `/study/${slug}`,
        accessCode,
        sessionPolicy,
        sessionDays,
        publishMode,
        cutoffWeek,
        cutoffMoment: institution === "CESDE" ? momentId : null,
      },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible publicar la documentación.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
