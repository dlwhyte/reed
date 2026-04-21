export type Article = {
  id: number;
  url: string;
  title: string;
  author: string | null;
  site_name: string | null;
  published: string | null;
  excerpt: string | null;
  image_url: string | null;
  word_count: number;
  read_time_min: number;
  summary_short: string | null;
  summary_long: string | null;
  tags: string[];
  is_archived: number;
  is_favorite: number;
  progress: number;
  created_at: string;
  read_at: string | null;
  content?: string;
  similarity?: number;
};

// When running in the Capacitor native wrapper (iOS app), the frontend is
// loaded from the app bundle (not the reed backend), so relative /api URLs
// won't work. Point it at the Mac's Tailscale hostname instead.
// Override via localStorage.setItem("reed.backend", "http://..."); useful for
// friends pointing at their own mac, or after a hostname change.
const isNative = typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();
const DEFAULT_NATIVE_BASE = "http://ds-macbook-pro-2:8765";
const STORED = typeof window !== "undefined" ? localStorage.getItem("reed.backend") : null;
const ORIGIN = STORED || (isNative ? DEFAULT_NATIVE_BASE : "");
const BASE = ORIGIN + "/api";

async function j<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}

export type Highlight = {
  id: number;
  article_id: number;
  text: string;
  note: string | null;
  created_at: string;
};

export type HighlightWithArticle = Highlight & {
  article_title: string;
  article_site: string | null;
  article_url: string;
};

export type UsageBucket = {
  input_tokens: number;
  output_tokens: number;
  usd: number;
  calls: number;
  by_endpoint: Record<
    string,
    { input_tokens: number; output_tokens: number; usd: number; calls: number }
  >;
};

export type UsageSnapshot = {
  today: UsageBucket;
  month: UsageBucket;
  all_time: UsageBucket;
  pricing: Record<string, { input: number; output: number }>;
};

export const api = {
  health: () => j<{ ok: boolean; llm: boolean }>("/health"),
  config: () => j<{ llm_ready: boolean; enable_llm: boolean; web_search_ready: boolean; chat_model: string; embed_model: string; port: number }>("/config"),
  usage: () => j<UsageSnapshot>("/usage"),
  save: (url: string) => j<{ id: number; duplicate: boolean; title?: string }>("/save", { method: "POST", body: JSON.stringify({ url }) }),
  list: (state: string, tag?: string | null, sort = "newest") => {
    const qs = new URLSearchParams({ state, sort });
    if (tag) qs.set("tag", tag);
    return j<Article[]>(`/articles?${qs}`);
  },
  get: (id: number) => j<Article>(`/articles/${id}`),
  update: (id: number, patch: Partial<{ is_archived: boolean; is_favorite: boolean; progress: number; tags: string[] }>) =>
    j<{ ok: boolean }>(`/articles/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: number) => j<{ ok: boolean }>(`/articles/${id}`, { method: "DELETE" }),
  search: (q: string) => j<Article[]>(`/search?q=${encodeURIComponent(q)}`),
  semanticSearch: (q: string) => j<Article[]>(`/semantic-search?q=${encodeURIComponent(q)}`),
  similar: (id: number) => j<Article[]>(`/articles/${id}/similar`),
  tags: () => j<{ tag: string; count: number }[]>("/tags"),
  articleHighlights: (id: number) =>
    j<Highlight[]>(`/articles/${id}/highlights`),
  allHighlights: () => j<HighlightWithArticle[]>(`/highlights`),
  addHighlight: (id: number, text: string, note?: string | null) =>
    j<Highlight>(`/articles/${id}/highlights`, {
      method: "POST",
      body: JSON.stringify({ text, note: note ?? null }),
    }),
  removeHighlight: (highlightId: number) =>
    j<{ ok: boolean }>(`/highlights/${highlightId}`, { method: "DELETE" }),
};

export async function* chatStream(
  articleId: number,
  question: string,
  history: { role: string; content: string }[]
): AsyncGenerator<string> {
  const r = await fetch(`${BASE}/articles/${articleId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  if (!r.body) return;
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        const obj = JSON.parse(data);
        if (obj.delta) yield obj.delta;
        if (obj.error) yield `\n\n[error: ${obj.error}]`;
      } catch {}
    }
  }
}

export type ResearchEvent =
  | { type: "plan"; text: string }
  | { type: "tool_call"; name: string; args: any }
  | { type: "tool_result"; name: string; result_preview: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function* researchStream(
  articleId: number,
  question: string
): AsyncGenerator<ResearchEvent> {
  const r = await fetch(`${BASE}/articles/${articleId}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history: [] }),
  });
  if (!r.body) return;
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        yield JSON.parse(data);
      } catch {}
    }
  }
}
