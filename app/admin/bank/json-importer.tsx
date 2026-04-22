"use client";

import { useMemo, useState } from "react";
import { firebaseAuth } from "@/lib/firebase/client";
import { IconButton } from "@/app/admin/ui/icon-button";
import { Copy, FileUp, RefreshCcw } from "lucide-react";

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function JsonImporter() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [sourceJson, setSourceJson] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  function clearAll() {
    setError(null);
    setResult(null);
    setPayload(null);
    setFileName(null);
    setRawJson("");
    setSourceJson("");
    setCopied(false);
  }

  function parseAndSetPayload(text: string, sourceName: string) {
    setError(null);
    setResult(null);
    setPayload(null);
    setSourceJson("");
    setCopied(false);
    setFileName(sourceName);
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") {
        setError("El contenido no contiene un JSON válido.");
        return;
      }
      if (typeof parsed.schemaVersion !== "string") {
        setError("Falta schemaVersion en el JSON.");
        return;
      }
      if (!parsed.batch || typeof parsed.batch !== "object") {
        setError("Falta batch en el JSON.");
        return;
      }
      if (!parsed.catalog || typeof parsed.catalog !== "object") {
        setError("Falta catalog en el JSON.");
        return;
      }
      if (!Array.isArray(parsed.questions)) {
        setError("Falta questions (array) en el JSON.");
        return;
      }
      if (!Array.isArray(parsed.examTemplates)) {
        setError("Falta examTemplates (array) en el JSON.");
        return;
      }
      setPayload(parsed);
      setSourceJson(JSON.stringify(parsed, null, 2));
    } catch {
      setError("No fue posible parsear el JSON.");
    }
  }

  async function copyLoadedJson() {
    if (!sourceJson) return;
    setError(null);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(sourceJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("No fue posible copiar el JSON.");
    }
  }

  const summary = useMemo(() => {
    const questions = Array.isArray(payload?.questions) ? payload?.questions.length : 0;
    const templates = Array.isArray(payload?.examTemplates) ? payload?.examTemplates.length : 0;
    const catalog = (payload?.catalog as Record<string, unknown> | null) ?? {};
    const subjects = Array.isArray(catalog.subjects) ? catalog.subjects.length : 0;
    const groups = Array.isArray(catalog.groups) ? catalog.groups.length : 0;
    const moments = Array.isArray(catalog.moments) ? catalog.moments.length : 0;
    const sites = Array.isArray(catalog.sites) ? catalog.sites.length : 0;
    const shifts = Array.isArray(catalog.shifts) ? catalog.shifts.length : 0;
    return { questions, templates, subjects, groups, moments, sites, shifts };
  }, [payload]);

  const importSummary = useMemo(() => {
    const stats = (result?.stats as Record<string, unknown> | null) ?? null;
    const questions = (stats?.questions as Record<string, unknown> | null) ?? null;
    const examTemplates = (stats?.examTemplates as Record<string, unknown> | null) ?? null;
    return {
      questionsCreated: toNumber(questions?.created, 0),
      questionsSkipped: toNumber(questions?.skipped, 0),
      templatesCreated: toNumber(examTemplates?.created, 0),
    };
  }, [result]);

  async function onPickFile(file: File | null) {
    setError(null);
    setResult(null);
    setPayload(null);
    setFileName(file ? file.name : null);
    if (!file) return;
    try {
      const text = await file.text();
      setRawJson("");
      parseAndSetPayload(text, file.name);
    } catch {
      setError("No fue posible leer o parsear el archivo JSON.");
    }
  }

  async function importBatch() {
    if (!payload) return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/import-batch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payload, dryRun }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "No fue posible importar.";
        setError(msg);
        return;
      }
      setResult(data);
    } catch {
      setError("No fue posible importar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-zinc-950">Importar JSON</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Sube un lote JSON (append_only) o pégalo como texto para cargarlo a Firestore desde la interfaz.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
            <FileUp className="h-4 w-4" />
            Seleccionar JSON
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <IconButton
            onClick={() => void copyLoadedJson()}
            className="h-10 w-10"
            aria-label="Copiar JSON"
            title={copied ? "Copiado" : "Copiar JSON"}
            disabled={!sourceJson}
          >
            <Copy className="h-4 w-4" />
          </IconButton>
          <IconButton
            onClick={clearAll}
            className="h-10 w-10"
            aria-label="Limpiar"
            title="Limpiar"
          >
            <RefreshCcw className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
        <p className="text-sm font-semibold text-zinc-900">Pegar JSON</p>
        <p className="mt-1 text-xs text-zinc-500">Pega el lote completo y cárgalo sin necesidad de archivo.</p>
        <textarea
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          placeholder='{"schemaVersion":"...","batch":{...},"catalog":{...},"questions":[...],"examTemplates":[...]}'
          className="mt-3 min-h-[180px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400"
        />
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setRawJson("")}
            disabled={!rawJson.trim()}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Limpiar texto
          </button>
          <button
            type="button"
            onClick={() => void copyLoadedJson()}
            disabled={!sourceJson}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copied ? "Copiado" : "Copiar JSON"}
          </button>
          <button
            type="button"
            onClick={() => parseAndSetPayload(rawJson, "pegado.json")}
            disabled={!rawJson.trim()}
            className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cargar JSON pegado
          </button>
        </div>
      </div>

      {fileName ? (
        <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Archivo: <strong>{fileName}</strong>
        </div>
      ) : null}

      {payload ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Preguntas</p>
            <p className="text-lg font-semibold text-zinc-900">{summary.questions}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Plantillas</p>
            <p className="text-lg font-semibold text-zinc-900">{summary.templates}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Materias</p>
            <p className="text-lg font-semibold text-zinc-900">{summary.subjects}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Grupos</p>
            <p className="text-lg font-semibold text-zinc-900">{summary.groups}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Momentos</p>
            <p className="text-lg font-semibold text-zinc-900">{summary.moments}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Extra</p>
            <p className="text-lg font-semibold text-zinc-900">{summary.sites + summary.shifts}</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
          Selecciona un archivo JSON o pega el contenido para ver el resumen e importar.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Simular (dry-run)
        </label>

        <button
          type="button"
          onClick={() => void importBatch()}
          disabled={!payload || loading}
          className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Importando..." : dryRun ? "Validar importación" : "Importar a Firestore"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Resultado</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">Preguntas creadas</p>
              <p className="text-lg font-semibold text-zinc-900">
                {importSummary.questionsCreated}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">Preguntas omitidas</p>
              <p className="text-lg font-semibold text-zinc-900">
                {importSummary.questionsSkipped}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">Plantillas creadas</p>
              <p className="text-lg font-semibold text-zinc-900">
                {importSummary.templatesCreated}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

