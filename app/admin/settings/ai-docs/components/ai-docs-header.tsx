"use client";

import React from "react";
import { BookOpen, Bot, CheckCircle2, FileQuestion, GraduationCap } from "lucide-react";
import type { AiDocsTab } from "../types";

interface AiDocsHeaderProps {
  tab: AiDocsTab;
  onSelectTab: (tab: AiDocsTab) => void;
  hasReadme: boolean;
  hasBatch: boolean;
}

const STEPS: Array<{
  id: AiDocsTab;
  stepNum: number;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "readme",
    stepNum: 1,
    label: "Documentación & Temario",
    hint: "README.md con IA",
    icon: BookOpen,
  },
  {
    id: "batch",
    stepNum: 2,
    label: "Preguntas IA",
    hint: "Lote JSON para Banco",
    icon: FileQuestion,
  },
  {
    id: "exam",
    stepNum: 3,
    label: "Crear Examen",
    hint: "Plantilla vinculada",
    icon: GraduationCap,
  },
];

export function AiDocsHeader({
  tab,
  onSelectTab,
  hasReadme,
  hasBatch,
}: AiDocsHeaderProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              <Bot className="h-3.5 w-3.5" />
              Pipeline Académico IA
            </span>
          </div>
          <h1 className="mt-1 text-lg font-bold tracking-tight text-zinc-950 sm:text-xl">
            Generador Integral: Documentación → Preguntas → Examen
          </h1>
          <p className="mt-0.5 text-xs text-zinc-600">
            Flujo conectado pero independiente: define temas y genera el README, crea las preguntas alineadas y publica el examen.
          </p>
        </div>
      </div>

      {/* Stepper Progresivo */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {STEPS.map((s) => {
          const isActive = tab === s.id;
          const Icon = s.icon;
          const isDone = (s.id === "readme" && hasReadme) || (s.id === "batch" && hasBatch);

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectTab(s.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white shadow-xs"
                  : "border-zinc-200 bg-zinc-50/60 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100/70"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition ${
                  isActive
                    ? "bg-white/15 text-white"
                    : isDone
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-white border border-zinc-200 text-zinc-700"
                }`}
              >
                {isDone && !isActive ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <span>{s.stepNum}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold truncate ${isActive ? "text-white" : "text-zinc-900"}`}>
                  {s.label}
                </p>
                <p className={`text-[11px] truncate ${isActive ? "text-zinc-300" : "text-zinc-500"}`}>
                  {s.hint}
                </p>
              </div>
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-zinc-300" : "text-zinc-400"}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
