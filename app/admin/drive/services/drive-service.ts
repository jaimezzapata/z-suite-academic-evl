import { getSubjectTechnologyMeta } from "@/lib/subject-tech-branding";
import type { DriveWorkspaceRow, CreateStructurePayload } from "../types";

export const WORKLOAD_FOCUS_STORAGE_KEY = "workload-focus";
export const WEEK_DAY_OPTIONS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"] as const;
export const WEEKDAY_ORDER = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"] as const;

export function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeCesdeGroupType(value: unknown): "EMPRESARIAL" | "REGULAR" {
  return toString(value, "").trim().toUpperCase() === "EMPRESARIAL" ? "EMPRESARIAL" : "REGULAR";
}

export function toWorkspaceRow(id: string, data: Record<string, unknown>): DriveWorkspaceRow {
  const drive = (data.drive as Record<string, unknown> | undefined) ?? {};
  const health = (data.health as Record<string, unknown> | undefined) ?? undefined;
  return {
    id,
    institution: toString(data.institution, ""),
    cesdeGroupType: normalizeCesdeGroupType(data.cesdeGroupType),
    subjectId: toString(data.subjectId, ""),
    subjectName: toString(data.subjectName, toString(data.subjectId, id)),
    groupId: toString(data.groupId, ""),
    groupName: toString(data.groupName, toString(data.groupId, "")),
    period: toString(data.period, ""),
    campus: toString(data.campus, ""),
    jornada: toString(data.jornada, ""),
    dayOfWeek1: toString(data.dayOfWeek1, ""),
    dayOfWeek2: toString(data.dayOfWeek2, ""),
    startTime: toString(data.startTime, ""),
    endTime: toString(data.endTime, ""),
    day2StartTime: toString(data.day2StartTime, ""),
    day2EndTime: toString(data.day2EndTime, ""),
    weekCount: toNumber(data.weekCount, 0),
    startDate: toString(data.startDate, ""),
    endDate: toString(data.endDate, ""),
    year: toNumber(data.year, 0),
    periodCode: toString(data.periodCode, ""),
    health: health
      ? {
          broken: Boolean(health.broken),
          issues: Array.isArray(health.issues) ? health.issues : undefined,
          lastCheckedAt: health.lastCheckedAt,
        }
      : undefined,
    drive: {
      groupFolderUrl: toString(drive.groupFolderUrl, ""),
      adminFolderUrl: toString(drive.adminFolderUrl, ""),
      publicFolderUrl: toString(drive.publicFolderUrl, ""),
      groupFolderId: toString(drive.groupFolderId, ""),
      adminFolderId: toString(drive.adminFolderId, ""),
      publicFolderId: toString(drive.publicFolderId, ""),
    },
  };
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatDays(day1: string, day2: string): string {
  if (day1 && day2) return `${day1} y ${day2}`;
  return day1 || "-";
}

export function formatDateRange(startDate: string, endDate: string): string {
  if (startDate && endDate) return `${startDate} -> ${endDate}`;
  return startDate || endDate || "-";
}

export function formatScheduleRange(dayLabel: string, startTime: string, endTime: string): string {
  if (!dayLabel) return "";
  if (startTime && endTime) return `${dayLabel} ${startTime} - ${endTime}`;
  return dayLabel;
}

export function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every((n) => Number.isFinite(n))) return null;
  return new Date(year, month - 1, day);
}

export function dayNameFromIsoDate(value: string): string {
  const date = parseLocalDate(value);
  if (!date) return "";
  return ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"][date.getDay()] ?? "";
}

export function resolveScheduleDays(args: {
  institution: "CESDE" | "SENA";
  cesdeGroupType: "REGULAR" | "EMPRESARIAL";
  startDate: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
}) {
  const usesManualWeekdays =
    args.institution === "SENA" || (args.institution === "CESDE" && args.cesdeGroupType === "EMPRESARIAL");
  return {
    usesManualWeekdays,
    dayOfWeek1: args.dayOfWeek1 || dayNameFromIsoDate(args.startDate),
    dayOfWeek2: usesManualWeekdays ? args.dayOfWeek2 : "",
  };
}

export function parseFolderDate(folderName: string): Date | null {
  const match = folderName.match(/\((\d{2})\/(\d{2})\/(\d{4})\)/);
  if (!match) return null;
  const day = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const year = Number.parseInt(match[3]!, 10);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatFolderDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getWeekdayLabelFromDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-CO", { weekday: "long" })
    .format(date)
    .replace(/^\w/, (char) => char.toUpperCase())
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getWeekdayOrder(label: string): number {
  const index = WEEKDAY_ORDER.indexOf(label as (typeof WEEKDAY_ORDER)[number]);
  return index === -1 ? WEEKDAY_ORDER.length : index;
}

export function makeWorkspaceId(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("__")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 250);
}

export function makeManualWorkspaceId(args: {
  institution: string;
  period: string;
  siteName: string;
  shiftName: string;
  groupId: string;
  subjectId: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
}): string {
  return makeWorkspaceId([
    args.institution.toUpperCase(),
    args.period,
    args.siteName.toUpperCase(),
    args.shiftName.toUpperCase(),
    args.groupId,
    args.subjectId,
    args.dayOfWeek1.toUpperCase(),
    args.dayOfWeek2.toUpperCase() || "SIN_SEGUNDO_DIA",
  ]);
}

export function getDriveActionTone(subjectName: string) {
  const techMeta = getSubjectTechnologyMeta(subjectName);
  if (!techMeta) {
    return {
      link: "border-zinc-200 bg-white/90 text-zinc-700 hover:bg-white",
      primary: "border-zinc-300 bg-zinc-900 text-white hover:bg-zinc-800",
      danger: "border-zinc-200 bg-white/90 text-zinc-700 hover:bg-zinc-50",
    };
  }

  const palette = techMeta.badgeClassName
    .replace("text-", "hover:text-")
    .replace("bg-", "hover:bg-");

  return {
    link: `${techMeta.badgeClassName} hover:brightness-[0.99]`,
    primary: `${techMeta.iconWrapClassName} border border-current/10 hover:brightness-95`,
    danger: `${techMeta.badgeClassName} border-dashed hover:brightness-[0.99]`,
    palette,
  };
}

export async function bootstrapDriveApi(payload: CreateStructurePayload, token: string) {
  const response = await fetch("/api/admin/drive/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `No fue posible crear (HTTP ${response.status}).`,
    );
  }
  return data;
}

export async function validateDriveWorkspaceApi(workspaceId: string, token: string) {
  const response = await fetch("/api/admin/drive/workspaces/validate", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ workspaceId }),
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `No fue posible sincronizar (HTTP ${response.status}).`,
    );
  }
  return data;
}

export async function deleteDriveWorkspaceApi(workspaceId: string, token: string) {
  const response = await fetch("/api/admin/drive/workspaces/delete", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ workspaceId }),
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok && response.status !== 404) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `No fue posible eliminar (HTTP ${response.status}).`,
    );
  }
  return data;
}
