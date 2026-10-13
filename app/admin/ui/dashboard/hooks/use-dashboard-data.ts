"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import type { DashboardData, TeachingLoadRow, DriveWorkspaceRow } from "../types";
import { fetchDashboardData } from "../services/dashboard-queries";

const DASHBOARD_CACHE_KEY = "zsuite:dashboard:counts-cache:v1";
const DASHBOARD_CACHE_TTL_MS = 10 * 60 * 1000;

function readDashboardCountsCache(): DashboardData["counts"] | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; counts: DashboardData["counts"] };
    if (!parsed || !parsed.ts || !parsed.counts) return null;
    if (Date.now() - parsed.ts > DASHBOARD_CACHE_TTL_MS) return null;
    return parsed.counts;
  } catch {
    return null;
  }
}

function writeDashboardCountsCache(counts: DashboardData["counts"]): void {
  try {
    if (typeof window === "undefined") return;
    const payload = { ts: Date.now(), counts };
    window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

const initialCounts: DashboardData["counts"] = {
  templatesTotal: 0,
  templatesActive: 0,
  publishedActive: 0,
  publishedClosed: 0,
  questionsTotal: 0,
  questionsPublished: 0,
  questionsDraft: 0,
  questionsArchived: 0,
  subjectsTotal: 0,
  groupsTotal: 0,
  fichasTotal: 0,
  sitesTotal: 0,
  shiftsTotal: 0,
  momentsTotal: 0,
  studyDocsActive: 0,
  driveWorkspacesTotal: 0,
  teachingLoadsTotal: 0,
  teachingLoadsActive: 0,
  teachingHoursTotal: 0,
  teachingHoursCesde: 0,
  teachingHoursSena: 0,
  attemptsTotal: 0,
  attemptsSubmitted: 0,
  attemptsInProgress: 0,
  attemptsFraudSubmitted: 0,
  attemptsAnnulled: 0,
};

export function useDashboardData() {
  const { loading: authLoading, isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [teachingLoads, setTeachingLoads] = useState<TeachingLoadRow[]>([]);
  const [driveWorkspaces, setDriveWorkspaces] = useState<DriveWorkspaceRow[]>([]);
  const [data, setData] = useState<DashboardData>({
    counts: initialCounts,
    activity14: { labels: [], values: [] },
    gradeDist: [],
    summary7: { avgGrade: null, fraudAttempts: 0, submittedAttempts: 0 },
    topExams7: [],
    latestAttempts: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (authLoading) {
        setLoading(true);
        return;
      }
      if (!user || !isAdmin) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setWarning(null);

      const cached = readDashboardCountsCache();
      if (cached) {
        setData((prev) => ({ ...prev, counts: cached }));
      }

      try {
        const result = await fetchDashboardData();
        if (cancelled) return;

        setData(result.data);
        setTeachingLoads(result.teachingLoads);
        setDriveWorkspaces(result.driveWorkspaces);
        writeDashboardCountsCache(result.data.counts);

        if (result.issues.length) {
          setWarning(
            `Sin permisos o reglas bloqueando lecturas en:\n${result.issues.map((i) => `- ${i}`).join("\n")}`,
          );
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Error al cargar dashboard";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, user, refreshKey]);

  return {
    loading,
    error,
    warning,
    data,
    teachingLoads,
    driveWorkspaces,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
