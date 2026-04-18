"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  doc,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { normalizeSentenceText } from "@/lib/text/normalize";
import { Pencil, Plus, Save, X, Power, Trash2, Send, KeyRound } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";

type CatalogItem = {
  id: string;
  name: string;
};

type ExamTemplateRow = {
  id: string;
  name: string;
  subjectId: string;
  groupId: string;
  momentId: string;
  siteId: string;
  shiftId: string;
  questionCount: number;
  timeLimitMinutes: number;
  active: boolean;
};

type PublishedRef = {
  accessCode: string;
  status: string;
};

function toCatalogItem(id: string, data: Record<string, unknown>): CatalogItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  return { id, name };
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function buildExamName(params: {
  subject?: string;
  group?: string;
  site?: string;
  shift?: string;
  moment?: string;
}) {
  const parts = [params.site, params.subject, params.group, params.shift, params.moment].filter(Boolean);
  return parts.join(" - ") || "Nuevo examen";
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: CatalogItem[];
  placeholder: string;
}) {
  const dup = useMemo(() => {
    const counts = new Map<string, number>();
    options.forEach((o) => {
      const k = o.name.trim().toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return counts;
  }, [options]);

  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {dup.get(opt.name.trim().toLowerCase()) && (dup.get(opt.name.trim().toLowerCase()) ?? 0) > 1
              ? `${opt.name} · ${opt.id.slice(0, 6)}`
              : opt.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TinyCreate({
  label,
  placeholder,
  onCreate,
}: {
  label: string;
  placeholder: string;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onCreate(trimmed);
      setName("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3">
      <p className="text-xs font-semibold text-zinc-700">{label}</p>
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="h-9 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          disabled={saving}
        />
        <IconButton
          variant="primary"
          onClick={submit}
          disabled={saving || !name.trim()}
          className="h-9 w-9"
          aria-label="Crear"
          title="Crear"
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-800">{label}</p>
        {description ? <p className="truncate text-xs text-zinc-500">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          value ? "bg-zinc-900" : "bg-zinc-200"
        }`}
        aria-pressed={value}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            value ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export function ExamManager() {
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [groups, setGroups] = useState<CatalogItem[]>([]);
  const [moments, setMoments] = useState<CatalogItem[]>([]);
  const [sites, setSites] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);

  const [rows, setRows] = useState<ExamTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [momentId, setMomentId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [questionCount, setQuestionCount] = useState(45);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [active, setActive] = useState(true);
  const [creating, setCreating] = useState(false);

  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamTemplateRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<ExamTemplateRow | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishedByTemplate, setPublishedByTemplate] = useState<Record<string, PublishedRef>>({});

  const namesById = useMemo(() => {
    const m = new Map<string, string>();
    subjects.forEach((x) => m.set(`subjects:${x.id}`, x.name));
    groups.forEach((x) => m.set(`groups:${x.id}`, x.name));
    moments.forEach((x) => m.set(`moments:${x.id}`, x.name));
    sites.forEach((x) => m.set(`sites:${x.id}`, x.name));
    shifts.forEach((x) => m.set(`shifts:${x.id}`, x.name));
    return m;
  }, [subjects, groups, moments, sites, shifts]);

  const subjectName = namesById.get(`subjects:${subjectId}`) ?? "";
  const groupName = namesById.get(`groups:${groupId}`) ?? "";
  const momentName = namesById.get(`moments:${momentId}`) ?? "";
  const siteName = namesById.get(`sites:${siteId}`) ?? "";
  const shiftName = namesById.get(`shifts:${shiftId}`) ?? "";

  const autoName = useMemo(
    () =>
      buildExamName({
        subject: subjectName,
        group: groupName,
        site: siteName,
        shift: shiftName,
        moment: momentName,
      }),
    [subjectName, momentName, groupName, siteName, shiftName],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setError(null);
      try {
        const [subjectsSnap, groupsSnap, momentsSnap, sitesSnap, shiftsSnap] = await Promise.all([
          getDocs(query(collection(firestore, "subjects"), orderBy("name"), limit(200))),
          getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(200))),
          getDocs(query(collection(firestore, "moments"), orderBy("name"), limit(50))),
          getDocs(query(collection(firestore, "sites"), orderBy("name"), limit(50))),
          getDocs(query(collection(firestore, "shifts"), orderBy("name"), limit(50))),
        ]);

        if (cancelled) return;

        setSubjects(subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setGroups(groupsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setMoments(momentsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setSites(sitesSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
        setShifts(shiftsSnap.docs.map((d) => toCatalogItem(d.id, d.data())));
      } catch {
        if (!cancelled) setError("No fue posible cargar catalogos. Revisa reglas/permisos.");
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = query(collection(firestore, "publishedExams"), orderBy("publishedAt", "desc"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      const next: Record<string, PublishedRef> = {};
      snap.docs.forEach((d) => {
        const row = d.data() as Record<string, unknown>;
        const templateId = toString(row.templateId, "");
        if (!templateId || next[templateId]) return;
        next[templateId] = {
          accessCode: toString(row.accessCode, "------"),
          status: toString(row.status, "published"),
        };
      });
      setPublishedByTemplate(next);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = query(collection(firestore, "examTemplates"), orderBy("createdAt", "desc"), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const row = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: toString(row.name, d.id),
              subjectId: toString(row.subjectId, ""),
              groupId: toString(row.groupId, ""),
              momentId: toString(row.momentId, ""),
              siteId: toString(row.siteId, ""),
              shiftId: toString(row.shiftId, ""),
              questionCount: toNumber(row.questionCount, 45),
              timeLimitMinutes: toNumber(row.timeLimitMinutes, 60),
              active: toBoolean(row.active, true),
            };
          }),
        );
        setLoading(false);
      },
      () => {
        setError("No fue posible leer examenes. Revisa reglas/permisos de Firestore.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  async function reloadSites() {
    const snap = await getDocs(query(collection(firestore, "sites"), orderBy("name"), limit(50)));
    setSites(snap.docs.map((d) => toCatalogItem(d.id, d.data())));
  }

  async function reloadShifts() {
    const snap = await getDocs(query(collection(firestore, "shifts"), orderBy("name"), limit(50)));
    setShifts(snap.docs.map((d) => toCatalogItem(d.id, d.data())));
  }

  async function createSite(name: string) {
    const res = normalizeSentenceText(name);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await addDoc(collection(firestore, "sites"), {
      name: res.value,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await reloadSites();
  }

  async function createShift(name: string) {
    const res = normalizeSentenceText(name);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await addDoc(collection(firestore, "shifts"), {
      name: res.value,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await reloadShifts();
  }

  async function createExamTemplate() {
    setCreating(true);
    setError(null);
    try {
      if (!shiftId || !siteId || !momentId || !groupId || !subjectId) {
        setError("Completa Materia, Grupo, Momento, Sede y Jornada.");
        return;
      }

      const nameRes = normalizeSentenceText(autoName);
      if (!nameRes.ok) {
        setError(nameRes.error);
        return;
      }
      await addDoc(collection(firestore, "examTemplates"), {
        name: nameRes.value,
        subjectId,
        groupId,
        momentId,
        siteId,
        shiftId,
        questionCount,
        timeLimitMinutes,
        allowedQuestionTypes: [
          "single_choice",
          "multiple_choice",
          "open_concept",
          "puzzle_order",
          "puzzle_match",
          "puzzle_cloze",
        ],
        accessCode: { mode: "generated_6_digits" },
        resultPolicy: { showScoreAfterSubmit: true, showAnswersAfterSubmit: false },
        gradingScale: "both",
        studentRequiredFields: ["fullName", "documentId", "email"],
        active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setQuestionCount(45);
      setTimeLimitMinutes(60);
      setActive(true);
      setCreateOpen(false);
    } catch {
      setError("No fue posible crear el examen. Revisa permisos o conexion.");
    } finally {
      setCreating(false);
    }
  }

  async function saveQuestionCount(id: string) {
    const raw = pendingCounts[id];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value > 200) return;
    setSavingId(id);
    try {
      await updateDoc(doc(firestore, "examTemplates", id), {
        questionCount: value,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    setSavingId(id);
    try {
      await updateDoc(doc(firestore, "examTemplates", id), { active: next, updatedAt: serverTimestamp() });
    } finally {
      setSavingId(null);
    }
  }

  function shuffleArray<T>(arr: T[]) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  async function generateUniqueAccessCode() {
    for (let i = 0; i < 15; i += 1) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const snap = await getDocs(query(collection(firestore, "publishedExams"), where("accessCode", "==", code), limit(1)));
      if (snap.empty) return code;
    }
    throw new Error("No fue posible generar un codigo unico.");
  }

  function openPublish(row: ExamTemplateRow) {
    setPublishTarget(row);
    setPublishMessage(null);
    setPublishOpen(true);
  }

  async function publishExam() {
    if (!publishTarget) return;
    setPublishing(true);
    setError(null);
    setPublishMessage(null);

    try {
      function momentRank(id: unknown) {
        const s = typeof id === "string" ? id.trim().toLowerCase() : "";
        const m = /^m(\d+)$/.exec(s);
        if (!m) return null;
        const n = Number(m[1]);
        return Number.isFinite(n) && n > 0 ? n : null;
      }

      const questionSnap = await getDocs(
        query(
          collection(firestore, "questions"),
          where("subjectId", "==", publishTarget.subjectId),
          where("status", "==", "published"),
          limit(1200),
        ),
      );

      const candidates = questionSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
      if (candidates.length === 0) {
        setError(
          "No se encontraron preguntas para la materia seleccionada. Esto suele pasar cuando la materia (catalogo) tiene un ID diferente al subjectId que tienen las preguntas importadas. Solución: usa la materia creada por el import JSON (ID estable) o vuelve a importar el lote con el subjectId correcto.",
        );
        return;
      }

      const examRank = momentRank(publishTarget.momentId);
      const eligible = candidates.filter((q) => {
        const row = q as Record<string, unknown>;
        const momentIds = Array.isArray(row.momentIds)
          ? (row.momentIds as unknown[])
          : typeof row.momentIds === "string"
            ? [row.momentIds]
            : typeof row.momentId === "string"
              ? [row.momentId]
              : [];

        if (momentIds.length === 0) {
          return true;
        }

        if (examRank === null) {
          return momentIds.includes(publishTarget.momentId);
        }

        return momentIds.some((m) => {
          const r = momentRank(m);
          return r !== null && r <= examRank;
        });
      });

      if (eligible.length < publishTarget.questionCount) {
        setError(
          `No hay suficientes preguntas para publicar para este examen. En materia: ${candidates.length}, en momento (regla Mx): ${eligible.length}. Requeridas: ${publishTarget.questionCount}.`,
        );
        return;
      }

      const selected = shuffleArray(eligible).slice(0, publishTarget.questionCount);
      const accessCode = await generateUniqueAccessCode();

      const publishedRef = await addDoc(collection(firestore, "publishedExams"), {
        templateId: publishTarget.id,
        templateName: publishTarget.name,
        name: publishTarget.name,
        subjectId: publishTarget.subjectId,
        groupId: publishTarget.groupId,
        momentId: publishTarget.momentId,
        siteId: publishTarget.siteId,
        shiftId: publishTarget.shiftId,
        questionCount: publishTarget.questionCount,
        timeLimitMinutes: publishTarget.timeLimitMinutes || 60,
        accessCode,
        status: "published",
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(firestore);
      selected.forEach((q, index) => {
        const qRef = doc(firestore, "publishedExams", publishedRef.id, "questions", q.id);
        batch.set(qRef, {
          ...q,
          questionId: q.id,
          order: index + 1,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();

      setPublishMessage(`Examen publicado. Codigo de acceso: ${accessCode}`);
      setPublishOpen(false);
      setPublishTarget(null);
    } catch {
      setError("No fue posible publicar el examen.");
    } finally {
      setPublishing(false);
    }
  }

  function openEdit(row: ExamTemplateRow) {
    setError(null);
    setEditId(row.id);
    setSubjectId(row.subjectId);
    setGroupId(row.groupId);
    setMomentId(row.momentId);
    setSiteId(row.siteId);
    setShiftId(row.shiftId);
    setQuestionCount(row.questionCount);
    setTimeLimitMinutes(row.timeLimitMinutes || 60);
    setActive(row.active);
    setEditOpen(true);
  }

  async function openDelete(row: ExamTemplateRow) {
    setError(null);
    setDeleteTarget(row);
    setDeleteConfirm("");
    setDeleteBlockReason(null);
    setDeleteOpen(true);

    try {
      const [byExamTemplateId, byTemplateId] = await Promise.all([
        getCountFromServer(
          query(collection(firestore, "attempts"), where("examTemplateId", "==", row.id)),
        ),
        getCountFromServer(query(collection(firestore, "attempts"), where("templateId", "==", row.id))),
      ]);
      const total = byExamTemplateId.data().count + byTemplateId.data().count;
      if (total > 0) {
        setDeleteBlockReason("No se puede eliminar: existen intentos asociados a este examen.");
      }
    } catch {
      setDeleteBlockReason("No fue posible verificar intentos asociados. Revisa permisos.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteConfirm.trim().toUpperCase() !== "ELIMINAR") return;
    if (deleteBlockReason) return;

    setDeleting(true);
    setError(null);
    try {
      const publishedSnap = await getDocs(
        query(collection(firestore, "publishedExams"), where("templateId", "==", deleteTarget.id), limit(200)),
      );
      const publishedIds = publishedSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .filter((r) => toString((r as Record<string, unknown>).status, "published") === "published")
        .map((r) => (r as { id: string }).id);
      await Promise.all(
        publishedIds.map(async (id) => {
          await updateDoc(doc(firestore, "publishedExams", id), {
            status: "closed",
            closedAt: serverTimestamp(),
            closedReason: "template_deleted",
            updatedAt: serverTimestamp(),
          });
        }),
      );
      await deleteDoc(doc(firestore, "examTemplates", deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeleteConfirm("");
    } catch {
      setError("No fue posible eliminar el examen. Revisa permisos.");
    } finally {
      setDeleting(false);
    }
  }

  async function saveEdit() {
    if (!editId) return;
    setEditing(true);
    setError(null);
    try {
      if (!shiftId || !momentId || !groupId) {
        setError("Completa Jornada, Grupo y Momento.");
        return;
      }
      if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 240) {
        setError("Tiempo inválido. Rango recomendado: 1 a 240 minutos.");
        return;
      }
      const nameRes = normalizeSentenceText(autoName);
      if (!nameRes.ok) {
        setError(nameRes.error);
        return;
      }
      await updateDoc(doc(firestore, "examTemplates", editId), {
        name: nameRes.value,
        subjectId,
        groupId,
        momentId,
        siteId,
        shiftId,
        questionCount,
        timeLimitMinutes,
        active,
        updatedAt: serverTimestamp(),
      });
      setEditOpen(false);
      setEditId(null);
    } catch {
      setError("No fue posible guardar cambios del examen.");
    } finally {
      setEditing(false);
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const subject = namesById.get(`subjects:${r.subjectId}`) ?? r.subjectId;
      const group = namesById.get(`groups:${r.groupId}`) ?? r.groupId;
      const moment = namesById.get(`moments:${r.momentId}`) ?? r.momentId;
      const site = namesById.get(`sites:${r.siteId}`) ?? r.siteId;
      const shift = namesById.get(`shifts:${r.shiftId}`) ?? r.shiftId;
      return (
        r.name.toLowerCase().includes(q) ||
        subject.toLowerCase().includes(q) ||
        group.toLowerCase().includes(q) ||
        moment.toLowerCase().includes(q) ||
        site.toLowerCase().includes(q) ||
        shift.toLowerCase().includes(q)
      );
    });
  }, [rows, search, namesById]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Examenes</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Crea y administra examenes por jornada, sede, momento y grupo. Define cantidad de preguntas y activa/inactiva.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Buscar</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, grupo, sede..."
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 sm:w-72"
            />
          </label>
          <IconButton
            variant="primary"
            onClick={() => {
              setTimeLimitMinutes(60);
              setCreateOpen(true);
            }}
            className="h-11 w-11 shrink-0"
            aria-label="Crear examen"
            title="Crear examen"
          >
            <Plus className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {publishMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {publishMessage}
        </div>
      ) : null}

      <section className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 shadow-sm">
            Cargando examenes...
          </div>
        ) : filteredRows.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredRows.map((row) => {
              const subject = (namesById.get(`subjects:${row.subjectId}`) ?? row.subjectId) || "N/A";
              const group = (namesById.get(`groups:${row.groupId}`) ?? row.groupId) || "N/A";
              const moment = (namesById.get(`moments:${row.momentId}`) ?? row.momentId) || "N/A";
              const site = (namesById.get(`sites:${row.siteId}`) ?? row.siteId) || "N/A";
              const shift = (namesById.get(`shifts:${row.shiftId}`) ?? row.shiftId) || "N/A";
              const pending = pendingCounts[row.id] ?? String(row.questionCount);
              const disabled = savingId === row.id;
              const pub = publishedByTemplate[row.id];

              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tracking-tight text-zinc-950">
                        {row.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-600">
                        {subject} • {group}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {moment} • {shift} • {site}
                      </p>
                      {pub ? (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                          <KeyRound className="h-3.5 w-3.5" />
                          <span>{pub.accessCode}</span>
                          <span className="text-zinc-500">•</span>
                          <span className="uppercase">{pub.status}</span>
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                        row.active
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                      }`}
                    >
                      {row.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-zinc-700">Preguntas</span>
                      <input
                        value={pending}
                        onChange={(e) =>
                          setPendingCounts((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                        onBlur={() => void saveQuestionCount(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                            void saveQuestionCount(row.id);
                          }
                        }}
                        className="h-8 w-20 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:opacity-50"
                        disabled={disabled}
                        inputMode="numeric"
                      />
                    </label>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <IconButton
                        onClick={() => openEdit(row)}
                        disabled={disabled}
                        className="h-8 w-8"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>

                      <IconButton
                        variant={row.active ? "danger" : "secondary"}
                        onClick={() => toggleActive(row.id, !row.active)}
                        disabled={disabled}
                        className="h-8 w-8"
                        aria-label={row.active ? "Inactivar" : "Activar"}
                        title={row.active ? "Inactivar" : "Activar"}
                      >
                        <Power className="h-4 w-4" />
                      </IconButton>

                      <IconButton
                        variant="primary"
                        onClick={() => openPublish(row)}
                        disabled={disabled || !row.active}
                        className="h-8 w-8"
                        aria-label="Publicar"
                        title="Publicar"
                      >
                        <Send className="h-4 w-4" />
                      </IconButton>

                      <IconButton
                        variant="danger"
                        onClick={() => void openDelete(row)}
                        disabled={disabled}
                        className="h-8 w-8"
                        aria-label="Eliminar"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 shadow-sm">
            No hay examenes creados aun.
          </div>
        )}
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setCreateOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Crear examen</h2>
                <p className="text-sm text-zinc-500">Completa los campos y guarda.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="hidden"
              >
                Cerrar
              </button>
              <IconButton
                onClick={() => setCreateOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select
                label="Materia"
                value={subjectId}
                onChange={setSubjectId}
                options={subjects}
                placeholder="Selecciona una materia"
              />
              <Select
                label="Grupo"
                value={groupId}
                onChange={setGroupId}
                options={groups}
                placeholder="Selecciona un grupo"
              />
              <Select
                label="Momento"
                value={momentId}
                onChange={setMomentId}
                options={moments}
                placeholder="Selecciona un momento"
              />
              <Select
                label="Sede"
                value={siteId}
                onChange={setSiteId}
                options={sites}
                placeholder={sites.length ? "Selecciona una sede" : "Crea una sede primero"}
              />
              <Select
                label="Jornada"
                value={shiftId}
                onChange={setShiftId}
                options={shifts}
                placeholder={shifts.length ? "Selecciona una jornada" : "Crea una jornada primero"}
              />

              <div className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold text-zinc-700">Nombre (automatico)</span>
                <div className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 flex items-center">
                  <span className="truncate">{autoName}</span>
                </div>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Cantidad de preguntas</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value || 0))}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Tiempo (min)</span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value || 0))}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <Toggle
                label="Activo"
                description="Si esta inactivo, no se deberia poder publicar."
                value={active}
                onChange={setActive}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TinyCreate label="Crear sede" placeholder="Ej: Sede Central" onCreate={createSite} />
              <TinyCreate label="Crear jornada" placeholder="Ej: Manana / Noche" onCreate={createShift} />
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <IconButton
                variant="primary"
                onClick={createExamTemplate}
                disabled={creating}
                className="h-10 w-10"
                aria-label="Guardar examen"
                title={creating ? "Creando..." : "Guardar examen"}
              >
                <Save className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setEditOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Editar examen</h2>
                <p className="text-sm text-zinc-500">Actualiza nombre, jornada, grupo y momento.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="hidden"
              >
                Cerrar
              </button>
              <IconButton
                onClick={() => setEditOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold text-zinc-700">Nombre (automatico)</span>
                <div className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 flex items-center">
                  <span className="truncate">{autoName}</span>
                </div>
              </div>

              <Select
                label="Jornada"
                value={shiftId}
                onChange={setShiftId}
                options={shifts}
                placeholder={shifts.length ? "Selecciona una jornada" : "Crea una jornada primero"}
              />
              <Select
                label="Grupo"
                value={groupId}
                onChange={setGroupId}
                options={groups}
                placeholder="Selecciona un grupo"
              />
              <Select
                label="Momento"
                value={momentId}
                onChange={setMomentId}
                options={moments}
                placeholder="Selecciona un momento"
              />
              <Select
                label="Sede"
                value={siteId}
                onChange={setSiteId}
                options={sites}
                placeholder={sites.length ? "Selecciona una sede" : "Crea una sede primero"}
              />

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Cantidad de preguntas</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value || 0))}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Tiempo (min)</span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value || 0))}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <Toggle
                label="Activo"
                description="Si esta inactivo, no se deberia poder publicar."
                value={active}
                onChange={setActive}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <IconButton
                variant="primary"
                onClick={saveEdit}
                disabled={editing}
                className="h-10 w-10"
                aria-label="Guardar cambios"
                title={editing ? "Guardando..." : "Guardar cambios"}
              >
                <Save className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen && deleteTarget ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setDeleteOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
                  Eliminar examen
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Esta accion es permanente.
                </p>
              </div>
              <IconButton
                onClick={() => setDeleteOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="truncate text-sm font-semibold text-zinc-900">{deleteTarget.name}</p>
              <p className="mt-1 truncate text-xs text-zinc-600">
                ID interno oculto
              </p>
            </div>

            {deleteBlockReason ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {deleteBlockReason}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Escribe <strong>ELIMINAR</strong> para confirmar.
              </div>
            )}

            <div className="mt-4 grid gap-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-700">Confirmacion</span>
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  placeholder="ELIMINAR"
                  disabled={!!deleteBlockReason || deleting}
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <IconButton
                  onClick={() => setDeleteOpen(false)}
                  className="h-10 w-10"
                  aria-label="Cancelar"
                  title="Cancelar"
                  disabled={deleting}
                >
                  <X className="h-4 w-4" />
                </IconButton>
                <IconButton
                  variant="danger"
                  onClick={confirmDelete}
                  className="h-10 w-10"
                  aria-label="Eliminar definitivamente"
                  title={deleting ? "Eliminando..." : "Eliminar definitivamente"}
                  disabled={
                    deleting ||
                    !!deleteBlockReason ||
                    deleteConfirm.trim().toUpperCase() !== "ELIMINAR"
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {publishOpen && publishTarget ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setPublishOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-10 sm:bottom-auto sm:rounded-3xl sm:p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Publicar examen</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Se seleccionaran preguntas en masa y se creara un codigo de acceso.
                </p>
              </div>
              <IconButton
                onClick={() => setPublishOpen(false)}
                className="h-9 w-9"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="font-semibold text-zinc-900">{publishTarget.name}</p>
              <p className="mt-1">Preguntas a seleccionar: {publishTarget.questionCount}</p>
              <p>Tiempo limite: {publishTarget.timeLimitMinutes || 60} minutos</p>
              <p className="mt-1 text-xs text-zinc-500">
                Filtro: materia + grupo + momento del examen.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <IconButton
                onClick={() => setPublishOpen(false)}
                className="h-10 w-10"
                aria-label="Cancelar"
                title="Cancelar"
                disabled={publishing}
              >
                <X className="h-4 w-4" />
              </IconButton>
              <IconButton
                variant="primary"
                onClick={publishExam}
                className="h-10 w-10"
                aria-label="Publicar"
                title={publishing ? "Publicando..." : "Publicar"}
                disabled={publishing}
              >
                <Send className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
