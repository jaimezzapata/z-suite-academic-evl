"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import { Download, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { firestore } from "@/lib/firebase/client";

type SnapshotQuestion = {
  id: string;
  questionId: string;
  order: number;
  type: string;
  statement: string;
  points: number;
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  partialCredit?: boolean;
  answerRules?: {
    maxWords?: number;
    keywords?: Array<{ term: string; weight: number }>;
    passThreshold?: number;
  };
  puzzle?: Record<string, unknown>;
};

type ResultRow = {
  id: string;
  examName: string;
  examCode: string;
  studentFullName: string;
  documentId: string;
  email: string;
  status: string;
  grade0to5: number;
  grade0to50: number;
  submittedAt: Date | null;
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  fraudTotal: number;
  wrongCount: number;
  wrongDetails: string[];
};

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return ((value as { toDate: () => Date }).toDate() as Date) ?? null;
  }
  return null;
}

function formatDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColorHex(status: string) {
  const s = status.toLowerCase();
  if (s.includes("fraud")) return "FEE2E2";
  if (s.includes("expired")) return "FEF3C7";
  if (s.includes("submitted")) return "DCFCE7";
  return "E5E7EB";
}

function fraudRiskLabel(total: number) {
  if (total >= 11) return "Crítico";
  if (total >= 6) return "Alto";
  if (total >= 3) return "Moderado";
  return "Bajo";
}

