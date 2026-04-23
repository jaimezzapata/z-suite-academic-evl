"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

export function IconButton({
  variant = "secondary",
  className = "",
  children,
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50";

  const v =
    variant === "primary"
      ? "border-primary bg-primary text-primary-foreground hover:opacity-95"
      : variant === "danger"
        ? "border-danger/25 bg-danger/10 text-danger hover:bg-danger/15"
        : "border-border bg-surface text-foreground/80 hover:bg-muted";

  return (
    <button
      type="button"
      title={title}
      {...props}
      className={`${base} ${v} ${className}`}
    >
      {children}
    </button>
  );
}

