import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bookmark,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { api, Label, Note, NoteColor, SavedView } from "../lib/api";
import { Wordmark } from "../components/primitives/Wordmark";
import { Icon } from "../components/primitives/Icon";
import { IconButton } from "../components/primitives/IconButton";
import NoteCard from "../components/NoteCard";
import LabelTree from "../components/LabelTree";

const COLORS: NoteColor[] = ["default", "butter", "terracotta", "olive", "plum"];
const COLOR_SWATCH: Record<NoteColor, string> = {
  default: "bg-paper-raised border border-rule",
  butter: "bg-butter",
  terracotta: "bg-terracotta-soft",
  olive: "bg-olive-soft",
  plum: "bg-plum-soft",
};

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState<"active" | "archived">("active");
  const [activeLabelId, setActiveLabelId] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [addingLabel, setAddingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");

  const refreshNotes = useCallback(() => {
    api
      .listNotes({ state: stateFilter, labelId: activeLabelId ?? undefined, q: q || undefined })
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [stateFilter, activeLabelId, q]);

  const refreshLabels = useCallback(() => {
    api.listLabels().then(setLabels).catch(() => setLabels([]));
  }, []);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  useEffect(() => {
    refreshLabels();
    api.listSavedViews().then(setSavedViews).catch(() => setSavedViews([]));
  }, [refreshLabels]);

  useEffect(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [stateFilter, activeLabelId, q]);

  const pinned = useMemo(() => notes.filter((n) => n.is_pinned), [notes]);
  const others = useMemo(() => notes.filter((n) => !n.is_pinned), [notes]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkAddLabel(labelId: number) {
    await api.bulkRelabelNotes(Array.from(selectedIds), { addLabelIds: [labelId] });
    setSelectedIds(new Set());
    setSelectMode(false);
    refreshNotes();
    refreshLabels();
  }

  async function bulkArchive() {
    await Promise.all(
      Array.from(selectedIds).map((id) => api.updateNote(id, { is_archived: true })),
    );
    setSelectedIds(new Set());
    setSelectMode(false);
    refreshNotes();
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} note(s)?`)) return;
    await Promise.all(Array.from(selectedIds).map((id) => api.removeNote(id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    refreshNotes();
  }

  async function applySavedView(v: SavedView) {
    setQ(v.search_text ?? "");
    setActiveLabelId(v.label_ids[0] ?? null);
    setStateFilter(v.archived_filter === "archived" ? "archived" : "active");
  }

  async function saveCurrentView(name: string) {
    const created = await api.createSavedView({
      name,
      label_ids: activeLabelId ? [activeLabelId] : [],
      search_text: q || null,
      archived_filter: stateFilter,
    });
    setSavedViews((prev) => [...prev, created]);
  }

  async function removeSavedView(id: number) {
    await api.removeSavedView(id);
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
  }

  const hasActiveFilter = !!activeLabelId || !!q;

  return (
    <div className="min-h-screen bg-paper paper-noise text-ink">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/80 backdrop-blur pt-safe">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 md:px-8">
          <Link to="/" aria-label="Back to library">
            <IconButton icon={ArrowLeft} label="Back to library" />
          </Link>
          <Wordmark size="md" />
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:inline">
            notes
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-24 pt-8 md:px-8">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink [text-wrap:balance]">
            Quick notes
          </h1>
          {!loading && (
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </div>
          )}
        </div>
        <p className="mt-2 font-display text-[15px] italic text-ink-muted">
          Sticky notes, organized by nested labels — separate from your saved
          articles.
        </p>

        <div className="mt-7 flex gap-8">
          <aside className="hidden w-56 shrink-0 flex-col gap-6 lg:flex">
            <div>
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  Labels
                </span>
                {!addingLabel && (
                  <button
                    type="button"
                    aria-label="New label"
                    onClick={() => setAddingLabel(true)}
                    className="text-ink-faint hover:text-ink"
                  >
                    <Icon icon={Plus} size={13} />
                  </button>
                )}
              </div>
              {addingLabel && (
                <form
                  className="mb-2 px-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const name = newLabelName.trim();
                    setAddingLabel(false);
                    setNewLabelName("");
                    if (!name) return;
                    await api.createLabel({ name });
                    refreshLabels();
                  }}
                >
                  <input
                    autoFocus
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    onBlur={() => {
                      setAddingLabel(false);
                      setNewLabelName("");
                    }}
                    placeholder="Label name"
                    className="w-full rounded-md border border-rule bg-paper px-2 py-1 font-mono text-[11px] text-ink outline-none placeholder:text-ink-faint"
                  />
                </form>
              )}
              <LabelTree
                labels={labels}
                activeLabelId={activeLabelId}
                onSelect={setActiveLabelId}
              />
            </div>

            {savedViews.length > 0 && (
              <div>
                <span className="mb-2 block px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  Saved views
                </span>
                <div className="flex flex-col gap-0.5">
                  {savedViews.map((v) => (
                    <div key={v.id} className="group flex items-center">
                      <button
                        type="button"
                        onClick={() => applySavedView(v)}
                        className="flex flex-1 items-center gap-2 truncate rounded-md px-2 py-1.5 text-left font-mono text-[11px] tracking-[0.02em] text-ink-muted transition-colors duration-150 ease-out hover:bg-rule/60 hover:text-ink"
                      >
                        <Icon icon={Bookmark} size={12} />
                        <span className="truncate">{v.name}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Remove saved view"
                        onClick={() => removeSavedView(v.id)}
                        className="pr-2 text-ink-faint opacity-0 hover:text-terracotta group-hover:opacity-100"
                      >
                        <Icon icon={X} size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className="min-w-0 flex-1">
            <QuickAdd
              labels={labels}
              onCreated={() => {
                refreshNotes();
                refreshLabels();
              }}
            />

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <div className="flex min-w-[240px] flex-1 items-center gap-2.5 rounded-lg border border-rule bg-paper-raised px-3.5 py-2.5">
                <Icon icon={Search} size={16} className="shrink-0 text-ink-muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="search your notes…"
                  className="min-w-0 flex-1 bg-transparent font-sans text-[14px] text-ink placeholder:text-ink-faint outline-none"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    aria-label="Clear"
                    className="text-ink-muted hover:text-ink"
                  >
                    <Icon icon={X} size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStateFilter((s) => (s === "active" ? "archived" : "active"))}
                className={clsx(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rule bg-paper-raised px-3.5 py-2.5 font-sans text-[13px] font-medium transition-colors duration-150",
                  stateFilter === "archived" ? "text-terracotta" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon icon={stateFilter === "archived" ? ArchiveRestore : Archive} size={14} />
                {stateFilter === "archived" ? "Archived" : "Active"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectMode((v) => !v);
                  setSelectedIds(new Set());
                }}
                className={clsx(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rule bg-paper-raised px-3.5 py-2.5 font-sans text-[13px] font-medium transition-colors duration-150",
                  selectMode ? "text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {selectMode ? "Cancel" : "Select"}
              </button>
              {hasActiveFilter && !selectMode && (
                <SaveViewButton onSave={saveCurrentView} />
              )}
            </div>

            {selectMode && selectedIds.size > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper-raised px-4 py-2.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                  {selectedIds.size} selected
                </span>
                <div className="flex-1" />
                <LabelPicker labels={labels} onPick={bulkAddLabel} />
                <button
                  type="button"
                  onClick={bulkArchive}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-sans text-[13px] text-ink-muted hover:bg-rule/60 hover:text-ink"
                >
                  <Icon icon={Archive} size={14} />
                  Archive
                </button>
                <button
                  type="button"
                  onClick={bulkDelete}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-sans text-[13px] text-ink-muted hover:bg-terracotta-soft hover:text-terracotta"
                >
                  <Icon icon={Trash2} size={14} />
                  Delete
                </button>
              </div>
            )}

            <div className="mt-7">
              {loading ? (
                <div className="py-16 text-center">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
                    gathering your notes
                  </span>
                  <div className="mt-3 inline-flex text-ink-muted">
                    <span className="bf-dot" />
                    <span className="bf-dot" />
                    <span className="bf-dot" />
                  </div>
                </div>
              ) : notes.length === 0 ? (
                <EmptyNotes searching={!!q || !!activeLabelId} />
              ) : (
                <>
                  {pinned.length > 0 && (
                    <section className="mb-8">
                      <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                        Pinned
                      </span>
                      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {pinned.map((n) => (
                          <NoteCard
                            key={n.id}
                            note={n}
                            labels={labels}
                            onChange={refreshNotes}
                            selectable={selectMode}
                            selected={selectedIds.has(n.id)}
                            onToggleSelect={() => toggleSelect(n.id)}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  {others.length > 0 && (
                    <section>
                      {pinned.length > 0 && (
                        <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                          Others
                        </span>
                      )}
                      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {others.map((n) => (
                          <NoteCard
                            key={n.id}
                            note={n}
                            labels={labels}
                            onChange={refreshNotes}
                            selectable={selectMode}
                            selected={selectedIds.has(n.id)}
                            onToggleSelect={() => toggleSelect(n.id)}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAdd({
  labels,
  onCreated,
}: {
  labels: Label[];
  onCreated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState<NoteColor>("default");
  const [labelIds, setLabelIds] = useState<number[]>([]);

  async function commit() {
    if (!title.trim() && !body.trim()) {
      collapse();
      return;
    }
    await api.createNote({
      title: title.trim() || null,
      body: body.trim(),
      color,
      label_ids: labelIds,
    });
    collapse();
    onCreated();
  }

  function collapse() {
    setExpanded(false);
    setTitle("");
    setBody("");
    setColor("default");
    setLabelIds([]);
  }

  return (
    <div
      className={clsx(
        "rounded-lg border border-rule p-4 transition-colors",
        COLOR_SWATCH[color],
      )}
    >
      {expanded && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          autoFocus
          className="mb-2 w-full bg-transparent font-display text-[16px] font-semibold text-ink outline-none placeholder:text-ink-faint"
        />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setExpanded(true)}
        placeholder="Take a note…"
        rows={expanded ? 3 : 1}
        className="w-full resize-none bg-transparent font-sans text-[14px] text-ink outline-none placeholder:text-ink-faint"
      />
      {expanded && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule/60 pt-3">
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color: ${c}`}
                onClick={() => setColor(c)}
                className={clsx(
                  "h-5 w-5 rounded-full transition-transform",
                  COLOR_SWATCH[c],
                  color === c && "ring-2 ring-ink ring-offset-1 ring-offset-paper",
                )}
              />
            ))}
          </div>
          <LabelPicker
            labels={labels}
            onPick={(id) =>
              setLabelIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
            }
            selectedIds={labelIds}
          />
          <div className="flex-1" />
          <button
            type="button"
            onClick={collapse}
            className="rounded-md px-3 py-1.5 font-sans text-[13px] text-ink-muted hover:bg-rule/60"
          >
            Close
          </button>
          <button
            type="button"
            onClick={commit}
            className="rounded-md bg-ink px-3 py-1.5 font-sans text-[13px] font-medium text-paper hover:opacity-90"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function SaveViewButton({ onSave }: { onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    setOpen(false);
    setName("");
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rule bg-paper-raised px-3.5 py-2.5 font-sans text-[13px] font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
      >
        <Icon icon={Bookmark} size={14} />
        Save view
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <form
            onSubmit={submit}
            className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-rule bg-paper-raised p-2 shadow-modal"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this view"
              className="w-full rounded-md border border-rule bg-paper px-2.5 py-1.5 font-sans text-[13px] text-ink outline-none placeholder:text-ink-faint"
            />
          </form>
        </>
      )}
    </div>
  );
}

