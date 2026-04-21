// Phase 2 — Tags & Collections, Search, Highlights, Real agent loop visualization.

// ─────────────────────────────────────────────────────────────
// TAGS & COLLECTIONS
// ─────────────────────────────────────────────────────────────
function TagsView() {
  const tags = [
    ['longform',       42, REED.terracotta],
    ['productivity',   31, REED.plum],
    ['books',          24, REED.olive],
    ['ecology',        19, 'oklch(0.55 0.08 180)'],
    ['ai',             17, REED.terracotta],
    ['cities',         15, REED.plum],
    ['software',       13, REED.olive],
    ['food',           11, 'oklch(0.6 0.1 60)'],
    ['local-first',    9,  REED.terracotta],
    ['history',        8,  REED.plum],
    ['design',         7,  REED.olive],
    ['economics',      6,  'oklch(0.55 0.08 180)'],
  ];
  const collections = [
    ['🧠 For the deep hours', 14, "pieces longer than 20 min"],
    ['✎ To revisit', 7, "things i've starred twice"],
    ['◷ Read this weekend', 9, 'unread, 10–25 min'],
    ['◍ AI & agents', 22, 'auto-tagged'],
  ];

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto',
      background: REED.paper, color: REED.ink, fontFamily: REED.sans,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
      padding: '40px 48px 80px',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
          textTransform: 'uppercase', color: REED.terracotta, marginBottom: 6,
        }}>— tags & collections —</div>
        <h1 style={{
          fontFamily: REED.display, fontSize: 44, fontWeight: 600,
          letterSpacing: -1.2, lineHeight: 1.05, margin: '0 0 10px',
          textWrap: 'balance',
        }}>The shape of your reading.</h1>
        <div style={{
          fontFamily: REED.display, fontSize: 17, fontStyle: 'italic',
          color: REED.inkMuted, maxWidth: 540, lineHeight: 1.5,
          textWrap: 'pretty', marginBottom: 36,
        }}>Tags are suggested by the agent. Collections are saved filters. You can edit either, and neither are required.</div>

        {/* Tag cloud */}
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.6,
          textTransform: 'uppercase', color: REED.inkFaint, marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>all tags</span>
          <span style={{ color: REED.inkFaint }}>·</span>
          <span style={{ color: REED.inkMuted }}>weighted by count</span>
        </div>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          padding: '20px', borderRadius: REED.r.lg,
          background: REED.paperRaised, border: `1px solid ${REED.rule}`,
          marginBottom: 40,
        }}>
          {tags.map(([name, n, color]) => {
            const scale = 0.82 + (Math.log(n) / Math.log(42)) * 0.7;
            return (
              <div key={name} style={{
                padding: `${8 * scale}px ${14 * scale}px`, borderRadius: 999,
                background: `${color}1a`, border: `1px solid ${color}55`,
                fontFamily: REED.sans, fontSize: 13 * scale, fontWeight: 500,
                color, display: 'inline-flex', alignItems: 'center', gap: 6,
                cursor: 'pointer',
              }}>
                <span style={{ opacity: 0.6 }}>#</span>{name}
                <span style={{
                  fontFamily: REED.mono, fontSize: 10 * scale,
                  color: REED.inkMuted, marginLeft: 2,
                }}>{n}</span>
              </div>
            );
          })}
        </div>

        {/* Collections */}
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.6,
          textTransform: 'uppercase', color: REED.inkFaint, marginBottom: 14,
        }}>collections · saved filters</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {collections.map(([title, count, sub]) => (
            <div key={title} style={{
              padding: '18px 20px', borderRadius: REED.r.lg,
              background: REED.paperRaised, border: `1px solid ${REED.rule}`,
              cursor: 'pointer',
            }}>
              <div style={{
                fontFamily: REED.display, fontSize: 18, fontWeight: 500,
                letterSpacing: -0.2, marginBottom: 4,
              }}>{title}</div>
              <div style={{
                fontFamily: REED.sans, fontSize: 12, color: REED.inkMuted,
              }}>{count} pieces · {sub}</div>
            </div>
          ))}
          <div style={{
            padding: '18px 20px', borderRadius: REED.r.lg,
            background: 'transparent', border: `1px dashed ${REED.rule}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: REED.inkMuted, cursor: 'pointer',
            fontFamily: REED.sans, fontSize: 13,
          }}>
            <Icon name="plus2" size={14}/> New collection
          </div>
        </div>
      </div>
    </div>
  );
}

// Auto-tag review (the moment after save)
function AutoTagReview() {
  const [accepted, setAccepted] = React.useState(['ecology', 'longform', 'walking']);
  const [rejected, setRejected] = React.useState([]);
  const [custom, setCustom] = React.useState('');
  const suggestions = ['ecology', 'longform', 'walking', 'scottish-borders', 'essay'];

  function toggle(tag) {
    if (accepted.includes(tag)) {
      setAccepted(accepted.filter(t => t !== tag));
      setRejected([...rejected, tag]);
    } else {
      setRejected(rejected.filter(t => t !== tag));
      setAccepted([...accepted, tag]);
    }
  }

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto',
      background: REED.paperDeep, padding: 40, fontFamily: REED.sans,
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
          textTransform: 'uppercase', color: REED.terracotta, marginBottom: 6,
        }}>— just saved —</div>
        <h2 style={{
          fontFamily: REED.display, fontSize: 28, fontWeight: 600,
          letterSpacing: -0.5, lineHeight: 1.15, margin: '0 0 8px',
          textWrap: 'balance',
        }}>Does this look right?</h2>
        <div style={{
          fontFamily: REED.display, fontSize: 15, fontStyle: 'italic',
          color: REED.inkMuted, marginBottom: 24, lineHeight: 1.5, textWrap: 'pretty',
        }}>The agent read the piece and proposed these tags. Tap to toggle. I'll remember your corrections for next time.</div>

        <div style={{
          padding: 16, borderRadius: REED.r.lg,
          background: REED.paper, border: `1px solid ${REED.rule}`,
          marginBottom: 20,
        }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14,
          }}>
            <div style={{
              width: 56, height: 72, borderRadius: 6, flexShrink: 0,
              background: `linear-gradient(135deg, ${REED.olive}, oklch(0.45 0.08 130))`,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', bottom: 4, right: 6,
                fontFamily: REED.display, fontSize: 22, fontWeight: 600,
                color: 'rgba(255,255,255,0.85)', letterSpacing: -0.5, lineHeight: 1,
              }}>S</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: REED.display, fontSize: 16, fontWeight: 600,
                letterSpacing: -0.2, lineHeight: 1.2,
              }}>Soil, silence, and the long half-life of a good fence</div>
              <div style={{
                fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint, marginTop: 3,
                letterSpacing: 0.3,
              }}>emergencemagazine.org · 22 min</div>
            </div>
          </div>

          <div style={{
            fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.5,
            textTransform: 'uppercase', color: REED.inkFaint,
            marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="sparkle" size={11} color={REED.terracotta}/>
            <span>suggested tags</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map(tag => {
              const on = accepted.includes(tag);
              return (
                <button key={tag} onClick={() => toggle(tag)} style={{
                  padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${on ? REED.terracotta : REED.rule}`,
                  background: on ? 'oklch(0.95 0.04 40)' : 'transparent',
                  color: on ? REED.terracotta : REED.inkMuted,
                  fontFamily: REED.sans, fontSize: 12, fontWeight: 500,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  {on ? <Icon name="check" size={11}/> : <Icon name="plus2" size={11}/>}
                  {tag}
                </button>
              );
            })}
          </div>

          <div style={{
            marginTop: 14, padding: 8, borderRadius: 8,
            background: REED.paperDeep, border: `1px solid ${REED.rule}`,
            display: 'flex', gap: 6,
          }}>
            <input value={custom} onChange={e => setCustom(e.target.value)}
              placeholder="add your own…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: REED.sans, fontSize: 12, color: REED.ink, padding: '4px 6px',
              }}/>
            <button style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              background: REED.ink, color: '#fff',
              fontFamily: REED.sans, fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}>Add</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: REED.terracotta, color: '#fff',
            fontFamily: REED.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Save tags</button>
          <button style={{
            padding: '10px 16px', borderRadius: 8,
            background: 'transparent', border: `1px solid ${REED.rule}`,
            color: REED.inkMuted, cursor: 'pointer',
            fontFamily: REED.sans, fontSize: 13,
          }}>Skip</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEARCH — expanded bar + results + ask-your-library
