"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  accentColor?: "indigo" | "emerald" | "amber" | "sky" | "rose" | "slate";
  className?: string;
}

const accentIconBg: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  accentColor = "indigo",
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-slate-300 transition-all ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${accentIconBg[accentColor]}`}
          >
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-50 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${
                trend.isPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {trend.value > 0 ? `+${trend.value}%` : `${trend.value}%`}
            </span>
          )}
          {subtitle && <span className="text-slate-500 truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
