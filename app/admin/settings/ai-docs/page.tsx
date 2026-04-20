"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Copy, Download, Sparkles, BookOpen, X } from "lucide-react";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type CatalogItem = { id: string; name: string };
type ReadmeTemplateId = "custom" | "standard_detailed_v1";

const README_TEMPLATE_OPTIONS: Array<{ id: ReadmeTemplateId; label: string; description: string }> = [
  {
    id: "custom",
    label: "Personalizada",
    description: "Usa únicamente los temas y criterios que escribas manualmente.",
  },
  {
    id: "standard_detailed_v1",
    label: "Estilo app/docs",
    description: "Replica la estructura editorial del README base de app/docs, sin modificar tus temas.",
  },
];

const STANDARD_DETAILED_TEMPLATE_CRITERIA = [
  "Responde SOLO en Markdown válido y limpio.",
  "El documento debe seguir el estilo editorial de app/docs/README.md (estructura larga, técnica y didáctica).",
  "Incluye al inicio:",
  "- Título principal con #",
  "- Bloque de descripción con >",
  "- Separador ---",
  "- Sección '## Tabla de Contenidos' con índice numerado y anchors",
  "Usa secciones numeradas de primer nivel (ejemplo: '## 1. ...', '## 2. ...').",
  "Dentro de cada sección, usa subsecciones numeradas (ej: '### 1.1 ...', '### 1.2 ...').",
  "Por cada concepto importante incluye:",
  "- explicación extensa y clara",
  "- lista de puntos clave",
  "- al menos un ejemplo práctico",
  "- bloque de código cuando aplique",
  "- tabla comparativa/resumen cuando aporte valor",
  "Mantén formato consistente con separadores --- entre bloques grandes.",
  "Incluye bloque final de 'Referencias y recursos' con enlaces útiles.",
  "No incluyas sección de ejercicios propuestos.",
  "No limites el contenido a evaluación de examen; debe servir como material de aprendizaje autónomo.",
  "Usa lenguaje didáctico, accionable y sin relleno, con profundidad técnica.",
].join("\n");

const STANDARD_DETAILED_TEMPLATE_CONTEXT = [
  "Estilo objetivo: equivalente al README de app/docs (manual técnico completo, estructurado y navegable).",
  "El documento debe poder ser leído por estudiantes como guía principal de estudio.",
  "Además, debe permitir extraer preguntas para evaluación sin perder enfoque pedagógico.",
].join("\n");

function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

