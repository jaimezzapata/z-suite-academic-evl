"use client";

import type { ComponentType, ReactNode } from "react";
import { useMemo, useState, useEffect } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import {
  Atom,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Braces,
  Coffee,
  Copy,
  Database,
  ExternalLink,
  FileCode2,
  Kanban,
  LayoutGrid,
  Plus,
  RefreshCw,
  Rows3,
  Save,
  Search,
  Terminal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { firebaseAuth, firestore } from "@/lib/firebase/client";

type CatalogItem = { id: string; name: string };

type ChapterDraft = {
  title: string;
  markdown: string;
};

type BookletRow = {
  id: string;
  title: string;
  slug: string;
  accessCode: string;
  institution: string;
  siteName: string;
  shiftName: string;
  groupName: string;
  subjectName: string;
  chaptersCount: number;
  active: boolean;
};

type ChapterRow = {
  id: string;
  index: number;
  title: string;
};

function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function inferTitleFromMarkdown(markdown: string, fallback: string) {
  const m = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (m?.[1]?.trim()) return m[1].trim();
  return fallback;
}

function slugifyName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function normalizeKey(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type CoverTheme = {
  key: string;
  label: string;
  coverClass: string;
  iconBgClass: string;
  iconFgClass: string;
  watermarkClass: string;
  Icon: ComponentType<{ className?: string }>;
};

function getCoverTheme(subjectNameOrTitle: string): CoverTheme {
  const k = normalizeKey(subjectNameOrTitle);
  if (k.includes("web 2") || k.includes("front 2") || k.includes("react")) {
    return {
      key: "react",
      label: "React",
      coverClass: "bg-[#0ea5e9]",
      iconBgClass: "bg-white/15",
      iconFgClass: "text-white",
      watermarkClass: "text-white/20",
      Icon: Atom,
    };
  }
  if (
    k.includes("web 1") ||
    k.includes("front 1") ||
    k.includes("programacion javascript") ||
    k.includes("programación javascript") ||
    k.includes("javascript") ||
    k.includes("java script") ||
    k.includes(" js")
  ) {
    return {
      key: "js",
      label: "JavaScript",
      coverClass: "bg-[#f7df1e]",
      iconBgClass: "bg-black/10",
      iconFgClass: "text-black/85",
      watermarkClass: "text-black/20",
      Icon: Braces,
    };
  }
  if (k.includes("introduccion") || k.includes("introducción") || k.includes("html") || k.includes("css")) {
    return {
      key: "htmlcss",
      label: "HTML & CSS",
      coverClass: "bg-gradient-to-br from-orange-500 to-sky-600",
      iconBgClass: "bg-white/15",
      iconFgClass: "text-white",
      watermarkClass: "text-white/18",
      Icon: FileCode2,
    };
  }
  if (k.includes("fundamentos") || k.includes("python")) {
    return {
      key: "python",
      label: "Python",
      coverClass: "bg-gradient-to-br from-blue-700 to-yellow-400",
      iconBgClass: "bg-white/15",
      iconFgClass: "text-white",
      watermarkClass: "text-white/18",
      Icon: Terminal,
    };
  }
  if (k.includes("bases de datos") || k.includes("sql") || k.includes("database")) {
    return {
      key: "sql",
      label: "SQL",
      coverClass: "bg-gradient-to-br from-emerald-600 to-teal-600",
      iconBgClass: "bg-white/15",
      iconFgClass: "text-white",
      watermarkClass: "text-white/18",
      Icon: Database,
    };
  }
  if (k.includes("logica") || k.includes("lógica") || (k.includes("java") && !k.includes("javascript"))) {
    return {
      key: "java",
      label: "Java",
      coverClass: "bg-gradient-to-br from-red-600 to-orange-500",
      iconBgClass: "bg-white/15",
      iconFgClass: "text-white",
      watermarkClass: "text-white/18",
      Icon: Coffee,
    };
  }
  if (k.includes("metodologias") || k.includes("metodologías") || k.includes("scrum") || k.includes("agil")) {
    return {
      key: "scrum",
      label: "Scrum",
      coverClass: "bg-gradient-to-br from-violet-600 to-rose-500",
      iconBgClass: "bg-white/15",
      iconFgClass: "text-white",
      watermarkClass: "text-white/18",
      Icon: Kanban,
    };
  }
  return {
    key: "default",
    label: "Cuadernillo",
    coverClass: "bg-gradient-to-br from-zinc-700 to-zinc-900",
    iconBgClass: "bg-white/12",
    iconFgClass: "text-white",
    watermarkClass: "text-white/18",
    Icon: BookOpen,
  };
}

function BookletCover({ title, subtitle }: { title: string; subtitle: string }) {
  const theme = getCoverTheme(`${title} ${subtitle}`);
  const Icon = theme.Icon;
  return (
    <div className={`relative overflow-hidden rounded-3xl ${theme.coverClass}`}>
      <Icon className={`pointer-events-none absolute -right-10 -bottom-12 h-56 w-56 ${theme.watermarkClass}`} />
      <div className="relative p-6">
        <div className="rounded-3xl bg-white/25 p-5 shadow-sm ring-1 ring-black/10 backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-black/55">{theme.label}</p>
          <p className="mt-3 max-h-[46px] overflow-hidden text-[18px] font-semibold leading-snug text-black/85">{title}</p>
          <p className="mt-1 truncate text-sm font-medium text-black/60">{subtitle}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-semibold text-black/70">Cuadernillo</span>
            <div className={`grid h-10 w-10 place-items-center rounded-2xl ${theme.iconBgClass}`}>
              <Icon className={`h-5 w-5 ${theme.iconFgClass}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs text-foreground/55">Optimiza el espacio trabajando en modal.</p>
          </div>
          <button type="button" onClick={onClose} className="zs-btn-secondary h-9 w-9 px-0" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminGroupsBookletsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [fichas, setFichas] = useState<CatalogItem[]>([]);
  const [sites, setSites] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);
  const [booklets, setBooklets] = useState<BookletRow[]>([]);

  const [institution, setInstitution] = useState<"CESDE" | "SENA">("CESDE");
  const [siteId, setSiteId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [fichaId, setFichaId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [sessionDays, setSessionDays] = useState(180);
  const [chapterTitle, setChapterTitle] = useState("Introducción");
  const [chapterMarkdown, setChapterMarkdown] = useState("");
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [appendDocId, setAppendDocId] = useState("");
  const [appendTitle, setAppendTitle] = useState("");
  const [appendMarkdown, setAppendMarkdown] = useState("");
  const [appendModalOpen, setAppendModalOpen] = useState(false);

  const [manageDocId, setManageDocId] = useState("");
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageChapters, setManageChapters] = useState<ChapterRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [subjectsSnap, groupsSnap, fichasSnap, sitesSnap, shiftsSnap, docsSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(300))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(300))),
          getDocs(query(collection(firestore, "fichas"), orderBy("name"), limit(800))),
          getDocs(query(collection(firestore, "sites"), orderBy("name"), limit(100))),
          getDocs(query(collection(firestore, "shifts"), orderBy("name"), limit(100))),
          getDocs(query(collection(firestore, "studyDocs"), where("active", "==", true), limit(800))),
        ]);
        if (cancelled) return;
        setSubjects(subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setGroups(groupsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setFichas(fichasSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setSites(sitesSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setShifts(shiftsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        const rows = docsSnap.docs
          .map((d) => {
            const row = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              title: toString(row.title, "Cuadernillo"),
              slug: toString(row.slug, ""),
              accessCode: toString(row.accessCode, ""),
              institution: toString(row.institution, ""),
              siteName: toString(row.siteName, toString(row.siteId, "-")),
              shiftName: toString(row.shiftName, toString(row.shiftId, "-")),
              groupName: toString(row.groupName, toString(row.groupId, "-")),
              subjectName: toString(row.subjectName, toString(row.subjectId, "-")),
              chaptersCount: toNumber(row.chaptersCount, toNumber(row.cutoffWeek, 0)),
              active: row.active === true,
              docKind: toString(row.docKind, ""),
            };
          })
          .filter((r) => r.docKind === "booklet")
          .map((r) => ({
            id: r.id,
            title: r.title,
            slug: r.slug,
            accessCode: r.accessCode,
            institution: r.institution,
            siteName: r.siteName,
            shiftName: r.shiftName,
            groupName: r.groupName,
            subjectName: r.subjectName,
            chaptersCount: r.chaptersCount,
            active: r.active,
          }))
          .sort((a, b) => b.title.localeCompare(a.title));
        setBooklets(rows);
      } catch {
        if (!cancelled) setError("No fue posible cargar catálogos o cuadernillos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadManageChapters(docId: string) {
    setManageLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(firestore, "studyDocs", docId, "entries"), orderBy("weekIndex"), limit(300)),
      );
      const rows = snap.docs
        .map((d) => {
          const r = d.data() as Record<string, unknown>;
          const idx = toNumber(r.weekIndex, 0);
          const title = toString(r.title, "").trim() || `Capítulo ${idx || d.id}`;
          return { id: d.id, index: idx, title };
        })
        .filter((x) => x.index >= 1)
        .sort((a, b) => a.index - b.index);
      setManageChapters(rows);
    } catch {
      setError("No fue posible cargar capítulos del cuadernillo.");
    } finally {
      setManageLoading(false);
    }
  }

  async function saveManageOrder() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    if (!manageDocId || manageChapters.length < 1) return;
    setManageSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/booklets/reorder-chapters", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ docId: manageDocId, orderedIds: manageChapters.map((c) => c.id) }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `No fue posible guardar el orden (HTTP ${res.status}).`);
        return;
      }
      const nextCount = toNumber(data?.chaptersCount, manageChapters.length);
      setBooklets((prev) => prev.map((b) => (b.id === manageDocId ? { ...b, chaptersCount: nextCount } : b)));
      setSuccess("Orden actualizado.");
      await loadManageChapters(manageDocId);
    } catch {
      setError("No fue posible guardar el orden.");
    } finally {
      setManageSaving(false);
    }
  }

  async function deleteManageChapter(entryId: string) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    if (!manageDocId) return;
    const ok = window.confirm("¿Eliminar este capítulo? Esta acción renumera el cuadernillo.");
    if (!ok) return;
    setManageSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/booklets/delete-chapter", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ docId: manageDocId, entryId }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `No fue posible eliminar (HTTP ${res.status}).`);
        return;
      }
      const nextCount = toNumber(data?.chaptersCount, Math.max(0, manageChapters.length - 1));
      setBooklets((prev) => prev.map((b) => (b.id === manageDocId ? { ...b, chaptersCount: nextCount } : b)));
      setSuccess("Capítulo eliminado.");
      await loadManageChapters(manageDocId);
    } catch {
      setError("No fue posible eliminar el capítulo.");
    } finally {
      setManageSaving(false);
    }
  }

  const canCreate = useMemo(() => {
    const segmentOk = institution === "SENA" ? !!fichaId : !!groupId;
    return !!siteId && !!shiftId && segmentOk && !!subjectId && chapters.length > 0 && !saving;
  }, [siteId, shiftId, groupId, fichaId, subjectId, chapters.length, saving, institution]);

  const filteredBooklets = useMemo(() => {
    const q = normalizeKey(search);
    if (!q) return booklets;
    return booklets.filter((b) => {
      const hay = normalizeKey(`${b.title} ${b.subjectName} ${b.groupName} ${b.siteName} ${b.shiftName} ${b.institution} ${b.accessCode}`);
      return hay.includes(q);
    });
  }, [booklets, search]);

  const previewSubjectName = useMemo(() => {
    const s = subjects.find((x) => x.id === subjectId);
    return s?.name ?? "";
  }, [subjects, subjectId]);

  const previewGroupName = useMemo(() => {
    if (institution === "SENA") {
      const f = fichas.find((x) => x.id === fichaId);
      return f?.name ?? "";
    }
    const g = groups.find((x) => x.id === groupId);
    return g?.name ?? "";
  }, [groups, groupId, institution, fichas, fichaId]);

  function addChapterDraft() {
    const md = chapterMarkdown.trim();
    if (!md) return;
    const fallback = `Capítulo ${chapters.length + 1}`;
    const finalTitle = chapterTitle.trim() || inferTitleFromMarkdown(md, fallback);
    setChapters((prev) => [...prev, { title: finalTitle, markdown: md }]);
    setChapterTitle(`Capítulo ${chapters.length + 2}`);
    setChapterMarkdown("");
  }

  async function loadMarkdownFiles(files: FileList | null, target: "create" | "append") {
    if (!files?.length) return;
    const next: ChapterDraft[] = [];
    for (const file of Array.from(files)) {
      const md = (await file.text()).trim();
      if (!md) continue;
      const baseName = slugifyName(file.name);
      const titleFromMd = inferTitleFromMarkdown(md, baseName || "Capítulo");
      next.push({ title: titleFromMd, markdown: md });
    }
    if (!next.length) return;

    if (target === "create") {
      setChapters((prev) => [...prev, ...next]);
    } else {
      const first = next[0];
      if (!first) return;
      setAppendTitle(first.title);
      setAppendMarkdown(first.markdown);
    }
  }

  async function createBooklet() {
    if (!canCreate) return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como administrador.");
      return;
    }
    const segmentId = institution === "SENA" ? fichaId : groupId;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/booklets/create", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          institution,
          siteId,
          shiftId,
          groupId: segmentId,
          subjectId,
          title: title.trim(),
          sessionDays,
          chapters,
        }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `No fue posible crear (HTTP ${res.status}).`);
        return;
      }
      const slug = typeof data?.slug === "string" ? data.slug : "";
      const code = typeof data?.accessCode === "string" ? data.accessCode : "";
      setSuccess(`Cuadernillo creado. URL: /study/${slug} · Código: ${code}`);
      setCreateModalOpen(false);
      window.location.reload();
    } catch {
      setError("No fue posible crear el cuadernillo.");
    } finally {
      setSaving(false);
    }
  }

  async function appendChapter() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como administrador.");
      return;
    }
    if (!appendDocId || !appendTitle.trim() || !appendMarkdown.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/booklets/append-chapter", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          docId: appendDocId,
          title: appendTitle.trim(),
          markdown: appendMarkdown.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `No fue posible agregar capítulo (HTTP ${res.status}).`);
        return;
      }
      setAppendModalOpen(false);
      setAppendDocId("");
      setAppendTitle("");
      setAppendMarkdown("");
      setSuccess("Capítulo agregado correctamente.");
      window.location.reload();
    } catch {
      setError("No fue posible agregar el capítulo.");
    } finally {
      setSaving(false);
    }
  }

  async function removeBooklet(docId: string) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Debes iniciar sesión como admin.");
      return;
    }
    const ok = window.confirm("¿Eliminar este cuadernillo y todos sus capítulos?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/docs/delete", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ docId }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `No fue posible eliminar (HTTP ${res.status}).`);
        return;
      }
      setBooklets((prev) => prev.filter((b) => b.id !== docId));
      setSuccess("Cuadernillo eliminado.");
    } catch {
      setError("No fue posible eliminar el cuadernillo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="zs-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Grupos · Cuadernillos</h1>
            <p className="mt-1 text-sm text-foreground/65">
              Crea cuadernillos por institución/sede/jornada/grupo/materia y publícalos por código.
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setCreateModalOpen(true)} className="zs-btn-primary h-10">
              <Plus className="h-4 w-4" />
              Crear cuadernillo
            </button>
            <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-white">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold ${
                  viewMode === "cards" ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"
                }`}
                aria-label="Vista tarjetas"
                title="Vista tarjetas"
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex h-10 items-center gap-2 border-l border-border px-3 text-sm font-semibold ${
                  viewMode === "table" ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"
                }`}
                aria-label="Vista tabla"
                title="Vista tabla"
              >
                <Rows3 className="h-4 w-4" />
                Tabla
              </button>
            </div>
          </div>

          <label className="relative w-full sm:w-[340px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="zs-input h-10 w-full pl-9"
              placeholder="Buscar cuadernillos..."
            />
          </label>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        {success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
      </section>

      <section className="zs-card p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Cuadernillos</h2>
            <p className="mt-1 text-xs text-foreground/55">{loading ? "Cargando..." : `${filteredBooklets.length} cuadernillos`}</p>
          </div>
          <button type="button" onClick={() => window.location.reload()} className="zs-btn-secondary h-9">
            <RefreshCw className="h-4 w-4" />
            Recargar
          </button>
        </div>

        {viewMode === "cards" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredBooklets.map((b) => (
              <div key={b.id} className="zs-card overflow-hidden">
                <BookletCover title={b.title} subtitle={b.subjectName} />
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2 py-1 font-semibold text-foreground/70">{b.institution}</span>
                    <span className="rounded-full bg-muted px-2 py-1 font-semibold text-foreground/70">{b.siteName}</span>
                    <span className="rounded-full bg-muted px-2 py-1 font-semibold text-foreground/70">{b.shiftName}</span>
                    <span className="rounded-full bg-muted px-2 py-1 font-semibold text-foreground/70">{b.groupName}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground/55">Código</p>
                      <p className="truncate font-mono text-sm font-semibold tracking-wider text-foreground">{b.accessCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-foreground/55">Capítulos</p>
                      <p className="text-sm font-semibold text-foreground">{b.chaptersCount}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <a href={`/study/${b.slug}`} target="_blank" rel="noreferrer" className="zs-btn-secondary h-9 px-3">
                      <ExternalLink className="h-4 w-4" />
                      Abrir
                    </a>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/study/${b.slug}`)}
                      className="zs-btn-secondary h-9 px-3"
                      title="Copiar URL"
                    >
                      <Copy className="h-4 w-4" />
                      URL
                    </button>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(b.accessCode)}
                      className="zs-btn-secondary h-9 px-3"
                      title="Copiar código"
                    >
                      <Copy className="h-4 w-4" />
                      Código
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAppendDocId(b.id);
                        setAppendTitle(`Capítulo ${Math.max(1, b.chaptersCount + 1)}`);
                        setAppendMarkdown("");
                        setAppendModalOpen(true);
                      }}
                      className="zs-btn-primary h-9 px-3"
                      title="Agregar capítulo"
                    >
                      <Plus className="h-4 w-4" />
                      Capítulo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManageDocId(b.id);
                        setManageModalOpen(true);
                        void loadManageChapters(b.id);
                      }}
                      className="zs-btn-secondary h-9 px-3"
                      title="Gestionar capítulos"
                    >
                      <Rows3 className="h-4 w-4" />
                      Gestionar
                    </button>
                    <button type="button" onClick={() => void removeBooklet(b.id)} className="zs-btn-danger-soft h-9 px-3" title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!filteredBooklets.length ? (
              <div className="zs-card-muted col-span-full px-3 py-10 text-center text-sm text-foreground/55">
                {loading ? "Cargando..." : "No hay cuadernillos con ese filtro."}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="min-w-[980px] w-full">
              <thead className="bg-muted/40 text-xs text-foreground/60">
                <tr>
                  <th className="w-[380px] px-3 py-2 text-left font-semibold">Cuadernillo</th>
                  <th className="w-[260px] px-3 py-2 text-left font-semibold">Segmentación</th>
                  <th className="w-[80px] px-3 py-2 text-left font-semibold whitespace-nowrap">Cap.</th>
                  <th className="w-[120px] px-3 py-2 text-left font-semibold whitespace-nowrap">Código</th>
                  <th className="w-[240px] px-3 py-2 text-right font-semibold whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooklets.map((b) => {
                  const theme = getCoverTheme(`${b.title} ${b.subjectName}`);
                  const Icon = theme.Icon;
                  return (
                    <tr key={b.id} className="border-t border-border text-sm">
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-3">
                          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${theme.coverClass}`}>
                            <Icon className={`h-5 w-5 ${theme.iconFgClass}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{b.title}</p>
                            <p className="truncate text-xs text-foreground/55">{b.subjectName}</p>
                            <p className="truncate text-xs text-foreground/55">/study/{b.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-foreground/70">
                        <p>{b.institution}</p>
                        <p>{b.siteName}</p>
                        <p>{b.shiftName}</p>
                        <p>{b.groupName}</p>
                      </td>
                      <td className="px-3 py-3 align-top text-sm font-semibold text-foreground">{b.chaptersCount}</td>
                      <td className="px-3 py-3 align-top font-mono text-sm tracking-wider text-foreground">{b.accessCode}</td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`/study/${b.slug}`} target="_blank" rel="noreferrer" className="zs-btn-secondary h-8 px-2">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/study/${b.slug}`)}
                            className="zs-btn-secondary h-8 px-2"
                            title="Copiar URL"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(b.accessCode)}
                            className="zs-btn-secondary h-8 px-2"
                            title="Copiar código"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAppendDocId(b.id);
                              setAppendTitle(`Capítulo ${Math.max(1, b.chaptersCount + 1)}`);
                              setAppendMarkdown("");
                              setAppendModalOpen(true);
                            }}
                            className="zs-btn-primary h-8 px-2"
                            title="Agregar capítulo"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setManageDocId(b.id);
                              setManageModalOpen(true);
                              void loadManageChapters(b.id);
                            }}
                            className="zs-btn-secondary h-8 px-2"
                            title="Gestionar capítulos"
                          >
                            <Rows3 className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => void removeBooklet(b.id)} className="zs-btn-danger-soft h-8 px-2" title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredBooklets.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-foreground/55">
                      {loading ? "Cargando..." : "No hay cuadernillos con ese filtro."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createModalOpen ? (
        <ModalShell title="Crear cuadernillo" onClose={() => setCreateModalOpen(false)}>
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <div className="space-y-3">
              <BookletCover
                title={title.trim() || (previewSubjectName ? `${previewSubjectName}${previewGroupName ? ` · ${previewGroupName}` : ""}` : "Nuevo cuadernillo")}
                subtitle={previewSubjectName || "Selecciona una materia"}
              />
              <div className="rounded-2xl border border-border bg-muted/25 p-4 text-sm text-foreground/70">
                <p className="font-semibold text-foreground">Pedagogía por diseño</p>
                <p className="mt-2 text-xs text-foreground/60">
                  Recomendación: crea capítulos cortos (5–10 min de lectura), con ejemplos y un resumen al final.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-foreground/60">Institución</span>
                  <select
                    value={institution}
                    onChange={(e) => {
                      const next = e.target.value === "SENA" ? "SENA" : "CESDE";
                      setInstitution(next);
                      setGroupId("");
                      setFichaId("");
                    }}
                    className="zs-input h-10"
                  >
                    <option value="CESDE">CESDE</option>
                    <option value="SENA">SENA</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-foreground/60">Duración sesión (días)</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={sessionDays}
                    onChange={(e) => setSessionDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                    className="zs-input h-10"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-foreground/60">Sede</span>
                  <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="zs-input h-10">
                    <option value="">Seleccionar</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-foreground/60">Jornada</span>
                  <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="zs-input h-10">
                    <option value="">Seleccionar</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {institution === "SENA" ? (
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs font-semibold text-foreground/60">Ficha</span>
                    <select value={fichaId} onChange={(e) => setFichaId(e.target.value)} className="zs-input h-10">
                      <option value="">Seleccionar</option>
                      {fichas.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs font-semibold text-foreground/60">Grupo</span>
                    <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="zs-input h-10">
                      <option value="">Seleccionar</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-foreground/60">Materia</span>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="zs-input h-10">
                    <option value="">Seleccionar</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1 text-sm">
                <span className="text-xs font-semibold text-foreground/60">Nombre del cuadernillo (opcional)</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="zs-input h-10" placeholder="Ej: Fundamentos" />
              </label>

              <div className="rounded-2xl border border-border bg-muted/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Capítulos (README)</p>
                    <p className="mt-1 text-xs text-foreground/60">Pega markdown o sube archivos `.md`. Cada uno será un capítulo.</p>
                  </div>
                  <label className="zs-btn-secondary inline-flex h-9 cursor-pointer items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Subir README(s)
                    <input
                      type="file"
                      accept=".md,.markdown,text/markdown,text/plain"
                      multiple
                      className="hidden"
                      onChange={(e) => void loadMarkdownFiles(e.target.files, "create")}
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr]">
                  <input
                    value={chapterTitle}
                    onChange={(e) => setChapterTitle(e.target.value)}
                    className="zs-input h-10"
                    placeholder="Título del capítulo"
                  />
                  <textarea
                    value={chapterMarkdown}
                    onChange={(e) => setChapterMarkdown(e.target.value)}
                    className="zs-input min-h-[180px] resize-y py-3"
                    placeholder="# Capítulo&#10;Contenido en markdown..."
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={addChapterDraft} disabled={!chapterMarkdown.trim()} className="zs-btn-primary h-10">
                    <Plus className="h-4 w-4" />
                    Agregar capítulo
                  </button>
                  <span className="text-xs font-semibold text-foreground/55">{chapters.length} capítulo(s)</span>
                </div>

                <div className="mt-3 space-y-2">
                  {chapters.map((c, idx) => (
                    <div key={`${c.title}-${idx}`} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          C{idx + 1}. {c.title}
                        </p>
                        <p className="truncate text-xs text-foreground/55">{Math.round(c.markdown.length / 1024)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setChapters((prev) => prev.filter((_, i) => i !== idx))}
                        className="zs-btn-danger-soft h-8 px-2"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  {!chapters.length ? (
                    <div className="rounded-xl border border-dashed border-border bg-white/70 px-3 py-6 text-center text-sm text-foreground/55">
                      Aún no hay capítulos.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="zs-btn-secondary h-10">
                  Cancelar
                </button>
                <button type="button" onClick={() => void createBooklet()} disabled={!canCreate} className="zs-btn-primary h-10">
                  {saving ? "Creando..." : "Crear cuadernillo"}
                </button>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {appendModalOpen ? (
        <ModalShell
          title="Agregar capítulo"
          onClose={() => {
            setAppendModalOpen(false);
          }}
        >
          <div className="grid gap-3">
            <input value={appendTitle} onChange={(e) => setAppendTitle(e.target.value)} className="zs-input h-10" placeholder="Título del capítulo" />
            <textarea
              value={appendMarkdown}
              onChange={(e) => setAppendMarkdown(e.target.value)}
              className="zs-input min-h-[320px] resize-y py-3"
              placeholder="# Nuevo capítulo&#10;Contenido..."
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="zs-btn-secondary inline-flex h-10 cursor-pointer items-center gap-2 w-fit">
                <Upload className="h-4 w-4" />
                Subir README
                <input
                  type="file"
                  accept=".md,.markdown,text/markdown,text/plain"
                  className="hidden"
                  onChange={(e) => void loadMarkdownFiles(e.target.files, "append")}
                />
              </label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAppendModalOpen(false)} className="zs-btn-secondary h-10">
                  Cancelar
                </button>
                <button type="button" onClick={() => void appendChapter()} disabled={!appendTitle.trim() || !appendMarkdown.trim() || saving} className="zs-btn-primary h-10">
                  {saving ? "Guardando..." : "Guardar capítulo"}
                </button>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {manageModalOpen ? (
        <ModalShell
          title="Gestionar capítulos"
          onClose={() => {
            setManageModalOpen(false);
            setManageDocId("");
            setManageChapters([]);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Reordenar y eliminar capítulos</p>
              <p className="mt-1 text-xs text-foreground/60">
                El orden se aplica renumerando los capítulos (C01, C02, ...). Los cambios se reflejan en el índice.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void loadManageChapters(manageDocId)} className="zs-btn-secondary h-10" disabled={!manageDocId || manageLoading || manageSaving}>
                <RefreshCw className={`h-4 w-4 ${manageLoading ? "animate-spin" : ""}`} />
                Actualizar
              </button>
              <button type="button" onClick={() => void saveManageOrder()} className="zs-btn-primary h-10" disabled={!manageDocId || manageLoading || manageSaving || !manageChapters.length}>
                <Save className="h-4 w-4" />
                Guardar orden
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-white">
            <div className="border-b border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-semibold text-foreground/60">
                {manageLoading ? "Cargando..." : `${manageChapters.length} capítulo(s)`}
              </p>
            </div>
            <div className="divide-y divide-border">
              {manageChapters.map((c, idx) => (
                <div key={`${c.id}:${idx}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground/55">Capítulo {idx + 1}</p>
                    <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="zs-btn-secondary h-9 w-9 px-0"
                      aria-label="Subir"
                      title="Subir"
                      disabled={manageLoading || manageSaving || idx === 0}
                      onClick={() => {
                        setManageChapters((prev) => {
                          if (idx <= 0) return prev;
                          const copy = [...prev];
                          const tmp = copy[idx - 1];
                          copy[idx - 1] = copy[idx]!;
                          copy[idx] = tmp!;
                          return copy;
                        });
                      }}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="zs-btn-secondary h-9 w-9 px-0"
                      aria-label="Bajar"
                      title="Bajar"
                      disabled={manageLoading || manageSaving || idx === manageChapters.length - 1}
                      onClick={() => {
                        setManageChapters((prev) => {
                          if (idx >= prev.length - 1) return prev;
                          const copy = [...prev];
                          const tmp = copy[idx + 1];
                          copy[idx + 1] = copy[idx]!;
                          copy[idx] = tmp!;
                          return copy;
                        });
                      }}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="zs-btn-danger-soft h-9"
                      disabled={manageLoading || manageSaving}
                      onClick={() => void deleteManageChapter(c.id)}
                      title="Eliminar capítulo"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {!manageLoading && !manageChapters.length ? (
                <div className="px-4 py-10 text-center text-sm text-foreground/55">Este cuadernillo no tiene capítulos.</div>
              ) : null}
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
