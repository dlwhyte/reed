import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Coffee,
  ExternalLink,
  FlaskConical,
  HelpCircle,
  MessageSquareText,
  Minus,
  Moon,
  MoreHorizontal,
  Plus,
  Star,
  Sun,
  Type as TypeIcon,
  WifiOff,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { Article, Highlight, Me, api } from "../lib/api";
import { toView } from "../lib/article";
import { useStore } from "../store";
import ChatPanel from "../components/ChatPanel";
import ResearchPanel from "../components/ResearchPanel";
import { HighlightLayer } from "../components/reader/HighlightLayer";
import { MobileActionPill } from "../components/reader/MobileActionPill";
import { ReadingProgress } from "../components/reader/ReadingProgress";
import { ShortcutsHelp } from "../components/reader/ShortcutsHelp";
import { TagEditor } from "../components/reader/TagEditor";
import { Icon } from "../components/primitives/Icon";
import { Tooltip } from "../components/primitives/Tooltip";
import { useReadingProgress } from "../lib/useReadingProgress";

type Panel = "none" | "chat" | "research";

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [similar, setSimilar] = useState<Article[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [tagPool, setTagPool] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>("none");
  const [llmReady, setLlmReady] = useState(false);
  const [webReady, setWebReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const chatAllowed = llmReady && !!me?.features.chat;
  const researchAllowed = llmReady && !!me?.features.research;
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { prefs, setPrefs } = useStore();

  async function refresh() {
    if (!id) return;
    try {
      const a = await api.get(Number(id));
      setArticle(a);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
    const [s, cfg, h, hl, tg, m] = await Promise.all([
      api.similar(Number(id)).catch(() => [] as Article[]),
      api.config().catch(() => null),
      api.health().catch(() => null),
      api.articleHighlights(Number(id)).catch(() => [] as Highlight[]),
      api.tags().catch(() => [] as { tag: string; count: number }[]),
      api.me().catch(() => null),
    ]);
    setSimilar(s);
    setOffline(!h?.ok);
    setLlmReady(!!cfg && (cfg as any).llm_ready);
    setWebReady(!!cfg && (cfg as any).web_search_ready);
    setHighlights(hl);
    setTagPool(tg.map((t) => t.tag));
    setMe(m);
  }

  async function saveTags(next: string[]) {
    if (!article) return;
    // Optimistic: update local article immediately so the editor feels instant.
    setArticle({ ...article, tags: next });
    try {
      await api.update(article.id, { tags: next });
    } catch {
      refresh();
    }
  }

  async function addHighlight(text: string) {
    if (!id) return;
    // Optimistic insert so the mark appears immediately.
    const temp: Highlight = {
      id: -Date.now(),
      article_id: Number(id),
      text,
      note: null,
      created_at: new Date().toISOString(),
    };
    setHighlights((hs) => [...hs, temp]);
    try {
      const real = await api.addHighlight(Number(id), text);
      setHighlights((hs) => hs.map((h) => (h.id === temp.id ? real : h)));
    } catch {
      setHighlights((hs) => hs.filter((h) => h.id !== temp.id));
    }
  }

  async function removeHighlight(hid: number) {
    setHighlights((hs) => hs.filter((h) => h.id !== hid));
    try {
      if (hid > 0) await api.removeHighlight(hid);
    } catch {
      /* drop silently, user can refresh */
    }
  }

  useEffect(() => {
    setPanel("none");
    setHighlights([]);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Keyboard shortcuts. See ShortcutsHelp for the full list.
  useEffect(() => {
    let gArmed = false;
    let gTimer: number | null = null;

    function disarm() {
      gArmed = false;
      if (gTimer) window.clearTimeout(gTimer);
      gTimer = null;
    }

    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      }
      // Don't hijack browser shortcuts.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // "g" then "l"/"h" chord for navigation.
      if (gArmed) {
        if (e.key === "l") {
          navigate("/");
          disarm();
          return;
        }
        if (e.key === "h") {
          navigate("/highlights");
          disarm();
          return;
        }
        disarm();
      }

      switch (e.key) {
        case "?":
          setShortcutsOpen(true);
          return;
        case "Escape":
          if (shortcutsOpen) setShortcutsOpen(false);
          else setPanel("none");
          return;
        case "-":
          setPrefs({ fontSize: Math.max(14, prefs.fontSize - 1) });
          return;
        case "+":
        case "=":
          setPrefs({ fontSize: Math.min(24, prefs.fontSize + 1) });
          return;
        case "t":
          setPrefs({
            theme:
              prefs.theme === "light"
                ? "sepia"
                : prefs.theme === "sepia"
                ? "dark"
                : "light",
          });
          return;
        case "f":
          if (article) {
            api
              .update(article.id, { is_favorite: !article.is_favorite })
              .then(() => refresh())
              .catch(() => {});
          }
          return;
        case "a":
          if (article) {
            api
              .update(article.id, { is_archived: !article.is_archived })
              .then(() => refresh())
              .catch(() => {});
          }
          return;
        case "c":
          if (chatAllowed) setPanel((p) => (p === "chat" ? "none" : "chat"));
          return;
        case "r":
          if (researchAllowed) setPanel((p) => (p === "research" ? "none" : "research"));
          return;
        case "g":
          gArmed = true;
          gTimer = window.setTimeout(disarm, 900);
          return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      disarm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefs.fontSize,
    prefs.theme,
    article?.id,
    article?.is_favorite,
    article?.is_archived,
    chatAllowed,
    researchAllowed,
    shortcutsOpen,
  ]);

  const view = useMemo(() => (article ? toView(article) : null), [article]);

  const progress = useReadingProgress({
    storageKey: article ? `browsefellow.progress.${article.id}` : undefined,
    initial: article?.progress,
    onCommit: (p) => {
      if (!article) return;
      api.update(article.id, { progress: p }).catch(() => {
        /* persisted to localStorage already; backend retry can happen later */
      });
    },
  });

  if (!article || !view) {
    if (loadError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center text-ink-muted">
          <div className="max-w-sm">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta">
              couldn’t load this page
            </div>
            <h1 className="mb-3 font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">
              The shelf isn’t answering.
            </h1>
            <p className="mb-5 font-display text-[15px] italic text-ink-muted [text-wrap:pretty]">
              Start the backend (<span className="font-mono not-italic">./backend/run.sh</span>) and try again.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadError(false);
                refresh();
              }}
              className="rounded-pill bg-terracotta px-4 py-2 font-sans text-[13px] font-medium text-white shadow-pill hover:brightness-105"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink-muted">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
            turning to your page
          </div>
          <div className="mt-3 inline-flex">
            <span className="bf-dot" />
            <span className="bf-dot" />
            <span className="bf-dot" />
          </div>
        </div>
      </div>
    );
  }

  const themeClass =
    prefs.theme === "sepia"
      ? "reader-theme-sepia"
      : prefs.theme === "dark"
      ? "reader-theme-dark"
      : "";

  const fontClass = prefs.font === "serif" ? "font-serif" : "font-sans";

  return (
    <div
      className={clsx(
        "min-h-screen bg-paper text-ink",
        themeClass,
        prefs.theme === "light" && "paper-noise",
      )}
    >
      <ReadingProgress value={progress} />
      {shortcutsOpen && <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />}

      {/* Toolbar */}
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/90 backdrop-blur pt-safe">
        {offline && (
          <div className="border-b border-dashed border-rule bg-terracotta-soft/40 px-5 py-1.5 text-center">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
              <Icon icon={WifiOff} size={11} />
              shelf offline · reading from your last cache
            </span>
          </div>
        )}
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-7">
          <ToolbarButton
            label="Back"
            onClick={() => navigate(-1)}
          >
            <Icon icon={ArrowLeft} size={18} />
          </ToolbarButton>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2.5">
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint sm:inline">
                reading from
              </span>
              <span className="truncate font-display text-[14px] italic text-ink-muted">
                {view.site || "a saved page"}
              </span>
              {progress > 0.02 && (
                <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint sm:inline">
                  {formatTimeLeft(view.readMin, progress)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <ToolbarButton label="Open original" href={article.url}>
              <Icon icon={ExternalLink} size={17} />
            </ToolbarButton>
            <ToolbarDivider />
            {chatAllowed && (
              <ToolbarButton
                label="Chat with article"
                active={panel === "chat"}
                activeColor="plum"
                onClick={() =>
                  setPanel((p) => (p === "chat" ? "none" : "chat"))
                }
              >
                <Icon icon={MessageSquareText} size={17} />
              </ToolbarButton>
            )}
            {researchAllowed && (
              <ToolbarButton
                label="Research this"
                active={panel === "research"}
                activeColor="olive"
                onClick={() =>
                  setPanel((p) => (p === "research" ? "none" : "research"))
                }
              >
                <Icon icon={FlaskConical} size={17} />
              </ToolbarButton>
            )}
            {(chatAllowed || researchAllowed) && <ToolbarDivider />}
            <div className="hidden items-center gap-0.5 sm:flex">
              <ToolbarButton
                label="Cycle theme"
                onClick={() =>
                  setPrefs({
                    theme:
                      prefs.theme === "light"
                        ? "sepia"
                        : prefs.theme === "sepia"
                        ? "dark"
                        : "light",
                  })
                }
              >
                <Icon
                  icon={
                    prefs.theme === "light"
                      ? Sun
                      : prefs.theme === "sepia"
                      ? Coffee
                      : Moon
                  }
                  size={17}
                />
              </ToolbarButton>
              <ToolbarButton
                label="Toggle serif / sans"
                onClick={() =>
                  setPrefs({ font: prefs.font === "serif" ? "sans" : "serif" })
                }
              >
                <Icon icon={TypeIcon} size={17} />
              </ToolbarButton>
              <ToolbarButton
                label="Smaller"
                onClick={() =>
                  setPrefs({ fontSize: Math.max(14, prefs.fontSize - 1) })
                }
              >
                <Icon icon={Minus} size={17} />
              </ToolbarButton>
              <ToolbarButton
                label="Bigger"
                onClick={() =>
                  setPrefs({ fontSize: Math.min(24, prefs.fontSize + 1) })
                }
              >
                <Icon icon={Plus} size={17} />
              </ToolbarButton>
              <ToolbarDivider />
              <ToolbarButton
                label={view.favorite ? "Unfavorite" : "Favorite"}
                active={view.favorite}
                activeColor="terracotta"
                onClick={async () => {
                  await api.update(article.id, {
                    is_favorite: !article.is_favorite,
                  });
                  refresh();
                }}
              >
                <Icon
                  icon={Star}
                  size={17}
                  fill={view.favorite ? "currentColor" : "none"}
                />
              </ToolbarButton>
              <ToolbarButton
                label={article.is_archived ? "Unarchive" : "Archive"}
                onClick={async () => {
                  await api.update(article.id, {
                    is_archived: !article.is_archived,
                  });
                  refresh();
                }}
              >
                <Icon
                  icon={article.is_archived ? ArchiveRestore : Archive}
                  size={17}
                />
              </ToolbarButton>
              <ToolbarDivider />
              <ToolbarButton
                label="Shortcuts (?)"
                onClick={() => setShortcutsOpen(true)}
              >
                <Icon icon={HelpCircle} size={17} />
              </ToolbarButton>
            </div>

            {/* Mobile "more" */}
            <div className="relative sm:hidden">
              <ToolbarButton
                label="More"
                active={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <Icon icon={MoreHorizontal} size={17} />
              </ToolbarButton>
              {moreOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-rule bg-paper-raised py-1 shadow-modal">
                    <MoreItem
                      onClick={() => {
                        setPrefs({
                          theme:
                            prefs.theme === "light"
                              ? "sepia"
                              : prefs.theme === "sepia"
                              ? "dark"
                              : "light",
                        });
                      }}
                      icon={
                        prefs.theme === "light"
                          ? Sun
                          : prefs.theme === "sepia"
                          ? Coffee
                          : Moon
                      }
                    >
                      Theme · {prefs.theme}
                    </MoreItem>
                    <MoreItem
                      onClick={() =>
                        setPrefs({
                          font: prefs.font === "serif" ? "sans" : "serif",
                        })
                      }
                      icon={TypeIcon}
                    >
                      Font · {prefs.font}
                    </MoreItem>
                    <div className="flex items-center gap-2 px-4 py-2.5 text-ink-muted">
                      <span className="flex-1 font-sans text-[13px]">
                        Size · {prefs.fontSize}
                      </span>
                      <button
                        className="rounded p-1 hover:bg-rule/60 hover:text-ink"
                        onClick={() =>
                          setPrefs({
                            fontSize: Math.max(14, prefs.fontSize - 1),
                          })
                        }
                      >
                        <Icon icon={Minus} size={14} />
                      </button>
                      <button
                        className="rounded p-1 hover:bg-rule/60 hover:text-ink"
                        onClick={() =>
                          setPrefs({
                            fontSize: Math.min(24, prefs.fontSize + 1),
                          })
                        }
                      >
                        <Icon icon={Plus} size={14} />
                      </button>
                    </div>
                    <div className="my-1 border-t border-dashed border-rule" />
                    <MoreItem
                      onClick={async () => {
                        await api.update(article.id, {
                          is_favorite: !article.is_favorite,
                        });
                        refresh();
                        setMoreOpen(false);
                      }}
                      icon={Star}
                    >
                      {view.favorite ? "Unfavorite" : "Favorite"}
                    </MoreItem>
                    <MoreItem
                      onClick={async () => {
                        await api.update(article.id, {
                          is_archived: !article.is_archived,
                        });
                        refresh();
                        setMoreOpen(false);
                      }}
                      icon={article.is_archived ? ArchiveRestore : Archive}
                    >
                      {article.is_archived ? "Unarchive" : "Archive"}
                    </MoreItem>
                    <div className="my-1 border-t border-dashed border-rule" />
                    <MoreItem
                      onClick={() => {
                        setShortcutsOpen(true);
                        setMoreOpen(false);
                      }}
                      icon={HelpCircle}
                    >
                      Shortcuts
                    </MoreItem>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Body + optional side panel */}
      <div className="flex">
        <main
          className={clsx(
            "mx-auto w-full flex-1 px-5 pb-32 pt-10 md:px-8 md:pb-28 md:pt-14",
            fontClass,
          )}
          style={{
            maxWidth: `min(${prefs.width}px, 100%)`,
            fontSize: `${prefs.fontSize}px`,
          }}
        >
          <article>
            {/* Kicker */}
            <div className="mb-4 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-terracotta">
              <span className="h-px w-[22px] bg-terracotta" />
              <span>{view.site}</span>
              {view.author && (
                <>
                  <span className="text-ink-faint">·</span>
                  <span className="normal-case tracking-normal text-ink-muted">
                    {view.author}
                  </span>
                </>
              )}
            </div>

            {/* Title */}
            <h1
              className="font-display font-semibold text-ink [text-wrap:balance]"
              style={{
                fontSize: "clamp(32px, 4.4vw, 48px)",
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                margin: "0 0 22px",
              }}
            >
              {view.title}
            </h1>

            {/* Meta */}
            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[13px] text-ink-muted">
              <span>{view.readMin} min read</span>
              <span className="text-ink-faint">·</span>
              <span>{article.word_count.toLocaleString()} words</span>
              {view.age && (
                <>
                  <span className="text-ink-faint">·</span>
                  <span>Saved {view.age} ago</span>
                </>
              )}
            </div>

            {/* Tags */}
            <div className="mb-8">
              <TagEditor
                tags={view.tags}
                suggestions={tagPool}
                onChange={saveTags}
              />
            </div>

            {/* TL;DR card */}
            {article.summary_long && (
              <aside
                className="mb-10 grid grid-cols-[auto_1fr] gap-4 rounded-lg border border-rule p-5"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--bf-butter) 60%, transparent)",
                }}
              >
                <div className="pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta">
                  TL;DR
                </div>
                <div className="font-display text-[16px] italic leading-[1.55] text-ink [text-wrap:pretty]">
                  {article.summary_long}
                </div>
              </aside>
            )}

            {/* Body */}
            <HighlightLayer
              paragraphs={(article.content || "").split(/\n\s*\n/)}
              highlights={highlights}
              onHighlight={addHighlight}
              onRemove={removeHighlight}
              fontClass={fontClass}
              lineHeight={1.65}
            />

            {/* Related */}
            {similar.length > 0 && (
              <section className="mt-20 border-t border-dashed border-rule pt-8">
                <div className="mb-5 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-terracotta">
                  <span className="h-px w-[22px] bg-terracotta" />
                  From your shelf, nearby
                </div>
                <ul className="divide-y divide-dashed divide-rule">
                  {similar.map((s) => {
                    const sv = toView(s);
                    return (
                      <li key={s.id} className="py-3.5">
                        <Link
                          to={`/read/${s.id}`}
                          className="group flex flex-wrap items-baseline gap-x-3 gap-y-1"
                        >
                          <span className="font-display text-[17px] font-medium leading-snug text-ink group-hover:text-terracotta">
                            {sv.title}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                            {sv.site} · {sv.readMin}m
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </article>
        </main>

        {/* Mobile floating action pill (hidden on desktop + when panel open) */}
        {panel === "none" && (
          <MobileActionPill
            actions={[
              {
                id: "font",
                icon: TypeIcon,
                label: "Toggle serif / sans",
                onClick: () =>
                  setPrefs({
                    font: prefs.font === "serif" ? "sans" : "serif",
                  }),
              },
              ...(chatAllowed
                ? [
                    {
                      id: "chat",
                      icon: MessageSquareText,
                      label: "Chat with article",
                      accent: "plum" as const,
                      active: false,
                      onClick: () => setPanel("chat"),
                    },
                  ]
                : []),
              ...(researchAllowed
                ? [
                    {
                      id: "research",
                      icon: FlaskConical,
                      label: "Research this",
                      accent: "olive" as const,
                      active: false,
                      onClick: () => setPanel("research"),
                    },
                  ]
                : []),
              {
                id: "fav",
                icon: Star,
                label: view.favorite ? "Unfavorite" : "Favorite",
                accent: "terracotta" as const,
                active: view.favorite,
                fill: view.favorite,
                onClick: async () => {
                  await api.update(article.id, {
                    is_favorite: !article.is_favorite,
                  });
                  refresh();
                },
              },
              {
                id: "archive",
                icon: article.is_archived ? ArchiveRestore : Archive,
                label: article.is_archived ? "Unarchive" : "Archive",
                onClick: async () => {
                  await api.update(article.id, {
                    is_archived: !article.is_archived,
                  });
                  refresh();
                },
              },
            ]}
          />
        )}

        {/* Side panel */}
        {panel !== "none" && (
          <SidePanel
            accent={panel === "chat" ? "plum" : "olive"}
            title={panel === "chat" ? "Chat" : "Research"}
            onClose={() => setPanel("none")}
          >
            {panel === "chat" ? (
              <ChatPanel articleId={article.id} llmReady={llmReady} />
            ) : (
              <ResearchPanel
                articleId={article.id}
                llmReady={llmReady}
                webReady={webReady}
              />
            )}
          </SidePanel>
        )}
      </div>
    </div>
  );
}

function formatTimeLeft(totalMin: number, progress: number): string {
  if (progress >= 0.98) return "done · nice read";
  const left = Math.max(1, Math.round(totalMin * (1 - progress)));
  return `${left} min left`;
}

function ToolbarButton({
  children,
  label,
  onClick,
  href,
  active,
  activeColor,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  activeColor?: "plum" | "olive" | "terracotta";
}) {
  const activeStyle =
    active && activeColor === "plum"
      ? "bg-plum text-white"
      : active && activeColor === "olive"
      ? "bg-olive text-white"
      : active && activeColor === "terracotta"
      ? "text-terracotta"
      : active
      ? "bg-rule text-ink"
      : "text-ink-muted hover:bg-rule/60 hover:text-ink";

  const className = clsx(
    "flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 ease-out",
    activeStyle,
  );

  if (href) {
    return (
      <Tooltip label={label}>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className={className}
        >
          {children}
        </a>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={className}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 hidden h-4 w-px bg-rule sm:inline-block" />;
}

function MoreItem({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-sans text-[13px] text-ink-muted hover:bg-rule/40 hover:text-ink"
    >
      <Icon icon={icon} size={14} />
      {children}
    </button>
  );
}

function SidePanel({
  children,
  title,
  accent,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  accent: "plum" | "olive";
  onClose: () => void;
}) {
  const accentBg = accent === "plum" ? "bg-plum-soft" : "bg-olive-soft";
  const accentText = accent === "plum" ? "text-plum" : "text-olive";
  const accentChip = accent === "plum" ? "bg-plum" : "bg-olive";
  const accentIcon = accent === "plum" ? MessageSquareText : FlaskConical;

  return (
    <>
      {/* Mobile: bottom sheet with backdrop. Hidden on md+. */}
      <div
        className="bf-fade-enter fixed inset-0 z-30 bg-black/25 md:hidden"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={clsx(
          "bf-sheet-enter fixed inset-x-0 bottom-0 z-40 flex h-[85vh] max-h-[720px] flex-col overflow-hidden rounded-t-[22px] border-t border-rule bg-paper-deep shadow-modal pb-safe",
          "md:sticky md:inset-auto md:top-14 md:z-auto md:h-[calc(100vh-3.5rem)] md:max-h-none md:w-[28rem] md:animate-none md:rounded-none md:border-l md:border-t-0 md:bg-paper-raised md:shadow-none md:pb-0",
        )}
      >
        {/* Mobile drag handle — decorative; tapping closes. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="flex w-full items-center justify-center py-2.5 md:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-rule" />
        </button>

        <div
          className={clsx(
            "flex items-center gap-2.5 border-b border-rule px-4 py-2.5",
            accentBg,
          )}
        >
          <span
            aria-hidden
            className={clsx(
              "inline-flex h-6 w-6 items-center justify-center rounded-md text-white md:hidden",
              accentChip,
            )}
          >
            <Icon icon={accentIcon} size={13} />
          </span>
          <div
            className={clsx(
              "flex-1 font-mono text-[11px] uppercase tracking-[0.15em] md:text-left",
              accentText,
            )}
          >
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-md p-1.5 text-ink-muted hover:bg-rule/50 hover:text-ink"
          >
            <Icon icon={X} size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </aside>
    </>
  );
}
