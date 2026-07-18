import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getAppsScriptDriveStructure } from "@/lib/google/apps-script-drive";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function adminFirestoreError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return `No fue posible validar el admin en Firestore. Revisa FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON o los permisos de la service account. ${message}`.trim();
}

function nodeIdFromPath(pathKey: string) {
  return pathKey.replace(/\//g, "__").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 250);
}

function pad2(value: number) {
  return value < 10 ? `0${value}` : `${value}`;
}

function countLogicalWeeks(weeks: Array<{ weekNumber: number | null }>) {
  const uniqueWeekNumbers = new Set<number>();
  weeks.forEach((week) => {
    if (typeof week.weekNumber === "number" && Number.isFinite(week.weekNumber)) {
      uniqueWeekNumbers.add(week.weekNumber);
    }
  });
  return uniqueWeekNumbers.size || weeks.length;
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

  return { ok: true as const, adminDb };
}

async function deleteCollection(ref: FirebaseFirestore.CollectionReference, batchSize = 400) {
  try {
    while (true) {
      const snap = await ref.limit(batchSize).get();
      if (snap.empty) return;
      const batch = ref.firestore.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch {
    return;
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
  const ws = wsSnap.data() as Record<string, unknown>;
  const driveInfo = (ws.drive as Record<string, unknown> | undefined) ?? {};
  const publicFolderId = toString(driveInfo.publicFolderId, "").trim();
  if (!publicFolderId) {
    return NextResponse.json({ error: "La estructura no tiene carpeta pública registrada." }, { status: 400 });
  }

  try {
    const structure = await getAppsScriptDriveStructure({ publicFolderId });
    const now = new Date();
    const logicalWeekCount = countLogicalWeeks(structure.weeks);
    await wsRef.set(
      {
        weekCount: logicalWeekCount,
        drive: {
          groupFolderId: structure.classFolder.folderId,
          groupFolderUrl: structure.classFolder.folderUrl,
          adminFolderId: structure.privateFolder?.folderId ?? "",
          adminFolderUrl: structure.privateFolder?.folderUrl ?? "",
          publicFolderId: structure.publicFolder.folderId,
          publicFolderUrl: structure.publicFolder.folderUrl,
        },
        health: {
          broken: false,
          issues: [],
          lastCheckedAt: now,
        },
        updatedAt: now,
      },
      { merge: true },
    );

    const nodesRef = wsRef.collection("nodes");
    await deleteCollection(nodesRef, 400);

    const batch = adminDb.batch();
    const nodes = [
      {
        pathKey: "group",
        name: structure.classFolder.folderName,
        kind: "group",
        parentPathKey: null,
        driveFolderId: structure.classFolder.folderId,
        driveFolderUrl: structure.classFolder.folderUrl,
      },
      ...(structure.privateFolder
        ? [
            {
              pathKey: "admin",
              name: structure.privateFolder.folderName,
              kind: "admin",
              parentPathKey: "group",
              driveFolderId: structure.privateFolder.folderId,
              driveFolderUrl: structure.privateFolder.folderUrl,
            },
          ]
        : []),
      {
        pathKey: "publica",
        name: structure.publicFolder.folderName,
        kind: "public",
        parentPathKey: "group",
        driveFolderId: structure.publicFolder.folderId,
        driveFolderUrl: structure.publicFolder.folderUrl,
      },
      ...(() => {
        const weekPathCounters = new Map<number, number>();
        return structure.weeks.map((week, index) => {
        const weekNumber =
          typeof week.weekNumber === "number" && Number.isFinite(week.weekNumber) ? week.weekNumber : index + 1;
          const weekOccurrence = (weekPathCounters.get(weekNumber) ?? 0) + 1;
          weekPathCounters.set(weekNumber, weekOccurrence);
        return {
            pathKey: `publica/S${pad2(weekNumber)}${weekOccurrence > 1 ? `__${pad2(weekOccurrence)}` : ""}`,
            name: week.folderName,
            kind: "week",
            parentPathKey: "publica",
            driveFolderId: week.folderId,
            driveFolderUrl: week.folderUrl,
            meta: { week: weekNumber, occurrence: weekOccurrence },
          };
        });
      })(),
    ];

    nodes.forEach((node) => {
      batch.set(
        nodesRef.doc(nodeIdFromPath(node.pathKey)),
        { ...node, workspaceId, createdAt: now, updatedAt: now },
        { merge: true },
      );
    });
    await batch.commit();

    return NextResponse.json({ ok: true, broken: false, issues: [], weekCount: logicalWeekCount }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No fue posible consultar la estructura en Apps Script.";
    const now = new Date();
    await wsRef.set(
      {
        health: {
          broken: true,
          issues: [{ key: "apps_script", message }],
          lastCheckedAt: now,
        },
        updatedAt: now,
      },
      { merge: true },
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
