"use client";

import { useEffect, useRef, useState } from "react";
import type { AcademicTopic } from "../types";
import {
  autoSaveTopicForSubject,
  fetchTopicsForSubject,
  getTopicForSubject,
} from "../services/topics-service";

type UseAcademicTopicsParams = {
  subjectId: string;
  subjectName: string;
  onApplyTopics: (topics: string, criteria: string) => void;
};

export function useAcademicTopics({
  subjectId,
  subjectName,
  onApplyTopics,
}: UseAcademicTopicsParams) {
  const [topicsList, setTopicsList] = useState<AcademicTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-cargar temario al seleccionar materia
  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;

    async function loadSubjectTopic() {
      setLoadingTopics(true);
      try {
        const [savedTopic, list] = await Promise.all([
          getTopicForSubject(subjectId),
          fetchTopicsForSubject(subjectId),
        ]);

        if (cancelled) return;
        setTopicsList(list);

        if (savedTopic && savedTopic.topics) {
          onApplyTopics(savedTopic.topics, savedTopic.criteria || "");
        }
      } catch (err) {
        console.error("Error al cargar temario automático:", err);
      } finally {
        if (!cancelled) setLoadingTopics(false);
      }
    }

    void loadSubjectTopic();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  // Función para auto-guardar sin requerir clic manual
  function autoSave(topicsText: string, criteriaText: string) {
    if (!subjectId || !topicsText.trim()) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await autoSaveTopicForSubject(subjectId, subjectName, topicsText, criteriaText);
        setLastAutoSaved(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Error en auto-guardado:", err);
      }
    }, 1200);
  }

  // Guardado inmediato (al hacer clic en generar o siguiente paso)
  async function forceSaveNow(topicsText: string, criteriaText: string) {
    if (!subjectId || !topicsText.trim()) return;
    try {
      await autoSaveTopicForSubject(subjectId, subjectName, topicsText, criteriaText);
      setLastAutoSaved(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Error en guardado forzado:", err);
    }
  }

  return {
    topicsList,
    loadingTopics,
    lastAutoSaved,
    autoSave,
    forceSaveNow,
  };
}
