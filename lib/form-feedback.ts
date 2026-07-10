export type FormFeedbackApi = {
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

type ReportInput = {
  message: string;
  title?: string;
  feedback?: FormFeedbackApi;
  setMessage?: (message: string | null) => void;
  tone?: "error" | "warning" | "success" | "info";
};

export function reportFormMessage(input: ReportInput) {
  input.setMessage?.(input.message);
  if (!input.feedback) return input.message;

  if (input.tone === "success") {
    input.feedback.success(input.message, input.title);
    return input.message;
  }
  if (input.tone === "warning") {
    input.feedback.warning(input.message, input.title);
    return input.message;
  }
  if (input.tone === "info") {
    input.feedback.info(input.message, input.title);
    return input.message;
  }

  input.feedback.error(input.message, input.title);
  return input.message;
}

export function reportFormError(input: Omit<ReportInput, "tone">) {
  return reportFormMessage({ ...input, tone: "error", title: input.title ?? "Validacion" });
}

export function reportFormWarning(input: Omit<ReportInput, "tone">) {
  return reportFormMessage({ ...input, tone: "warning", title: input.title ?? "Revisa el formulario" });
}

export function reportFormSuccess(input: Omit<ReportInput, "tone">) {
  return reportFormMessage({ ...input, tone: "success" });
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
