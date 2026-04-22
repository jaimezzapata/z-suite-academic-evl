import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getOAuthDriveClient } from "@/lib/google/drive";

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

function classifyDriveError(err: unknown) {
  const e = err as any;
  const status = typeof e?.code === "number" ? e.code : typeof e?.response?.status === "number" ? e.response.status : null;
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Error";
  if (status === 404) return { kind: "not_found", status, message };
  if (status === 403) return { kind: "forbidden", status, message };
  return { kind: "unknown", status, message };
}

async function checkFolder(drive: ReturnType<typeof getOAuthDriveClient>, folderId: string) {
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: "id, name, trashed",
      supportsAllDrives: true,
    });
    const trashed = Boolean(res.data.trashed);
    return { ok: !trashed, trashed, name: res.data.name ?? "", error: null as any };
  } catch (err) {
    return { ok: false, trashed: false, name: "", error: classifyDriveError(err) };
  }
}

export async function POST(req: Request) {
  const admin = await assertAdmin(req);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const adminDb = admin.adminDb;
  const uid = admin.uid;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const workspaceId = toString(body?.workspaceId, "").trim();
  if (!workspaceId) return NextResponse.json({ error: "Debes indicar workspaceId." }, { status: 400 });

  const wsRef = adminDb.collection("driveWorkspaces").doc(workspaceId);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });
  const ws = wsSnap.data() as Record<string, unknown>;
  const driveInfo = (ws.drive as Record<string, unknown> | undefined) ?? {};
  const groupFolderId = toString(driveInfo.groupFolderId, "").trim();
  const adminFolderId = toString(driveInfo.adminFolderId, "").trim();
  const publicFolderId = toString(driveInfo.publicFolderId, "").trim();

  const tokenSnap = await adminDb.collection("driveOauthTokens").doc(uid).get();
  const refreshToken = tokenSnap.exists ? toString(tokenSnap.data()?.refreshToken, "").trim() : "";
  if (!refreshToken) return NextResponse.json({ error: "Debes conectar Drive." }, { status: 412 });

  let drive: ReturnType<typeof getOAuthDriveClient>;
  try {
    drive = getOAuthDriveClient(refreshToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Credenciales OAuth inválidas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const results: Array<{ key: string; folderId: string; ok: boolean; trashed?: boolean; error?: any }> = [];
  if (groupFolderId) results.push({ key: "group", folderId: groupFolderId, ...(await checkFolder(drive, groupFolderId)) });
  if (adminFolderId) results.push({ key: "admin", folderId: adminFolderId, ...(await checkFolder(drive, adminFolderId)) });
  if (publicFolderId) results.push({ key: "public", folderId: publicFolderId, ...(await checkFolder(drive, publicFolderId)) });

  const issues = results.filter((r) => !r.ok).map((r) => ({ key: r.key, folderId: r.folderId, error: r.error, trashed: r.trashed }));
  const broken = issues.length > 0;
  const now = new Date();

  await wsRef.set(
    {
      health: {
        broken,
        issues,
        lastCheckedAt: now,
      },
      updatedAt: now,
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, broken, issues }, { status: 200 });
}

