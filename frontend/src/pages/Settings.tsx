import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { clsx } from "clsx";
import { api, type UsageBucket, type UsageSnapshot } from "../lib/api";
import { useStore } from "../store";
import { Wordmark } from "../components/primitives/Wordmark";
import { Icon } from "../components/primitives/Icon";
import { IconButton } from "../components/primitives/IconButton";
import { PocketImport } from "../components/PocketImport";

type TabId = "reader" | "save" | "status" | "usage";

const TABS: { id: TabId; label: string }[] = [
  { id: "reader", label: "Reader" },
  { id: "save", label: "Save from anywhere" },
  { id: "status", label: "Backend · models" },
  { id: "usage", label: "Cohere usage" },
];

export default function Settings() {
  const { prefs, setPrefs } = useStore();
  const [tab, setTab] = useState<TabId>("reader");
  const [cfg, setCfg] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    api.config().then(setCfg).catch(() => {});
    api.health().then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-paper paper-noise text-ink">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/80 backdrop-blur pt-safe">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-5 md:px-8">
          <Link to="/" aria-label="Back to library">
            <IconButton icon={ArrowLeft} label="Back to library" />
          </Link>
          <Wordmark size="md" />
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:inline">
            settings
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 md:px-8">
        <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink [text-wrap:balance]">
          Tune the shelf to your taste
        </h1>
        <p className="mt-2 font-display text-[15px] italic text-ink-muted">
          Reader defaults, save shortcuts, and what’s wired up in the backend.
        </p>

        <nav className="mt-6 flex gap-1.5 border-b border-dashed border-rule">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                "-mb-px rounded-t-md border-b-2 px-3 py-2 font-sans text-[13px] font-medium transition-colors duration-150",
                tab === t.id
                  ? "border-terracotta text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-7">
          {tab === "reader" && <ReaderPrefs prefs={prefs} setPrefs={setPrefs} />}
          {tab === "save" && <SavePrefs />}
          {tab === "status" && <StatusPanel cfg={cfg} health={health} />}
          {tab === "usage" && <UsagePanel />}
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-rule bg-paper-raised p-5 md:p-6">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta">
        {title}
      </div>
      {hint && (
        <p className="mb-4 font-display text-[14px] italic text-ink-muted">
          {hint}
        </p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-[13px] text-ink-muted">{children}</span>
  );
}

type Prefs = {
  theme: "light" | "dark" | "sepia";
  font: "serif" | "sans";
  fontSize: number;
  width: number;
};

function ReaderPrefs({
  prefs,
  setPrefs,
}: {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
}) {
  const themes: { id: "light" | "sepia" | "dark"; label: string; preview: string }[] = [
    { id: "light", label: "Paper", preview: "#F8F1E4" },
    { id: "sepia", label: "Sepia", preview: "#EFE3CA" },
    { id: "dark", label: "Dusk", preview: "#171310" },
  ];
  const fonts: { id: "serif" | "sans"; label: string; sample: string; className: string }[] = [
    { id: "serif", label: "Serif", sample: "Aa — bookish", className: "font-display" },
    { id: "sans", label: "Sans", sample: "Aa — crisp", className: "font-sans" },
  ];

  return (
    <div className="space-y-5">
      <Card title="Theme" hint="Only the reader changes. The shelf stays warm paper.">
        <div className="grid grid-cols-3 gap-2.5">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPrefs({ theme: t.id })}
              className={clsx(
                "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors duration-150",
                prefs.theme === t.id
                  ? "border-ink"
                  : "border-rule hover:border-ink-muted",
              )}
            >
              <span
                className="h-10 w-full rounded-md border border-rule"
                style={{ background: t.preview }}
              />
              <span className="font-sans text-[13px] font-medium text-ink">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Font" hint="Body font for the article view.">
        <div className="grid grid-cols-2 gap-2.5">
          {fonts.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPrefs({ font: f.id })}
              className={clsx(
                "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors duration-150",
                prefs.font === f.id
                  ? "border-ink"
                  : "border-rule hover:border-ink-muted",
              )}
            >
              <span className="font-sans text-[13px] font-medium text-ink">
                {f.label}
              </span>
              <span className={clsx("text-[18px] text-ink-muted", f.className)}>
                {f.sample}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Size" hint="14–24 px. Shortcuts — and + work in the reader.">
        <div className="flex items-center gap-4">
          <RowLabel>Size</RowLabel>
          <span className="w-12 font-mono text-[12px] text-ink">
            {prefs.fontSize}px
          </span>
          <input
            type="range"
            min={14}
            max={24}
            value={prefs.fontSize}
            onChange={(e) => setPrefs({ fontSize: Number(e.target.value) })}
            className="flex-1 accent-terracotta"
          />
        </div>
        <div className="flex items-center gap-4">
          <RowLabel>Column width</RowLabel>
          <span className="w-12 font-mono text-[12px] text-ink">
            {prefs.width}px
          </span>
          <input
            type="range"
            min={520}
            max={880}
            step={20}
            value={prefs.width}
            onChange={(e) => setPrefs({ width: Number(e.target.value) })}
            className="flex-1 accent-terracotta"
          />
        </div>
      </Card>
    </div>
  );
}

