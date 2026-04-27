import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const attemptId = toString(body?.attemptId, "").trim();
  const accessCode = toString(body?.accessCode, "").trim();
  if (!attemptId) return NextResponse.json({ error: "Falta attemptId." }, { status: 400 });
  if (!/^\d{6}$/.test(accessCode)) return NextResponse.json({ error: "El codigo debe tener 6 digitos." }, { status: 400 });

  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const snap = await adminDb.collection("attempts").doc(attemptId).get();
  if (!snap.exists) return NextResponse.json({ error: "No se encontro el intento." }, { status: 404 });
  const row = snap.data() as Record<string, unknown>;
  if (toString(row.accessCode, "") !== accessCode) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const status = toString(row.status, "in_progress");
  return NextResponse.json(
    {
      ok: true,
      attempt: {
        id: attemptId,
        status,
        grade0to5: toNumber(row.grade0to5, 0),
        grade0to50: toNumber(row.grade0to50, 0),
        grade0to5Raw: toNumber(row.grade0to5Raw, 0),
        grade0to50Raw: toNumber(row.grade0to50Raw, 0),
        earnedPoints: toNumber(row.earnedPoints, 0),
        totalPoints: toNumber(row.totalPoints, 0),
        fraudTabSwitches: toNumber(row.fraudTabSwitches, 0),
        fraudClipboardAttempts: toNumber(row.fraudClipboardAttempts, 0),
        fraudPenalty0to5: toNumber(row.fraudPenalty0to5, 0),
        fraudForcedFail: toBoolean(row.fraudForcedFail, false),
      },
    },
    { status: 200 },
  );
}

