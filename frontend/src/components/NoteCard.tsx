import { useState } from "react";
import { Archive, ArchiveRestore, Pin, PinOff, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { Note, Label, NoteColor, api } from "../lib/api";
import { Icon } from "./primitives/Icon";
import { TagChip } from "./primitives/TagChip";

const COLOR_BG: Record<NoteColor, string> = {
  default: "bg-paper-raised border border-rule",
  butter: "bg-butter border border-transparent",
  terracotta: "bg-terracotta-soft border border-transparent",
  olive: "bg-olive-soft border border-transparent",
  plum: "bg-plum-soft border border-transparent",
};

type Props = {
  note: Note;
  labels: Label[];
  onChange: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

export default function NoteCard({
  note,
  labels,
  onChange,
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.body);
  const noteLabels = labels.filter((l) => note.label_ids.includes(l.id));

  async function saveIfChanged() {
    const patch: Partial<{ title: string | null; body: string }> = {};
    if (title !== (note.title ?? "")) patch.title = title || null;
    if (body !== note.body) patch.body = body;
    if (Object.keys(patch).length === 0) return;
    await api.updateNote(note.id, patch);
    onChange();
  }

  async function togglePin() {
    await api.updateNote(note.id, { is_pinned: !note.is_pinned });
    onChange();
  }
  async function toggleArchive() {
    await api.updateNote(note.id, { is_archived: !note.is_archived });
    onChange();
  }
  async function del() {
    if (!confirm("Delete this note?")) return;
    await api.removeNote(note.id);
    onChange();
  }

  return (
    <div
      className={clsx(
        "group relative flex flex-col gap-2 rounded-lg p-4 transition-shadow duration-150 ease-out hover:shadow-card",
        COLOR_BG[note.color] ?? COLOR_BG.default,
      )}
    >
      {selectable && (
        <button
          type="button"
          aria-label={selected ? "Deselect note" : "Select note"}
          onClick={() => onToggleSelect?.()}
          className={clsx(
            "absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition-colors",
            selected
              ? "border-ink bg-ink text-paper"
              : "border-rule bg-paper/80 text-transparent",
          )}
        >
          ✓
        </button>
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveIfChanged}
        placeholder="Title"
        className={clsx(
          "w-full bg-transparent font-display text-[16px] font-semibold text-ink outline-none placeholder:text-ink-faint",
          selectable && "pl-6",
        )}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={saveIfChanged}
        rows={4}
        placeholder="Take a note…"
        className="w-full resize-none bg-transparent font-sans text-[13.5px] leading-[1.5] text-ink-muted outline-none placeholder:text-ink-faint"
      />
      {noteLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {noteLabels.map((l) => (
            <TagChip key={l.id} tag={l.name} variant="muted" />
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
        <QuickAction
          label={note.is_pinned ? "Unpin" : "Pin"}
          onClick={togglePin}
          active={!!note.is_pinned}
        >
          <Icon icon={note.is_pinned ? PinOff : Pin} size={14} />
        </QuickAction>
        <QuickAction
          label={note.is_archived ? "Unarchive" : "Archive"}
          onClick={toggleArchive}
        >
          <Icon icon={note.is_archived ? ArchiveRestore : Archive} size={14} />
        </QuickAction>
        <QuickAction label="Delete" onClick={del} danger>
          <Icon icon={Trash2} size={14} />
        </QuickAction>
      </div>
    </div>
  );
}

function QuickAction({
  children,
  label,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 ease-out",
        danger
          ? "text-ink-faint hover:bg-terracotta-soft hover:text-terracotta"
          : active
          ? "text-terracotta"
          : "text-ink-faint hover:bg-rule/60 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
