import * as React from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type AlertVariant = "info" | "success" | "warning" | "danger";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onClose?: () => void;
  icon?: React.ReactNode;
}

const variantStyles: Record<AlertVariant, { container: string; iconClass: string; defaultIcon: React.ReactNode }> = {
  info: {
    container: "bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-800/40 text-blue-900 dark:text-blue-200",
    iconClass: "text-blue-600 dark:text-blue-400",
    defaultIcon: <Info className="w-5 h-5" />,
  },
  success: {
    container: "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    defaultIcon: <CheckCircle2 className="w-5 h-5" />,
  },
  warning: {
    container: "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-200",
    iconClass: "text-amber-600 dark:text-amber-400",
    defaultIcon: <AlertTriangle className="w-5 h-5" />,
  },
  danger: {
    container: "bg-red-50/80 dark:bg-red-950/30 border-red-200/80 dark:border-red-800/40 text-red-900 dark:text-red-200",
    iconClass: "text-red-600 dark:text-red-400",
    defaultIcon: <AlertCircle className="w-5 h-5" />,
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  onClose,
  icon,
  className = "",
  ...props
}: AlertProps) {
  const config = variantStyles[variant];

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm text-sm transition-all duration-200 ${config.container} ${className}`}
      {...props}
    >
      <div className={`shrink-0 mt-0.5 ${config.iconClass}`}>
        {icon || config.defaultIcon}
      </div>

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-semibold text-sm mb-1 leading-tight text-inherit">
            {title}
          </h4>
        )}
        <div className="text-sm opacity-90 leading-relaxed font-normal">
          {children}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 -mr-1 -mt-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
          aria-label="Cerrar alerta"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
