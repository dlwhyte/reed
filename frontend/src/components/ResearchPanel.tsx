import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  FlaskConical,
  Globe,
  Library as LibraryIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { researchStream, ResearchEvent } from "../lib/api";
import { Composer } from "./panels/Composer";
import { Icon } from "./primitives/Icon";
import { TypingDots } from "./primitives/TypingDots";

const URL_RE = /(https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"])/g;
const CITE_RE = /\[(\d+)\]/g;

type Source = { n: number; url?: string; label: string };
type TraceEvent =
  | { kind: "plan"; text: string }
  | { kind: "tool_call"; name: string; args: unknown }
  | { kind: "tool_result"; name: string; preview: string };

const TOOL_ICONS: Record<string, LucideIcon> = {
  search_library: LibraryIcon,
  read_article: BookOpen,
  search_web: Globe,
};

const TOOL_LABELS: Record<string, string> = {
  search_library: "Searching your shelf",
  read_article: "Reading saved article",
  search_web: "Searching the web",
};

const SUGGESTIONS = [
  { label: "Find counter-arguments", query: "Find counter-arguments to this article's main claim." },
  { label: "What else in my shelf?", query: "What related pieces have I already saved?" },
  { label: "Latest on this topic", query: "What's the most recent news on this topic?" },
];

export default function ResearchPanel({
  articleId,
  llmReady,
  webReady,
}: {
  articleId: number;
  llmReady: boolean;
  webReady: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [trace, answer]);

  async function run() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setTrace([]);
    setAnswer("");
    setTraceOpen(true);
    try {
      for await (const ev of researchStream(articleId, q) as AsyncGenerator<ResearchEvent>) {
        if (ev.type === "plan") {
          setTrace((t) => [...t, { kind: "plan", text: ev.text }]);
        } else if (ev.type === "tool_call") {
          setTrace((t) => [...t, { kind: "tool_call", name: ev.name, args: ev.args }]);
        } else if (ev.type === "tool_result") {
          setTrace((t) => [...t, { kind: "tool_result", name: ev.name, preview: ev.result_preview }]);
        } else if (ev.type === "delta") {
          setAnswer((a) => a + ev.text);
          setTraceOpen(false);
        } else if (ev.type === "error") {
          setError(ev.message);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!llmReady) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-olive">
            research offline
          </div>
          <div className="mt-2 font-display text-[15px] italic text-ink-muted">
            Add <span className="font-mono not-italic">COHERE_API_KEY</span> to
            <br />
            <span className="font-mono not-italic">.env</span> and restart.
          </div>
        </div>
      </div>
    );
  }

  const showIntro = !busy && trace.length === 0 && !answer;
  const { body, sources } = parseAnswer(answer);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {!webReady && (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-rule bg-paper px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            <Icon icon={Globe} size={12} />
            shelf-only mode · add TAVILY_API_KEY for live web
          </div>
        )}

        {showIntro && (
          <div className="space-y-3">
            <p className="font-display text-[14px] italic text-ink-muted">
              I’ll cite every claim. Expect a short plan, a few tool calls, then
              an answer with linked sources.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.filter((s) => webReady || !s.query.includes("news")).map(
                (s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setQuestion(s.query)}
                    className="w-full rounded-md border border-dashed border-rule px-3 py-2 text-left font-sans text-[13px] text-ink-muted transition-colors duration-150 hover:border-olive hover:text-ink"
                  >
                    {s.label}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {trace.length > 0 && (
          <AgentTrace
            trace={trace}
            open={traceOpen}
            onToggle={() => setTraceOpen((v) => !v)}
            busy={busy}
          />
        )}

        {busy && trace.length === 0 && (
          <div className="inline-flex items-center gap-2 text-olive">
            <TypingDots />
            <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
              planning
            </span>
          </div>
        )}

        {(answer || (busy && trace.length > 0)) && (
          <div className="font-sans text-[14px] leading-[1.65] text-ink">
            <RenderedBody text={body} sources={sources} />
            {busy && answer && <span className="bf-caret text-olive" />}
            {busy && !answer && trace.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 text-olive">
                <TypingDots />
                <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
                  synthesizing
                </span>
              </div>
            )}
            <SourcesList sources={sources} />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-terracotta/40 bg-terracotta-soft/60 px-3 py-2 font-sans text-[13px] text-terracotta">
            {error}
          </div>
        )}

        <div ref={endRef} />
      </div>

      <Composer
        value={question}
        onChange={setQuestion}
        onSubmit={run}
        busy={busy}
        placeholder="What should I research?"
        accent="olive"
      />
    </div>
  );
}

function AgentTrace({
  trace,
  open,
  onToggle,
  busy,
}: {
  trace: TraceEvent[];
  open: boolean;
  onToggle: () => void;
  busy: boolean;
}) {
  const stepCount = trace.filter((t) => t.kind !== "plan").length;
  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-paper-raised">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-olive hover:bg-olive-soft/40"
      >
        <Icon
          icon={ChevronRight}
          size={12}
          className={clsx("transition-transform duration-150", open && "rotate-90")}
        />
        <Icon icon={FlaskConical} size={12} />
        Agent trace · {stepCount} {stepCount === 1 ? "step" : "steps"}
        {busy && <TypingDots className="ml-1 inline-flex text-olive" />}
      </button>
      {open && (
        <div className="border-t border-dashed border-rule px-3 py-3">
          <ol className="space-y-2.5">
            {trace.map((ev, i) => (
              <TraceRow key={i} ev={ev} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function TraceRow({ ev }: { ev: TraceEvent }) {
  if (ev.kind === "plan") {
    return (
      <li className="border-l-2 border-olive pl-3 font-display text-[13px] italic text-ink-muted [text-wrap:pretty]">
        {ev.text}
      </li>
    );
  }
  if (ev.kind === "tool_call") {
    const TIcon = TOOL_ICONS[ev.name] ?? FlaskConical;
    const label = TOOL_LABELS[ev.name] ?? ev.name;
    return (
      <li className="flex items-start gap-2">
        <Icon icon={TIcon} size={13} className="mt-[3px] shrink-0 text-olive" />
        <div className="min-w-0 space-y-0.5">
          <div className="font-sans text-[12.5px] font-medium text-ink">{label}</div>
          <div className="break-words font-mono text-[10px] text-ink-muted">
            {fmtArgs(ev.args)}
          </div>
        </div>
      </li>
    );
  }
  return (
    <li className="ml-[21px] flex items-start gap-2">
      <span className="mt-[1px] font-mono text-[11px] text-olive">→</span>
      <div className="line-clamp-2 break-words font-mono text-[10px] text-ink-muted">
        {ev.preview}
      </div>
    </li>
  );
}

function fmtArgs(args: unknown): string {
  if (args == null) return "";
  if (typeof args === "string") return args;
  try {
    const json = JSON.stringify(args);
    return json.length > 120 ? json.slice(0, 117) + "…" : json;
  } catch {
    return String(args);
  }
}

function parseAnswer(text: string): { body: string; sources: Source[] } {
  const m = text.match(/\n\s*(?:\*\*)?Sources?:?(?:\*\*)?\s*\n([\s\S]*)$/i);
  if (!m) return { body: text, sources: [] };
  const body = text.slice(0, m.index).trimEnd();
  const sources: Source[] = [];
  for (const line of m[1].split("\n")) {
    const sm = line.match(/^\s*\[(\d+)\]\s*(.*)$/);
    if (!sm) continue;
    const rest = sm[2].trim();
    const urlMatch = rest.match(URL_RE);
    sources.push({
      n: Number(sm[1]),
      url: urlMatch?.[0],
      label: rest || `Source ${sm[1]}`,
    });
  }
  return { body, sources };
}

function RenderedBody({ text, sources }: { text: string; sources: Source[] }) {
  const srcMap = new Map(sources.map((s) => [s.n, s]));
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  const pushText = (chunk: string) => {
    URL_RE.lastIndex = 0;
    let urlLast = 0;
    let um: RegExpExecArray | null;
    while ((um = URL_RE.exec(chunk)) !== null) {
      if (um.index > urlLast) {
        nodes.push(<span key={key++}>{chunk.slice(urlLast, um.index)}</span>);
      }
      nodes.push(
        <a
          key={key++}
          href={um[1]}
          target="_blank"
          rel="noreferrer"
          className="break-all text-olive underline decoration-olive/50 underline-offset-[3px] hover:decoration-olive"
        >
          {um[1]}
        </a>,
      );
      urlLast = um.index + um[1].length;
    }
    if (urlLast < chunk.length) {
      nodes.push(<span key={key++}>{chunk.slice(urlLast)}</span>);
    }
  };

  CITE_RE.lastIndex = 0;
  let cm: RegExpExecArray | null;
  while ((cm = CITE_RE.exec(text)) !== null) {
    if (cm.index > last) pushText(text.slice(last, cm.index));
    const n = Number(cm[1]);
    const src = srcMap.get(n);
    nodes.push(
      <a
        key={key++}
        href={src?.url || `#source-${n}`}
        target={src?.url ? "_blank" : undefined}
        rel={src?.url ? "noreferrer" : undefined}
        title={src?.label}
        className="mx-[2px] inline-flex h-[18px] w-[18px] translate-y-[2px] items-center justify-center rounded border border-olive bg-transparent font-mono text-[10px] font-semibold leading-none text-olive no-underline hover:bg-olive-soft"
      >
        {n}
      </a>,
    );
    last = cm.index + cm[0].length;
  }
  if (last < text.length) pushText(text.slice(last));

  return <span className="whitespace-pre-wrap">{nodes}</span>;
}

function SourcesList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-5 border-t border-dashed border-rule pt-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-olive">
        Sources
      </div>
      <ol className="space-y-1.5">
        {sources.map((s) => {
          const labelClean = s.label
            .replace(URL_RE, "")
            .trim()
            .replace(/^[-–—]\s*/, "");
          return (
            <li
              key={s.n}
              id={`source-${s.n}`}
              className="flex gap-2 font-sans text-[12px] text-ink-muted"
            >
              <span className="shrink-0 font-mono text-ink-faint">[{s.n}]</span>
              <div className="min-w-0">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-olive underline decoration-olive/50 underline-offset-[3px] hover:decoration-olive"
                  >
                    {labelClean || s.url}
                  </a>
                ) : (
                  <span>{s.label}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
