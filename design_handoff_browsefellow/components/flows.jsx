// Flows + States — save flow with toast, empty states, error states,
// agent trace verbosity variations.

// ─────────────────────────────────────────────────────────────
// SAVE FLOW — extension click → popup → toast on shelf
// Three-step animation controlled by an autoplay prop.
// ─────────────────────────────────────────────────────────────
function SaveFlow({ autoplay = true }) {
  const [step, setStep] = React.useState(0);
  // 0 idle · 1 popup open · 2 saving · 3 saved · 4 shelf with toast

  React.useEffect(() => {
    if (!autoplay) return;
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1500),
      setTimeout(() => setStep(3), 2600),
      setTimeout(() => setStep(4), 3400),
      setTimeout(() => setStep(0), 6800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [autoplay, step === 0]);

  const loop = () => setStep(0);

  return (
    <div style={{
      width: '100%', height: '100%', background: '#E8E5DE',
      borderRadius: 12, overflow: 'hidden', position: 'relative',
      fontFamily: REED.sans,
    }}>
      {/* Browser chrome */}
      <div style={{
        height: 64, background: '#F5F2EA',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
      }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#F2675F' }}/>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#F5BD4F' }}/>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#61C454' }}/>
        </div>
        <div style={{
          flex: 1, maxWidth: 400, height: 32, borderRadius: 16,
          background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
          padding: '0 14px', display: 'flex', alignItems: 'center',
          fontFamily: REED.mono, fontSize: 11, color: REED.inkMuted,
        }}>emergencemagazine.org/essay/the-long-boundary</div>
        <div style={{ flex: 1 }}/>
        <button onClick={() => { if (step === 0) setStep(1); else loop(); }} style={{
          width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
          background: REED.terracotta, border: 'none',
          boxShadow: step >= 1 ? '0 0 0 3px rgba(217,98,70,0.22)' : 'none',
          color: '#fff', fontFamily: REED.display, fontSize: 17,
          fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'box-shadow .2s',
        }}>r</button>
      </div>

      {/* Article page (mocked) */}
      <FakeArticlePage/>

      {/* Popup */}
      {step >= 1 && step <= 3 && (
        <div style={{
          position: 'absolute', top: 72, right: 14, width: 300,
          borderRadius: 12, overflow: 'hidden',
          background: REED.paper, color: REED.ink,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.22), 0 4px 10px rgba(0,0,0,0.08)',
          backgroundImage: PAPER_NOISE, backgroundSize: '240px',
          animation: 'reedPopIn .18s ease-out',
        }}>
          <div style={{
            padding: '12px 14px', borderBottom: `1px solid ${REED.rule}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Wordmark size={14}/>
            <div style={{ flex: 1 }}/>
            <div style={{
              fontFamily: REED.mono, fontSize: 9, letterSpacing: 0.3,
              color: REED.olive,
            }}>● online</div>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{
              fontFamily: REED.display, fontSize: 14, fontWeight: 600,
              letterSpacing: -0.2, lineHeight: 1.3, textWrap: 'pretty',
              marginBottom: 3,
            }}>Soil, silence, and the long half-life of a good fence</div>
            <div style={{
              fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
            }}>emergencemagazine.org · ~22 min</div>

            <button onClick={() => setStep(2)} disabled={step !== 1} style={{
              width: '100%', marginTop: 12, padding: '10px 12px',
              borderRadius: 8, border: 'none', cursor: step === 1 ? 'pointer' : 'default',
              background: step === 3 ? REED.olive : REED.terracotta,
              color: '#fff', fontFamily: REED.sans, fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background .2s',
            }}>
              {step === 1 && <><Icon name="plus2" size={14} color="#fff"/> Save to reed</>}
              {step === 2 && <><TypingDots color="#fff"/> Extracting article…</>}
              {step === 3 && <><Icon name="check" size={14} color="#fff"/> Saved</>}
            </button>

            {step === 3 && (
              <div style={{
                marginTop: 10, padding: 10, borderRadius: 8,
                background: REED.oliveSoft, border: `1px dashed ${REED.olive}`,
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <Icon name="sparkle" size={12} color={REED.olive}/>
                <div style={{
                  fontFamily: REED.sans, fontSize: 11, color: REED.ink, lineHeight: 1.45,
                }}>
                  Suggested tags:
                  <span style={{
                    display: 'inline-flex', gap: 4, marginLeft: 4, flexWrap: 'wrap',
                  }}>
                    {['ecology', 'longform', 'walking'].map(t => (
                      <span key={t} style={{
                        padding: '1px 6px', borderRadius: 4,
                        background: REED.paperRaised, fontFamily: REED.mono,
                        fontSize: 9.5, color: REED.olive, letterSpacing: 0.3,
                      }}>{t}</span>
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shelf takeover + toast */}
      {step >= 4 && (
        <div style={{
          position: 'absolute', top: 64, left: 0, right: 0, bottom: 0,
          background: REED.paper,
          backgroundImage: PAPER_NOISE, backgroundSize: '240px',
          overflow: 'hidden', animation: 'reedFade .3s ease-out',
        }}>
          <div style={{ padding: '24px 40px', maxWidth: 800, margin: '0 auto' }}>
            <Wordmark size={26}/>
            <div style={{
              fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
              letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6,
              marginBottom: 22,
            }}>your shelf · 248 pieces</div>
            <div style={{
              display: 'flex', gap: 16, padding: '16px 0',
              borderTop: `1px solid ${REED.rule}`,
              borderBottom: `1px dashed ${REED.rule}`,
              animation: 'reedSlideIn .45s cubic-bezier(0.2, 0.9, 0.3, 1)',
            }}>
              <div style={{
                width: 80, height: 100, borderRadius: 8, flexShrink: 0,
                background: `linear-gradient(135deg, ${REED.olive}, oklch(0.45 0.08 130))`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', bottom: 6, right: 8,
                  fontFamily: REED.display, fontSize: 32, fontWeight: 600,
                  color: 'rgba(255,255,255,0.85)', letterSpacing: -1, lineHeight: 1,
                }}>S</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: REED.mono, fontSize: 9, letterSpacing: 0.5,
                  color: REED.inkFaint, textTransform: 'uppercase', marginBottom: 4,
                }}>emergence magazine · 22m · just now</div>
                <div style={{
                  fontFamily: REED.display, fontSize: 18, fontWeight: 600,
                  letterSpacing: -0.3, lineHeight: 1.2, color: REED.ink, marginBottom: 4,
                }}>Soil, silence, and the long half-life of a good fence</div>
                <div style={{
                  fontFamily: REED.sans, fontSize: 12.5, color: REED.inkMuted,
                  lineHeight: 1.5, textWrap: 'pretty',
                }}>A walking essay along a stone boundary in the Scottish borders — what a wall does for a place that nobody's guarding any more.</div>
              </div>
            </div>
          </div>
          {/* Toast */}
          <div style={{
            position: 'absolute', bottom: 28, left: '50%',
            transform: 'translateX(-50%)',
            animation: 'reedToastIn .35s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}>
            <div style={{
              padding: '10px 14px', borderRadius: 999,
              background: REED.ink, color: REED.paper,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: REED.sans, fontSize: 13,
            }}>
              <Icon name="check" size={14} color={REED.terracotta}/>
              <span>Saved to your shelf</span>
              <span style={{ color: REED.inkFaint }}>·</span>
              <span style={{
                fontFamily: REED.mono, fontSize: 11,
                color: REED.paper, opacity: 0.6,
              }}>undo</span>
            </div>
          </div>
        </div>
      )}

      {/* Step dots */}
      <div style={{
        position: 'absolute', top: 8, left: 12,
        display: 'flex', gap: 5, zIndex: 100,
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} style={{
            width: 14, height: 4, borderRadius: 2,
            background: step >= i ? REED.terracotta : 'rgba(0,0,0,0.15)',
            transition: 'background .2s',
          }}/>
        ))}
      </div>
      <button onClick={loop} style={{
        position: 'absolute', bottom: 10, right: 10,
        padding: '4px 10px', fontFamily: REED.mono, fontSize: 10,
        border: `1px solid ${REED.rule}`, background: REED.paperRaised,
        color: REED.inkMuted, borderRadius: 6, cursor: 'pointer',
        letterSpacing: 0.3, zIndex: 100,
      }}>↺ replay</button>
    </div>
  );
}

function FakeArticlePage() {
  return (
    <div style={{
      position: 'absolute', top: 64, left: 0, right: 0, bottom: 0,
      background: '#F4F0E3', overflow: 'hidden',
      padding: '40px 80px',
    }}>
      <div style={{
        maxWidth: 580, margin: '0 auto',
        fontFamily: 'Georgia, serif', color: '#2A2218',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
          color: '#7A6347', marginBottom: 12 }}>— emergence magazine —</div>
        <div style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.1,
          marginBottom: 14, textWrap: 'balance' }}>Soil, silence, and the long half-life of a good fence</div>
        <div style={{ fontSize: 13, color: '#7A6347', marginBottom: 22 }}>M. Hart · April 2026</div>
        {[88, 100, 92, 85, 95, 80].map((w, i) => (
          <div key={i} style={{
            height: 8, width: `${w}%`, background: 'rgba(0,0,0,0.08)',
            borderRadius: 4, marginBottom: 10,
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE — first run
// ─────────────────────────────────────────────────────────────
function EmptyShelf() {
  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto',
      background: REED.paper, color: REED.ink, fontFamily: REED.sans,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
      padding: '60px 60px 80px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Wordmark size={30}/>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
          letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6,
          marginBottom: 40,
        }}>welcome</div>

        <div style={{
          padding: '60px 48px', borderRadius: REED.r.xl,
          background: REED.paperRaised, border: `1px dashed ${REED.rule}`,
          textAlign: 'center', marginBottom: 30,
        }}>
          <EmptyShelfIllustration/>
          <div style={{
            fontFamily: REED.display, fontSize: 34, fontWeight: 600,
            letterSpacing: -0.8, lineHeight: 1.05, marginTop: 22, marginBottom: 12,
            textWrap: 'balance',
          }}>Your shelf is empty.<br/>
            <span style={{ fontStyle: 'italic', color: REED.terracotta }}>Let's change that.</span></div>
          <div style={{
            fontFamily: REED.display, fontSize: 16, fontStyle: 'italic',
            color: REED.inkMuted, maxWidth: 440, margin: '0 auto 28px',
            lineHeight: 1.55, textWrap: 'pretty',
          }}>Save a long read — an essay, a feature, anything worth ten minutes — and the reader and agent will grow into it.</div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
            textAlign: 'left',
          }}>
            <StartCard num="01" label="Install the extension"
              desc="One click from any article you're already reading." cta="Get extension" ic="ext"/>
            <StartCard num="02" label="Paste a URL"
              desc="Drop a link in the bar at the top of the shelf." cta="Open clipboard" ic="url"/>
            <StartCard num="03" label="Import from Pocket"
              desc="Bring your existing list in as a .json or .csv." cta="Import…" ic="download"/>
          </div>
        </div>

        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.6,
          color: REED.inkFaint, textTransform: 'uppercase', marginBottom: 10,
        }}>or try one of these</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SAMPLE_ARTICLES.slice(0, 3).map(a => (
            <div key={a.id} style={{
              padding: '14px 0', borderTop: `1px dashed ${REED.rule}`,
              display: 'flex', gap: 16, alignItems: 'center',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                background: a.color,
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: REED.display, fontSize: 15, fontWeight: 500,
                  letterSpacing: -0.2,
                }}>{a.title}</div>
                <div style={{
                  fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
                  marginTop: 2, letterSpacing: 0.3,
                }}>{a.site} · {a.readMin} min</div>
              </div>
              <button style={{
                padding: '6px 14px', borderRadius: 999,
                background: REED.paperRaised, border: `1px solid ${REED.rule}`,
                color: REED.ink, cursor: 'pointer',
                fontFamily: REED.sans, fontSize: 12,
              }}>Add</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StartCard({ num, label, desc, cta, ic }) {
  return (
    <div style={{
      padding: 16, borderRadius: REED.r.lg,
      background: REED.paper, border: `1px solid ${REED.rule}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: REED.butter, color: REED.terracotta,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={ic} size={13}/></div>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
          letterSpacing: 0.5,
        }}>{num}</div>
      </div>
      <div style={{
        fontFamily: REED.display, fontSize: 15, fontWeight: 600,
        letterSpacing: -0.2, marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: REED.sans, fontSize: 12, color: REED.inkMuted,
        lineHeight: 1.45, marginBottom: 12, textWrap: 'pretty',
      }}>{desc}</div>
      <button style={{
        padding: '5px 12px', borderRadius: 999, border: 'none',
        background: REED.terracotta, color: '#fff',
        fontFamily: REED.sans, fontSize: 11, fontWeight: 500,
        cursor: 'pointer',
      }}>{cta} →</button>
    </div>
  );
}

function EmptyShelfIllustration() {
  // A little warm illustration: a shelf with two tilting books
  return (
    <svg width={140} height={100} viewBox="0 0 140 100" style={{ margin: '0 auto' }}>
      <rect x="6" y="78" width="128" height="6" rx="1" fill={REED.rule}/>
      <rect x="14" y="40" width="18" height="38" fill={REED.terracotta}/>
      <rect x="14" y="45" width="18" height="2" fill="rgba(255,255,255,0.3)"/>
      <rect x="14" y="52" width="18" height="2" fill="rgba(255,255,255,0.3)"/>
      <g transform="translate(42 40) rotate(-8)">
        <rect width="16" height="38" fill={REED.olive}/>
        <rect y="6" width="16" height="2" fill="rgba(255,255,255,0.3)"/>
      </g>
      <rect x="96" y="52" width="30" height="26" rx="2" fill={REED.butter}
        stroke={REED.rule} strokeWidth="1"/>
      <line x1="100" y1="60" x2="120" y2="60" stroke={REED.terracotta} strokeWidth="1.2"/>
      <line x1="100" y1="66" x2="118" y2="66" stroke={REED.inkFaint} strokeWidth="1"/>
      <line x1="100" y1="72" x2="114" y2="72" stroke={REED.inkFaint} strokeWidth="1"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// ERROR / OFFLINE STATES
// ─────────────────────────────────────────────────────────────
function OfflineReader() {
  const article = SAMPLE_ARTICLES[0];
  const palette = { paper: REED.paper, paperDeep: REED.paperDeep, paperRaised: REED.paperRaised,
    ink: REED.ink, inkMuted: REED.inkMuted, inkFaint: REED.inkFaint, rule: REED.rule };

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden',
      background: REED.paper, fontFamily: REED.sans, display: 'flex',
      flexDirection: 'column',
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
    }}>
      {/* Offline banner */}
      <div style={{
        padding: '10px 28px', background: REED.butter,
        borderBottom: `1px solid ${REED.rule}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Icon name="wifiOff" size={14} color={REED.terracotta}/>
        <div style={{
          fontFamily: REED.sans, fontSize: 12.5, color: REED.ink,
        }}>You're offline — reading the cached copy. <span style={{ color: REED.inkMuted }}>Chat and Research will resume when you reconnect.</span></div>
        <div style={{ flex: 1 }}/>
        <button style={{
          padding: '4px 10px', borderRadius: 6, border: `1px solid ${REED.terracotta}`,
          background: 'transparent', color: REED.terracotta,
          fontFamily: REED.sans, fontSize: 11, fontWeight: 500,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
        }}><Icon name="refresh" size={11}/> Retry</button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{
          flex: 1, overflow: 'auto', padding: '40px 28px',
        }}>
          <article style={{ maxWidth: 680, margin: '0 auto',
            fontFamily: REED.serif, fontSize: 18, lineHeight: 1.65, color: REED.ink }}>
            <div style={{
              fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
              textTransform: 'uppercase', color: REED.terracotta, marginBottom: 14,
            }}>{article.site}</div>
            <h1 style={{
              fontFamily: REED.display, fontSize: 44, fontWeight: 600,
              lineHeight: 1.05, letterSpacing: -1.5, margin: '0 0 14px',
              textWrap: 'balance',
            }}>{article.title}</h1>
            <p style={{ fontFamily: REED.display, fontStyle: 'italic',
              color: REED.inkMuted, fontSize: 18, lineHeight: 1.5, marginBottom: 20 }}>
              {article.summary}
            </p>
            <p style={{ margin: 0, textWrap: 'pretty' }}>
              <span style={{ float: 'left', fontFamily: REED.display, fontSize: '3.6em',
                lineHeight: 0.85, marginRight: 8, marginTop: 4,
                color: REED.terracotta, fontWeight: 600 }}>F</span>
              or decades, the bookstore sat at the quiet center of a block's economy — not because books were especially profitable, but because they gave people a reason to stop. When that reason thinned, everything around it thinned too.
            </p>
          </article>
        </div>

        {/* Panel in disabled state */}
        <aside style={{
          width: 400, borderLeft: `1px solid ${REED.rule}`,
          background: palette.paperDeep, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '14px 18px', borderBottom: `1px solid ${REED.rule}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: REED.olive, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5,
            }}><Icon name="flask" size={14} color="#fff"/></div>
            <div style={{
              fontFamily: REED.display, fontSize: 18, fontWeight: 600, letterSpacing: -0.3,
            }}>Research</div>
          </div>
          <div style={{
            flex: 1, padding: 18, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
            textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: REED.butter,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="wifiOff" size={24} color={REED.terracotta}/></div>
            <div style={{
              fontFamily: REED.display, fontSize: 18, fontWeight: 600,
              letterSpacing: -0.3, textWrap: 'balance',
            }}>The agent is sleeping.</div>
            <div style={{
              fontFamily: REED.display, fontStyle: 'italic', fontSize: 14,
              color: REED.inkMuted, lineHeight: 1.5, maxWidth: 280,
              textWrap: 'pretty',
            }}>It needs the network for search_web and the provider API. Your library tools work offline — <span style={{ color: REED.terracotta, textDecoration: 'underline' }}>run local-only</span> to try those.</div>
          </div>
          <div style={{
            padding: 14, borderTop: `1px solid ${REED.rule}`,
            background: REED.paper, opacity: 0.5,
          }}>
            <div style={{
              padding: 8, borderRadius: REED.r.lg,
              background: REED.paperRaised, border: `1px solid ${REED.rule}`,
              fontFamily: REED.sans, fontSize: 13, color: REED.inkFaint,
            }}>What should I research?</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Tool-failure inside the trace — a single failed step with retry
function ErrorTrace() {
  const [retrying, setRetrying] = React.useState(false);
  const palette = { ink: REED.ink, inkMuted: REED.inkMuted, inkFaint: REED.inkFaint,
    rule: REED.rule, paper: REED.paper, paperDeep: REED.paperDeep, paperRaised: REED.paperRaised };
  return (
    <div style={{
      width: '100%', height: '100%', padding: 28, overflow: 'auto',
      background: REED.paperDeep, fontFamily: REED.sans, color: REED.ink,
    }}>
      <div style={{
        maxWidth: 560, margin: '0 auto',
      }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
          textTransform: 'uppercase', color: REED.olive, marginBottom: 4,
        }}>— research in progress —</div>
        <div style={{
          fontFamily: REED.display, fontSize: 22, fontWeight: 600,
          letterSpacing: -0.4, marginBottom: 18,
          textWrap: 'balance',
        }}>"What's the latest on independent bookstores in 2026?"</div>

        <div style={{
          border: `1px solid ${REED.rule}`, borderRadius: REED.r.lg,
          background: REED.paper, overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: `1px solid ${REED.rule}`,
            fontFamily: REED.mono, fontSize: 11, letterSpacing: 0.3,
            color: REED.inkMuted, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Icon name="chevD" size={12}/>
            Agent trace · 3 steps
            <span style={{
              marginLeft: 'auto', color: REED.terracotta,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}><Icon name="warn" size={11} color={REED.terracotta}/> error</span>
          </div>
          <div style={{ padding: '6px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <GoodStep ic="lib" label="Searching your library"
              args='{"q":"bookstores","limit":5}'
              ok="found 3 related pieces"/>
            <GoodStep ic="book" label="Reading saved article"
              args='{"id":"lr-2024-11-bookstores"}'
              ok="4,320 words · pulled"/>
            <div style={{
              padding: 12, borderRadius: 8,
              background: 'oklch(0.96 0.04 40)',
              border: `1px solid ${REED.terracotta}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Icon name="warn" size={13} color={REED.terracotta}/>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: REED.sans, fontSize: 12, fontWeight: 500, color: REED.ink,
                  }}>Searching the web — failed</div>
                  <div style={{
                    fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint, marginTop: 2,
                  }}>{'{"q":"independent bookstores 2026"}'}</div>
                  <div style={{
                    marginTop: 8, padding: 8, borderRadius: 6,
                    background: REED.paper, border: `1px dashed ${REED.terracotta}`,
                    fontFamily: REED.mono, fontSize: 10.5, color: REED.terracotta,
                    lineHeight: 1.5,
                  }}>TavilyAPIError: 401 Unauthorized · key rejected<br/>
                    <span style={{ color: REED.inkMuted }}>at tools/search_web.ts:42</span></div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => {
                      setRetrying(true);
                      setTimeout(() => setRetrying(false), 1500);
                    }} style={{
                      padding: '5px 10px', borderRadius: 6, border: 'none',
                      background: REED.terracotta, color: '#fff',
                      fontFamily: REED.sans, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {retrying ? (<><TypingDots color="#fff"/> retrying</>) : (<><Icon name="refresh" size={11} color="#fff"/> Retry</>)}
                    </button>
                    <button style={{
                      padding: '5px 10px', borderRadius: 6,
                      background: REED.paperRaised, color: REED.ink,
                      border: `1px solid ${REED.rule}`,
                      fontFamily: REED.sans, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    }}>Update key</button>
                    <button style={{
                      padding: '5px 10px', borderRadius: 6,
                      background: 'transparent', color: REED.inkMuted,
                      border: `1px solid ${REED.rule}`,
                      fontFamily: REED.sans, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    }}>Skip & answer without web</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoodStep({ ic, label, args, ok }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={ic} size={13} color={REED.olive}/>
        <div style={{ fontFamily: REED.sans, fontSize: 12, fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{
        fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint, marginLeft: 21,
      }}>{args}</div>
      <div style={{
        fontFamily: REED.mono, fontSize: 10, color: REED.olive,
        marginLeft: 21, marginTop: 2, display: 'flex', gap: 5,
      }}><span>✓</span><span>{ok}</span></div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AGENT TRACE VARIATIONS — compact, expanded, thinking
// Side-by-side mini cards showing the same moment in three modes
// ─────────────────────────────────────────────────────────────
function TraceVariations() {
  return (
    <div style={{
      width: '100%', height: '100%', background: REED.paperDeep,
      padding: 28, overflow: 'auto', fontFamily: REED.sans,
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
          textTransform: 'uppercase', color: REED.terracotta, marginBottom: 4,
        }}>— trace verbosity —</div>
        <div style={{
          fontFamily: REED.display, fontSize: 28, fontWeight: 600,
          letterSpacing: -0.5, marginBottom: 6,
        }}>Three ways to watch the agent think.</div>
        <div style={{
          fontFamily: REED.display, fontSize: 15, fontStyle: 'italic',
          color: REED.inkMuted, marginBottom: 28, maxWidth: 700,
          lineHeight: 1.5, textWrap: 'pretty',
        }}>Same research run, three levels of detail. The user picks one in Settings; we default to Expanded.</div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        }}>
          <TraceCard mode="Compact"
            desc="One line per tool. Quiet background mode.">
            <CompactTrace/>
          </TraceCard>
          <TraceCard mode="Expanded" pinned
            desc="Arguments + result previews. The default.">
            <ExpandedTrace/>
          </TraceCard>
          <TraceCard mode="Thinking"
            desc="Reveals the model's reasoning between tool calls.">
            <ThinkingTrace/>
          </TraceCard>
        </div>
      </div>
    </div>
  );
}

function TraceCard({ mode, desc, pinned, children }) {
  return (
    <div style={{
      border: `1px solid ${pinned ? REED.terracotta : REED.rule}`,
      borderRadius: REED.r.lg, background: REED.paper,
      overflow: 'hidden', position: 'relative',
      boxShadow: pinned ? '0 6px 16px rgba(217,98,70,0.08)' : 'none',
    }}>
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${REED.rule}`,
        display: 'flex', alignItems: 'baseline', gap: 10,
      }}>
        <div style={{ fontFamily: REED.display, fontSize: 16, fontWeight: 600,
          letterSpacing: -0.2 }}>{mode}</div>
        {pinned && <div style={{
          fontFamily: REED.mono, fontSize: 9, letterSpacing: 0.6,
          color: REED.terracotta, textTransform: 'uppercase',
          padding: '2px 6px', borderRadius: 4, background: 'oklch(0.95 0.04 40)',
        }}>default</div>}
        <div style={{ flex: 1 }}/>
      </div>
      <div style={{
        padding: '10px 14px', fontFamily: REED.sans, fontSize: 11.5,
        color: REED.inkMuted, borderBottom: `1px dashed ${REED.rule}`,
        lineHeight: 1.45,
      }}>{desc}</div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function CompactTrace() {
  const lines = [
    ['lib', 'search_library', '3 hits'],
    ['book', 'read_article', '4,320 words'],
    ['globe', 'search_web', '3 results'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lines.map(([ic, name, result], i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 0',
        }}>
          <Icon name={ic} size={12} color={REED.olive}/>
          <span style={{
            fontFamily: REED.mono, fontSize: 11, color: REED.ink,
          }}>{name}</span>
          <span style={{
            marginLeft: 'auto', fontFamily: REED.mono, fontSize: 10,
            color: REED.inkFaint,
          }}>{result}</span>
        </div>
      ))}
      <div style={{
        fontFamily: REED.display, fontSize: 13, fontStyle: 'italic',
        color: REED.ink, lineHeight: 1.6, marginTop: 10, textWrap: 'pretty',
      }}>Your library already has the best context. Two saved pieces cover this; recent web coverage mostly agrees.</div>
    </div>
  );
}

function ExpandedTrace() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        fontFamily: REED.display, fontStyle: 'italic', fontSize: 12.5,
        color: REED.inkMuted, borderLeft: `2px solid ${REED.olive}`,
        paddingLeft: 10, textWrap: 'pretty',
      }}>I'll check your library first, then the web.</div>
      <div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name="lib" size={12} color={REED.olive}/>
          <span style={{ fontFamily: REED.sans, fontSize: 11.5, fontWeight: 500 }}>Searching library</span>
        </div>
        <div style={{
          fontFamily: REED.mono, fontSize: 9.5, color: REED.inkFaint, marginLeft: 18,
        }}>{'{"q":"bookstores","limit":5}'}</div>
        <div style={{
          fontFamily: REED.mono, fontSize: 9.5, color: REED.olive, marginLeft: 18,
        }}>✓ 3 related: "quiet collapse…", "Paris bookshops…"</div>
      </div>
      <div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name="globe" size={12} color={REED.olive}/>
          <span style={{ fontFamily: REED.sans, fontSize: 11.5, fontWeight: 500 }}>Searching web</span>
        </div>
        <div style={{
          fontFamily: REED.mono, fontSize: 9.5, color: REED.inkFaint, marginLeft: 18,
        }}>{'{"q":"independent bookstores 2026"}'}</div>
        <div style={{
          fontFamily: REED.mono, fontSize: 9.5, color: REED.olive, marginLeft: 18,
        }}>✓ NYT, Atlantic, Axios — Apr 2026</div>
      </div>
    </div>
  );
}

function ThinkingTrace() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Thought>The user's library likely already covers this — cheaper to check there first.</Thought>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icon name="lib" size={12} color={REED.olive}/>
        <span style={{ fontFamily: REED.mono, fontSize: 10.5 }}>search_library("bookstores")</span>
      </div>
      <Thought>Three hits, most recent from Nov 2024. Good but stale — the user asked about 2026 specifically. Need the web.</Thought>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icon name="globe" size={12} color={REED.olive}/>
        <span style={{ fontFamily: REED.mono, fontSize: 10.5 }}>search_web("…2026")</span>
      </div>
      <Thought>Enough. I can reconcile the saved piece's thesis with the new reporting and flag where they disagree.</Thought>
    </div>
  );
}

function Thought({ children }) {
  return (
    <div style={{
      padding: '6px 10px', borderRadius: 6, background: REED.plumSoft,
      display: 'flex', gap: 8, alignItems: 'flex-start',
    }}>
      <Icon name="brain" size={11} color={REED.plum}/>
      <div style={{
        fontFamily: REED.display, fontStyle: 'italic', fontSize: 12,
        color: REED.ink, lineHeight: 1.5, textWrap: 'pretty', flex: 1,
      }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// animations (scoped keyframes)
// ─────────────────────────────────────────────────────────────
const flowCSS = `
@keyframes reedPopIn { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes reedFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes reedSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes reedToastIn { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
`;

if (typeof document !== 'undefined' && !document.getElementById('reed-flow-css')) {
  const s = document.createElement('style');
  s.id = 'reed-flow-css';
  s.textContent = flowCSS;
  document.head.appendChild(s);
}

Object.assign(window, {
  SaveFlow, EmptyShelf, OfflineReader, ErrorTrace, TraceVariations,
});
