"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-xs border border-slate-200">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h4 className="mt-3.5 text-sm font-semibold text-slate-900">{title}</h4>
      {description && (
        <p className="mt-1 text-xs text-slate-500 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
