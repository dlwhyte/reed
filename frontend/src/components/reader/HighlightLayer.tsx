import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Highlighter, Trash2 } from "lucide-react";
import type { Highlight } from "../../lib/api";
import { Icon } from "../primitives/Icon";

type Props = {
  /** The article body as plain text, split into paragraphs. */
  paragraphs: string[];
  highlights: Highlight[];
  onHighlight: (text: string) => void;
  onRemove: (id: number) => void;
  fontClass: string;
  lineHeight?: number;
};

type Popover = {
  x: number;
  y: number;
  text: string;
};

const IS_TOUCH =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || (navigator as any).maxTouchPoints > 0);

export function HighlightLayer({
  paragraphs,
  highlights,
  onHighlight,
  onRemove,
  fontClass,
  lineHeight = 1.65,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [touchSelection, setTouchSelection] = useState<string | null>(null);

  useEffect(() => {
    if (IS_TOUCH) return;

    function onMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setPopover(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text || text.length < 3) {
        setPopover(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = containerRef.current;
      if (!container || !container.contains(range.commonAncestorContainer)) {
        setPopover(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      setPopover({
        x: rect.left + rect.width / 2 - cRect.left,
        y: rect.top - cRect.top - 8,
        text,
      });
    }

    function onMouseDown(e: MouseEvent) {
      // Dismiss the popover if clicking anywhere outside of it.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-bf-popover]")) return;
      setPopover(null);
    }

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  // Touch path — iOS/Android hijack `mouseup` and cover the selection with
  // their own menu, so we track selection via `selectionchange` and surface a
  // floating pill at the bottom of the viewport that coexists with the
  // system menu instead of fighting it.
  useEffect(() => {
    if (!IS_TOUCH) return;

    function update() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setTouchSelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text || text.length < 3) {
        setTouchSelection(null);
        return;
      }
      const container = containerRef.current;
      if (!container) {
        setTouchSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setTouchSelection(null);
        return;
      }
      setTouchSelection(text);
    }

    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  function commitHighlight() {
    if (!popover) return;
    onHighlight(popover.text);
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  }

  function commitTouchHighlight() {
    if (!touchSelection) return;
    onHighlight(touchSelection);
    setTouchSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div
      ref={containerRef}
      className={clsx("reader-prose relative", fontClass)}
      style={{ lineHeight }}
    >
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {renderParagraph(p, highlights, onRemove)}
        </p>
      ))}

      {popover && (
        <div
          data-bf-popover
          className="absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-rule bg-paper-raised px-2 py-1.5 shadow-modal"
          style={{ left: popover.x, top: popover.y }}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              // prevent the browser from clearing the selection before click.
              e.preventDefault();
            }}
            onClick={commitHighlight}
            className="inline-flex items-center gap-1.5 rounded-md bg-butter px-2.5 py-1 font-sans text-[12px] font-medium text-ink hover:brightness-95"
          >
            <Icon icon={Highlighter} size={13} />
            Highlight
          </button>
        </div>
      )}

      {IS_TOUCH && touchSelection && (
        <div
          data-bf-popover
          className="fixed bottom-6 right-4 z-30 pb-safe"
        >
          <button
            type="button"
            aria-label="Highlight selection"
            onTouchStart={(e) => {
              // Prevent the browser from clearing the selection before
              // `onClick` fires.
              e.preventDefault();
            }}
            onClick={commitTouchHighlight}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-butter text-ink shadow-modal ring-1 ring-ink/10 active:brightness-95"
          >
            <Icon icon={Highlighter} size={22} />
          </button>
        </div>
      )}
    </div>
  );
}

function renderParagraph(
  text: string,
  highlights: Highlight[],
  onRemove: (id: number) => void,
): React.ReactNode {
  if (highlights.length === 0) return text;

  // Build a list of non-overlapping match ranges using the first match per
  // highlight. Simple approach: scan each highlight, pick earliest-first.
  type Match = { start: number; end: number; id: number };
  const matches: Match[] = [];
  for (const h of highlights) {
    const needle = h.text;
    if (!needle) continue;
    const idx = text.indexOf(needle);
    if (idx < 0) continue;
    matches.push({ start: idx, end: idx + needle.length, id: h.id });
  }
  matches.sort((a, b) => a.start - b.start);
  // Drop overlaps — keep earliest, skip later ones that overlap.
  const kept: Match[] = [];
  for (const m of matches) {
    if (kept.length > 0 && m.start < kept[kept.length - 1].end) continue;
    kept.push(m);
  }

  if (kept.length === 0) return text;

  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of kept) {
    if (m.start > cursor) out.push(text.slice(cursor, m.start));
    out.push(
      <HighlightMark
        key={`h-${m.id}`}
        id={m.id}
        text={text.slice(m.start, m.end)}
        onRemove={onRemove}
      />,
    );
    cursor = m.end;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function HighlightMark({
  id,
  text,
  onRemove,
}: {
  id: number;
  text: string;
  onRemove: (id: number) => void;
}) {
  return (
    <mark
      data-bf-highlight={id}
      className="group relative rounded-[3px] bg-butter/80 px-[2px] text-ink"
    >
      {text}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(id);
        }}
        aria-label="Remove highlight"
        title="Remove highlight"
        className="absolute -top-2 -right-2 hidden h-4 w-4 items-center justify-center rounded-full border border-rule bg-paper-raised text-terracotta shadow-pill group-hover:inline-flex hover:bg-terracotta-soft"
      >
        <Icon icon={Trash2} size={8} />
      </button>
    </mark>
  );
}
