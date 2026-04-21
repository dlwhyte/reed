// Library — warm magazine-index feel.
// Supports a density toggle (mixed / card / list).

function Library({ density = 'mixed', onOpen = () => {}, showChrome = true }) {
  const [tab, setTab] = React.useState('unread');
  const [tag, setTag] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [semantic, setSemantic] = React.useState(false);

  let list = SAMPLE_ARTICLES.slice();
  if (tab === 'favorites') list = list.filter(a => a.favorite);
  if (tab === 'archived') list = [];
  if (tag) list = list.filter(a => a.tags.includes(tag));
  if (q) list = list.filter(a => (a.title + a.summary).toLowerCase().includes(q.toLowerCase()));

  // In 'mixed', first item is a hero, next 2 are cards, rest are list rows.
  const hero = density === 'mixed' ? list[0] : null;
  const cards = density === 'mixed' ? list.slice(1, 3) : (density === 'card' ? list : []);
  const rows = density === 'mixed' ? list.slice(3) : (density === 'list' ? list : []);

  return (
    <div style={{
      minHeight: '100%', background: REED.paper,
      fontFamily: REED.sans, color: REED.ink,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
    }}>
      {showChrome && <LibraryHeader />}

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 40px 80px' }}>
        {/* Save bar */}
        <SaveBar />

        {/* Tabs + density + sort */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 28, marginBottom: 18,
          paddingBottom: 14, borderBottom: `1px dashed ${REED.rule}`,
        }}>
          {['unread','favorites','archived','all'].map(t => (
            <Tab key={t} active={tab === t} onClick={() => { setTab(t); setTag(null); }}>{t}</Tab>
          ))}
          <div style={{ flex: 1 }} />
          <DensityToggle density={density} />
          <SortPicker />
        </div>

        {/* Search row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: REED.r.lg,
            background: REED.paperRaised,
            border: `1px solid ${REED.rule}`,
          }}>
            <Icon name="search" size={16} color={REED.inkMuted} />
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder={semantic ? 'Describe what you want to find…' : 'Search by keyword…'}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: REED.sans, fontSize: 14, color: REED.ink,
              }}
            />
            {q && (
              <button onClick={() => setQ('')} style={{
                border: 'none', background: 'transparent', padding: 2, cursor: 'pointer',
                color: REED.inkMuted,
              }}><Icon name="x" size={14} /></button>
            )}
          </div>
          <button onClick={() => setSemantic(s => !s)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 14px', borderRadius: REED.r.lg,
            border: `1px solid ${semantic ? REED.terracotta : REED.rule}`,
            background: semantic ? REED.terracotta : REED.paperRaised,
            color: semantic ? '#fff' : REED.inkMuted,
            fontFamily: REED.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            <Icon name="sparkle" size={14} />
            <span>Semantic</span>
          </button>
        </div>

        {/* Tag strip */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 26 }}>
          {tag && (
            <button onClick={() => setTag(null)} style={{
              padding: '4px 10px', borderRadius: REED.r.pill,
              background: REED.ink, color: REED.paper,
              fontFamily: REED.mono, fontSize: 11, border: 'none', cursor: 'pointer',
            }}>× {tag}</button>
          )}
          {!tag && SAMPLE_TAGS.slice(0, 10).map(t => (
            <button key={t.tag} onClick={() => setTag(t.tag)} style={{
              padding: '4px 10px', borderRadius: REED.r.pill,
              background: 'transparent', border: `1px solid ${REED.rule}`,
              color: REED.inkMuted,
              fontFamily: REED.mono, fontSize: 11, cursor: 'pointer',
            }}>#{t.tag} <span style={{ opacity: 0.5 }}>· {t.count}</span></button>
          ))}
        </div>

        {/* Hero */}
        {hero && <HeroCard article={hero} onClick={() => onOpen(hero.id)} />}

        {/* Card row */}
        {cards.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: density === 'card'
              ? 'repeat(3, 1fr)'
              : 'repeat(2, 1fr)',
            gap: 18, marginTop: hero ? 22 : 0, marginBottom: 28,
          }}>
            {cards.map(a => <ArticleCard key={a.id} article={a} onClick={() => onOpen(a.id)} />)}
          </div>
        )}

        {/* List rows */}
        {rows.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {density === 'mixed' && (
              <div style={{
                fontFamily: REED.display, fontSize: 13, fontStyle: 'italic',
                color: REED.inkMuted, marginBottom: 10,
              }}>Also in your shelf</div>
            )}
            {rows.map((a, i) => (
              <ListRow key={a.id} article={a} onClick={() => onOpen(a.id)}
                last={i === rows.length - 1} />
            ))}
          </div>
        )}

        {list.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px', color: REED.inkMuted,
            fontFamily: REED.display, fontStyle: 'italic', fontSize: 17,
          }}>Nothing here yet — paste a URL above to save your first piece.</div>
        )}
      </div>
    </div>
  );
}

