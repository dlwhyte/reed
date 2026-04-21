// ChatPane + ResearchPane — streamed interactive panels.
// Uses window.claude.complete when online; falls back to scripted streams
// so the prototype demos nicely without an API.

// Slow typewriter that plays a list of chunks into a setter
async function typeStream(chunks, onChunk, baseDelay = 14) {
  for (const c of chunks) {
    onChunk(c);
    await new Promise(r => setTimeout(r, baseDelay + Math.random() * baseDelay * 2));
  }
}

// Split text into realistic streaming chunks (words + punctuation)
function intoChunks(text) {
  // chunk by 2-4 chars to feel like a model stream
  const out = [];
  let i = 0;
  while (i < text.length) {
    const n = 2 + Math.floor(Math.random() * 4);
    out.push(text.slice(i, i + n));
    i += n;
  }
  return out;
}

// ───────────────────────────────────────────────────────────
// Chat Pane
// ───────────────────────────────────────────────────────────
function ChatPane({ article, palette }) {
  const [msgs, setMsgs] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef(null);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  const suggestions = [
    'Summarize in bullet points',
    'What\'s the main argument?',
    'What would a skeptic say?',
  ];

  async function send(q) {
    q = (q || input).trim();
    if (!q || busy) return;
    setInput('');
    const history = msgs;
    setMsgs([...history, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    setBusy(true);

    let reply = null;
    try {
      if (window.claude && window.claude.complete) {
        const sys = `You are a reading companion for an article titled "${article.title}" by ${article.author} (${article.site}). The TL;DR is: ${article.tldr}. Respond in 2-4 short paragraphs, warm and literary, no bullet spam unless asked.`;
        const r = await Promise.race([
          window.claude.complete({ messages: [
            { role: 'user', content: sys + '\n\nUser: ' + q },
          ]}),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
        ]);
        if (typeof r === 'string' && r.trim()) reply = r.trim();
      }
    } catch (e) { /* fall through */ }
    if (!reply) reply = mockReplyFor(q, article);

    await typeStream(intoChunks(reply), (chunk) => {
      setMsgs(m => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + chunk };
        return copy;
      });
    }, 6);
    setBusy(false);
  }

  return (
    <>
      <div ref={listRef} style={{
        flex: 1, overflowY: 'auto', padding: '18px 18px 8px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {msgs.length === 0 && (
          <div style={{
            padding: 14, borderRadius: REED.r.lg,
            background: REED.plumSoft, border: `1px dashed ${REED.plum}`,
          }}>
            <div style={{
              fontFamily: REED.display, fontSize: 15, fontStyle: 'italic',
              color: palette.ink, lineHeight: 1.5, textWrap: 'pretty',
            }}>Ask me anything about this article. I've read it so you don't have to re-skim.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                  background: `${palette.paper}cc`,
                  border: `1px solid ${palette.rule}`,
                  fontFamily: REED.sans, fontSize: 13, color: palette.ink,
                  cursor: 'pointer',
                }}>
                  <span style={{ color: REED.plum, marginRight: 6 }}>›</span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <Bubble key={i} role={m.role} palette={palette}
            busy={busy && i === msgs.length - 1}>{m.content}</Bubble>
        ))}
        <div ref={endRef} />
      </div>

      <Composer
        value={input} onChange={setInput} onSend={() => send()}
        busy={busy} accent={REED.plum} palette={palette}
        placeholder="Ask about this article…" />
    </>
  );
}

function Bubble({ role, children, busy, palette }) {
  const isUser = role === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '88%',
      padding: '10px 14px',
      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
      background: isUser ? REED.plum : `${palette.paper}ee`,
      color: isUser ? '#fff' : palette.ink,
      border: isUser ? 'none' : `1px solid ${palette.rule}`,
      fontFamily: REED.sans, fontSize: 14, lineHeight: 1.55,
      textWrap: 'pretty',
    }}>
      {children || (busy ? <TypingDots color={REED.plum}/> : null)}
      {busy && children && (
        <span style={{
          display: 'inline-block', width: 6, height: 14,
          background: palette.inkMuted, marginLeft: 3, verticalAlign: -2,
          animation: 'reedBlink 1s infinite',
        }}/>
      )}
    </div>
  );
}

