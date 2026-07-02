"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

type ToastTone = "success" | "error" | "info" | "warning";

type ToastInput = {
  title?: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  tone: ToastTone;
  durationMs: number;
};

type ConfirmInput = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
};

type ConfirmState = ConfirmInput & {
  open: boolean;
};

type FeedbackContextValue = {
  notify: (input: ToastInput) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  confirm: (input: ConfirmInput) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function toastToneClass(tone: ToastTone) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "error") return "border-rose-200 bg-rose-50 text-rose-900";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-sky-200 bg-sky-50 text-sky-900";
}

function toastToneIcon(tone: ToastTone) {
  if (tone === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (tone === "error") return <AlertTriangle className="h-4 w-4" />;
  if (tone === "warning") return <TriangleAlert className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback debe usarse dentro de <FeedbackProvider />.");
  }
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
    tone: "primary",
  });
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((input: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: ToastItem = {
      id,
      title: input.title,
      message: input.message,
      tone: input.tone ?? "info",
      durationMs: input.durationMs ?? 4200,
    };
    setToasts((prev) => [...prev, toast]);
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, toast.durationMs),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts]);

  const closeConfirm = useCallback((value: boolean) => {
    setConfirmState((prev) => ({ ...prev, open: false }));
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    resolver?.(value);
  }, []);

  const confirm = useCallback((input: ConfirmInput) => {
    setConfirmState({
      open: true,
      title: input.title,
      description: input.description ?? "",
      confirmLabel: input.confirmLabel ?? "Confirmar",
      cancelLabel: input.cancelLabel ?? "Cancelar",
      tone: input.tone ?? "primary",
    });
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
    });
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      notify,
      success: (message, title) => notify({ tone: "success", message, title }),
      error: (message, title) => notify({ tone: "error", message, title }),
      info: (message, title) => notify({ tone: "info", message, title }),
      warning: (message, title) => notify({ tone: "warning", message, title }),
      confirm,
    }),
    [confirm, notify],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-80 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${toastToneClass(toast.tone)}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{toastToneIcon(toast.tone)}</div>
              <div className="min-w-0 flex-1">
                {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
                <p className="text-sm leading-5">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/60 text-current transition hover:bg-white"
                aria-label="Cerrar notificación"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmState.open ? (
        <div className="fixed inset-0 z-90 flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => closeConfirm(false)}
            aria-label="Cerrar confirmación"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
            <div className="border-b border-border bg-surface px-5 py-4">
              <p className="text-base font-semibold text-foreground">{confirmState.title}</p>
              {confirmState.description ? (
                <p className="mt-1 text-sm text-foreground/65">{confirmState.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4">
              <button type="button" onClick={() => closeConfirm(false)} className="zs-btn-secondary">
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={confirmState.tone === "danger" ? "zs-btn-danger" : "zs-btn-primary"}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </FeedbackContext.Provider>
  );
}
