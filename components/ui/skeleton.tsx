import * as React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "rectangular" | "circular" | "rounded" | "text";
}

export function Skeleton({
  variant = "rounded",
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    rectangular: "rounded-none",
    circular: "rounded-full",
    rounded: "rounded-xl",
    text: "rounded-md h-4 w-full",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-pulse bg-slate-200/80 dark:bg-slate-800/80 ${variantStyles[variant]} ${className}`}
      style={style}
      {...props}
    >
      <span className="sr-only">Cargando...</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton variant="circular" className="w-10 h-10" />
        <Skeleton variant="rounded" className="w-16 h-6" />
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" className="w-3/4 h-5" />
        <Skeleton variant="text" className="w-1/2 h-4" />
      </div>
      <Skeleton variant="rounded" className="w-full h-10" />
    </div>
  );
}
