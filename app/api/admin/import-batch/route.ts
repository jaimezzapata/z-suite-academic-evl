import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

type CatalogItem = { id: string; name?: string; active?: boolean };

function toString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
  const dryRun = Boolean(body?.dryRun);
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
    dryRun,
    catalog: { subjects: 0, groups: 0, moments: 0, sites: 0, shifts: 0, updated: 0 },
    questions: { total: questions.length, created: 0, skipped: 0 },
    examTemplates: { total: examTemplates.length, created: 0, skipped: 0 },
  };

  async function upsertCatalog(name: string, items: CatalogItem[]) {
    const valid = items.filter((x) => typeof x?.id === "string" && x.id.trim());
    stats.catalog[name as keyof typeof stats.catalog] = valid.length as never;
    if (dryRun) return;
    const batches = chunk(valid, 450);
    for (const group of batches) {
      const batch = adminDb.batch();
      group.forEach((it) => {
        const ref = adminDb.collection(name).doc(it.id);
        batch.set(
          ref,
          {
            id: it.id,
            name: toString(it.name, it.id),
            active: toBool(it.active, true),
            updatedAt: now,
            createdAt: now,
          },
          { merge: true },
        );
        stats.catalog.updated += 1;
      });
      await batch.commit();
    }
  }

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

        if (dryRun) {
          if (collectionName === "questions") stats.questions.created += 1;
          else stats.examTemplates.created += 1;
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

      if (!dryRun && ops > 0) {
        await batch.commit();
      }
    }
  }

  try {
    await upsertCatalog("subjects", toArray(catalog.subjects) as CatalogItem[]);
    await upsertCatalog("groups", toArray(catalog.groups) as CatalogItem[]);
    await upsertCatalog("moments", toArray(catalog.moments) as CatalogItem[]);
    await upsertCatalog("sites", toArray(catalog.sites) as CatalogItem[]);
    await upsertCatalog("shifts", toArray(catalog.shifts) as CatalogItem[]);

    await createMissing("questions", questions);
    await createMissing("examTemplates", examTemplates);

    return NextResponse.json({ ok: true, stats }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

