import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useStore } from "../store";

export default function Settings() {
  const { prefs, setPrefs } = useStore();
  const [cfg, setCfg] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const bookmarklet = `javascript:(()=>{window.open('http://localhost:8765/save?url='+encodeURIComponent(location.href),'reader_save','width=420,height=220,top=100,left=100')})();`;

  useEffect(() => {
    api.config().then(setCfg).catch(() => {});
    api.health().then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section>
        <h2 className="font-semibold mb-3">Reader preferences</h2>
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
          <div className="flex items-center justify-between">
            <span>Font size: {prefs.fontSize}px</span>
            <input
              type="range"
              min={14}
              max={24}
              value={prefs.fontSize}
              onChange={(e) => setPrefs({ fontSize: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Reading width: {prefs.width}px</span>
            <input
              type="range"
              min={520}
              max={880}
              step={20}
              value={prefs.width}
              onChange={(e) => setPrefs({ width: Number(e.target.value) })}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Bookmarklet</h2>
        <p className="text-sm text-neutral-500 mb-3">
          Drag this to your bookmarks bar. Click it on any page to save to Reader.
        </p>
        <a
          href={bookmarklet}
          onClick={(e) => e.preventDefault()}
          className="inline-block px-4 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium"
        >
          📖 Save to Reader
        </a>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Status</h2>
        <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-2">
          <dt className="text-neutral-500">Backend</dt>
          <dd>{health?.ok ? "✓ connected" : "not reachable"}</dd>
          <dt className="text-neutral-500">LLM features</dt>
          <dd>{cfg?.llm_ready ? "✓ enabled" : "disabled (set COHERE_API_KEY in .env)"}</dd>
          <dt className="text-neutral-500">Chat model</dt>
          <dd>{cfg?.chat_model || "—"}</dd>
          <dt className="text-neutral-500">Embed model</dt>
          <dd>{cfg?.embed_model || "—"}</dd>
          <dt className="text-neutral-500">Port</dt>
          <dd>{cfg?.port || "—"}</dd>
        </dl>
      </section>
    </div>
  );
}