function SavePrefs() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const saveUrl = `${origin}/api/save`;
  const bookmarklet = `javascript:(()=>{window.open('${origin}/save?url='+encodeURIComponent(location.href),'browsefellow_save','width=420,height=220,top=100,left=100')})();`;
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-5">
      <Card
        title="iOS Share Sheet"
        hint="One-time Shortcuts setup so “Save to BrowseFellow” appears in the Share Sheet on your iPhone."
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-rule bg-paper px-3 py-2.5">
          <div className="min-w-0">
            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              Save endpoint
            </div>
            <code className="break-all font-mono text-[12px] text-ink">
              {saveUrl}
            </code>
          </div>
          <button
            type="button"
            onClick={() => copy(saveUrl, "save")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-rule bg-paper-raised px-3 py-1.5 font-sans text-[12px] font-medium text-ink-muted hover:text-ink"
          >
            {copied === "save" ? (
              <>
                <Icon icon={Check} size={12} /> Copied
              </>
            ) : (
              <>
                <Icon icon={Copy} size={12} /> Copy
              </>
            )}
          </button>
        </div>

        <ol className="list-decimal space-y-1.5 pl-5 font-sans text-[13px] leading-[1.7] text-ink-muted">
          <li>
            Open the <strong className="text-ink">Shortcuts</strong> app on your
            iPhone.
          </li>
          <li>
            Tap <strong className="text-ink">+</strong>, then{" "}
            <strong className="text-ink">Add Action</strong>.
          </li>
          <li>
            Search and add{" "}
            <strong className="text-ink">Get Contents of URL</strong>.
          </li>
          <li>Paste the save endpoint into the URL field.</li>
          <li>
            Tap <strong className="text-ink">Show More</strong>. Set Method →
            POST, Request Body → JSON. Add a field: key{" "}
            <code className="font-mono">url</code>, value ={" "}
            <strong className="text-ink">Shortcut Input</strong>.
          </li>
          <li>
            Tap <strong className="text-ink">ⓘ</strong> → enable{" "}
            <strong className="text-ink">Use with Share Sheet</strong> → check
            only <strong className="text-ink">URLs</strong>.
          </li>
          <li>
            Rename to{" "}
            <strong className="text-ink">Save to BrowseFellow</strong>.
          </li>
        </ol>
      </Card>

      <Card
        title="Desktop bookmarklet"
        hint="Drag this to your browser’s bookmarks bar. Click on any page to save."
      >
        <a
          href={bookmarklet}
          onClick={(e) => e.preventDefault()}
          className="inline-flex items-center gap-2 rounded-pill bg-terracotta px-4 py-2 font-sans text-[13px] font-medium text-white shadow-pill hover:brightness-105"
        >
          Save to BrowseFellow
        </a>
      </Card>

      <Card
        title="Import from Pocket"
        hint="Bring your old shelf over. I’ll keep tags and mirror archived state."
      >
        <PocketImport />
      </Card>
    </div>
  );
}

function StatusPanel({ cfg, health }: { cfg: any; health: any }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Backend",
      value: <StatusPill ok={!!health?.ok} okLabel="connected" offLabel="not reachable" />,
    },
    {
      label: "LLM features",
      value: (
        <StatusPill
          ok={!!cfg?.llm_ready}
          okLabel="enabled"
          offLabel="disabled — set COHERE_API_KEY"
        />
      ),
    },
    {
      label: "Web search",
      value: (
        <StatusPill
          ok={!!cfg?.web_search_ready}
          okLabel="Tavily enabled"
          offLabel="shelf-only"
        />
      ),
    },
    {
      label: "Chat model",
      value: (
        <span className="font-mono text-[12px] text-ink">
          {cfg?.chat_model || "—"}
        </span>
      ),
    },
    {
      label: "Embed model",
      value: (
        <span className="font-mono text-[12px] text-ink">
          {cfg?.embed_model || "—"}
        </span>
      ),
    },
    {
      label: "Port",
      value: (
        <span className="font-mono text-[12px] text-ink">{cfg?.port || "—"}</span>
      ),
    },
  ];

  return (
    <Card title="Runtime" hint="Live values from /api/config and /api/health.">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="col-span-2 grid grid-cols-subgrid items-center border-b border-dashed border-rule pb-2.5 last:border-none last:pb-0"
          >
            <dt className="font-sans text-[13px] text-ink-muted">{r.label}</dt>
            <dd className="font-sans text-[13px] text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function StatusPill({
  ok,
  okLabel,
  offLabel,
}: {
  ok: boolean;
  okLabel: string;
  offLabel: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        ok
          ? "bg-olive-soft text-olive"
          : "bg-terracotta-soft text-terracotta",
      )}
    >
      <span
        className={clsx(
          "inline-block h-1.5 w-1.5 rounded-full",
          ok ? "bg-olive" : "bg-terracotta",
        )}
      />
      {ok ? okLabel : offLabel}
    </span>
  );
}

