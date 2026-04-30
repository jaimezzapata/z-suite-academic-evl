"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import { ArrowLeft, ArrowRight, KeyRound, LibraryBig, RefreshCcw } from "lucide-react";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";
import { motion, AnimatePresence } from "framer-motion";

type ChapterItem = { id: string; index: number; title: string };

type StudyChapterPayload = {
  slug: string;
  title: string;
  subjectName: string;
  institution: string;
  siteName: string;
  shiftName: string;
  groupName: string;
  docKind: string;
  chapters: ChapterItem[];
  chapter: { id: string; index: number; title: string; markdown: string } | null;
  sessionDays: number;
};

function getSessionKey(slug: string) {
  return `zse:study:session:${slug}`;
}

function normalizeAccessCode(input: string) {
  return input.trim().replace(/\D/g, "").slice(0, 6);
}

function readChapterValue(value: unknown, fallbackId: string) {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    id: typeof r.id === "string" ? r.id : fallbackId,
    index: typeof r.index === "number" && Number.isFinite(r.index) ? Math.floor(r.index) : 0,
    title: typeof r.title === "string" ? r.title : "",
    markdown: typeof r.markdown === "string" ? r.markdown : "",
  };
}

export default function StudyChapterPage({ params }: { params: Promise<{ slug: string; entryId: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const entryId = resolvedParams.entryId;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<StudyChapterPayload | null>(null);
  const autoTriedRef = useRef(false);

  const accessWithCode = useCallback(
    async (candidateCode: string) => {
      const norm = normalizeAccessCode(candidateCode);
      if (!norm) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/study/access", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, code: norm, entryId }),
        });
        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : "No fue posible acceder al capítulo.");
          return;
        }
        const payload: StudyChapterPayload = {
          slug: typeof data?.slug === "string" ? data.slug : slug,
          title: typeof data?.title === "string" ? data.title : "Documentación",
          subjectName: typeof data?.subjectName === "string" ? data.subjectName : "Materia",
          institution: typeof data?.institution === "string" ? data.institution : "",
          siteName: typeof data?.siteName === "string" ? data.siteName : "",
          shiftName: typeof data?.shiftName === "string" ? data.shiftName : "",
          groupName: typeof data?.groupName === "string" ? data.groupName : "",
          docKind: typeof data?.docKind === "string" ? data.docKind : "",
          chapters: Array.isArray(data?.chapters)
            ? (data?.chapters as unknown[])
                .map((c) => {
                  const r = (c ?? {}) as Record<string, unknown>;
                  return {
                    id: typeof r.id === "string" ? r.id : "",
                    index: typeof r.index === "number" && Number.isFinite(r.index) ? Math.floor(r.index) : 0,
                    title: typeof r.title === "string" ? r.title : "",
                  } satisfies ChapterItem;
                })
                .filter((c) => c.id && c.index >= 1 && c.title)
            : [],
          chapter: data?.chapter ? readChapterValue(data.chapter, entryId) : null,
          sessionDays:
            typeof data?.sessionDays === "number" && Number.isFinite(data.sessionDays)
              ? Math.max(1, Math.min(365, Math.floor(data.sessionDays)))
              : 90,
        };
        setDoc(payload);
        const expiresAt = Date.now() + payload.sessionDays * 24 * 60 * 60 * 1000;
        localStorage.setItem(getSessionKey(slug), JSON.stringify({ code: norm, expiresAt }));
      } catch {
        setError("No fue posible acceder al capítulo.");
      } finally {
        setLoading(false);
      }
    },
    [entryId, slug],
  );

  function useSavedCode() {
    try {
      const raw = localStorage.getItem(getSessionKey(slug));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code?: string; expiresAt?: number };
      const saved = typeof parsed.code === "string" ? parsed.code : "";
      const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0;
      if (!saved || !expiresAt || Date.now() > expiresAt) return;
      setCode(saved);
      void accessWithCode(saved);
    } catch {}
  }

  useEffect(() => {
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;
    try {
      const url = new URL(window.location.href);
      const fromUrl = normalizeAccessCode(url.searchParams.get("code") ?? "");
      if (fromUrl) {
        setCode(fromUrl);
        void accessWithCode(fromUrl);
        return;
      }
    } catch {}
    useSavedCode();
  }, [slug, entryId, accessWithCode]);

  const activeChapter = doc?.chapter;
  const ordered = useMemo(() => doc?.chapters ?? [], [doc?.chapters]);
  const activeIndex = useMemo(() => ordered.findIndex((c) => c.id === entryId), [entryId, ordered]);
  const prev = activeIndex > 0 ? ordered[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < ordered.length - 1 ? ordered[activeIndex + 1] : null;

  if (doc && activeChapter) {
    const chips = [doc.institution, doc.siteName, doc.shiftName, doc.groupName, doc.subjectName].filter(Boolean);
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl">
          <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/50">
                <LibraryBig className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-zinc-900">{doc.title}</p>
                <p className="truncate text-xs font-medium text-zinc-500">
                  Capítulo {activeChapter.index}: {activeChapter.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/study/${slug}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Índice
              </Link>
              <button
                type="button"
                onClick={() => void accessWithCode(code)}
                disabled={!code.trim() || loading}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Actualizar"
                title="Actualizar"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        <main className="w-full px-4 py-6 sm:px-6 lg:px-10">
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="xl:sticky xl:top-24 xl:h-[calc(100dvh-140px)]">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cuadernillo</p>
                <p className="mt-1 text-sm font-bold text-zinc-900">{doc.title}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {chips.map((c) => (
                    <span key={c} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600">
                      {c}
                    </span>
                  ))}
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-zinc-500">Navegación</p>
                  <div className="mt-2 max-h-[calc(100dvh-320px)] space-y-2 overflow-auto pr-1 xl:max-h-[calc(100dvh-320px)]">
                    {ordered.map((c) => {
                      const active = c.id === entryId;
                      return (
                        <Link
                          key={c.id}
                          href={`/study/${slug}/${c.id}`}
                          className={`block rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                            active ? "border-indigo-200 bg-indigo-50 text-indigo-800" : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                          }`}
                        >
                          <span className="text-xs font-semibold text-zinc-500">C{c.index}</span>
                          <span className="ml-2">{c.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>

            <section className="min-w-0 space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-500">Capítulo {activeChapter.index}</p>
                    <p className="truncate text-base font-bold text-zinc-900">{activeChapter.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {prev ? (
                      <Link
                        href={`/study/${slug}/${prev.id}`}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Anterior
                      </Link>
                    ) : null}
                    {next ? (
                      <Link
                        href={`/study/${slug}/${next.id}`}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800"
                      >
                        Siguiente
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="px-5 py-5">
                  <MarkdownViewer markdown={activeChapter.markdown} idPrefix={`chapter-${activeChapter.id}`} />
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-[#FAFAFA] px-4 overflow-hidden">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white/70 p-8 shadow-xl shadow-zinc-200/50 backdrop-blur-xl"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-4 ring-indigo-50">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Acceso a material</h1>
          <p className="mt-2 text-[15px] text-zinc-500">Ingresa tu código para consultar este cuadernillo.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void accessWithCode(code);
          }}
          className="grid gap-5"
        >
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Código de acceso</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 text-center text-2xl font-semibold tracking-[0.5em] text-zinc-900 shadow-sm outline-none transition-all placeholder:text-zinc-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              autoFocus
            />
          </label>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={!code.trim() || loading}
            className="group relative mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-[15px] font-semibold text-white shadow-md transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-900"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin text-white/70" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Validando...
              </span>
            ) : (
              <>
                Acceder al capítulo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={useSavedCode}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Usar código guardado
          </button>
        </form>
      </motion.div>
    </div>
  );
}
