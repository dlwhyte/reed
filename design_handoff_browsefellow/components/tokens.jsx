// Design tokens for reed redesign — warm / playful direction
// Keep all aesthetic decisions here so they're tweakable later.

const REED = {
  // Paper + ink
  paper: '#F8F1E4',        // cream
  paperDeep: '#F2E8D3',    // a step warmer for cards on paper
  paperRaised: '#FDF8EC',  // lifted surface
  ink: '#2B2320',
  inkMuted: '#7A6B5F',
  inkFaint: '#B3A594',
  rule: '#E3D6BE',         // hairlines

  // Accents
  terracotta: 'oklch(0.65 0.12 40)',
  terracottaSoft: 'oklch(0.9 0.05 40)',
  olive: 'oklch(0.55 0.08 130)',      // agent / research
  oliveSoft: 'oklch(0.92 0.04 130)',
  plum: 'oklch(0.52 0.08 340)',       // chat accent
  plumSoft: 'oklch(0.93 0.04 340)',
  butter: '#F2D5B8',                   // highlight bg

  // Dark + sepia variants (reader themes)
  dark: {
    paper: '#171310',
    paperDeep: '#201A16',
    paperRaised: '#2A221C',
    ink: '#F0E6D5',
    inkMuted: '#A89989',
    inkFaint: '#6E6256',
    rule: '#3A2F26',
  },
  sepia: {
    paper: '#EFE3CA',
    paperDeep: '#E7D7B4',
    paperRaised: '#F6EBD3',
    ink: '#3A2E22',
    inkMuted: '#7A6347',
    inkFaint: '#A89069',
    rule: '#D4C09A',
  },

  // Type
  serif: '"Source Serif 4", "Source Serif Pro", Georgia, serif',
  sans: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  display: '"Source Serif 4", Georgia, serif', // for title wordmark

  // Radii
  r: { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 },
};

// Named paper backgrounds (subtle fiber texture via SVG)
const PAPER_NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.65  0 0 0 0 0.56  0 0 0 0 0.42  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

// Tiny "stamp" look for citation chips
function inkStamp(color, text) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px', fontFamily: REED.mono,
      fontSize: 10, fontWeight: 600, color,
      border: `1px solid ${color}`, borderRadius: 4,
      letterSpacing: 0.3,
    }}>{text}</span>
  );
}

Object.assign(window, { REED, PAPER_NOISE, inkStamp });
