import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

const ALLOWED_COLLECTIONS = [
  "attempts",
  "examTemplates",
  "groups",
  "moments",
  "publishedExams",
  "questions",
  "shifts",
  "sites",
  "subjects",
  "studyDocs",
] as const;

type AllowedCollection = (typeof ALLOWED_COLLECTIONS)[number];

function isAllowedCollection(value: string): value is AllowedCollection {
  return (ALLOWED_COLLECTIONS as readonly string[]).includes(value);
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = toString(body?.name, "").trim();
  const confirm = toString(body?.confirm, "");

  if (!name || !isAllowedCollection(name)) {
    return NextResponse.json({ error: "Colección inválida." }, { status: 400 });
  }
  if (confirm.trim().toUpperCase() !== "ELIMINAR") {
    return NextResponse.json({ error: "Confirm inválido" }, { status: 400 });
  }

  let adminAuth: ReturnType<typeof getAdminAuth>;
  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminAuth = getAdminAuth();
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales admin.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let uid = "";
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token inválido.";
    return NextResponse.json({ error: `Token inválido o expirado. ${msg}` }, { status: 401 });
  }

  const adminSnap = await adminDb.collection("admins").doc(uid).get();
  if (!adminSnap.exists) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await adminDb.recursiveDelete(adminDb.collection(name));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: `No fue posible eliminar ${name}. ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: name }, { status: 200 });
}

