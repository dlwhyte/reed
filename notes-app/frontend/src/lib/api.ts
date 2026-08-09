// Override via localStorage.setItem("notes-app.backend", "http://...") for
// pointing a build at a different backend (e.g. testing against prod from a
// local build).
const STORED = typeof window !== "undefined" ? localStorage.getItem("notes-app.backend") : null;
const ORIGIN = STORED || "";
const BASE = ORIGIN + "/api";

let _getToken: (() => Promise<string | null>) | null = null;
export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  _getToken = fn;
}

async function _authHeader(): Promise<Record<string, string>> {
  if (!_getToken) return {};
  try {
    const t = await _getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

async function j<T>(path: string, opts?: RequestInit): Promise<T> {
  const auth = await _authHeader();
  const r = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...(opts?.headers || {}),
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}

export type NoteColor = "default" | "butter" | "terracotta" | "olive" | "plum";

export type Note = {
  id: number;
  title: string | null;
  body: string;
  color: NoteColor;
  is_pinned: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
  label_ids: number[];
};

export type Label = {
  id: number;
  name: string;
  parent_id: number | null;
  color: NoteColor;
  note_count: number;
};

export type SavedView = {
  id: number;
  name: string;
  label_ids: number[];
  search_text: string | null;
  archived_filter: "active" | "archived" | "all";
  sort_order: number;
  created_at: string;
};

export const api = {
  listNotes: (opts?: { state?: "active" | "archived" | "all"; labelId?: number; q?: string }) => {
    const qs = new URLSearchParams({ state: opts?.state ?? "active" });
    if (opts?.labelId != null) qs.set("label_id", String(opts.labelId));
    if (opts?.q) qs.set("q", opts.q);
    return j<Note[]>(`/notes?${qs}`);
  },
  createNote: (patch: { title?: string | null; body: string; color?: NoteColor; label_ids?: number[] }) =>
    j<Note>("/notes", { method: "POST", body: JSON.stringify(patch) }),
  getNote: (id: number) => j<Note>(`/notes/${id}`),
  updateNote: (id: number, patch: Partial<{ title: string | null; body: string; color: NoteColor; is_pinned: boolean; is_archived: boolean; label_ids: number[] }>) =>
    j<{ ok: boolean }>(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  removeNote: (id: number) => j<{ ok: boolean }>(`/notes/${id}`, { method: "DELETE" }),
  bulkRelabelNotes: (noteIds: number[], patch: { addLabelIds?: number[]; removeLabelIds?: number[] }) =>
    j<{ ok: boolean; updated: number }>("/notes/bulk-relabel", {
      method: "POST",
      body: JSON.stringify({
        note_ids: noteIds,
        add_label_ids: patch.addLabelIds,
        remove_label_ids: patch.removeLabelIds,
      }),
    }),

  listLabels: () => j<Label[]>("/labels"),
  createLabel: (patch: { name: string; parent_id?: number | null; color?: NoteColor }) =>
    j<Label>("/labels", { method: "POST", body: JSON.stringify(patch) }),
  updateLabel: (id: number, patch: Partial<{ name: string; parent_id: number | null; color: NoteColor }>) =>
    j<{ ok: boolean }>(`/labels/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  removeLabel: (id: number) => j<{ ok: boolean }>(`/labels/${id}`, { method: "DELETE" }),

  listSavedViews: () => j<SavedView[]>("/saved-views"),
  createSavedView: (patch: { name: string; label_ids?: number[]; search_text?: string | null; archived_filter?: "active" | "archived" | "all" }) =>
    j<SavedView>("/saved-views", { method: "POST", body: JSON.stringify(patch) }),
  removeSavedView: (id: number) => j<{ ok: boolean }>(`/saved-views/${id}`, { method: "DELETE" }),
};
