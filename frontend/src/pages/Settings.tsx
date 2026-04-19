import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useStore } from "../store";
import { ChevronRight } from "lucide-react";

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="border-b border-neutral-200 dark:border-neutral-800 group"
      open={defaultOpen}
    >
      <summary className="cursor-pointer py-4 flex items-center gap-2 list-none select-none">
        <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-neutral-400" />
        <span className="font-semibold">{title}</span>
      </summary>
      <div className="pb-6 pl-6">{children}</div>
    </details>
  );
}

export default function Settings() {
  const { prefs, setPrefs } = useStore();
  const [cfg, setCfg] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const saveUrl = `${origin}/api/save`;
  const bookmarklet = `javascript:(()=>{window.open('${origin}/save?url='+encodeURIComponent(location.href),'reader_save','width=420,height=220,top=100,left=100')})();`;
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {}
  };

  useEffect(() => {
    api.config().then(setCfg).catch(() => {});
    api.health().then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>

      <Section title="Reader preferences" defaultOpen>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Theme</span>
            <select
              value={prefs.theme}
              onChange={(e) => setPrefs({ theme: e.target.value as any })}
              className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="sepia">Sepia</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span>Font</span>
            <select
              value={prefs.font}
              onChange={(e) => setPrefs({ font: e.target.value as any })}
              className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            >
              <option value="serif">Serif</option>
              <option value="sans">Sans-serif</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0">Font size: {prefs.fontSize}px</span>
            <input
              type="range"
              min={14}
              max={24}
              value={prefs.fontSize}
              onChange={(e) => setPrefs({ fontSize: Number(e.target.value) })}
              className="flex-1 min-w-0"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0">Width: {prefs.width}px</span>
            <input
              type="range"
              min={520}
              max={880}
              step={20}
              value={prefs.width}
              onChange={(e) => setPrefs({ width: Number(e.target.value) })}
              className="flex-1 min-w-0"
            />
          </div>
        </div>
      </Section>

      <Section title="Save from iPhone">
        <p className="text-sm text-neutral-500 mb-4">
          One-time iOS Shortcut setup so "Save to reed" appears in the Share Sheet.
        </p>

        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Save endpoint</div>
            <code className="text-xs break-all">{saveUrl}</code>
          </div>
          <button
            onClick={() => copy(saveUrl, "save")}
            className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 text-xs whitespace-nowrap shrink-0"
          >
            {copiedField === "save" ? "✓ Copied" : "Copy"}
          </button>
        </div>

        <ol className="text-sm space-y-2 list-decimal ml-5">
          <li>Open the <strong>Shortcuts</strong> app on your iPhone.</li>
          <li>Tap <strong>+</strong>, then <strong>Add Action</strong>.</li>
          <li>Search and add <strong>"Get Contents of URL"</strong>.</li>
          <li>Paste the save endpoint into the URL field.</li>
          <li>Tap <strong>Show More</strong>. Set <strong>Method</strong> → POST, <strong>Request Body</strong> → JSON. Add a field: Key <code>url</code>, value = <strong>Shortcut Input</strong>.</li>
          <li>Tap <strong>ⓘ</strong> → enable <strong>"Use with Share Sheet"</strong> → check only <strong>URLs</strong>.</li>
          <li>Rename to <strong>"Save to reed"</strong>. Done.</li>
        </ol>

        <div className="text-xs text-neutral-500 mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <strong>Using it:</strong> any app → Share → "Save to reed"
        </div>
      </Section>

      <Section title="Bookmarklet (desktop)">
        <p className="text-sm text-neutral-500 mb-3">
          Drag this button to your browser's bookmarks bar. Click on any page to save to reed.
        </p>
        <a
          href={bookmarklet}
          onClick={(e) => e.preventDefault()}
          className="inline-block px-4 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium"
        >
          📖 Save to reed
        </a>
      </Section>

      <Section title="Status">
        <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-neutral-500">Backend</dt>
          <dd>{health?.ok ? "✓ connected" : "not reachable"}</dd>
          <dt className="text-neutral-500">LLM features</dt>
          <dd>{cfg?.llm_ready ? "✓ enabled" : "disabled (set COHERE_API_KEY in .env)"}</dd>
          <dt className="text-neutral-500">Web search</dt>
          <dd>{cfg?.web_search_ready ? "✓ enabled (Tavily)" : "disabled"}</dd>
          <dt className="text-neutral-500">Chat model</dt>
          <dd className="break-all">{cfg?.chat_model || "—"}</dd>
          <dt className="text-neutral-500">Embed model</dt>
          <dd className="break-all">{cfg?.embed_model || "—"}</dd>
          <dt className="text-neutral-500">Port</dt>
          <dd>{cfg?.port || "—"}</dd>
        </dl>
      </Section>
    </div>
  );
}
