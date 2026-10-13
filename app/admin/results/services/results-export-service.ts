import { collection, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { ResultRow, SnapshotQuestion } from "../types";
import {
  answerPreview,
  evaluateQuestion,
  expectedAnswerPreview,
  formatDate,
  fraudRiskLabel,
  isAnswered,
  isFullyCorrect,
  normalizeCsvCell,
  openConceptFeedback,
  reasonWrong,
  safeFilenamePart,
  statusColorHex,
  toDate,
  toNumber,
  toString,
  toTextPreview,
} from "./results-service";

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportResultsCsv(rows: ResultRow[]) {
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
    ...rows.map((r) =>
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

export async function exportResultsExcel(rows: ResultRow[]) {
  type ExcelCell = {
    value?: unknown;
    font?: unknown;
    alignment?: unknown;
    fill?: unknown;
    border?: unknown;
    numFmt?: unknown;
  } & Record<string, unknown>;
  type ExcelRow = { height?: number; eachCell: (cb: (cell: ExcelCell, col: number) => void) => void } & Record<string, unknown>;
  type ExcelWorksheet = {
    mergeCells: (ref: string) => void;
    getCell: (addr: string) => ExcelCell;
    getRow: (idx: number) => ExcelRow;
    addRow: (vals: unknown[]) => ExcelRow;
    columns?: Array<{ key?: string; width?: number }>;
    autoFilter?: string;
    eachRow: (cb: (row: ExcelRow, rowNumber: number) => void) => void;
  } & Record<string, unknown>;
  type ExcelWorkbook = {
    creator?: string;
    created?: Date;
    addWorksheet: (name: string, opts?: Record<string, unknown>) => ExcelWorksheet;
    xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
  } & Record<string, unknown>;
  type ExcelJsModule = { Workbook?: new () => ExcelWorkbook; default?: { Workbook?: new () => ExcelWorkbook } };

  const ExcelJSImport = (await import("exceljs")) as unknown;
  const mod = ExcelJSImport as ExcelJsModule;
  const WorkbookCtor = mod.Workbook ?? mod.default?.Workbook;
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
  ws.getCell("A2").value = `Generado: ${new Date().toLocaleString("es-CO")} • Registros: ${rows.length}`;
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
  ws.getRow(4).eachCell((cell: ExcelCell) => {
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

  rows.forEach((r) => {
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
    row.eachCell((cell: ExcelCell, col: number) => {
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
  detail.getRow(2).eachCell((cell: ExcelCell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4C1D95" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  rows.forEach((r) => {
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
  detail.eachRow((row: ExcelRow, rowNumber: number) => {
    if (rowNumber <= 2) return;
    row.eachCell((cell: ExcelCell) => {
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

export async function exportResultsPdf(rows: ResultRow[]) {
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
  doc.text(`Generado: ${new Date().toLocaleString("es-CO")} • Registros: ${rows.length}`, 24, 48);
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
    body: rows.map((r) => [
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
    body: rows.map((r) => [
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

export async function buildAttemptPdf(row: ResultRow): Promise<{ filename: string; blob: Blob }> {
  const attemptSnap = await getDoc(doc(firestore, "attempts", row.id));
  if (!attemptSnap.exists()) throw new Error("No se encontró el intento en Firestore.");

  const attempt = attemptSnap.data() as Record<string, unknown>;
  const publishedExamId = toString(attempt.publishedExamId, "");
  const examName = toString(attempt.examName, row.examName);
  const student = toString(attempt.studentFullName, row.studentFullName);
  const email = toString(attempt.email, row.email);
  const documentId = toString(attempt.documentId, row.documentId);
  const submittedAt = toDate(attempt.submittedAt) ?? row.submittedAt;
  const status = toString(attempt.status, row.status);
  const grade0to5 = toNumber(attempt.grade0to5, row.grade0to5);
  const grade0to50 = toNumber(attempt.grade0to50, row.grade0to50);
  const fraudTabSwitches = toNumber(attempt.fraudTabSwitches, row.fraudTabSwitches);
  const fraudClipboardAttempts = toNumber(attempt.fraudClipboardAttempts, row.fraudClipboardAttempts);
  const fraudTotal = fraudTabSwitches + fraudClipboardAttempts;
  const adminMessage = toString(attempt.adminMessage, "").trim();

  const examMetaSnap = publishedExamId ? await getDoc(doc(firestore, "publishedExams", publishedExamId)) : null;
  const accessCode = examMetaSnap?.exists()
    ? toString((examMetaSnap.data() as Record<string, unknown>).accessCode, row.examCode)
    : row.examCode;

  const qSnap = publishedExamId
    ? await getDocs(query(collection(firestore, "publishedExams", publishedExamId, "questions"), limit(400)))
    : null;
  const questions: SnapshotQuestion[] = (qSnap?.docs ?? [])
    .map((d) => {
      const q = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        questionId: toString(q.questionId, d.id),
        order: toNumber(q.order, 0),
        type: toString(q.type, "single_choice"),
        statement: toString(q.statement, ""),
        points: toNumber(q.points, 1),
        options: Array.isArray(q.options) ? (q.options as SnapshotQuestion["options"]) : undefined,
        partialCredit: Boolean(q.partialCredit),
        answerRules: (q.answerRules as SnapshotQuestion["answerRules"]) ?? undefined,
        puzzle: (q.puzzle as Record<string, unknown>) ?? undefined,
      } satisfies SnapshotQuestion;
    })
    .sort((a, b) => a.order - b.order);

  const answers = (attempt.answers as Record<string, unknown>) ?? {};
  const order = Array.isArray(attempt.questionOrder)
    ? (attempt.questionOrder as unknown[]).map((x) => toString(x)).filter(Boolean)
    : [];
  const byId = new Map(questions.map((q) => [q.questionId, q] as const));
  const orderedQuestions =
    order.length > 0
      ? [
          ...order.map((id) => byId.get(id)).filter((q): q is SnapshotQuestion => Boolean(q)),
          ...questions.filter((q) => !order.includes(q.questionId)),
        ]
      : questions;

  let totalPoints = 0;
  let earnedPoints = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const detailRows = orderedQuestions.map((q, idx) => {
    const ans = answers[q.questionId];
    const earned = evaluateQuestion(q, ans);
    const correct = isFullyCorrect(q, ans);
    const answered = isAnswered(q, ans);
    totalPoints += q.points;
    earnedPoints += earned;
    if (!answered) unansweredCount += 1;
    if (correct) correctCount += 1;
    else wrongCount += 1;
    const feedback =
      correct ? "Correcto." : q.type === "open_concept" ? openConceptFeedback(q, ans) : reasonWrong(q, ans);
    return {
      idx: idx + 1,
      statement: toTextPreview(q.statement, 260) || "-",
      studentAnswer: answerPreview(q, ans),
      expected: expectedAnswerPreview(q),
      score: `${Number.isFinite(earned) ? earned.toFixed(2) : "0.00"} / ${q.points.toFixed(2)}`,
      result: correct ? "Bien" : "Por mejorar",
      feedback,
    };
  });

  const jsPDFModule = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const jsPDF = jsPDFModule.default;
  const autoTable = autoTableModule.default;

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setFillColor(109, 94, 246);
  pdf.rect(0, 0, pageWidth, 82, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.text("Resultado del Examen", 32, 36);
  pdf.setFontSize(10);
  pdf.text("Z-Suite Eval", 32, 58);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(11);
  pdf.text(`Estudiante: ${student}`, 32, 112);
  pdf.text(`Documento: ${documentId} • Correo: ${email}`, 32, 132);
  pdf.text(`Examen: ${examName} • Código: ${accessCode}`, 32, 152);
  pdf.text(`Estado: ${status} • Enviado: ${formatDate(submittedAt)}`, 32, 172);

  const statY = 200;
  const cardW = (pageWidth - 32 * 2 - 12 * 3) / 4;
  const cardH = 64;
  const cards = [
    { label: "Nota", value: `${grade0to5.toFixed(2)} (${grade0to50.toFixed(0)}/50)` },
    { label: "Correctas", value: String(correctCount) },
    { label: "Por mejorar", value: String(wrongCount) },
    { label: "Fraude", value: String(fraudTotal) },
  ];
  cards.forEach((c, i) => {
    const x = 32 + i * (cardW + 12);
    pdf.setFillColor(255, 255, 255);
    (pdf as unknown as { roundedRect?: (...args: unknown[]) => void }).roundedRect?.(x, statY, cardW, cardH, 14, 14, "F");
    pdf.setDrawColor(230, 232, 240);
    (pdf as unknown as { roundedRect?: (...args: unknown[]) => void }).roundedRect?.(x, statY, cardW, cardH, 14, 14, "S");
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(9);
    pdf.text(c.label, x + 14, statY + 22);
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(18);
    pdf.text(c.value, x + 14, statY + 48);
  });

  const generalLines: string[] = [];
  generalLines.push(`Puntaje: ${earnedPoints.toFixed(2)} / ${totalPoints.toFixed(2)} • Sin responder: ${unansweredCount}`);
  if (fraudTotal > 0) {
    generalLines.push(`Se detectaron eventos de fraude: pestaña ${fraudTabSwitches}, copiar/pegar ${fraudClipboardAttempts}.`);
  }
  if (adminMessage) {
    generalLines.push(`Mensaje del profesor: ${adminMessage}`);
  }
  if (!generalLines.length) {
    generalLines.push("Sin observaciones adicionales.");
  }

  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Retroalimentación general", 32, 296);
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  const wrap = pdf.splitTextToSize(generalLines.join("\n"), pageWidth - 64);
  pdf.text(wrap, 32, 316);

  pdf.addPage();
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 56, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.text("Detalle por pregunta", 32, 34);
  pdf.setFontSize(10);
  pdf.text(`${student} • ${examName}`, 32, 50);

  pdf.setTextColor(15, 23, 42);
  autoTable(pdf, {
    startY: 76,
    head: [["#", "Resultado", "Pregunta", "Respuesta", "Esperada", "Puntaje", "Retroalimentación"]],
    body: detailRows.map((r) => [
      String(r.idx),
      r.result,
      r.statement,
      r.studentAnswer,
      r.expected,
      r.score,
      r.feedback,
    ]),
    styles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55], overflow: "linebreak" },
    headStyles: { fillColor: [109, 94, 246], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 247, 251] },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 70 },
      5: { cellWidth: 72, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 1) {
        const v = String((data.cell.raw ?? "") as string).toLowerCase();
        if (v.includes("bien")) data.cell.styles.fillColor = [220, 252, 231];
        if (v.includes("mejorar")) data.cell.styles.fillColor = [254, 226, 226];
      }
    },
  });

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Z-Suite Eval • Página ${i} / ${totalPages}`, 32, pageHeight - 22);
  }

  const filename = `resultado-${safeFilenamePart(student)}-${safeFilenamePart(examName)}-${safeFilenamePart(accessCode)}.pdf`;
  const blob = pdf.output("blob");
  return { filename, blob };
}

export async function exportAttemptPdf(row: ResultRow) {
  const { filename, blob } = await buildAttemptPdf(row);
  downloadBlob(blob, filename, "application/pdf");
}

export async function exportSelectedAttemptsZip(rows: ResultRow[]) {
  type JSZipLike = { file: (name: string, data: Blob) => void; generateAsync: (opts: Record<string, unknown>) => Promise<Blob> };
  type JSZipCtor = new () => JSZipLike;
  const JSZipModule = (await import("jszip")) as unknown;
  const mod = JSZipModule as { default?: JSZipCtor };
  const JSZipCtor = mod.default ?? (JSZipModule as JSZipCtor);
  const zip = new JSZipCtor();
  const sorted = [...rows].sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));

  for (const row of sorted) {
    try {
      const { filename, blob } = await buildAttemptPdf(row);
      zip.file(filename, blob);
    } catch {}
  }

  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  downloadBlob(zipBlob, `resultados-${Date.now()}.zip`, "application/zip");
}
