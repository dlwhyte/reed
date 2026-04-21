import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { HighlightWithArticle } from "../lib/api";
import { api } from "../lib/api";
import { Wordmark } from "../components/primitives/Wordmark";
import { Icon } from "../components/primitives/Icon";
import { IconButton } from "../components/primitives/IconButton";
import { relativeAge } from "../lib/article";
import {
  downloadBlob,
  highlightsToMarkdown,
} from "../lib/exportHighlights";

type GroupedByArticle = {
  articleId: number;
  title: string;
  site: string | null;
  url: string;
  highlights: HighlightWithArticle[];
};

export default function Highlights() {
  const [rows, setRows] = useState<HighlightWithArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api
      .allHighlights()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  async function remove(id: number) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    try {
      await api.removeHighlight(id);
    } catch {
      setRows(prev);
    }
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.text.toLowerCase().includes(needle) ||
        r.article_title.toLowerCase().includes(needle) ||
        (r.note || "").toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const grouped = useMemo<GroupedByArticle[]>(() => {
    const byId = new Map<number, GroupedByArticle>();
    for (const h of visible) {
      const existing = byId.get(h.article_id);
      if (existing) {
        existing.highlights.push(h);
      } else {
        byId.set(h.article_id, {
          articleId: h.article_id,
          title: h.article_title,
          site: h.article_site,
          url: h.article_url,
          highlights: [h],
        });
      }
    }
    // Keep insertion order (rows come newest-first from backend).
    return Array.from(byId.values());
  }, [visible]);

  return (
    <div className="min-h-screen bg-paper paper-noise text-ink">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/80 backdrop-blur pt-safe">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-5 md:px-8">
          <Link to="/" aria-label="Back to library">
            <IconButton icon={ArrowLeft} label="Back to library" />
          </Link>
          <Wordmark size="md" />
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:inline">
            highlights
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 pb-24 pt-8 md:px-8">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink [text-wrap:balance]">
            What you’ve underlined
          </h1>
          {!loading && (
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {rows.length}{" "}
              {rows.length === 1 ? "highlight" : "highlights"}
            </div>
          )}
        </div>
        <p className="mt-2 font-display text-[15px] italic text-ink-muted">
          Every passage you marked, grouped by the page you pulled it from.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-[240px] flex-1 items-center gap-2.5 rounded-lg border border-rule bg-paper-raised px-3.5 py-2.5">
            <Icon icon={Search} size={16} className="shrink-0 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="search your highlights…"
              className="min-w-0 flex-1 bg-transparent font-sans text-[14px] text-ink placeholder:text-ink-faint outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear"
                className="text-ink-muted hover:text-ink"
              >
                <Icon icon={X} size={14} />
              </button>
            )}
          </div>
          <ExportMenu rows={rows} />
        </div>

        <div className="mt-7 space-y-8">
          {loading ? (
            <div className="py-16 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
                gathering your highlights
              </span>
              <div className="mt-3 inline-flex text-ink-muted">
                <span className="bf-dot" />
                <span className="bf-dot" />
                <span className="bf-dot" />
              </div>
            </div>
          ) : grouped.length === 0 ? (
            <EmptyHighlights searching={!!q} />
          ) : (
            grouped.map((g) => <ArticleGroup key={g.articleId} group={g} onRemove={remove} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleGroup({
  group,
  onRemove,
}: {
  group: GroupedByArticle;
  onRemove: (id: number) => void;
}) {
  return (
    <section className="rounded-xl border border-rule bg-paper-raised p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          to={`/read/${group.articleId}`}
          className="font-display text-[22px] font-semibold leading-snug tracking-[-0.015em] text-ink hover:text-terracotta"
        >
          {group.title}
        </Link>
        {group.site && (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            {group.site}
          </span>
        )}
      </div>
      <ul className="space-y-3">
        {group.highlights.map((h) => (
          <li
            key={h.id}
            className="group relative rounded-lg border-l-2 border-terracotta bg-butter/40 py-3 pl-4 pr-10"
          >
            <Link
              to={`/read/${group.articleId}`}
              className="block font-display text-[15px] italic leading-[1.55] text-ink [text-wrap:pretty]"
            >
              “{h.text}”
            </Link>
            {h.note && (
              <div className="mt-1.5 font-sans text-[12.5px] text-ink-muted [text-wrap:pretty]">
                — {h.note}
              </div>
            )}
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
              {relativeAge(h.created_at)} ago
            </div>
            <button
              type="button"
              onClick={() => onRemove(h.id)}
              title="Remove highlight"
              aria-label="Remove highlight"
              className="absolute right-2 top-2 rounded-md p-1.5 text-ink-faint opacity-0 transition-opacity duration-150 hover:bg-terracotta-soft hover:text-terracotta group-hover:opacity-100"
            >
              <Icon icon={Trash2} size={12} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExportMenu({ rows }: { rows: HighlightWithArticle[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const disabled = rows.length === 0;

  async function copyMd() {
    try {
      await navigator.clipboard.writeText(highlightsToMarkdown(rows));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
    setOpen(false);
  }

  function downloadMd() {
    downloadBlob(
      `browsefellow-highlights-${today()}.md`,
      highlightsToMarkdown(rows),
      "text/markdown;charset=utf-8",
    );
    setOpen(false);
  }

  function downloadJson() {
    downloadBlob(
      `browsefellow-highlights-${today()}.json`,
      JSON.stringify(rows, null, 2),
      "application/json;charset=utf-8",
    );
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rule bg-paper-raised px-3.5 py-2.5 font-sans text-[13px] font-medium transition-colors duration-150 " +
          (disabled
            ? "cursor-not-allowed text-ink-faint"
            : "text-ink-muted hover:text-ink")
        }
      >
        {copied ? (
          <>
            <Icon icon={Check} size={14} className="text-olive" />
            Copied
          </>
        ) : (
          <>
            <Icon icon={Download} size={14} />
            Export
            <Icon icon={ChevronDown} size={12} />
          </>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-md border border-rule bg-paper-raised shadow-modal">
            <ExportItem icon={Copy} onClick={copyMd}>
              Copy as Markdown
            </ExportItem>
            <ExportItem icon={Download} onClick={downloadMd}>
              Download .md
            </ExportItem>
            <ExportItem icon={Download} onClick={downloadJson}>
              Download .json
            </ExportItem>
          </div>
        </>
      )}
    </div>
  );
}

function ExportItem({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: typeof Copy;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-sans text-[13px] text-ink-muted hover:bg-rule/40 hover:text-ink"
    >
      <Icon icon={icon} size={13} />
      {children}
    </button>
  );
}

function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function EmptyHighlights({ searching }: { searching: boolean }) {
  return (
    <div className="mx-auto max-w-xl py-14 text-center">
      <div
        className="mx-auto mb-6 inline-block rounded-sm bg-butter px-3 py-1 font-display italic text-[16px] text-ink"
        aria-hidden
      >
        nothing underlined yet
      </div>
      <div className="font-display text-[17px] italic text-ink-muted [text-wrap:pretty]">
        {searching
          ? "No highlights match that search."
          : "Select any passage while reading to mark it — your underlines collect here."}
      </div>
    </div>
  );
}
