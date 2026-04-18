"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";

type TocItem = {
  id: string;
  level: number;
  title: string;
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
  const [search, setSearch] = useState("");
  const filteredToc = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return toc;
    return toc.filter((item) => item.title.toLowerCase().includes(q));
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/50" aria-label="Cerrar" />
      <div className="absolute inset-y-0 right-0 w-full bg-white shadow-2xl">
        <div className="flex h-14 items-center justify-between gap-3 border-b border-zinc-200 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950">{title}</p>
            <p className="truncate text-xs text-zinc-500">Usa la navegación para ir a secciones.</p>
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

        <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[320px_1fr]">
          <aside className="hidden overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Contenido</p>
            <div className="mt-3 space-y-2">
              <input
                id="docs-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar sección..."
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
              <button
                type="button"
                onClick={() => {
                  const q = search.trim();
                  if (!q) return;
                  const finder = (window as Window & { find?: (...args: unknown[]) => boolean }).find;
                  if (typeof finder === "function") {
                    finder(q, false, false, true, false, false, false);
                  }
                }}
                className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Buscar en texto
              </button>
            </div>
            <nav className="mt-3 space-y-1">
              {filteredToc.length ? (
                filteredToc.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(item.id);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-800 hover:bg-white ${
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
            <div className="mx-auto w-full max-w-4xl">
              <MarkdownViewer markdown={markdown} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
