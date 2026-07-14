import type { ComponentType } from "react";
import { BookOpenText, Database } from "lucide-react";
import { FaCss3Alt, FaHtml5, FaJava, FaNodeJs, FaPython, FaReact } from "react-icons/fa6";
import { SiGithub, SiGit, SiJavascript, SiScrumalliance } from "react-icons/si";

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

function makeMeta(args: {
  label: string;
  primaryIcon: ComponentType<{ className?: string }>;
  secondaryIcon?: ComponentType<{ className?: string }>;
  tone: {
    border: string;
    bg: string;
    text: string;
    ring: string;
    watermark: string;
  };
}): SubjectTechnologyMeta {
  const { label, primaryIcon, secondaryIcon, tone } = args;
  return {
    label,
    primaryIcon,
    secondaryIcon,
    badgeClassName: `border ${tone.border} ${tone.bg} ${tone.text}`,
    iconWrapClassName: `${tone.bg.replace("/80", "").replace("/70", "").replace("/95", "").replace("-50", "-100")} ${tone.text.replace("-800", "-700").replace("-950", "-700")}`,
    iconClassName: "h-4 w-4",
    listCardClassName: `${tone.border}/80 ${tone.bg.replace("-50", "-50/70")}`,
    driveCardClassName: `${tone.border}/80 ${tone.bg.replace("-50", "-50/80")} hover:${tone.border.replace("-200", "-300")} hover:${tone.bg}`,
    driveSelectedClassName: `${tone.border.replace("-200", "-300")} ring-4 ${tone.ring}`,
    calendarCardClassName: `${tone.border} ${tone.bg.replace("-50", "-50/95")} ${tone.text.replace("-800", "-950")}`,
    watermarkClassName: tone.watermark,
  };
}

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
    return makeMeta({
      label: "JavaScript",
      primaryIcon: SiJavascript,
      tone: {
        border: "border-amber-200",
        bg: "bg-amber-50",
        text: "text-amber-800",
        ring: "ring-amber-500/10",
        watermark: "text-amber-300/35",
      },
    });
  }

  if (["WEB 2", "FRONT 2", "REACT", "REACT JS", "REACTJS"].includes(normalized)) {
    return makeMeta({
      label: "React JS",
      primaryIcon: FaReact,
      tone: {
        border: "border-cyan-200",
        bg: "bg-cyan-50",
        text: "text-cyan-800",
        ring: "ring-cyan-500/10",
        watermark: "text-cyan-300/35",
      },
    });
  }

  if (["INTRODUCCION", "DISENO WEB", "DISEÑO WEB"].includes(normalized)) {
    return makeMeta({
      label: "HTML + CSS",
      primaryIcon: FaHtml5,
      secondaryIcon: FaCss3Alt,
      tone: {
        border: "border-orange-200",
        bg: "bg-orange-50",
        text: "text-orange-800",
        ring: "ring-orange-500/10",
        watermark: "text-orange-300/35",
      },
    });
  }

  if (["BASES DE DATOS", "BSES DE DATOS", "SQL SERVER"].includes(normalized)) {
    return makeMeta({
      label: "SQL Server",
      primaryIcon: Database,
      tone: {
        border: "border-sky-200",
        bg: "bg-sky-50",
        text: "text-sky-800",
        ring: "ring-sky-500/10",
        watermark: "text-sky-300/35",
      },
    });
  }

  if (["LOGICA", "LÓGICA", "JAVA"].includes(normalized)) {
    return makeMeta({
      label: "Java",
      primaryIcon: FaJava,
      tone: {
        border: "border-rose-200",
        bg: "bg-rose-50",
        text: "text-rose-800",
        ring: "ring-rose-500/10",
        watermark: "text-rose-300/35",
      },
    });
  }

  if (["FUNDAMENTOS", "PYTHON"].includes(normalized)) {
    return makeMeta({
      label: "Python",
      primaryIcon: FaPython,
      tone: {
        border: "border-emerald-200",
        bg: "bg-emerald-50",
        text: "text-emerald-800",
        ring: "ring-emerald-500/10",
        watermark: "text-emerald-300/35",
      },
    });
  }

  if (["METODOLOGIAS", "METODOLOGÍAS", "SCRUM"].includes(normalized)) {
    return makeMeta({
      label: "SCRUM",
      primaryIcon: SiScrumalliance,
      tone: {
        border: "border-violet-200",
        bg: "bg-violet-50",
        text: "text-violet-800",
        ring: "ring-violet-500/10",
        watermark: "text-violet-300/35",
      },
    });
  }

  if (["NODE", "NODEJS", "NODE JS", "NODE.JS"].includes(normalized)) {
    return makeMeta({
      label: "Node.js",
      primaryIcon: FaNodeJs,
      tone: {
        border: "border-lime-200",
        bg: "bg-lime-50",
        text: "text-lime-800",
        ring: "ring-lime-500/10",
        watermark: "text-lime-300/35",
      },
    });
  }

  if (["PROYECTO FORMATIVO", "DOCUMENTACION", "DOCUMENTACIÓN"].includes(normalized)) {
    return makeMeta({
      label: "Documentación",
      primaryIcon: BookOpenText,
      tone: {
        border: "border-indigo-200",
        bg: "bg-indigo-50",
        text: "text-indigo-800",
        ring: "ring-indigo-500/10",
        watermark: "text-indigo-300/35",
      },
    });
  }

  if (["GIT", "GITHUB", "GIT Y GITHUB", "GIT/GITHUB", "GIT & GITHUB"].includes(normalized)) {
    return makeMeta({
      label: "Git y GitHub",
      primaryIcon: SiGit,
      secondaryIcon: SiGithub,
      tone: {
        border: "border-slate-200",
        bg: "bg-slate-50",
        text: "text-slate-800",
        ring: "ring-slate-500/10",
        watermark: "text-slate-300/35",
      },
    });
  }

  return null;
}
