import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, X } from "lucide-react";
import { api } from "../lib/api";
import { Wordmark } from "../components/primitives/Wordmark";
import { Icon } from "../components/primitives/Icon";
import { IconButton } from "../components/primitives/IconButton";

type TagRow = { tag: string; count: number };
type SortBy = "count" | "alpha";

export default function Tags() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortBy>("count");

  useEffect(() => {
    api
      .tags()
      .then((t) => setTags(t))
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  }, []);

  const total = useMemo(() => tags.reduce((s, t) => s + t.count, 0), [tags]);
  const maxCount = useMemo(
    () => tags.reduce((m, t) => (t.count > m ? t.count : m), 0),
    [tags],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = needle
      ? tags.filter((t) => t.tag.toLowerCase().includes(needle))
      : tags.slice();
    list.sort((a, b) =>
      sort === "count" ? b.count - a.count : a.tag.localeCompare(b.tag),
    );
    return list;
  }, [tags, q, sort]);

  return (
    <div className="min-h-screen bg-paper paper-noise text-ink">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/80 backdrop-blur pt-safe">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-5 md:px-8">
          <Link to="/" aria-label="Back to library">
            <IconButton icon={ArrowLeft} label="Back to library" />
          </Link>
          <Wordmark size="md" />
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:inline">
            tags
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 pb-24 pt-8 md:px-8">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink [text-wrap:balance]">
            Every tag on your shelf
          </h1>
          {!loading && (
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {tags.length} tags · {total} mentions
            </div>
          )}
        </div>
        <p className="mt-2 font-display text-[15px] italic text-ink-muted">
          Sorted by how much you’ve been reading. Click one to go back to the
          shelf, filtered.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <div className="flex flex-1 items-center gap-2.5 rounded-lg border border-rule bg-paper-raised px-3.5 py-2.5 min-w-[240px]">
            <Icon icon={Search} size={16} className="shrink-0 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="filter tags…"
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
          <div className="flex rounded-md border border-rule bg-paper p-0.5">
            <SortButton
              active={sort === "count"}
              onClick={() => setSort("count")}
              label="Frequency"
            />
            <SortButton
              active={sort === "alpha"}
              onClick={() => setSort("alpha")}
              label="A → Z"
            />
          </div>
        </div>

        <div className="mt-7">
          {loading ? (
            <div className="py-16 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
                gathering your tags
              </span>
              <div className="mt-3 inline-flex text-ink-muted">
                <span className="bf-dot" />
                <span className="bf-dot" />
                <span className="bf-dot" />
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center font-display text-[17px] italic text-ink-muted">
              {q
                ? "No tags match that filter."
                : "No tags yet — save a few articles first."}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {visible.map((t) => (
                <li key={t.tag}>
                  <Link
                    to={`/?tag=${encodeURIComponent(t.tag)}`}
                    className="group flex items-baseline gap-3 border-b border-dashed border-rule py-3"
                  >
                    <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                      #{String(t.count).padStart(2, "0")}
                    </span>
                    <span className="flex-1 truncate font-display text-[17px] font-medium leading-snug text-ink group-hover:text-terracotta">
                      {t.tag}
                    </span>
                    <div
                      className="hidden h-1.5 overflow-hidden rounded-full bg-paper-deep sm:block sm:w-24"
                      aria-hidden
                    >
                      <div
                        className="h-full bg-terracotta/70 transition-all duration-150 group-hover:bg-terracotta"
                        style={{
                          width: `${Math.max(6, Math.round((t.count / Math.max(1, maxCount)) * 100))}%`,
                        }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-[6px] px-2.5 py-1 font-sans text-[12px] transition-colors duration-150 " +
        (active
          ? "bg-paper-raised text-ink shadow-sm"
          : "text-ink-faint hover:text-ink")
      }
    >
      {label}
    </button>
  );
}
