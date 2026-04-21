import { useEffect, useRef, useState } from "react";

type Options = {
  /** If provided, scroll is persisted to this key in localStorage too. */
  storageKey?: string;
  /** Called with 0..1 progress after the user pauses scrolling (500 ms). */
  onCommit?: (progress: number) => void;
  /** Initial progress 0..1 to restore to on mount. */
  initial?: number;
};

/**
 * Tracks page scroll progress (0..1) against document height. Calls
 * `onCommit` after the user stops scrolling so we can persist infrequently
 * rather than on every scroll tick. Restores `initial` once the document
 * has enough height to honour it.
 */
export function useReadingProgress({ storageKey, onCommit, initial }: Options): number {
  const [progress, setProgress] = useState(0);
  const commitTimer = useRef<number | null>(null);
  const restored = useRef(false);
  const lastCommitted = useRef<number>(initial ?? 0);

  useEffect(() => {
    function compute() {
      const h = document.documentElement;
      const max = Math.max(1, h.scrollHeight - h.clientHeight);
      const p = Math.max(0, Math.min(1, window.scrollY / max));
      setProgress(p);
      return p;
    }

    function schedule(p: number) {
      if (commitTimer.current) window.clearTimeout(commitTimer.current);
      commitTimer.current = window.setTimeout(() => {
        if (Math.abs(p - lastCommitted.current) < 0.01) return;
        lastCommitted.current = p;
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, String(p));
          } catch {
            /* noop */
          }
        }
        onCommit?.(p);
      }, 500);
    }

    function onScroll() {
      const p = compute();
      schedule(p);
    }

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (commitTimer.current) window.clearTimeout(commitTimer.current);
    };
  }, [onCommit, storageKey]);

  // Restore once: wait until layout settles (images, fonts) then jump.
  useEffect(() => {
    if (restored.current) return;
    const target = initial ?? tryReadStorage(storageKey);
    if (target == null || target <= 0.01) {
      restored.current = true;
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      const h = document.documentElement;
      const max = Math.max(1, h.scrollHeight - h.clientHeight);
      window.scrollTo({ top: max * target, behavior: "auto" });
      restored.current = true;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [initial, storageKey]);

  return progress;
}

function tryReadStorage(key?: string): number | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
