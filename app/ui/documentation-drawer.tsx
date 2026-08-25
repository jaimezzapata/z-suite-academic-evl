"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";

type TocItem = {
  id: string;
  level: number;
  title: string;
};

type SearchLine = {
  sectionId: string | null;
  sectionTitle: string | null;
  sectionLevel: number;
  lineIndex: number;
  text: string;
};

type SearchMatch = {
  id: string;
  sectionId: string | null;
  sectionTitle: string | null;
  sectionLevel: number;
  snippet: string;
  isTitleMatch: boolean;
  order: number;
};

function slugify(text: string) {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return base || "section";
}

function buildToc(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const items: TocItem[] = [];
  const used = new Map<string, number>();
  for (const line of lines) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const level = m[1].length;
    const rawTitle = m[2].trim().replace(/\s+#+\s*$/, "");
    if (!rawTitle) continue;
    const base = slugify(rawTitle);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;
    items.push({ id, level, title: rawTitle });
  }
  return items;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stripMarkdownFormatting(line: string) {
  return line
    .replace(/^#{1,3}\s+/, "")
    .replace(/\s+#+\s*$/, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, (code) => code)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^>\s?/, "")
    .trim();
}

function buildSearchIndex(markdown: string, toc: TocItem[]): SearchLine[] {
  const lines = markdown.split(/\r?\n/);
  const result: SearchLine[] = [];
  const titleToId = new Map<string, string>();
  for (const item of toc) titleToId.set(item.title.toLowerCase(), item.id);

  let currentSectionId: string | null = null;
  let currentSectionTitle: string | null = null;
  let currentSectionLevel = 0;

  lines.forEach((raw, idx) => {
    const trimmed = raw.trim();
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const rawTitle = headingMatch[2].trim().replace(/\s+#+\s*$/, "");
      const maybeId = toc.find((t) => t.title === rawTitle)?.id ?? titleToId.get(rawTitle.toLowerCase()) ?? null;
      currentSectionId = maybeId;
      currentSectionTitle = rawTitle;
      currentSectionLevel = headingMatch[1].length;
    }
    const text = stripMarkdownFormatting(raw);
    if (text) {
      result.push({
        sectionId: currentSectionId,
        sectionTitle: currentSectionTitle,
        sectionLevel: currentSectionLevel,
        lineIndex: idx,
        text,
      });
    }
  });
  return result;
}

function searchIndex(index: SearchLine[], rawQuery: string): SearchMatch[] {
  const q = normalize(rawQuery).trim();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  const matches: SearchMatch[] = [];
  const seenLines = new Set<number>();
  let order = 0;

  const termsMatch = (text: string) =>
    terms.every((term) => normalize(text).includes(term));

  for (const line of index) {
    if (!termsMatch(line.text)) continue;
    if (line.sectionTitle && termsMatch(line.sectionTitle) && !seenLines.has(-1 - line.lineIndex)) {
      seenLines.add(-1 - line.lineIndex);
      matches.push({
        id: `title-${line.lineIndex}`,
        sectionId: line.sectionId,
        sectionTitle: line.sectionTitle,
        sectionLevel: line.sectionLevel,
        snippet: line.sectionTitle ?? line.text,
        isTitleMatch: true,
        order: order++,
      });
    }
    if (seenLines.has(line.lineIndex)) continue;
    seenLines.add(line.lineIndex);

    const norm = normalize(line.text);
    const firstIdx = norm.indexOf(terms[0]);
    const windowStart = Math.max(0, firstIdx - 40);
    const windowEnd = Math.min(line.text.length, firstIdx + q.length + 80);
    let snippet = line.text.slice(windowStart, windowEnd);
    if (windowStart > 0) snippet = `…${snippet}`;
    if (windowEnd < line.text.length) snippet = `${snippet}…`;

    matches.push({
      id: `line-${line.lineIndex}`,
      sectionId: line.sectionId,
      sectionTitle: line.sectionTitle,
      sectionLevel: line.sectionLevel,
      snippet,
      isTitleMatch: false,
      order: order++,
    });
  }
  return matches;
}

function findInContent(query: string, attempt: number): boolean {
  const finder = (window as Window & { find?: (...args: unknown[]) => boolean }).find;
  if (typeof finder !== "function") return false;
  for (let i = 0; i <= Math.max(0, attempt); i++) {
    const ok = finder(query, false, false, true, false, i < attempt, false);
    if (i === attempt && ok) return true;
  }
  return false;
}

function getMarkElements(root: HTMLElement | Document = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("mark[data-docs-highlight]"));
}

function indexMarks(root: HTMLElement | Document = document) {
  const marks = getMarkElements(root);
  marks.forEach((m, i) => m.setAttribute("data-docs-highlight-index", String(i)));
  return marks;
}

function scrollToNthHighlight(n: number, root: HTMLElement | Document = document): HTMLElement | null {
  const marks = indexMarks(root);
  const safe = Math.max(0, Math.min(marks.length - 1, n));
  const target = marks[safe];
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    // Quitar cualquier "active" anterior
    marks.forEach((m) => m.classList.remove("ring-2", "ring-amber-500"));
    target.classList.add("ring-2", "ring-amber-500");
  }
  return target ?? null;
}

function scrollToMatch(match: SearchMatch, query: string, matchIndex: number) {
  if (match.sectionId) {
    const el = document.getElementById(match.sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  window.setTimeout(() => {
    const scrolled = scrollToNthHighlight(matchIndex);
    if (scrolled) return;
    // Fallback: usar window.find si aún no hay marcas renderizadas
    const finder = (window as Window & { find?: (...args: unknown[]) => boolean }).find;
    if (typeof finder !== "function") return;
    void findInContent(query, matchIndex);
  }, 250);
}

export function DocumentationDrawer({
  open,
  title = "Documentación",
  markdown,
  onClose,
}: {
  open: boolean;
  title?: string;
  markdown: string;
  onClose: () => void;
}) {
  const toc = useMemo(() => buildToc(markdown), [markdown]);
  const docsSearchIndex = useMemo(() => buildSearchIndex(markdown, toc), [markdown, toc]);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const matches = useMemo(() => searchIndex(docsSearchIndex, search), [docsSearchIndex, search]);

  const filteredToc = useMemo(() => {
    const q = normalize(search).trim();
    if (!q) return toc;
    return toc.filter((item) => normalize(item.title).includes(q));
  }, [toc, search]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        const el = document.getElementById("docs-search-input") as HTMLInputElement | null;
        if (el) {
          e.preventDefault();
          el.focus();
          el.select();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const hasQuery = search.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/50" aria-label="Cerrar" />
      <div className="absolute inset-y-0 right-0 w-full bg-zinc-50 shadow-2xl">
        <div className="flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950">{title}</p>
            <p className="truncate text-xs text-zinc-500">Lectura guiada con navegación por secciones.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[360px_1fr]">
          <aside className="hidden overflow-y-auto border-r border-zinc-200 bg-white p-4 lg:flex lg:flex-col">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Contenido</p>
            <div className="mt-3 space-y-2">
              <div className="flex flex-col gap-1">
                <input
                  id="docs-search-input"
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar en toda la documentación…"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
                {hasQuery ? (
                  <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500">
                    <span>
                      {matches.length ? `${matches.length} coincidencia${matches.length === 1 ? "" : "s"}` : "Sin coincidencias"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        searchRef.current?.focus();
                      }}
                      className="rounded-md px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-100"
                    >
                      Limpiar
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <nav className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {hasQuery ? (
                matches.length ? (
                  <div className="space-y-1">
                    {matches.map((match, idx) => (
                      <button
                        key={match.id}
                        type="button"
                        onClick={() => scrollToMatch(match, search.trim(), idx)}
                        className="group w-full rounded-xl border border-transparent px-3 py-2 text-left text-sm text-zinc-800 hover:border-zinc-200 hover:bg-zinc-50"
                      >
                        {match.sectionTitle ? (
                          <div className={`truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${match.sectionLevel === 1 ? "" : match.sectionLevel === 2 ? "pl-3" : "pl-5"}`}>
                            {match.sectionTitle}
                          </div>
                        ) : null}
                        <div className={`mt-0.5 text-zinc-800 ${match.sectionLevel === 1 ? "" : match.sectionLevel === 2 ? "pl-3" : "pl-5"} ${match.isTitleMatch ? "font-semibold" : ""}`}>
                          {match.snippet}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                    <p className="text-sm font-semibold text-zinc-800">Sin coincidencias en el contenido</p>
                    <p className="text-xs text-zinc-600">
                      Intenta con una palabra más corta, o usa términos que aparezcan en el texto del README.
                    </p>
                  </div>
                )
              ) : filteredToc.length ? (
                filteredToc.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(item.id);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50 ${
                      item.level === 1 ? "font-semibold" : item.level === 2 ? "pl-4" : "pl-6"
                    }`}
                  >
                    {item.title}
                  </button>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No hay títulos detectables en el README.</p>
              )}
            </nav>
          </aside>

          <main className="overflow-y-auto px-4 py-5 lg:px-8">
            <div className="w-full rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm lg:p-8">
              <MarkdownViewer markdown={markdown} highlightQuery={search} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
