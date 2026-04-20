import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

async function deleteCollection(ref: FirebaseFirestore.CollectionReference, batchSize = 400) {
  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) return;
    const batch = ref.firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const docId = toString(body?.docId, "").trim();
  if (!docId) return NextResponse.json({ error: "Debes indicar el documento a eliminar." }, { status: 400 });

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();

  const decoded = await adminAuth.verifyIdToken(token);
  const uid = decoded.uid;

  const adminSnap = await adminDb.collection("admins").doc(uid).get();
  if (!adminSnap.exists) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const docRef = adminDb.collection("studyDocs").doc(docId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return NextResponse.json({ error: "Documentación no encontrada." }, { status: 404 });

  const entriesRef = docRef.collection("entries");
  const entriesSnap = await entriesRef.get();
  for (const entry of entriesSnap.docs) {
    const revisionsRef = entry.ref.collection("revisions");
    await deleteCollection(revisionsRef, 400);
    await entry.ref.delete();
  }

  await docRef.delete();

  return NextResponse.json({ ok: true }, { status: 200 });
}

