import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Coffee,
  FileDown,
  Hash,
  Highlighter,
  Library as LibraryIcon,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
} from "lucide-react";
import { clsx } from "clsx";
import { api, Article } from "../lib/api";
import { useStore } from "../store";
import { toView } from "../lib/article";
import { Icon } from "./primitives/Icon";

type CommandItem =
  | {
      kind: "nav";
      id: string;
      title: string;
      hint?: string;
      icon: LucideIcon;
      action: () => void;
    }
  | {
      kind: "article";
      id: string;
      title: string;
      hint?: string;
      icon: LucideIcon;
      action: () => void;
    };

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Article[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { prefs, setPrefs } = useStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search. Keyword only (fast, no Cohere dependency).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const id = window.setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.search(q);
        setResults(r.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 140);
    return () => window.clearTimeout(id);
  }, [query]);

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();

    const navs: CommandItem[] = [
      {
        kind: "nav",
        id: "go-library",
        title: "Go to library",
        hint: "the shelf",
        icon: LibraryIcon,
        action: () => {
          navigate("/");
          onClose();
        },
      },
      {
        kind: "nav",
        id: "go-highlights",
        title: "Go to highlights",
        hint: "every passage you marked",
        icon: Highlighter,
        action: () => {
          navigate("/highlights");
          onClose();
        },
      },
      {
        kind: "nav",
        id: "go-tags",
        title: "Go to tags",
        hint: "every tag on the shelf",
        icon: Hash,
        action: () => {
          navigate("/tags");
          onClose();
        },
      },
      {
        kind: "nav",
        id: "go-settings",
        title: "Open settings",
        hint: "reader, save, backend",
        icon: SettingsIcon,
        action: () => {
          navigate("/settings");
          onClose();
        },
      },
      {
        kind: "nav",
        id: "cycle-theme",
        title: `Cycle theme · now ${prefs.theme}`,
        hint: "paper · sepia · dusk",
        icon:
          prefs.theme === "light"
            ? Sun
            : prefs.theme === "sepia"
            ? Coffee
            : Moon,
        action: () => {
          setPrefs({
            theme:
              prefs.theme === "light"
                ? "sepia"
                : prefs.theme === "sepia"
                ? "dark"
                : "light",
          });
          onClose();
        },
      },
      {
        kind: "nav",
        id: "toggle-font",
        title: `Toggle font · now ${prefs.font}`,
        icon: FileDown,
        action: () => {
          setPrefs({ font: prefs.font === "serif" ? "sans" : "serif" });
          onClose();
        },
      },
    ];

    const filteredNavs = q
      ? navs.filter((n) => n.title.toLowerCase().includes(q) || (n.hint ?? "").toLowerCase().includes(q))
      : navs;

    const articles: CommandItem[] = results.map((a) => {
      const v = toView(a);
      return {
        kind: "article",
        id: `article-${a.id}`,
        title: a.title,
        hint: [v.site, `${v.readMin} min`].filter(Boolean).join(" · "),
        icon: BookOpen,
        action: () => {
          navigate(`/read/${a.id}`);
          onClose();
        },
      };
    });

    return q ? [...articles, ...filteredNavs] : filteredNavs;
  }, [query, results, prefs.theme, prefs.font, navigate, setPrefs, onClose]);

  useEffect(() => {
    if (selected >= items.length) setSelected(0);
  }, [items.length, selected]);

  useEffect(() => {
    // Scroll selected row into view when using arrow keys.
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${selected}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[selected]?.action();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div
      className="bf-fade-enter fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-rule bg-paper-raised shadow-modal"
      >
        <div className="flex items-center gap-2.5 border-b border-rule px-4 py-3">
          <Icon icon={Search} size={16} className="text-ink-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onKey}
            placeholder="search your shelf or jump to a page…"
            className="min-w-0 flex-1 bg-transparent font-sans text-[15px] text-ink placeholder:text-ink-faint outline-none"
          />
          {searching && (
            <span className="inline-flex text-ink-faint" aria-hidden>
              <span className="bf-dot" />
              <span className="bf-dot" />
              <span className="bf-dot" />
            </span>
          )}
          <Kbd>esc</Kbd>
        </div>
        <div
          ref={listRef}
          className="max-h-[55vh] overflow-y-auto py-1"
        >
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center font-display text-[14px] italic text-ink-muted">
              {query ? "No matches on your shelf." : "Start typing to search."}
            </div>
          ) : (
            <>
              {query.trim() && results.length > 0 && (
                <SectionLabel>
                  <Sparkles className="h-3 w-3" /> Your shelf
                </SectionLabel>
              )}
              {items.map((it, i) => {
                const isArticleFirst =
                  i === 0 && it.kind === "article";
                const isNavStart =
                  it.kind === "nav" &&
                  (i === 0 || items[i - 1]?.kind === "article");
                return (
                  <div key={it.id}>
                    {isNavStart && !isArticleFirst && query.trim() === "" && (
                      <SectionLabel>Quick actions</SectionLabel>
                    )}
                    {isNavStart && query.trim() !== "" && (
                      <SectionLabel>Actions</SectionLabel>
                    )}
                    <Row
                      item={it}
                      selected={i === selected}
                      index={i}
                      onMouseEnter={() => setSelected(i)}
                      onClick={() => it.action()}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
          <Legend><Kbd>↑</Kbd><Kbd>↓</Kbd> move</Legend>
          <Legend><Kbd>⏎</Kbd> open</Legend>
          <Legend><Kbd>esc</Kbd> close</Legend>
        </div>
      </div>
    </div>
  );
}

function Row({
  item,
  selected,
  index,
  onMouseEnter,
  onClick,
}: {
  item: CommandItem;
  selected: boolean;
  index: number;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100",
        selected ? "bg-butter/60" : "hover:bg-rule/30",
      )}
    >
      <Icon
        icon={item.icon}
        size={15}
        className={selected ? "text-terracotta" : "text-ink-muted"}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[15px] font-medium leading-tight text-ink">
          {item.title}
        </div>
        {item.hint && (
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
            {item.hint}
          </div>
        )}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
        {item.kind === "article" ? "open" : "go"}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-rule bg-paper px-1.5 py-px font-mono text-[10px] font-medium text-ink-muted shadow-[0_1px_0_rgba(43,35,32,0.08)]">
      {children}
    </kbd>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1">{children}</span>;
}
