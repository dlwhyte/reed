import type { Article } from "./api";

/** Human age like "3d", "2w", "5mo" from an ISO string. */
export function relativeAge(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const m = 60_000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < h) return `${Math.max(1, Math.round(diff / m))}m`;
  if (diff < d) return `${Math.round(diff / h)}h`;
  if (diff < 7 * d) return `${Math.round(diff / d)}d`;
  if (diff < 30 * d) return `${Math.round(diff / (7 * d))}w`;
  if (diff < 365 * d) return `${Math.round(diff / (30 * d))}mo`;
  return `${Math.round(diff / (365 * d))}y`;
}

export type ArticleView = {
  id: number;
  title: string;
  author: string | null;
  site: string;
  readMin: number;
  age: string;
  summary: string;
  tldr: string;
  tags: string[];
  favorite: boolean;
  imageUrl: string | null;
};

/** Flattens the API Article into the shape the cards render. */
export function toView(a: Article): ArticleView {
  return {
    id: a.id,
    title: a.title,
    author: a.author,
    site: a.site_name || hostFromUrl(a.url),
    readMin: Math.max(1, a.read_time_min || 0),
    age: relativeAge(a.created_at),
    summary: a.summary_long || a.summary_short || a.excerpt || "",
    tldr: a.summary_short || a.excerpt || "",
    tags: a.tags || [],
    favorite: !!a.is_favorite,
    imageUrl: a.image_url,
  };
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
