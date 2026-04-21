// Settings — agent config, storage, export. Desktop layout.
// Stays fully on-brand: paper bg, editorial headings, monospace labels.

function Settings({ onBack = () => {}, initialTab = 'agent' }) {
  const [tab, setTab] = React.useState(initialTab);
  const [state, setState] = React.useState({
    cohereKey: 'sk-co-••••••••••••3f9a',
    tavilyKey: 'tvly-••••••7c22',
    claudeKey: '',
    model: 'command-a-03-2025',
    tools: { search_library: true, read_article: true, search_web: true, chat: true },
    storagePath: '~/Library/Application Support/BrowseFellow',
    libraryCount: 247,
    storageBytes: 38_400_000,
    autoSaveTags: true,
    autoSummary: true,
    theme: 'light',
    syncOn: false,
  });

  const update = (k, v) => setState(s => ({ ...s, [k]: v }));

  return (
    <div style={{
      minHeight: '100%', height: '100%', overflow: 'auto',
      background: REED.paper, color: REED.ink, fontFamily: REED.sans,
      backgroundImage: PAPER_NOISE, backgroundSize: '240px',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: `${REED.paper}ee`, backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${REED.rule}`,
      }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 40px', height: 56,
          display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={onBack} style={{
            width: 34, height: 34, border: 'none', background: 'transparent',
            color: REED.inkMuted, cursor: 'pointer', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="back" size={18}/></button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              fontFamily: REED.display, fontSize: 22, fontWeight: 600,
              letterSpacing: -0.5,
            }}>Settings</span>
            <span style={{
              fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
              textTransform: 'uppercase', letterSpacing: 0.6,
            }}>· {sectionLabel(tab)}</span>
          </div>
          <div style={{ flex: 1 }}/>
          <div style={{
            fontFamily: REED.mono, fontSize: 10, color: REED.olive,
            display: 'flex', alignItems: 'center', gap: 6, letterSpacing: 0.3,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: REED.olive }}/>
            changes saved
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: 1040, margin: '0 auto', padding: '32px 40px 80px',
        display: 'grid', gridTemplateColumns: '200px 1fr', gap: 40,
      }}>
        {/* Sidebar */}
        <nav style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
          {[
            ['agent', 'Agent', 'brain'],
            ['tools', 'Tools', 'sparkle'],
            ['keys',  'API keys', 'key'],
            ['storage', 'Storage', 'folder'],
            ['reading', 'Reading', 'book'],
            ['about', 'About', 'info'],
          ].map(([k, label, ic]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', marginBottom: 2, borderRadius: 8, border: 'none',
              cursor: 'pointer', textAlign: 'left',
              background: tab === k ? REED.paperRaised : 'transparent',
              color: tab === k ? REED.ink : REED.inkMuted,
              fontFamily: REED.sans, fontSize: 13,
              fontWeight: tab === k ? 500 : 400,
              border: `1px solid ${tab === k ? REED.rule : 'transparent'}`,
            }}>
              <Icon name={ic} size={14} color={tab === k ? REED.terracotta : 'currentColor'}/>
              {label}
            </button>
          ))}
        </nav>

        {/* Panel */}
        <div style={{ maxWidth: 640 }}>
          {tab === 'agent' && <AgentPanel state={state} update={update}/>}
          {tab === 'tools' && <ToolsPanel state={state} update={update}/>}
          {tab === 'keys' && <KeysPanel state={state} update={update}/>}
          {tab === 'storage' && <StoragePanel state={state} update={update}/>}
          {tab === 'reading' && <ReadingPanel state={state} update={update}/>}
          {tab === 'about' && <AboutPanel/>}
        </div>
      </div>
    </div>
  );
}

function sectionLabel(t) {
  return ({ agent: 'Agent', tools: 'Tools', keys: 'API keys',
    storage: 'Storage', reading: 'Reading', about: 'About' })[t] || '';
}

// ─────────────────────────────────────────────────────────────
// Section primitives
// ─────────────────────────────────────────────────────────────
function SectionTitle({ kicker, title, sub }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
        textTransform: 'uppercase', color: REED.terracotta, marginBottom: 6,
      }}>{kicker}</div>
      <div style={{
        fontFamily: REED.display, fontSize: 28, fontWeight: 600,
        letterSpacing: -0.5, marginBottom: 6, textWrap: 'balance',
      }}>{title}</div>
      {sub && <div style={{
        fontFamily: REED.display, fontStyle: 'italic', fontSize: 15,
        color: REED.inkMuted, lineHeight: 1.5, textWrap: 'pretty',
      }}>{sub}</div>}
    </div>
  );
}

function Field({ label, hint, children, mono }) {
  return (
    <div style={{
      padding: '16px 0', borderBottom: `1px dashed ${REED.rule}`,
      display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24,
      alignItems: 'start',
    }}>
      <div>
        <div style={{
          fontFamily: REED.sans, fontSize: 13, fontWeight: 500, color: REED.ink,
        }}>{label}</div>
        {hint && <div style={{
          fontFamily: REED.sans, fontSize: 11.5, color: REED.inkMuted,
          lineHeight: 1.45, marginTop: 4, textWrap: 'pretty',
        }}>{hint}</div>}
      </div>
      <div style={{ fontFamily: mono ? REED.mono : REED.sans }}>{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, mono, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: 8,
        border: `1px solid ${REED.rule}`, background: REED.paperRaised,
        fontFamily: mono ? REED.mono : REED.sans, fontSize: 13,
        color: REED.ink, outline: 'none',
      }}/>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 40, height: 22, borderRadius: 999, border: 'none',
      background: on ? REED.olive : REED.rule,
      position: 'relative', cursor: 'pointer', padding: 0,
      transition: 'background .18s',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left .18s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}/>
    </button>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', padding: 3, borderRadius: 8,
      background: REED.paperDeep, border: `1px solid ${REED.rule}`,
    }}>
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: value === k ? REED.paperRaised : 'transparent',
          color: value === k ? REED.ink : REED.inkMuted,
          fontFamily: REED.sans, fontSize: 12, fontWeight: 500,
          boxShadow: value === k ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
        }}>{label}</button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Panels
// ─────────────────────────────────────────────────────────────
function AgentPanel({ state, update }) {
  return (
    <div>
      <SectionTitle kicker="the curious one"
        title="Research agent"
        sub="A tool-using loop that searches your library, reads saved articles, and consults the live web. It cites everything and won't assert without a source."/>

      <Field label="Provider" hint="Which model powers the agent loop.">
        <Segmented value="cohere" onChange={() => {}} options={[
          ['cohere', 'Cohere'],
          ['claude', 'Claude'],
          ['local', 'Local (Ollama)'],
        ]}/>
      </Field>

      <Field label="Model" hint="Command A is Cohere's tool-use model. Haiku is cheapest for chat.">
        <select value={state.model} onChange={e => update('model', e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, border: `1px solid ${REED.rule}`,
            background: REED.paperRaised, fontFamily: REED.mono, fontSize: 12,
            color: REED.ink, minWidth: 260,
          }}>
          <option>command-a-03-2025</option>
          <option>command-r-plus</option>
          <option>claude-haiku-4-5</option>
          <option>gpt-5-mini</option>
        </select>
      </Field>

      <Field label="Max tool calls"
        hint="How many tools the agent can invoke before it must answer.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="range" min={1} max={10} defaultValue={6}
            style={{ accentColor: REED.terracotta, width: 200 }}/>
          <div style={{ fontFamily: REED.mono, fontSize: 13, minWidth: 24 }}>6</div>
        </div>
      </Field>

      <Field label="Trace verbosity"
        hint="Compact hides tool arguments. Expanded shows the full JSON. Thinking reveals the model's reasoning between tool calls.">
        <Segmented value="expanded" onChange={() => {}} options={[
          ['compact', 'Compact'],
          ['expanded', 'Expanded'],
          ['thinking', 'Thinking'],
        ]}/>
      </Field>

      <Field label="Auto-run on open"
        hint="When you open an article, the agent pre-fetches 2–3 related pieces from your library.">
        <Toggle on={true} onChange={() => {}}/>
      </Field>
    </div>
  );
}

function ToolsPanel({ state, update }) {
  const tools = [
    ['search_library', 'Search library', 'lib',
      'Full-text + semantic search across your 247 saved pieces.', 'on-device'],
    ['read_article', 'Read article', 'book',
      'Pull the full text of a saved article into the context.', 'on-device'],
    ['search_web', 'Search web', 'globe',
      'Live search via Tavily. Requires API key.', 'network'],
    ['chat', 'Chat with article', 'chat',
      'The reader-side conversational tool (uses Haiku by default).', 'network'],
  ];
  return (
    <div>
      <SectionTitle kicker="capabilities"
        title="Tools the agent can use"
        sub="Toggle any tool off and the agent will route around it. Turning search_web off keeps the loop fully local."/>
      {tools.map(([k, name, ic, desc, where]) => (
        <div key={k} style={{
          padding: 16, marginBottom: 10, borderRadius: REED.r.lg,
          background: REED.paperRaised, border: `1px solid ${REED.rule}`,
          display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 14,
          alignItems: 'center',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: state.tools[k] ? REED.butter : REED.rule,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: state.tools[k] ? REED.terracotta : REED.inkFaint,
          }}><Icon name={ic} size={18}/></div>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
            }}>
              <span style={{ fontFamily: REED.sans, fontSize: 14, fontWeight: 500 }}>{name}</span>
              <span style={{
                fontFamily: REED.mono, fontSize: 9, letterSpacing: 0.3,
                color: where === 'on-device' ? REED.olive : REED.inkMuted,
                padding: '2px 6px', borderRadius: 4,
                background: where === 'on-device' ? REED.oliveSoft : REED.paperDeep,
                textTransform: 'uppercase',
              }}>{where}</span>
            </div>
            <div style={{
              fontFamily: REED.sans, fontSize: 12, color: REED.inkMuted,
              lineHeight: 1.45, textWrap: 'pretty',
            }}>{desc}</div>
          </div>
          <Toggle on={state.tools[k]}
            onChange={v => update('tools', { ...state.tools, [k]: v })}/>
        </div>
      ))}
    </div>
  );
}

function KeysPanel({ state, update }) {
  return (
    <div>
      <SectionTitle kicker="credentials"
        title="API keys"
        sub="Stored locally in ~/.browsefellow/keys.enc, encrypted with the OS keychain. Never sent to our servers."/>

      <Field label="Cohere" mono
        hint="Powers the Research agent. Free tier is generous.">
        <TextInput value={state.cohereKey} mono
          onChange={v => update('cohereKey', v)}/>
      </Field>
      <Field label="Tavily" mono
        hint="Powers search_web. Optional — disable the tool to run local-only.">
        <TextInput value={state.tavilyKey} mono
          onChange={v => update('tavilyKey', v)}/>
      </Field>
      <Field label="Anthropic" mono
        hint="Optional — used if you pick Claude as the agent provider.">
        <TextInput value={state.claudeKey} mono placeholder="sk-ant-…"
          onChange={v => update('claudeKey', v)}/>
      </Field>

      <div style={{
        marginTop: 24, padding: 14, borderRadius: REED.r.lg,
        background: REED.butter + '77', border: `1px solid ${REED.rule}`,
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <Icon name="info" size={16} color={REED.terracotta}/>
        <div style={{
          fontFamily: REED.display, fontStyle: 'italic', fontSize: 13,
          color: REED.ink, lineHeight: 1.5, textWrap: 'pretty',
        }}>Keys are validated on save. We run one dry tool call per provider and tell you if something fails — no guessing.</div>
      </div>
    </div>
  );
}

function StoragePanel({ state, update }) {
  const pct = 13;
  return (
    <div>
      <SectionTitle kicker="local-first"
        title="Storage"
        sub="Your library lives on disk in a single SQLite file. You can move it, back it up, or walk away with it."/>

      <Field label="Library path" mono
        hint="The SQLite + content directory. Change to move the library.">
        <div style={{ display: 'flex', gap: 6 }}>
          <TextInput value={state.storagePath} mono onChange={v => update('storagePath', v)}/>
          <button style={{
            padding: '8px 12px', borderRadius: 8, border: `1px solid ${REED.rule}`,
            background: REED.paperRaised, cursor: 'pointer',
            fontFamily: REED.sans, fontSize: 12, color: REED.ink,
          }}>Browse…</button>
        </div>
      </Field>

      <Field label="What's in there" hint="As of right now.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat big="247" label="articles"/>
          <Stat big="38.4 MB" label="on disk"/>
          <Stat big="182" label="read"/>
          <Stat big="11" label="favorites"/>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
            letterSpacing: 0.5, marginBottom: 6,
          }}>Disk usage — {pct}% of 300 MB soft cap</div>
          <div style={{
            height: 8, borderRadius: 4, background: REED.rule, overflow: 'hidden',
          }}>
            <div style={{
              width: `${pct}%`, height: '100%', background: REED.terracotta,
            }}/>
          </div>
        </div>
      </Field>

      <Field label="Export"
        hint="Walk away with your library whenever you want.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ExportBtn icon="download">Export as JSON</ExportBtn>
          <ExportBtn icon="download">Export as Markdown</ExportBtn>
          <ExportBtn icon="download">Export to EPUB</ExportBtn>
        </div>
      </Field>

      <Field label="Sync"
        hint="Optional end-to-end encrypted sync across your devices. Off by default.">
        <Toggle on={state.syncOn} onChange={v => update('syncOn', v)}/>
      </Field>

      <Field label="Danger zone"
        hint="Wipe the library and start over. Exports are not deleted.">
        <button style={{
          padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
          border: `1px solid ${REED.terracotta}`, background: 'transparent',
          color: REED.terracotta, fontFamily: REED.sans, fontSize: 12, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}><Icon name="trash" size={13}/> Reset library</button>
      </Field>
    </div>
  );
}

function Stat({ big, label }) {
  return (
    <div style={{
      padding: 12, borderRadius: REED.r.md,
      background: REED.paperRaised, border: `1px solid ${REED.rule}`,
    }}>
      <div style={{
        fontFamily: REED.display, fontSize: 26, fontWeight: 600, letterSpacing: -0.5,
        color: REED.ink, lineHeight: 1,
      }}>{big}</div>
      <div style={{
        fontFamily: REED.mono, fontSize: 10, color: REED.inkFaint,
        marginTop: 4, letterSpacing: 0.3, textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}

function ExportBtn({ icon, children }) {
  return (
    <button style={{
      padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
      border: `1px solid ${REED.rule}`, background: REED.paperRaised,
      color: REED.ink, fontFamily: REED.sans, fontSize: 12, fontWeight: 500,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}><Icon name={icon} size={13}/> {children}</button>
  );
}

function ReadingPanel({ state, update }) {
  return (
    <div>
      <SectionTitle kicker="reading mode"
        title="The reader"
        sub="Defaults for every article you open. You can still override per-piece."/>

      <Field label="Default theme">
        <Segmented value={state.theme} onChange={v => update('theme', v)} options={[
          ['light', 'Light'], ['sepia', 'Sepia'], ['dark', 'Dark'],
        ]}/>
      </Field>

      <Field label="Auto-tag on save"
        hint="When you save a piece, the agent proposes tags from its content. You can accept or edit.">
        <Toggle on={state.autoSaveTags} onChange={v => update('autoSaveTags', v)}/>
      </Field>

      <Field label="Auto-summarize"
        hint="Generate the TL;DR automatically when a piece is first opened.">
        <Toggle on={state.autoSummary} onChange={v => update('autoSummary', v)}/>
      </Field>

      <Field label="Estimated reading speed"
        hint="Used to show the 'X min' estimate on every card.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="range" min={180} max={400} defaultValue={240}
            style={{ accentColor: REED.terracotta, width: 240 }}/>
          <div style={{ fontFamily: REED.mono, fontSize: 12, minWidth: 80 }}>240 wpm</div>
        </div>
      </Field>
    </div>
  );
}

function AboutPanel() {
  return (
    <div>
      <SectionTitle kicker="the small print"
        title="About BrowseFellow"
        sub={null}/>

      <div style={{
        fontFamily: REED.display, fontSize: 15, lineHeight: 1.65,
        color: REED.ink, textWrap: 'pretty', marginBottom: 22,
      }}>
        Version 0.8.2 · built on SQLite 3.47, Readability.js, and your own good taste.
      </div>

      <div style={{
        padding: 20, borderRadius: REED.r.lg, background: REED.paperRaised,
        border: `1px solid ${REED.rule}`, marginBottom: 14,
      }}>
        <div style={{
          fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.5,
          textTransform: 'uppercase', color: REED.inkFaint, marginBottom: 8,
        }}>system</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px',
          fontFamily: REED.mono, fontSize: 12,
        }}>
          <div><span style={{ color: REED.inkFaint }}>agent</span> · online</div>
          <div><span style={{ color: REED.inkFaint }}>tavily</span> · online</div>
          <div><span style={{ color: REED.inkFaint }}>claude</span> · not configured</div>
          <div><span style={{ color: REED.inkFaint }}>library</span> · 247 pieces</div>
          <div><span style={{ color: REED.inkFaint }}>sync</span> · off</div>
          <div><span style={{ color: REED.inkFaint }}>last save</span> · 6 min ago</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <ExportBtn icon="refresh">Check for updates</ExportBtn>
        <ExportBtn icon="info">Release notes</ExportBtn>
      </div>
    </div>
  );
}

Object.assign(window, { Settings });
