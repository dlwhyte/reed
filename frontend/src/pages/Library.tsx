import { useEffect, useState } from "react";
import { Article, api } from "../lib/api";
import SaveBar from "../components/SaveBar";
import ArticleCard from "../components/ArticleCard";
import { Search, Sparkles, X } from "lucide-react";

type Tab = "unread" | "favorites" | "archived" | "all";

export default function Library() {
  const [tab, setTab] = useState<Tab>("unread");
  const [articles, setArticles] = useState<Article[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<"newest" | "oldest" | "longest" | "shortest">("newest");
  const [q, setQ] = useState("");
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [searching, setSearching] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [list, tg, cfg] = await Promise.all([
      api.list(tab, activeTag, sort),
      api.tags(),
      api.config().catch(() => ({ llm_ready: false })),
    ]);
    setArticles(list);
    setTags(tg);
    setLlmReady((cfg as any).llm_ready);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tab, activeTag, sort]);

  async function doSearch() {
    if (!q.trim()) {
      load();
      return;
    }
    setSearching(true);
    try {
      const res = searchMode === "semantic" ? await api.semanticSearch(q) : await api.search(q);
      setArticles(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setQ("");
    load();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <SaveBar onSaved={load} />

      <div className="flex flex-wrap items-center gap-2 mt-6 mb-4">
        {(["unread", "favorites", "archived", "all"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setActiveTag(null);
              setQ("");
            }}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              tab === t
                ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            {t}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="ml-auto text-sm px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="longest">Longest</option>
          <option value="shortest">Shortest</option>
        </select>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder={searchMode === "semantic" ? "Semantic search…" : "Search your library…"}
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          />
          {q && (
            <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          )}
        </div>
        {llmReady && (
          <button
            onClick={() => setSearchMode((m) => (m === "keyword" ? "semantic" : "keyword"))}
            title={searchMode === "semantic" ? "Semantic search" : "Keyword search"}
            className={`px-3 rounded-lg border text-sm flex items-center gap-1 ${
              searchMode === "semantic"
                ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-transparent"
                : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {searchMode === "semantic" ? "Semantic" : "Keyword"}
          </button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-6">
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="text-xs px-2 py-1 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
            >
              × {activeTag}
            </button>
          )}
          {!activeTag &&
            tags.slice(0, 20).map((t) => (
              <button
                key={t.tag}
                onClick={() => setActiveTag(t.tag)}
                className="text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                {t.tag} <span className="opacity-60">· {t.count}</span>
              </button>
            ))}
        </div>
      )}

      {loading || searching ? (
        <div className="text-center py-12 text-neutral-500">Loading…</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          {q ? "No matches" : "Nothing here yet — paste a URL above to save your first article."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}
