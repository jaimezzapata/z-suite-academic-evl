"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExamTemplateRow, PublishedRef } from "../types";

type UseTemplateFiltersParams = {
  rows: ExamTemplateRow[];
  namesById: Map<string, string>;
  publishedByTemplate: Record<string, PublishedRef>;
};

export function useTemplateFilters({
  rows,
  namesById,
  publishedByTemplate,
}: UseTemplateFiltersParams) {
  const [isMobile, setIsMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    try {
      const raw = localStorage.getItem("zse:adminTemplatesView");
      return raw === "cards" ? "cards" : "table";
    } catch {
      return "table";
    }
  });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [filterMomentId, setFilterMomentId] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("");
  const [filterShiftId, setFilterShiftId] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterPublished, setFilterPublished] = useState<"all" | "published" | "not_published">("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncViewport);
      return () => media.removeEventListener("change", syncViewport);
    }
    media.addListener(syncViewport);
    return () => media.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("zse:adminTemplatesView", viewMode);
    } catch {}
  }, [viewMode]);

  const effectiveViewMode = isMobile ? "cards" : viewMode;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const pub = publishedByTemplate[r.id];
      if (filterSubjectId && r.subjectId !== filterSubjectId) return false;
      if (filterGroupId && r.groupId !== filterGroupId) return false;
      if (filterMomentId && r.momentId !== filterMomentId) return false;
      if (filterSiteId && r.siteId !== filterSiteId) return false;
      if (filterShiftId && r.shiftId !== filterShiftId) return false;
      if (filterActive === "active" && !r.active) return false;
      if (filterActive === "inactive" && r.active) return false;
      if (filterPublished === "published" && !pub) return false;
      if (filterPublished === "not_published" && pub) return false;

      if (!q) return true;
      const subject = namesById.get(`subjects:${r.subjectId}`) ?? r.subjectId;
      const group =
        (r.institution === "SENA" ? namesById.get(`fichas:${r.groupId}`) : namesById.get(`groups:${r.groupId}`)) ??
        r.groupId;
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
  }, [
    rows,
    search,
    namesById,
    publishedByTemplate,
    filterSubjectId,
    filterGroupId,
    filterMomentId,
    filterSiteId,
    filterShiftId,
    filterActive,
    filterPublished,
  ]);

  function clearFilters() {
    setFilterSubjectId("");
    setFilterGroupId("");
    setFilterMomentId("");
    setFilterSiteId("");
    setFilterShiftId("");
    setFilterActive("all");
    setFilterPublished("all");
  }

  return {
    isMobile,
    search,
    setSearch,
    viewMode,
    setViewMode,
    effectiveViewMode,
    filtersOpen,
    setFiltersOpen,
    filterSubjectId,
    setFilterSubjectId,
    filterGroupId,
    setFilterGroupId,
    filterMomentId,
    setFilterMomentId,
    filterSiteId,
    setFilterSiteId,
    filterShiftId,
    setFilterShiftId,
    filterActive,
    setFilterActive,
    filterPublished,
    setFilterPublished,
    clearFilters,
    filteredRows,
  };
}
