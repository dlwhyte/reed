import { clsx } from "clsx";

type Props = {
  size?: "sm" | "md" | "lg";
  short?: boolean;
  className?: string;
};

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-[18px]",
  md: "text-[22px]",
  lg: "text-[28px]",
};

export function Wordmark({ size = "md", short = false, className }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-baseline gap-[2px] font-display font-semibold text-ink leading-none",
        SIZES[size],
        className,
      )}
      style={{ letterSpacing: "-0.03em" }}
    >
      <span>{short ? "BF" : "BrowseFellow"}</span>
      <span
        aria-hidden
        className="self-center rounded-full bg-terracotta"
        style={{ width: 6, height: 6, marginLeft: 2, marginBottom: 2 }}
      />
    </span>
  );
}
