import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Article, api } from "../lib/api";
import ChatPanel from "../components/ChatPanel";
import ResearchPanel from "../components/ResearchPanel";
import { useStore } from "../store";
import {
  ArrowLeft, Star, Archive, ArchiveRestore, ExternalLink,
  Type, Minus, Plus, MessageSquare, Sun, Moon, Coffee, FlaskConical, X, MoreHorizontal,
} from "lucide-react";

export default function Reader() {
  const { id } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [similar, setSimilar] = useState<Article[]>([]);
  const [panel, setPanel] = useState<"none" | "chat" | "research">("none");
  const [llmReady, setLlmReady] = useState(false);
  const [webReady, setWebReady] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { prefs, setPrefs } = useStore();

  async function refresh() {
    if (!id) return;
    const a = await api.get(Number(id));
    setArticle(a);
    const [s, cfg] = await Promise.all([
      api.similar(Number(id)).catch(() => []),
      api.config().catch(() => ({ llm_ready: false })),
    ]);
    setSimilar(s);
    setLlmReady((cfg as any).llm_ready);
    setWebReady((cfg as any).web_search_ready);
  }

  useEffect(() => {
    refresh();
  }, [id]);

  if (!article) {
    return <div className="p-8 text-center text-neutral-500">Loading…</div>;
  }

  const themeClass =
    prefs.theme === "sepia"
      ? "theme-sepia"
      : prefs.theme === "dark"
      ? "bg-neutral-950 text-neutral-100"
      : "bg-white text-neutral-900";

  const fontClass = prefs.font === "serif" ? "font-serif" : "font-sans";

  return (
    <div className={`min-h-screen ${themeClass} transition-colors`}>
      <div className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 backdrop-blur bg-inherit">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link to="/" className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 truncate text-sm text-neutral-500">
            {article.site_name}
          </div>
          <div className="flex items-center gap-1 relative">
            {/* Primary actions (always visible, including mobile) */}
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Open original"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            {llmReady && (
              <>
                <button
                  onClick={() => setPanel((p) => (p === "chat" ? "none" : "chat"))}
                  className={`p-2 rounded ${panel === "chat" ? "bg-neutral-200 dark:bg-neutral-800" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                  title="Chat with article"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPanel((p) => (p === "research" ? "none" : "research"))}
                  className={`p-2 rounded ${panel === "research" ? "bg-neutral-200 dark:bg-neutral-800" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                  title="Research agent"
                >
                  <FlaskConical className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Secondary actions: visible on desktop, hidden behind More on mobile */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => setPrefs({ theme: prefs.theme === "light" ? "dark" : prefs.theme === "dark" ? "sepia" : "light" })}
                className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                title="Theme"
              >
                {prefs.theme === "light" ? <Sun className="w-5 h-5" /> : prefs.theme === "dark" ? <Moon className="w-5 h-5" /> : <Coffee className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setPrefs({ font: prefs.font === "serif" ? "sans" : "serif" })}
                className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                title="Font"
              >
                <Type className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPrefs({ fontSize: Math.max(14, prefs.fontSize - 1) })}
                className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPrefs({ fontSize: Math.min(24, prefs.fontSize + 1) })}
                className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={async () => {
                  await api.update(article.id, { is_favorite: !article.is_favorite });
                  refresh();
                }}
                className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Star className={`w-5 h-5 ${article.is_favorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
              </button>
              <button
                onClick={async () => {
                  await api.update(article.id, { is_archived: !article.is_archived });
                  refresh();
                }}
                className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {article.is_archived ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
              </button>
            </div>

            {/* Mobile: More menu */}
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`sm:hidden p-2 rounded ${moreOpen ? "bg-neutral-200 dark:bg-neutral-800" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              title="More"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {moreOpen && (
              <>
                <div
                  className="sm:hidden fixed inset-0 z-10"
                  onClick={() => setMoreOpen(false)}
                />
                <div className="sm:hidden absolute top-full right-0 mt-1 w-56 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-lg z-20 py-1">
                  <button
                    onClick={() => {
                      setPrefs({ theme: prefs.theme === "light" ? "dark" : prefs.theme === "dark" ? "sepia" : "light" });
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    {prefs.theme === "light" ? <Sun className="w-4 h-4" /> : prefs.theme === "dark" ? <Moon className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                    Theme: {prefs.theme}
                  </button>
                  <button
                    onClick={() => setPrefs({ font: prefs.font === "serif" ? "sans" : "serif" })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <Type className="w-4 h-4" />
                    Font: {prefs.font}
                  </button>
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <span className="text-sm flex-1">Size: {prefs.fontSize}px</span>
                    <button
                      onClick={() => setPrefs({ fontSize: Math.max(14, prefs.fontSize - 1) })}
                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPrefs({ fontSize: Math.min(24, prefs.fontSize + 1) })}
                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="border-t border-neutral-200 dark:border-neutral-800 my-1" />
                  <button
                    onClick={async () => {
                      await api.update(article.id, { is_favorite: !article.is_favorite });
                      refresh();
                      setMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <Star className={`w-4 h-4 ${article.is_favorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    {article.is_favorite ? "Unfavorite" : "Favorite"}
                  </button>
                  <button
                    onClick={async () => {
                      await api.update(article.id, { is_archived: !article.is_archived });
                      refresh();
                      setMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    {article.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    {article.is_archived ? "Unarchive" : "Archive"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex">
        <main
          className={`flex-1 mx-auto py-6 sm:py-10 px-4 sm:px-6 w-full ${fontClass}`}
          style={{ maxWidth: `min(${prefs.width}px, 100%)`, fontSize: `${prefs.fontSize}px` }}
        >
          <h1 className="text-4xl font-bold leading-tight mb-4">{article.title}</h1>
          <div className="text-sm text-neutral-500 mb-8 flex items-center gap-2 flex-wrap">
            {article.author && <span>{article.author}</span>}
            {article.author && <span>·</span>}
            <span>{article.read_time_min} min read</span>
            <span>·</span>
            <span>{article.word_count.toLocaleString()} words</span>
          </div>
          {article.summary_long && (
            <div className="text-sm text-neutral-600 dark:text-neutral-400 border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 mb-8 italic">
              <div className="text-xs uppercase tracking-wide mb-1 font-sans not-italic">Summary</div>
              {article.summary_long}
            </div>
          )}
          <div className="reader-prose whitespace-pre-wrap">{article.content}</div>

          {similar.length > 0 && (
            <div className="mt-16 pt-8 border-t border-neutral-200 dark:border-neutral-800">
              <h2 className="text-lg font-semibold mb-4 font-sans">Similar articles</h2>
              <ul className="space-y-2 font-sans text-base">
                {similar.map((s) => (
                  <li key={s.id}>
                    <Link to={`/read/${s.id}`} className="underline underline-offset-2">
                      {s.title}
                    </Link>
                    <span className="text-xs text-neutral-500 ml-2">
                      {s.site_name} · {s.read_time_min} min
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>

        {panel === "chat" && (
          <aside className="fixed inset-0 top-14 z-30 bg-white dark:bg-neutral-950 md:sticky md:inset-auto md:top-14 md:z-auto md:w-96 md:border-l md:border-neutral-200 md:dark:border-neutral-800 md:h-[calc(100vh-3.5rem)]">
            <button
              onClick={() => setPanel("none")}
              className="md:hidden absolute top-2 right-2 z-10 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <ChatPanel articleId={article.id} llmReady={llmReady} />
          </aside>
        )}
        {panel === "research" && (
          <aside className="fixed inset-0 top-14 z-30 bg-white dark:bg-neutral-950 md:sticky md:inset-auto md:top-14 md:z-auto md:w-[28rem] md:border-l md:border-neutral-200 md:dark:border-neutral-800 md:h-[calc(100vh-3.5rem)]">
            <button
              onClick={() => setPanel("none")}
              className="md:hidden absolute top-2 right-2 z-10 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <ResearchPanel articleId={article.id} llmReady={llmReady} webReady={webReady} />
          </aside>
        )}
      </div>
    </div>
  );
}
