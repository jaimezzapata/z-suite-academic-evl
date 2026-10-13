import type { CalendarEventItem, GeneralScheduleReportRow, PayrollStatementRow } from "../types";
import {
  CALENDAR_END_MINUTES,
  CALENDAR_LABELS,
  CALENDAR_SLOTS,
  CALENDAR_START_MINUTES,
  formatCompactDateRange,
  formatCurrency,
  formatDateRange,
  formatDayMonth,
  formatHours,
  formatLongDate,
  formatTimeRange,
  formatWeekRange,
  formatWeekday,
  isoDate,
  normalizeCsvValue,
} from "./workload-date-utils";

export async function downloadCalendarPdf({
  calendarEvents,
  calendarDays,
  calendarHolidayMap,
  calendarWeekStart,
  tab,
}: {
  calendarEvents: CalendarEventItem[];
  calendarDays: Date[];
  calendarHolidayMap: Map<string, string>;
  calendarWeekStart: Date;
  tab: string;
}): Promise<void> {
  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 24;
  const headerTop = 28;
  const headerBottom = 92;
  const timeColumnWidth = 54;
  const dayHeaderHeight = 42;
  const gridTop = headerBottom + dayHeaderHeight;
  const gridBottom = pageHeight - 24;
  const gridHeight = gridBottom - gridTop;
  const gridWidth = pageWidth - marginX * 2 - timeColumnWidth;
  const dayColumnWidth = gridWidth / 7;
  const slotHeight = gridHeight / CALENDAR_SLOTS;
  const calendarLabel = tab === "ALL" ? "Horario general" : `Horario ${tab}`;
  const exportedAt = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const eventPalette = (institution: string) =>
    institution.toUpperCase() === "SENA"
      ? {
          fill: [220, 252, 231] as const,
          border: [16, 185, 129] as const,
          text: [6, 78, 59] as const,
        }
      : {
          fill: [250, 232, 255] as const,
          border: [192, 38, 211] as const,
          text: [112, 26, 117] as const,
        };

  const writeClampedText = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    maxLines: number,
    lineHeight: number,
  ) => {
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    lines.slice(0, maxLines).forEach((line, index) => {
      const content = index === maxLines - 1 && lines.length > maxLines ? `${line}...` : line;
      doc.text(content, x, y + index * lineHeight);
    });
  };

  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text(calendarLabel, marginX, headerTop);
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Semana: ${formatWeekRange(calendarWeekStart)}`, marginX, headerTop + 18);
  doc.text(`Generado: ${exportedAt}`, marginX, headerTop + 32);
  doc.text(`Bloques visibles: ${calendarEvents.length}`, marginX, headerTop + 46);

  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(marginX, headerBottom, timeColumnWidth, dayHeaderHeight, 8, 8, "FD");
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.text("Hora", marginX + 14, headerBottom + 24);

  calendarDays.forEach((day, index) => {
    const holidayName = calendarHolidayMap.get(isoDate(day));
    const x = marginX + timeColumnWidth + index * dayColumnWidth;
    doc.setFillColor(holidayName ? 255 : 249, holidayName ? 247 : 250, holidayName ? 237 : 251);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, headerBottom, dayColumnWidth, dayHeaderHeight, 8, 8, "FD");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(String(formatWeekday(day)).toUpperCase(), x + 8, headerBottom + 15);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(formatDayMonth(day), x + 8, headerBottom + 30);
    if (holidayName) {
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      writeClampedText("Festivo", x + dayColumnWidth - 42, headerBottom + 15, 34, 1, 8);
    }
  });

  for (let index = 0; index <= CALENDAR_SLOTS; index += 1) {
    const y = gridTop + index * slotHeight;
    doc.setDrawColor(229, 231, 235);
    doc.line(marginX + timeColumnWidth, y, pageWidth - marginX, y);
    if (index < CALENDAR_SLOTS) {
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text(CALENDAR_LABELS[index] ?? "", marginX + 6, y + 10);
    }
  }

  for (let index = 0; index <= 7; index += 1) {
    const x = marginX + timeColumnWidth + index * dayColumnWidth;
    doc.setDrawColor(229, 231, 235);
    doc.line(x, headerBottom, x, gridBottom);
  }

  calendarEvents.forEach((event) => {
    const x = marginX + timeColumnWidth + event.dayIndex * dayColumnWidth + 3;
    const y =
      gridTop +
      ((event.startMinutes - CALENDAR_START_MINUTES) / (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES)) * gridHeight +
      2;
    const width = dayColumnWidth - 6;
    const height = Math.max(
      24,
      (event.durationMinutes / (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES)) * gridHeight - 4,
    );
    const palette = eventPalette(event.row.institution);

    doc.setFillColor(palette.fill[0], palette.fill[1], palette.fill[2]);
    doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
    doc.roundedRect(x, y, width, height, 6, 6, "FD");

    doc.setTextColor(palette.text[0], palette.text[1], palette.text[2]);
    doc.setFontSize(8);
    writeClampedText(event.subjectName, x + 6, y + 10, width - 12, height > 58 ? 2 : 1, 9);
    doc.setFontSize(7);
    writeClampedText(event.audienceName, x + 6, y + (height > 58 ? 28 : 20), width - 12, 1, 8);
    writeClampedText(
      `${event.timeRange} | ${event.classroom || "N/A"}`,
      x + 6,
      y + (height > 58 ? 39 : 30),
      width - 12,
      height > 78 ? 2 : 1,
      8,
    );
    if (height > 92) {
      writeClampedText(event.shortDateRange, x + 6, y + height - 10, width - 12, 1, 8);
    }
  });

  const safeWeek = isoDate(calendarWeekStart);
  const scope = tab === "ALL" ? "todo" : tab.toLowerCase();
  doc.save(`horario-${scope}-${safeWeek}.pdf`);
}

export function downloadGeneralScheduleCsv(rows: GeneralScheduleReportRow[]): void {
  const headers = [
    "Institucion",
    "Tipo CESDE",
    "Periodo",
    "Materia",
    "Tipo audiencia",
    "Grupo o ficha",
    "Sede",
    "Jornada",
    "Salon",
    "Fecha inicio",
    "Fecha fin",
    "Cantidad semanas",
    "Dias",
    "Hora inicio dia 1",
    "Hora fin dia 1",
    "Horas dia 1",
    "Hora inicio dia 2",
    "Hora fin dia 2",
    "Horas dia 2",
    "Horas semanales",
    "Sesiones por semana",
    "Resumen horario",
    "Estado Drive",
    "URL publica Drive",
    "Estado",
  ];

  const lines = [
    headers.map((value) => normalizeCsvValue(value)).join(","),
    ...rows.map((row) =>
      [
        row.institution,
        row.cesdeGroupType,
        row.period,
        row.subject,
        row.groupOrFichaType,
        row.groupOrFichaName,
        row.site,
        row.shift,
        row.classroom,
        row.startDate,
        row.endDate,
        row.coveredWeeks,
        row.days,
        row.day1Start,
        row.day1End,
        row.day1Hours,
        row.day2Start,
        row.day2End,
        row.day2Hours,
        row.weeklyHours,
        row.weeklySessions,
        row.scheduleSummary,
        row.driveStatus,
        row.drivePublicFolderUrl,
        row.active,
      ]
        .map((value) => normalizeCsvValue(value))
        .join(","),
    ),
  ];

  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reporte-horarios-general-${isoDate(new Date())}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadGeneralSchedulePdf(rows: GeneralScheduleReportRow[]): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const exportedAt = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text("Reporte general de horarios", 28, 32);
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Generado: ${exportedAt}`, 28, 48);
  doc.text(`Total cargas: ${rows.length}`, 28, 62);

  autoTable(doc, {
    startY: 76,
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 4,
      lineColor: [230, 230, 230],
      lineWidth: 0.5,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55] },
    head: [[
      "Inst.",
      "Materia",
      "Grupo/Ficha",
      "Sede",
      "Jornada",
      "Inicio",
      "Fin",
      "Sem.",
      "Dias",
      "Horario",
      "H sem.",
      "Drive",
    ]],
    body: rows.map((row) => [
      row.institution,
      row.subject,
      `${row.groupOrFichaType} ${row.groupOrFichaName}`,
      row.site,
      row.shift,
      row.startDate,
      row.endDate,
      String(row.coveredWeeks),
      row.days,
      row.scheduleSummary,
      row.weeklyHours,
      row.driveStatus,
    ]),
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 95 },
      2: { cellWidth: 88 },
      3: { cellWidth: 70 },
      4: { cellWidth: 62 },
      5: { cellWidth: 52 },
      6: { cellWidth: 52 },
      7: { cellWidth: 34 },
      8: { cellWidth: 74 },
      9: { cellWidth: 150 },
      10: { cellWidth: 42 },
      11: { cellWidth: 46 },
    },
  });

  doc.save(`reporte-horarios-general-${isoDate(new Date())}.pdf`);
}

