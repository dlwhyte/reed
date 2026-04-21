// Shared UI primitives for reed redesign.

// ───────────────────────────────────────────────────────────
// Cover — procedural "magazine cover" stripes/dots/wave/grid
// using the article's seed color. No external assets.
// ───────────────────────────────────────────────────────────
function Cover({ article, w = '100%', h = 140, rounded = 12 }) {
  const { color, pattern, title } = article;
  const patterns = {
    stripes: (
      <g>
        <rect width="200" height="140" fill={color}/>
        {[...Array(8)].map((_,i) => (
          <rect key={i} x={i*26-10} y="-20" width="8" height="200"
            fill="rgba(255,255,255,0.18)" transform="rotate(-18 100 70)" />
        ))}
      </g>
    ),
    dots: (
      <g>
        <rect width="200" height="140" fill={color}/>
        {[...Array(7)].map((_,r) => [...Array(10)].map((_,c) => (
          <circle key={r+'-'+c} cx={c*22+8} cy={r*22+12} r={2.5}
            fill="rgba(255,255,255,0.35)"/>
        )))}
      </g>
    ),
    wave: (
      <g>
        <rect width="200" height="140" fill={color}/>
        <path d="M-10,60 Q30,40 70,60 T150,60 T230,60 V160 H-10Z"
          fill="rgba(255,255,255,0.16)"/>
        <path d="M-10,90 Q30,70 70,90 T150,90 T230,90 V160 H-10Z"
          fill="rgba(0,0,0,0.08)"/>
      </g>
    ),
    grid: (
      <g>
        <rect width="200" height="140" fill={color}/>
        {[...Array(12)].map((_,i) => (
          <line key={'h'+i} x1="0" x2="200" y1={i*12} y2={i*12}
            stroke="rgba(255,255,255,0.14)" strokeWidth="0.5"/>
        ))}
        {[...Array(18)].map((_,i) => (
          <line key={'v'+i} x1={i*12} x2={i*12} y1="0" y2="140"
            stroke="rgba(255,255,255,0.14)" strokeWidth="0.5"/>
        ))}
      </g>
    ),
  };
  const initial = (title || '?').trim()[0];
  return (
    <div style={{
      width: w, height: h, borderRadius: rounded, overflow: 'hidden',
      position: 'relative', background: color, flexShrink: 0,
    }}>
      <svg width="100%" height="100%" viewBox="0 0 200 140"
        preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
        {patterns[pattern] || patterns.stripes}
      </svg>
      <div style={{
        position: 'absolute', bottom: 8, right: 10,
        fontFamily: REED.display, fontWeight: 600,
        fontSize: 28, color: 'rgba(255,255,255,0.85)',
        letterSpacing: -1, lineHeight: 1,
        textShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }}>{initial}</div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Icon — minimal stroke set. No lucide; keeps scope consistent.
// ───────────────────────────────────────────────────────────
function Icon({ name, size = 16, color = 'currentColor', fill = 'none', stroke = 1.6 }) {
  const paths = {
    back: "M15 4 7 12l8 8",
    ext: "M10 4H4v14h14v-6 M14 4h6v6 M11 13l9-9",
    star: "M12 3l2.6 5.6 6.2.6-4.7 4.2 1.4 6.1L12 16.4 6.5 19.5l1.4-6.1-4.7-4.2 6.2-.6Z",
    archive: "M3 5h18v4H3z M5 9v11h14V9 M9 13h6",
    chat: "M4 5h16v12H9l-5 4Z",
    flask: "M9 3h6 M10 3v5l-5 10c-1 2 0 3 2 3h10c2 0 3-1 2-3l-5-10V3",
    type: "M5 6h14 M5 6v13 M19 6v13 M9 19h6",
    minus: "M5 12h14",
    plus: "M12 5v14 M5 12h14",
    sun: "M12 4v2 M12 18v2 M4 12h2 M18 12h2 M6 6l1.4 1.4 M16.6 16.6L18 18 M6 18l1.4-1.4 M16.6 7.4L18 6 M12 8a4 4 0 100 8 4 4 0 000-8Z",
    moon: "M20 14a8 8 0 01-9.5-9.5 8 8 0 109.5 9.5Z",
    coffee: "M5 10h11v6a4 4 0 01-4 4H9a4 4 0 01-4-4v-6Z M16 11h2a2 2 0 010 4h-2 M8 4v2 M11 4v2",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14Z M21 21l-5-5",
    x: "M6 6l12 12 M18 6L6 18",
    send: "M4 12l16-8-5 17-3-7-8-2Z",
    sparkle: "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8Z",
    lib: "M4 4h4v16H4Z M10 4h4v16h-4Z M16 8l4 1-3 13-4-1Z",
    book: "M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3Z M5 4v13a3 3 0 003 3",
    globe: "M12 3a9 9 0 100 18 9 9 0 000-18 M3 12h18 M12 3a13 13 0 010 18 M12 3a13 13 0 000 18",
    plus2: "M12 4v16 M4 12h16",
    grid: "M4 4h7v7H4Z M13 4h7v7h-7Z M4 13h7v7H4Z M13 13h7v7h-7Z",
    list: "M4 6h16 M4 12h16 M4 18h16",
    settings: "M12 8a4 4 0 100 8 4 4 0 000-8Z M20 12c0-.6-.1-1.2-.2-1.7l2-1.6-2-3.4-2.4.9a8 8 0 00-2.8-1.6L14 2h-4l-.6 2.6a8 8 0 00-2.8 1.6l-2.4-.9-2 3.4 2 1.6c-.1.5-.2 1.1-.2 1.7s.1 1.2.2 1.7l-2 1.6 2 3.4 2.4-.9a8 8 0 002.8 1.6L10 22h4l.6-2.6a8 8 0 002.8-1.6l2.4.9 2-3.4-2-1.6c.1-.5.2-1.1.2-1.7Z",
    more: "M7 12h.01 M12 12h.01 M17 12h.01",
    check: "M5 12l5 5 9-10",
    chevL: "M14 6l-6 6 6 6",
    chevR: "M10 6l6 6-6 6",
    chevD: "M6 9l6 6 6-6",
    chevRs: "M8 5l7 7-7 7",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M12 15a3 3 0 100-6 3 3 0 000 6Z",
    clock: "M12 3a9 9 0 100 18 9 9 0 000-18 M12 7v5l3 2",
    tag: "M4 4h8l8 8-8 8-8-8V4Z M8 8h.01",
    filter: "M4 5h16 M7 12h10 M10 19h4",
    bookmark: "M6 4h12v17l-6-4-6 4Z",
    pen: "M4 20h4L20 8l-4-4L4 16Z",
    sliders: "M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 5v4 M9 15v4",
    url: "M9 15l6-6 M8 13l-2 2a3 3 0 104 4l2-2 M16 11l2-2a3 3 0 10-4-4l-2 2",
    trash: "M5 7h14 M9 7V5h6v2 M7 7l1 13h8l1-13",
    warn: "M12 3l10 18H2Z M12 10v5 M12 18v.01",
    info: "M12 3a9 9 0 100 18 9 9 0 000-18Z M12 11v6 M12 8v.01",
    wifi: "M2 8.5C5 6 8 5 12 5s7 1 10 3.5 M5 12c2-1.6 4-2.5 7-2.5S17 10.4 19 12 M8 15.3c1.2-.9 2.5-1.3 4-1.3s2.8.4 4 1.3 M12 19v.01",
    wifiOff: "M2 8.5C3 7.6 4.3 7 5.6 6.5 M18.4 6.5C20 7.3 21.4 8.3 22 8.5 M5 12c.8-.6 1.7-1.2 2.6-1.6 M16.4 10.4c1 .4 1.9 1 2.6 1.6 M8 15.3c1.2-.9 2.5-1.3 4-1.3 M12 19v.01 M3 3l18 18",
    key: "M14 10a4 4 0 11-4-4 M14 10l7 7-2 2-2-2-2 2-2-2",
    folder: "M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2Z",
    download: "M12 4v11 M7 10l5 5 5-5 M4 19h16",
    refresh: "M20 8a8 8 0 10-2.4 10M20 3v5h-5",
    brain: "M9 5a3 3 0 015.8-1 3 3 0 013 4.2 3 3 0 010 4.6 3 3 0 01-3 4.2A3 3 0 019 19a3 3 0 01-5.8-1 3 3 0 01-1-4.2 3 3 0 010-4.6 3 3 0 013-4.2 3 3 0 012.8-1Z M9 9v6 M15 9v6",
    power: "M12 3v9 M6 7a8 8 0 1012 0",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}>
      <path d={paths[name] || ""} />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────
// Citation chip — the inline [1] style we'll reuse
// ───────────────────────────────────────────────────────────
function Cite({ n, color = REED.olive, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, margin: '0 2px', padding: 0,
      fontFamily: REED.mono, fontSize: 10, fontWeight: 600,
      color, background: 'transparent',
      border: `1.2px solid ${color}`, borderRadius: 4,
      cursor: 'pointer', verticalAlign: 2,
    }}>{n}</button>
  );
}

// ───────────────────────────────────────────────────────────
// Pill tab
// ───────────────────────────────────────────────────────────
function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: REED.r.pill,
      fontFamily: REED.sans, fontSize: 13, fontWeight: 500,
      border: '1px solid ' + (active ? REED.ink : 'transparent'),
      background: active ? REED.ink : 'transparent',
      color: active ? REED.paper : REED.inkMuted,
      cursor: 'pointer', letterSpacing: 0.1,
      textTransform: 'lowercase',
    }}>{children}</button>
  );
}

// ───────────────────────────────────────────────────────────
// Top wordmark
// ───────────────────────────────────────────────────────────
function Wordmark({ size = 22, color = REED.ink }) {
  return (
    <div style={{
      fontFamily: REED.display, fontSize: size, fontWeight: 600,
      color, letterSpacing: -0.8, lineHeight: 1,
      display: 'inline-flex', alignItems: 'baseline', gap: 2,
    }}>
      <span>BrowseFellow</span>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: REED.terracotta, alignSelf: 'center',
        marginLeft: 2, marginBottom: 2,
      }} />
    </div>
  );
}

Object.assign(window, { Cover, Icon, Cite, Tab, Wordmark });