function LibraryHeader() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: `${REED.paper}cc`, backdropFilter: 'blur(10px)',
      borderBottom: `1px solid ${REED.rule}`,
    }}>
      <div style={{
        maxWidth: 1040, margin: '0 auto', padding: '0 40px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Wordmark size={22} />
          <div style={{ fontFamily: REED.mono, fontSize: 11, color: REED.inkFaint,
            letterSpacing: 0.5, textTransform: 'uppercase' }}>
            a reading shelf, on your mac
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton name="clock" label="Recent" />
          <IconButton name="settings" label="Settings" />
        </div>
      </div>
    </header>
  );
}

function IconButton({ name, label, onClick, color = REED.inkMuted }) {
  return (
    <button onClick={onClick} title={label} style={{
      width: 34, height: 34, borderRadius: 8, border: 'none',
      background: 'transparent', color, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onMouseEnter={e => e.currentTarget.style.background = REED.rule}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Icon name={name} size={18} />
    </button>
  );
}

function SaveBar() {
  const [url, setUrl] = React.useState('');
  const [saved, setSaved] = React.useState(null);
  function save() {
    if (!url.trim()) return;
    setSaved('Saved · extracting article…');
    setTimeout(() => setSaved(null), 2200);
    setUrl('');
  }
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px 8px 20px',
        borderRadius: REED.r.xl,
        background: REED.paperRaised,
        border: `1px solid ${REED.rule}`,
        boxShadow: '0 1px 0 rgba(43,35,32,0.02), 0 8px 20px -12px rgba(43,35,32,0.1)',
      }}>
        <Icon name="url" size={18} color={REED.terracotta} />
        <input
          value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Paste a link — I'll clean it up and file it"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: REED.sans, fontSize: 15, color: REED.ink,
            padding: '6px 0',
          }}
        />
        <button onClick={save} disabled={!url.trim()} style={{
          padding: '8px 18px', borderRadius: REED.r.pill,
          background: url.trim() ? REED.terracotta : REED.rule,
          color: '#fff', border: 'none',
          fontFamily: REED.sans, fontSize: 13, fontWeight: 500,
          cursor: url.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="plus2" size={14} color="#fff" /> Save
        </button>
      </div>
      {saved && (
        <div style={{
          fontFamily: REED.mono, fontSize: 11, color: REED.olive,
          padding: '8px 14px 0', letterSpacing: 0.3,
        }}>→ {saved}</div>
      )}
    </div>
  );
}

