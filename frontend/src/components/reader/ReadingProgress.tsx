type Props = {
  /** 0..1 */
  value: number;
};

/**
 * Thin terracotta rule anchored at the very top of the reader, expressing
 * how far through the article the user has scrolled. Sits above the sticky
 * toolbar so the reveal feels like the page itself is marking itself off.
 */
export function ReadingProgress({ value }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-30 h-0.5 origin-left"
      style={{
        background: "var(--bf-rule)",
      }}
    >
      <div
        className="h-full bg-terracotta transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
