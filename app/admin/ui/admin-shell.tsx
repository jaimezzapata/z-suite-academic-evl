"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  Folder,
  LayoutDashboard,
  Menu,
  Settings2,
  Wrench,
  ClipboardList,
  FileText,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
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

type NavEntry =
  | ({ type: "link" } & NavItem)
  | { type: "section"; label: string };

const navItems: NavEntry[] = [
  { type: "section", label: "Operacion" },
  {
    type: "link",
    label: "Dashboard",
    href: "/admin",
    hint: "Metricas generales",
    icon: LayoutDashboard,
    accent: {
      iconBg: "bg-violet-100",
      iconColor: "text-violet-700",
      hoverIconBg: "group-hover:bg-violet-100",
      hoverIconColor: "group-hover:text-violet-700",
      activeBg: "bg-violet-50",
      activeBorder: "ring-violet-200",
      activeText: "text-violet-700",
      activeHint: "text-violet-600/80",
      rail: "bg-violet-300",
    },
  },
  {
    type: "link",
    label: "Banco",
    href: "/admin/bank",
    hint: "Preguntas y carga",
    icon: ClipboardList,
    accent: {
      iconBg: "bg-fuchsia-100",
      iconColor: "text-fuchsia-700",
      hoverIconBg: "group-hover:bg-fuchsia-100",
      hoverIconColor: "group-hover:text-fuchsia-700",
      activeBg: "bg-fuchsia-50",
      activeBorder: "ring-fuchsia-200",
      activeText: "text-fuchsia-700",
      activeHint: "text-fuchsia-600/80",
      rail: "bg-fuchsia-300",
    },
  },
  {
    type: "link",
    label: "Examenes",
    href: "/admin/templates",
    hint: "Creacion y control",
    icon: FileText,
    accent: {
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-700",
      hoverIconBg: "group-hover:bg-indigo-100",
      hoverIconColor: "group-hover:text-indigo-700",
      activeBg: "bg-indigo-50",
      activeBorder: "ring-indigo-200",
      activeText: "text-indigo-700",
      activeHint: "text-indigo-600/80",
      rail: "bg-indigo-300",
    },
  },
  {
    type: "link",
    label: "Carga horaria",
    href: "/admin/workload",
    hint: "Horarios por institucion",
    icon: CalendarDays,
    accent: {
      iconBg: "bg-rose-100",
      iconColor: "text-rose-700",
      hoverIconBg: "group-hover:bg-rose-100",
      hoverIconColor: "group-hover:text-rose-700",
      activeBg: "bg-rose-50",
      activeBorder: "ring-rose-200",
      activeText: "text-rose-700",
      activeHint: "text-rose-600/80",
      rail: "bg-rose-300",
    },
  },
  {
    type: "link",
    label: "Drive",
    href: "/admin/drive",
    hint: "Archivos y estructura",
    icon: Folder,
    accent: {
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      hoverIconBg: "group-hover:bg-amber-100",
      hoverIconColor: "group-hover:text-amber-700",
      activeBg: "bg-amber-50",
      activeBorder: "ring-amber-200",
      activeText: "text-amber-700",
      activeHint: "text-amber-700/75",
      rail: "bg-amber-300",
    },
  },
  {
    type: "link",
    label: "Activos",
    href: "/admin/live",
    hint: "Codigos y monitoreo",
    icon: Activity,
    accent: {
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      hoverIconBg: "group-hover:bg-emerald-100",
      hoverIconColor: "group-hover:text-emerald-700",
      activeBg: "bg-emerald-50",
      activeBorder: "ring-emerald-200",
      activeText: "text-emerald-700",
      activeHint: "text-emerald-700/75",
      rail: "bg-emerald-300",
    },
  },
  {
    type: "link",
    label: "Resultados",
    href: "/admin/results",
    hint: "Notas y exportaciones",
    icon: BarChart3,
    accent: {
      iconBg: "bg-sky-100",
      iconColor: "text-sky-700",
      hoverIconBg: "group-hover:bg-sky-100",
      hoverIconColor: "group-hover:text-sky-700",
      activeBg: "bg-sky-50",
      activeBorder: "ring-sky-200",
      activeText: "text-sky-700",
      activeHint: "text-sky-700/75",
      rail: "bg-sky-300",
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
      iconBg: "bg-stone-100",
      iconColor: "text-stone-700",
      hoverIconBg: "group-hover:bg-stone-100",
      hoverIconColor: "group-hover:text-stone-700",
      activeBg: "bg-stone-50",
      activeBorder: "ring-stone-200",
      activeText: "text-stone-700",
      activeHint: "text-stone-600/80",
      rail: "bg-stone-300",
    },
  },
  {
    type: "link",
    label: "Firebase",
    href: "/admin/settings/firebase",
    hint: "Herramientas y limpieza",
    icon: Wrench,
    accent: {
      iconBg: "bg-slate-100",
      iconColor: "text-slate-700",
      hoverIconBg: "group-hover:bg-slate-100",
      hoverIconColor: "group-hover:text-slate-700",
      activeBg: "bg-slate-50",
      activeBorder: "ring-slate-200",
      activeText: "text-slate-700",
      activeHint: "text-slate-600/80",
      rail: "bg-slate-300",
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
      iconBg: "bg-purple-100",
      iconColor: "text-purple-700",
      hoverIconBg: "group-hover:bg-purple-100",
      hoverIconColor: "group-hover:text-purple-700",
      activeBg: "bg-purple-50",
      activeBorder: "ring-purple-200",
      activeText: "text-purple-700",
      activeHint: "text-purple-600/80",
      rail: "bg-purple-300",
    },
  },
  {
    type: "link",
    label: "IA Test",
    href: "/admin/settings/ia-test",
    hint: "Probar Gemini",
    icon: Bot,
    accent: {
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-700",
      hoverIconBg: "group-hover:bg-cyan-100",
      hoverIconColor: "group-hover:text-cyan-700",
      activeBg: "bg-cyan-50",
      activeBorder: "ring-cyan-200",
      activeText: "text-cyan-700",
      activeHint: "text-cyan-600/80",
      rail: "bg-cyan-300",
    },
  },
];

