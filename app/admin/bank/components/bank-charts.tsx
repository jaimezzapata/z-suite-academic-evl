"use client";

import React, { useMemo } from "react";
import { formatCompactNumber } from "../services/bank-service";

function buildSparkPath(values: number[], w: number, h: number) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = values.length === 1 ? 0 : w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function MiniSparkline({ values }: { values: number[] }) {
  const path = useMemo(() => buildSparkPath(values, 88, 22), [values]);
  if (!values.length) return <div className="h-6 w-24 rounded-md bg-zinc-100" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values.map((v, i) => {
    const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 88;
    const y = 22 - ((v - min) / span) * 22;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const area = `M 0 22 L ${points.join(" ")} L 88 22 Z`;
  return (
    <svg viewBox="0 0 88 22" className="h-6 w-[92px]">
      <path d={area} className="fill-zinc-100" />
      <path d={path} className="fill-none stroke-zinc-800" strokeWidth={2} />
    </svg>
  );
}

export function Donut({
  items,
}: {
  items: { label: string; value: number; tone: "emerald" | "amber" | "zinc" | "indigo" | "sky" }[];
}) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const r = 16;
  const c = 2 * Math.PI * r;
  const toneToStroke = (tone: "emerald" | "amber" | "zinc" | "indigo" | "sky") =>
    tone === "emerald"
      ? "stroke-emerald-500"
      : tone === "amber"
        ? "stroke-amber-500"
        : tone === "indigo"
          ? "stroke-indigo-500"
          : tone === "sky"
            ? "stroke-sky-500"
            : "stroke-zinc-700";

  const segments = items.reduce(
    (acc, it) => {
      const frac = it.value / total;
      const dash = frac * c;
      const dasharray = `${dash.toFixed(2)} ${(c - dash).toFixed(2)}`;
      const next = {
        label: it.label,
        tone: it.tone,
        dasharray,
        dashoffset: (-acc.offset).toFixed(2),
      };
      return { offset: acc.offset + dash, segs: [...acc.segs, next] };
    },
    {
      offset: 0,
      segs: [] as {
        label: string;
        tone: "emerald" | "amber" | "zinc" | "indigo" | "sky";
        dasharray: string;
        dashoffset: string;
      }[],
    },
  ).segs;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 44 44" className="h-16 w-16 -rotate-90">
        <circle cx="22" cy="22" r={r} className="stroke-zinc-100" strokeWidth="8" fill="none" />
        {segments.map((seg) => (
          <circle
            key={seg.label}
            cx="22"
            cy="22"
            r={r}
            className={toneToStroke(seg.tone)}
            strokeWidth="8"
            fill="none"
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.dashoffset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="min-w-0 space-y-1 text-sm">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-4">
            <span className="truncate text-zinc-700">{it.label}</span>
            <span className="shrink-0 font-semibold text-zinc-900">
              {formatCompactNumber(it.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="space-y-1">
          <div className="flex items-center justify-between gap-4 text-xs text-zinc-600">
            <span className="truncate">{it.label}</span>
            <span className="font-semibold text-zinc-900">{formatCompactNumber(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all duration-300"
              style={{ width: `${Math.round((it.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
