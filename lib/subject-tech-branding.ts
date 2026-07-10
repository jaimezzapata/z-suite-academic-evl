import type { ComponentType } from "react";
import { Database } from "lucide-react";
import { FaCss3Alt, FaHtml5, FaJava, FaPython, FaReact } from "react-icons/fa6";
import { SiJavascript, SiScrumalliance } from "react-icons/si";

export type SubjectTechnologyMeta = {
  label: string;
  primaryIcon: ComponentType<{ className?: string }>;
  secondaryIcon?: ComponentType<{ className?: string }>;
  badgeClassName: string;
  iconWrapClassName: string;
  iconClassName: string;
  listCardClassName: string;
  driveCardClassName: string;
  driveSelectedClassName: string;
  calendarCardClassName: string;
  watermarkClassName: string;
};

function normalizeSubjectName(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getSubjectTechnologyMeta(subjectName: string): SubjectTechnologyMeta | null {
  const normalized = normalizeSubjectName(subjectName);
  if (!normalized) return null;

  if (["WEB 1", "FRONT 1", "JAVASCRIPT"].includes(normalized)) {
    return {
      label: "JavaScript",
      primaryIcon: SiJavascript,
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
      iconWrapClassName: "bg-amber-100 text-amber-700",
      iconClassName: "h-4 w-4",
      listCardClassName: "border-amber-200/80 bg-amber-50/70",
      driveCardClassName: "border-amber-200/80 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-50",
      driveSelectedClassName: "border-amber-300 ring-4 ring-amber-500/10",
      calendarCardClassName: "border-amber-200 bg-amber-50/95 text-amber-950",
      watermarkClassName: "text-amber-300/35",
    };
  }

  if (["WEB 2", "FRONT 2", "REACT", "REACT JS", "REACTJS"].includes(normalized)) {
    return {
      label: "React JS",
      primaryIcon: FaReact,
      badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-800",
      iconWrapClassName: "bg-cyan-100 text-cyan-700",
      iconClassName: "h-4 w-4",
      listCardClassName: "border-cyan-200/80 bg-cyan-50/70",
      driveCardClassName: "border-cyan-200/80 bg-cyan-50/80 hover:border-cyan-300 hover:bg-cyan-50",
      driveSelectedClassName: "border-cyan-300 ring-4 ring-cyan-500/10",
      calendarCardClassName: "border-cyan-200 bg-cyan-50/95 text-cyan-950",
      watermarkClassName: "text-cyan-300/35",
    };
  }

  if (["INTRODUCCION", "DISENO WEB", "DISEÑO WEB"].includes(normalized)) {
    return {
      label: "HTML + CSS",
      primaryIcon: FaHtml5,
      secondaryIcon: FaCss3Alt,
      badgeClassName: "border-orange-200 bg-orange-50 text-orange-800",
      iconWrapClassName: "bg-orange-100 text-orange-700",
      iconClassName: "h-4 w-4",
      listCardClassName: "border-orange-200/80 bg-orange-50/70",
      driveCardClassName: "border-orange-200/80 bg-orange-50/80 hover:border-orange-300 hover:bg-orange-50",
      driveSelectedClassName: "border-orange-300 ring-4 ring-orange-500/10",
      calendarCardClassName: "border-orange-200 bg-orange-50/95 text-orange-950",
      watermarkClassName: "text-orange-300/35",
    };
  }

  if (["BASES DE DATOS", "BSES DE DATOS", "SQL SERVER"].includes(normalized)) {
    return {
      label: "SQL Server",
      primaryIcon: Database,
      badgeClassName: "border-sky-200 bg-sky-50 text-sky-800",
      iconWrapClassName: "bg-sky-100 text-sky-700",
      iconClassName: "h-4 w-4",
      listCardClassName: "border-sky-200/80 bg-sky-50/70",
      driveCardClassName: "border-sky-200/80 bg-sky-50/80 hover:border-sky-300 hover:bg-sky-50",
      driveSelectedClassName: "border-sky-300 ring-4 ring-sky-500/10",
      calendarCardClassName: "border-sky-200 bg-sky-50/95 text-sky-950",
      watermarkClassName: "text-sky-300/35",
    };
  }

  if (["LOGICA", "LÓGICA", "JAVA"].includes(normalized)) {
    return {
      label: "Java",
      primaryIcon: FaJava,
      badgeClassName: "border-rose-200 bg-rose-50 text-rose-800",
      iconWrapClassName: "bg-rose-100 text-rose-700",
      iconClassName: "h-4 w-4",
      listCardClassName: "border-rose-200/80 bg-rose-50/70",
      driveCardClassName: "border-rose-200/80 bg-rose-50/80 hover:border-rose-300 hover:bg-rose-50",
      driveSelectedClassName: "border-rose-300 ring-4 ring-rose-500/10",
      calendarCardClassName: "border-rose-200 bg-rose-50/95 text-rose-950",
      watermarkClassName: "text-rose-300/35",
    };
  }

  if (["FUNDAMENTOS", "PYTHON"].includes(normalized)) {
    return {
      label: "Python",
      primaryIcon: FaPython,
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
      iconWrapClassName: "bg-emerald-100 text-emerald-700",
      iconClassName: "h-4 w-4",
      listCardClassName: "border-emerald-200/80 bg-emerald-50/70",
      driveCardClassName: "border-emerald-200/80 bg-emerald-50/80 hover:border-emerald-300 hover:bg-emerald-50",
      driveSelectedClassName: "border-emerald-300 ring-4 ring-emerald-500/10",
      calendarCardClassName: "border-emerald-200 bg-emerald-50/95 text-emerald-950",
      watermarkClassName: "text-emerald-300/35",
    };
  }

  if (["METODOLOGIAS", "METODOLOGÍAS", "SCRUM"].includes(normalized)) {
    return {
      label: "SCRUM",
      primaryIcon: SiScrumalliance,
      badgeClassName: "border-violet-200 bg-violet-50 text-violet-800",
      iconWrapClassName: "bg-violet-100 text-violet-700",
      iconClassName: "h-4 w-4",
      listCardClassName: "border-violet-200/80 bg-violet-50/70",
      driveCardClassName: "border-violet-200/80 bg-violet-50/80 hover:border-violet-300 hover:bg-violet-50",
      driveSelectedClassName: "border-violet-300 ring-4 ring-violet-500/10",
      calendarCardClassName: "border-violet-200 bg-violet-50/95 text-violet-950",
      watermarkClassName: "text-violet-300/35",
    };
  }

  return null;
}