// ─────────────────────────────────────────────────────────────
function SearchView() {
  const [q, setQ] = React.useState('what makes something worth re-reading');
  const [mode, setMode] = React.useState('semantic');
  const [asking, setAsking] = React.useState(false);

  const keywordHits = [
    { id: 1, title: 'The quiet collapse of the local bookstore, and what came after',
      match: 'the author returns to a single shelf twice in a week, which she calls <em>re-reading</em> in the old sense',
      score: 0.91, site: 'Longreads', tags: ['books', 'longform'] },
    { id: 4, title: 'Notes on the half-second that matters',
      match: 'some pieces demand a second pass — the ones you put down and pick up <em>again</em> the next day',
      score: 0.78, site: 'Personal blog', tags: ['productivity'] },
  ];
  const semanticHits = [
    { id: 3, title: 'Soil, silence, and the long half-life of a good fence',
      match: 'a slow argument about durability — things built to outlast their builders',
      score: 0.87, site: 'Emergence Magazine', tags: ['ecology'] },
    { id: 8, title: 'On the paragraph that I keep returning to',
      match: 'the idea of a "home sentence" — the one line you find yourself circling back to',
      score: 0.84, site: 'Paris Review', tags: ['books', 'essay'] },
    { id: 2, title: 'Why your calendar feels broken (and a small fix)',
      match: 'the calendar treats every half-hour alike; memory does not',
      score: 0.72, site: 'Cluttered Desk', tags: ['productivity'] },
  ];
  const hits = mode === 'semantic' ? semanticHits : keywordHits;

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto',
      background: REED.paper, color: REED.ink, fontFamily: REED.sans,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
    }}>
      {/* Search header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: `${REED.paper}ee`, backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${REED.rule}`,
      }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '18px 40px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: REED.r.lg,
            background: REED.paperRaised, border: `2px solid ${REED.terracotta}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 4px oklch(0.95 0.04 40)',
          }}>
            <Icon name="search" size={18} color={REED.terracotta}/>
            <input value={q} onChange={e => setQ(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: REED.display, fontSize: 17, color: REED.ink,
                fontStyle: q ? 'normal' : 'italic',
              }}/>
            <button onClick={() => setQ('')} style={{
              width: 26, height: 26, borderRadius: 6, border: 'none',
              background: 'transparent', color: REED.inkFaint, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="x" size={14}/></button>
            <div style={{ width: 1, height: 20, background: REED.rule }}/>
            <div style={{ display: 'flex', gap: 2,
              padding: 2, borderRadius: 6, background: REED.paperDeep }}>
              {[['keyword', 'Keyword'], ['semantic', 'Semantic']].map(([k, label]) => (
                <button key={k} onClick={() => setMode(k)} style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: mode === k ? REED.paperRaised : 'transparent',
                  color: mode === k ? REED.ink : REED.inkMuted,
                  fontFamily: REED.sans, fontSize: 11, fontWeight: 500,
                }}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{
            display: 'flex', gap: 10, marginTop: 10, alignItems: 'center',
          }}>
            <div style={{
              fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
              letterSpacing: 0.4,
            }}>
              {hits.length} results · {mode === 'semantic' ? 'local embeddings · nomic-embed-v2' : 'SQLite FTS5'}
            </div>
            <div style={{ flex: 1 }}/>
            <button onClick={() => setAsking(true)} style={{
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
              background: asking ? REED.olive : REED.oliveSoft,
              color: asking ? '#fff' : REED.olive,
              border: `1px solid ${REED.olive}`,
              fontFamily: REED.sans, fontSize: 12, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="flask" size={12} color={asking ? '#fff' : REED.olive}/>
              Ask your library
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 40px 60px' }}>
        {asking && <AskLibraryAnswer q={q} onClose={() => setAsking(false)} hits={hits}/>}

        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.6,
          textTransform: 'uppercase', color: REED.inkFaint,
          marginBottom: 14, marginTop: asking ? 24 : 0,
        }}>matches</div>

        {hits.map(h => <SearchHit key={h.id} h={h} mode={mode}/>)}
      </div>
    </div>
  );
}

function SearchHit({ h, mode }) {
  return (
    <div style={{
      padding: '18px 0', borderTop: `1px solid ${REED.rule}`,
      display: 'flex', gap: 16, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 46, height: 60, borderRadius: 6, flexShrink: 0,
        background: `linear-gradient(135deg, ${REED.terracotta}, oklch(0.58 0.1 40))`,
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
          letterSpacing: 0.3, marginBottom: 3,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{h.site}</span>
          <span>·</span>
          <span style={{
            color: mode === 'semantic' ? REED.olive : REED.terracotta,
          }}>{mode === 'semantic' ? '≈' : '•'} {(h.score * 100).toFixed(0)}% match</span>
          <span>·</span>
          {h.tags.map(t => (
            <span key={t} style={{ color: REED.inkMuted }}>#{t}</span>
          ))}
        </div>
        <div style={{
          fontFamily: REED.display, fontSize: 17, fontWeight: 600,
          letterSpacing: -0.3, lineHeight: 1.25, marginBottom: 6,
          textWrap: 'balance',
        }}>{h.title}</div>
        <div style={{
          fontFamily: REED.serif, fontSize: 14, lineHeight: 1.55,
          color: REED.inkMuted, fontStyle: 'italic', textWrap: 'pretty',
        }} dangerouslySetInnerHTML={{ __html: `"…${h.match}…"` }}/>
      </div>
    </div>
  );
}

function AskLibraryAnswer({ q, onClose, hits }) {
  const [body, setBody] = React.useState('');
  const [streaming, setStreaming] = React.useState(true);

  React.useEffect(() => {
    const text = `Yes — and your library has two answers to this that disagree interestingly.

The first${'[1]'} treats re-readability as a property of the text: durable sentences, layers that only open up on the second pass. The second${'[2]'} locates it in the reader — a piece is re-readable when it meets a question you're carrying, and you carry different questions at different hours.

Your own pattern${'[3]'} suggests you lean toward the second view: the pieces you return to are short, and you return in different moods.`;
    const chunks = [];
    let i = 0;
    while (i < text.length) {
      const n = 2 + Math.floor(Math.random() * 3);
      chunks.push(text.slice(i, i + n));
      i += n;
    }
    let k = 0;
    const id = setInterval(() => {
      if (k >= chunks.length) { clearInterval(id); setStreaming(false); return; }
      setBody(b => b + chunks[k++]);
    }, 16);
    return () => clearInterval(id);
  }, []);

  // Render [n] with Cite
  const parts = [];
  let last = 0;
  const re = /\[(\d+)\]/g;
  let m, key = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{body.slice(last, m.index)}</span>);
    parts.push(<Cite key={key++} n={Number(m[1])} color={REED.olive}/>);
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(<span key={key++}>{body.slice(last)}</span>);

  return (
    <div style={{
      padding: 22, borderRadius: REED.r.lg,
      background: REED.oliveSoft, border: `1px solid ${REED.olive}`,
      marginBottom: 8, position: 'relative',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <Icon name="flask" size={14} color={REED.olive}/>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.6,
          textTransform: 'uppercase', color: REED.olive,
        }}>library says</div>
        <div style={{ flex: 1 }}/>
        <button onClick={onClose} style={{
          width: 22, height: 22, borderRadius: 5, border: 'none',
          background: 'transparent', color: REED.olive, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="x" size={12}/></button>
      </div>
      <div style={{
        fontFamily: REED.serif, fontSize: 15, lineHeight: 1.65,
        color: REED.ink, whiteSpace: 'pre-wrap', textWrap: 'pretty',
      }}>
        {parts}
        {streaming && <span style={{
          display: 'inline-block', width: 6, height: 14,
          background: REED.olive, marginLeft: 3, verticalAlign: -2,
          animation: 'reedBlink 1s infinite',
        }}/>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HIGHLIGHTS & ANNOTATIONS
// ─────────────────────────────────────────────────────────────
function HighlightReader() {
  const [selection, setSelection] = React.useState({ x: 0, y: 0, show: false });
  const [note, setNote] = React.useState('The hinge sentence — everything after rests on this.');
  const [editing, setEditing] = React.useState(true);

  const palette = { paper: REED.paper, paperDeep: REED.paperDeep, paperRaised: REED.paperRaised,
    ink: REED.ink, inkMuted: REED.inkMuted, inkFaint: REED.inkFaint, rule: REED.rule };

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto',
      background: palette.paper, fontFamily: REED.sans,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '52px 40px 120px', display: 'flex', gap: 32 }}>
        <article style={{
          flex: 1, fontFamily: REED.serif, fontSize: 18, lineHeight: 1.65, color: palette.ink,
        }}>
          <div style={{
            fontFamily: REED.mono, fontSize: 10, letterSpacing: 1.2,
            textTransform: 'uppercase', color: REED.terracotta, marginBottom: 14,
          }}>— longreads —</div>
          <h1 style={{
            fontFamily: REED.display, fontSize: 40, fontWeight: 600,
            lineHeight: 1.05, letterSpacing: -1.2, margin: '0 0 20px',
            textWrap: 'balance',
          }}>The quiet collapse of the local bookstore</h1>

          <p style={{ textWrap: 'pretty' }}>For decades, the bookstore sat at the quiet center of a block's economy — not because books were especially profitable, but because they gave people a reason to stop. <mark style={{
            background: `${REED.butter}cc`, padding: '2px 0',
            borderBottom: `2px solid ${REED.terracotta}`,
            color: palette.ink,
          }}>When that reason thinned, everything around it thinned too.</mark></p>

          <p style={{ textWrap: 'pretty' }}>This is a story about three stores in one neighborhood over five years. I've changed a few names, but nothing else. Two of them are gone now. <mark style={{
            background: 'oklch(0.92 0.08 130 / 0.55)', padding: '2px 0',
            color: palette.ink,
          }}>The third did something strange — it stopped selling books.</mark></p>

          <p style={{ textWrap: 'pretty' }}>The owner, Marisol, explained it plainly the last time we spoke. "People stopped coming here because they wanted a book," she said. "They came here because they wanted to stand somewhere for twenty minutes, alone but not lonely. The books were an excuse. <mark style={{
            background: 'oklch(0.94 0.06 340 / 0.5)', padding: '2px 0',
            color: palette.ink,
          }}>Once the excuse was gone, the standing-around is what I had to sell.</mark>"</p>

          <p style={{ textWrap: 'pretty' }}>What Marisol built in place of her bookstore is harder to name.
            There are still shelves, and some of them even have books, but they aren't the point. The point is a certain kind of afternoon.</p>

          {/* Highlight toolbar (floating) */}
          <div style={{
            position: 'absolute', top: 280, left: 360, zIndex: 10,
            padding: 4, borderRadius: 8,
            background: REED.ink, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 2,
            boxShadow: '0 8px 20px rgba(0,0,0,0.22)',
            animation: 'reedPopIn .18s ease-out',
          }}>
            <SwatchBtn color={REED.butter} label="highlight"/>
            <SwatchBtn color="oklch(0.92 0.08 130)" label="highlight"/>
            <SwatchBtn color="oklch(0.94 0.06 340)" label="highlight"/>
            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }}/>
            <ToolBtn ic="pen" label="note"/>
            <ToolBtn ic="sparkle" label="ask"/>
            <ToolBtn ic="book" label="copy"/>
            <div style={{
              position: 'absolute', top: '100%', left: 30,
              width: 0, height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${REED.ink}`,
            }}/>
          </div>
        </article>

        {/* Margin column */}
        <aside style={{
          width: 220, flexShrink: 0, position: 'relative',
        }}>
          <MarginNote top={220} color={REED.terracotta}
            text="The hinge. Everything after rests on this." date="apr 21" editing={editing} onEdit={setEditing}/>
          <MarginNote top={410} color={REED.olive}
            text="This pivot — from selling goods to selling presence — is the same move every good third place makes." date="apr 21"/>
          <MarginNote top={600} color={REED.plum}
            text="‘Once the excuse was gone…' — the best sentence in the whole essay."/>
        </aside>
      </div>
    </div>
  );
}

function SwatchBtn({ color, label }) {
  return (
    <button title={label} style={{
      width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
      background: 'transparent', padding: 4,
    }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 3, background: color }}/>
    </button>
  );
}

function ToolBtn({ ic, label }) {
  return (
    <button title={label} style={{
      width: 28, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
      background: 'transparent', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={ic} size={13} color="#fff"/>
    </button>
  );
}

function MarginNote({ top, color, text, date, editing, onEdit }) {
  return (
    <div style={{
      position: 'absolute', top, left: 0, right: 0,
      paddingLeft: 14, borderLeft: `2px solid ${color}`,
    }}>
      <div style={{
        fontFamily: REED.mono, fontSize: 9, color: REED.inkFaint,
        letterSpacing: 0.4, marginBottom: 4, textTransform: 'uppercase',
      }}>{date || 'apr 20'}</div>
      <div style={{
        fontFamily: REED.display, fontStyle: 'italic', fontSize: 14,
        color: REED.ink, lineHeight: 1.5, textWrap: 'pretty',
      }}>{text}</div>
    </div>
  );
}

// All highlights view
function HighlightsView() {
  const hls = [
    { id: 1, text: 'When that reason thinned, everything around it thinned too.',
      piece: 'The quiet collapse of the local bookstore', site: 'Longreads',
      note: 'The hinge sentence. Everything after rests on this.',
      color: REED.terracotta, date: 'apr 21' },
    { id: 2, text: 'Once the excuse was gone, the standing-around is what I had to sell.',
      piece: 'The quiet collapse of the local bookstore', site: 'Longreads',
      note: 'Best sentence in the essay.',
      color: REED.plum, date: 'apr 21' },
    { id: 3, text: 'A fence tells you where the thinking stopped, not where it started.',
      piece: 'Soil, silence, and the long half-life of a good fence', site: 'Emergence Magazine',
      note: null, color: REED.olive, date: 'apr 19' },
    { id: 4, text: "The calendar gives you a grid of identical rectangles. But a 30-minute gap between two meetings is not the same thing as a 30-minute gap at 9am on a Tuesday.",
      piece: 'Why your calendar feels broken', site: 'Cluttered Desk',
      note: 'Steal this for the scheduler talk.',
      color: REED.terracotta, date: 'apr 18' },
    { id: 5, text: 'Tools stop being tools when the loop they live in thickens.',
      piece: 'Tool-using agents', site: 'Sequoia',
      note: null, color: REED.olive, date: 'apr 16' },
  ];
  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto',
      background: REED.paper, color: REED.ink, fontFamily: REED.sans,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
      padding: '40px 48px 80px',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
          textTransform: 'uppercase', color: REED.terracotta, marginBottom: 6,
        }}>— your highlights —</div>
        <h1 style={{
          fontFamily: REED.display, fontSize: 44, fontWeight: 600,
          letterSpacing: -1.2, lineHeight: 1.05, margin: '0 0 10px',
          textWrap: 'balance',
        }}>Sentences you stopped for.</h1>
        <div style={{
          fontFamily: REED.display, fontSize: 16, fontStyle: 'italic',
          color: REED.inkMuted, maxWidth: 560, marginBottom: 36,
          lineHeight: 1.5, textWrap: 'pretty',
        }}>{hls.length} highlights across 4 pieces. Ordered newest first. Export to Obsidian, Readwise, or plain Markdown.</div>

        {hls.map(h => (
          <div key={h.id} style={{
            padding: '24px 0', borderTop: `1px solid ${REED.rule}`,
            display: 'grid', gridTemplateColumns: '4px 1fr auto', gap: 18,
            alignItems: 'flex-start',
          }}>
            <div style={{
              width: 4, alignSelf: 'stretch', minHeight: 60,
              background: h.color, borderRadius: 2,
            }}/>
            <div>
              <blockquote style={{
                margin: 0, fontFamily: REED.display, fontSize: 22, fontWeight: 500,
                lineHeight: 1.35, letterSpacing: -0.3, color: REED.ink,
                textWrap: 'pretty',
              }}>"{h.text}"</blockquote>
              {h.note && (
                <div style={{
                  marginTop: 10, padding: '8px 12px', borderRadius: 6,
                  background: `${h.color}15`,
                  fontFamily: REED.display, fontStyle: 'italic', fontSize: 13.5,
                  color: REED.inkMuted, lineHeight: 1.5, textWrap: 'pretty',
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <Icon name="pen" size={12} color={h.color}/>
                  <span>{h.note}</span>
                </div>
              )}
              <div style={{
                marginTop: 10, fontFamily: REED.mono, fontSize: 10.5,
                color: REED.inkFaint, letterSpacing: 0.3,
                display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <span>{h.piece}</span>
                <span>·</span>
                <span>{h.site}</span>
              </div>
            </div>
            <div style={{
              fontFamily: REED.mono, fontSize: 9.5, color: REED.inkFaint,
              letterSpacing: 0.4, textTransform: 'uppercase', padding: '2px 0',
            }}>{h.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REAL AGENT LOOP — wires to the repo's actual shape
// Shows the loop structure: turn → tool_call → tool_result → turn
// Runs scripted-with-claude-body (same as Research panel, live answer)
// ─────────────────────────────────────────────────────────────
function RealAgentLoop() {
  const [running, setRunning] = React.useState(false);
  const [turns, setTurns] = React.useState([]);
  const [answer, setAnswer] = React.useState('');
  const logRef = React.useRef(null);

  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [turns, answer]);

  async function run() {
    setRunning(true);
    setTurns([]);
    setAnswer('');

    const script = [
      { turn: 1, plan: "First, check the library for anything adjacent." },
      { turn: 1, tool: { name: 'search_library', args: { q: 'third places retail neighborhood', limit: 5 } },
        result: '3 hits: "quiet collapse of the local bookstore", "After Pocket", "A grammar for tasting"' },
      { turn: 2, plan: "The bookstore piece looks closest. Let me read it in full." },
      { turn: 2, tool: { name: 'read_article', args: { id: 1 } },
        result: '4,320 words pulled. Key passage: the bookstore as "a reason to stop."' },
      { turn: 3, plan: "Good enough for the library side. Now recent web coverage." },
      { turn: 3, tool: { name: 'search_web', args: { q: 'third places 2026 replacement community retail' } },
        result: 'NYT, Atlantic, Axios — Apr 2026. Covers the shift from commerce to co-working.' },
      { turn: 4, plan: "I have enough. Answering." },
    ];

    for (const s of script) {
      await new Promise(r => setTimeout(r, 550 + Math.random() * 250));
      setTurns(t => [...t, s]);
    }

    await new Promise(r => setTimeout(r, 400));
    let body = null;
    try {
      if (window.claude && window.claude.complete) {
        const prompt = "Write a 3-paragraph answer in a warm, literary tone to: 'What's replacing third places?' Use citations [1][2][3]. Reference a bookstore essay, its key quote about 'a reason to stop', and current 2026 reporting.";
        const r = await Promise.race([
          window.claude.complete({ messages: [{ role: 'user', content: prompt }] }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 9000)),
        ]);
        if (typeof r === 'string' && r.trim()) body = r.trim();
      }
    } catch (e) {}
    if (!body) body = `Short answer: the replacement isn't one thing — it's a handful of partial answers, and they're still arguing with each other.

Your library has the clearest diagnosis [1]: the bookstore wasn't really in the book business. It was in the business of giving people "a reason to stop." When commerce moved online, the stopping-place had to stand on its own. The piece's closing observation [2] — "once the excuse was gone, the standing-around is what I had to sell" — is where the whole argument turns.

Recent reporting [3] picks up the thread. What's emerging in 2026 looks less like old third places and more like explicitly-paid-for time: co-working cafes, subscription lounges, "work-adjacent" bars. The economic model is clearer but the atmosphere is thinner. Worth reading the bookstore piece and the NYT report back-to-back — they agree on the diagnosis and disagree on what to do about it.`;

    // Stream
    const chunks = [];
    let i = 0;
    while (i < body.length) {
      const n = 2 + Math.floor(Math.random() * 3);
      chunks.push(body.slice(i, i + n));
      i += n;
    }
    for (const c of chunks) {
      setAnswer(a => a + c);
      await new Promise(r => setTimeout(r, 10));
    }
    setRunning(false);
  }

  React.useEffect(() => { run(); /* autorun once */ }, []);

  // Citation rendering
  const parts = [];
  let last = 0;
  const re = /\[(\d+)\]/g;
  let m, key = 0;
  while ((m = re.exec(answer)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{answer.slice(last, m.index)}</span>);
    parts.push(<Cite key={key++} n={Number(m[1])} color={REED.olive}/>);
    last = m.index + m[0].length;
  }
  if (last < answer.length) parts.push(<span key={key++}>{answer.slice(last)}</span>);

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto',
      background: REED.paperDeep, padding: 28, fontFamily: REED.sans,
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid',
        gridTemplateColumns: '420px 1fr', gap: 24 }}>

        {/* Left — live loop */}
        <div>
          <div style={{
            fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
            textTransform: 'uppercase', color: REED.olive, marginBottom: 4,
          }}>— agent.run() · live —</div>
          <h2 style={{
            fontFamily: REED.display, fontSize: 22, fontWeight: 600,
            letterSpacing: -0.4, margin: '0 0 4px',
          }}>The loop</h2>
          <div style={{
            fontFamily: REED.display, fontSize: 13, fontStyle: 'italic',
            color: REED.inkMuted, marginBottom: 14, lineHeight: 1.5,
            textWrap: 'pretty',
          }}>Wired to the repo's <span style={{
            fontFamily: REED.mono, fontSize: 11, background: REED.paper,
            padding: '1px 5px', borderRadius: 4,
          }}>runAgent()</span> shape — turns, tool_calls, tool_results, final answer.</div>

          <div ref={logRef} style={{
            padding: 14, borderRadius: REED.r.lg,
            background: REED.ink, color: '#E9DFCB',
            maxHeight: 560, overflowY: 'auto',
            fontFamily: REED.mono, fontSize: 11.5, lineHeight: 1.7,
          }}>
            <div style={{ color: '#B3A594' }}>
              <span style={{ color: REED.terracotta }}>▸</span> agent.run("What's replacing third places?")
            </div>
            {turns.map((s, i) => (
              <div key={i} style={{ marginTop: 8 }}>
                {s.plan && !s.tool && (
                  <div style={{ color: '#E9DFCB', opacity: 0.85 }}>
                    <span style={{ color: REED.plum }}>plan</span>
                    {` ${JSON.stringify({ turn: s.turn })}: `}
                    <span style={{ color: '#F2D5B8', fontStyle: 'italic' }}>"{s.plan}"</span>
                  </div>
                )}
                {s.plan && s.tool && (
                  <div style={{ color: '#E9DFCB', opacity: 0.85 }}>
                    <span style={{ color: REED.plum }}>plan</span>{` "${s.plan}"`}
                  </div>
                )}
                {s.tool && (
                  <>
                    <div style={{ color: '#E9DFCB' }}>
                      <span style={{ color: REED.olive }}>tool_call</span>{` ${s.tool.name}(`}
                      <span style={{ color: '#F2D5B8' }}>
                        {Object.entries(s.tool.args).map(([k,v]) =>
                          `${k}=${typeof v === 'string' ? '"'+v+'"' : v}`).join(', ')}
                      </span>
                      {`)`}
                    </div>
                    <div style={{ color: '#A89989', paddingLeft: 12 }}>
                      <span style={{ color: REED.olive }}>→</span> {s.result}
                    </div>
                  </>
                )}
              </div>
            ))}
            {running && (
              <div style={{ marginTop: 10, color: REED.olive }}>
                <span style={{ animation: 'reedBlink 1s infinite' }}>▊</span>
              </div>
            )}
          </div>

          <button onClick={run} disabled={running} style={{
            marginTop: 10, padding: '8px 14px', borderRadius: 8,
            border: `1px solid ${REED.rule}`, cursor: running ? 'default' : 'pointer',
            background: running ? REED.paperDeep : REED.paperRaised,
            color: REED.ink, fontFamily: REED.sans, fontSize: 12, fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="refresh" size={12}/>
            {running ? 'running…' : 'Run again'}
          </button>
        </div>

        {/* Right — rendered answer */}
        <div>
          <div style={{
            fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
            textTransform: 'uppercase', color: REED.terracotta, marginBottom: 4,
          }}>— as the user sees it —</div>
          <h2 style={{
            fontFamily: REED.display, fontSize: 22, fontWeight: 600,
            letterSpacing: -0.4, margin: '0 0 14px',
          }}>The answer</h2>
          <div style={{
            padding: 18, borderRadius: REED.r.lg,
            background: REED.paper, border: `1px solid ${REED.rule}`,
            minHeight: 420,
          }}>
            {answer ? (
              <>
                <div style={{
                  fontFamily: REED.sans, fontSize: 14.5, lineHeight: 1.65,
                  color: REED.ink, whiteSpace: 'pre-wrap', textWrap: 'pretty',
                }}>{parts}{running && <span style={{
                  display: 'inline-block', width: 6, height: 14,
                  background: REED.olive, marginLeft: 3, verticalAlign: -2,
                  animation: 'reedBlink 1s infinite',
                }}/>}</div>
                <div style={{
                  marginTop: 20, paddingTop: 14,
                  borderTop: `1px dashed ${REED.rule}`,
                }}>
                  <div style={{
                    fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.8,
                    textTransform: 'uppercase', color: REED.inkMuted, marginBottom: 10,
                  }}>Sources</div>
                  <ol style={{ margin: 0, padding: 0, listStyle: 'none',
                    display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <SourceRow n={1} label='"The quiet collapse of the local bookstore"' sub="your library"/>
                    <SourceRow n={2} label='"Soil, silence, and the long half-life of a good fence"' sub="your library"/>
                    <SourceRow n={3} label='"What replaced the third place"' sub="web · nytimes.com"/>
                  </ol>
                </div>
              </>
            ) : (
              <div style={{
                fontFamily: REED.display, fontStyle: 'italic', fontSize: 14,
                color: REED.inkMuted, textWrap: 'pretty',
              }}>The agent is thinking…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ n, label, sub }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Cite n={n} color={REED.olive}/>
      <div>
        <div style={{ fontFamily: REED.sans, fontSize: 12.5, color: REED.ink,
          fontWeight: 500 }}>{label}</div>
        <div style={{ fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
          marginTop: 2 }}>{sub}</div>
      </div>
    </li>
  );
}

Object.assign(window, {
  TagsView, AutoTagReview, SearchView, HighlightReader, HighlightsView, RealAgentLoop,
});
