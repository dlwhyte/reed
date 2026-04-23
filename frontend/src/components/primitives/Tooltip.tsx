import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

type Side = "top" | "bottom";

type Props = {
  label: string;
  children: React.ReactNode;
  side?: Side;
  delay?: number;
};

/**
 * Small custom tooltip — appears after a short hover, matched to
 * BrowseFellow's mono/ink/paper voice. Replaces the slow + ugly native
 * `title` attribute tooltip on icon buttons.
 *
 * Pure CSS positioning relative to the wrapper, so no portal / popper
 * dep. Trigger via mouseenter (and focusin for keyboard nav).
 */
export function Tooltip({ label, children, side = "bottom", delay = 350 }: Props) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  function show() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(true), delay);
  }
  function hide() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setVisible(false);
  }
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={clsx(
            "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-paper shadow-md",
            side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
