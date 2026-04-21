import { clsx } from "clsx";
import type { ReactNode } from "react";

type Props = {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

export function TabPill({ active, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-pill border px-3.5 py-1.5 text-[13px] font-medium lowercase transition-colors duration-150 ease-out",
        active
          ? "border-ink bg-ink text-paper"
          : "border-transparent text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
