// Reader — the centerpiece. Article body + Chat panel + Research agent.
// Both panels are fully interactive with streamed responses.

function Reader({ articleId = 1, onBack = () => {}, theme = 'light',
  fontKind = 'serif', size = 18, width = 680,
  onPrefs = () => {}, embedded = false, initialPanel = 'none' }) {

  const article = SAMPLE_ARTICLES.find(a => a.id === articleId) || SAMPLE_ARTICLES[0];
  const [panel, setPanel] = React.useState(initialPanel); // none | chat | research
  const [favorite, setFavorite] = React.useState(article.favorite);

  const palette = theme === 'dark' ? REED.dark : theme === 'sepia' ? REED.sepia :
    { paper: REED.paper, paperDeep: REED.paperDeep, paperRaised: REED.paperRaised,
      ink: REED.ink, inkMuted: REED.inkMuted, inkFaint: REED.inkFaint, rule: REED.rule };

  const bodyFont = fontKind === 'serif' ? REED.serif : REED.sans;

  return (
    <div style={{
      minHeight: '100%', height: '100%',
      background: palette.paper, color: palette.ink,
      fontFamily: REED.sans,
      display: 'flex', flexDirection: 'column',
      backgroundImage: theme === 'light' ? PAPER_NOISE : 'none',
      backgroundSize: '240px',
      overflow: embedded ? 'hidden' : 'auto',
    }}>
      {/* Top chrome */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: `${palette.paper}e6`, backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${palette.rule}`, flexShrink: 0,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 28px', height: 52,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <button onClick={onBack} style={{
            width: 34, height: 34, border: 'none',
            background: 'transparent', color: palette.inkMuted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
          }} onMouseEnter={e => e.currentTarget.style.background = palette.rule}
             onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Icon name="back" size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{
                fontFamily: REED.mono, fontSize: 10, letterSpacing: 0.8,
                textTransform: 'uppercase', color: palette.inkFaint,
              }}>reading from</span>
              <span style={{
                fontFamily: REED.display, fontSize: 14, fontStyle: 'italic',
                color: palette.inkMuted, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{article.site}</span>
            </div>
          </div>
          <ReaderToolbar {...{ palette, favorite, setFavorite, panel, setPanel,
            theme, fontKind, size, onPrefs, article }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <main style={{
          flex: 1, overflow: embedded ? 'auto' : 'visible',
          padding: '46px 28px 120px',
        }}>
          <article style={{
            maxWidth: width, margin: '0 auto',
            fontFamily: bodyFont, fontSize: size, lineHeight: 1.65,
            color: palette.ink,
          }}>
            <ArticleHeader article={article} palette={palette} />
            <ArticleSummary article={article} palette={palette} />
            <ArticleBody article={article} palette={palette} />
            <SimilarList articleId={article.id} palette={palette} />
          </article>
        </main>

        {panel === 'chat' && (
          <SidePanel title="Chat" icon="chat" accent={REED.plum}
            onClose={() => setPanel('none')} palette={palette}>
            <ChatPane article={article} palette={palette} />
          </SidePanel>
        )}
        {panel === 'research' && (
          <SidePanel title="Research" icon="flask" accent={REED.olive}
            onClose={() => setPanel('none')} palette={palette}>
            <ResearchPane article={article} palette={palette} />
          </SidePanel>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
function ReaderToolbar({ palette, favorite, setFavorite, panel, setPanel,
  theme, fontKind, size, onPrefs, article }) {
  const btn = (ic, active, on, title, color) => (
    <button onClick={on} title={title} style={{
      width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
      background: active ? (color || palette.rule) : 'transparent',
      color: active ? (color ? '#fff' : palette.ink) : palette.inkMuted,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onMouseEnter={e => { if (!active) e.currentTarget.style.background = palette.rule; }}
       onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <Icon name={ic} size={16}
        fill={ic === 'star' && favorite ? REED.terracotta : 'none'}
        color={ic === 'star' && favorite ? REED.terracotta : (active && color ? '#fff' : 'currentColor')} />
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {btn('ext', false, () => {}, 'Open original')}
      <div style={{ width: 1, height: 18, background: palette.rule, margin: '0 4px' }}/>
      {btn('chat', panel === 'chat',
        () => setPanel(p => p === 'chat' ? 'none' : 'chat'),
        'Chat with article', REED.plum)}
      {btn('flask', panel === 'research',
        () => setPanel(p => p === 'research' ? 'none' : 'research'),
        'Research agent', REED.olive)}
      <div style={{ width: 1, height: 18, background: palette.rule, margin: '0 4px' }}/>
      {btn(theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'coffee', false,
        () => onPrefs({ theme: theme === 'light' ? 'dark' : theme === 'dark' ? 'sepia' : 'light' }),
        'Cycle theme')}
      {btn('type', false, () => onPrefs({ fontKind: fontKind === 'serif' ? 'sans' : 'serif' }), 'Toggle serif/sans')}
      {btn('minus', false, () => onPrefs({ size: Math.max(14, size - 1) }), 'Smaller')}
      {btn('plus', false, () => onPrefs({ size: Math.min(26, size + 1) }), 'Larger')}
      <div style={{ width: 1, height: 18, background: palette.rule, margin: '0 4px' }}/>
      {btn('star', favorite, () => setFavorite(f => !f), 'Favorite')}
      {btn('archive', false, () => {}, 'Archive')}
    </div>
  );
}

function ArticleHeader({ article, palette }) {
  return (
    <>
      <div style={{
        fontFamily: REED.mono, fontSize: 11, letterSpacing: 1,
        textTransform: 'uppercase', color: REED.terracotta,
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
      }}>
        <span style={{ width: 22, height: 1, background: REED.terracotta }}/>
        {article.site} {article.author && <>· {article.author}</>}
      </div>
      <h1 style={{
        fontFamily: REED.display, fontWeight: 600,
        fontSize: 'clamp(32px, 4.4vw, 48px)', lineHeight: 1.08,
        letterSpacing: -0.8, color: palette.ink,
        margin: '0 0 22px', textWrap: 'balance',
      }}>{article.title}</h1>
      <div style={{
        fontFamily: REED.sans, fontSize: 13, color: palette.inkMuted,
        display: 'flex', gap: 14, marginBottom: 32, letterSpacing: 0.2,
      }}>
        <span><Icon name="clock" size={13} color={palette.inkMuted} style={{ display: 'inline' }}/>
          <span style={{ marginLeft: 6 }}>{article.readMin} min read</span></span>
        <span>{article.words.toLocaleString()} words</span>
        <span>Saved {article.age} ago</span>
      </div>
    </>
  );
}

function ArticleSummary({ article, palette }) {
  return (
    <aside style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14,
      padding: '18px 20px', borderRadius: REED.r.lg,
      background: REED.butter + '66',
      border: `1px solid ${REED.rule}`,
      marginBottom: 38,
      fontFamily: REED.sans,
    }}>
      <div style={{
        fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
        textTransform: 'uppercase', color: REED.terracotta, paddingTop: 4,
      }}>TL;DR</div>
      <div style={{
        fontFamily: REED.display, fontSize: 16, fontStyle: 'italic',
        lineHeight: 1.55, color: palette.ink, textWrap: 'pretty',
      }}>{article.tldr}</div>
    </aside>
  );
}

function ArticleBody({ article, palette }) {
  // Construct believable body paragraphs from the excerpt + lorem-ish filler
  // themed to the article. No real lorem — writerly sentences.
  const paras = bodyFor(article);
  return (
    <>
      {/* Drop cap on first para */}
      <p style={{ margin: '0 0 1.1em', textWrap: 'pretty' }}>
        <span style={{
          float: 'left', fontFamily: REED.display, fontSize: '4.6em',
          lineHeight: 0.85, marginRight: 10, marginTop: 6,
          color: REED.terracotta, fontWeight: 600,
        }}>{paras[0][0]}</span>
        {paras[0].slice(1)}
      </p>
      {paras.slice(1, 3).map((p, i) => (
        <p key={i} style={{ margin: '0 0 1.1em', textWrap: 'pretty' }}>{p}</p>
      ))}

      <blockquote style={{
        margin: '32px 0', padding: '4px 0 4px 22px',
        borderLeft: `2px solid ${REED.terracotta}`,
        fontFamily: REED.display, fontStyle: 'italic',
        fontSize: '1.12em', color: palette.inkMuted, textWrap: 'pretty',
      }}>“{article.excerpt}”</blockquote>

      {paras.slice(3).map((p, i) => (
        <p key={i} style={{ margin: '0 0 1.1em', textWrap: 'pretty' }}>{p}</p>
      ))}

      <h2 style={{
        fontFamily: REED.display, fontWeight: 600,
        fontSize: '1.5em', letterSpacing: -0.3,
        margin: '1.8em 0 0.6em',
      }}>Three small observations</h2>
      <ol style={{ margin: 0, paddingLeft: '1.4em' }}>
        {observationsFor(article).map((o, i) => (
          <li key={i} style={{ marginBottom: 10, textWrap: 'pretty' }}>{o}</li>
        ))}
      </ol>
    </>
  );
}

function bodyFor(a) {
  // Generic but domain-tinted paragraphs so each article reads distinct.
  const topic = a.tags[0];
  const map = {
    books: [
      "The bookstore on Maple used to sell more than books. It sold stationery, greeting cards, a small section of board games, and — for about two years in the late nineties — individually wrapped cheesecakes from a bakery up the road.",
      "What killed it wasn't the big-box chain two miles south, or even the website that would learn everyone's name. It was the cheesecakes, the greeting cards, the stationery — the parts of the business that existed to make the main business possible.",
      "This is the pattern you find everywhere once you start looking for it: a main thing supported by a margin of smaller things, and the smaller things quietly evaporating one by one.",
      "The last owner described it as \"watching my floor become fewer and fewer shelves.\" Every quarter she took another fixture out and didn't replace it. The store got airier, and the airiness was, she said, embarrassing.",
      "She held on for another eighteen months after that. The final inventory fit into the back of a station wagon, with room left over for the dog.",
    ],
    productivity: [
      "The first time I tagged a calendar block as \"focus\" instead of \"meeting,\" I felt silly. The second time, I felt the day get noticeably longer.",
      "Most calendar apps ask what you're doing and when. The better question is what kind of attention the thing requires — and whether that kind of attention is cheap, expensive, or currently unavailable.",
      "Once a block knows it's a focus block, all sorts of small automations become reasonable. Notifications dim. The status text updates itself. Your colleagues, without being told, start to hesitate.",
      "The irony is that none of this requires a new app. It requires one field, three values, and the patience to actually fill them in for a week.",
    ],
    ecology: [
      "The fence ran along the ridge for three quarters of a mile, give or take, depending on where exactly you thought the ridge ended.",
      "On the north side of it, the grass was taller and a slightly different green. On the south side, the soil was noticeably drier and the sheep grazed more deliberately. Both conditions had outlived several of the humans who'd argued about them.",
      "Stone fences are not really barriers. They're more like long, slow sentences written into the land — declarations that take a century to finish being said.",
      "The farmer's grandfather had built a section of it. The farmer's grandmother had built a longer section. Nobody alive remembered who built the rest, but the style was consistent, and a mason friend said it was probably all the same two hands.",
    ],
    ai: [
      "Most tool-using agents fail at the same place: a call comes back empty, the model treats the absence as finality, and the loop quietly closes down.",
      "Command A takes a different posture. An empty result is still information, and the plan updates to say so — usually with a sentence to the user explaining what wasn't found.",
      "The separation between plan and execution is what makes this feel less brittle. The plan is allowed to be wrong for a step or two, as long as the next step reads what happened.",
      "You can watch the whole loop from outside and it looks remarkably like a thoughtful person with a checklist — which is, probably, the highest compliment you can pay an agent right now.",
    ],
    'local-first': [
      "Pocket shut down on a Tuesday in July. My saved-for-later was eleven years old. I got about six weeks of warning, which was better than most users of most services get.",
      "The export was a JSON file of 4,311 URLs, of which 1,800-ish still loaded something resembling the original article. The rest were 404s, paywalls, or replaced.",
      "This is not a story about Pocket. It's a story about everything built the way Pocket was built — which is to say, rented.",
      "Local-first sounds like a technical choice, but it's really a moral one: the decision to make your tools outlive the company that made them.",
    ],
    food: [
      "The first thing to know about tasting tea is that almost everyone does it by accident, at first. You take a sip, you have a thought, the thought passes. That is a tasting.",
      "The second thing is that most of the language used around tea is borrowed from wine, and that this is fine, but you don't have to use any of it.",
      "Start with the smell of the dry leaves. Then the smell of the wet leaves. Then the smell of the cup before you drink. Then, last, the taste. In that order, for a couple of weeks. That's the entire course.",
      "If you have a favorite tea after a month, you're ahead of most people. If you still don't, you're also ahead of most people — you just know it.",
    ],
    software: [
      "SQLite is the most-used database in the world by a comical margin, and almost no one thinks of it as a database.",
      "For years the conventional wisdom said it didn't scale. What the conventional wisdom meant was that it didn't scale in the same shape as the databases most companies had unthinkingly chosen to scale toward.",
      "A single writer, a single file, and a truly extraordinary amount of testing turn out to be a surprisingly durable combination.",
      "The new-ish move is to treat SQLite not as a beginner's choice but as a deliberate architectural one. The file becomes the product; the rest is ceremony.",
    ],
    cities: [
      "The third place used to be obvious: somewhere that wasn't home and wasn't work, where you could show up without a plan and leave without a reason.",
      "The coffee shop gets blamed for replacing it, but the coffee shop is just the most visible survivor. The actual replacements are more diffuse — group chats, lobbies, transit stations, the inside of screens.",
      "You can see the shape of what we lost in the places that still have it. A neighborhood with a working third place hums in a particular way on a Saturday afternoon.",
      "What's gone is not the building. What's gone is the low-stakes expectation that you'd run into someone you'd half-recognized.",
    ],
  };
  return map[topic] || map.books;
}

function observationsFor(a) {
  const topic = a.tags[0];
  const map = {
    books: [
      "Independent bookstores don't close quickly — they close in a series of small quiet retreats you only notice in aggregate.",
      "The margin business (cards, gifts, coffee) is load-bearing, and moving it online removes the bookstore's floor one plank at a time.",
      "The replacement is rarely another store. It's almost always the street corner with nothing on it.",
    ],
    productivity: [
      "Not all 30-minute holes are equal. A 30-minute hole between two meetings is already spent.",
      "Labeling blocks by attention-type surfaces the \"dead time\" that no scheduler has ever been able to see.",
      "One new field, three values. That's the whole fix.",
    ],
    ecology: [
      "Fences outlive farmers; soil outlives fences. The ledger is kept by the longest-lived participant.",
      "Boundaries show up as ecology long before they show up on maps.",
      "Walking along a fence is a way of reading the handwriting of people who are no longer there.",
    ],
    ai: [
      "A good agent loop treats no-result as a signal, not a failure.",
      "Plans that are allowed to be temporarily wrong are more durable than plans that try to be right up front.",
      "Narration is a feature, not a nicety.",
    ],
    'local-first': [
      "Convenience disappears exactly when you've filled it with something worth keeping.",
      "Local-first is less a technical stance than a maintenance one.",
      "Moving your data home is tedious, and it's tedious in a way that compounds the way interest does.",
    ],
    food: [
      "Tasting is a sequence, not a verdict.",
      "The right vocabulary is the one you'd use to describe a smell to a child.",
      "Favorites come from attention, not from palate.",
    ],
    software: [
      "The database's superpower is cp.",
      "Single-writer is a feature exactly as often as it's a limit.",
      "\"Doesn't scale\" usually means \"doesn't scale the way my last job did.\"",
    ],
    cities: [
      "Third places die of friction-removal, not of rent.",
      "Screens absorbed the function and dropped the side-effects.",
      "Friction was load-bearing. We didn't notice until the building sagged.",
    ],
  };
  return map[topic] || map.books;
}

function SimilarList({ articleId, palette }) {
  const list = similarTo(articleId);
  if (!list.length) return null;
  return (
    <section style={{
      marginTop: 56, paddingTop: 26,
      borderTop: `1px dashed ${palette.rule}`,
    }}>
      <div style={{
        fontFamily: REED.mono, fontSize: 10, letterSpacing: 1,
        textTransform: 'uppercase', color: REED.terracotta,
        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ width: 22, height: 1, background: REED.terracotta }}/>
        From your shelf, nearby
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map(a => (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '10px 0', cursor: 'pointer',
          }}>
            <Cover article={a} w={60} h={60} rounded={6}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: REED.mono, fontSize: 10, color: palette.inkFaint,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3,
              }}>{a.site} · {a.readMin} min</div>
              <div style={{
                fontFamily: REED.display, fontSize: 17, fontWeight: 500,
                lineHeight: 1.2, letterSpacing: -0.2, color: palette.ink,
              }}>{a.title}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────
// Side panel shell
// ───────────────────────────────────────────────────────────
function SidePanel({ title, icon, accent, onClose, palette, children }) {
  return (
    <aside style={{
      width: 420, flexShrink: 0,
      borderLeft: `1px solid ${palette.rule}`,
      background: palette.paperDeep,
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 52, height: 'calc(100vh - 52px)',
      alignSelf: 'flex-start',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px',
        borderBottom: `1px solid ${palette.rule}`,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={15} color="#fff"/>
        </div>
        <div style={{
          fontFamily: REED.display, fontSize: 18, fontWeight: 600,
          letterSpacing: -0.3, color: palette.ink, flex: 1,
        }}>{title}</div>
        <button onClick={onClose} style={{
          width: 28, height: 28, border: 'none', borderRadius: 6,
          background: 'transparent', color: palette.inkMuted, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="x" size={15}/></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </aside>
  );
}

Object.assign(window, { Reader, SidePanel, ArticleBody, bodyFor });
