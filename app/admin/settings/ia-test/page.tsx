"use client";

import { useMemo, useState } from "react";
import { Bot, Copy, Download, Sparkles } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase/client";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminIaTestPage() {
  const [geminiVariant, setGeminiVariant] = useState<"flash" | "pro">("flash");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [view, setView] = useState<"preview" | "markdown">("preview");

  const canRun = useMemo(() => !loading, [loading]);

  async function runTest() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/ai-readme", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modelVariant: geminiVariant,
          topics: ["Tema 1: CONCEPTOS BÁSICOS", "Tema 2: EJERCICIOS", "Tema 3: EVALUACIÓN"].join("\n"),
          criteria: [
            "- Responder en Markdown",
            "- Incluir ejemplos",
            "- Incluir tabla de criterios de evaluación",
            "- Mantener tono didáctico",
          ].join("\n"),
          audience: "Estudiantes de secundaria",
          context: "",
          lengthHint: "corta",
        }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "No fue posible probar la IA.");
        return;
      }
      setModelUsed(typeof data?.modelUsed === "string" ? data.modelUsed : null);
      setMarkdown(typeof data?.markdown === "string" ? data.markdown : "");
    } catch {
      setError("No fue posible probar la IA.");
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
            <p className="mt-1 text-sm text-zinc-600">Prueba rápida de Gemini y verificación de configuración.</p>
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
              {modelUsed ? <span className="text-xs text-zinc-500">Modelo usado: {modelUsed}</span> : null}
            </div>
          </label>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setView("preview")}
              className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${
                view === "preview" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Vista
            </button>
            <button
              type="button"
              onClick={() => setView("markdown")}
              className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${
                view === "markdown" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Markdown
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(markdown)}
              disabled={!markdown}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
              Copiar
            </button>
            <button
              type="button"
              onClick={() => downloadMarkdown(markdown, "README_TEST.md")}
              disabled={!markdown}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Descargar
            </button>
            <button
              type="button"
              onClick={() => void runTest()}
              disabled={!canRun}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Probando..." : "Probar IA"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-950">Salida</h2>
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          {markdown ? (
            view === "preview" ? (
              <MarkdownViewer markdown={markdown} />
            ) : (
              <textarea
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                rows={16}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
            )
          ) : (
            <p className="text-sm text-zinc-500">Ejecuta la prueba para ver el resultado.</p>
          )}
        </div>
      </div>
    </div>
  );
}

