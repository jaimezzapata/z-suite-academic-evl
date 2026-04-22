"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Copy, Download, Sparkles, BookOpen, X, Eraser, SlidersHorizontal } from "lucide-react";
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

function ModalShell({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="relative flex h-full max-h-[860px] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-zinc-950">{title}</h3>
                {subtitle ? <p className="mt-1 truncate text-xs text-zinc-500">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-5">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

type CatalogItem = { id: string; name: string };
type ReadmeTemplateId = "custom" | "standard_detailed_v1";

const README_TEMPLATE_OPTIONS: Array<{ id: ReadmeTemplateId; label: string; description: string }> = [
  {
    id: "custom",
      label: "Personalizada",
    description: "Plantilla estructurada con tabla de contenidos, secciones numeradas, tablas y ejemplos.",
  },
  {
    id: "standard_detailed_v1",
    label: "Capítulo didáctico",
    description: "Genera un capítulo (1 página) listo para el cuadernillo: claro, navegable y pedagógico.",
  },
];

const CUSTOM_TEMPLATE_CRITERIA = [
  "Responde SOLO en Markdown válido y limpio.",
  "Regla de código: en la salida final NO uses fences sin lenguaje. Reemplaza cada bloque ``` del template por ```<lenguaje> (ej: ```json, ```javascript, ```html, ```css, ```sql, ```bash, ```text).",
  "Debe seguir EXACTAMENTE esta estructura base (reemplaza los textos entre [ ] por contenido real):",
  "",
  "# 📚 [Título del Documento]",
  "[Descripción breve — una línea que resume el contenido]",
  "",
  "## 📋 Tabla de Contenidos",
  "- 1. [Nombre de la Sección]",
  "  - 1.1 ¿Qué es [Tema]?",
  "  - 1.2 [Concepto clave]",
  "  - 1.3 [Estructura / Sintaxis]",
  "  - 1.4 [Tipos / Variantes]",
  "  - 1.5 [Referencia completa de elementos]",
  "- 2. [Nombre de la Sección]",
  "  - 2.1 ¿Qué es [Tema]?",
  "  - 2.2 [Elemento principal]",
  "  - 2.3 [Elemento secundario]",
  "- N. [Nombre de la Sección N]",
  "",
  "## 1. [Nombre de la Sección]",
  "### 1.1 ¿Qué es [Tema]?",
  "[Definición clara y directa. Contexto histórico si aplica. Relación con otros conceptos.]",
  "",
  "```",
  "[Ejemplo de código o sintaxis básica]",
  "```",
  "",
  "### 1.2 [Concepto clave]",
  "[Explicación del concepto.]",
  "",
  "**¿Por qué importa?**",
  "- [Razón 1]: [Explicación.]",
  "- [Razón 2]: [Explicación.]",
  "- [Razón 3]: [Explicación.]",
  "",
  "**Ejemplo — [caso A] vs [caso B]:**",
  "```",
  "[Código o comparación]",
  "```",
  "",
  "### 1.3 [Estructura / Sintaxis]",
  "[Descripción de la estructura o sintaxis del tema.]",
  "",
  "```",
  "[Diagrama o bloque de código]",
  "```",
  "",
  "| Parte | Descripción |",
  "| --- | --- |",
  "| [elemento] | [qué es y para qué sirve] |",
  "| [elemento] | [qué es y para qué sirve] |",
  "",
  "### 1.4 [Tipos / Variantes]",
  "[Introducción a las distintas variantes del tema.]",
  "",
  "**[Tipo o Variante A]**",
  "- [Descripción, cuándo usarlo.]",
  "```",
  "[Ejemplo]",
  "```",
  "",
  "| Atributo / Propiedad | Descripción |",
  "| --- | --- |",
  "| [nombre] | [descripción] |",
  "| [nombre] | [descripción] |",
  "",
  "**[Tipo o Variante B]**",
  "- [Descripción, cuándo usarlo.]",
  "```",
  "[Ejemplo]",
  "```",
  "",
  "### 1.5 [Referencia completa de elementos]",
  "| Elemento | Definición | Dónde se usa | Por qué usarlo |",
  "| --- | --- | --- | --- |",
  "| [elemento] | [qué es] | [contexto] | [justificación] |",
  "| [elemento] | [qué es] | [contexto] | [justificación] |",
  "",
  "**Ejemplo completo integrado**",
  "```",
  "[Bloque de código con un ejemplo real que une todo lo visto en la sección]",
  "```",
  "",
  "## 2. [Nombre de la Sección]",
  "### 2.1 ¿Qué es [Tema]?",
  "[Definición. Flujo o proceso general si aplica.]",
  "- [Paso 1]",
  "- [Paso 2]",
  "- [Paso 3]",
  "",
  "### 2.2 [Elemento principal]",
  "[Descripción y propósito.]",
  "",
  "**Sintaxis:**",
  "```",
  "[Código]",
  "```",
  "",
  "**Atributos:**",
  "| Atributo | Valores posibles | Descripción |",
  "| --- | --- | --- |",
  "| [atributo] | [valores] | [qué hace] |",
  "| [atributo] | [valores] | [qué hace] |",
  "",
  "### 2.3 [Elemento secundario]",
  "[Descripción. Diferencias con elementos similares.]",
  "```",
  "[Ejemplo]",
  "```",
  "",
  "**Atributos:**",
  "| Atributo | Valores posibles | Descripción |",
  "| --- | --- | --- |",
  "| [atributo] | [valores] | [qué hace] |",
  "",
  "> Nota: [Advertencia, buena práctica o aclaración importante.]",
  "",
  "**Ejemplo completo integrado**",
  "```",
  "[Código completo que combina los elementos de la sección]",
  "```",
  "",
  "## N. [Nombre de la Sección N]",
  "### N.1 ¿Por qué importa [Tema]?",
  "[Introducción y justificación.]",
  "",
  "### N.2 [Concepto / Convención A]",
  "[Definición y características.]",
  "",
  "**Formato:**",
  "```",
  "[ejemplo-de-formato]",
  "```",
  "",
  "**¿Dónde se usa?**",
  "- [Caso de uso 1]",
  "- [Caso de uso 2]",
  "",
  "### N.3 [Concepto / Convención B]",
  "[Definición y características.]",
  "",
  "**Formato:**",
  "```",
  "[ejemplo_de_formato]",
  "```",
  "",
  "**¿Dónde se usa?**",
  "- [Caso de uso 1]",
  "- [Caso de uso 2]",
  "",
  "### N.4 Tabla comparativa",
  "| Concepto | Formato | Ejemplo | Usos principales |",
  "| --- | --- | --- | --- |",
  "| [A] | [descripción] | [ejemplo] | [contextos] |",
  "| [B] | [descripción] | [ejemplo] | [contextos] |",
  "| [C] | [descripción] | [ejemplo] | [contextos] |",
  "",
  "**Guía rápida de decisión:**",
  "- ¿Es [caso]? → usar [A]: ejemplo-asi",
  "- ¿Es [caso]? → usar [B]: ejemplo_asi",
  "- ¿Es [caso]? → usar [C]: EjemploAsi",
  "",
  "## Referencias y recursos",
  "- [Nombre]",
  "- [Nombre]",
  "- [Nombre]",
  "",
  "*[Nota al pie: autoría, fecha, propósito del documento.]*",
].join("\n");

const STANDARD_DETAILED_TEMPLATE_CRITERIA = [
  "Responde SOLO en Markdown válido y limpio.",
  "El resultado debe ser un CAPÍTULO independiente (una sola página) dentro de un cuadernillo.",
  "Regla de código: siempre que uses bloques de código, usa fences con lenguaje (ej: ```json, ```javascript, ```html, ```css, ```sql, ```bash, ```text).",
  "Formato obligatorio (en este orden):",
  "1) # Título del capítulo",
  "2) > 1–2 líneas de resumen (qué aprenderás)",
  "3) ## Objetivos de aprendizaje (3–6 bullets)",
  "4) ## Antes de empezar (prerrequisitos + checklist corto)",
  "5) ## Explicación (conceptos por bloques cortos con '###')",
  "6) ## Ejemplos (mínimo 2, con código cuando aplique)",
  "7) ## Errores comunes y cómo evitarlos (bullet points)",
  "8) ## Resumen (tabla o bullets)",
  "9) ## Referencias (3–6 links o recursos)",
  "Reglas: lenguaje claro, directo, sin relleno. Usa tablas y listas solo cuando aporten claridad.",
  "No incluyas un índice/tabla de contenidos global del cuadernillo.",
].join("\n");

const STANDARD_DETAILED_TEMPLATE_CONTEXT = [
  "Objetivo: generar material de estudio con excelente UX/UI de lectura (capítulos cortos, escaneables y prácticos).",
  "Cada capítulo debe ser autocontenido y entendible sin depender de otros, pero puede mencionar el 'siguiente tema' al final si aporta.",
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
  const [criteria, setCriteria] = useState(CUSTOM_TEMPLATE_CRITERIA);
  const [audience, setAudience] = useState("Estudiantes de secundaria");
  const [context, setContext] = useState("");
  const [lengthHint, setLengthHint] = useState("media");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("zse:ai:readmeMarkdown") ?? "";
    } catch {
      return "";
    }
  });
  const [readmeModelUsed, setReadmeModelUsed] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("zse:ai:readmeModelUsed");
    } catch {
      return null;
    }
  });
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [readmeFormOpen, setReadmeFormOpen] = useState(false);
  const [batchFormOpen, setBatchFormOpen] = useState(false);

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
  const [batchJson, setBatchJson] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("zse:ai:batchJson") ?? "";
    } catch {
      return "";
    }
  });
  const [batchModelUsed, setBatchModelUsed] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("zse:ai:batchModelUsed");
    } catch {
      return null;
    }
  });

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
      return false;
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
      return false;
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
        readmeTemplate,
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
        return false;
      }
      setReadmeModelUsed(typeof data?.modelUsed === "string" ? data.modelUsed : null);
      setMarkdown(typeof data?.markdown === "string" ? data.markdown : "");
      return true;
    } catch {
      setError("No fue posible generar el README.");
      return false;
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
      return false;
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
        return false;
      }
      setBatchModelUsed(typeof data?.modelUsed === "string" ? data.modelUsed : null);
      const payload = data?.payload;
      setBatchJson(payload ? JSON.stringify(payload, null, 2) : "");
      return true;
    } catch {
      setBatchError("No fue posible generar el JSON.");
      return false;
    } finally {
      setBatchLoading(false);
    }
  }

  function toggleAllowedType(type: string) {
    setAllowedQuestionTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function applyReadmeTemplate(templateId: ReadmeTemplateId) {
    if (templateId === "custom") {
      setCriteria(CUSTOM_TEMPLATE_CRITERIA);
      setLengthHint("larga");
      return;
    }
    if (templateId === "standard_detailed_v1") {
      setCriteria(STANDARD_DETAILED_TEMPLATE_CRITERIA);
      setContext((prev) => (prev.trim() ? `${STANDARD_DETAILED_TEMPLATE_CONTEXT}\n\n${prev}` : STANDARD_DETAILED_TEMPLATE_CONTEXT));
      setLengthHint("larga");
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
          <div className="lg:col-span-12">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-950">README</h2>
                  <p className="mt-1 text-sm text-zinc-600">Edición directa del Markdown generado.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReadmeFormOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Configurar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await generate();
                      if (ok) setReadmeFormOpen(false);
                    }}
                    disabled={!canGenerate}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {loading ? "Generando..." : "Generar"}
                  </button>
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
                  <button
                    type="button"
                    onClick={() => {
                      setMarkdown("");
                      setReadmeModelUsed(null);
                      setError(null);
                    }}
                    disabled={!markdown}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Limpiar
                  </button>
                </div>
              </div>

              {error ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

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
          <div className="lg:col-span-12">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-950">Batch JSON</h2>
                  <p className="mt-1 text-sm text-zinc-600">Listo para Banco → Importar.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchFormOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Configurar
                  </button>
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
                    onClick={() => {
                      setBatchJson("");
                      setBatchModelUsed(null);
                      setBatchError(null);
                    }}
                    disabled={!batchJson}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await generateQuestionBatch();
                      if (ok) setBatchFormOpen(false);
                    }}
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

              {!markdown.trim() ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  Primero genera un README para usarlo como fuente.{" "}
                  <button type="button" onClick={() => setTab("readme")} className="font-semibold underline underline-offset-2">
                    Ir a README
                  </button>
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

      <ModalShell
        open={readmeFormOpen}
        title="Configurar README"
        subtitle="Define plantilla, temas y criterios. Luego genera y verás el resultado en la vista principal."
        onClose={() => setReadmeFormOpen(false)}
      >
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3">
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
                  className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  {readmeTemplate === "custom" ? "Restablecer plantilla" : "Aplicar plantilla"}
                </button>
              </div>
              <p className="text-xs text-zinc-500">{README_TEMPLATE_OPTIONS.find((tpl) => tpl.id === readmeTemplate)?.description}</p>
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
                rows={10}
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

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <p className="text-xs text-zinc-500">
                <span className="font-semibold text-zinc-700">Gemini</span>
                {readmeModelUsed ? <span className="text-zinc-400"> · {readmeModelUsed}</span> : null}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReadmeFormOpen(false)}
                  className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await generate();
                    if (ok) setReadmeFormOpen(false);
                  }}
                  disabled={!canGenerate}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? "Generando..." : "Generar README"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={batchFormOpen}
        title="Configurar Batch JSON"
        subtitle="Selecciona materia/grupo/momento y parámetros. Luego genera el JSON."
        onClose={() => setBatchFormOpen(false)}
      >
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          {!markdown.trim() ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              Primero genera un README (se usa como fuente del batch).
            </div>
          ) : null}

          {catalogError ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
                        active ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500">Seleccionados: {allowedQuestionTypes.join(", ")}</p>
            </div>

            {batchError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{batchError}</div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBatchFormOpen(false)}
                className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await generateQuestionBatch();
                  if (ok) setBatchFormOpen(false);
                }}
                disabled={!canGenerateBatch}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {batchLoading ? "Generando..." : "Generar JSON"}
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

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
