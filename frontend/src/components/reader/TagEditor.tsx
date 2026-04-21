import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { Icon } from "../primitives/Icon";

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void | Promise<void>;
  /** Optional pool of existing shelf tags for autocompletion. */
  suggestions?: string[];
};

export function TagEditor({ tags, onChange, suggestions = [] }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit(value?: string) {
    const raw = (value ?? draft).trim().toLowerCase();
    if (!raw) {
      setEditing(false);
      setDraft("");
      return;
    }
    if (tags.includes(raw)) {
      setDraft("");
      setEditing(false);
      return;
    }
    onChange([...tags, raw]);
    setDraft("");
    setEditing(false);
  }

  function remove(t: string) {
    onChange(tags.filter((x) => x !== t));
  }

  const hints = draft
    ? suggestions
        .filter(
          (s) => s.toLowerCase().includes(draft.toLowerCase()) && !tags.includes(s),
        )
        .slice(0, 5)
    : [];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagChipEditable key={t} tag={t} onRemove={() => remove(t)} />
      ))}
      {editing ? (
        <div className="relative">
          <div
            className={clsx(
              "inline-flex items-center gap-1 rounded-pill border border-terracotta bg-paper-raised py-[3px] pl-2 pr-1",
            )}
          >
            <span className="font-mono text-[11px] text-terracotta">#</span>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) =>
                setDraft(e.target.value.replace(/[\s#]+/g, ""))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  setEditing(false);
                  setDraft("");
                } else if (e.key === "Backspace" && !draft && tags.length) {
                  remove(tags[tags.length - 1]);
                }
              }}
              onBlur={() => {
                // Give suggestion click a tick to fire first.
                window.setTimeout(() => commit(), 120);
              }}
              placeholder="new tag"
              className="min-w-[72px] max-w-[180px] bg-transparent font-mono text-[11px] text-ink placeholder:text-ink-faint outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft("");
              }}
              aria-label="Cancel"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-faint hover:text-ink"
            >
              <Icon icon={X} size={10} />
            </button>
          </div>
          {hints.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 min-w-[140px] overflow-hidden rounded-md border border-rule bg-paper-raised py-1 shadow-modal">
              {hints.map((h) => (
                <button
                  key={h}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(h);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] text-ink-muted hover:bg-rule/40 hover:text-ink"
                >
                  <span className="text-terracotta">#</span>
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={clsx(
            "inline-flex items-center gap-1 rounded-pill border border-dashed border-rule px-2 py-[4px] font-mono text-[11px] text-ink-faint transition-colors duration-150 hover:border-terracotta hover:text-terracotta",
          )}
        >
          <Icon icon={Plus} size={10} />
          tag
        </button>
      )}
    </div>
  );
}

function TagChipEditable({
  tag,
  onRemove,
}: {
  tag: string;
  onRemove: () => void;
}) {
  return (
    <span className="group inline-flex items-center gap-1 rounded-pill bg-butter px-2.5 py-[4px] font-mono text-[11px] tracking-[0.02em] text-ink">
      #{tag}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove tag ${tag}`}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-ink-faint opacity-0 transition-opacity duration-150 hover:text-terracotta group-hover:opacity-100"
      >
        <Icon icon={X} size={9} />
      </button>
    </span>
  );
}
