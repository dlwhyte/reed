/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "var(--bf-paper)",
          deep: "var(--bf-paper-deep)",
          raised: "var(--bf-paper-raised)",
        },
        ink: {
          DEFAULT: "var(--bf-ink)",
          muted: "var(--bf-ink-muted)",
          faint: "var(--bf-ink-faint)",
        },
        rule: "var(--bf-rule)",
        butter: "var(--bf-butter)",
        terracotta: {
          DEFAULT: "var(--bf-terracotta)",
          soft: "var(--bf-terracotta-soft)",
        },
        olive: {
          DEFAULT: "var(--bf-olive)",
          soft: "var(--bf-olive-soft)",
        },
        plum: {
          DEFAULT: "var(--bf-plum)",
          soft: "var(--bf-plum-soft)",
        },
      },
      fontFamily: {
        display: [
          "Source Serif 4",
          "Source Serif Pro",
          "Georgia",
          "serif",
        ],
        serif: [
          "Source Serif 4",
          "Source Serif Pro",
          "Georgia",
          "serif",
        ],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(43,35,32,0.02), 0 30px 60px -40px rgba(43,35,32,0.3)",
        pill: "0 1px 0 rgba(43,35,32,0.02), 0 8px 20px -12px rgba(43,35,32,0.1)",
        modal: "0 10px 40px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.06)",
      },
      transitionTimingFunction: {
        panel: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};
