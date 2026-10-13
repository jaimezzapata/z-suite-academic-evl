import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { AttemptRow, AttemptMetrics } from "../types";

export function toString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function toMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const toMillisFn = (v as { toMillis?: unknown }).toMillis;
  if (typeof toMillisFn === "function") {
    try {
      return (toMillisFn as () => number)();
    } catch {
      return null;
    }
  }
  const seconds = typeof v.seconds === "number" ? v.seconds : null;
  if (seconds === null) return null;
  const nanos = typeof v.nanoseconds === "number" ? v.nanoseconds : 0;
  return seconds * 1000 + Math.floor(nanos / 1_000_000);
}

export function countAnswered(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const record = value as Record<string, unknown>;
  let count = 0;
  Object.values(record).forEach((item) => {
    if (item === null || item === undefined) return;
    if (typeof item === "string" && !item.trim()) return;
    count += 1;
  });
  return count;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function formatPercent(value: number): string {
  const next = clampNumber(value, 0, 100);
  return `${Math.round(next)}%`;
}

export function normalizeOtp(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 6);
}

export function computeAttemptMetrics(attempts: AttemptRow[]): AttemptMetrics {
  const perAttempt = attempts.map((a) => {
    const total = Math.max(0, a.questionCount);
    const answered = countAnswered(a.answers);
    const progressPct = total ? (answered / total) * 100 : 0;
    const fraudEvents = Math.max(0, a.fraudTabSwitches) + Math.max(0, a.fraudClipboardAttempts);
    const isSubmitted = a.status.startsWith("submitted");
    const isInProgress = a.status === "in_progress";
    const isAnnulled = a.status === "annulled";
    const isFraudStatus = a.status === "submitted_fraud";
    return {
      attempt: a,
      total,
      answered,
      progressPct,
      fraudEvents,
      isSubmitted,
      isInProgress,
      isAnnulled,
      isFraudStatus,
    };
  });

  const totals = perAttempt.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.isInProgress) acc.inProgress += 1;
      if (item.isSubmitted) acc.submitted += 1;
      if (item.isAnnulled) acc.annulled += 1;
      if (item.isFraudStatus || item.attempt.fraudForcedFail || item.fraudEvents >= 6) {
        acc.suspicious += 1;
      }
      if (item.isInProgress) {
        acc.inProgressProgressSum += item.progressPct;
        acc.inProgressCount += 1;
      }
      acc.fraudEventsSum += item.fraudEvents;
      return acc;
    },
    {
      total: 0,
      inProgress: 0,
      submitted: 0,
      annulled: 0,
      suspicious: 0,
      fraudEventsSum: 0,
      inProgressProgressSum: 0,
      inProgressCount: 0,
    },
  );

  const avgProgressInProgress = totals.inProgressCount
    ? totals.inProgressProgressSum / totals.inProgressCount
    : 0;
  const avgFraudEvents = totals.total ? totals.fraudEventsSum / totals.total : 0;
  const suspiciousTop = perAttempt
    .filter((item) => item.fraudEvents > 0 || item.attempt.fraudForcedFail || item.isFraudStatus)
    .sort((a, b) => b.fraudEvents - a.fraudEvents)
    .slice(0, 6);

  return {
    perAttempt,
    totals,
    avgProgressInProgress,
    avgFraudEvents,
    suspiciousTop,
  };
}

export async function closeExamApi(publishedExamId: string, token: string) {
  const res = await fetch("/api/admin/published-exams/close", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ publishedExamId }),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "No fue posible cerrar el examen.");
  }
  return data;
}

export async function updateExamTimeLimit(publishedExamId: string, minutes: number) {
  await updateDoc(doc(firestore, "publishedExams", publishedExamId), {
    timeLimitMinutes: Math.round(minutes),
    timeLimitUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function sendStudentAdminMessage(attemptId: string, message: string) {
  await updateDoc(doc(firestore, "attempts", attemptId), {
    adminMessage: message,
    adminMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function annulAttempt(attemptId: string, reason: string) {
  await updateDoc(doc(firestore, "attempts", attemptId), {
    status: "annulled",
    earnedPoints: 0,
    grade0to5: 0,
    grade0to50: 0,
    annulReason: reason,
    annulledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
