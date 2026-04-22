import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Falta ${name}.`);
  return value.trim();
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
  const admin = await assertAdmin(req);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const adminDb = admin.adminDb;
  const uid = admin.uid;

  const clientId = requiredEnv("GOOGLE_DRIVE_OAUTH_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET");
  const redirectUri = requiredEnv("GOOGLE_DRIVE_OAUTH_REDIRECT_URI");
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const state = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  await adminDb
    .collection("driveOauthStates")
    .doc(state)
    .set({ uid, createdAt: new Date() }, { merge: true });

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: ["https://www.googleapis.com/auth/drive.file"],
    state,
  });

  return NextResponse.json({ ok: true, url }, { status: 200 });
}

