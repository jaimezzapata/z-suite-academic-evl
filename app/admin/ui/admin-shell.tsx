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
  BookOpen,
  Folder,
  LayoutDashboard,
  Menu,
  Settings2,
  Wrench,
  ClipboardList,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavEntry =
  | ({ type: "link" } & NavItem)
  | { type: "section"; label: string };

const navItems: NavEntry[] = [
  { type: "link", label: "Dashboard", href: "/admin", hint: "Metricas generales", icon: LayoutDashboard },
  { type: "link", label: "Banco", href: "/admin/bank", hint: "Preguntas y carga", icon: BookOpen },
  { type: "link", label: "Examenes", href: "/admin/templates", hint: "Creacion y control", icon: ClipboardList },
  { type: "link", label: "Grupos", href: "/admin/groups", hint: "Cuadernillos por grupo", icon: BookOpen },
  // { type: "link", label: "Documentacion", href: "/admin/documentation", hint: "Central de publicación", icon: BookOpen },
  { type: "link", label: "Drive", href: "/admin/drive", hint: "Archivos y estructura", icon: Folder },
  { type: "link", label: "IA Documentación", href: "/admin/settings/ai-docs", hint: "Generar y publicar", icon: Bot },
  { type: "link", label: "Activos", href: "/admin/live", hint: "Codigos y monitoreo", icon: Activity },
  { type: "link", label: "Resultados", href: "/admin/results", hint: "Notas y exportaciones", icon: BarChart3 },
  { type: "section", label: "Ajustes" },
  { type: "link", label: "Catalogos", href: "/admin/settings", hint: "Materias, grupos y momentos", icon: Settings2 },
  { type: "link", label: "IA Test", href: "/admin/settings/ia-test", hint: "Probar Gemini", icon: Bot },
  { type: "link", label: "Firebase", href: "/admin/settings/firebase", hint: "Herramientas y limpieza", icon: Wrench },
];

function getInitials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "Admin";
  const tokens = source.split(/[ @._-]+/).filter(Boolean).slice(0, 2);
  return tokens.map((t) => t[0]?.toUpperCase() ?? "").join("") || "AD";
}

function Sidebar({
  onNavigate,
  pathname,
}: {
  onNavigate?: () => void;
  pathname: string;
}) {
  const activeHref = useMemo(() => {
    const links = navItems.filter((i): i is Extract<NavEntry, { type: "link" }> => i.type === "link");
    const matches = links.filter((item) => {
      if (item.href === "/admin") return pathname === "/admin";
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    });
    if (!matches.length) return null;
    return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
  }, [pathname]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-sm">
          ZS
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Z-Suite Eval</p>
          <p className="text-xs text-foreground/55">Panel academico</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          if (item.type === "section") {
            return (
              <div
                key={item.label}
                className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-foreground/50"
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
              className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                active
                  ? "bg-primary/10 text-primary ring-1 ring-primary/15"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${active ? "text-primary" : "text-foreground/45 group-hover:text-foreground/70"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className={`text-xs ${active ? "text-primary/70" : "text-foreground/45"}`}>
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
            <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="zs-btn-secondary h-10 w-10 px-0 lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">Control de examenes</p>
                <p className="truncate text-xs text-foreground/55">
                  Monitorea actividad, resultados y estado general de la plataforma
                </p>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white shadow-sm">
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
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</div>
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
