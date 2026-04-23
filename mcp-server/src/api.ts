// Thin wrapper around BrowseFellow's /api/agent/* REST endpoints.
// Everything this module returns is the raw JSON from the backend —
// tool handlers in tools.ts format it for MCP content output.

export type AgentSearchResult = {
  query: string;
  count: number;
  results: AgentArticle[];
};

export type AgentArticle = {
  id: number;
  title: string;
  url: string;
  site_name: string | null;
  excerpt: string;
  summary: string | null;
  tags: string[];
  created_at: string;
  similarity?: number;
  highlights: { text: string; note: string | null }[];
};

export type AgentArticleFull = {
  id: number;
  title: string;
  url: string;
  site_name: string | null;
  author: string | null;
  published: string | null;
  excerpt: string | null;
  summary_short: string | null;
  summary_long: string | null;
  tags: string[];
  word_count: number;
  read_time_min: number;
  created_at: string;
  content: string;
  content_truncated: boolean;
  highlights: { text: string; note: string | null }[];
};

export type AgentHighlightsResult = {
  query: string;
  count: number;
  results: {
    id: number;
    text: string;
    note: string | null;
    created_at: string;
    article: {
      id: number;
      title: string;
      url: string;
      site_name: string | null;
    };
  }[];
};

export class BrowseFellowClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {
    if (!token.startsWith("bft_")) {
      throw new Error(
        "BROWSEFELLOW_TOKEN must start with 'bft_' — generate one at https://browsefellow.com/settings → AI tools",
      );
    }
  }

  private async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(this.baseUrl.replace(/\/+$/, "") + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `BrowseFellow API ${res.status}: ${text.slice(0, 200) || res.statusText}`,
      );
    }
    return res.json() as Promise<T>;
  }

  searchLibrary(query: string, limit = 10): Promise<AgentSearchResult> {
    return this.get<AgentSearchResult>("/api/agent/search", { q: query, limit });
  }

  getArticle(articleId: number): Promise<AgentArticleFull> {
    return this.get<AgentArticleFull>(`/api/agent/article/${articleId}`);
  }

  searchHighlights(query?: string, limit = 20): Promise<AgentHighlightsResult> {
    return this.get<AgentHighlightsResult>("/api/agent/highlights", { q: query, limit });
  }
}
