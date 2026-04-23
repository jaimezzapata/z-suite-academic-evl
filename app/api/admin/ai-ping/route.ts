import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

type GeminiModelVariant = "flash" | "pro";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeGeminiModelId(nameOrId: string) {
  const value = nameOrId.trim();
  return value.startsWith("models/") ? value.slice("models/".length) : value;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Falta ${name}.`);
  return value.trim();
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

  return { ok: true as const };
}

async function listGeminiModels(apiKey: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/models`, { method: "GET", headers: { "x-goog-api-key": apiKey } });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const errMessage =
      toString((data?.error as Record<string, unknown> | null)?.message, "") ||
      toString(data?.error, "") ||
      "No fue posible listar modelos de Gemini.";
    return { ok: false as const, status: res.status, error: errMessage };
  }
  const models = (data?.models as Array<Record<string, unknown>> | undefined) ?? [];
  const normalized = models
    .map((m) => {
      const name = toString(m.name, "");
      const methods = (m.supportedGenerationMethods as string[] | undefined) ?? [];
      return { id: name ? normalizeGeminiModelId(name) : "", methods };
    })
    .filter((m) => m.id);
  return { ok: true as const, models: normalized };
}

function pickGeminiModelId(models: Array<{ id: string; methods: string[] }>, variant: GeminiModelVariant) {
  const wanted = variant === "pro" ? "pro" : "flash";
  const preferred = models.find((m) => m.methods.includes("generateContent") && m.id.toLowerCase().includes(wanted));
  const any = models.find((m) => m.methods.includes("generateContent"));
  return normalizeGeminiModelId(preferred?.id || any?.id || "");
}

export async function POST(req: Request) {
  const access = await assertAdmin(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const geminiVariantRaw = toString(body?.modelVariant, "flash").trim().toLowerCase();
  const geminiVariant: GeminiModelVariant = geminiVariantRaw === "pro" ? "pro" : "flash";

  try {
    const apiKey = requiredEnv("AI_GEMINI_API_KEY");
    const baseUrl = (process.env.AI_GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");

    const start = Date.now();
    const listed = await listGeminiModels(apiKey, baseUrl);
    const ms = Date.now() - start;
    if (!listed.ok) return NextResponse.json({ error: listed.error }, { status: listed.status });

    const modelId = pickGeminiModelId(listed.models, geminiVariant);
    if (!modelId) {
      return NextResponse.json(
        { error: "La API Key es válida, pero no se encontraron modelos con generateContent habilitado." },
        { status: 409 },
      );
    }

    const sample = listed.models
      .filter((m) => m.methods.includes("generateContent"))
      .slice(0, 8)
      .map((m) => m.id);

    return NextResponse.json(
      {
        ok: true,
        provider: "gemini",
        variant: geminiVariant,
        baseUrl,
        latencyMs: ms,
        modelSelected: modelId,
        modelsDetected: sample,
      },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible validar la IA.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

