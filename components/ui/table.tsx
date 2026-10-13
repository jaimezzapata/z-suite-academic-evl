import * as React from "react";

export function Table({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm shadow-xs">
      <table
        className={`w-full caption-bottom text-left text-xs ${className}`}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`border-b border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] ${className}`}
      {...props}
    />
  );
}

export function TableBody({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={`divide-y divide-slate-100 dark:divide-white/5 ${className}`}
      {...props}
    />
  );
}

export function TableRow({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50 data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-800 ${className}`}
      {...props}
    />
  );
}

export function TableHead({
  className = "",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`h-10 px-4 text-left align-middle font-medium text-slate-500 dark:text-slate-400 [&:has([role=checkbox])]:pr-0 ${className}`}
      {...props}
    />
  );
}

export function TableCell({
  className = "",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={`p-4 align-middle text-slate-700 dark:text-slate-200 [&:has([role=checkbox])]:pr-0 ${className}`}
      {...props}
    />
  );
}

export function TableCaption({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={`mt-4 text-xs text-slate-500 dark:text-slate-400 ${className}`}
      {...props}
    />
  );
}
