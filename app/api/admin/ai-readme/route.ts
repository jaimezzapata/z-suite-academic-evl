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

function isNotFoundModelError(message: string) {
  const msg = message.toLowerCase();
  return msg.includes("is not found") || msg.includes("not supported for generatecontent");
}

function isQuotaExceededError(message: string) {
  const msg = message.toLowerCase();
  return msg.includes("quota exceeded") || msg.includes("exceeded your current quota") || msg.includes("rate limit");
}

async function listGeminiModels(apiKey: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/models`, {
    method: "GET",
    headers: { "x-goog-api-key": apiKey },
  });
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
    .filter((m) => m.id && m.methods.includes("generateContent"));
  return { ok: true as const, models: normalized };
}

function pickGeminiModelId(
  models: Array<{ id: string; methods: string[] }>,
  variant: GeminiModelVariant,
  fallbackId: string,
) {
  const wanted = variant === "pro" ? "pro" : "flash";
  const preferred = models.find((m) => m.id.toLowerCase().includes(wanted));
  return normalizeGeminiModelId(preferred?.id || fallbackId);
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

function buildPrompts({
  templateId,
  topics,
  criteria,
  audience,
  context,
  lengthHint,
}: {
  templateId: string;
  topics: string;
  criteria: string;
  audience: string;
  context: string;
  lengthHint: string;
}) {
  const systemPrompt =
    templateId === "standard_detailed_v1"
      ? [
          "Eres un generador experto de capítulos para un cuadernillo académico.",
          "Debes responder solo en Markdown válido.",
          "Regla de código: todo bloque de código debe declarar lenguaje en el fence (ej: ```json, ```javascript, ```html, ```css, ```sql, ```bash, ```text).",
          "Salida esperada: UN (1) capítulo autocontenido, diseñado para leerse como página independiente.",
          "Estructura obligatoria (en este orden):",
          "1) # Título del capítulo",
          "2) > Resumen (1–2 líneas)",
          "3) ## Objetivos de aprendizaje (3–6 bullets)",
          "4) ## Antes de empezar (prerrequisitos + checklist corto)",
          "5) ## Explicación (en bloques cortos con '###')",
          "6) ## Ejemplos (mínimo 2, con código si aplica)",
          "7) ## Errores comunes y cómo evitarlos",
          "8) ## Resumen (tabla o bullets)",
          "9) ## Referencias (3–6 recursos)",
          "No incluyas tabla de contenidos global.",
          "Evita relleno: cada párrafo debe aportar valor didáctico.",
        ].join("\n")
      : [
          "Eres un generador experto de README académico (documento estructurado).",
          "Debes responder solo en Markdown válido.",
          "Regla de código: todo bloque de código debe declarar lenguaje en el fence (ej: ```json, ```javascript, ```html, ```css, ```sql, ```bash, ```text).",
          "Regla: respeta estrictamente la plantilla indicada en 'Criterios'.",
          "Incluye tabla de contenidos y secciones numeradas si la plantilla lo exige.",
          "No agregues secciones extra fuera de la plantilla.",
        ].join("\n");

  const userPrompt = [
    `Temas:\n${topics}`,
    `Criterios:\n${criteria}`,
    `Audiencia:\n${audience}`,
    `Contexto adicional:\n${context || "N/A"}`,
    `Longitud esperada:\n${lengthHint}`,
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

async function generateWithGemini(systemPrompt: string, userPrompt: string, modelVariant: GeminiModelVariant) {
  const apiKey = requiredEnv("AI_GEMINI_API_KEY");
  const modelFlash =
    process.env.AI_GEMINI_MODEL_FLASH?.trim() || process.env.AI_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const modelPro = process.env.AI_GEMINI_MODEL_PRO?.trim() || "gemini-2.5-pro";
  const initialModel = normalizeGeminiModelId(modelVariant === "pro" ? modelPro : modelFlash);
  const flashModelId = normalizeGeminiModelId(modelFlash);
  const baseUrl = (process.env.AI_GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");

  async function requestWithModel(modelId: string) {
    const url = `${baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`;
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
        },
      }),
    });
  }

  const response = await requestWithModel(initialModel);

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const errMessage =
      toString((data?.error as Record<string, unknown> | null)?.message, "") ||
      toString(data?.error, "") ||
      "No fue posible generar el README con Gemini.";
    if (modelVariant === "pro" && (response.status === 429 || response.status === 403 || isQuotaExceededError(errMessage))) {
      const retry = await requestWithModel(flashModelId);
      const retryData = (await retry.json().catch(() => null)) as Record<string, unknown> | null;
      if (retry.ok) {
        const candidates = (retryData?.candidates as Array<Record<string, unknown>> | undefined) ?? [];
        const first = candidates[0] ?? {};
        const content = (first.content as Record<string, unknown> | undefined) ?? {};
        const parts = (content.parts as Array<Record<string, unknown>> | undefined) ?? [];
        const markdown = parts.map((p) => toString(p.text, "")).join("\n").trim();
        if (!markdown) return { ok: false as const, status: 502, error: "Gemini no devolvió contenido." };
        return { ok: true as const, markdown, modelUsed: flashModelId };
      }
      const retryErr =
        toString((retryData?.error as Record<string, unknown> | null)?.message, "") ||
        toString(retryData?.error, "") ||
        "No fue posible generar el README con Gemini.";
      return {
        ok: false as const,
        status: response.status,
        error: `Gemini PRO no está disponible por cuota/plan. Detalle: ${errMessage}. También falló Flash: ${retryErr}`,
      };
    }
    if (response.status === 404 || isNotFoundModelError(errMessage)) {
      const listed = await listGeminiModels(apiKey, baseUrl);
      if (!listed.ok) {
        return {
          ok: false as const,
          status: response.status,
          error:
            `${errMessage} ` +
            `Además falló el listado de modelos (status ${listed.status}). ` +
            `Verifica que la API Key sea de Google AI Studio (Gemini API) y que la Gemini API esté habilitada. ` +
            `Detalle listado: ${listed.error}`,
        };
      }
      if (listed.models.length === 0) {
        return {
          ok: false as const,
          status: response.status,
          error: `${errMessage} No se encontraron modelos compatibles con generateContent para esta API Key.`,
        };
      }

      const fallbackModel = pickGeminiModelId(listed.models, modelVariant, initialModel);
      const retry = await requestWithModel(fallbackModel);
      const retryData = (await retry.json().catch(() => null)) as Record<string, unknown> | null;
      if (!retry.ok) {
        const retryErr =
          toString((retryData?.error as Record<string, unknown> | null)?.message, "") ||
          toString(retryData?.error, "") ||
          "No fue posible generar el README con Gemini.";
        const examples = listed.models
          .slice(0, 8)
          .map((m) => m.id)
          .join(", ");
        return {
          ok: false as const,
          status: retry.status,
          error:
            `${retryErr} ` +
            `Modelos detectados (ejemplos): ${examples}. ` +
            `Configura AI_GEMINI_MODEL_${modelVariant === "pro" ? "PRO" : "FLASH"} con uno de esos IDs.`,
        };
      }
      const candidates = (retryData?.candidates as Array<Record<string, unknown>> | undefined) ?? [];
      const first = candidates[0] ?? {};
      const content = (first.content as Record<string, unknown> | undefined) ?? {};
      const parts = (content.parts as Array<Record<string, unknown>> | undefined) ?? [];
      const markdown = parts.map((p) => toString(p.text, "")).join("\n").trim();
      if (!markdown) return { ok: false as const, status: 502, error: "Gemini no devolvió contenido." };
      return { ok: true as const, markdown, modelUsed: fallbackModel };
    }

    return { ok: false as const, status: response.status, error: errMessage };
  }

  const candidates = (data?.candidates as Array<Record<string, unknown>> | undefined) ?? [];
  const first = candidates[0] ?? {};
  const content = (first.content as Record<string, unknown> | undefined) ?? {};
  const parts = (content.parts as Array<Record<string, unknown>> | undefined) ?? [];
  const markdown = parts.map((p) => toString(p.text, "")).join("\n").trim();
  if (!markdown) return { ok: false as const, status: 502, error: "Gemini no devolvió contenido." };
  return { ok: true as const, markdown, modelUsed: initialModel };
}

export async function POST(req: Request) {
  const access = await assertAdmin(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const templateId = toString(body?.readmeTemplate, "custom").trim();
  const topics = toString(body?.topics, "").trim();
  const criteria = toString(body?.criteria, "").trim();
  const audience = toString(body?.audience, "Estudiantes y docentes").trim();
  const context = toString(body?.context, "").trim();
  const lengthHint = toString(body?.lengthHint, "media").trim();
  const geminiVariantRaw = toString(body?.modelVariant, "flash").trim().toLowerCase();
  const geminiVariant: GeminiModelVariant = geminiVariantRaw === "pro" ? "pro" : "flash";

  if (!topics) return NextResponse.json({ error: "Debes indicar al menos un tema." }, { status: 400 });
  if (!criteria) return NextResponse.json({ error: "Debes indicar criterios de generación." }, { status: 400 });

  const { systemPrompt, userPrompt } = buildPrompts({ templateId, topics, criteria, audience, context, lengthHint });

  try {
    const result = await generateWithGemini(systemPrompt, userPrompt, geminiVariant);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      { ok: true, provider: "gemini", modelUsed: result.modelUsed, markdown: result.markdown },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible conectar con el proveedor de IA.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
