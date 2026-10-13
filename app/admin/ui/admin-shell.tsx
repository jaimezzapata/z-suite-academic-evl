"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { Button } from "@/components/ui";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import { getActiveNavItem, getInitials } from "./admin-nav-config";

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
        {/* Desktop Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-72 border-r border-border bg-surface lg:block">
          <AdminSidebar pathname={pathname} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Header */}
          <AdminHeader
            activeItem={activeItem}
            userName={userName}
            userEmail={userEmail}
            initials={initials}
            profilePhoto={profilePhoto}
            onOpenMobileMenu={() => setMobileOpen(true)}
            onLogout={() => void handleLogout()}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-1400px px-4 py-6 sm:px-6">{children}</div>
          </main>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            aria-label="Cerrar menú"
          />
          <aside className="absolute left-0 top-0 h-full w-[85%] max-w-xs bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <p className="text-sm font-bold text-foreground">Menú</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMobileOpen(false)}
              >
                Cerrar
              </Button>
            </div>
            <AdminSidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
