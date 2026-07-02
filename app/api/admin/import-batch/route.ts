import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

type CatalogItem = { id: string; name?: string; active?: boolean };

function toString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function addId(target: Set<string>, value: unknown) {
  const id = toString(value, "").trim();
  if (id) target.add(id);
}

function addIds(target: Set<string>, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item) => addId(target, item));
    return;
  }
  addId(target, value);
}

async function readExistingIds(
  adminDb: ReturnType<typeof getAdminDb>,
  collectionName: string,
  ids: string[],
) {
  const existing = new Set<string>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (const part of chunk(unique, 250)) {
    if (!part.length) continue;
    const refs = part.map((id) => adminDb.collection(collectionName).doc(id));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap) => {
      if (snap.exists) existing.add(snap.id);
    });
  }
  return existing;
}

function buildCatalogError(missing: {
  subjects: string[];
  groups: string[];
  moments: string[];
  sites: string[];
  shifts: string[];
}) {
  const parts: string[] = [];
  if (missing.subjects.length) parts.push(`materias: ${missing.subjects.join(", ")}`);
  if (missing.groups.length) parts.push(`grupos/fichas: ${missing.groups.join(", ")}`);
  if (missing.moments.length) parts.push(`momentos: ${missing.moments.join(", ")}`);
  if (missing.sites.length) parts.push(`sedes: ${missing.sites.join(", ")}`);
  if (missing.shifts.length) parts.push(`jornadas: ${missing.shifts.join(", ")}`);
  return `El JSON referencia IDs que no existen en los catálogos actuales. Corrige el lote o crea primero esos catálogos: ${parts.join(" | ")}.`;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const payload = (body?.payload as Record<string, unknown> | null) ?? null;
  if (!payload) return NextResponse.json({ error: "Payload inválido." }, { status: 400 });

  const importMode = toString((payload.batch as Record<string, unknown> | null)?.importMode, "");
  if (importMode && importMode !== "append_only") {
    return NextResponse.json({ error: "importMode inválido (solo append_only)." }, { status: 400 });
  }

  const catalog = (payload.catalog as Record<string, unknown> | null) ?? {};
  const questions = toArray(payload.questions) as Array<Record<string, unknown>>;
  const examTemplates = toArray(payload.examTemplates) as Array<Record<string, unknown>>;

  const now = FieldValue.serverTimestamp();
  const stats = {
    catalog: { subjects: 0, groups: 0, moments: 0, sites: 0, shifts: 0 },
    questions: { total: questions.length, created: 0, skipped: 0 },
    examTemplates: { total: examTemplates.length, created: 0, skipped: 0 },
  };

  async function createMissing(collectionName: string, items: Array<Record<string, unknown>>) {
    const normalized = items
      .map((x) => ({ ...x, id: toString(x.id, "") }))
      .filter((x) => x.id);

    const idChunks = chunk(normalized, 250);
    for (const part of idChunks) {
      const refs = part.map((x) => adminDb.collection(collectionName).doc(x.id));
      const snaps = await adminDb.getAll(...refs);
      const exists = new Set(snaps.filter((s) => s.exists).map((s) => s.id));

      let batch = adminDb.batch();
      let ops = 0;

      for (const item of part) {
        if (exists.has(item.id)) {
          if (collectionName === "questions") stats.questions.skipped += 1;
          else stats.examTemplates.skipped += 1;
          continue;
        }

        const ref = adminDb.collection(collectionName).doc(item.id);
        batch.set(ref, { ...item, createdAt: now, updatedAt: now }, { merge: false });
        ops += 1;
        if (collectionName === "questions") stats.questions.created += 1;
        else stats.examTemplates.created += 1;

        if (ops >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          ops = 0;
        }
      }

      if (ops > 0) {
        await batch.commit();
      }
    }
  }

  try {
    const subjectIds = new Set<string>();
    const groupIds = new Set<string>();
    const momentIds = new Set<string>();
    const siteIds = new Set<string>();
    const shiftIds = new Set<string>();

    (toArray(catalog.subjects) as CatalogItem[]).forEach((item) => addId(subjectIds, item?.id));
    (toArray(catalog.groups) as CatalogItem[]).forEach((item) => addId(groupIds, item?.id));
    (toArray(catalog.moments) as CatalogItem[]).forEach((item) => addId(momentIds, item?.id));
    (toArray(catalog.sites) as CatalogItem[]).forEach((item) => addId(siteIds, item?.id));
    (toArray(catalog.shifts) as CatalogItem[]).forEach((item) => addId(shiftIds, item?.id));

    questions.forEach((item) => {
      addId(subjectIds, item.subjectId);
      addIds(groupIds, item.groupIds);
      addIds(momentIds, item.momentIds);
      addId(momentIds, item.momentId);
    });

    examTemplates.forEach((item) => {
      addId(subjectIds, item.subjectId);
      addId(groupIds, item.groupId);
      addId(momentIds, item.momentId);
      addId(siteIds, item.siteId);
      addId(shiftIds, item.shiftId);
    });

    stats.catalog.subjects = subjectIds.size;
    stats.catalog.groups = groupIds.size;
    stats.catalog.moments = momentIds.size;
    stats.catalog.sites = siteIds.size;
    stats.catalog.shifts = shiftIds.size;

    const [existingSubjects, existingGroups, existingFichas, existingMoments, existingSites, existingShifts] =
      await Promise.all([
        readExistingIds(adminDb, "subjects", [...subjectIds]),
        readExistingIds(adminDb, "groups", [...groupIds]),
        readExistingIds(adminDb, "fichas", [...groupIds]),
        readExistingIds(adminDb, "moments", [...momentIds]),
        readExistingIds(adminDb, "sites", [...siteIds]),
        readExistingIds(adminDb, "shifts", [...shiftIds]),
      ]);

    const missing = {
      subjects: [...subjectIds].filter((id) => !existingSubjects.has(id)),
      groups: [...groupIds].filter((id) => !existingGroups.has(id) && !existingFichas.has(id)),
      moments: [...momentIds].filter((id) => !existingMoments.has(id)),
      sites: [...siteIds].filter((id) => !existingSites.has(id)),
      shifts: [...shiftIds].filter((id) => !existingShifts.has(id)),
    };

    if (
      missing.subjects.length ||
      missing.groups.length ||
      missing.moments.length ||
      missing.sites.length ||
      missing.shifts.length
    ) {
      return NextResponse.json(
        {
          error: buildCatalogError(missing),
          missingCatalogRefs: missing,
        },
        { status: 400 },
      );
    }

    await createMissing("questions", questions);
    await createMissing("examTemplates", examTemplates);

    return NextResponse.json({ ok: true, stats }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