function DensityToggle({ density }) {
  const btn = (name, ic, active) => (
    <button title={name} style={{
      width: 30, height: 28, border: 'none',
      background: active ? REED.paperRaised : 'transparent',
      color: active ? REED.ink : REED.inkFaint,
      borderRadius: 6, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}><Icon name={ic} size={14} /></button>
  );
  return (
    <div style={{
      display: 'flex', padding: 2, borderRadius: 8,
      border: `1px solid ${REED.rule}`, background: REED.paper,
    }}>
      {btn('Mixed', 'bookmark', density === 'mixed')}
      {btn('Cards', 'grid', density === 'card')}
      {btn('List', 'list', density === 'list')}
    </div>
  );
}

function SortPicker() {
  return (
    <button style={{
      padding: '6px 10px', borderRadius: 8,
      border: `1px solid ${REED.rule}`,
      background: REED.paper, color: REED.inkMuted,
      fontFamily: REED.sans, fontSize: 12, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <Icon name="filter" size={12} />
      Newest <Icon name="chevD" size={12} />
    </button>
  );
}

// ───────────────────────────────────────────────────────────
// Hero card — full-width magazine feature
// ───────────────────────────────────────────────────────────
function HeroCard({ article, onClick }) {
  return (
    <article onClick={onClick} style={{
      display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: 26,
      padding: 22, borderRadius: REED.r.xl,
      background: REED.paperRaised, border: `1px solid ${REED.rule}`,
      cursor: 'pointer', marginBottom: 22,
      boxShadow: '0 1px 0 rgba(43,35,32,0.02), 0 30px 60px -40px rgba(43,35,32,0.3)',
    }}>
      <Cover article={article} h={240} rounded={14} />
      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 6 }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
          textTransform: 'uppercase', color: REED.terracotta,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 18, height: 1, background: REED.terracotta }}/>
          Lead feature · saved {article.age} ago
        </div>
        <h2 style={{
          fontFamily: REED.display, fontSize: 32, fontWeight: 600,
          lineHeight: 1.1, letterSpacing: -0.7,
          margin: '12px 0 10px',
          color: REED.ink, textWrap: 'pretty',
        }}>{article.title}</h2>
        <div style={{
          fontFamily: REED.sans, fontSize: 13, color: REED.inkMuted,
          marginBottom: 12,
        }}>
          {article.author} · {article.site} · {article.readMin} min read
        </div>
        <p style={{
          fontFamily: REED.display, fontSize: 16, fontStyle: 'italic',
          lineHeight: 1.5, color: REED.inkMuted,
          margin: 0, textWrap: 'pretty',
        }}>{article.summary}</p>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {article.tags.map(t => (
            <span key={t} style={{
              padding: '3px 9px', borderRadius: REED.r.pill,
              background: REED.butter, color: REED.ink,
              fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.3,
            }}>#{t}</span>
          ))}
          {article.favorite && (
            <span style={{ marginLeft: 'auto', color: REED.terracotta }}>
              <Icon name="star" size={16} fill={REED.terracotta} color={REED.terracotta}/>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function ArticleCard({ article, onClick }) {
  return (
    <article onClick={onClick} style={{
      borderRadius: REED.r.lg, overflow: 'hidden',
      background: REED.paperRaised, border: `1px solid ${REED.rule}`,
      cursor: 'pointer', display: 'flex', flexDirection: 'column',
      transition: 'transform .15s, box-shadow .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 30px -18px rgba(43,35,32,0.3)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none'; }}>
      <Cover article={article} h={120} rounded={0} />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
          letterSpacing: 0.4, textTransform: 'uppercase',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          {article.site} · {article.readMin}m
          {article.favorite && (
            <span style={{ marginLeft: 'auto', color: REED.terracotta }}>
              <Icon name="star" size={10} fill={REED.terracotta} color={REED.terracotta}/>
            </span>
          )}
        </div>
        <h3 style={{
          fontFamily: REED.display, fontSize: 17, fontWeight: 600,
          lineHeight: 1.2, letterSpacing: -0.2, margin: 0,
          textWrap: 'pretty',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{article.title}</h3>
        <p style={{
          fontFamily: REED.sans, fontSize: 12.5, lineHeight: 1.45,
          color: REED.inkMuted, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{article.tldr}</p>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {article.tags.slice(0,2).map(t => (
            <span key={t} style={{
              padding: '2px 7px', borderRadius: REED.r.pill,
              background: REED.paper, border: `1px solid ${REED.rule}`,
              color: REED.inkMuted,
              fontFamily: REED.mono, fontSize: 9, letterSpacing: 0.3,
            }}>#{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function ListRow({ article, onClick, last }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 18,
      padding: '16px 4px',
      borderBottom: last ? 'none' : `1px dashed ${REED.rule}`,
      cursor: 'pointer',
    }}>
      <div style={{
        flexShrink: 0, width: 46,
        fontFamily: REED.mono, fontSize: 11, color: REED.inkFaint,
        letterSpacing: 0.5, paddingTop: 2,
      }}>{article.age}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <span style={{
            fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
            letterSpacing: 0.4, textTransform: 'uppercase',
          }}>{article.site}</span>
          <span style={{ fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint }}>·</span>
          <span style={{ fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint }}>{article.readMin} min</span>
          {article.favorite && <Icon name="star" size={11} fill={REED.terracotta} color={REED.terracotta} />}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {article.tags.slice(0,2).map(t => (
              <span key={t} style={{
                padding: '1px 7px', borderRadius: REED.r.pill,
                color: REED.inkMuted,
                fontFamily: REED.mono, fontSize: 9,
              }}>#{t}</span>
            ))}
          </div>
        </div>
        <div style={{
          fontFamily: REED.display, fontSize: 19, fontWeight: 500,
          lineHeight: 1.25, letterSpacing: -0.2, color: REED.ink,
          marginBottom: 4,
        }}>{article.title}</div>
        <div style={{
          fontFamily: REED.sans, fontSize: 13, lineHeight: 1.5,
          color: REED.inkMuted,
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{article.tldr}</div>
      </div>
    </div>
  );
}

Object.assign(window, { Library });
