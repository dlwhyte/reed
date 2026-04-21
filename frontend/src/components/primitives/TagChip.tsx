import { clsx } from "clsx";

type Props = {
  tag: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  /** muted = list rails; butter = tagged on cards; solid = active cleared */
  variant?: "muted" | "butter" | "solid";
};

export function TagChip({ tag, count, active, onClick, variant = "muted" }: Props) {
  const styles =
    variant === "solid" || active
      ? "bg-ink text-paper border-transparent"
      : variant === "butter"
      ? "bg-butter text-ink border-transparent"
      : "border border-rule text-ink-muted hover:text-ink";

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-pill font-mono text-[11px] tracking-[0.02em] leading-none px-2.5 py-[5px] transition-colors duration-150 ease-out",
        styles,
      )}
    >
      {active || variant === "solid" ? "× " : "#"}
      {tag}
      {count !== undefined && !active && variant !== "solid" && (
        <span className="opacity-50"> · {count}</span>
      )}
    </button>
  );
}
