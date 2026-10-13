const RESUME_KEY = "zse:examResume";
const ATTEMPT_STATE_PREFIX = "zse:attemptState:";

export interface ResumeData {
  publishedExamId?: string;
  attemptId?: string;
  accessCode?: string;
}

export interface StoredAttemptState {
  attemptId: string;
  publishedExamId: string | null;
  accessCode: string | null;
  startedAtMs: number | null;
  endAtMs: number | null;
  answers: Record<string, unknown>;
  currentQuestionIndex: number;
  questionOrder: string[];
  fraudTabSwitches: number;
  fraudClipboardAttempts: number;
  updatedAtMs: number;
}

export function getStoredResume(): ResumeData | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResumeData;
  } catch {
    return null;
  }
}

export function saveStoredResume(data: ResumeData): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(data));
  } catch {}
}

export function clearStoredResume(): void {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {}
}

export function getStoredAttemptState(attemptId: string): StoredAttemptState | null {
  try {
    const raw = localStorage.getItem(`${ATTEMPT_STATE_PREFIX}${attemptId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAttemptState;
  } catch {
    return null;
  }
}

export function saveStoredAttemptState(attemptId: string, state: StoredAttemptState): void {
  try {
    localStorage.setItem(`${ATTEMPT_STATE_PREFIX}${attemptId}`, JSON.stringify(state));
  } catch {}
}

export function getDismissedAdminMessage(attemptId: string): string | null {
  try {
    return localStorage.getItem(`zse:adminMsgDismissed:${attemptId}`);
  } catch {
    return null;
  }
}

export function saveDismissedAdminMessage(attemptId: string, key: string): void {
  try {
    localStorage.setItem(`zse:adminMsgDismissed:${attemptId}`, key);
  } catch {}
}
