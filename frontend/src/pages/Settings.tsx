import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useStore } from "../store";

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
        <h2 className="font-semibold mb-3">Save from iPhone</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Set up a one-time iOS Shortcut so "Save to reed" appears in the Share Sheet of Safari, Twitter, Reddit, and any app that can share a URL.
        </p>

        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-neutral-500">Save endpoint (paste into Shortcut)</div>
              <code className="text-xs break-all">{saveUrl}</code>
            </div>
            <button
              onClick={() => copy(saveUrl, "save")}
              className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 text-xs whitespace-nowrap"
            >
              {copiedField === "save" ? "✓ Copied" : "Copy"}
            </button>
          </div>

          <ol className="text-sm space-y-2 list-decimal ml-5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <li>Open the <strong>Shortcuts</strong> app on your iPhone.</li>
            <li>Tap <strong>+</strong> to create a new shortcut.</li>
            <li>Tap <strong>Add Action</strong>, search for and add <strong>"Get Contents of URL"</strong>.</li>
            <li>In the URL field, paste the save endpoint above.</li>
            <li>Tap <strong>Show More</strong> on the action. Set:
              <ul className="list-disc ml-5 mt-1">
                <li><strong>Method</strong>: POST</li>
                <li><strong>Request Body</strong>: JSON</li>
                <li>Under Request Body, tap <strong>Add new field</strong>:
                  <ul className="list-disc ml-5">
                    <li>Key: <code>url</code></li>
                    <li>Type: Text</li>
                    <li>Value: tap the field, then select <strong>Shortcut Input</strong> (from the variables bar above the keyboard)</li>
                  </ul>
                </li>
              </ul>
            </li>
            <li>Tap the <strong>ⓘ</strong> info button. Enable <strong>"Use with Share Sheet"</strong>. Under Share Sheet Types, check only <strong>URLs</strong>.</li>
            <li>Rename the shortcut to <strong>"Save to reed"</strong> (tap the name at the top).</li>
            <li>Tap <strong>Done</strong>.</li>
          </ol>

          <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <strong>Using it:</strong> In any app, tap <strong>Share</strong> → scroll and tap <strong>"Save to reed"</strong>. Article appears in your library.
          </div>
        </div>
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
