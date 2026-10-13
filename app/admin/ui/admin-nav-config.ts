import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  Folder,
  LayoutDashboard,
  Settings2,
  Wrench,
  ClipboardList,
  FileText,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  accent: {
    iconBg: string;
    iconColor: string;
    hoverIconBg: string;
    hoverIconColor: string;
    activeBg: string;
    activeBorder: string;
    activeText: string;
    activeHint: string;
    rail: string;
  };
};

export type NavEntry =
  | ({ type: "link" } & NavItem)
  | { type: "section"; label: string };

export const navItems: NavEntry[] = [
  { type: "section", label: "Operacion" },
  {
    type: "link",
    label: "Dashboard",
    href: "/admin",
    hint: "Metricas generales",
    icon: LayoutDashboard,
    accent: {
      iconBg: "bg-violet-100 dark:bg-violet-950/50",
      iconColor: "text-violet-700 dark:text-violet-300",
      hoverIconBg: "group-hover:bg-violet-100 dark:group-hover:bg-violet-950/50",
      hoverIconColor: "group-hover:text-violet-700 dark:group-hover:text-violet-300",
      activeBg: "bg-violet-50 dark:bg-violet-950/30",
      activeBorder: "ring-violet-200 dark:ring-violet-800",
      activeText: "text-violet-700 dark:text-violet-300",
      activeHint: "text-violet-600/80 dark:text-violet-300/80",
      rail: "bg-violet-400 dark:bg-violet-500",
    },
  },
  {
    type: "link",
    label: "Banco",
    href: "/admin/bank",
    hint: "Preguntas y carga",
    icon: ClipboardList,
    accent: {
      iconBg: "bg-fuchsia-100 dark:bg-fuchsia-950/50",
      iconColor: "text-fuchsia-700 dark:text-fuchsia-300",
      hoverIconBg: "group-hover:bg-fuchsia-100 dark:group-hover:bg-fuchsia-950/50",
      hoverIconColor: "group-hover:text-fuchsia-700 dark:group-hover:text-fuchsia-300",
      activeBg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
      activeBorder: "ring-fuchsia-200 dark:ring-fuchsia-800",
      activeText: "text-fuchsia-700 dark:text-fuchsia-300",
      activeHint: "text-fuchsia-600/80 dark:text-fuchsia-300/80",
      rail: "bg-fuchsia-400 dark:bg-fuchsia-500",
    },
  },
  {
    type: "link",
    label: "Examenes",
    href: "/admin/templates",
    hint: "Creacion y control",
    icon: FileText,
    accent: {
      iconBg: "bg-indigo-100 dark:bg-indigo-950/50",
      iconColor: "text-indigo-700 dark:text-indigo-300",
      hoverIconBg: "group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950/50",
      hoverIconColor: "group-hover:text-indigo-700 dark:group-hover:text-indigo-300",
      activeBg: "bg-indigo-50 dark:bg-indigo-950/30",
      activeBorder: "ring-indigo-200 dark:ring-indigo-800",
      activeText: "text-indigo-700 dark:text-indigo-300",
      activeHint: "text-indigo-600/80 dark:text-indigo-300/80",
      rail: "bg-indigo-400 dark:bg-indigo-500",
    },
  },
  {
    type: "link",
    label: "Carga horaria",
    href: "/admin/workload",
    hint: "Horarios por institucion",
    icon: CalendarDays,
    accent: {
      iconBg: "bg-rose-100 dark:bg-rose-950/50",
      iconColor: "text-rose-700 dark:text-rose-300",
      hoverIconBg: "group-hover:bg-rose-100 dark:group-hover:bg-rose-950/50",
      hoverIconColor: "group-hover:text-rose-700 dark:group-hover:text-rose-300",
      activeBg: "bg-rose-50 dark:bg-rose-950/30",
      activeBorder: "ring-rose-200 dark:ring-rose-800",
      activeText: "text-rose-700 dark:text-rose-300",
      activeHint: "text-rose-600/80 dark:text-rose-300/80",
      rail: "bg-rose-400 dark:bg-rose-500",
    },
  },
  {
    type: "link",
    label: "Drive",
    href: "/admin/drive",
    hint: "Archivos y estructura",
    icon: Folder,
    accent: {
      iconBg: "bg-amber-100 dark:bg-amber-950/50",
      iconColor: "text-amber-700 dark:text-amber-300",
      hoverIconBg: "group-hover:bg-amber-100 dark:group-hover:bg-amber-950/50",
      hoverIconColor: "group-hover:text-amber-700 dark:group-hover:text-amber-300",
      activeBg: "bg-amber-50 dark:bg-amber-950/30",
      activeBorder: "ring-amber-200 dark:ring-amber-800",
      activeText: "text-amber-700 dark:text-amber-300",
      activeHint: "text-amber-700/75 dark:text-amber-300/75",
      rail: "bg-amber-400 dark:bg-amber-500",
    },
  },
  {
    type: "link",
    label: "Activos",
    href: "/admin/live",
    hint: "Codigos y monitoreo",
    icon: Activity,
    accent: {
      iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
      iconColor: "text-emerald-700 dark:text-emerald-300",
      hoverIconBg: "group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/50",
      hoverIconColor: "group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
      activeBg: "bg-emerald-50 dark:bg-emerald-950/30",
      activeBorder: "ring-emerald-200 dark:ring-emerald-800",
      activeText: "text-emerald-700 dark:text-emerald-300",
      activeHint: "text-emerald-700/75 dark:text-emerald-300/75",
      rail: "bg-emerald-400 dark:bg-emerald-500",
    },
  },
  {
    type: "link",
    label: "Resultados",
    href: "/admin/results",
    hint: "Notas y exportaciones",
    icon: BarChart3,
    accent: {
      iconBg: "bg-sky-100 dark:bg-sky-950/50",
      iconColor: "text-sky-700 dark:text-sky-300",
      hoverIconBg: "group-hover:bg-sky-100 dark:group-hover:bg-sky-950/50",
      hoverIconColor: "group-hover:text-sky-700 dark:group-hover:text-sky-300",
      activeBg: "bg-sky-50 dark:bg-sky-950/30",
      activeBorder: "ring-sky-200 dark:ring-sky-800",
      activeText: "text-sky-700 dark:text-sky-300",
      activeHint: "text-sky-700/75 dark:text-sky-300/75",
      rail: "bg-sky-400 dark:bg-sky-500",
    },
  },
  { type: "section", label: "Configuracion" },
  {
    type: "link",
    label: "Catalogos",
    href: "/admin/settings",
    hint: "Materias, grupos y momentos",
    icon: Settings2,
    accent: {
      iconBg: "bg-stone-100 dark:bg-stone-900",
      iconColor: "text-stone-700 dark:text-stone-300",
      hoverIconBg: "group-hover:bg-stone-100 dark:group-hover:bg-stone-900",
      hoverIconColor: "group-hover:text-stone-700 dark:group-hover:text-stone-300",
      activeBg: "bg-stone-50 dark:bg-stone-900/40",
      activeBorder: "ring-stone-200 dark:ring-stone-800",
      activeText: "text-stone-700 dark:text-stone-300",
      activeHint: "text-stone-600/80 dark:text-stone-300/80",
      rail: "bg-stone-400 dark:bg-stone-500",
    },
  },
  {
    type: "link",
    label: "Firebase",
    href: "/admin/settings/firebase",
    hint: "Herramientas y limpieza",
    icon: Wrench,
    accent: {
      iconBg: "bg-slate-100 dark:bg-slate-800",
      iconColor: "text-slate-700 dark:text-slate-300",
      hoverIconBg: "group-hover:bg-slate-100 dark:group-hover:bg-slate-800",
      hoverIconColor: "group-hover:text-slate-700 dark:group-hover:text-slate-300",
      activeBg: "bg-slate-50 dark:bg-slate-800/40",
      activeBorder: "ring-slate-200 dark:ring-slate-700",
      activeText: "text-slate-700 dark:text-slate-300",
      activeHint: "text-slate-600/80 dark:text-slate-300/80",
      rail: "bg-slate-400 dark:bg-slate-500",
    },
  },
  { type: "section", label: "IA" },
  {
    type: "link",
    label: "IA Documentacion",
    href: "/admin/settings/ai-docs",
    hint: "Generar y publicar",
    icon: Bot,
    accent: {
      iconBg: "bg-purple-100 dark:bg-purple-950/50",
      iconColor: "text-purple-700 dark:text-purple-300",
      hoverIconBg: "group-hover:bg-purple-100 dark:group-hover:bg-purple-950/50",
      hoverIconColor: "group-hover:text-purple-700 dark:group-hover:text-purple-300",
      activeBg: "bg-purple-50 dark:bg-purple-950/30",
      activeBorder: "ring-purple-200 dark:ring-purple-800",
      activeText: "text-purple-700 dark:text-purple-300",
      activeHint: "text-purple-600/80 dark:text-purple-300/80",
      rail: "bg-purple-400 dark:bg-purple-500",
    },
  },
  {
    type: "link",
    label: "IA Test",
    href: "/admin/settings/ia-test",
    hint: "Probar Gemini",
    icon: Bot,
    accent: {
      iconBg: "bg-cyan-100 dark:bg-cyan-950/50",
      iconColor: "text-cyan-700 dark:text-cyan-300",
      hoverIconBg: "group-hover:bg-cyan-100 dark:group-hover:bg-cyan-950/50",
      hoverIconColor: "group-hover:text-cyan-700 dark:group-hover:text-cyan-300",
      activeBg: "bg-cyan-50 dark:bg-cyan-950/30",
      activeBorder: "ring-cyan-200 dark:ring-cyan-800",
      activeText: "text-cyan-700 dark:text-cyan-300",
      activeHint: "text-cyan-600/80 dark:text-cyan-300/80",
      rail: "bg-cyan-400 dark:bg-cyan-500",
    },
  },
];

export function getInitials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "Admin";
  const tokens = source.split(/[ @._-]+/).filter(Boolean).slice(0, 2);
  return tokens.map((t) => t[0]?.toUpperCase() ?? "").join("") || "AD";
}

export function getActiveNavItem(pathname: string): NavItem | null {
  const links = navItems.filter((i): i is Extract<NavEntry, { type: "link" }> => i.type === "link");
  const matches = links.filter((item) => {
    if (item.href === "/admin") return pathname === "/admin";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
  if (!matches.length) return null;
  const sorted = matches.sort((a, b) => b.href.length - a.href.length);
  return sorted[0] ?? null;
}
