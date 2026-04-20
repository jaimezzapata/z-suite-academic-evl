"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { BookOpen, KeyRound, ArrowRight, LibraryBig, RefreshCcw } from "lucide-react";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";
import { motion, AnimatePresence } from "framer-motion";

type StudyDocPayload = {
  slug: string;
  title: string;
  subjectId: string;
  subjectName: string;
  markdown: string;
  sessionDays: number;
};

function getSessionKey(slug: string) {
  return `zse:study:session:${slug}`;
}

export default function StudyDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<StudyDocPayload | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scroll = `${totalScroll / windowHeight}`;
      setScrollProgress(Number(scroll));
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const accessWithCode = useCallback(
    async (candidateCode: string) => {
      if (!candidateCode.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/study/access", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, code: candidateCode.trim() }),
        });
        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : "No fue posible acceder a la documentación.");
          return;
        }
        const payload: StudyDocPayload = {
          slug: typeof data?.slug === "string" ? data.slug : slug,
          title: typeof data?.title === "string" ? data.title : "Documentación",
          subjectId: typeof data?.subjectId === "string" ? data.subjectId : "",
          subjectName: typeof data?.subjectName === "string" ? data.subjectName : "Materia",
          markdown: typeof data?.markdown === "string" ? data.markdown : "",
          sessionDays:
            typeof data?.sessionDays === "number" && Number.isFinite(data.sessionDays)
              ? Math.max(1, Math.min(365, Math.floor(data.sessionDays)))
              : 90,
        };
        setDoc(payload);
        const expiresAt = Date.now() + payload.sessionDays * 24 * 60 * 60 * 1000;
        localStorage.setItem(getSessionKey(slug), JSON.stringify({ code: candidateCode.trim(), expiresAt }));
      } catch {
        setError("No fue posible acceder a la documentación.");
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getSessionKey(slug));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code?: string; expiresAt?: number };
      if (!parsed?.code || typeof parsed.code !== "string") return;
      const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0;
      if (!expiresAt || Date.now() > expiresAt) {
        localStorage.removeItem(getSessionKey(slug));
        return;
      }
      setCode(parsed.code);
      void accessWithCode(parsed.code);
    } catch {}
  }, [accessWithCode, slug]);

  const pageTitle = useMemo(() => doc?.title || "Consulta de documentación", [doc?.title]);

  const sections = useMemo(() => {
    const markdown = doc?.markdown?.trim();
    if (!markdown) return [] as Array<{ title: string; body: string }>;

    const rx = /---\n\n## ([^\n]+)\n\n([\s\S]*?)(?=\n---\n\n## |\s*$)/g;
    const out: Array<{ title: string; body: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = rx.exec(markdown)) !== null) {
      const title = (match[1] ?? "").trim();
      if (!title) continue;
      if (title.toLowerCase() === "tabla de contenidos") continue;
      const body = (match[2] ?? "").trim();
      out.push({ title, body });
    }

    if (!out.length) return [{ title: pageTitle, body: markdown }];
    return out;
  }, [doc?.markdown, pageTitle]);

  useEffect(() => {
    if (!sections.length) return;
    setActiveSection((prev) => Math.min(Math.max(0, prev), sections.length - 1));
  }, [sections.length]);

  if (doc) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        {/* Progress bar */}
        <div
          className="fixed left-0 top-0 z-50 h-1 bg-indigo-600 transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress * 100}%` }}
        />

        <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[800px] items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/50">
                <LibraryBig className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-zinc-900">{pageTitle}</p>
                <p className="truncate text-xs font-medium text-zinc-500">{doc.subjectName}</p>
              </div>
            </div>
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
        </header>

        <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:py-14">
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="prose-zinc max-w-none"
          >
            {sections.length ? (
              <div className="not-prose grid gap-8 lg:grid-cols-[280px_1fr]">
                <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-140px)]">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-zinc-900">Navegación</p>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                        {sections.length}
                      </span>
                    </div>
                    <div className="mt-3 max-h-[calc(100vh-220px)] space-y-2 overflow-auto pr-1">
                      {sections.map((s, idx) => {
                        const active = idx === activeSection;
                        return (
                          <button
                            key={`${idx}-${s.title}`}
                            type="button"
                            onClick={() => {
                              setActiveSection(idx);
                              requestAnimationFrame(() => {
                                document.getElementById(`sec-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                              });
                            }}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                              active
                                ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                            }`}
                          >
                            {s.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </aside>

                <div className="space-y-4">
                  {sections.map((s, idx) => {
                    const open = idx === activeSection;
                    return (
                      <div
                        key={`${idx}-${s.title}`}
                        id={`sec-${idx}`}
                        className="rounded-2xl border border-zinc-200 bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => setActiveSection((prev) => (prev === idx ? -1 : idx))}
                          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-zinc-900">{s.title}</p>
                            <p className="mt-1 text-xs text-zinc-500">Abrir contenido</p>
                          </div>
                          <div
                            className={`h-9 w-9 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-700 transition ${
                              open ? "rotate-180" : ""
                            } grid place-items-center`}
                          >
                            ▾
                          </div>
                        </button>
                        <AnimatePresence initial={false}>
                          {open ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-zinc-200 px-5 py-5">
                                <MarkdownViewer markdown={`## ${s.title}\n\n${s.body}`} idPrefix={`sec-${idx}`} />
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <BookOpen className="mb-4 h-12 w-12 text-zinc-300" />
                <p className="text-base font-medium text-zinc-500">Este documento no tiene contenido aún.</p>
              </div>
            )}
          </motion.article>
        </main>
      </div>
    );
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-[#FAFAFA] px-4 overflow-hidden">
      {/* Background decoration */}
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
          <p className="mt-2 text-[15px] text-zinc-500">Ingresa tu código de estudiante para consultar la documentación de esta materia.</p>
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
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
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
                Acceder al contenido
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
