import { useState, useRef, useEffect } from "react";
import { researchStream, ResearchEvent } from "../lib/api";
import { Send, Loader2, Library, BookOpen, Globe, ChevronDown, ChevronRight, FlaskConical } from "lucide-react";

const URL_RE = /(https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"])/g;
const CITE_RE = /\[(\d+)\]/g;

type Source = { n: number; url?: string; label: string };

function parseAnswer(text: string): { body: string; sources: Source[] } {
  const m = text.match(/\n\s*(?:\*\*)?Sources?:?(?:\*\*)?\s*\n([\s\S]*)$/i);
  if (!m) return { body: text, sources: [] };
  const body = text.slice(0, m.index).trimEnd();
  const srcBlock = m[1];
  const sources: Source[] = [];
  for (const line of srcBlock.split("\n")) {
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
      if (um.index > urlLast) nodes.push(<span key={key++}>{chunk.slice(urlLast, um.index)}</span>);
      nodes.push(
        <a
          key={key++}
          href={um[1]}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 dark:text-blue-400 underline underline-offset-2 break-all"
        >
          {um[1]}
        </a>
      );
      urlLast = um.index + um[1].length;
    }
    if (urlLast < chunk.length) nodes.push(<span key={key++}>{chunk.slice(urlLast)}</span>);
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
        className="inline-flex items-center justify-center text-[10px] font-semibold px-1 py-0 mx-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/70 no-underline"
      >
        {n}
      </a>
    );
    last = cm.index + cm[0].length;
  }
  if (last < text.length) pushText(text.slice(last));

  return <>{nodes}</>;
}

function SourcesList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Sources</div>
      <ol className="space-y-1.5 text-xs">
        {sources.map((s) => {
          const labelClean = s.label.replace(URL_RE, "").trim().replace(/^[-–—]\s*/, "");
          return (
            <li key={s.n} id={`source-${s.n}`} className="flex gap-2">
              <span className="text-neutral-400 shrink-0">[{s.n}]</span>
              <div className="min-w-0">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline underline-offset-2 break-all"
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

type TraceEvent =
  | { kind: "plan"; text: string }
  | { kind: "tool_call"; name: string; args: any }
  | { kind: "tool_result"; name: string; preview: string };

const TOOL_ICONS: Record<string, any> = {
  search_library: Library,
  read_article: BookOpen,
  search_web: Globe,
};

const TOOL_LABELS: Record<string, string> = {
  search_library: "Searching your library",
  read_article: "Reading saved article",
  search_web: "Searching the web",
};

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

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [trace, answer]);

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
      <div className="p-4 text-sm text-neutral-500 text-center">
        Research agent requires Cohere API key.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <FlaskConical className="w-4 h-4" />
        <span className="font-medium text-sm">Research</span>
        {!webReady && (
          <span className="text-xs text-neutral-400 ml-auto" title="Web search disabled — add TAVILY_API_KEY to .env">
            library only
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {trace.length === 0 && !answer && !busy && (
          <div className="text-sm text-neutral-500 space-y-2">
            <p>Ask the agent to research something about this article. It will use tools to:</p>
            <ul className="list-disc ml-5 space-y-1 text-xs">
              <li>Search your saved library for related pieces</li>
              <li>Read full content of matches</li>
              {webReady && <li>Search the current web</li>}
            </ul>
            <p className="text-xs italic pt-2">
              Try: <span className="underline cursor-pointer" onClick={() => setQuestion("Find counter-arguments to this article's main claim")}>find counter-arguments</span> ·{" "}
              <span className="underline cursor-pointer" onClick={() => setQuestion("What related pieces have I already read?")}>related in my library</span> ·{" "}
              <span className="underline cursor-pointer" onClick={() => setQuestion("What's the most recent news on this topic?")}>latest news</span>
            </p>
          </div>
        )}

        {trace.length > 0 && (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg">
            <button
              onClick={() => setTraceOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              {traceOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Agent trace ({trace.length} steps)
            </button>
            {traceOpen && (
              <div className="px-3 pb-3 space-y-2">
                {trace.map((ev, i) => {
                  if (ev.kind === "plan") {
                    return (
                      <div key={i} className="text-xs italic text-neutral-500 border-l-2 border-neutral-300 dark:border-neutral-700 pl-2">
                        {ev.text}
                      </div>
                    );
                  }
                  const Icon = TOOL_ICONS[ev.name] || FlaskConical;
                  const label = TOOL_LABELS[ev.name] || ev.name;
                  if (ev.kind === "tool_call") {
                    return (
                      <div key={i} className="text-xs flex items-start gap-2">
                        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-neutral-500 font-mono text-[10px]">
                            {JSON.stringify(ev.args)}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="text-xs flex items-start gap-2 ml-5">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <div className="text-neutral-500 font-mono text-[10px] line-clamp-2 break-all">
                        {ev.preview}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(answer || busy) && (() => {
          const { body, sources } = parseAnswer(answer);
          return (
            <div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                <RenderedBody text={body} sources={sources} />
                {busy && !answer && (
                  <div className="text-neutral-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Researching…
                  </div>
                )}
                {busy && answer && <span className="inline-block w-1.5 h-4 bg-neutral-400 animate-pulse ml-0.5" />}
              </div>
              <SourcesList sources={sources} />
            </div>
          );
        })()}

        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="What should I research?"
          disabled={busy}
          className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <button
          onClick={run}
          disabled={busy || !question.trim()}
          className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
