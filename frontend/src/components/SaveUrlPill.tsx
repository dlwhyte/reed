import { useState } from "react";
import { Link2, Loader2, Plus } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../lib/api";
import { Icon } from "./primitives/Icon";

type Props = {
  onSaved: () => void;
  compact?: boolean;
};

export default function SaveUrlPill({ onSaved, compact }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const hasInput = url.trim().length > 0;

  async function save() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setMsg(null);
    setError(false);
    try {
      const res = await api.save(trimmed);
      setUrl("");
      setMsg(
        res.duplicate
          ? "already on your shelf"
          : `saving "${res.title || "article"}" to shelf`,
      );
      onSaved();
      setTimeout(() => setMsg(null), 2600);
    } catch (e: any) {
      setMsg(e.message || "couldn’t save that link");
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        className={clsx(
          "flex items-center gap-2.5 bg-paper-raised border border-rule rounded-xl shadow-pill",
          compact ? "pl-3 pr-1.5 py-1.5" : "pl-5 pr-2 py-2",
        )}
      >
        <Icon icon={Link2} className="text-terracotta shrink-0" size={compact ? 16 : 18} />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Paste a link — I’ll clean it up and file it"
          disabled={busy}
          className="flex-1 bg-transparent border-0 outline-none font-sans text-[15px] text-ink placeholder:text-ink-faint py-1.5 min-w-0"
        />
        <button
          type="button"
          onClick={save}
          disabled={!hasInput || busy}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-pill font-sans text-[13px] font-medium transition-colors duration-150 ease-out",
            compact ? "px-3 py-1.5" : "px-4 py-2",
            hasInput
              ? "bg-terracotta text-white hover:brightness-105"
              : "bg-rule text-white/90 cursor-not-allowed",
          )}
        >
          {busy ? (
            <Icon icon={Loader2} size={14} className="animate-spin" />
          ) : (
            <Icon icon={Plus} size={14} />
          )}
          Save
        </button>
      </div>
      {msg && (
        <div
          className={clsx(
            "font-mono text-[11px] tracking-[0.03em] pt-2 pl-1",
            error ? "text-terracotta" : "text-olive",
          )}
        >
          → {msg}
        </div>
      )}
    </div>
  );
}
