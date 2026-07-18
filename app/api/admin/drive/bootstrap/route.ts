import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  createAppsScriptDriveStructure,
  getAppsScriptDriveRootFolderId,
  getAppsScriptDriveStructure,
} from "@/lib/google/apps-script-drive";
import {
  calculateAcademicHoursForInstitution,
  getWeeklyAcademicHoursFromSource,
} from "@/lib/teaching-load-sessions";

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

function adminFirestoreError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return `No fue posible validar el admin en Firestore. Revisa FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON o los permisos de la service account. ${message}`.trim();
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

function dayNameFromIsoDate(value: string) {
  const date = parseISODate(value);
  if (!date) return "";
  return ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"][date.getUTCDay()] ?? "";
}

function resolveScheduleDays(args: {
  institution: string;
  cesdeGroupType: string;
  startDate: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
}) {
  const isSena = args.institution.toUpperCase() === "SENA";
  const isCesdeEmpresarial =
    args.institution.toUpperCase() === "CESDE" && normalizeCesdeGroupType(args.cesdeGroupType) === "EMPRESARIAL";
  const usesManualWeekdays = isSena || isCesdeEmpresarial;
  return {
    isCesdeEmpresarial,
    usesManualWeekdays,
    dayOfWeek1: args.dayOfWeek1 || dayNameFromIsoDate(args.startDate),
    dayOfWeek2: usesManualWeekdays ? args.dayOfWeek2 : "",
  };
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

function normalizeCesdeGroupType(value: unknown) {
  return toString(value, "").trim().toUpperCase() === "EMPRESARIAL" ? "EMPRESARIAL" : "REGULAR";
}

function parseTimeToMinutes(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number.parseInt(match[1]!, 10);
  const minute = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function makeWorkspaceId(parts: string[]) {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("__")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 250);
}

function makeManualWorkspaceId(args: {
  institution: string;
  period: string;
  campus: string;
  jornada: string;
  groupId: string;
  subjectId: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
}) {
  return makeWorkspaceId([
    args.institution.toUpperCase(),
    args.period,
    args.campus.toUpperCase(),
    args.jornada.toUpperCase(),
    args.groupId,
    args.subjectId,
    args.dayOfWeek1.toUpperCase(),
    args.dayOfWeek2.toUpperCase() || "SIN_SEGUNDO_DIA",
  ]);
}

function normalizeCompareValue(value: unknown) {
  return toString(value, "").trim().toUpperCase();
}

function nodeIdFromPath(pathKey: string) {
  return pathKey.replace(/\//g, "__").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 250);
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

type WorkspaceNode = {
  pathKey: string;
  name: string;
  kind: string;
  parentPathKey: string | null;
  driveFolderId: string;
  driveFolderUrl: string;
  meta?: Record<string, unknown>;
};

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
  const debug = isDriveDebugEnabled();
  const opId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  try {
    const admin = await assertAdmin(req);
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
    const adminDb = admin.adminDb;
    const uid = admin.uid;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const requestedWorkspaceId = toString(body?.workspaceId, "").trim();
    const sourceTeachingLoadId = toString(body?.sourceTeachingLoadId, "").trim();
    const subjectId = toString(body?.subjectId, "").trim();
    const groupId = toString(body?.groupId, "").trim();
    const institution = toString(body?.institution, "").trim();
    const period = toString(body?.period, "").trim();
    const campus = toString(body?.campus, "").trim();
    const jornada = toString(body?.jornada, "").trim();
    const cesdeGroupType = normalizeCesdeGroupType(body?.cesdeGroupType);
    const dayOfWeek1 = toString(body?.dayOfWeek1, "").trim();
    const dayOfWeek2 = toString(body?.dayOfWeek2, "").trim();
    const startDateRaw = toString(body?.startDate, "").trim();
    const endDateRaw = toString(body?.endDate, "").trim();
    const siteId = toString(body?.siteId, "").trim();
    const shiftId = toString(body?.shiftId, "").trim();
    const startTime = toString(body?.startTime, "").trim();
    const endTime = toString(body?.endTime, "").trim();
    const day2StartTime = toString(body?.day2StartTime, "").trim();
    const day2EndTime = toString(body?.day2EndTime, "").trim();
    const classroom = toString(body?.classroom, "").trim().toUpperCase();
    const shouldCreateTeachingLoad = !sourceTeachingLoadId;

    if (debug) {
      console.log("[drive/bootstrap] start", {
        opId,
        requestedWorkspaceId,
        sourceTeachingLoadId,
        institution,
        subjectId,
        groupId,
        period,
        campus,
        jornada,
        cesdeGroupType,
        dayOfWeek1,
        dayOfWeek2,
        startDateRaw,
        endDateRaw,
        siteId,
        shiftId,
        startTime,
        endTime,
        day2StartTime,
        day2EndTime,
        shouldCreateTeachingLoad,
        uid,
      });
    }

    if (!subjectId) return NextResponse.json({ error: "Debes seleccionar una materia." }, { status: 400 });
    if (!groupId) return NextResponse.json({ error: "Debes seleccionar un grupo o ficha." }, { status: 400 });
    if (!institution) return NextResponse.json({ error: "Debes seleccionar una institución." }, { status: 400 });
    if (!period) return NextResponse.json({ error: "Debes indicar el periodo (ej. 2026-01)." }, { status: 400 });
    if (!campus) return NextResponse.json({ error: "Debes indicar la sede." }, { status: 400 });
    if (!jornada) return NextResponse.json({ error: "Debes indicar la jornada." }, { status: 400 });
    const startDate = parseISODate(startDateRaw);
    if (!startDate) return NextResponse.json({ error: "Fecha de inicio inválida." }, { status: 400 });
    const endDate = endDateRaw ? parseISODate(endDateRaw) : null;
    if (endDateRaw && !endDate) return NextResponse.json({ error: "Fecha de fin inválida." }, { status: 400 });
    if (endDate && endDate.getTime() < startDate.getTime()) {
      return NextResponse.json({ error: "La fecha de fin no puede ser menor que la fecha de inicio." }, { status: 400 });
    }

    const periodParts = toPeriodParts(period);
    if (!periodParts) {
      return NextResponse.json({ error: "El periodo debe tener formato YYYY-PP, por ejemplo 2026-01." }, { status: 400 });
    }

    const isCesde = institution.toUpperCase() === "CESDE";
    const isSena = institution.toUpperCase() === "SENA";
    const scheduleDays = resolveScheduleDays({
      institution,
      cesdeGroupType,
      startDate: startDateRaw,
      dayOfWeek1,
      dayOfWeek2,
    });
    const isCesdeEmpresarial = scheduleDays.isCesdeEmpresarial;
    const usesManualWeekdays = scheduleDays.usesManualWeekdays;
    const resolvedDayOfWeek1 = scheduleDays.dayOfWeek1;
    const resolvedDayOfWeek2 = scheduleDays.dayOfWeek2;
    const weekCount = isCesde ? 18 : 11;

    if (isCesdeEmpresarial && !endDateRaw) {
      return NextResponse.json({ error: "Para CESDE empresarial debes indicar fecha de fin." }, { status: 400 });
    }
    if (!resolvedDayOfWeek1) {
      return NextResponse.json({ error: "No fue posible resolver el día principal." }, { status: 400 });
    }
    if (usesManualWeekdays && resolvedDayOfWeek2 && resolvedDayOfWeek2 === resolvedDayOfWeek1) {
      return NextResponse.json({ error: "El segundo día no puede ser igual al primero." }, { status: 400 });
    }
    if (shouldCreateTeachingLoad && !endDateRaw) {
      return NextResponse.json({ error: "Para reflejar la estructura en el calendario debes indicar fecha de fin." }, { status: 400 });
    }
    if (shouldCreateTeachingLoad && !siteId) {
      return NextResponse.json({ error: "Debes seleccionar una sede para crear la carga horaria." }, { status: 400 });
    }
    if (shouldCreateTeachingLoad && !shiftId) {
      return NextResponse.json({ error: "Debes seleccionar una jornada para crear la carga horaria." }, { status: 400 });
    }
    if (shouldCreateTeachingLoad && !startTime) {
      return NextResponse.json({ error: "Debes indicar la hora de inicio para crear la carga horaria." }, { status: 400 });
    }
    if (shouldCreateTeachingLoad && !endTime) {
      return NextResponse.json({ error: "Debes indicar la hora de fin para crear la carga horaria." }, { status: 400 });
    }
    if (shouldCreateTeachingLoad && !classroom) {
      return NextResponse.json({ error: "Debes indicar el salón para crear la carga horaria." }, { status: 400 });
    }

    const startMinutes = shouldCreateTeachingLoad ? parseTimeToMinutes(startTime) : null;
    const endMinutes = shouldCreateTeachingLoad ? parseTimeToMinutes(endTime) : null;
    if (shouldCreateTeachingLoad && (startMinutes === null || endMinutes === null)) {
      return NextResponse.json({ error: "La franja horaria enviada no es válida." }, { status: 400 });
    }
    if (shouldCreateTeachingLoad && endMinutes! <= startMinutes!) {
      return NextResponse.json({ error: "La hora de fin debe ser posterior a la hora de inicio." }, { status: 400 });
    }
    const resolvedDay2StartTime = resolvedDayOfWeek2 ? day2StartTime || startTime : "";
    const resolvedDay2EndTime = resolvedDayOfWeek2 ? day2EndTime || endTime : "";
    const day2StartMinutes = shouldCreateTeachingLoad && resolvedDayOfWeek2 ? parseTimeToMinutes(resolvedDay2StartTime) : null;
    const day2EndMinutes = shouldCreateTeachingLoad && resolvedDayOfWeek2 ? parseTimeToMinutes(resolvedDay2EndTime) : null;
    if (shouldCreateTeachingLoad && resolvedDayOfWeek2 && (day2StartMinutes === null || day2EndMinutes === null)) {
      return NextResponse.json({ error: "La franja horaria del segundo día no es válida." }, { status: 400 });
    }
    if (shouldCreateTeachingLoad && resolvedDayOfWeek2 && day2EndMinutes! <= day2StartMinutes!) {
      return NextResponse.json({ error: "La hora de fin del segundo día debe ser posterior a la de inicio." }, { status: 400 });
    }

    const subjectsSnap = await adminDb.collection("subjects").doc(subjectId).get();
    const subjectName = subjectsSnap.exists ? toString(subjectsSnap.data()?.name, subjectId) : subjectId;
    const groupsSnap = await adminDb.collection(isSena ? "fichas" : "groups").doc(groupId).get();
    const groupName = groupsSnap.exists ? toString(groupsSnap.data()?.name, groupId) : groupId;
    const siteSnap = shouldCreateTeachingLoad ? await adminDb.collection("sites").doc(siteId).get() : null;
    const shiftSnap = shouldCreateTeachingLoad ? await adminDb.collection("shifts").doc(shiftId).get() : null;
    const siteName = shouldCreateTeachingLoad
      ? siteSnap?.exists
        ? toString(siteSnap.data()?.name, campus || siteId)
        : campus || siteId
      : campus;
    const shiftName = shouldCreateTeachingLoad
      ? shiftSnap?.exists
        ? toString(shiftSnap.data()?.name, jornada || shiftId)
        : jornada || shiftId
      : jornada;

    const workspaceId =
      requestedWorkspaceId ||
      makeManualWorkspaceId({
        institution,
        period,
        campus,
        jornada,
        groupId,
        subjectId,
        dayOfWeek1: resolvedDayOfWeek1,
        dayOfWeek2: resolvedDayOfWeek2,
      });
    const workspaceRef = adminDb.collection("driveWorkspaces").doc(workspaceId);
    const existing = await workspaceRef.get();
    if (existing.exists) {
      return NextResponse.json({ error: "Ya existe una estructura con esos datos." }, { status: 409 });
    }

    if (!sourceTeachingLoadId) {
      const possibleDuplicates = await adminDb.collection("driveWorkspaces").where("period", "==", period).get();
      const conflictingWorkspace = possibleDuplicates.docs.find((doc) => {
        if (doc.id === workspaceId) return true;
        const data = doc.data() as Record<string, unknown>;
        return (
          normalizeCompareValue(data.institution) === institution.toUpperCase() &&
          normalizeCompareValue(data.subjectId) === subjectId.toUpperCase() &&
          normalizeCompareValue(data.groupId) === groupId.toUpperCase() &&
          normalizeCompareValue(data.campus) === campus.toUpperCase() &&
          normalizeCompareValue(data.jornada) === jornada.toUpperCase() &&
          normalizeCompareValue(data.dayOfWeek1) === resolvedDayOfWeek1.toUpperCase() &&
          normalizeCompareValue(data.dayOfWeek2 || "") === resolvedDayOfWeek2.toUpperCase()
        );
      });
      if (conflictingWorkspace) {
        return NextResponse.json({ error: "Ya existe una estructura con la misma programación académica." }, { status: 409 });
      }
    }

    let driveRootId = "";
    driveRootId = getAppsScriptDriveRootFolderId();

    const createdStructure = await createAppsScriptDriveStructure({
      rootFolderId: driveRootId,
      institution: institution.toUpperCase(),
      year: periodParts.year,
      periodCode: periodParts.periodCode,
      subjectName,
      cohortCode: groupName,
      cesdeGroupType,
      dayOfWeek1: resolvedDayOfWeek1,
      dayOfWeek2: resolvedDayOfWeek2,
      jornada,
      sede: campus,
      startDate: startDateRaw,
      endDate: endDateRaw,
    });
    const driveStructure = await getAppsScriptDriveStructure({
      publicFolderId: createdStructure.publicFolderId,
    });

    const now = new Date();
    const logicalWeekCount = countLogicalWeeks(driveStructure.weeks);
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
        cesdeGroupType: isCesde ? cesdeGroupType : "",
        dayOfWeek1: resolvedDayOfWeek1,
        dayOfWeek2: resolvedDayOfWeek2,
        startTime,
        endTime,
        day2StartTime: resolvedDayOfWeek2 ? resolvedDay2StartTime : "",
        day2EndTime: resolvedDayOfWeek2 ? resolvedDay2EndTime : "",
        weekCount: logicalWeekCount || weekCount,
        startDate: startDateRaw,
        endDate: endDateRaw,
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
        sourceType: sourceTeachingLoadId ? "teaching_load" : "manual",
        sourceTeachingLoadId: sourceTeachingLoadId || "",
        source: "apps_script",
        scheduleMode: isCesdeEmpresarial ? "date_range" : "fixed_weeks",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    const nodesRef = workspaceRef.collection("nodes");
    const nodes: WorkspaceNode[] = [];

    function pushNode(node: WorkspaceNode) {
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
    
    const weekPathCounters = new Map<number, number>();
    driveStructure.weeks.forEach((week, index) => {
      const weekNumber = typeof week.weekNumber === "number" && Number.isFinite(week.weekNumber) ? week.weekNumber : index + 1;
      const weekOccurrence = (weekPathCounters.get(weekNumber) ?? 0) + 1;
      weekPathCounters.set(weekNumber, weekOccurrence);
      pushNode({
        pathKey: `publica/S${pad2(weekNumber)}${weekOccurrence > 1 ? `__${pad2(weekOccurrence)}` : ""}`,
        name: week.folderName,
        kind: "week",
        parentPathKey: "publica",
        driveFolderId: week.folderId,
        driveFolderUrl: week.folderUrl,
        meta: { week: weekNumber, occurrence: weekOccurrence },
      });
    });

    const batch = adminDb.batch();
    nodes.forEach((n) => {
      const ref = nodesRef.doc(nodeIdFromPath(n.pathKey));
      batch.set(ref, { ...n, workspaceId, createdAt: now, updatedAt: now }, { merge: true });
    });
    await batch.commit();

    let linkedTeachingLoadId = sourceTeachingLoadId || "";
    if (shouldCreateTeachingLoad) {
      const durationMinutes = endMinutes! - startMinutes!;
      const academicHours = calculateAcademicHoursForInstitution(durationMinutes, institution);
      const day2DurationMinutes = resolvedDayOfWeek2 ? day2EndMinutes! - day2StartMinutes! : 0;
      const day2AcademicHours = resolvedDayOfWeek2
        ? calculateAcademicHoursForInstitution(day2DurationMinutes, institution)
        : 0;
      const weeklyAcademicHours = getWeeklyAcademicHoursFromSource({
        institution,
        startDate: startDateRaw,
        dayOfWeek1: resolvedDayOfWeek1,
        dayOfWeek2: resolvedDayOfWeek2,
        startTime,
        endTime,
        durationMinutes,
        academicHours,
        day2StartTime: resolvedDay2StartTime,
        day2EndTime: resolvedDay2EndTime,
        day2DurationMinutes,
        day2AcademicHours,
      });
      const teachingLoadRef = adminDb.collection("teachingLoads").doc();
      linkedTeachingLoadId = teachingLoadRef.id;
      await teachingLoadRef.set({
        id: teachingLoadRef.id,
        institution: institution.toUpperCase(),
        cesdeGroupType: isCesde ? cesdeGroupType : "",
        period,
        subjectId,
        subjectName,
        audienceId: groupId,
        audienceName: groupName,
        audienceType: isSena ? "ficha" : "group",
        siteId,
        siteName,
        shiftId,
        shiftName,
        startDate: startDateRaw,
        endDate: endDateRaw,
        startTime,
        endTime,
        day2StartTime: resolvedDayOfWeek2 ? resolvedDay2StartTime : "",
        day2EndTime: resolvedDayOfWeek2 ? resolvedDay2EndTime : "",
        classroom,
        durationMinutes,
        academicHours,
        day2DurationMinutes,
        day2AcademicHours,
        weeklyAcademicHours,
        dayOfWeek1: resolvedDayOfWeek1,
        dayOfWeek2: resolvedDayOfWeek2,
        driveWorkspaceId: workspaceId,
        driveStatus: "linked",
        driveErrorMessage: "",
        drivePublicFolderUrl: driveStructure.publicFolder.folderUrl,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      await workspaceRef.set(
        {
          sourceType: "manual",
          sourceTeachingLoadId: linkedTeachingLoadId,
          updatedAt: now,
        },
        { merge: true },
      );
    }

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
        teachingLoadId: linkedTeachingLoadId,
        weekCount: logicalWeekCount || weekCount,
        message: createdStructure.message,
      },
      { status: 200 },
    );
  } catch (err) {
    if (debug) console.log("[drive/bootstrap] unhandled", { opId, error: errorToObject(err) });
    const msg = err instanceof Error ? err.message : "No fue posible crear la estructura.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
