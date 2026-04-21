import { Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  Star,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";
import { Article, api } from "../lib/api";
import { toView } from "../lib/article";
import { Cover } from "./primitives/Cover";
import { Icon } from "./primitives/Icon";

type Props = {
  article: Article;
  onChange: () => void;
  variant?: "hero" | "card" | "row";
};

export default function ArticleCard({
  article,
  onChange,
  variant = "card",
}: Props) {
  const v = toView(article);

  async function toggleFav(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await api.update(article.id, { is_favorite: !article.is_favorite });
    onChange();
  }
  async function toggleArchive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await api.update(article.id, { is_archived: !article.is_archived });
    onChange();
  }
  async function del(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Remove this from your shelf?")) return;
    await api.remove(article.id);
    onChange();
  }

  if (variant === "hero") {
    return (
      <Link
        to={`/read/${v.id}`}
        className="group grid grid-cols-1 md:grid-cols-[1.1fr_1.3fr] gap-6 rounded-xl border border-rule bg-paper-raised p-5 md:p-6 shadow-card transition-transform duration-150 ease-out hover:-translate-y-0.5"
      >
        <Cover title={v.title} imageUrl={v.imageUrl} seed={`${v.id}`} height={240} rounded={14} />
        <div className="flex min-w-0 flex-col pt-1">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
            <span className="h-px w-[18px] bg-terracotta" />
            Lead feature · saved {v.age} ago
          </div>
          <h2 className="mt-3 mb-2 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink [text-wrap:pretty]">
            {v.title}
          </h2>
          <div className="mb-3 font-sans text-[13px] text-ink-muted">
            {[v.author, v.site, `${v.readMin} min read`].filter(Boolean).join(" · ")}
          </div>
          {v.summary && (
            <p className="font-display italic text-[16px] leading-[1.5] text-ink-muted [text-wrap:pretty] m-0">
              {truncate(v.summary, 220)}
            </p>
          )}
          <div className="flex-1" />
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {v.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-pill bg-butter px-2 py-[3px] font-mono text-[10px] tracking-[0.03em] text-ink"
              >
                #{t}
              </span>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <QuickAction
                label={v.favorite ? "Unfavorite" : "Favorite"}
                onClick={toggleFav}
                active={v.favorite}
              >
                <Icon
                  icon={Star}
                  size={15}
                  fill={v.favorite ? "currentColor" : "none"}
                />
              </QuickAction>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "row") {
    return (
      <Link
        to={`/read/${v.id}`}
        className="group flex items-start gap-5 border-b border-dashed border-rule py-4 last:border-none"
      >
        <div className="w-12 shrink-0 pt-0.5 font-mono text-[11px] uppercase tracking-[0.05em] text-ink-faint">
          {v.age}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
              {v.site}
            </span>
            <span className="font-mono text-[10px] text-ink-faint">·</span>
            <span className="font-mono text-[10px] text-ink-faint">
              {v.readMin} min
            </span>
            {v.favorite && (
              <Icon
                icon={Star}
                size={11}
                className="text-terracotta"
                fill="currentColor"
              />
            )}
            <div className="flex-1" />
            <div className="hidden gap-1 md:flex">
              {v.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="font-mono text-[10px] text-ink-muted"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
          <div className="mb-1 font-display text-[19px] font-medium leading-[1.25] tracking-[-0.01em] text-ink [text-wrap:pretty]">
            {v.title}
          </div>
          {v.tldr && (
            <div className="line-clamp-1 font-sans text-[13px] leading-[1.5] text-ink-muted">
              {v.tldr}
            </div>
          )}
        </div>
      </Link>
    );
  }

  // Default: "card"
  return (
    <Link
      to={`/read/${v.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-rule bg-paper-raised transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card"
    >
      <Cover title={v.title} imageUrl={v.imageUrl} seed={`${v.id}`} height={120} rounded={0} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
          <span className="truncate max-w-[12rem]">{v.site}</span>
          <span>·</span>
          <span>{v.readMin}m</span>
          <span>·</span>
          <span>{v.age}</span>
          {v.favorite && (
            <Icon
              icon={Star}
              size={11}
              className="ml-auto text-terracotta"
              fill="currentColor"
            />
          )}
        </div>
        <h3 className="line-clamp-3 m-0 font-display text-[17px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink [text-wrap:pretty]">
          {v.title}
        </h3>
        {v.tldr && (
          <p className="line-clamp-2 m-0 font-sans text-[12.5px] leading-[1.45] text-ink-muted">
            {v.tldr}
          </p>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <div className="flex flex-wrap gap-1">
            {v.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-pill border border-rule bg-paper px-2 py-[2px] font-mono text-[9px] tracking-[0.03em] text-ink-muted"
              >
                #{t}
              </span>
            ))}
          </div>
          <div className="ml-auto flex gap-0.5 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
            <QuickAction
              label={v.favorite ? "Unfavorite" : "Favorite"}
              onClick={toggleFav}
              active={v.favorite}
            >
              <Icon
                icon={Star}
                size={14}
                fill={v.favorite ? "currentColor" : "none"}
              />
            </QuickAction>
            <QuickAction
              label={article.is_archived ? "Unarchive" : "Archive"}
              onClick={toggleArchive}
            >
              <Icon
                icon={article.is_archived ? ArchiveRestore : Archive}
                size={14}
              />
            </QuickAction>
            <QuickAction label="Remove" onClick={del} danger>
              <Icon icon={Trash2} size={14} />
            </QuickAction>
          </div>
        </div>
      </div>
    </Link>
  );
}

function QuickAction({
  children,
  label,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 ease-out",
        danger
          ? "text-ink-faint hover:bg-terracotta-soft hover:text-terracotta"
          : active
          ? "text-terracotta"
          : "text-ink-faint hover:bg-rule/60 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function truncate(s: string, max: number) {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}