function normalizeCsvCell(value: string | number) {
  const s = String(value);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toTextPreview(value: string, max = 120) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}...`;
}

function resolveOptionText(q: SnapshotQuestion, optionId: string) {
  const opt = (q.options ?? []).find((o) => o.id === optionId);
  return opt ? toTextPreview(opt.text, 80) : optionId;
}

function answerPreview(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") {
    const id = toString(answer, "");
    if (!id) return "Sin respuesta";
    return resolveOptionText(q, id);
  }
  if (q.type === "multiple_choice") {
    const ids = Array.isArray(answer) ? (answer as string[]) : [];
    if (!ids.length) return "Sin respuesta";
    return ids.map((id) => resolveOptionText(q, id)).join(", ");
  }
  if (q.type === "open_concept") {
    return toTextPreview(toString(answer, "Sin respuesta"), 180);
  }
  if (q.type === "puzzle_order") {
    const map = (answer as Record<string, number>) || {};
    const parts = Object.entries(map)
      .slice(0, 6)
      .map(([k, v]) => `${k}:${v}`);
    return parts.length ? parts.join(", ") : "Sin respuesta";
  }
  if (q.type === "puzzle_match" || q.type === "puzzle_cloze") {
    const map = (answer as Record<string, string>) || {};
    const parts = Object.entries(map)
      .slice(0, 6)
      .map(([k, v]) => `${k}:${v}`);
    return parts.length ? parts.join(", ") : "Sin respuesta";
  }
  return toTextPreview(JSON.stringify(answer ?? "Sin respuesta"), 180);
}

function reasonWrong(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") return "Opción seleccionada no corresponde a la correcta.";
  if (q.type === "multiple_choice") {
    return q.partialCredit
      ? "Combinación incompleta o incluye opciones incorrectas."
      : "Combinación no coincide exactamente con las respuestas correctas.";
  }
  if (q.type === "open_concept") {
    const text = toString(answer, "").toLowerCase();
    const maxWords = q.answerRules?.maxWords ?? 120;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > maxWords) return `Supera el máximo de palabras permitido (${maxWords}).`;
    const keywords = q.answerRules?.keywords ?? [];
    const matched = keywords.filter((k) => text.includes(k.term.toLowerCase())).length;
    return `Coincidencia insuficiente de palabras clave (${matched}/${keywords.length || 0}).`;
  }
  if (q.type === "puzzle_order") return "El orden asignado no coincide con el esperado.";
  if (q.type === "puzzle_match") return "Hay emparejamientos incorrectos.";
  if (q.type === "puzzle_cloze") return "Hay opciones incorrectas en los espacios.";
  return "Respuesta incorrecta según reglas de calificación.";
}

function evaluateQuestion(q: SnapshotQuestion, answer: unknown) {
  if (q.type === "single_choice") {
    const correct = q.options?.find((o) => o.isCorrect)?.id;
    return answer === correct ? q.points : 0;
  }

  if (q.type === "multiple_choice") {
    const selected = Array.isArray(answer) ? (answer as string[]) : [];
    const correct = (q.options ?? []).filter((o) => o.isCorrect).map((o) => o.id);
    const same = selected.length === correct.length && selected.every((x) => correct.includes(x));
    if (same) return q.points;

    if (!q.partialCredit) return 0;
    const correctSet = new Set(correct);
    const selectedSet = new Set(selected);
    const correctCount = correct.length || 1;
    let correctSelected = 0;
    let wrongSelected = 0;
    selectedSet.forEach((id) => {
      if (correctSet.has(id)) correctSelected += 1;
      else wrongSelected += 1;
    });
    const ratio = Math.max(0, (correctSelected - wrongSelected) / correctCount);
    return q.points * Math.min(1, ratio);
  }

  if (q.type === "open_concept") {
    const text = toString(answer, "").toLowerCase();
    const keywords = q.answerRules?.keywords ?? [];
    const maxWords = q.answerRules?.maxWords ?? 120;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > maxWords) return 0;
    const totalWeight = keywords.reduce((acc, x) => acc + (x.weight || 0), 0);
    if (!totalWeight) return 0;
    let scoreWeight = 0;
    keywords.forEach((k) => {
      if (text.includes(k.term.toLowerCase())) scoreWeight += k.weight;
    });
    const ratio = Math.min(1, scoreWeight / totalWeight);
    const threshold = typeof q.answerRules?.passThreshold === "number" ? q.answerRules.passThreshold : 0;
    if (ratio < threshold) return 0;
    return q.points * ratio;
  }

  if (q.type === "puzzle_order") {
    const positions = (answer as Record<string, number>) || {};
    const items = ((q.puzzle?.items as Array<Record<string, unknown>>) ?? []);
    if (!items.length) return 0;
    const ok = items.every((it) => positions[toString(it.id)] === toNumber(it.correctPosition, -1));
    return ok ? q.points : 0;
  }

  if (q.type === "puzzle_match") {
    const pairs = ((q.puzzle?.pairs as Array<Record<string, unknown>>) ?? []);
    const ans = (answer as Record<string, string>) || {};
    if (!pairs.length) return 0;
    const ok = pairs.every((p) => ans[toString(p.leftId)] === toString(p.rightId));
    return ok ? q.points : 0;
  }

  if (q.type === "puzzle_cloze") {
    const slots = ((q.puzzle?.slots as Array<Record<string, unknown>>) ?? []);
    const ans = (answer as Record<string, string>) || {};
    if (!slots.length) return 0;
    const ok = slots.every((s) => ans[toString(s.slotId)] === toString(s.correctOptionId));
    return ok ? q.points : 0;
  }

  return 0;
}

function isFullyCorrect(q: SnapshotQuestion, answer: unknown) {
  const earned = evaluateQuestion(q, answer);
  if (!Number.isFinite(earned)) return false;
  if (q.type === "open_concept") return earned > 0;
  return earned >= q.points && q.points > 0;
}

export function ResultsManager() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [examCodeFilter, setExamCodeFilter] = useState("");
  const [exporting, setExporting] = useState<"" | "csv" | "excel" | "pdf">("");
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const attemptsSnap = await getDocs(query(collection(firestore, "attempts"), limit(800)));
        const attempts = attemptsSnap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string },
        );

        const publishedExamIds = Array.from(
          new Set(
            attempts
              .map((a) => toString(a.publishedExamId))
              .filter(Boolean),
          ),
        );

        const questionMap = new Map<string, SnapshotQuestion[]>();
        const examMetaMap = new Map<string, { accessCode: string }>();
        await Promise.all(
          publishedExamIds.map(async (examId) => {
            const examSnap = await getDoc(doc(firestore, "publishedExams", examId));
            if (examSnap.exists()) {
              const examRow = examSnap.data() as Record<string, unknown>;
              examMetaMap.set(examId, { accessCode: toString(examRow.accessCode, "") });
            }
            const qSnap = await getDocs(query(collection(firestore, "publishedExams", examId, "questions"), limit(400)));
            const questions = qSnap.docs
              .map((d) => {
                const row = d.data() as Record<string, unknown>;
                return {
                  id: d.id,
                  questionId: toString(row.questionId, d.id),
                  order: toNumber(row.order, 0),
                  type: toString(row.type, "single_choice"),
                  statement: toString(row.statement, ""),
                  points: toNumber(row.points, 1),
                  options: Array.isArray(row.options) ? (row.options as SnapshotQuestion["options"]) : undefined,
                  partialCredit: Boolean(row.partialCredit),
                  answerRules: (row.answerRules as SnapshotQuestion["answerRules"]) ?? undefined,
                  puzzle: (row.puzzle as Record<string, unknown>) ?? undefined,
                } satisfies SnapshotQuestion;
              })
              .sort((a, b) => a.order - b.order);
            questionMap.set(examId, questions);
          }),
        );

        const computed: ResultRow[] = attempts.map((a) => {
          const examId = toString(a.publishedExamId);
          const examMeta = examMetaMap.get(examId);
          const questions = questionMap.get(examId) ?? [];
          const answers = (a.answers as Record<string, unknown>) ?? {};
          const order = Array.isArray(a.questionOrder) ? (a.questionOrder as unknown[]).map((x) => toString(x)).filter(Boolean) : [];
          const byId = new Map(questions.map((q) => [q.questionId, q] as const));
          const orderedQuestions =
            order.length > 0
              ? [
                  ...order.map((id) => byId.get(id)).filter((q): q is SnapshotQuestion => Boolean(q)),
                  ...questions.filter((q) => !order.includes(q.questionId)),
                ]
              : questions;

          const wrongDetails: string[] = [];
          orderedQuestions.forEach((q, idx) => {
            if (!isFullyCorrect(q, answers[q.questionId])) {
              wrongDetails.push(
                `P${idx + 1}: ${toTextPreview(q.statement)} | Respuesta: ${answerPreview(q, answers[q.questionId])} | Motivo: ${reasonWrong(
                  q,
                  answers[q.questionId],
                )}`,
              );
            }
          });

          const fraudTabSwitches = toNumber(a.fraudTabSwitches, 0);
          const fraudClipboardAttempts = toNumber(a.fraudClipboardAttempts, 0);
          const fraudTotal = fraudTabSwitches + fraudClipboardAttempts;

          return {
            id: a.id,
            examName: toString(a.examName, "Examen"),
            examCode: examMeta?.accessCode || "-",
            studentFullName: toString(a.studentFullName, "-"),
            documentId: toString(a.documentId, "-"),
            email: toString(a.email, "-"),
            status: toString(a.status, "-"),
            grade0to5: toNumber(a.grade0to5, 0),
            grade0to50: toNumber(a.grade0to50, 0),
            submittedAt: toDate(a.submittedAt),
            fraudTabSwitches,
            fraudClipboardAttempts,
            fraudTotal,
            wrongCount: wrongDetails.length,
            wrongDetails,
          };
        });

        computed.sort((a, b) => {
          const at = a.submittedAt?.getTime() ?? 0;
          const bt = b.submittedAt?.getTime() ?? 0;
          return bt - at;
        });

        if (!cancelled) setRows(computed);
      } catch {
        if (!cancelled) setError("No fue posible cargar resultados desde Firestore.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const code = examCodeFilter.trim();
    return rows.filter((r) => {
      const bySearch =
        !q ||
        [r.examName, r.studentFullName, r.documentId, r.email, r.status, r.examCode].some((field) =>
          field.toLowerCase().includes(q),
        );
      const byCode = !code || r.examCode.includes(code);
      return bySearch && byCode;
    });
  }, [rows, search, examCodeFilter]);

  const exportRows = useMemo(
    () =>
      filteredRows.map((r) => ({
        examen: r.examName,
        codigo_examen: r.examCode,
        estudiante: r.studentFullName,
        documento: r.documentId,
        correo: r.email,
        estado: r.status,
        nota_0_5: Number(r.grade0to5.toFixed(2)),
        nota_0_50: Number(r.grade0to50.toFixed(2)),
        fraude_tab: r.fraudTabSwitches,
        fraude_clipboard: r.fraudClipboardAttempts,
        fraude_total: r.fraudTotal,
        fecha_envio: formatDate(r.submittedAt),
        preguntas_malas_cantidad: r.wrongCount,
        preguntas_malas_detalle: r.wrongDetails.join(" || "),
      })),
    [filteredRows],
  );

  function downloadBlob(content: BlobPart, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const headers = [
      "Examen",
      "Estudiante",
      "Código examen",
      "Documento",
      "Correo",
      "Estado",
      "Nota 0-5",
      "Nota 0-50",
      "Fraude pestaña",
      "Fraude copiar/pegar",
      "Fraude total",
      "Fecha envio",
      "Preguntas malas (cantidad)",
      "Preguntas malas (detalle)",
    ];
    const lines = [
      headers.map(normalizeCsvCell).join(","),
      ...filteredRows.map((r) =>
        [
          r.examName,
          r.studentFullName,
          r.examCode,
          r.documentId,
          r.email,
          r.status,
          r.grade0to5.toFixed(2),
          r.grade0to50.toFixed(2),
          r.fraudTabSwitches,
          r.fraudClipboardAttempts,
          r.fraudTotal,
          formatDate(r.submittedAt),
          r.wrongCount,
          r.wrongDetails.join(" || "),
        ]
          .map(normalizeCsvCell)
          .join(","),
      ),
    ];
    downloadBlob(`\uFEFF${lines.join("\n")}`, `reporte-resultados-${Date.now()}.csv`, "text/csv;charset=utf-8;");
  }

  async function exportExcel() {
    const ExcelJSImport = await import("exceljs");
    const WorkbookCtor = (ExcelJSImport as unknown as { Workbook?: new () => any; default?: { Workbook?: new () => any } }).Workbook
      ?? (ExcelJSImport as unknown as { default?: { Workbook?: new () => any } }).default?.Workbook;
    if (!WorkbookCtor) throw new Error("No fue posible inicializar ExcelJS.");

    const workbook = new WorkbookCtor();
    workbook.creator = "Z-Suite Eval";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Resultados", {
      views: [{ state: "frozen", ySplit: 5 }],
    });

    ws.mergeCells("A1:K1");
    ws.getCell("A1").value = "Reporte de Resultados de Exámenes";
    ws.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    ws.getRow(1).height = 26;

    ws.mergeCells("A2:K2");
    ws.getCell("A2").value = `Generado: ${new Date().toLocaleString("es-CO")} • Registros: ${filteredRows.length}`;
    ws.getCell("A2").font = { size: 11, color: { argb: "FF334155" } };
    ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 20;

    const headers = [
      "Examen",
      "Código",
      "Estudiante",
      "Documento",
      "Correo",
      "Estado",
      "Nota 0-5",
      "Nota 0-50",
      "Fraude (T/C/Total)",
      "Riesgo fraude",
      "Fecha envío",
    ];
    ws.addRow(headers);
    ws.getRow(4).eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
    ws.getRow(4).height = 24;

    filteredRows.forEach((r) => {
      const risk = fraudRiskLabel(r.fraudTotal);
      const row = ws.addRow([
        r.examName,
        r.examCode,
        r.studentFullName,
        r.documentId,
        r.email,
        r.status,
        Number(r.grade0to5.toFixed(2)),
        Number(r.grade0to50.toFixed(2)),
        `${r.fraudTabSwitches}/${r.fraudClipboardAttempts}/${r.fraudTotal}`,
        risk,
        formatDate(r.submittedAt),
      ]);
      row.height = 22;
      row.eachCell((cell: any, col: number) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFF1F5F9" } },
          left: { style: "thin", color: { argb: "FFF1F5F9" } },
          bottom: { style: "thin", color: { argb: "FFF1F5F9" } },
          right: { style: "thin", color: { argb: "FFF1F5F9" } },
        };
        if (col === 6) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${statusColorHex(r.status)}` } };
        }
        if (col === 10) {
          const color = risk === "Crítico" ? "FFFECACA" : risk === "Alto" ? "FFFED7AA" : risk === "Moderado" ? "FFFEF3C7" : "FFDCFCE7";
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        }
        if (col === 7 || col === 8) {
          cell.numFmt = "0.00";
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });
    });

    ws.columns = [
      { key: "examen", width: 28 },
      { key: "codigo", width: 12 },
      { key: "estudiante", width: 24 },
      { key: "documento", width: 16 },
      { key: "correo", width: 28 },
      { key: "estado", width: 18 },
      { key: "nota5", width: 11 },
      { key: "nota50", width: 11 },
      { key: "fraude", width: 16 },
      { key: "riesgo", width: 14 },
      { key: "fecha", width: 20 },
    ];
    ws.autoFilter = "A4:K4";

    const detail = workbook.addWorksheet("Preguntas malas");
    detail.addRow(["Detalle de preguntas incorrectas por estudiante"]);
    detail.mergeCells("A1:G1");
    detail.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    detail.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
    detail.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    detail.getRow(1).height = 24;

    detail.addRow(["Examen", "Código", "Estudiante", "Documento", "Fraude total", "Pregunta #", "Detalle (respuesta + motivo)"]);
    detail.getRow(2).eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4C1D95" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });

    filteredRows.forEach((r) => {
      if (!r.wrongDetails.length) {
        detail.addRow([r.examName, r.examCode, r.studentFullName, r.documentId, r.fraudTotal, "-", "Sin preguntas malas detectadas."]);
      } else {
        r.wrongDetails.forEach((d, idx) => {
          detail.addRow([r.examName, r.examCode, r.studentFullName, r.documentId, r.fraudTotal, idx + 1, d]);
        });
      }
    });
    detail.columns = [
      { width: 26 },
      { width: 10 },
      { width: 22 },
      { width: 16 },
      { width: 12 },
      { width: 10 },
      { width: 90 },
    ];
    detail.eachRow((row: any, rowNumber: number) => {
      if (rowNumber <= 2) return;
      row.eachCell((cell: any) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });
    detail.autoFilter = "A2:G2";

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(buffer, `reporte-resultados-${Date.now()}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  async function exportPdf() {
    const jsPDFModule = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const jsPDF = jsPDFModule.default;
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("Reporte de Resultados de Exámenes", 24, 30);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString("es-CO")} • Registros: ${filteredRows.length}`, 24, 48);
    doc.setTextColor(17, 24, 39);

    autoTable(doc, {
      startY: 78,
      head: [[
        "Examen",
        "Código",
        "Estudiante",
        "Documento",
        "Estado",
        "0-5",
        "0-50",
        "Fraude",
        "Fecha",
        "Malas",
      ]],
      body: filteredRows.map((r) => [
        r.examName,
        r.examCode,
        r.studentFullName,
        r.documentId,
        r.status,
        r.grade0to5.toFixed(2),
        r.grade0to50.toFixed(2),
        String(r.fraudTotal),
        formatDate(r.submittedAt),
        String(r.wrongCount),
      ]),
      styles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55] },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const raw = (data.row.raw ?? []) as unknown[];
        const status = String(raw?.[4] ?? "");
        const fraud = Number(raw?.[7] ?? 0);
        if (data.column.index === 4) {
          if (status.toLowerCase().includes("fraud")) data.cell.styles.fillColor = [254, 226, 226];
          else if (status.toLowerCase().includes("expired")) data.cell.styles.fillColor = [254, 243, 199];
          else if (status.toLowerCase().includes("submitted")) data.cell.styles.fillColor = [220, 252, 231];
        }
        if (data.column.index === 7) {
          if (fraud >= 11) data.cell.styles.fillColor = [254, 202, 202];
          else if (fraud >= 6) data.cell.styles.fillColor = [254, 215, 170];
          else if (fraud >= 3) data.cell.styles.fillColor = [254, 243, 199];
          else data.cell.styles.fillColor = [220, 252, 231];
        }
      },
    });

    doc.addPage("landscape");
    const pageWidth2 = doc.internal.pageSize.getWidth();
    doc.setFillColor(76, 29, 149);
    doc.rect(0, 0, pageWidth2, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text("Detalle de Preguntas Malas por Estudiante", 24, 30);
    doc.setFontSize(10);
    doc.text("Incluye respuesta entregada y motivo de evaluación.", 24, 48);
    doc.setTextColor(17, 24, 39);
    autoTable(doc, {
      startY: 78,
      head: [["Estudiante", "Examen", "Código", "Fraude", "Preguntas malas"]],
      body: filteredRows.map((r) => [
        r.studentFullName,
        r.examName,
        r.examCode,
        String(r.fraudTotal),
        r.wrongDetails.join(" || ") || "Sin preguntas malas detectadas.",
      ]),
      styles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55], overflow: "linebreak" },
      headStyles: { fillColor: [76, 29, 149], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 245, 255] },
      columnStyles: { 4: { cellWidth: 180 } },
    });

    doc.save(`reporte-resultados-${Date.now()}.pdf`);
  }

  async function handleExport(format: "csv" | "excel" | "pdf") {
    setExporting(format);
    try {
      if (format === "csv") exportCsv();
      if (format === "excel") await exportExcel();
      if (format === "pdf") await exportPdf();
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Resultados</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Exporta resultados en Excel, CSV y PDF, incluyendo reporte de preguntas incorrectas por estudiante.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport("csv")}
            disabled={loading || !filteredRows.length || exporting !== ""}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void handleExport("excel")}
            disabled={loading || !filteredRows.length || exporting !== ""}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => void handleExport("pdf")}
            disabled={loading || !filteredRows.length || exporting !== ""}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full max-w-3xl flex-col gap-2 sm:flex-row">
            <input
              value={examCodeFilter}
              onChange={(e) => setExamCodeFilter(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Filtrar por código de examen (6 dígitos)..."
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por examen, estudiante, documento, correo o estado..."
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
          <p className="text-sm text-zinc-600">
            {loading ? "Cargando..." : `${filteredRows.length} resultados`}
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando resultados...
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2">Examen</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Estudiante</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">0-5</th>
                  <th className="px-3 py-2">0-50</th>
                  <th className="px-3 py-2">Fraude</th>
                  <th className="px-3 py-2">Malas</th>
                  <th className="px-3 py-2">Detalle</th>
                  <th className="px-3 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 align-top">
                    <td className="px-3 py-2 text-zinc-900">{r.examName}</td>
                    <td className="px-3 py-2 text-zinc-700">{r.examCode}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-900">{r.studentFullName}</p>
                      <p className="text-xs text-zinc-500">{r.email}</p>
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{r.documentId}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{r.status}</span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-zinc-900">{r.grade0to5.toFixed(2)}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-900">{r.grade0to50.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-zinc-900">{r.fraudTotal}</p>
                      <p className="text-xs text-zinc-500">
                        Pestaña {r.fraudTabSwitches} • Copiar/Pegar {r.fraudClipboardAttempts}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-zinc-900">{r.wrongCount}</p>
                      {r.wrongDetails.length ? (
                        <p className="mt-1 max-w-[360px] text-xs text-zinc-500">{r.wrongDetails.slice(0, 2).join(" || ")}</p>
                      ) : (
                        <p className="mt-1 text-xs text-emerald-700">Sin preguntas malas detectadas.</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRow(r)}
                        className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        Ver detalle
                      </button>
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{formatDate(r.submittedAt)}</td>
                  </tr>
                ))}
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-sm text-zinc-500">
                      No hay resultados para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRow ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedRow(null)}
            aria-label="Cerrar detalle"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-5xl rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-y-8 sm:bottom-auto sm:rounded-3xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">Detalle del intento</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {selectedRow.studentFullName} • {selectedRow.examName} • Código {selectedRow.examCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Nota 0-5</p>
                <p className="text-base font-semibold text-zinc-900">{selectedRow.grade0to5.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Nota 0-50</p>
                <p className="text-base font-semibold text-zinc-900">{selectedRow.grade0to50.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Fraude total</p>
                <p className="text-base font-semibold text-zinc-900">{selectedRow.fraudTotal}</p>
                <p className="text-[11px] text-zinc-500">
                  Pestaña {selectedRow.fraudTabSwitches} • Copiar/Pegar {selectedRow.fraudClipboardAttempts}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Preguntas malas</p>
                <p className="text-base font-semibold text-zinc-900">{selectedRow.wrongCount}</p>
              </div>
            </div>

            <div className="mt-4 max-h-[58vh] overflow-y-auto rounded-2xl border border-zinc-200">
              {selectedRow.wrongDetails.length ? (
                <div className="divide-y divide-zinc-100">
                  {selectedRow.wrongDetails.map((item, idx) => (
                    <div key={`${selectedRow.id}-${idx}`} className="px-4 py-3 text-sm text-zinc-800">
                      <p className="font-semibold text-zinc-900">Pregunta mala #{idx + 1}</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-zinc-700">{item}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-emerald-700">
                  Sin preguntas malas detectadas en este intento.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
