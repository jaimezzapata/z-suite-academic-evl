import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { createDriveFolder, ensureDriveFolder, getDriveRootFolderId, getOAuthDriveClient } from "@/lib/google/drive";
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

function pad2(value: number) {
  return value < 10 ? `0${value}` : `${value}`;
}

function parseISODate(value: string) {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const date = new Date(`${v}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function makeWorkspaceId(parts: string[]) {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("__")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 250);
}

function nodeIdFromPath(pathKey: string) {
  return pathKey.replace(/\//g, "__").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 250);
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

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const subjectId = toString(body?.subjectId, "").trim();
  const groupId = toString(body?.groupId, "").trim();
  const institution = toString(body?.institution, "").trim();
  const period = toString(body?.period, "").trim();
  const campus = toString(body?.campus, "").trim();
  const shift = toString(body?.shift, "").trim();
  const mode = toString(body?.mode, "fixedWeeks").trim();
  const startDateRaw = toString(body?.startDate, "").trim();
  const endDateRaw = toString(body?.endDate, "").trim();

  if (debug) {
    console.log("[drive/bootstrap] start", {
      opId,
      institution,
      subjectId,
      groupId,
      period,
      campus,
      shift,
      mode,
      startDateRaw,
      endDateRaw,
    });
  }

  if (!subjectId) return NextResponse.json({ error: "Debes seleccionar una materia." }, { status: 400 });
  if (!groupId) return NextResponse.json({ error: "Debes seleccionar un grupo." }, { status: 400 });
  if (!institution) return NextResponse.json({ error: "Debes seleccionar una institución." }, { status: 400 });
  if (!period) return NextResponse.json({ error: "Debes indicar el periodo (ej. 2026-01)." }, { status: 400 });
  if (!campus) return NextResponse.json({ error: "Debes indicar la sede." }, { status: 400 });

  const startDate = parseISODate(startDateRaw);
  if (!startDate) return NextResponse.json({ error: "Fecha de inicio inválida." }, { status: 400 });
  const endDate = endDateRaw ? parseISODate(endDateRaw) : null;
  if (endDateRaw && !endDate) return NextResponse.json({ error: "Fecha de fin inválida." }, { status: 400 });

  const isCesde = institution.toUpperCase() === "CESDE";
  const weekCount = isCesde ? 18 : 11;

  const expectedEnd = addDays(startDate, (weekCount - 1) * 7);
  if (mode === "range" && endDate) {
    if (endDate.getTime() < expectedEnd.getTime()) {
      return NextResponse.json(
        { error: `La fecha fin no alcanza para ${weekCount} semanas desde la fecha inicio.` },
        { status: 400 },
      );
    }
  }

  const subjectsSnap = await adminDb.collection("subjects").doc(subjectId).get();
  const subjectName = subjectsSnap.exists ? toString(subjectsSnap.data()?.name, subjectId) : subjectId;
  const groupsSnap = await adminDb.collection("groups").doc(groupId).get();
  const groupName = groupsSnap.exists ? toString(groupsSnap.data()?.name, groupId) : groupId;

  const workspaceId = makeWorkspaceId([institution.toUpperCase(), period, campus, groupId]);
  const workspaceRef = adminDb.collection("driveWorkspaces").doc(workspaceId);
  const existing = await workspaceRef.get();
  if (existing.exists) {
    return NextResponse.json({ error: "Ya existe una estructura con esos datos." }, { status: 409 });
  }

  const tokenSnap = await adminDb.collection("driveOauthTokens").doc(uid).get();
  const refreshToken = tokenSnap.exists ? toString(tokenSnap.data()?.refreshToken, "").trim() : "";
  if (!refreshToken) {
    return NextResponse.json({ error: "Debes conectar Drive para crear estructuras." }, { status: 412 });
  }
  let oauthDrive: ReturnType<typeof getOAuthDriveClient>;
  try {
    oauthDrive = getOAuthDriveClient(refreshToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Credenciales OAuth inválidas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const driveRootId = getDriveRootFolderId();

  let driveInstitution: Awaited<ReturnType<typeof createDriveFolder>>;
  let drivePeriod: Awaited<ReturnType<typeof createDriveFolder>>;
  let driveCampus: Awaited<ReturnType<typeof createDriveFolder>>;
  let driveGroup: Awaited<ReturnType<typeof createDriveFolder>>;
  let driveAdmin: Awaited<ReturnType<typeof createDriveFolder>>;
  let drivePublic: Awaited<ReturnType<typeof createDriveFolder>>;

  try {
    const rootParent = driveRootId ?? undefined;
    if (debug) console.log("[drive/bootstrap] ensure institution", { opId, name: institution.toUpperCase(), parentId: rootParent ?? null });
    if (!rootParent) {
      return NextResponse.json({ error: "Falta GOOGLE_DRIVE_ROOT_FOLDER_ID en configuración." }, { status: 500 });
    }
    driveInstitution = await ensureDriveFolder({ name: institution.toUpperCase(), parentId: rootParent, drive: oauthDrive });
    if (debug) console.log("[drive/bootstrap] create period", { opId, name: period, parentId: driveInstitution.id });
    drivePeriod = await ensureDriveFolder({ name: period, parentId: driveInstitution.id, drive: oauthDrive });
    if (debug) console.log("[drive/bootstrap] create campus", { opId, name: campus, parentId: drivePeriod.id });
    driveCampus = await ensureDriveFolder({ name: campus, parentId: drivePeriod.id, drive: oauthDrive });
    if (debug) console.log("[drive/bootstrap] create group", { opId, name: groupName, parentId: driveCampus.id });
    driveGroup = await ensureDriveFolder({ name: groupName, parentId: driveCampus.id, drive: oauthDrive });
    if (debug) console.log("[drive/bootstrap] create admin/public", { opId, parentId: driveGroup.id });
    driveAdmin = await ensureDriveFolder({ name: "admin", parentId: driveGroup.id, drive: oauthDrive });
    drivePublic = await ensureDriveFolder({ name: "publica", parentId: driveGroup.id, drive: oauthDrive });
  } catch (err) {
    if (debug) console.log("[drive/bootstrap] drive error", { opId, error: errorToObject(err) });
    const msg = err instanceof Error ? err.message : "No fue posible crear carpetas en Drive.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const now = new Date();
  await workspaceRef.set(
    {
      id: workspaceId,
      institution: institution.toUpperCase(),
      subjectId,
      subjectName,
      groupId,
      groupName,
      period,
      campus,
      shift,
      mode: mode === "range" ? "range" : "fixedWeeks",
      weekCount,
      startDate: formatISODate(startDate),
      endDate: endDate ? formatISODate(endDate) : formatISODate(expectedEnd),
      drive: {
        rootFolderId: driveRootId,
        institutionFolderId: driveInstitution.id,
        periodFolderId: drivePeriod.id,
        campusFolderId: driveCampus.id,
        groupFolderId: driveGroup.id,
        groupFolderUrl: driveGroup.webViewLink,
        adminFolderId: driveAdmin.id,
        adminFolderUrl: driveAdmin.webViewLink,
        publicFolderId: drivePublic.id,
        publicFolderUrl: drivePublic.webViewLink,
      },
      stats: { totalFiles: 0, docsFiles: 0, starredFiles: 0 },
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const nodesRef = workspaceRef.collection("nodes");
  const nodes: Array<{
    pathKey: string;
    name: string;
    kind: string;
    parentPathKey: string | null;
    driveFolderId: string;
    driveFolderUrl: string;
    meta?: Record<string, unknown>;
  }> = [];

  function pushNode(node: (typeof nodes)[number]) {
    nodes.push(node);
  }

  pushNode({
    pathKey: "group",
    name: groupName,
    kind: "group",
    parentPathKey: null,
    driveFolderId: driveGroup.id,
    driveFolderUrl: driveGroup.webViewLink,
  });
  pushNode({
    pathKey: "admin",
    name: "admin",
    kind: "admin",
    parentPathKey: "group",
    driveFolderId: driveAdmin.id,
    driveFolderUrl: driveAdmin.webViewLink,
  });
  pushNode({
    pathKey: "publica",
    name: "publica",
    kind: "public",
    parentPathKey: "group",
    driveFolderId: drivePublic.id,
    driveFolderUrl: drivePublic.webViewLink,
  });

  if (isCesde) {
    for (const moment of ["M1", "M2", "M3"]) {
      let mFolder: Awaited<ReturnType<typeof createDriveFolder>>;
      try {
        if (debug) console.log("[drive/bootstrap] ensure moment", { opId, moment, parentId: drivePublic.id });
        mFolder = await ensureDriveFolder({ name: moment, parentId: drivePublic.id, drive: oauthDrive });
      } catch (err) {
        if (debug) console.log("[drive/bootstrap] moment error", { opId, moment, error: errorToObject(err) });
        const msg = err instanceof Error ? err.message : "No fue posible crear carpetas de momento en Drive.";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      pushNode({
        pathKey: `publica/${moment}`,
        name: moment,
        kind: "moment",
        parentPathKey: "publica",
        driveFolderId: mFolder.id,
        driveFolderUrl: mFolder.webViewLink,
        meta: { moment },
      });
      for (let w = 1; w <= weekCount; w++) {
        const date = addDays(startDate, (w - 1) * 7);
        const dateLabel = formatISODate(date);
        const weekName = `S${pad2(w)} - ${dateLabel}`;
        let wk: Awaited<ReturnType<typeof createDriveFolder>>;
        try {
          if (debug && (w === 1 || w === weekCount || w % 6 === 0)) {
            console.log("[drive/bootstrap] ensure week", { opId, moment, week: w, name: weekName, parentId: mFolder.id });
          }
          wk = await ensureDriveFolder({ name: weekName, parentId: mFolder.id, drive: oauthDrive });
        } catch (err) {
          if (debug) console.log("[drive/bootstrap] week error", { opId, moment, week: w, error: errorToObject(err) });
          const msg = err instanceof Error ? err.message : "No fue posible crear carpetas de semana en Drive.";
          return NextResponse.json({ error: msg }, { status: 500 });
        }
        pushNode({
          pathKey: `publica/${moment}/S${pad2(w)}`,
          name: weekName,
          kind: "week",
          parentPathKey: `publica/${moment}`,
          driveFolderId: wk.id,
          driveFolderUrl: wk.webViewLink,
          meta: { moment, week: w, date: dateLabel },
        });
      }
    }
  } else {
    for (let w = 1; w <= weekCount; w++) {
      const date = addDays(startDate, (w - 1) * 7);
      const dateLabel = formatISODate(date);
      const weekName = `S${pad2(w)} - ${dateLabel}`;
      let wk: Awaited<ReturnType<typeof createDriveFolder>>;
      try {
        if (debug && (w === 1 || w === weekCount || w % 4 === 0)) {
          console.log("[drive/bootstrap] ensure week", { opId, week: w, name: weekName, parentId: drivePublic.id });
        }
        wk = await ensureDriveFolder({ name: weekName, parentId: drivePublic.id, drive: oauthDrive });
      } catch (err) {
        if (debug) console.log("[drive/bootstrap] week error", { opId, week: w, error: errorToObject(err) });
        const msg = err instanceof Error ? err.message : "No fue posible crear carpetas de semana en Drive.";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      pushNode({
        pathKey: `publica/S${pad2(w)}`,
        name: weekName,
        kind: "week",
        parentPathKey: "publica",
        driveFolderId: wk.id,
        driveFolderUrl: wk.webViewLink,
        meta: { week: w, date: dateLabel },
      });
    }
  }

  const batch = adminDb.batch();
  nodes.forEach((n) => {
    const ref = nodesRef.doc(nodeIdFromPath(n.pathKey));
    batch.set(ref, { ...n, workspaceId, createdAt: now, updatedAt: now }, { merge: true });
  });
  await batch.commit();

  const statsRef = adminDb.collection("driveMeta").doc("stats");
  await statsRef.set(
    {
      workspaces: FieldValue.increment(1),
      rootFolderId: driveRootId ?? null,
      updatedAt: now,
    },
    { merge: true },
  );

  if (debug) console.log("[drive/bootstrap] ok", { opId, workspaceId, weekCount, driveRootId: driveRootId ?? null });

  return NextResponse.json(
    {
      ok: true,
      workspaceId,
      drive: {
        groupFolderUrl: driveGroup.webViewLink,
        adminFolderUrl: driveAdmin.webViewLink,
        publicFolderUrl: drivePublic.webViewLink,
      },
      weekCount,
    },
    { status: 200 },
  );
}
