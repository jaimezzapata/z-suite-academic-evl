"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "danger-soft"
  | "success"
  | "cesde"
  | "sena";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 focus-visible:ring-indigo-500",
  secondary:
    "border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-slate-400",
  outline:
    "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:bg-rose-700 focus-visible:ring-rose-500",
  "danger-soft":
    "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200 focus-visible:ring-rose-400",
  success:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-500",
  cesde:
    "bg-sky-600 text-white shadow-sm hover:bg-sky-500 active:bg-sky-700 focus-visible:ring-sky-500",
  sena:
    "bg-emerald-700 text-white shadow-sm hover:bg-emerald-600 active:bg-emerald-800 focus-visible:ring-emerald-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-11 px-5 text-base rounded-xl gap-2.5",
  icon: "h-9 w-9 p-0 rounded-xl justify-center",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";
