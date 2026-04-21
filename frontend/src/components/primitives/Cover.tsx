import { useMemo } from "react";

type Pattern = "stripes" | "dots" | "wave" | "grid";

type Props = {
  title: string;
  /** optional real cover image — if provided, rendered instead of the procedural pattern */
  imageUrl?: string | null;
  /** procedural seed; if omitted, derived from title */
  seed?: string;
  height?: number;
  rounded?: number;
  className?: string;
};

/** Warm, magazine-ish procedural cover. Feels hand-drawn, no external assets. */
export function Cover({ title, imageUrl, seed, height = 140, rounded = 12, className }: Props) {
  const { color, pattern, initial } = useMemo(() => {
    const key = seed ?? title ?? "?";
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    const patterns: Pattern[] = ["stripes", "dots", "wave", "grid"];
    const palette = [
      "oklch(0.65 0.12 40)",   // terracotta
      "oklch(0.55 0.08 130)",  // olive
      "oklch(0.52 0.08 340)",  // plum
      "oklch(0.62 0.1 70)",    // amber
      "oklch(0.58 0.09 240)",  // dusk
      "oklch(0.45 0.06 20)",   // rust
    ];
    return {
      color: palette[hash % palette.length],
      pattern: patterns[(hash >>> 3) % patterns.length],
      initial: (title || "?").trim().charAt(0).toUpperCase(),
    };
  }, [seed, title]);

  if (imageUrl) {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          height,
          borderRadius: rounded,
          overflow: "hidden",
          flexShrink: 0,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height,
        borderRadius: rounded,
        overflow: "hidden",
        position: "relative",
        background: color,
        flexShrink: 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 140"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block" }}
      >
        {pattern === "stripes" && (
          <g>
            <rect width="200" height="140" fill={color} />
            {Array.from({ length: 8 }).map((_, i) => (
              <rect
                key={i}
                x={i * 26 - 10}
                y={-20}
                width={8}
                height={200}
                fill="rgba(255,255,255,0.18)"
                transform="rotate(-18 100 70)"
              />
            ))}
          </g>
        )}
        {pattern === "dots" && (
          <g>
            <rect width="200" height="140" fill={color} />
            {Array.from({ length: 7 }).flatMap((_, r) =>
              Array.from({ length: 10 }).map((_, c) => (
                <circle
                  key={`${r}-${c}`}
                  cx={c * 22 + 8}
                  cy={r * 22 + 12}
                  r={2.5}
                  fill="rgba(255,255,255,0.35)"
                />
              )),
            )}
          </g>
        )}
        {pattern === "wave" && (
          <g>
            <rect width="200" height="140" fill={color} />
            <path
              d="M-10,60 Q30,40 70,60 T150,60 T230,60 V160 H-10Z"
              fill="rgba(255,255,255,0.16)"
            />
            <path
              d="M-10,90 Q30,70 70,90 T150,90 T230,90 V160 H-10Z"
              fill="rgba(0,0,0,0.08)"
            />
          </g>
        )}
        {pattern === "grid" && (
          <g>
            <rect width="200" height="140" fill={color} />
            {Array.from({ length: 12 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1={0}
                x2={200}
                y1={i * 12}
                y2={i * 12}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={0.5}
              />
            ))}
            {Array.from({ length: 18 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={i * 12}
                x2={i * 12}
                y1={0}
                y2={140}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={0.5}
              />
            ))}
          </g>
        )}
      </svg>
      <div
        aria-hidden
        className="font-display font-semibold"
        style={{
          position: "absolute",
          bottom: 8,
          right: 12,
          fontSize: Math.min(34, height * 0.22),
          color: "rgba(255,255,255,0.9)",
          letterSpacing: -1,
          lineHeight: 1,
          textShadow: "0 1px 2px rgba(0,0,0,0.18)",
        }}
      >
        {initial}
      </div>
    </div>
  );
}
