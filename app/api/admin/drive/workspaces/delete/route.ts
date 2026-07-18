import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { deleteWorkspaceCascade } from "@/lib/firebase/admin-cascade-delete";
import { trashAppsScriptDriveStructure } from "@/lib/google/apps-script-drive";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function adminFirestoreError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return `No fue posible validar el admin en Firestore. Revisa FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON o los permisos de la service account. ${message}`.trim();
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

  let adminSnap: FirebaseFirestore.DocumentSnapshot;
  try {
    adminSnap = await adminDb.collection("admins").doc(uid).get();
  } catch (err) {
    return { ok: false as const, status: 500, error: adminFirestoreError(err) };
  }
  if (!adminSnap.exists) return { ok: false as const, status: 403, error: "Forbidden" };

  return { ok: true as const, adminDb, uid };
}

export async function POST(req: Request) {
  const admin = await assertAdmin(req);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const adminDb = admin.adminDb;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const workspaceId = toString(body?.workspaceId, "").trim();
  if (!workspaceId) return NextResponse.json({ error: "Debes indicar workspaceId." }, { status: 400 });

  const workspaceSnap = await adminDb.collection("driveWorkspaces").doc(workspaceId).get();
  if (!workspaceSnap.exists) {
    return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });
  }

  const workspace = workspaceSnap.data() as Record<string, unknown>;
  const driveInfo = (workspace.drive as Record<string, unknown> | undefined) ?? {};
  const groupFolderId = toString(driveInfo.groupFolderId, "").trim();
  const publicFolderId = toString(driveInfo.publicFolderId, "").trim();

  let driveResult: { trashedFolderId: string; trashedFolderName: string; message: string } | null = null;
  if (groupFolderId || publicFolderId) {
    try {
      driveResult = await trashAppsScriptDriveStructure({ groupFolderId, publicFolderId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No fue posible enviar la estructura a la papelera de Drive.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const result = await deleteWorkspaceCascade(adminDb, workspaceId);
  return NextResponse.json({ ok: true, driveTrashed: Boolean(driveResult), drive: driveResult, ...result }, { status: 200 });
}

