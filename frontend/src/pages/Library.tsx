import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Filter, Search, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { Article, api } from "../lib/api";
import SaveUrlPill from "../components/SaveUrlPill";
import ArticleCard from "../components/ArticleCard";
import LibraryHeader from "../components/LibraryHeader";
import { LibrarySkeleton } from "../components/LibrarySkeleton";
import { Icon } from "../components/primitives/Icon";
import { TabPill } from "../components/primitives/TabPill";
import { TagChip } from "../components/primitives/TagChip";

type Tab = "unread" | "favorites" | "archived" | "all";
type Density = "mixed" | "cards" | "list";
type Sort = "newest" | "oldest" | "longest" | "shortest";

const SORT_LABEL: Record<Sort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  longest: "Longest read",
  shortest: "Shortest read",
};

function loadDensity(): Density {
  try {
    const v = localStorage.getItem("browsefellow.library.density");
    if (v === "mixed" || v === "cards" || v === "list") return v;
  } catch {
    /* noop */
  }
  return "mixed";
}

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTag = searchParams.get("tag");
  const [tab, setTab] = useState<Tab>("unread");
  const [articles, setArticles] = useState<Article[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [activeTag, setActiveTagState] = useState<string | null>(urlTag);
  const [sort, setSort] = useState<Sort>("newest");

  // Keep ?tag= in the URL in sync with activeTag so tag filters are shareable
  // / back-button friendly.
  function setActiveTag(t: string | null) {
    setActiveTagState(t);
    const next = new URLSearchParams(searchParams);
    if (t) next.set("tag", t);
    else next.delete("tag");
    setSearchParams(next, { replace: true });
  }

  // If the URL changes (e.g. user clicks a tag on the Tags page), adopt it.
  useEffect(() => {
    setActiveTagState(urlTag);
  }, [urlTag]);
  const [q, setQ] = useState("");
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [searching, setSearching] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [density, setDensity] = useState<Density>(loadDensity);
  const searchRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [list, tg, cfg] = await Promise.all([
        api.list(tab, activeTag, sort),
        api.tags(),
        api.config().catch(() => ({ llm_ready: false })),
      ]);
      setArticles(list);
      setTags(tg);
      setLlmReady((cfg as any).llm_ready);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeTag, sort]);

  // Debounced inline search.
  useEffect(() => {
    if (!q.trim()) return;
    const id = window.setTimeout(() => {
      runSearch(q);
    }, 180);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, searchMode]);

  async function runSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      load();
      return;
    }
    setSearching(true);
    try {
      const res =
        searchMode === "semantic" && llmReady
          ? await api.semanticSearch(trimmed)
          : await api.search(trimmed);
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
    searchRef.current?.focus();
  }

  function changeDensity(d: Density) {
    setDensity(d);
    try {
      localStorage.setItem("browsefellow.library.density", d);
    } catch {
      /* noop */
    }
  }

  const { hero, cards, rows } = useMemo(() => splitForDensity(articles, density), [articles, density]);

  return (
    <div className="min-h-screen bg-paper paper-noise text-ink">
      <LibraryHeader onFocusSearch={() => searchRef.current?.focus()} />

      <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 md:px-10">
        <SaveUrlPill onSaved={load} />

        {/* Tabs + density + sort */}
        <div className="mt-7 flex items-center gap-2 border-b border-dashed border-rule pb-3.5">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {(["unread", "favorites", "archived", "all"] as Tab[]).map((t) => (
              <TabPill
                key={t}
                active={tab === t}
                onClick={() => {
                  setTab(t);
                  setActiveTag(null);
                  setQ("");
                }}
              >
                {t}
              </TabPill>
            ))}
          </div>
          <div className="flex-1" />
          <DensityToggle value={density} onChange={changeDensity} />
          <SortPicker value={sort} onChange={setSort} />
        </div>

        {/* Search row */}
        <div className="mt-4 flex gap-2.5">
          <div className="flex flex-1 items-center gap-2.5 rounded-lg border border-rule bg-paper-raised px-3.5 py-2.5">
            <Icon icon={Search} size={16} className="text-ink-muted shrink-0" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                searchMode === "semantic"
                  ? "describe what you want to find…"
                  : "search by keyword…"
              }
              className="min-w-0 flex-1 bg-transparent font-sans text-[14px] text-ink placeholder:text-ink-faint outline-none"
            />
            {q ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="text-ink-muted hover:text-ink"
              >
                <Icon icon={X} size={14} />
              </button>
            ) : (
              <kbd className="hidden rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-faint shadow-[0_1px_0_rgba(43,35,32,0.06)] sm:inline">
                ⌘K
              </kbd>
            )}
          </div>
          {llmReady && (
            <button
              type="button"
              onClick={() =>
                setSearchMode((m) => (m === "keyword" ? "semantic" : "keyword"))
              }
              className={clsx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 font-sans text-[13px] font-medium transition-colors duration-150 ease-out",
                searchMode === "semantic"
                  ? "border-terracotta bg-terracotta text-white"
                  : "border-rule bg-paper-raised text-ink-muted hover:text-ink",
              )}
              title={
                searchMode === "semantic"
                  ? "Semantic search on"
                  : "Switch to semantic search"
              }
            >
              <Icon icon={Sparkles} size={14} />
              <span className="hidden sm:inline">Semantic</span>
            </button>
          )}
        </div>

        {/* Tag rail */}
        {(tags.length > 0 || activeTag) && (
          <div className="-mx-5 mt-5 flex gap-1.5 overflow-x-auto px-5 pb-1 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
            {activeTag && (
              <TagChip
                tag={activeTag}
                active
                onClick={() => setActiveTag(null)}
              />
            )}
            {!activeTag &&
              tags.slice(0, 14).map((t) => (
                <TagChip
                  key={t.tag}
                  tag={t.tag}
                  count={t.count}
                  onClick={() => setActiveTag(t.tag)}
                />
              ))}
          </div>
        )}

        <div className="mt-7">
          {loading ? (
            <LibrarySkeleton density={density} />
          ) : searching ? (
            <LoadingRow />
          ) : articles.length === 0 ? (
            <EmptyShelf searching={!!q} />
          ) : (
            <>
              {hero && (
                <ArticleCard
                  key={hero.id}
                  article={hero}
                  onChange={load}
                  variant="hero"
                />
              )}
              {cards.length > 0 && (
                <div
                  className={clsx(
                    "grid gap-5",
                    density === "cards"
                      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                      : "grid-cols-1 sm:grid-cols-2",
                    hero && "mt-6",
                  )}
                >
                  {cards.map((a) => (
                    <ArticleCard
                      key={a.id}
                      article={a}
                      onChange={load}
                      variant="card"
                    />
                  ))}
                </div>
              )}
              {rows.length > 0 && (
                <div className={clsx(cards.length > 0 || hero ? "mt-8" : "mt-2")}>
                  {density === "mixed" && (hero || cards.length > 0) && (
                    <div className="mb-2 font-display italic text-[13px] text-ink-muted">
                      Also on your shelf
                    </div>
                  )}
                  {rows.map((a) => (
                    <ArticleCard
                      key={a.id}
                      article={a}
                      onChange={load}
                      variant="row"
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function splitForDensity(list: Article[], density: Density) {
  if (density === "cards") {
    return { hero: null as Article | null, cards: list, rows: [] as Article[] };
  }
  if (density === "list") {
    return { hero: null as Article | null, cards: [] as Article[], rows: list };
  }
  const hero = list[0] ?? null;
  const cards = list.slice(1, 3);
  const rows = list.slice(3);
  return { hero, cards, rows };
}

function DensityToggle({
  value,
  onChange,
}: {
  value: Density;
  onChange: (d: Density) => void;
}) {
  const options: { id: Density; label: string; glyph: string }[] = [
    { id: "mixed", label: "Mixed", glyph: "▦" },
    { id: "cards", label: "Cards", glyph: "▢" },
    { id: "list", label: "List", glyph: "≡" },
  ];
  return (
    <div className="hidden rounded-md border border-rule bg-paper p-0.5 md:flex">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.label}
          onClick={() => onChange(o.id)}
          className={clsx(
            "flex h-7 w-8 items-center justify-center rounded-[6px] font-sans text-[13px] transition-colors duration-150 ease-out",
            value === o.id
              ? "bg-paper-raised text-ink shadow-sm"
              : "text-ink-faint hover:text-ink",
          )}
          aria-pressed={value === o.id}
        >
          {o.glyph}
        </button>
      ))}
    </div>
  );
}

function SortPicker({
  value,
  onChange,
}: {
  value: Sort;
  onChange: (s: Sort) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper px-2.5 py-1.5 font-sans text-[12px] text-ink-muted hover:text-ink"
      >
        <Icon icon={Filter} size={12} />
        <span className="hidden sm:inline">{SORT_LABEL[value]}</span>
        <Icon icon={ChevronDown} size={12} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-md border border-rule bg-paper-raised py-1 shadow-modal"
          onMouseLeave={() => setOpen(false)}
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className={clsx(
                "flex w-full items-center px-3 py-1.5 text-left font-sans text-[12.5px] transition-colors",
                value === k
                  ? "bg-butter text-ink"
                  : "text-ink-muted hover:bg-rule/40 hover:text-ink",
              )}
            >
              {SORT_LABEL[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="py-16 text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
        pulling your shelf
      </span>
      <div className="mt-3 inline-flex text-ink-muted">
        <span className="bf-dot" />
        <span className="bf-dot" />
        <span className="bf-dot" />
      </div>
    </div>
  );
}

function EmptyShelf({ searching }: { searching: boolean }) {
  if (searching) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border border-dashed border-rule" />
        <div className="font-display text-[19px] italic text-ink-muted">
          Nothing matching that query yet.
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl py-16 md:py-20">
      <div className="relative mx-auto mb-8 h-40 w-40">
        <div className="absolute inset-0 rotate-[-5deg] rounded-lg border border-rule bg-paper-raised shadow-card" />
        <div className="absolute inset-0 rotate-[3deg] rounded-lg border border-rule bg-paper-raised shadow-card" />
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-rule bg-paper-raised p-4 shadow-card">
          <div className="mb-2 h-1 w-12 rounded-full bg-terracotta" />
          <div className="mb-1 h-2 w-24 rounded-full bg-rule" />
          <div className="mb-3 h-2 w-20 rounded-full bg-rule" />
          <div className="h-3 w-28 rounded-full bg-butter" />
        </div>
      </div>
      <div className="text-center">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta">
          An empty shelf, waiting
        </div>
        <h2 className="mb-3 font-display text-[26px] font-semibold leading-tight tracking-[-0.015em] text-ink [text-wrap:balance]">
          Save your first piece — I’ll clean it up and tuck it in.
        </h2>
        <p className="font-display text-[15px] italic text-ink-muted [text-wrap:pretty]">
          Paste a URL in the bar above, or drop the BrowseFellow bookmarklet on
          your desktop browser for one-click saves.
        </p>
      </div>
    </div>
  );
}
