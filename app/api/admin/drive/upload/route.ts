import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getOAuthDriveClient, uploadDriveFile } from "@/lib/google/drive";
import { FieldValue } from "firebase-admin/firestore";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isDriveDebugEnabled() {
  return process.env.DRIVE_DEBUG === "1" || process.env.NODE_ENV !== "production";
}

function errorToObject(err: unknown) {
  if (!err) return { name: "Error", message: "Unknown error" };
  if (err instanceof Error) return { name: err.name, message: err.message };
  if (typeof err === "string") return { name: "Error", message: err };
  return { name: "Error", message: "Unknown error" };
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

export async function POST(req: Request) {
  const debug = isDriveDebugEnabled();
  const opId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  const admin = await assertAdmin(req);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const adminDb = admin.adminDb;
  const uid = admin.uid;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Payload inválido." }, { status: 400 });

  const workspaceId = toString(form.get("workspaceId"), "").trim();
  const pathKey = toString(form.get("pathKey"), "").trim();
  const file = form.get("file");

  if (debug) console.log("[drive/upload] start", { opId, workspaceId, pathKey });

  if (!workspaceId) return NextResponse.json({ error: "Debes indicar workspaceId." }, { status: 400 });
  if (!pathKey) return NextResponse.json({ error: "Debes indicar el destino (pathKey)." }, { status: 400 });
  if (!file || typeof file === "string") return NextResponse.json({ error: "Debes adjuntar un archivo." }, { status: 400 });

  const workspaceRef = adminDb.collection("driveWorkspaces").doc(workspaceId);
  const wsSnap = await workspaceRef.get();
  if (!wsSnap.exists) return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });
  const ws = wsSnap.data() as Record<string, unknown>;

  const tokenSnap = await adminDb.collection("driveOauthTokens").doc(uid).get();
  const refreshToken = tokenSnap.exists ? toString(tokenSnap.data()?.refreshToken, "").trim() : "";
  if (!refreshToken) {
    return NextResponse.json({ error: "Debes conectar Drive para subir archivos." }, { status: 412 });
  }
  let oauthDrive: ReturnType<typeof getOAuthDriveClient>;
  try {
    oauthDrive = getOAuthDriveClient(refreshToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Credenciales OAuth inválidas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const nodeId = pathKey.replace(/\//g, "__").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 250);
  const nodeSnap = await workspaceRef.collection("nodes").doc(nodeId).get();
  if (!nodeSnap.exists) return NextResponse.json({ error: "Destino no encontrado." }, { status: 404 });
  const node = nodeSnap.data() as Record<string, unknown>;
  const folderId = toString(node.driveFolderId, "").trim();
  if (!folderId) return NextResponse.json({ error: "Destino inválido." }, { status: 400 });

  const blob = file as File;
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const name = blob.name || "archivo";
  const mimeType = blob.type || "application/octet-stream";

  if (debug) console.log("[drive/upload] file", { opId, name, mimeType, size: bytes.byteLength, folderId });

  let uploaded: Awaited<ReturnType<typeof uploadDriveFile>>;
  try {
    uploaded = await uploadDriveFile({ name, parentId: folderId, mimeType, bytes, drive: oauthDrive });
  } catch (err) {
    if (debug) console.log("[drive/upload] drive error", { opId, error: errorToObject(err) });
    const msg = err instanceof Error ? err.message : "No fue posible subir el archivo a Drive.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const docsLike =
    uploaded.mimeType === "application/pdf" ||
    uploaded.mimeType.toLowerCase().includes("pdf") ||
    uploaded.mimeType.startsWith("application/vnd.google-apps");

  const now = new Date();
  const fileRef = workspaceRef.collection("files").doc(uploaded.id);
  const fileDoc = {
    id: uploaded.id,
    name: uploaded.name,
    mimeType: uploaded.mimeType,
    size: uploaded.size,
    webViewLink: uploaded.webViewLink,
    webContentLink: uploaded.webContentLink,
    workspaceId,
    pathKey,
    driveFolderId: folderId,
    createdAt: now,
    updatedAt: now,
    uploadedBy: admin.uid,
    starred: false,
  };

  await fileRef.set(
    {
      ...fileDoc,
    },
    { merge: true },
  );

  await adminDb
    .collection("driveFiles")
    .doc(uploaded.id)
    .set(
      {
        ...fileDoc,
        institution: toString(ws.institution, ""),
        subjectId: toString(ws.subjectId, ""),
        subjectName: toString(ws.subjectName, ""),
        groupId: toString(ws.groupId, ""),
        groupName: toString(ws.groupName, ""),
        period: toString(ws.period, ""),
        campus: toString(ws.campus, ""),
        shift: toString(ws.shift, ""),
      },
      { merge: true },
    );

  await workspaceRef.set(
    {
      stats: {
        totalFiles: FieldValue.increment(1),
        docsFiles: FieldValue.increment(docsLike ? 1 : 0),
      },
      updatedAt: now,
    },
    { merge: true },
  );

  await adminDb
    .collection("driveMeta")
    .doc("stats")
    .set(
      {
        totalFiles: FieldValue.increment(1),
        docsFiles: FieldValue.increment(docsLike ? 1 : 0),
        updatedAt: now,
      },
      { merge: true },
    );

  if (debug) console.log("[drive/upload] ok", { opId, workspaceId, pathKey, fileId: uploaded.id, docsLike });

  return NextResponse.json({ ok: true, file: uploaded }, { status: 200 });
}
