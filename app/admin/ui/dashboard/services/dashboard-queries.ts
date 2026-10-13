import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { DashboardData, TeachingLoadRow, DriveWorkspaceRow } from "../types";

function safeToString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function countFromAggregateSnap(value: unknown): number {
  try {
    if (value && typeof value === "object" && "data" in value) {
      const dataFn = (value as { data?: unknown }).data;
      if (typeof dataFn === "function") {
        const data = (dataFn as () => unknown)();
        if (data && typeof data === "object" && "count" in data) {
          const c = (data as { count?: unknown }).count;
          if (typeof c === "number" && Number.isFinite(c)) return c;
        }
      }
    }
  } catch {}
  return 0;
}

function docsFromQuerySnap<T = unknown>(value: unknown): T[] {
  if (value && typeof value === "object" && "docs" in value) {
    const docs = (value as { docs?: unknown }).docs;
    if (Array.isArray(docs)) return docs as T[];
  }
  return [];
}

function minutesFromTimeLoose(value: string): number | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const hasPm = /\bp\.?\s*m\.?\b|\bpm\b/.test(trimmed);
  const hasAm = /\ba\.?\s*m\.?\b|\bam\b/.test(trimmed);
  if (hasPm && hour < 12) hour += 12;
  if (hasAm && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function computeDurationMinutes(
  institution: string,
  durationMinutesRaw: number,
  startTime: string,
  endTime: string,
): number {
  if (Number.isFinite(durationMinutesRaw) && durationMinutesRaw > 0) return durationMinutesRaw;
  const startMinutes = minutesFromTimeLoose(startTime);
  const endMinutes = minutesFromTimeLoose(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return 0;
  return endMinutes - startMinutes;
}

function computeAcademicHours(
  institution: string,
  academicHoursRaw: unknown,
  durationMinutes: number,
): number {
  if (typeof academicHoursRaw === "number" && Number.isFinite(academicHoursRaw) && academicHoursRaw > 0) {
    return academicHoursRaw;
  }
  const minutesPerHour = institution.toUpperCase() === "SENA" ? 60 : 45;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  return Math.max(0, Math.floor(durationMinutes / minutesPerHour));
}

function normalizeGradeTo5(item: Record<string, unknown>): number | null {
  const candidates = [
    item.grade0to5,
    item.score0to5,
    item.finalScore5,
    item.grade5,
    item.score5,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
  }
  if (typeof item.grade0to50 === "number" && Number.isFinite(item.grade0to50)) {
    return item.grade0to50 / 10;
  }
  if (typeof item.score0to50 === "number" && Number.isFinite(item.score0to50)) {
    return item.score0to50 / 10;
  }
  return null;
}

function toDateFromTimestamp(value: unknown): Date | null {
  if (!value || typeof value !== "object") return null;
  try {
    if ("toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate();
    }
  } catch {
    return null;
  }
  return null;
}

export interface DashboardFetchResult {
  data: DashboardData;
  teachingLoads: TeachingLoadRow[];
  driveWorkspaces: DriveWorkspaceRow[];
  issues: string[];
}

export async function fetchDashboardData(): Promise<DashboardFetchResult> {
  const submittedStatuses = new Set(["submitted", "submitted_expired", "submitted_fraud"]);
  const now = new Date();
  const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const fetches: Record<string, Promise<unknown>> = {
    templatesTotal: getCountFromServer(collection(firestore, "examTemplates")),
    templatesActive: getCountFromServer(query(collection(firestore, "examTemplates"), where("active", "==", true))),
    publishedActive: getCountFromServer(query(collection(firestore, "publishedExams"), where("status", "==", "published"))),
    publishedClosed: getCountFromServer(query(collection(firestore, "publishedExams"), where("status", "==", "closed"))),
    questionsTotal: getCountFromServer(collection(firestore, "questions")),
    questionsPublished: getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "published"))),
    questionsDraft: getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "draft"))),
    questionsArchived: getCountFromServer(query(collection(firestore, "questions"), where("status", "==", "archived"))),
    subjectsTotal: getCountFromServer(collection(firestore, "subjects")),
    groupsTotal: getCountFromServer(collection(firestore, "groups")),
    fichasTotal: getCountFromServer(collection(firestore, "fichas")),
    sitesTotal: getCountFromServer(collection(firestore, "sites")),
    shiftsTotal: getCountFromServer(collection(firestore, "shifts")),
    momentsTotal: getCountFromServer(collection(firestore, "moments")),
    studyDocsActive: getCountFromServer(query(collection(firestore, "studyDocs"), where("active", "==", true))),
    driveWorkspacesTotal: getCountFromServer(collection(firestore, "driveWorkspaces")),
    driveWorkspaces: getDocs(collection(firestore, "driveWorkspaces")),
    teachingLoads: getDocs(collection(firestore, "teachingLoads")),
    attemptsTotal: getCountFromServer(collection(firestore, "attempts")),
    attemptsSubmitted: getCountFromServer(
      query(collection(firestore, "attempts"), where("status", "in", Array.from(submittedStatuses))),
    ),
    attemptsInProgress: getCountFromServer(query(collection(firestore, "attempts"), where("status", "==", "in_progress"))),
    attemptsFraudSubmitted: getCountFromServer(query(collection(firestore, "attempts"), where("status", "==", "submitted_fraud"))),
    attemptsAnnulled: getCountFromServer(query(collection(firestore, "attempts"), where("status", "==", "annulled"))),
    groups: getDocs(query(collection(firestore, "groups"), orderBy("name"), limit(300))),
    fichas: getDocs(query(collection(firestore, "fichas"), orderBy("name"), limit(800))),
    templatesSample: getDocs(query(collection(firestore, "examTemplates"), limit(60))),
    attemptsRecent: getDocs(query(collection(firestore, "attempts"), orderBy("submittedAt", "desc"), limit(500))),
  };

  const entries = Object.entries(fetches);
  const settled = await Promise.allSettled(entries.map(([, p]) => p));
  const issues: string[] = [];
  const out: Record<string, unknown> = {};

  settled.forEach((res, idx) => {
    const key = entries[idx]?.[0] ?? "unknown";
    if (res.status === "fulfilled") {
      out[key] = res.value;
    } else {
      issues.push(key);
    }
  });

  const groupDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.groups);
  const fichaDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.fichas);
  const templateDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.templatesSample);
  const attemptDocs = docsFromQuerySnap<{ data: () => Record<string, unknown> }>(out.attemptsRecent);
  const teachingLoadDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.teachingLoads);
  const driveWorkspaceDocs = docsFromQuerySnap<{ id: string; data: () => Record<string, unknown> }>(out.driveWorkspaces);

  const groups = groupDocs.map((d) => ({ id: d.id, name: safeToString(d.data().name, d.id) }));
  const fichas = fichaDocs.map((d) => ({ id: d.id, name: safeToString(d.data().name, d.id) }));
  const templates = templateDocs.map((docSnap) => {
    const row = docSnap.data();
    return {
      id: docSnap.id,
      name: safeToString(row.name, docSnap.id),
      groupId: safeToString(row.groupId, "sin-grupo"),
    };
  });

  const teachingLoadSummary = teachingLoadDocs.reduce(
    (acc, docSnap) => {
      const row = docSnap.data();
      const institution = safeToString(row.institution, "CESDE").toUpperCase();
      const durationMinutesRaw = typeof row.durationMinutes === "number" && Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0;
      const durationMinutes = computeDurationMinutes(institution, durationMinutesRaw, safeToString(row.startTime, ""), safeToString(row.endTime, ""));
      const academicHours = computeAcademicHours(institution, row.academicHours, durationMinutes);
      const active = typeof row.active === "boolean" ? row.active : true;
      acc.total += 1;
      if (active) acc.active += 1;
      acc.hoursTotal += academicHours;
      if (institution === "SENA") acc.hoursSena += academicHours;
      else acc.hoursCesde += academicHours;
      return acc;
    },
    { total: 0, active: 0, hoursTotal: 0, hoursCesde: 0, hoursSena: 0 },
  );

  const teachingLoads: TeachingLoadRow[] = teachingLoadDocs.map((docSnap) => {
    const row = docSnap.data();
    const institution = safeToString(row.institution, "CESDE").toUpperCase();
    const durationMinutesRaw = typeof row.durationMinutes === "number" && Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0;
    const day2DurationMinutesRaw = typeof row.day2DurationMinutes === "number" && Number.isFinite(row.day2DurationMinutes) ? row.day2DurationMinutes : 0;
    const startTime = safeToString(row.startTime, "");
    const endTime = safeToString(row.endTime, "");
    const day2StartTime = safeToString(row.day2StartTime, "");
    const day2EndTime = safeToString(row.day2EndTime, "");
    const durationMinutes = computeDurationMinutes(institution, durationMinutesRaw, startTime, endTime);
    const academicHours = computeAcademicHours(institution, row.academicHours, durationMinutes);
    const day2DurationMinutes = computeDurationMinutes(institution, day2DurationMinutesRaw, day2StartTime, day2EndTime);
    const day2AcademicHours = computeAcademicHours(institution, row.day2AcademicHours, day2DurationMinutes);
    return {
      id: docSnap.id,
      institution,
      cesdeGroupType: safeToString(row.cesdeGroupType, ""),
      subjectName: safeToString(row.subjectName, safeToString(row.subjectId, "Materia")),
      audienceName: safeToString(row.audienceName, safeToString(row.audienceId, "Grupo")),
      audienceType: safeToString(row.audienceType, "group"),
      siteName: safeToString(row.siteName, safeToString(row.siteId, "")),
      shiftName: safeToString(row.shiftName, safeToString(row.shiftId, "")),
      startDate: safeToString(row.startDate, ""),
      endDate: safeToString(row.endDate, ""),
      dayOfWeek1: safeToString(row.dayOfWeek1, ""),
      dayOfWeek2: safeToString(row.dayOfWeek2, ""),
      driveWorkspaceId: safeToString(row.driveWorkspaceId, ""),
      startTime,
      endTime,
      day2StartTime,
      day2EndTime,
      classroom: safeToString(row.classroom, ""),
      durationMinutes,
      academicHours,
      day2DurationMinutes,
      day2AcademicHours,
      active: typeof row.active === "boolean" ? row.active : true,
    };
  });

  const driveWorkspaces: DriveWorkspaceRow[] = driveWorkspaceDocs.map((docSnap) => {
    const row = docSnap.data();
    const health = (row.health as Record<string, unknown> | undefined) ?? {};
    return {
      id: docSnap.id,
      institution: safeToString(row.institution, ""),
      subjectName: safeToString(row.subjectName, safeToString(row.subjectId, "Materia")),
      groupName: safeToString(row.groupName, safeToString(row.groupId, "Grupo")),
      period: safeToString(row.period, ""),
      campus: safeToString(row.campus, ""),
      jornada: safeToString(row.jornada, ""),
      dayOfWeek1: safeToString(row.dayOfWeek1, ""),
      dayOfWeek2: safeToString(row.dayOfWeek2, ""),
      weekCount: typeof row.weekCount === "number" && Number.isFinite(row.weekCount) ? row.weekCount : 0,
      healthBroken: Boolean(health.broken),
    };
  });

  const groupNameById = new Map([...groups, ...fichas].map((g) => [g.id, g.name]));
  const templateNameById = new Map(templates.map((t) => [t.id, t.name]));
  const templateGroupById = new Map(templates.map((t) => [t.id, t.groupId]));

  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const activityDays = Array.from({ length: 14 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - (13 - idx));
    return {
      key: dayKey(d),
      label: new Intl.DateTimeFormat("es-CO", { month: "short", day: "2-digit" }).format(d),
    };
  });
  const activityByDay = new Map(activityDays.map((d) => [d.key, 0]));

  const attemptsByTemplate7 = new Map<string, { count: number; grades: number[] }>();
  const gradeBins = [
    { label: "0-1", value: 0 },
    { label: "1-2", value: 0 },
    { label: "2-3", value: 0 },
    { label: "3-4", value: 0 },
    { label: "4-5", value: 0 },
  ];

  let gradeSum7 = 0;
  let gradeCount7 = 0;
  let fraudAttempts7 = 0;
  let submittedAttempts7 = 0;
  const latestAttempts: DashboardData["latestAttempts"] = [];

  attemptDocs.forEach((docSnap) => {
    const row = docSnap.data();
    const status = safeToString(row.status, "desconocido");
    const submittedAt = toDateFromTimestamp(row.submittedAt);
    if (!submittedAt) return;

    const isSubmitted = submittedStatuses.has(status);
    if (isSubmitted) {
      const key = dayKey(submittedAt);
      if (activityByDay.has(key)) activityByDay.set(key, (activityByDay.get(key) ?? 0) + 1);
    }

    const grade = normalizeGradeTo5(row);
    if (grade !== null) {
      const idx = Math.min(Math.max(Math.floor(grade), 0), 4);
      gradeBins[idx] = { ...gradeBins[idx], value: gradeBins[idx].value + 1 };
    }

    const fraud =
      (typeof row.fraudTabSwitches === "number" ? row.fraudTabSwitches : 0) +
      (typeof row.fraudClipboardAttempts === "number" ? row.fraudClipboardAttempts : 0);

    if (submittedAt >= start7 && isSubmitted) {
      submittedAttempts7 += 1;
      if (fraud > 0) fraudAttempts7 += 1;
      if (grade !== null) {
        gradeSum7 += grade;
        gradeCount7 += 1;
      }
      const templateId = safeToString(row.examTemplateId ?? row.templateId ?? row.examId, "desconocido");
      if (templateId !== "desconocido") {
        const current = attemptsByTemplate7.get(templateId) ?? { count: 0, grades: [] };
        current.count += 1;
        if (grade !== null) current.grades.push(grade);
        attemptsByTemplate7.set(templateId, current);
      }
    }

    if (latestAttempts.length < 10) {
      const examName =
        safeToString(row.examName, "") ||
        safeToString(row.templateName, "") ||
        templateNameById.get(safeToString(row.examTemplateId ?? row.templateId ?? row.examId, "")) ||
        safeToString(row.accessCode, "Examen");
      const student =
        safeToString(row.studentFullName, "") ||
        `${safeToString(row.studentFirstName, "")} ${safeToString(row.studentLastName, "")}`.trim() ||
        safeToString(row.email, "Estudiante");
      latestAttempts.push({
        when: new Intl.DateTimeFormat("es-CO", { month: "short", day: "2-digit" }).format(submittedAt),
        exam: examName,
        student,
        grade: grade === null ? "-" : `${grade.toFixed(2)} / 5`,
        status,
        fraud,
      });
    }
  });

  const topExams7 = Array.from(attemptsByTemplate7.entries())
    .map(([templateId, agg]) => {
      const avg =
        agg.grades.length > 0
          ? `${(agg.grades.reduce((a, b) => a + b, 0) / agg.grades.length).toFixed(2)} / 5`
          : "-";
      const name = templateNameById.get(templateId) ?? templateId;
      const groupId = templateGroupById.get(templateId) ?? "sin-grupo";
      return {
        exam: name,
        group: groupNameById.get(groupId) ?? groupId,
        submissions: agg.count,
        avg,
      };
    })
    .sort((a, b) => b.submissions - a.submissions)
    .slice(0, 8);

  const data: DashboardData = {
    counts: {
      templatesTotal: countFromAggregateSnap(out.templatesTotal),
      templatesActive: countFromAggregateSnap(out.templatesActive),
      publishedActive: countFromAggregateSnap(out.publishedActive),
      publishedClosed: countFromAggregateSnap(out.publishedClosed),
      questionsTotal: countFromAggregateSnap(out.questionsTotal),
      questionsPublished: countFromAggregateSnap(out.questionsPublished),
      questionsDraft: countFromAggregateSnap(out.questionsDraft),
      questionsArchived: countFromAggregateSnap(out.questionsArchived),
      subjectsTotal: countFromAggregateSnap(out.subjectsTotal),
      groupsTotal: countFromAggregateSnap(out.groupsTotal),
      fichasTotal: countFromAggregateSnap(out.fichasTotal),
      sitesTotal: countFromAggregateSnap(out.sitesTotal),
      shiftsTotal: countFromAggregateSnap(out.shiftsTotal),
      momentsTotal: countFromAggregateSnap(out.momentsTotal),
      studyDocsActive: countFromAggregateSnap(out.studyDocsActive),
      driveWorkspacesTotal: countFromAggregateSnap(out.driveWorkspacesTotal),
      teachingLoadsTotal: teachingLoadSummary.total,
      teachingLoadsActive: teachingLoadSummary.active,
      teachingHoursTotal: teachingLoadSummary.hoursTotal,
      teachingHoursCesde: teachingLoadSummary.hoursCesde,
      teachingHoursSena: teachingLoadSummary.hoursSena,
      attemptsTotal: countFromAggregateSnap(out.attemptsTotal),
      attemptsSubmitted: countFromAggregateSnap(out.attemptsSubmitted),
      attemptsInProgress: countFromAggregateSnap(out.attemptsInProgress),
      attemptsFraudSubmitted: countFromAggregateSnap(out.attemptsFraudSubmitted),
      attemptsAnnulled: countFromAggregateSnap(out.attemptsAnnulled),
    },
    activity14: {
      labels: activityDays.map((d) => d.label),
      values: activityDays.map((d) => activityByDay.get(d.key) ?? 0),
    },
    gradeDist: gradeBins,
    summary7: {
      avgGrade: gradeCount7 ? gradeSum7 / gradeCount7 : null,
      fraudAttempts: fraudAttempts7,
      submittedAttempts: submittedAttempts7,
    },
    topExams7,
    latestAttempts,
  };

  return { data, teachingLoads, driveWorkspaces, issues };
}