function LabelPicker({
  labels,
  onPick,
  selectedIds,
}: {
  labels: Label[];
  onPick: (labelId: number) => void;
  selectedIds?: number[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-sans text-[13px] text-ink-muted hover:bg-rule/60 hover:text-ink"
      >
        <Icon icon={Tag} size={14} />
        Label
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-rule bg-paper-raised p-1 shadow-modal">
            {labels.length === 0 ? (
              <div className="px-3 py-2 font-sans text-[12.5px] text-ink-faint">
                No labels yet
              </div>
            ) : (
              labels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    onPick(l.id);
                    setOpen(false);
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded px-3 py-1.5 text-left font-sans text-[13px] text-ink-muted hover:bg-rule/40 hover:text-ink",
                    selectedIds?.includes(l.id) && "text-ink",
                  )}
                >
                  {l.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyNotes({ searching }: { searching: boolean }) {
  return (
    <div className="mx-auto max-w-xl py-14 text-center">
      <div
        className="mx-auto mb-6 inline-block rounded-sm bg-butter px-3 py-1 font-display italic text-[16px] text-ink"
        aria-hidden
      >
        nothing here yet
      </div>
      <div className="font-display text-[17px] italic text-ink-muted [text-wrap:pretty]">
        {searching
          ? "No notes match that filter."
          : "Jot something down above — it'll show up here."}
      </div>
    </div>
  );
}
