"use client";

import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui";
import type { NavItem } from "./admin-nav-config";

interface AdminHeaderProps {
  activeItem: NavItem | null;
  userName: string;
  userEmail: string;
  initials: string;
  profilePhoto: string | null;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
}

export function AdminHeader({
  activeItem,
  userName,
  userEmail,
  initials,
  profilePhoto,
  onOpenMobileMenu,
  onLogout,
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-1400px items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Mobile Menu Button */}
        <Button
          variant="secondary"
          size="icon"
          onClick={onOpenMobileMenu}
          className="lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Route Active Title / Icon */}
        <div className="min-w-0 flex items-center gap-3">
          {activeItem ? (
            <>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-xs ${activeItem.accent.iconBg} ${activeItem.accent.iconColor}`}
              >
                <activeItem.icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{activeItem.label}</p>
                <p className={`truncate text-xs ${activeItem.accent.activeHint}`}>{activeItem.hint}</p>
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">Control de exámenes</p>
              <p className="truncate text-xs text-foreground/55">
                Monitorea actividad, resultados y estado general de la plataforma
              </p>
            </div>
          )}
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center gap-3">
          {profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profilePhoto}
              alt={userName}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-border shadow-xs"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-xs">
              {initials}
            </div>
          )}

          <div className="hidden sm:block text-left">
            <p className="max-w-44 truncate text-xs font-bold text-foreground leading-4">{userName}</p>
            <p className="max-w-44 truncate text-[11px] text-foreground/55 leading-4">{userEmail}</p>
          </div>

          <Button
            variant="danger-soft"
            size="sm"
            onClick={onLogout}
            leftIcon={<LogOut className="h-3.5 w-3.5" />}
            className="text-xs"
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    </header>
  );
}