const ENDPOINT_LABELS: Record<string, string> = {
  save_summarize: "Save · summary + tags",
  save_embed: "Save · embedding",
  chat: "Chat with article",
  agent: "Research agent",
  agent_search_library: "Research agent · library search",
  semantic_search: "Semantic search (⌘K)",
  embed: "Embedding (other)",
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1) + "k";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "k";
  return n.toLocaleString();
}

function fmtUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return "$" + n.toFixed(n < 1 ? 3 : 2);
}

function UsagePanel() {
  const [snap, setSnap] = useState<UsageSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setSnap(await api.usage());
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load usage");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (err) {
    return (
      <Card title="Cohere usage" hint="Token spend and estimated cost, tallied locally.">
        <p className="font-sans text-[13px] text-terracotta">{err}</p>
      </Card>
    );
  }
  if (!snap) {
    return (
      <Card title="Cohere usage" hint="Token spend and estimated cost, tallied locally.">
        <p className="font-sans text-[13px] text-ink-muted">Loading…</p>
      </Card>
    );
  }

  const buckets: { id: "today" | "month" | "all_time"; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "month", label: "This month" },
    { id: "all_time", label: "All time" },
  ];

  const topEndpoint = (() => {
    const m = snap.month.by_endpoint;
    const entries = Object.entries(m);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1].usd - a[1].usd);
    const [name, v] = entries[0];
    const share = snap.month.usd ? (v.usd / snap.month.usd) * 100 : 0;
    return { name, share };
  })();

  return (
    <div className="space-y-5">
      <Card
        title="Cohere usage"
        hint="Tallied locally from every call to chat/embed. Estimate uses Cohere's list prices — your actual invoice is authoritative."
      >
        <div className="grid grid-cols-3 gap-3">
          {buckets.map((b) => {
            const v = snap[b.id];
            return (
              <div
                key={b.id}
                className="rounded-lg border border-rule bg-paper p-3"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  {b.label}
                </div>
                <div className="mt-1 font-display text-[22px] font-semibold leading-tight text-ink">
                  {fmtUsd(v.usd)}
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink-muted">
                  {fmtNum(v.input_tokens)} in · {fmtNum(v.output_tokens)} out
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-faint">
                  {v.calls} call{v.calls === 1 ? "" : "s"}
                </div>
              </div>
            );
          })}
        </div>

        {topEndpoint && (
          <p className="mt-1 font-display text-[13px] italic text-ink-muted">
            Biggest driver this month:{" "}
            <strong className="not-italic text-ink">
              {ENDPOINT_LABELS[topEndpoint.name] || topEndpoint.name}
            </strong>{" "}
            ({topEndpoint.share.toFixed(0)}% of spend).
          </p>
        )}

        <button
          type="button"
          onClick={refresh}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-rule bg-paper-raised px-3 py-1.5 font-sans text-[12px] font-medium text-ink-muted hover:text-ink"
        >
          Refresh
        </button>
      </Card>

      <Card
        title="This month · by feature"
        hint="Where the tokens went. Research agent runs a tool loop, so it typically costs 3-8× a single chat."
      >
        <EndpointBreakdown bucket={snap.month} />
      </Card>
    </div>
  );
}

function EndpointBreakdown({ bucket }: { bucket: UsageBucket }) {
  const entries = Object.entries(bucket.by_endpoint);
  if (!entries.length) {
    return (
      <p className="font-sans text-[13px] text-ink-muted">
        No Cohere calls yet this month.
      </p>
    );
  }
  entries.sort((a, b) => b[1].usd - a[1].usd);
  const total = bucket.usd || 1;

  return (
    <div className="space-y-2">
      {entries.map(([name, v]) => {
        const pct = (v.usd / total) * 100;
        return (
          <div key={name}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-sans text-[13px] text-ink">
                {ENDPOINT_LABELS[name] || name}
              </span>
              <span className="font-mono text-[12px] text-ink-muted">
                {fmtUsd(v.usd)} · {v.calls} call{v.calls === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-rule/40">
              <div
                className="h-full bg-terracotta"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <div className="mt-1 font-mono text-[10px] text-ink-faint">
              {fmtNum(v.input_tokens)} input · {fmtNum(v.output_tokens)} output
            </div>
          </div>
        );
      })}
    </div>
  );
}