function getInitials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "Admin";
  const tokens = source.split(/[ @._-]+/).filter(Boolean).slice(0, 2);
  return tokens.map((t) => t[0]?.toUpperCase() ?? "").join("") || "AD";
}

function getActiveNavItem(pathname: string) {
  const links = navItems.filter((i): i is Extract<NavEntry, { type: "link" }> => i.type === "link");
  const matches = links.filter((item) => {
    if (item.href === "/admin") return pathname === "/admin";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
  if (!matches.length) return null;
  const sorted = matches.sort((a, b) => b.href.length - a.href.length);
  return sorted[0] ?? null;
}

function Sidebar({
  onNavigate,
  pathname,
}: {
  onNavigate?: () => void;
  pathname: string;
}) {
  const activeHref = useMemo(() => {
    const active = getActiveNavItem(pathname);
    return active?.href ?? null;
  }, [pathname]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-200 text-xs font-semibold text-violet-700 shadow-sm">
          ZS
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Z-Suite Eval</p>
          <p className="text-xs text-foreground/55">Panel academico</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-2.5">
        {navItems.map((item) => {
          if (item.type === "section") {
            return (
              <div
                key={item.label}
                className="px-2.5 pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/35"
              >
                {item.label}
              </div>
            );
          }
          const active = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className={`group relative flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-200 ${
                active
                  ? `${item.accent.activeBg} ${item.accent.activeText} ring-1 ${item.accent.activeBorder} shadow-sm`
                  : "text-foreground/70 hover:bg-white hover:text-foreground hover:shadow-sm hover:-translate-y-[1px]"
              }`}
            >
              <span
                className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full transition-opacity ${
                  active ? `${item.accent.rail} opacity-100` : "opacity-0 group-hover:opacity-100 bg-border"
                }`}
              />
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                  active
                    ? `${item.accent.iconBg} ${item.accent.iconColor}`
                    : `bg-muted/60 text-foreground/45 ${item.accent.hoverIconBg} ${item.accent.hoverIconColor} group-hover:scale-105`
                }`}
              >
                <Icon className={`h-4 w-4 transition-transform duration-200 ${active ? "scale-105" : "group-hover:scale-110"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-4">{item.label}</p>
                <p className={`text-[11px] leading-4 ${active ? item.accent.activeHint : "text-foreground/45"}`}>
                  {item.hint}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const activeItem = useMemo(() => getActiveNavItem(pathname), [pathname]);

  const userName = user?.displayName || "Administrador";
  const userEmail = user?.email || "sin-correo";
  const initials = useMemo(() => getInitials(user?.displayName ?? null, user?.email ?? null), [user]);
  const profilePhoto = useMemo(() => {
    if (!user) return null;
    const direct = user.photoURL;
    if (direct) return direct;
    const fromProvider = user.providerData.find((p) => p?.photoURL)?.photoURL;
    if (fromProvider) return fromProvider;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=111827&color=ffffff`;
  }, [user, userName]);

  async function handleLogout() {
    await logout();
    router.replace("/admin/login");
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <div className="flex h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 border-r border-border bg-surface lg:block">
          <Sidebar pathname={pathname} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-1400px items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="zs-btn-secondary h-10 w-10 px-0 lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex items-center gap-3">
                {activeItem ? (
                  <>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${activeItem.accent.iconBg} ${activeItem.accent.iconColor}`}
                    >
                      <activeItem.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{activeItem.label}</p>
                      <p className={`truncate text-xs ${activeItem.accent.activeHint}`}>{activeItem.hint}</p>
                    </div>
                  </>
                ) : (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">Control de examenes</p>
                    <p className="truncate text-xs text-foreground/55">
                      Monitorea actividad, resultados y estado general de la plataforma
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profilePhoto}
                    alt={userName}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-200 text-xs font-semibold text-violet-700 shadow-sm">
                    {initials}
                  </div>
                )}

                <div className="hidden sm:block">
                  <p className="max-w-48 truncate text-sm font-medium text-foreground">{userName}</p>
                  <p className="max-w-48 truncate text-xs text-foreground/55">{userEmail}</p>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="zs-btn-danger-soft"
                >
                  Cerrar sesion
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-1400px px-4 py-6 sm:px-6">{children}</div>
          </main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar menu"
          />
          <aside className="absolute left-0 top-0 h-full w-[85%] max-w-xs bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <p className="text-sm font-semibold text-foreground">Menu</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="zs-btn-secondary h-9"
              >
                Cerrar
              </button>
            </div>
            <Sidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
