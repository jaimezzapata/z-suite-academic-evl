import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  createAppsScriptDriveStructure,
  getAppsScriptDriveRootFolderId,
  getAppsScriptDriveStructure,
} from "@/lib/google/apps-script-drive";

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

function toPeriodParts(value: string) {
  const v = value.trim().toUpperCase();
  const match = v.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number.parseInt(match[1]!, 10),
    periodCode: match[2]!,
  };
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
  const jornada = toString(body?.jornada, "").trim();
  const dayOfWeek1 = toString(body?.dayOfWeek1, "").trim();
  const dayOfWeek2 = toString(body?.dayOfWeek2, "").trim();
  const startDateRaw = toString(body?.startDate, "").trim();

  if (debug) {
    console.log("[drive/bootstrap] start", {
      opId,
      institution,
      subjectId,
      groupId,
      period,
      campus,
      jornada,
      dayOfWeek1,
      dayOfWeek2,
      startDateRaw,
    });
  }

  if (!subjectId) return NextResponse.json({ error: "Debes seleccionar una materia." }, { status: 400 });
  if (!groupId) return NextResponse.json({ error: "Debes seleccionar un grupo o ficha." }, { status: 400 });
  if (!institution) return NextResponse.json({ error: "Debes seleccionar una institución." }, { status: 400 });
  if (!period) return NextResponse.json({ error: "Debes indicar el periodo (ej. 2026-01)." }, { status: 400 });
  if (!campus) return NextResponse.json({ error: "Debes indicar la sede." }, { status: 400 });
  if (!jornada) return NextResponse.json({ error: "Debes indicar la jornada." }, { status: 400 });
  if (!dayOfWeek1) return NextResponse.json({ error: "Debes indicar el primer día de clase." }, { status: 400 });

  const startDate = parseISODate(startDateRaw);
  if (!startDate) return NextResponse.json({ error: "Fecha de inicio inválida." }, { status: 400 });

  const periodParts = toPeriodParts(period);
  if (!periodParts) {
    return NextResponse.json({ error: "El periodo debe tener formato YYYY-PP, por ejemplo 2026-01." }, { status: 400 });
  }

  const isCesde = institution.toUpperCase() === "CESDE";
  const isSena = institution.toUpperCase() === "SENA";
  const weekCount = isCesde ? 18 : 11;

  const subjectsSnap = await adminDb.collection("subjects").doc(subjectId).get();
  const subjectName = subjectsSnap.exists ? toString(subjectsSnap.data()?.name, subjectId) : subjectId;
  const groupsSnap = await adminDb.collection(isSena ? "fichas" : "groups").doc(groupId).get();
  const groupName = groupsSnap.exists ? toString(groupsSnap.data()?.name, groupId) : groupId;

  const workspaceId = makeWorkspaceId([institution.toUpperCase(), period, campus, groupId]);
  const workspaceRef = adminDb.collection("driveWorkspaces").doc(workspaceId);
  const existing = await workspaceRef.get();
  if (existing.exists) {
    return NextResponse.json({ error: "Ya existe una estructura con esos datos." }, { status: 409 });
  }

  let driveRootId = "";
  try {
    driveRootId = getAppsScriptDriveRootFolderId();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falta la carpeta raíz de Drive.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let createdStructure: Awaited<ReturnType<typeof createAppsScriptDriveStructure>>;
  let driveStructure: Awaited<ReturnType<typeof getAppsScriptDriveStructure>>;
  try {
    createdStructure = await createAppsScriptDriveStructure({
      rootFolderId: driveRootId,
      institution: institution.toUpperCase(),
      year: periodParts.year,
      periodCode: periodParts.periodCode,
      subjectName,
      cohortCode: groupName,
      dayOfWeek1,
      dayOfWeek2,
      jornada,
      sede: campus,
      startDate: startDateRaw,
    });
    driveStructure = await getAppsScriptDriveStructure({
      publicFolderId: createdStructure.publicFolderId,
    });
  } catch (err) {
    if (debug) console.log("[drive/bootstrap] apps-script error", { opId, error: errorToObject(err) });
    const msg = err instanceof Error ? err.message : "No fue posible crear la estructura con Apps Script.";
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
      year: periodParts.year,
      periodCode: periodParts.periodCode,
      campus,
      jornada,
      dayOfWeek1,
      dayOfWeek2,
      weekCount: driveStructure.weeks.length || weekCount,
      startDate: startDateRaw,
      drive: {
        rootFolderId: driveRootId,
        groupFolderId: driveStructure.classFolder.folderId,
        groupFolderUrl: driveStructure.classFolder.folderUrl,
        adminFolderId: driveStructure.privateFolder?.folderId ?? "",
        adminFolderUrl: driveStructure.privateFolder?.folderUrl ?? "",
        publicFolderId: driveStructure.publicFolder.folderId,
        publicFolderUrl: driveStructure.publicFolder.folderUrl,
      },
      stats: { totalFiles: 0, docsFiles: 0, starredFiles: 0 },
      health: {
        broken: false,
        issues: [],
        lastCheckedAt: now,
      },
      source: "apps_script",
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
    name: driveStructure.classFolder.folderName,
    kind: "group",
    parentPathKey: null,
    driveFolderId: driveStructure.classFolder.folderId,
    driveFolderUrl: driveStructure.classFolder.folderUrl,
  });
  if (driveStructure.privateFolder) {
    pushNode({
      pathKey: "admin",
      name: driveStructure.privateFolder.folderName,
      kind: "admin",
      parentPathKey: "group",
      driveFolderId: driveStructure.privateFolder.folderId,
      driveFolderUrl: driveStructure.privateFolder.folderUrl,
    });
  }
  pushNode({
    pathKey: "publica",
    name: driveStructure.publicFolder.folderName,
    kind: "public",
    parentPathKey: "group",
    driveFolderId: driveStructure.publicFolder.folderId,
    driveFolderUrl: driveStructure.publicFolder.folderUrl,
  });

  driveStructure.weeks.forEach((week, index) => {
    const weekNumber = typeof week.weekNumber === "number" && Number.isFinite(week.weekNumber) ? week.weekNumber : index + 1;
    pushNode({
      pathKey: `publica/S${pad2(weekNumber)}`,
      name: week.folderName,
      kind: "week",
      parentPathKey: "publica",
      driveFolderId: week.folderId,
      driveFolderUrl: week.folderUrl,
      meta: { week: weekNumber },
    });
  });

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
        groupFolderUrl: driveStructure.classFolder.folderUrl,
        adminFolderUrl: driveStructure.privateFolder?.folderUrl ?? "",
        publicFolderUrl: driveStructure.publicFolder.folderUrl,
      },
      weekCount: driveStructure.weeks.length || weekCount,
      message: createdStructure.message,
    },
    { status: 200 },
  );
}
