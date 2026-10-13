"use client";

import * as React from "react";
import { motion } from "framer-motion";

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
  id: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

export interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className = "" }: TabsProps) {
  const id = React.useId();
  return (
    <TabsContext.Provider value={{ value, onValueChange, id }}>
      <div className={`w-full ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  children: React.ReactNode;
  className?: string;
  variant?: "pills" | "underline";
}

export function TabList({ children, className = "", variant = "pills" }: TabListProps) {
  const baseStyles =
    variant === "pills"
      ? "flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-xl overflow-x-auto no-scrollbar"
      : "flex items-center gap-6 border-b border-slate-200 dark:border-white/10 overflow-x-auto no-scrollbar";

  return (
    <div role="tablist" className={`${baseStyles} ${className}`}>
      {children}
    </div>
  );
}

export interface TabTriggerProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function TabTrigger({
  value,
  children,
  icon,
  badge,
  disabled = false,
  className = "",
}: TabTriggerProps) {
  const { value: activeValue, onValueChange, id } = useTabs();
  const isActive = activeValue === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={`relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none ${
        isActive
          ? "text-slate-900 dark:text-white font-semibold"
          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      } ${className}`}
    >
      {isActive && (
        <motion.div
          layoutId={`active-tab-${id}`}
          className="absolute inset-0 bg-white dark:bg-slate-800 shadow-sm border border-slate-200/60 dark:border-white/10 rounded-lg"
          transition={{ type: "spring", stiffness: 450, damping: 35 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
        {badge && <span className="shrink-0">{badge}</span>}
      </span>
    </button>
  );
}

export interface TabContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabContent({ value, children, className = "" }: TabContentProps) {
  const { value: activeValue } = useTabs();

  if (activeValue !== value) return null;

  return (
    <motion.div
      role="tabpanel"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={`mt-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}
