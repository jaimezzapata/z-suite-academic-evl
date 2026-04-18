import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccount() {
  const json = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("Falta FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON.");
  const parsed = JSON.parse(json) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object") throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON invalido.");
  const row = parsed as Record<string, unknown>;
  const projectId =
    (typeof row.projectId === "string" ? row.projectId : undefined) ??
    (typeof row.project_id === "string" ? row.project_id : undefined) ??
    "";
  const clientEmail =
    (typeof row.clientEmail === "string" ? row.clientEmail : undefined) ??
    (typeof row.client_email === "string" ? row.client_email : undefined) ??
    "";
  const privateKey =
    (typeof row.privateKey === "string" ? row.privateKey : undefined) ??
    (typeof row.private_key === "string" ? row.private_key : undefined) ??
    "";

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON incompleto.");
  }

  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(getServiceAccount()),
  });
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