export default function AdminAiDocsPage() {
  const [tab, setTab] = useState<"readme" | "questions">("readme");
  const [geminiVariant, setGeminiVariant] = useState<"flash" | "pro">("flash");
  const [readmeTemplate, setReadmeTemplate] = useState<ReadmeTemplateId>("custom");
  const [topics, setTopics] = useState("");
  const [criteria, setCriteria] = useState("");
  const [audience, setAudience] = useState("Estudiantes de secundaria");
  const [context, setContext] = useState("");
  const [lengthHint, setLengthHint] = useState("media");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [readmeModelUsed, setReadmeModelUsed] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [moments, setMoments] = useState<CatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [momentId, setMomentId] = useState("");
  const [questionCount, setQuestionCount] = useState(45);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [allowedQuestionTypes, setAllowedQuestionTypes] = useState<string[]>([
    "single_choice",
    "multiple_choice",
    "open_concept",
  ]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchJson, setBatchJson] = useState("");
  const [batchModelUsed, setBatchModelUsed] = useState<string | null>(null);
  const [publishSubjectId, setPublishSubjectId] = useState("");
  const [institution, setInstitution] = useState<"CESDE" | "SENA">("CESDE");
  const [weekIndex, setWeekIndex] = useState(1);
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10));
  const [publishMomentId, setPublishMomentId] = useState<"M1" | "M2" | "M3">("M1");
  const [sessionPolicy, setSessionPolicy] = useState<"trimester" | "semester" | "custom">("semester");
  const [sessionDays, setSessionDays] = useState(180);
  const [publishMode, setPublishMode] = useState<"append" | "replace">("append");
  const [appendTitle, setAppendTitle] = useState("");
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [publishedCode, setPublishedCode] = useState("");
  const [publishedSubjectName, setPublishedSubjectName] = useState("");

  useEffect(() => {
    try {
      const cachedMarkdown = localStorage.getItem("zse:ai:readmeMarkdown") ?? "";
      const cachedReadmeModel = localStorage.getItem("zse:ai:readmeModelUsed");
      const cachedBatchJson = localStorage.getItem("zse:ai:batchJson") ?? "";
      const cachedBatchModel = localStorage.getItem("zse:ai:batchModelUsed");
      const cachedPublishedUrl = localStorage.getItem("zse:docs:publishedUrl") ?? "";
      const cachedPublishedCode = localStorage.getItem("zse:docs:publishedCode") ?? "";
      const cachedPublishedSubject = localStorage.getItem("zse:docs:publishedSubject") ?? "";
      if (cachedMarkdown) setMarkdown(cachedMarkdown);
      if (cachedReadmeModel) setReadmeModelUsed(cachedReadmeModel);
      if (cachedBatchJson) setBatchJson(cachedBatchJson);
      if (cachedBatchModel) setBatchModelUsed(cachedBatchModel);
      if (cachedPublishedUrl) setPublishedUrl(cachedPublishedUrl);
      if (cachedPublishedCode) setPublishedCode(cachedPublishedCode);
      if (cachedPublishedSubject) setPublishedSubjectName(cachedPublishedSubject);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (markdown) localStorage.setItem("zse:ai:readmeMarkdown", markdown);
      else localStorage.removeItem("zse:ai:readmeMarkdown");
    } catch {}
  }, [markdown]);

  useEffect(() => {
    try {
      if (readmeModelUsed) localStorage.setItem("zse:ai:readmeModelUsed", readmeModelUsed);
      else localStorage.removeItem("zse:ai:readmeModelUsed");
    } catch {}
  }, [readmeModelUsed]);

  useEffect(() => {
    try {
      if (batchJson) localStorage.setItem("zse:ai:batchJson", batchJson);
      else localStorage.removeItem("zse:ai:batchJson");
    } catch {}
  }, [batchJson]);

  useEffect(() => {
    try {
      if (batchModelUsed) localStorage.setItem("zse:ai:batchModelUsed", batchModelUsed);
      else localStorage.removeItem("zse:ai:batchModelUsed");
    } catch {}
  }, [batchModelUsed]);

  useEffect(() => {
    if (!subjectId) return;
    setPublishSubjectId((prev) => (prev ? prev : subjectId));
  }, [subjectId]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setCatalogError(null);
      try {
        const [subjectsSnap, groupsSnap, momentsSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(200))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(200))),
          getDocs(query(collection(firestore, "moments"), orderBy("name"), limit(50))),
        ]);
        if (cancelled) return;
        setSubjects(subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setGroups(groupsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setMoments(momentsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
      } catch {
        if (!cancelled) setCatalogError("No fue posible cargar catálogos. Revisa reglas/permisos.");
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const canGenerate = useMemo(
    () => topics.trim().length > 0 && criteria.trim().length > 0 && !loading,
    [topics, criteria, loading],
  );

  async function generate(
    overrides?: Partial<{
      topics: string;
      criteria: string;
      audience: string;
      context: string;
      lengthHint: string;
      geminiVariant: "flash" | "pro";
    }>,
  ) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    if (overrides?.topics != null) setTopics(overrides.topics);
    if (overrides?.criteria != null) setCriteria(overrides.criteria);
    if (overrides?.audience != null) setAudience(overrides.audience);
    if (overrides?.context != null) setContext(overrides.context);
    if (overrides?.lengthHint != null) setLengthHint(overrides.lengthHint);
    if (overrides?.geminiVariant != null) setGeminiVariant(overrides.geminiVariant);

    const payloadTopics = (overrides?.topics ?? topics).trim();
    const payloadCriteria = (overrides?.criteria ?? criteria).trim();
    const payloadAudience = (overrides?.audience ?? audience).trim();
    const payloadContext = (overrides?.context ?? context).trim();
    const payloadLengthHint = (overrides?.lengthHint ?? lengthHint).trim();
    const payloadGeminiVariant = overrides?.geminiVariant ?? geminiVariant;

    if (!payloadTopics || !payloadCriteria) {
      setError("Debes indicar al menos un tema y criterios de generación.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken(true);
      const payload: Record<string, unknown> = {
        topics: payloadTopics,
        criteria: payloadCriteria,
        audience: payloadAudience,
        context: payloadContext,
        lengthHint: payloadLengthHint,
        modelVariant: payloadGeminiVariant,
      };
      const res = await fetch("/api/admin/ai-readme", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "No fue posible generar el README.");
        return;
      }
      setReadmeModelUsed(typeof data?.modelUsed === "string" ? data.modelUsed : null);
      setMarkdown(typeof data?.markdown === "string" ? data.markdown : "");
    } catch {
      setError("No fue posible generar el README.");
    } finally {
      setLoading(false);
    }
  }

  const canGenerateBatch = useMemo(() => {
    return (
      !batchLoading &&
      !!markdown.trim() &&
      !!subjectId &&
      !!groupId &&
      !!momentId &&
      questionCount >= 1 &&
      allowedQuestionTypes.length > 0
    );
  }, [batchLoading, markdown, subjectId, groupId, momentId, questionCount, allowedQuestionTypes.length]);

  async function generateQuestionBatch() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setBatchError("Debes iniciar sesión como admin.");
      return;
    }
    setBatchLoading(true);
    setBatchError(null);
    try {
      const token = await user.getIdToken(true);
      const subject = subjects.find((s) => s.id === subjectId);
      const group = groups.find((g) => g.id === groupId);
      const moment = moments.find((m) => m.id === momentId);

      const res = await fetch("/api/admin/ai-question-batch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modelVariant: geminiVariant,
          documentationMarkdown: markdown,
          subjectId,
          subjectName: subject?.name,
          groupId,
          groupName: group?.name,
          momentId,
          momentName: moment?.name,
          questionCount,
          timeLimitMinutes,
          gradingScale: "0_50",
          allowedQuestionTypes,
        }),
      });

      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setBatchError(typeof data?.error === "string" ? data.error : "No fue posible generar el JSON.");
        return;
      }
      setBatchModelUsed(typeof data?.modelUsed === "string" ? data.modelUsed : null);
      const payload = data?.payload;
      setBatchJson(payload ? JSON.stringify(payload, null, 2) : "");
    } catch {
      setBatchError("No fue posible generar el JSON.");
    } finally {
      setBatchLoading(false);
    }
  }

  function toggleAllowedType(type: string) {
    setAllowedQuestionTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function applyReadmeTemplate(templateId: ReadmeTemplateId) {
    if (templateId === "custom") return;
    if (templateId === "standard_detailed_v1") {
      setCriteria(STANDARD_DETAILED_TEMPLATE_CRITERIA);
      setContext((prev) => (prev.trim() ? `${STANDARD_DETAILED_TEMPLATE_CONTEXT}\n\n${prev}` : STANDARD_DETAILED_TEMPLATE_CONTEXT));
      setLengthHint("larga");
    }
  }

  async function publishDocumentation(regenerateCode = false) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setPublishError("Debes iniciar sesión como admin.");
      return;
    }
    if (!markdown.trim()) {
      setPublishError("Primero debes generar el README.");
      return;
    }
    if (!publishSubjectId) {
      setPublishError("Selecciona la materia para publicar.");
      return;
    }
    const days = sessionPolicy === "trimester" ? 90 : sessionPolicy === "semester" ? 180 : sessionDays;
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));

    setPublishLoading(true);
    setPublishError(null);
    try {
      const token = await user.getIdToken(true);
      const subject = subjects.find((s) => s.id === publishSubjectId);
      const res = await fetch("/api/admin/docs/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subjectId: publishSubjectId,
          subjectName: subject?.name,
          markdown,
          institution,
          weekIndex,
          dateIso,
          momentId: institution === "CESDE" ? publishMomentId : undefined,
          sessionPolicy,
          sessionDays: safeDays,
          regenerateCode,
          publishMode,
          appendTitle: appendTitle.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        const base =
          typeof data?.error === "string"
            ? data.error
            : `No fue posible publicar la documentación (HTTP ${res.status}).`;
        setPublishError(base);
        return;
      }
      const path = typeof data?.urlPath === "string" ? data.urlPath : "";
      const absolute = path && typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
      const code = typeof data?.accessCode === "string" ? data.accessCode : "";
      const name = typeof data?.subjectName === "string" ? data.subjectName : subject?.name || publishSubjectId;
      setPublishedUrl(absolute);
      setPublishedCode(code);
      setPublishedSubjectName(name);
      try {
        if (absolute) localStorage.setItem("zse:docs:publishedUrl", absolute);
        if (code) localStorage.setItem("zse:docs:publishedCode", code);
        if (name) localStorage.setItem("zse:docs:publishedSubject", name);
      } catch {}
    } catch {
      setPublishError("No fue posible publicar la documentación. Revisa la consola y vuelve a intentar.");
    } finally {
      setPublishLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">IA</h1>
            <p className="mt-1 text-sm text-zinc-600">README en Markdown y JSON de preguntas para el banco.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setTab("readme")}
                className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                  tab === "readme" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                README
              </button>
              <button
                type="button"
                onClick={() => setTab("questions")}
                className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                  tab === "questions" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Preguntas JSON
              </button>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-900 text-white">
              <Bot className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {tab === "readme" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-950">Generar README</h2>
                  <p className="mt-1 text-sm text-zinc-600">Define temas y criterios. La salida es Markdown.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-700">Plantilla README</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={readmeTemplate}
                      onChange={(e) => setReadmeTemplate(e.target.value as ReadmeTemplateId)}
                      className="h-11 min-w-64 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      {README_TEMPLATE_OPTIONS.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => applyReadmeTemplate(readmeTemplate)}
                      disabled={readmeTemplate === "custom"}
                      className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Aplicar plantilla
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {README_TEMPLATE_OPTIONS.find((tpl) => tpl.id === readmeTemplate)?.description}
                  </p>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-700">Modelo</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800">
                      Gemini
                    </div>
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
                  </div>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-700">Temas</span>
                  <textarea
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                    rows={6}
                    placeholder={"Tema 1: ...\nTema 2: ...\nTema 3: ..."}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-700">Criterios</span>
                  <textarea
                    value={criteria}
                    onChange={(e) => setCriteria(e.target.value)}
                    rows={6}
                    placeholder={"Formato, tono, secciones obligatorias, profundidad, ejemplos, etc."}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Audiencia</span>
                    <input
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                      placeholder="Ej: estudiantes de grado 10"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Longitud</span>
                    <select
                      value={lengthHint}
                      onChange={(e) => setLengthHint(e.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="corta">Corta</option>
                      <option value="media">Media</option>
                      <option value="larga">Larga</option>
                    </select>
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-700">Contexto (opcional)</span>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    rows={3}
                    placeholder="Ej: enfoque por competencias, palabras clave, rúbrica, etc."
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </label>
              </div>

              {error ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-700">Gemini</span>
                  {readmeModelUsed ? <span className="text-zinc-400"> · {readmeModelUsed}</span> : null}
                </p>
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={!canGenerate}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? "Generando..." : "Generar README"}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-950">README</h2>
                  <p className="mt-1 text-sm text-zinc-600">Edición directa del Markdown generado.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(true)}
                    disabled={!markdown}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Vista previa
                  </button>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(markdown)}
                    disabled={!markdown}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadMarkdown(markdown, "README_GENERADO.md")}
                    disabled={!markdown}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-950">Publicar para consulta estudiantil</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Se publica segmentado por materia con acceso por código.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Materia</span>
                    <select
                      value={publishSubjectId}
                      onChange={(e) => setPublishSubjectId(e.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">Selecciona materia</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Vigencia de sesión</span>
                    <select
                      value={sessionPolicy}
                      onChange={(e) => setSessionPolicy(e.target.value as "trimester" | "semester" | "custom")}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="trimester">Trimestre (90 días)</option>
                      <option value="semester">Semestre (180 días)</option>
                      <option value="custom">Personalizada</option>
                    </select>
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Institución</span>
                    <select
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value as "CESDE" | "SENA")}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="CESDE">CESDE</option>
                      <option value="SENA">SENA</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Semana</span>
                    <select
                      value={weekIndex}
                      onChange={(e) => setWeekIndex(Number(e.target.value))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      {Array.from({ length: institution === "CESDE" ? 18 : 11 }).map((_, idx) => {
                        const w = idx + 1;
                        return (
                          <option key={w} value={w}>
                            {institution === "CESDE" ? `S${w}` : `Semana ${w}`}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Fecha</span>
                    <input
                      value={dateIso}
                      onChange={(e) => setDateIso(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    />
                  </label>

                  {institution === "CESDE" ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-zinc-700">Momento</span>
                      <select
                        value={publishMomentId}
                        onChange={(e) => setPublishMomentId(e.target.value as "M1" | "M2" | "M3")}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                      >
                        <option value="M1">M1</option>
                        <option value="M2">M2</option>
                        <option value="M3">M3</option>
                      </select>
                    </label>
                  ) : (
                    <div />
                  )}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Modo de publicación</span>
                    <select
                      value={publishMode}
                      onChange={(e) => setPublishMode(e.target.value as "append" | "replace")}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="append">Actualizar (agregar)</option>
                      <option value="replace">Reemplazar todo</option>
                    </select>
                    <p className="text-xs text-zinc-500">
                      Actualizar agrega el nuevo contenido al final y conserva lo anterior.
                    </p>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Título de actualización (opcional)</span>
                    <input
                      value={appendTitle}
                      onChange={(e) => setAppendTitle(e.target.value)}
                      disabled={publishMode !== "append"}
                      placeholder="Ej: Semana 3 — Funciones y condicionales"
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:opacity-60"
                    />
                    <p className="text-xs text-zinc-500">
                      Si lo dejas vacío se usará “Actualización YYYY-MM-DD”.
                    </p>
                  </label>
                </div>

                {sessionPolicy === "custom" ? (
                  <label className="mt-3 grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Días de sesión</span>
                    <input
                      type="number"
                      value={sessionDays}
                      onChange={(e) => setSessionDays(Number(e.target.value))}
                      min={1}
                      max={365}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    />
                  </label>
                ) : null}

                {publishError ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {publishError}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void publishDocumentation(false)}
                    disabled={!markdown.trim() || !publishSubjectId || publishLoading}
                    className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {publishLoading ? "Publicando..." : "Publicar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void publishDocumentation(true)}
                    disabled={!markdown.trim() || !publishSubjectId || publishLoading}
                    className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Regenerar código
                  </button>
                </div>

                {publishedUrl ? (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                    <p className="text-xs font-semibold text-zinc-700">Publicado</p>
                    <p className="mt-1 text-xs text-zinc-500">{publishedSubjectName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      URL:{" "}
                      <a href={publishedUrl} className="font-medium text-indigo-700 underline" target="_blank" rel="noreferrer">
                        {publishedUrl}
                      </a>
                    </p>
                    <p className="mt-1 text-xs text-zinc-700">
                      Código: <span className="font-semibold tracking-widest">{publishedCode || "-"}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(publishedUrl)}
                        className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        Copiar URL
                      </button>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(publishedCode)}
                        className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        Copiar código
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                {markdown ? (
                  <textarea
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                    rows={18}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-zinc-900 shadow-sm outline-none focus:border-zinc-400"
                  />
                ) : (
                  <div className="grid gap-1 py-6 text-center">
                    <p className="text-sm font-semibold text-zinc-900">Sin contenido</p>
                    <p className="text-sm text-zinc-500">Genera el README para editarlo aquí.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-950">Generar JSON</h2>
                <p className="mt-1 text-sm text-zinc-600">Usa el README como fuente para crear preguntas importables.</p>
              </div>

              {!markdown.trim() ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  Primero genera un README.{" "}
                  <button
                    type="button"
                    onClick={() => setTab("readme")}
                    className="font-semibold underline underline-offset-2"
                  >
                    Ir a README
                  </button>
                </div>
              ) : null}

              {catalogError ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {catalogError}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Materia</span>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">Selecciona materia</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Grupo</span>
                    <select
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">Selecciona grupo</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-700">Momento</span>
                  <select
                    value={momentId}
                    onChange={(e) => setMomentId(e.target.value)}
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Selecciona momento</option>
                    {moments.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Preguntas</span>
                    <input
                      type="number"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      min={1}
                      max={200}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-700">Tiempo (min)</span>
                    <input
                      type="number"
                      value={timeLimitMinutes}
                      onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                      min={1}
                      max={300}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    />
                  </label>
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-semibold text-zinc-700">Tipos de pregunta</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "single_choice", label: "Selección única" },
                      { id: "multiple_choice", label: "Selección múltiple" },
                      { id: "open_concept", label: "Abierta" },
                      { id: "puzzle_order", label: "Ordenar" },
                      { id: "puzzle_match", label: "Emparejar" },
                      { id: "puzzle_cloze", label: "Completar" },
                    ].map((t) => {
                      const active = allowedQuestionTypes.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleAllowedType(t.id)}
                          className={`h-9 rounded-xl px-3 text-sm font-semibold transition ${
                            active
                              ? "bg-zinc-900 text-white"
                              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-zinc-500">Seleccionados: {allowedQuestionTypes.join(", ")}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-950">Batch JSON</h2>
                  <p className="mt-1 text-sm text-zinc-600">Listo para Banco → Importar.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(batchJson)}
                    disabled={!batchJson}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadJson(batchJson, "BATCH_PREGUNTAS.json")}
                    disabled={!batchJson}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateQuestionBatch()}
                    disabled={!canGenerateBatch}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {batchLoading ? "Generando..." : "Generar JSON"}
                  </button>
                </div>
              </div>

              {batchError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {batchError}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">
                  Fuente: README. {batchModelUsed ? <span className="text-zinc-400">· {batchModelUsed}</span> : null}
                </p>
              </div>

              <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                {batchJson ? (
                  <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words text-xs text-zinc-900">
                    {batchJson}
                  </pre>
                ) : (
                  <div className="grid gap-1 py-6 text-center">
                    <p className="text-sm font-semibold text-zinc-900">Sin JSON</p>
                    <p className="text-sm text-zinc-500">Configura los parámetros y genera el batch.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {previewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setPreviewModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative flex h-full max-h-[800px] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-950">Vista previa del documento</h3>
                  <p className="text-xs text-zinc-500">Así lo verá el estudiante en la plataforma.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6">
                <div className="mx-auto max-w-none rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
                  <MarkdownViewer markdown={markdown} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
