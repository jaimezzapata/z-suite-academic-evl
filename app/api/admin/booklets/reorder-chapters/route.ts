import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const docId = toString(body?.docId, "").trim();
    const orderedIds = Array.isArray(body?.orderedIds) ? (body?.orderedIds as unknown[]) : [];
    const normalized = orderedIds.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
    if (!docId || !normalized.length) {
      return NextResponse.json({ error: "Debes indicar cuadernillo y el orden de capítulos." }, { status: 400 });
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

    const entriesSnap = await docRef.collection("entries").get();
    const existingIds = entriesSnap.docs.map((d) => d.id);
    if (!existingIds.length) return NextResponse.json({ error: "El cuadernillo no tiene capítulos." }, { status: 409 });

    const expected = new Set(existingIds);
    const got = new Set(normalized);
    if (expected.size !== got.size || normalized.length !== existingIds.length) {
      return NextResponse.json({ error: "El orden no coincide con los capítulos actuales." }, { status: 400 });
    }
    for (const id of expected) {
      if (!got.has(id)) return NextResponse.json({ error: "El orden no coincide con los capítulos actuales." }, { status: 400 });
    }

    const byId = new Map<string, Record<string, unknown>>();
    entriesSnap.docs.forEach((d) => byId.set(d.id, d.data() as Record<string, unknown>));

    const now = FieldValue.serverTimestamp();
    const newIds: string[] = [];
    let batch = adminDb.batch();
    let ops = 0;

    for (let i = 0; i < normalized.length; i += 1) {
      const oldId = normalized[i]!;
      const old = byId.get(oldId) ?? {};
      const chapterIndex = i + 1;
      const newId = `C${String(chapterIndex).padStart(2, "0")}`;
      newIds.push(newId);

      const next = {
        ...old,
        institution: toString(docData.institution, ""),
        subjectId: toString(docData.subjectId, ""),
        subjectName: toString(docData.subjectName, ""),
        groupId: toString(docData.groupId, ""),
        groupName: toString(docData.groupName, ""),
        weekIndex: chapterIndex,
        weekLabel: `C${chapterIndex}`,
        chapterIndex,
        publishMode: "replace",
        updatedAt: now,
        updatedBy: uid,
        createdAt: old.createdAt ?? now,
        publishedAt: old.publishedAt ?? now,
      };

      batch.set(docRef.collection("entries").doc(newId), next, { merge: false });
      ops += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        ops = 0;
      }
    }

    const keep = new Set(newIds);
    for (const oldId of existingIds) {
      if (keep.has(oldId)) continue;
      batch.delete(docRef.collection("entries").doc(oldId));
      ops += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        ops = 0;
      }
    }

    batch.set(
      docRef,
      {
        chaptersCount: newIds.length,
        weeksTotal: newIds.length,
        cutoffWeek: newIds.length,
        updatedAt: now,
        updatedBy: uid,
      },
      { merge: true },
    );
    ops += 1;

    if (ops > 0) await batch.commit();

    return NextResponse.json({ ok: true, chaptersCount: newIds.length }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible reordenar capítulos.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

