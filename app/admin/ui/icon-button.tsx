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
    "inline-flex items-center justify-center rounded-xl ring-1 transition disabled:opacity-50 disabled:cursor-not-allowed";

  const v =
    variant === "primary"
      ? "bg-zinc-900 text-white ring-zinc-900/10 hover:bg-zinc-800"
      : variant === "danger"
        ? "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100"
        : "bg-white text-zinc-800 ring-zinc-200 hover:bg-zinc-100";

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

