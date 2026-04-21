import { api } from "./api";

export type PocketRow = {
  title: string;
  url: string;
  timeAdded?: number;
  tags: string[];
  status?: string;
};

export type ImportOutcome =
  | { kind: "saved"; row: PocketRow; id: number; title?: string }
  | { kind: "duplicate"; row: PocketRow; id: number; title?: string }
  | { kind: "error"; row: PocketRow; message: string };

export type ImportProgress = {
  total: number;
  done: number;
  saved: number;
  duplicates: number;
  errors: number;
  current?: PocketRow;
};

/**
 * Parses a Pocket CSV export. Pocket's 2025 export format:
 *   title,url,time_added,tags,status
 * Tags are pipe-separated. Falls back to treating a bare-URL-per-line file
 * as a newline-separated list.
 */
export function parsePocketCsv(text: string): PocketRow[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];

  // Heuristic: if no commas on first line, treat as a plain URL list.
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine.includes(",")) {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^https?:\/\//i.test(line))
      .map((url) => ({ title: "", url, tags: [] }));
  }

  const rows = parseCsv(trimmed);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.toLowerCase().trim());
  const hasHeader =
    header.includes("url") ||
    header.includes("title") ||
    header.includes("time_added");
  const body = hasHeader ? rows.slice(1) : rows;

  const col = (name: string): number => header.indexOf(name);

  const iTitle = hasHeader ? col("title") : 0;
  const iUrl = hasHeader ? col("url") : 1;
  const iTime = hasHeader ? col("time_added") : -1;
  const iTags = hasHeader ? col("tags") : -1;
  const iStatus = hasHeader ? col("status") : -1;

  const out: PocketRow[] = [];
  for (const cols of body) {
    const url = (iUrl >= 0 ? cols[iUrl] : cols[1])?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const rawTags = iTags >= 0 ? cols[iTags] ?? "" : "";
    out.push({
      title: iTitle >= 0 ? (cols[iTitle] ?? "").trim() : "",
      url,
      timeAdded:
        iTime >= 0 ? Number(cols[iTime]) || undefined : undefined,
      tags: rawTags
        .split(/[|,]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      status: iStatus >= 0 ? cols[iStatus] : undefined,
    });
  }
  return out;
}

/**
 * Minimal RFC 4180-ish CSV parser that handles quoted fields and newlines
 * inside quotes. Pocket exports are well-behaved but not guaranteed to be
 * so — keep this forgiving.
 */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        // Normalize \r\n — skip the \n that follows a \r.
        if (ch === "\r" && input[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Runs the import with bounded concurrency. Invokes `onProgress` after
 * each row completes so UIs can live-update. Returns the full outcome
 * list (in input order).
 */
export async function runImport(
  rows: PocketRow[],
  opts: {
    concurrency?: number;
    onProgress?: (p: ImportProgress) => void;
    onOutcome?: (o: ImportOutcome) => void;
    signal?: AbortSignal;
  } = {},
): Promise<ImportOutcome[]> {
  const concurrency = opts.concurrency ?? 3;
  const outcomes: ImportOutcome[] = new Array(rows.length);
  let cursor = 0;
  let done = 0;
  let saved = 0;
  let duplicates = 0;
  let errors = 0;

  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(
      (async () => {
        while (!opts.signal?.aborted) {
          const i = cursor++;
          if (i >= rows.length) return;
          const row = rows[i];
          opts.onProgress?.({
            total: rows.length,
            done,
            saved,
            duplicates,
            errors,
            current: row,
          });
          const outcome = await importOne(row);
          outcomes[i] = outcome;
          done++;
          if (outcome.kind === "saved") saved++;
          else if (outcome.kind === "duplicate") duplicates++;
          else errors++;
          opts.onOutcome?.(outcome);
          opts.onProgress?.({
            total: rows.length,
            done,
            saved,
            duplicates,
            errors,
          });
        }
      })(),
    );
  }
  await Promise.all(workers);
  return outcomes;
}

async function importOne(row: PocketRow): Promise<ImportOutcome> {
  try {
    const res = await api.save(row.url);
    // Merge Pocket tags with whatever the server auto-tagged.
    if (row.tags.length > 0) {
      try {
        const existing = await api.get(res.id);
        const merged = mergeTags(existing.tags ?? [], row.tags);
        if (merged.join(",") !== (existing.tags ?? []).join(",")) {
          await api.update(res.id, { tags: merged });
        }
      } catch {
        /* non-fatal: save succeeded */
      }
    }
    // Optionally archive if Pocket marked it archived.
    if ((row.status ?? "").toLowerCase() === "archive") {
      try {
        await api.update(res.id, { is_archived: true });
      } catch {
        /* non-fatal */
      }
    }
    return res.duplicate
      ? { kind: "duplicate", row, id: res.id, title: res.title }
      : { kind: "saved", row, id: res.id, title: res.title };
  } catch (e: any) {
    return {
      kind: "error",
      row,
      message: e?.message ?? "unknown error",
    };
  }
}

function mergeTags(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...a, ...b]) {
    const k = t.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
