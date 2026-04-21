// BrowseFellow design tokens.
// Mirrors the CSS custom properties in index.css; use these when a value is
// needed in TS/JS (e.g., reader theme palettes, inline SVG fills).

export const tokens = {
  paper: "#F8F1E4",
  paperDeep: "#F2E8D3",
  paperRaised: "#FDF8EC",
  ink: "#2B2320",
  inkMuted: "#7A6B5F",
  inkFaint: "#B3A594",
  rule: "#E3D6BE",
  butter: "#F2D5B8",

  terracotta: "oklch(0.65 0.12 40)",
  terracottaSoft: "oklch(0.9 0.05 40)",
  olive: "oklch(0.55 0.08 130)",
  oliveSoft: "oklch(0.92 0.04 130)",
  plum: "oklch(0.52 0.08 340)",
  plumSoft: "oklch(0.93 0.04 340)",

  serif: '"Source Serif 4", "Source Serif Pro", Georgia, serif',
  sans: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',

  radius: { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 },
} as const;

export const readerPalettes = {
  light: {
    paper: "#F8F1E4",
    paperDeep: "#F2E8D3",
    paperRaised: "#FDF8EC",
    ink: "#2B2320",
    inkMuted: "#7A6B5F",
    inkFaint: "#B3A594",
    rule: "#E3D6BE",
  },
  sepia: {
    paper: "#EFE3CA",
    paperDeep: "#E7D7B4",
    paperRaised: "#F6EBD3",
    ink: "#3A2E22",
    inkMuted: "#7A6347",
    inkFaint: "#A89069",
    rule: "#D4C09A",
  },
  dark: {
    paper: "#171310",
    paperDeep: "#201A16",
    paperRaised: "#2A221C",
    ink: "#F0E6D5",
    inkMuted: "#A89989",
    inkFaint: "#6E6256",
    rule: "#3A2F26",
  },
} as const;

export type ReaderTheme = keyof typeof readerPalettes;

export const PAPER_NOISE_DATA_URI =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.65  0 0 0 0 0.56  0 0 0 0 0.42  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
