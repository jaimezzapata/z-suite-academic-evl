import * as React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, className = "", children, id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-tight"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`w-full appearance-none rounded-xl border bg-white/80 dark:bg-slate-900/80 px-3.5 py-2.5 pr-10 text-xs text-slate-900 dark:text-white transition-all duration-150 backdrop-blur-sm
              focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-950
              disabled:cursor-not-allowed disabled:opacity-50
              ${
                error
                  ? "border-red-300 dark:border-red-800/80 focus:border-red-500 focus:ring-red-500/20"
                  : "border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-indigo-500/20"
              }
              ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {error ? (
          <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
