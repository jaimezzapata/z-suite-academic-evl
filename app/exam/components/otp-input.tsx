"use client";

import { useMemo } from "react";

export interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}

export function OTPInput({ value, onChange, length = 6 }: OTPInputProps) {
  const digits = useMemo(
    () =>
      Array.from({ length }, (_, i) => {
        const char = value[i];
        return /\d/.test(char ?? "") ? char : "";
      }),
    [value, length],
  );

  function setDigit(index: number, digit: string) {
    const next = digits
      .map((d, i) => (i === index ? digit : d))
      .join("")
      .replace(/\D/g, "")
      .slice(0, length);
    onChange(next);
  }

  function focusIndex(index: number) {
    const el = document.getElementById(`otp-${index}`) as HTMLInputElement | null;
    el?.focus();
    el?.select();
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={d}
          onChange={(e) => {
            const nextDigit = e.target.value.replace(/\D/g, "").slice(-1);
            setDigit(i, nextDigit);
            if (nextDigit && i < length - 1) focusIndex(i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              focusIndex(i - 1);
            }
            if (e.key === "ArrowLeft" && i > 0) focusIndex(i - 1);
            if (e.key === "ArrowRight" && i < length - 1) focusIndex(i + 1);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, length);
            if (!pasted) return;
            onChange(pasted);
            const nextIndex = Math.min(length - 1, pasted.length - 1);
            setTimeout(() => focusIndex(nextIndex), 0);
            e.preventDefault();
          }}
          className={`h-13 w-11 sm:h-14 sm:w-12 rounded-2xl border text-center text-xl font-bold tracking-tight outline-none transition-all duration-200 ${
            d
              ? "border-indigo-500 bg-indigo-50/50 text-indigo-900 shadow-xs ring-2 ring-indigo-200/60"
              : "border-slate-200 bg-white text-slate-800 focus:border-indigo-500 focus:bg-indigo-50/30 focus:ring-4 focus:ring-indigo-100"
          }`}
          maxLength={1}
        />
      ))}
    </div>
  );
}
