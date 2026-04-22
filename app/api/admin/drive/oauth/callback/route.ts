import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAdminDb } from "@/lib/firebase/admin";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Falta ${name}.`);
  return value.trim();
}

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const error = url.searchParams.get("error") ?? "";

  const appRedirect = new URL("/admin/drive", url.origin);

  if (error) {
    appRedirect.searchParams.set("driveAuth", "error");
    appRedirect.searchParams.set("reason", error);
    return NextResponse.redirect(appRedirect);
  }

  if (!code || !state) {
    appRedirect.searchParams.set("driveAuth", "error");
    appRedirect.searchParams.set("reason", "missing_code_or_state");
    return NextResponse.redirect(appRedirect);
  }

  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminDb = getAdminDb();
  } catch (err) {
    appRedirect.searchParams.set("driveAuth", "error");
    appRedirect.searchParams.set("reason", "admin_db_init_failed");
    return NextResponse.redirect(appRedirect);
  }

  const stateRef = adminDb.collection("driveOauthStates").doc(state);
  const stateSnap = await stateRef.get();
  if (!stateSnap.exists) {
    appRedirect.searchParams.set("driveAuth", "error");
    appRedirect.searchParams.set("reason", "invalid_state");
    return NextResponse.redirect(appRedirect);
  }
  const stateData = stateSnap.data() as Record<string, unknown>;
  const uid = toString(stateData.uid, "");
  await stateRef.delete().catch(() => {});

  if (!uid) {
    appRedirect.searchParams.set("driveAuth", "error");
    appRedirect.searchParams.set("reason", "invalid_uid");
    return NextResponse.redirect(appRedirect);
  }

  const clientId = requiredEnv("GOOGLE_DRIVE_OAUTH_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET");
  const redirectUri = requiredEnv("GOOGLE_DRIVE_OAUTH_REDIRECT_URI");
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token ?? "";
    const scope = Array.isArray(tokens.scope) ? tokens.scope.join(" ") : tokens.scope ?? "";

    const tokenRef = adminDb.collection("driveOauthTokens").doc(uid);
    const payload: Record<string, unknown> = {
      uid,
      provider: "google",
      scope,
      updatedAt: new Date(),
    };
    if (refreshToken) payload.refreshToken = refreshToken;
    await tokenRef.set(payload, { merge: true });

    appRedirect.searchParams.set("driveAuth", "ok");
    return NextResponse.redirect(appRedirect);
  } catch (err) {
    appRedirect.searchParams.set("driveAuth", "error");
    appRedirect.searchParams.set("reason", "token_exchange_failed");
    return NextResponse.redirect(appRedirect);
  }
}

