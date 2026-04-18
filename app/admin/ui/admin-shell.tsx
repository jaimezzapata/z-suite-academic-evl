"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import {
  Activity,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Menu,
  Settings2,
  ClipboardList,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", hint: "Metricas generales", icon: LayoutDashboard },
  { label: "Banco", href: "/admin/bank", hint: "Preguntas y carga", icon: BookOpen },
  { label: "Examenes", href: "/admin/templates", hint: "Creacion y control", icon: ClipboardList },
  { label: "Activos", href: "/admin/live", hint: "Codigos y monitoreo", icon: Activity },
  { label: "Resultados", href: "/admin/results", hint: "Notas y exportaciones", icon: BarChart3 },
  { label: "Catalogos", href: "/admin/settings", hint: "Sedes, grupos, jornadas", icon: Settings2 },
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
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white">
          ZS
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Z-Suite Eval</p>
          <p className="text-xs text-zinc-500">Panel academico</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${active ? "text-white" : "text-zinc-500"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className={`text-xs ${active ? "text-zinc-300" : "text-zinc-500"}`}>
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
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <div className="flex h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 border-r border-zinc-200 bg-white lg:block">
          <Sidebar pathname={pathname} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">Control de examenes</p>
                <p className="truncate text-xs text-zinc-500">
                  Monitorea actividad, resultados y estado general de la plataforma
                </p>
              </div>

              <div className="flex items-center gap-3">
                {profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profilePhoto}
                    alt={userName}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-zinc-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                    {initials}
                  </div>
                )}

                <div className="hidden sm:block">
                  <p className="max-w-48 truncate text-sm font-medium text-zinc-900">{userName}</p>
                  <p className="max-w-48 truncate text-xs text-zinc-500">{userEmail}</p>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="h-10 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
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
          <aside className="absolute left-0 top-0 h-full w-[85%] max-w-xs bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
              <p className="text-sm font-semibold text-zinc-900">Menu</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700"
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
