import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

async function assertAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return { ok: false as const, status: 401, error: "Unauthorized" };

  let adminAuth: ReturnType<typeof getAdminAuth>;
  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminAuth = getAdminAuth();
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales admin.";
    return { ok: false as const, status: 500, error: msg };
  }

  let uid = "";
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token inválido.";
    return { ok: false as const, status: 401, error: `Token inválido o expirado. ${msg}` };
  }

  const adminSnap = await adminDb.collection("admins").doc(uid).get();
  if (!adminSnap.exists) return { ok: false as const, status: 403, error: "Forbidden" };

  return { ok: true as const, adminDb, uid };
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

async function deleteByQuery(q: FirebaseFirestore.Query, batchSize = 400) {
  while (true) {
    const snap = await q.limit(batchSize).get();
    if (snap.empty) return;
    const batch = snap.docs[0]!.ref.firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function POST(req: Request) {
  const admin = await assertAdmin(req);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const adminDb = admin.adminDb;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const workspaceId = toString(body?.workspaceId, "").trim();
  if (!workspaceId) return NextResponse.json({ error: "Debes indicar workspaceId." }, { status: 400 });

  const wsRef = adminDb.collection("driveWorkspaces").doc(workspaceId);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });

  await deleteCollection(wsRef.collection("nodes"), 400);
  await deleteCollection(wsRef.collection("files"), 400);
  await wsRef.delete();

  await deleteByQuery(adminDb.collection("driveFiles").where("workspaceId", "==", workspaceId), 400);

  return NextResponse.json({ ok: true }, { status: 200 });
}

