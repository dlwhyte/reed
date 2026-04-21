import { useEffect, useRef, useState } from "react";
import { chatStream } from "../lib/api";
import { Composer } from "./panels/Composer";
import { TypingDots } from "./primitives/TypingDots";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Summarize this in five bullets.",
  "What’s the sharpest counter-argument?",
  "Walk me through the main idea plainly.",
];

export default function ChatPanel({
  articleId,
  llmReady,
}: {
  articleId: number;
  llmReady: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const history = messages;
    setMessages([
      ...history,
      { role: "user", content: q },
      { role: "assistant", content: "" },
    ]);
    setBusy(true);
    try {
      let acc = "";
      for await (const chunk of chatStream(articleId, q, history)) {
        acc += chunk;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e: any) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Something went wrong: ${e.message}`,
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  if (!llmReady) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-plum">
            chat offline
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

  const showSuggestions = messages.length === 0;
  const waitingFirstToken =
    busy &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {showSuggestions && (
          <div className="space-y-3">
            <p className="font-display text-[14px] italic text-ink-muted">
              Chat is scoped to this article — cite paragraph numbers if you want
              me to point to specific bits.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="w-full rounded-md border border-dashed border-rule px-3 py-2 text-left font-sans text-[13px] text-ink-muted transition-colors duration-150 hover:border-plum hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <ChatBubble
            key={i}
            role={m.role}
            content={m.content}
            streaming={
              busy &&
              i === messages.length - 1 &&
              m.role === "assistant" &&
              m.content.length > 0
            }
          />
        ))}

        {waitingFirstToken && (
          <div className="flex text-plum">
            <span className="rounded-lg rounded-tl-sm bg-plum-soft px-3 py-2">
              <TypingDots />
            </span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={send}
        busy={busy}
        placeholder="Ask about this piece…"
        accent="plum"
      />
    </div>
  );
}

function ChatBubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-plum px-3 py-2 font-sans text-[14px] leading-[1.5] text-white whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex">
      <div className="max-w-[90%] rounded-lg rounded-tl-sm bg-paper-raised border border-rule px-3 py-2 font-sans text-[14px] leading-[1.6] text-ink whitespace-pre-wrap">
        {content}
        {streaming && <span className="bf-caret text-plum" />}
      </div>
    </div>
  );
}
