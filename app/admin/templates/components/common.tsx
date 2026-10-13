"use client";

import React from "react";

export function ActionIconButton({
  title,
  onClick,
  disabled,
  tone,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "neutral" | "primary" | "danger";
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-50";
  const variant =
    tone === "danger"
      ? "text-rose-600 hover:bg-rose-50"
      : tone === "primary"
        ? "text-zinc-900 hover:bg-zinc-100"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variant}`}
      aria-label={title}
      title={title}
    >
      {children}
    </button>
  );
}

export function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-800">{label}</p>
        {description ? <p className="truncate text-xs text-zinc-500">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          value ? "bg-zinc-900" : "bg-zinc-200"
        }`}
        aria-pressed={value}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            value ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
