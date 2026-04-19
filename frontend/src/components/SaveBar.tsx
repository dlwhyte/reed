import { useState } from "react";
import { api } from "../lib/api";
import { Plus, Loader2 } from "lucide-react";

export default function SaveBar({ onSaved }: { onSaved: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.save(trimmed);
      setUrl("");
      setMsg(res.duplicate ? "Already saved" : `Saved: ${res.title || "article"}`);
      onSaved();
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Paste URL to save…"
          className="flex-1 px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400"
          disabled={busy}
        />
        <button
          onClick={save}
          disabled={busy || !url.trim()}
          className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Save
        </button>
      </div>
      {msg && <div className="text-sm text-neutral-500 px-1">{msg}</div>}
    </div>
  );
}