export async function downloadPayrollStatementPdf(statement: PayrollStatementRow): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 36;
  let cursorY = 42;

  doc.setFontSize(18);
  doc.text("Colilla de pago CESDE", marginX, cursorY);
  cursorY += 18;
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Corte: ${formatLongDate(statement.rangeStart)} - ${formatLongDate(statement.rangeEnd)}`, marginX, cursorY);
  cursorY += 14;
  doc.text(`Generada: ${statement.createdAtLabel || "-"}`, marginX, cursorY);
  cursorY += 14;
  doc.text(`Generó: ${statement.createdByName || statement.createdByEmail || "-"}`, marginX, cursorY);
  cursorY += 24;

  autoTable(doc, {
    startY: cursorY,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.5 },
    headStyles: { fillColor: [248, 245, 255], textColor: [77, 53, 140] },
    head: [["Fecha", "Materia", "Grupo", "Sede", "Jornada", "Hora", "Salón", "Horas", "Vlr hora", "Valor"]],
    body: statement.items.map((item) => [
      `${item.date} (${item.dayName})`,
      item.subjectName,
      item.audienceType === "ficha" ? `Ficha ${item.audienceName}` : item.audienceName,
      item.siteName,
      item.shiftName,
      `${item.startTime} - ${item.endTime}`,
      item.classroom || "-",
      formatHours(item.academicHours),
      formatCurrency(item.hourlyRate),
      formatCurrency(item.estimatedValue),
    ]),
    foot: [["", "", "", "", "", "", "Total", formatHours(statement.totalHours), "", formatCurrency(statement.totalValue)]],
  });

  doc.save(`colilla-cesde-${statement.rangeStart}-${statement.rangeEnd}.pdf`);
}
