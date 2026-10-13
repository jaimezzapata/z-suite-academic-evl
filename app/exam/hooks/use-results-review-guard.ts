"use client";

import { useEffect, useRef, useState } from "react";

export const RESULTS_REVIEW_TOTAL_MS = 120_000; // 2 minutos

export function formatReviewClock(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds - mm * 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export interface UseResultsReviewGuardOptions {
  active: boolean;
}

export function useResultsReviewGuard({ active }: UseResultsReviewGuardOptions) {
  const [resultsReviewRemainingMs, setResultsReviewRemainingMs] = useState<number>(RESULTS_REVIEW_TOTAL_MS);
  const [resultsReviewBlocked, setResultsReviewBlocked] = useState<boolean>(false);
  const [resultsReviewBlockReason, setResultsReviewBlockReason] = useState<string | null>(null);

  const resultsReviewStartRef = useRef<number | null>(null);
  const resultsReviewIntervalRef = useRef<number | null>(null);
  const resultsReviewListenersRef = useRef<{ cleaned: boolean }>({ cleaned: true });

  function blockResultsView(reason: string) {
    if (resultsReviewBlocked) return;
    setResultsReviewBlocked(true);
    setResultsReviewBlockReason(reason);
  }

  // Countdown timer de 2 minutos
  useEffect(() => {
    if (!active || resultsReviewBlocked) {
      resultsReviewStartRef.current = null;
      if (resultsReviewIntervalRef.current != null) {
        window.clearInterval(resultsReviewIntervalRef.current);
        resultsReviewIntervalRef.current = null;
      }
      return;
    }

    if (resultsReviewStartRef.current == null) {
      resultsReviewStartRef.current = Date.now();
      setResultsReviewRemainingMs(RESULTS_REVIEW_TOTAL_MS);
    }
    const startAt = resultsReviewStartRef.current;
    resultsReviewIntervalRef.current = Number(
      window.setInterval(() => {
        const elapsed = Date.now() - startAt;
        const remaining = RESULTS_REVIEW_TOTAL_MS - elapsed;
        if (remaining <= 0) {
          setResultsReviewRemainingMs(0);
          blockResultsView("timeout");
          if (resultsReviewIntervalRef.current != null) {
            window.clearInterval(resultsReviewIntervalRef.current);
            resultsReviewIntervalRef.current = null;
          }
        } else {
          setResultsReviewRemainingMs(remaining);
        }
      }, 250),
    );

    return () => {
      if (resultsReviewIntervalRef.current != null) {
        window.clearInterval(resultsReviewIntervalRef.current);
        resultsReviewIntervalRef.current = null;
      }
    };
  }, [active, resultsReviewBlocked]);

  // Protección contra copias, capturas, menú contextual y herramientas de desarrollo
  useEffect(() => {
    if (!active || resultsReviewBlocked) {
      resultsReviewListenersRef.current.cleaned = true;
      return;
    }
    resultsReviewListenersRef.current.cleaned = false;

    function onProtectedCopyCut(e: ClipboardEvent) {
      if (resultsReviewBlocked) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      blockResultsView("copy");
    }

    function onProtectedPaste(e: ClipboardEvent) {
      if (resultsReviewBlocked) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      blockResultsView("paste");
    }

    function onProtectedContextMenu(e: MouseEvent) {
      if (resultsReviewBlocked) return;
      e.preventDefault();
      blockResultsView("contextmenu");
    }

    function onProtectedSelectStart(e: Event) {
      if (resultsReviewBlocked) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      e.preventDefault();
      blockResultsView("select");
    }

    function onProtectedDragStart(e: DragEvent) {
      if (resultsReviewBlocked) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      e.preventDefault();
      blockResultsView("drag");
    }

    function onProtectedBeforePrint() {
      if (resultsReviewBlocked) return;
      blockResultsView("print");
      try {
        window.stop();
      } catch {}
    }

    function onProtectedKeyDown(e: KeyboardEvent) {
      if (resultsReviewBlocked) return;
      const isMac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || "");
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      const key = (e.key || "").toString();
      const code = (e.code || "").toString();

      if (ctrl && key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("print");
        return;
      }
      if (ctrl && key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("copy");
        return;
      }
      const devShortcut =
        (ctrl && e.shiftKey && ["I", "J", "C"].includes(key.toUpperCase())) || key === "F12";
      if (devShortcut) {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("devtools");
        return;
      }
      if (ctrl && key.toLowerCase() === "u") {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("viewsource");
        return;
      }
      if (key === "PrintScreen" || code === "PrintScreen") {
        e.preventDefault();
        blockResultsView("screenshot");
        return;
      }
      const winShiftS = !isMac && (e.metaKey || e.key === "Meta") && e.shiftKey && code === "KeyS";
      const macCapture = isMac && e.metaKey && e.shiftKey && ["Digit3", "Digit4", "Digit5"].includes(code);
      if (winShiftS || macCapture) {
        e.preventDefault();
        e.stopImmediatePropagation();
        blockResultsView("screenshot");
        return;
      }
    }

    document.addEventListener("copy", onProtectedCopyCut, true);
    document.addEventListener("cut", onProtectedCopyCut, true);
    document.addEventListener("paste", onProtectedPaste, true);
    document.addEventListener("contextmenu", onProtectedContextMenu, true);
    document.addEventListener("selectstart", onProtectedSelectStart, true);
    document.addEventListener("dragstart", onProtectedDragStart, true);
    window.addEventListener("beforeprint", onProtectedBeforePrint, true);
    document.addEventListener("keydown", onProtectedKeyDown, true);

    return () => {
      if (resultsReviewListenersRef.current.cleaned) return;
      resultsReviewListenersRef.current.cleaned = true;
      document.removeEventListener("copy", onProtectedCopyCut, true);
      document.removeEventListener("cut", onProtectedCopyCut, true);
      document.removeEventListener("paste", onProtectedPaste, true);
      document.removeEventListener("contextmenu", onProtectedContextMenu, true);
      document.removeEventListener("selectstart", onProtectedSelectStart, true);
      document.removeEventListener("dragstart", onProtectedDragStart, true);
      window.removeEventListener("beforeprint", onProtectedBeforePrint, true);
      document.removeEventListener("keydown", onProtectedKeyDown, true);
    };
  }, [active, resultsReviewBlocked]);

  return {
    resultsReviewRemainingMs,
    resultsReviewBlocked,
    resultsReviewBlockReason,
    RESULTS_REVIEW_TOTAL_MS,
    formatReviewClock,
    blockResultsView,
  };
}
