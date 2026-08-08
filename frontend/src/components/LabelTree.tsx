import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { Label, NoteColor } from "../lib/api";
import { Icon } from "./primitives/Icon";

const COLOR_DOT: Record<NoteColor, string> = {
  default: "bg-ink-faint",
  butter: "bg-butter",
  terracotta: "bg-terracotta",
  olive: "bg-olive",
  plum: "bg-plum",
};

type Props = {
  labels: Label[];
  activeLabelId: number | null;
  onSelect: (labelId: number | null) => void;
};

export default function LabelTree({ labels, activeLabelId, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const byParent = new Map<number | null, Label[]>();
  for (const l of labels) {
    const key = l.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(l);
  }

  function toggleCollapsed(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderLevel(parentId: number | null, depth: number): React.ReactNode {
    const children = byParent.get(parentId) ?? [];
    return children.map((l) => {
      const hasChildren = (byParent.get(l.id) ?? []).length > 0;
      const isCollapsed = collapsed.has(l.id);
      return (
        <div key={l.id}>
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 14 }}>
            {hasChildren ? (
              <button
                type="button"
                aria-label={isCollapsed ? "Expand" : "Collapse"}
                onClick={() => toggleCollapsed(l.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center text-ink-faint"
              >
                <Icon icon={isCollapsed ? ChevronRight : ChevronDown} size={13} />
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => onSelect(activeLabelId === l.id ? null : l.id)}
              className={clsx(
                "flex flex-1 items-center gap-2 truncate rounded-md px-2 py-1.5 text-left font-mono text-[11px] tracking-[0.02em] transition-colors duration-150 ease-out",
                activeLabelId === l.id
                  ? "bg-ink text-paper"
                  : "text-ink-muted hover:bg-rule/60 hover:text-ink",
              )}
            >
              <span
                className={clsx(
                  "h-2 w-2 shrink-0 rounded-full",
                  COLOR_DOT[l.color] ?? COLOR_DOT.default,
                )}
              />
              <span className="truncate">{l.name}</span>
              <span className="ml-auto opacity-50">{l.note_count}</span>
            </button>
          </div>
          {hasChildren && !isCollapsed && renderLevel(l.id, depth + 1)}
        </div>
      );
    });
  }

  return <div className="flex flex-col gap-0.5">{renderLevel(null, 0)}</div>;
}
