"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase/client";

export default function AdminIaTestPage() {
  const [geminiVariant, setGeminiVariant] = useState<"flash" | "pro">("flash");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [details, setDetails] = useState<{
    provider: string;
    modelSelected: string;
    latencyMs: number;
    modelsDetected: string[];
  } | null>(null);

  const canRun = useMemo(() => !loading, [loading]);

  async function runTest() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    setLoading(true);
    setError(null);
    setOk(null);
    setDetails(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/ai-ping", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modelVariant: geminiVariant,
        }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "No fue posible probar la IA.");
        setOk(false);
        return;
      }
      setOk(true);
      setDetails({
        provider: typeof data?.provider === "string" ? data.provider : "gemini",
        modelSelected: typeof data?.modelSelected === "string" ? data.modelSelected : "-",
        latencyMs: typeof data?.latencyMs === "number" && Number.isFinite(data.latencyMs) ? Math.floor(data.latencyMs) : 0,
        modelsDetected: Array.isArray(data?.modelsDetected)
          ? (data?.modelsDetected as unknown[]).map((x) => (typeof x === "string" ? x : "")).filter(Boolean)
          : [],
      });
    } catch {
      setError("No fue posible probar la IA.");
      setOk(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">IA Test</h1>
            <p className="mt-1 text-sm text-zinc-600">Validador: confirma si la integración está funcionando (sin generar contenido).</p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-900 text-white">
            <Bot className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-700">Variante Gemini</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex w-fit items-center rounded-xl border border-zinc-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setGeminiVariant("flash")}
                  className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                    geminiVariant === "flash" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Flash
                </button>
                <button
                  type="button"
                  onClick={() => setGeminiVariant("pro")}
                  className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                    geminiVariant === "pro" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Pro
                </button>
              </div>
              {details?.modelSelected ? <span className="text-xs text-zinc-500">Modelo seleccionado: {details.modelSelected}</span> : null}
            </div>
          </label>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {ok === true ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Funciona
              </div>
            ) : ok === false ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                <XCircle className="h-4 w-4" />
                No funciona
              </div>
            ) : (
              <div className="text-sm text-zinc-500">Sin validar aún</div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void runTest()}
            disabled={!canRun}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Validando..." : "Validar IA"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-950">Detalle</h2>
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          {details ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-500">Proveedor</span>
                <span className="font-semibold">{details.provider}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-500">Modelo seleccionado</span>
                <span className="font-mono text-xs">{details.modelSelected}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-500">Latencia</span>
                <span className="font-semibold">{details.latencyMs} ms</span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-zinc-500">Modelos detectados (ejemplos)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {details.modelsDetected.length ? (
                    details.modelsDetected.map((m) => (
                      <span key={m} className="rounded-full border border-zinc-200 bg-white px-2 py-1 font-mono text-[11px] text-zinc-700">
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-zinc-500">-</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Ejecuta “Validar IA” para ver el diagnóstico.</p>
          )}
        </div>
      </div>
    </div>
  );
}