function TypingDots({ color }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: color,
          animation: `reedDot 1.2s ${i*0.15}s infinite ease-in-out`,
          opacity: 0.3,
        }}/>
      ))}
    </span>
  );
}

function Composer({ value, onChange, onSend, busy, accent, palette, placeholder }) {
  return (
    <div style={{
      padding: 14, borderTop: `1px solid ${palette.rule}`,
      background: palette.paperDeep,
    }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-end',
        padding: 8, borderRadius: REED.r.lg,
        background: palette.paperRaised,
        border: `1px solid ${palette.rule}`,
      }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
          }}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: REED.sans, fontSize: 14, color: palette.ink,
            resize: 'none', padding: '6px 8px',
            minHeight: 22, maxHeight: 120,
          }}
        />
        <button onClick={onSend} disabled={busy || !value.trim()} style={{
          width: 34, height: 34, borderRadius: 8, border: 'none',
          background: value.trim() && !busy ? accent : palette.rule,
          color: '#fff', cursor: value.trim() && !busy ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name={busy ? 'sparkle' : 'send'} size={15} color="#fff" />
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Research Pane — plan → tools → streamed answer with cites
// ───────────────────────────────────────────────────────────
function ResearchPane({ article, palette }) {
  const [q, setQ] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [trace, setTrace] = React.useState([]);
  const [answer, setAnswer] = React.useState('');
  const [sources, setSources] = React.useState([]);
  const [traceOpen, setTraceOpen] = React.useState(true);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [trace, answer]);

  const suggestions = [
    'Find counter-arguments in my library',
    'Latest news on this topic',
    'What have I already read on this?',
  ];

  async function run(question) {
    question = (question || q).trim();
    if (!question || busy) return;
    setQ('');
    setBusy(true);
    setTraceOpen(true);
    setTrace([]);
    setAnswer('');
    setSources([]);

    const script = researchScriptFor(question, article);

    for (const step of script.trace) {
      await new Promise(r => setTimeout(r, step.delay || 450));
      setTrace(t => [...t, step]);
    }

    await new Promise(r => setTimeout(r, 280));
    setSources(script.sources);
    setTraceOpen(false);

    // Try Claude for the answer body; otherwise use the scripted one.
    let body = null;
    try {
      if (window.claude && window.claude.complete) {
        const srcList = script.sources.map(s =>
          `[${s.n}] ${s.label} (${s.kind === 'web' ? s.domain : 'your library'})`).join('\n');
        const prompt = `You are a research agent for a reader's personal library. You just ran these steps and have these sources:\n\n${srcList}\n\nThe article in view: "${article.title}" — ${article.tldr}\n\nUser question: "${question}"\n\nAnswer in 2-4 short paragraphs. Cite sources inline like [1], [2]. Be warm and specific, not salesy.`;
        const r = await Promise.race([
          window.claude.complete({ messages: [{ role: 'user', content: prompt }] }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
        ]);
        if (typeof r === 'string' && r.trim()) body = r.trim();
      }
    } catch (e) { /* fall through */ }
    if (!body) body = script.body;

    await typeStream(intoChunks(body), (c) => setAnswer(a => a + c), 10);
    setBusy(false);
  }

  const hasContent = trace.length || answer;

  return (
    <>
      <div ref={listRef} style={{
        flex: 1, overflowY: 'auto', padding: '18px 18px 8px',
      }}>
        {!hasContent && !busy && (
          <div style={{
            padding: 14, borderRadius: REED.r.lg,
            background: REED.oliveSoft, border: `1px dashed ${REED.olive}`,
          }}>
            <div style={{
              fontFamily: REED.display, fontSize: 15, fontStyle: 'italic',
              color: palette.ink, lineHeight: 1.5, marginBottom: 10,
              textWrap: 'pretty',
            }}>Ask me to research. I can dig through your library and the live web, cite every source, and not make things up.</div>
            <div style={{
              fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.4,
              color: REED.olive, textTransform: 'uppercase', marginBottom: 8,
            }}>tools i'll use</div>
            <ul style={{
              margin: '0 0 14px 0', paddingLeft: 0, listStyle: 'none',
              fontFamily: REED.sans, fontSize: 12.5, color: palette.inkMuted,
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="lib" size={13} color={REED.olive}/> search_library — your 247 saved pieces
              </li>
              <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="book" size={13} color={REED.olive}/> read_article — pull a full article
              </li>
              <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="globe" size={13} color={REED.olive}/> search_web — live Tavily search
              </li>
            </ul>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => run(s)} style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                  background: `${palette.paper}cc`,
                  border: `1px solid ${palette.rule}`,
                  fontFamily: REED.sans, fontSize: 13, color: palette.ink,
                  cursor: 'pointer',
                }}>
                  <span style={{ color: REED.olive, marginRight: 6 }}>›</span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {trace.length > 0 && (
          <TraceBox trace={trace} open={traceOpen}
            onToggle={() => setTraceOpen(v => !v)}
            palette={palette} busy={busy && !answer} />
        )}

        {(answer || (busy && trace.length > 0 && !trace.some(s => s.kind === 'plan'))) && (
          <div style={{ marginTop: 14 }}>
            <AnswerBody text={answer} sources={sources} palette={palette} busy={busy}/>
            {sources.length > 0 && <SourcesList sources={sources} palette={palette} />}
          </div>
        )}
      </div>

      <Composer
        value={q} onChange={setQ} onSend={() => run()}
        busy={busy} accent={REED.olive} palette={palette}
        placeholder="What should I research?" />
    </>
  );
}

function TraceBox({ trace, open, onToggle, palette, busy }) {
  const icons = { search_library: 'lib', read_article: 'book', search_web: 'globe' };
  const labels = {
    search_library: 'Searching your library',
    read_article: 'Reading saved article',
    search_web: 'Searching the web',
  };
  return (
    <div style={{
      border: `1px solid ${palette.rule}`, borderRadius: REED.r.lg,
      background: `${palette.paper}aa`,
      overflow: 'hidden',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', border: 'none', background: 'transparent',
        cursor: 'pointer', color: palette.inkMuted,
        fontFamily: REED.mono, fontSize: 11, letterSpacing: 0.3,
        textAlign: 'left',
      }}>
        <Icon name={open ? 'chevD' : 'chevRs'} size={12}/>
        <span>Agent trace · {trace.length} steps</span>
        {busy && <span style={{ marginLeft: 'auto', color: REED.olive }}><TypingDots color={REED.olive}/></span>}
      </button>
      {open && (
        <div style={{
          padding: '4px 14px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {trace.map((s, i) => (
            <TraceStep key={i} step={s} icons={icons} labels={labels} palette={palette}/>
          ))}
        </div>
      )}
    </div>
  );
}

function TraceStep({ step, icons, labels, palette }) {
  if (step.kind === 'plan') {
    return (
      <div style={{
        fontFamily: REED.display, fontStyle: 'italic',
        fontSize: 13, color: palette.inkMuted,
        borderLeft: `2px solid ${REED.olive}`, paddingLeft: 10,
        textWrap: 'pretty',
      }}>{step.text}</div>
    );
  }
  if (step.kind === 'tool_call') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Icon name={icons[step.name]} size={13} color={REED.olive}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: REED.sans, fontSize: 12, fontWeight: 500, color: palette.ink,
          }}>{labels[step.name]}</div>
          <div style={{
            fontFamily: REED.mono, fontSize: 10, color: palette.inkFaint,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{JSON.stringify(step.args)}</div>
        </div>
      </div>
    );
  }
  // tool_result
  return (
    <div style={{
      marginLeft: 22, fontFamily: REED.mono, fontSize: 10,
      color: palette.inkFaint, lineHeight: 1.5,
      display: 'flex', gap: 6,
    }}>
      <span style={{ color: REED.olive }}>✓</span>
      <span style={{
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>{step.preview}</span>
    </div>
  );
}

function AnswerBody({ text, sources, palette, busy }) {
  // Render [n] citations as Cite chips.
  const srcMap = Object.fromEntries(sources.map(s => [s.n, s]));
  const nodes = [];
  let last = 0;
  const re = /\[(\d+)\]/g;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    const n = Number(m[1]);
    nodes.push(<Cite key={key++} n={n} color={REED.olive} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(<span key={key++}>{text.slice(last)}</span>);

  return (
    <div style={{
      fontFamily: REED.sans, fontSize: 14, lineHeight: 1.65,
      color: palette.ink, whiteSpace: 'pre-wrap', textWrap: 'pretty',
    }}>
      {nodes}
      {busy && text && <span style={{
        display: 'inline-block', width: 6, height: 14,
        background: REED.olive, marginLeft: 3, verticalAlign: -2,
        animation: 'reedBlink 1s infinite',
      }}/>}
    </div>
  );
}

function SourcesList({ sources, palette }) {
  return (
    <div style={{
      marginTop: 20, paddingTop: 14,
      borderTop: `1px dashed ${palette.rule}`,
    }}>
      <div style={{
        fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.8,
        textTransform: 'uppercase', color: palette.inkMuted, marginBottom: 10,
      }}>Sources</div>
      <ol style={{
        margin: 0, padding: 0, listStyle: 'none',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {sources.map(s => (
          <li key={s.n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Cite n={s.n} color={REED.olive} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: REED.sans, fontSize: 12.5, color: palette.ink,
                fontWeight: 500, marginBottom: 2,
              }}>{s.label}</div>
              <div style={{
                fontFamily: REED.mono, fontSize: 10, color: palette.inkFaint,
              }}>{s.kind === 'library' ? 'your library' : s.kind === 'web' ? 'web · ' + s.domain : s.kind}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Mock replies (scripted, topic-tinted)
// ───────────────────────────────────────────────────────────
function mockReplyFor(q, article) {
  const lower = q.toLowerCase();
  if (lower.includes('bullet') || lower.includes('summar')) {
    return `Here are the main beats:

• ${article.tldr}
• The piece opens with a specific example and widens from there — ${article.author || 'the author'} stays close to the ground rather than arguing from first principles.
• The central tension is between convenience and continuity: the convenient option keeps winning even as the long-term cost becomes visible.
• The ending resists a neat resolution and offers three observations instead of a prescription.`;
  }
  if (lower.includes('skeptic') || lower.includes('counter')) {
    return `A sympathetic skeptic might push back in two places:

First, the example ${article.site} leads with is unusually clean — most real cases are messier. The piece admits this late, but only briefly.

Second, the framing treats one side's interests as default and the other side's as contingent. That's a reasonable rhetorical move, but it's worth naming.

The author would probably concede both and argue the overall pattern still holds.`;
  }
  if (lower.includes('argument') || lower.includes('main')) {
    return `The main argument in one sentence: ${article.tldr}

Supporting it, ${article.author || 'the piece'} stacks three kinds of evidence — a specific case study, a structural observation about the adjacent economy, and a short pattern-match to similar situations in other domains. The case study is doing most of the persuasive work; the structural point is what makes the argument generalize.`;
  }
  // default
  return `Short answer: that's one of the piece's quieter moves. ${article.author || 'The author'} frames it as obvious, but it's actually where most of the thinking happened.

Reading it again with your question in mind, the key sentence is around the middle of the piece — the one that pivots from description to consequence. Everything after it rests on that hinge.`;
}

function researchScriptFor(question, article) {
  const topic = article.tags[0];
  const libRelated = SAMPLE_ARTICLES.filter(a => a.id !== article.id &&
    a.tags.some(t => article.tags.includes(t))).slice(0, 3);

  const trace = [
    { kind: 'plan', text: "I'll check your library for adjacent pieces first, then pull the top match in full, then sanity-check with a web search.", delay: 400 },
    { kind: 'tool_call', name: 'search_library',
      args: { q: article.tags.join(' '), limit: 5 }, delay: 700 },
    { kind: 'tool_result', name: 'search_library',
      preview: `found ${libRelated.length} related: ${libRelated.map(a => `"${a.title.slice(0,36)}…"`).join(', ')}`,
      delay: 550 },
  ];

  if (libRelated[0]) {
    trace.push({ kind: 'tool_call', name: 'read_article',
      args: { id: libRelated[0].id }, delay: 500 });
    trace.push({ kind: 'tool_result', name: 'read_article',
      preview: `${libRelated[0].words.toLocaleString()} words; takeaway: ${libRelated[0].tldr.slice(0, 120)}…`,
      delay: 700 });
  }

  trace.push({ kind: 'tool_call', name: 'search_web',
    args: { q: `${article.tags[0]} ${new Date().getFullYear()}` }, delay: 600 });
  trace.push({ kind: 'tool_result', name: 'search_web',
    preview: `3 results from NYT, Axios, The Atlantic — most recent Apr 2026`, delay: 650 });

  const sources = [];
  libRelated.forEach((a, i) => {
    sources.push({ n: i + 1, label: a.title, kind: 'library' });
  });
  const webN = libRelated.length + 1;
  sources.push({ n: webN, label: topicHeadline(topic, 'nyt'),
    kind: 'web', domain: 'nytimes.com' });
  sources.push({ n: webN + 1, label: topicHeadline(topic, 'atlantic'),
    kind: 'web', domain: 'theatlantic.com' });

  const body = researchBodyFor(question, article, libRelated, sources);

  return { trace, sources, body };
}

function topicHeadline(topic, src) {
  const m = {
    books:    { nyt: 'The last of the neighborhood bookstores',       atlantic: 'What independent retail lost' },
    productivity: { nyt: 'Why deep work keeps getting harder',        atlantic: 'The calendar as diary' },
    ecology:  { nyt: 'Reading the land along old walls',              atlantic: 'Boundaries as ecology' },
    ai:       { nyt: 'Tool-using agents graduate from demos',         atlantic: 'Agents that narrate their own work' },
    'local-first': { nyt: 'After Pocket: where saved reading lives',  atlantic: 'Owning your data, slowly' },
    food:     { nyt: 'A grammar for tasting',                          atlantic: 'The tea at the edge of the room' },
    software: { nyt: 'SQLite, quietly at scale',                       atlantic: 'The database inside everything' },
    cities:   { nyt: 'What replaced the third place',                  atlantic: 'The third place, unbuilt' },
  };
  return (m[topic] || m.books)[src];
}

function researchBodyFor(question, article, libRelated, sources) {
  const libN = libRelated.length;
  const s1 = libN >= 1 ? '[1]' : '';
  const s2 = libN >= 2 ? '[2]' : '';
  const sw = `[${libN + 1}]`;

  if (question.toLowerCase().includes('counter')) {
    return `You've actually saved two pieces that argue against this one's framing${s1 ? ' ' + s1 : ''}${s2 ? ' and ' + s2 : ''}. They agree on the diagnosis but disagree on the cause: where ${article.author || 'this piece'} points to structural forces, the counter-argument points to individual choices accumulating.

The recent web coverage${' ' + sw} lands in the middle — treating the phenomenon as real but less inevitable than either side. Worth reading all three back-to-back; the disagreement is mostly about what can be done, not whether something is happening.`;
  }
  if (question.toLowerCase().includes('latest') || question.toLowerCase().includes('news')) {
    return `The freshest reporting${' ' + sw} picks up where this piece leaves off — specifically on the question of what the replacement actually looks like. Two threads worth watching:

1. A shift in how people measure the thing: the older framing asked "is it gone?", the newer framing asks "what's standing where it was?" That reframing is happening in your library too${s1 ? ' ' + s1 : ''}.

2. A split between commentary and ground reporting. The commentary piles up quickly; the ground reporting is rarer and better.

If I had to pick one to read next, I'd pick${s1 ? ' ' + s1 : ` ${sw}`}.`;
  }
  if (question.toLowerCase().includes('already') || question.toLowerCase().includes('related')) {
    return `You've saved ${libN} related pieces over the past few weeks${libN ? ':' : '.'}

${libRelated.map((a, i) => `${i+1}. "${a.title}" — ${a.readMin} min, same topic cluster [${i+1}]`).join('\n')}

They're closer in shape than in argument — all three start with a specific case and widen out, rather than arguing from first principles. That's probably why the recommender served them together.`;
  }
  return `Short answer: your library already has the best available context${s1 ? ' ' + s1 : ''}${s2 ? ', ' + s2 : ''}, and the current web coverage${' ' + sw} mostly agrees.

Two things worth noting: (1) the piece leans on a specific case that isn't typical — the web coverage notes this more bluntly than the article does. (2) the core claim holds up under the counter-reading, but the framing softens. I'd take the main argument as roughly correct and the tone as slightly too confident.`;
}

Object.assign(window, { ChatPane, ResearchPane });
