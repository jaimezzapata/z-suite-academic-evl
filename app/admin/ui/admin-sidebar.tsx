"use client";

import { useMemo } from "react";
import Link from "next/link";
import { getActiveNavItem, navItems } from "./admin-nav-config";

interface AdminSidebarProps {
  pathname: string;
  onNavigate?: () => void;
}

export function AdminSidebar({ pathname, onNavigate }: AdminSidebarProps) {
  const activeHref = useMemo(() => {
    const active = getActiveNavItem(pathname);
    return active?.href ?? null;
  }, [pathname]);

  return (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 dark:bg-violet-500 text-xs font-bold text-white shadow-sm">
          ZS
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Z-Suite Eval</p>
          <p className="text-xs text-foreground/55">Panel académico</p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-0.5 p-2.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.type === "section") {
            return (
              <div
                key={item.label}
                className="px-2.5 pb-1 pt-3.5 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40"
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
                  ? `${item.accent.activeBg} ${item.accent.activeText} ring-1 ${item.accent.activeBorder} shadow-sm font-semibold`
                  : "text-foreground/70 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-foreground"
              }`}
            >
              <span
                className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full transition-opacity ${
                  active ? `${item.accent.rail} opacity-100` : "opacity-0 group-hover:opacity-60 bg-border"
                }`}
              />
              <div
                className={`mt-0.5 flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                  active
                    ? `${item.accent.iconBg} ${item.accent.iconColor}`
                    : `bg-slate-100 dark:bg-slate-800 text-foreground/45 ${item.accent.hoverIconBg} ${item.accent.hoverIconColor} group-hover:scale-105`
                }`}
              >
                <Icon className={`h-4 w-4 transition-transform duration-200 ${active ? "scale-105" : "group-hover:scale-110"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] leading-4 truncate">{item.label}</p>
                <p className={`text-[11px] leading-4 truncate ${active ? item.accent.activeHint : "text-foreground/45"}`}>
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
