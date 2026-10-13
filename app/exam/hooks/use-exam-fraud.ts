"use client";

import { useEffect, useRef, useState } from "react";
import {
  FRAUD_FAIL_TOTAL_EVENTS,
  FRAUD_GRACE_EVENTS,
} from "@/lib/exam-grading";
import { getStoredAttemptState, saveStoredAttemptState } from "../services/exam-storage";

export interface UseExamFraudOptions {
  attemptId: string | null;
  enabled: boolean;
  isActive: boolean;
  submitted: boolean;
  onFraudThresholdReached: () => void;
}

export function useExamFraud({
  attemptId,
  enabled,
  isActive,
  submitted,
  onFraudThresholdReached,
}: UseExamFraudOptions) {
  const [fraudTabSwitches, setFraudTabSwitches] = useState(0);
  const [fraudClipboardAttempts, setFraudClipboardAttempts] = useState(0);
  const [graceUsedToastVisible, setGraceUsedToastVisible] = useState(false);
  const [graceDismissedAt, setGraceDismissedAt] = useState<number | null>(null);

  const fraudCountsRef = useRef({ tab: 0, clip: 0 });
  const fraudRuntimeRef = useRef({
    lastSyncAt: 0,
    lastClipboardCountAt: 0,
    lastTabCountAt: 0,
    isVisible: true,
    submittedFraudFail: false,
  });

  // Mantener ref sincronizada
  useEffect(() => {
    fraudCountsRef.current = { tab: fraudTabSwitches, clip: fraudClipboardAttempts };
  }, [fraudTabSwitches, fraudClipboardAttempts]);

  // Alerta de cortesías agotadas
  useEffect(() => {
    if (!isActive || submitted || !enabled) return;
    const total = fraudTabSwitches + fraudClipboardAttempts;
    if (total >= FRAUD_GRACE_EVENTS) {
      const lastDismissed = graceDismissedAt ?? 0;
      if (!graceUsedToastVisible && Date.now() - lastDismissed > 10_000) {
        setGraceUsedToastVisible(true);
      }
    } else {
      if (graceUsedToastVisible) setGraceUsedToastVisible(false);
    }
  }, [fraudTabSwitches, fraudClipboardAttempts, isActive, submitted, enabled, graceUsedToastVisible, graceDismissedAt]);

  // Auto-ocultar toast de cortesías tras 9s
  useEffect(() => {
    if (!graceUsedToastVisible) return;
    const t = window.setTimeout(() => {
      setGraceUsedToastVisible(false);
      setGraceDismissedAt(Date.now());
    }, 9000);
    return () => window.clearTimeout(t);
  }, [graceUsedToastVisible]);

  // Listeners de antifraude
  useEffect(() => {
    if (!isActive || !attemptId || submitted || !enabled) return;
    const id = attemptId;

    function syncFraud(nextTab: number, nextClip: number) {
      const now = Date.now();
      fraudRuntimeRef.current.lastSyncAt = now;
      const current = getStoredAttemptState(id);
      if (current) {
        saveStoredAttemptState(id, {
          ...current,
          fraudTabSwitches: nextTab,
          fraudClipboardAttempts: nextClip,
          updatedAtMs: now,
        });
      }
    }

    function applyTabSwitch() {
      const now = Date.now();
      if (now - fraudRuntimeRef.current.lastTabCountAt < 500) return;
      if (fraudRuntimeRef.current.submittedFraudFail) return;
      const currentTotal = fraudCountsRef.current.tab + fraudCountsRef.current.clip;
      if (currentTotal >= FRAUD_FAIL_TOTAL_EVENTS) {
        fraudRuntimeRef.current.submittedFraudFail = true;
        return;
      }
      fraudRuntimeRef.current.lastTabCountAt = now;

      const nextTab = fraudCountsRef.current.tab + 1;
      const nextClip = fraudCountsRef.current.clip;
      fraudCountsRef.current = { tab: nextTab, clip: nextClip };
      setFraudTabSwitches(nextTab);
      syncFraud(nextTab, nextClip);

      if (nextTab + nextClip >= FRAUD_FAIL_TOTAL_EVENTS && !fraudRuntimeRef.current.submittedFraudFail) {
        fraudRuntimeRef.current.submittedFraudFail = true;
        syncFraud(nextTab, nextClip);
        onFraudThresholdReached();
      }
    }

    function applyClipboardAttempt() {
      const now = Date.now();
      if (now - fraudRuntimeRef.current.lastClipboardCountAt < 250) return;
      if (fraudRuntimeRef.current.submittedFraudFail) return;
      const currentTotal = fraudCountsRef.current.tab + fraudCountsRef.current.clip;
      if (currentTotal >= FRAUD_FAIL_TOTAL_EVENTS) {
        fraudRuntimeRef.current.submittedFraudFail = true;
        return;
      }
      fraudRuntimeRef.current.lastClipboardCountAt = now;

      const nextTab = fraudCountsRef.current.tab;
      const nextClip = fraudCountsRef.current.clip + 1;
      fraudCountsRef.current = { tab: nextTab, clip: nextClip };
      setFraudClipboardAttempts(nextClip);
      syncFraud(nextTab, nextClip);

      if (nextTab + nextClip >= FRAUD_FAIL_TOTAL_EVENTS && !fraudRuntimeRef.current.submittedFraudFail) {
        fraudRuntimeRef.current.submittedFraudFail = true;
        syncFraud(nextTab, nextClip);
        onFraudThresholdReached();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "c" || k === "v") {
        applyClipboardAttempt();
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function onCopy(e: ClipboardEvent) {
      applyClipboardAttempt();
      e.preventDefault();
      e.stopPropagation();
    }

    function onPaste(e: ClipboardEvent) {
      applyClipboardAttempt();
      e.preventDefault();
      e.stopPropagation();
    }

    function onVisibilityChange() {
      const visible = document.visibilityState === "visible";
      if (!visible && fraudRuntimeRef.current.isVisible) {
        fraudRuntimeRef.current.isVisible = false;
        applyTabSwitch();
        return;
      }
      if (visible) fraudRuntimeRef.current.isVisible = true;
    }

    function onWindowBlur() {
      if (fraudRuntimeRef.current.isVisible) {
        fraudRuntimeRef.current.isVisible = false;
        applyTabSwitch();
      }
    }

    function onWindowFocus() {
      fraudRuntimeRef.current.isVisible = true;
    }

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }

    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("copy", onCopy, { capture: true });
    document.addEventListener("paste", onPaste, { capture: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isActive, attemptId, submitted, enabled, onFraudThresholdReached]);

  return {
    fraudTabSwitches,
    setFraudTabSwitches,
    fraudClipboardAttempts,
    setFraudClipboardAttempts,
    fraudCountsRef,
    graceUsedToastVisible,
    dismissGraceToast: () => {
      setGraceUsedToastVisible(false);
      setGraceDismissedAt(Date.now());
    },
    resetFraud: (tab = 0, clip = 0) => {
      setFraudTabSwitches(tab);
      setFraudClipboardAttempts(clip);
      fraudCountsRef.current = { tab, clip };
      fraudRuntimeRef.current.submittedFraudFail = false;
    },
  };
}
