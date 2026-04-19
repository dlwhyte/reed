import { useState, useRef, useEffect } from "react";
import { chatStream } from "../lib/api";
import { Send, Sparkles, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPanel({ articleId, llmReady }: { articleId: number; llmReady: boolean }) {
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
    setMessages([...history, { role: "user", content: q }, { role: "assistant", content: "" }]);
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
        copy[copy.length - 1] = { role: "assistant", content: `Error: ${e.message}` };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  if (!llmReady) {
    return (
      <div className="text-sm text-neutral-500 p-4 text-center">
        Chat requires Cohere API key. Add to <code>.env</code> and restart.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <Sparkles className="w-4 h-4" />
        <span className="font-medium text-sm">Chat with article</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-neutral-500">
            Ask anything about this article. Try: "summarize in bullet points" or "what's the main argument?"
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${
              m.role === "user"
                ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 ml-8"
                : "bg-neutral-100 dark:bg-neutral-800 mr-8"
            }`}
          >
            {m.content || (busy && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about this article…"
          disabled={busy}
          className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
