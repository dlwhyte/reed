// Mobile Reader — iOS-shaped column; shares data + tokens
function MobileReader({ articleId = 1, initialPanel = 'none' }) {
  const article = SAMPLE_ARTICLES.find(a => a.id === articleId) || SAMPLE_ARTICLES[0];
  const [panel, setPanel] = React.useState(initialPanel);
  const palette = { paper: REED.paper, paperDeep: REED.paperDeep, paperRaised: REED.paperRaised,
    ink: REED.ink, inkMuted: REED.inkMuted, inkFaint: REED.inkFaint, rule: REED.rule };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: palette.paper, color: palette.ink, fontFamily: REED.sans,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
    }}>
      {/* Top */}
      <div style={{
        paddingTop: 58, paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        background: `${palette.paper}e6`, backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${palette.rule}`, position: 'relative', zIndex: 5,
      }}>
        <button style={{
          width: 34, height: 34, borderRadius: 10, border: 'none',
          background: palette.paperRaised, color: palette.inkMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}><Icon name="back" size={16}/></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontFamily: REED.mono, fontSize: 10, color: palette.inkFaint,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>reading</div>
          <div style={{
            fontFamily: REED.display, fontSize: 13, fontStyle: 'italic',
            color: palette.ink,
          }}>{article.site}</div>
        </div>
        <button style={{
          width: 34, height: 34, borderRadius: 10, border: 'none',
          background: palette.paperRaised, color: palette.inkMuted,
        }}><Icon name="more" size={16}/></button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 22px 130px' }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
          textTransform: 'uppercase', color: REED.terracotta,
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        }}>
          <span style={{ width: 18, height: 1, background: REED.terracotta }}/>
          {article.site}
        </div>
        <h1 style={{
          fontFamily: REED.display, fontWeight: 600,
          fontSize: 28, lineHeight: 1.1, letterSpacing: -0.5,
          margin: '0 0 14px', textWrap: 'balance', color: palette.ink,
        }}>{article.title}</h1>
        <div style={{
          fontFamily: REED.sans, fontSize: 12, color: palette.inkMuted,
          marginBottom: 20,
        }}>{article.author} · {article.readMin} min</div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10,
          padding: '12px 14px', borderRadius: REED.r.md,
          background: REED.butter + '77', border: `1px solid ${palette.rule}`,
          marginBottom: 22,
        }}>
          <div style={{
            fontFamily: REED.mono, fontSize: 9, color: REED.terracotta,
            letterSpacing: 1, textTransform: 'uppercase', paddingTop: 2,
          }}>TL;DR</div>
          <div style={{
            fontFamily: REED.display, fontSize: 14, fontStyle: 'italic',
            lineHeight: 1.5, color: palette.ink,
          }}>{article.tldr}</div>
        </div>

        <div style={{
          fontFamily: REED.serif, fontSize: 17, lineHeight: 1.65, color: palette.ink,
        }}>
          {bodyFor(article).slice(0, 4).map((p, i) => (
            <p key={i} style={{ margin: '0 0 1.05em', textWrap: 'pretty' }}>
              {i === 0 && (
                <span style={{
                  float: 'left', fontFamily: REED.display, fontSize: '3.6em',
                  lineHeight: 0.85, marginRight: 8, marginTop: 4,
                  color: REED.terracotta, fontWeight: 600,
                }}>{p[0]}</span>
              )}
              {i === 0 ? p.slice(1) : p}
            </p>
          ))}
          <blockquote style={{
            margin: '22px 0', padding: '4px 0 4px 18px',
            borderLeft: `2px solid ${REED.terracotta}`,
            fontFamily: REED.display, fontStyle: 'italic',
            fontSize: '1.08em', color: palette.inkMuted,
          }}>“{article.excerpt}”</blockquote>
          {bodyFor(article).slice(4, 6).map((p, i) => (
            <p key={i} style={{ margin: '0 0 1.05em', textWrap: 'pretty' }}>{p}</p>
          ))}
        </div>
      </div>

      {/* Floating bottom bar (liquid-glass pill) */}
      <div style={{
        position: 'absolute', bottom: 46, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', gap: 4, padding: 5,
          borderRadius: 999, background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${palette.rule}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 10px 40px rgba(0,0,0,0.06)',
        }}>
          <MobilePillBtn ic="type" label="Type" />
          <MobilePillBtn ic="chat" color={REED.plum} active={panel==='chat'}
            onClick={() => setPanel(p => p==='chat'?'none':'chat')} />
          <MobilePillBtn ic="flask" color={REED.olive} active={panel==='research'}
            onClick={() => setPanel(p => p==='research'?'none':'research')} />
          <MobilePillBtn ic="star" />
          <MobilePillBtn ic="archive" />
        </div>
      </div>

      {/* Bottom sheet */}
      {panel !== 'none' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, top: 140,
          zIndex: 40,
          background: 'rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={() => setPanel('none')}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', height: '80%',
            background: palette.paperDeep, color: palette.ink,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
          }}>
            <div style={{
              padding: '10px 0', display: 'flex', justifyContent: 'center',
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2,
                background: palette.rule }}/>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '4px 18px 14px',
              borderBottom: `1px solid ${palette.rule}`,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: panel==='chat'?REED.plum:REED.olive, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icon name={panel==='chat'?'chat':'flask'} size={14} color="#fff"/></div>
              <div style={{
                fontFamily: REED.display, fontSize: 17, fontWeight: 600,
                letterSpacing: -0.3,
              }}>{panel==='chat'?'Chat with article':'Research'}</div>
              <div style={{ flex: 1 }}/>
              <button onClick={() => setPanel('none')} style={{
                width: 30, height: 30, borderRadius: 8, border: 'none',
                background: 'transparent', color: palette.inkMuted,
              }}><Icon name="x" size={14}/></button>
            </div>
            {panel==='chat' ?
              <ChatPane article={article} palette={palette}/> :
              <ResearchPane article={article} palette={palette}/>}
          </div>
        </div>
      )}
    </div>
  );
}

function MobilePillBtn({ ic, label, active, color, onClick }) {
  return (
    <button onClick={onClick} title={label} style={{
      width: 40, height: 40, borderRadius: 999, border: 'none',
      background: active ? (color || REED.ink) : 'transparent',
      color: active ? '#fff' : REED.inkMuted, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={ic} size={17} color={active ? '#fff' : 'currentColor'}/>
    </button>
  );
}

// ───────────────────────────────────────────────────────────
// Mobile Library
// ───────────────────────────────────────────────────────────
function MobileLibrary() {
  const [tab, setTab] = React.useState('unread');
  const list = tab === 'favorites' ? SAMPLE_ARTICLES.filter(a => a.favorite) :
    tab === 'archived' ? [] : SAMPLE_ARTICLES;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: REED.paper, color: REED.ink, fontFamily: REED.sans,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
    }}>
      <div style={{ paddingTop: 58, paddingBottom: 14, paddingInline: 22,
        flexShrink: 0 }}>
        <Wordmark size={34}/>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
          letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6,
        }}>your shelf · 247 pieces</div>
      </div>
      <div style={{ paddingInline: 16, paddingBottom: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: REED.r.lg,
          background: REED.paperRaised, border: `1px solid ${REED.rule}`,
        }}>
          <Icon name="url" size={15} color={REED.terracotta}/>
          <div style={{
            flex: 1, fontFamily: REED.sans, fontSize: 13, color: REED.inkMuted,
          }}>Paste a link to save…</div>
          <button style={{
            padding: '5px 14px', borderRadius: 999, border: 'none',
            background: REED.terracotta, color: '#fff',
            fontFamily: REED.sans, fontSize: 12, fontWeight: 500,
          }}>Save</button>
        </div>
      </div>
      <div style={{
        display: 'flex', gap: 6, paddingInline: 16, paddingBottom: 10,
        overflowX: 'auto',
      }}>
        {['unread','favorites','archived','all'].map(t => (
          <Tab key={t} active={tab===t} onClick={() => setTab(t)}>{t}</Tab>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '6px 16px 80px' }}>
        {list.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '50px 20px', color: REED.inkMuted,
            fontFamily: REED.display, fontStyle: 'italic',
          }}>Nothing here yet.</div>
        ) : list.map((a, i) => (
          <MobileRow key={a.id} a={a} first={i===0}/>
        ))}
      </div>
    </div>
  );
}

function MobileRow({ a, first }) {
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '14px 0',
      borderBottom: `1px dashed ${REED.rule}`,
    }}>
      <Cover article={a} w={68} h={88} rounded={8}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 9, color: REED.inkFaint,
          letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4,
          display: 'flex', gap: 6,
        }}>
          <span>{a.site}</span><span>·</span><span>{a.readMin}m</span>
          {a.favorite && <Icon name="star" size={10} fill={REED.terracotta} color={REED.terracotta}/>}
        </div>
        <div style={{
          fontFamily: REED.display, fontSize: 16, fontWeight: 600,
          lineHeight: 1.2, letterSpacing: -0.2, color: REED.ink, marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{a.title}</div>
        <div style={{
          fontFamily: REED.sans, fontSize: 12, lineHeight: 1.45,
          color: REED.inkMuted,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{a.tldr}</div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Chrome Extension Popup
// ───────────────────────────────────────────────────────────
function ExtensionPopup() {
  const [state, setState] = React.useState('ready'); // ready | saving | saved
  async function save() {
    setState('saving');
    await new Promise(r => setTimeout(r, 900));
    setState('saved');
  }
  const recents = SAMPLE_ARTICLES.slice(0, 5);

  return (
    <div style={{
      width: 360, minHeight: 480,
      background: REED.paper, color: REED.ink,
      fontFamily: REED.sans,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${REED.rule}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Wordmark size={18}/>
        <div style={{ flex: 1 }}/>
        <div style={{
          fontFamily: REED.mono, fontSize: 9, letterSpacing: 0.8,
          textTransform: 'uppercase', color: REED.olive,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: REED.olive }}/>
          localhost · online
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.5,
          color: REED.inkFaint, textTransform: 'uppercase', marginBottom: 6,
        }}>this page</div>
        <div style={{
          padding: 12, borderRadius: REED.r.lg,
          background: REED.paperRaised, border: `1px solid ${REED.rule}`,
          marginBottom: 10,
        }}>
          <div style={{
            fontFamily: REED.display, fontSize: 14, fontWeight: 600,
            letterSpacing: -0.2, lineHeight: 1.3, textWrap: 'pretty',
            marginBottom: 4,
          }}>A walking essay along a stone boundary in the Scottish borders</div>
          <div style={{
            fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
            letterSpacing: 0.3,
          }}>emergencemagazine.org</div>
        </div>
        <button onClick={save} disabled={state==='saving'} style={{
          width: '100%', padding: '12px 14px', borderRadius: REED.r.lg,
          border: 'none', cursor: state==='saving'?'default':'pointer',
          background: state==='saved' ? REED.olive : REED.terracotta,
          color: '#fff',
          fontFamily: REED.sans, fontSize: 14, fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background .2s',
        }}>
          {state === 'saving' ? (
            <><TypingDots color="#fff"/> saving…</>
          ) : state === 'saved' ? (
            <><Icon name="check" size={16} color="#fff"/> saved to your shelf</>
          ) : (
            <><Icon name="plus2" size={16} color="#fff"/> Save to BrowseFellow</>
          )}
        </button>
      </div>

      <div style={{
        padding: '0 16px 14px',
      }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.5,
          color: REED.inkFaint, textTransform: 'uppercase', marginBottom: 8,
        }}>recently saved</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recents.map((a, i) => (
            <div key={a.id} style={{
              display: 'flex', gap: 10, padding: '8px 0',
              borderBottom: i === recents.length - 1 ? 'none' : `1px dashed ${REED.rule}`,
              cursor: 'pointer',
            }}>
              <div style={{
                width: 6, alignSelf: 'stretch', borderRadius: 3,
                background: a.color, flexShrink: 0,
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: REED.display, fontSize: 13, fontWeight: 500,
                  lineHeight: 1.3, letterSpacing: -0.1,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>{a.title}</div>
                <div style={{
                  fontFamily: REED.mono, fontSize: 9, color: REED.inkFaint,
                  marginTop: 2, letterSpacing: 0.3,
                }}>{a.site} · {a.age} ago</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}/>
      <div style={{
        padding: '10px 16px', borderTop: `1px solid ${REED.rule}`,
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
        letterSpacing: 0.3,
      }}>
        <span>⌘ + shift + S</span>
        <span>·</span>
        <span>open shelf</span>
        <div style={{ flex: 1 }}/>
        <Icon name="settings" size={13} color={REED.inkFaint}/>
      </div>
    </div>
  );
}

Object.assign(window, { MobileReader, MobileLibrary, ExtensionPopup });
