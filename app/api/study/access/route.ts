import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = toString(body?.slug, "").trim();
  const code = toString(body?.code, "").trim();

  if (!slug || !code) {
    return NextResponse.json({ error: "Debes indicar URL y código de acceso." }, { status: 400 });
  }

  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminDb = getAdminDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No fue posible inicializar credenciales.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const snap = await adminDb
    .collection("studyDocs")
    .where("slug", "==", slug)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return NextResponse.json({ error: "Documentación no encontrada o inactiva." }, { status: 404 });

  const row = snap.docs[0]?.data() as Record<string, unknown>;
  const expectedCode = toString(row.accessCode, "");
  if (!expectedCode || expectedCode !== code) {
    return NextResponse.json({ error: "Código inválido." }, { status: 401 });
  }

  const cutoffWeek =
    typeof row.cutoffWeek === "number" && Number.isFinite(row.cutoffWeek) ? Math.floor(row.cutoffWeek) : null;
  if (!cutoffWeek || cutoffWeek < 1) {
    return NextResponse.json({ error: "Documentación sin semanas publicadas." }, { status: 409 });
  }

  const docId = snap.docs[0]?.id;
  const entriesSnap = await adminDb
    .collection("studyDocs")
    .doc(docId)
    .collection("entries")
    .where("weekIndex", "<=", cutoffWeek)
    .orderBy("weekIndex", "asc")
    .get();

  const subjectName = toString(row.subjectName, "Materia");
  const institution = toString(row.institution, "");
  const header = `# ${subjectName}\n\n> Documentación de estudio${institution ? ` (${institution})` : ""}\n\n---\n\n## Tabla de Contenidos\n`;
  const toc = entriesSnap.docs
    .map((d) => {
      const r = d.data() as Record<string, unknown>;
      const title = toString(r.title, "").trim();
      if (!title) return "";
      const anchor = title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      return `- [${title}](#${anchor})`;
    })
    .filter(Boolean)
    .join("\n");

  const sections = entriesSnap.docs
    .map((d) => {
      const r = d.data() as Record<string, unknown>;
      const title = toString(r.title, "").trim();
      const md = toString(r.markdown, "").trim();
      if (!title && !md) return "";
      return `---\n\n## ${title || "Semana"}\n\n${md}\n`;
    })
    .filter(Boolean)
    .join("\n");

  const markdown = `${header}${toc}\n\n${sections}`.trim() + "\n";
  const bytes = Buffer.byteLength(markdown, "utf8");
  if (bytes > 900 * 1024) {
    return NextResponse.json(
      {
        error:
          `La documentación publicada es demasiado grande para mostrarse en una sola página (≈${Math.round(bytes / 1024)} KB). ` +
          `Recomendación: dividir el contenido por semanas o separar en varias páginas.`,
      },
      { status: 413 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      docId,
      slug: toString(row.slug, slug),
      title: toString(row.title, "Documentación"),
      subjectId: toString(row.subjectId, ""),
      subjectName: toString(row.subjectName, "Materia"),
      institution: toString(row.institution, ""),
      cutoffWeek,
      cutoffMoment: toString(row.cutoffMoment, ""),
      markdown,
      sessionDays:
        typeof row.sessionDays === "number" && Number.isFinite(row.sessionDays)
          ? Math.max(1, Math.min(365, Math.floor(row.sessionDays)))
          : 90,
    },
    { status: 200 },
  );
}
