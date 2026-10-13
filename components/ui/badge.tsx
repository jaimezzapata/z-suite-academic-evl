"use client";

import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "cesde"
  | "sena"
  | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700 border-slate-200",
  primary: "bg-indigo-50 text-indigo-700 border-indigo-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  cesde: "bg-sky-50 text-sky-700 border-sky-200 font-semibold",
  sena: "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold",
  outline: "bg-transparent text-slate-600 border-slate-300",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-slate-400",
  primary: "bg-indigo-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  cesde: "bg-sky-500",
  sena: "bg-emerald-600",
  outline: "bg-slate-400",
};

export function Badge({
  variant = "default",
  size = "md",
  dot = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors ${variantStyles[variant]} ${sizeClass} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
