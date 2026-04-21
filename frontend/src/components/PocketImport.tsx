import { useRef, useState } from "react";
import { AlertTriangle, Check, StopCircle, Upload } from "lucide-react";
import { clsx } from "clsx";
import { Icon } from "./primitives/Icon";
import {
  parsePocketCsv,
  runImport,
  type ImportOutcome,
  type ImportProgress,
  type PocketRow,
} from "../lib/pocketImport";

type Stage = "idle" | "parsing" | "preview" | "running" | "done";

export function PocketImport() {
  const [stage, setStage] = useState<Stage>("idle");
  const [rows, setRows] = useState<PocketRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setStage("parsing");
    try {
      const text = await file.text();
      const parsed = parsePocketCsv(text);
      if (parsed.length === 0) {
        setError("Didn't find any URLs in that file. Expecting a Pocket CSV or a list of URLs.");
        setStage("idle");
        return;
      }
      setRows(parsed);
      setStage("preview");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't read that file.");
      setStage("idle");
    }
  }

  async function start() {
    if (rows.length === 0) return;
    setStage("running");
    setOutcomes([]);
    setProgress({
      total: rows.length,
      done: 0,
      saved: 0,
      duplicates: 0,
      errors: 0,
    });
    const controller = new AbortController();
    abortRef.current = controller;
    const out = await runImport(rows, {
      concurrency: 3,
      signal: controller.signal,
      onProgress: setProgress,
      onOutcome: (o) => setOutcomes((prev) => [...prev, o]),
    });
    abortRef.current = null;
    setOutcomes(out.filter(Boolean));
    setStage("done");
  }

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function reset() {
    setStage("idle");
    setRows([]);
    setProgress(null);
    setOutcomes([]);
    setError(null);
  }

  return (
    <div>
      {stage === "idle" || stage === "parsing" ? (
        <DropZone
          dragOver={dragOver}
          onDragEnter={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDrop={(file) => {
            setDragOver(false);
            handleFile(file);
          }}
          onPick={() => fileRef.current?.click()}
          busy={stage === "parsing"}
        />
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-terracotta/40 bg-terracotta-soft/60 px-3 py-2 font-sans text-[13px] text-terracotta">
          <Icon icon={AlertTriangle} size={14} />
          {error}
        </div>
      )}

      {stage === "preview" && (
        <PreviewPanel rows={rows} onStart={start} onReset={reset} />
      )}

      {stage === "running" && progress && (
        <RunningPanel
          progress={progress}
          outcomes={outcomes}
          onCancel={cancel}
        />
      )}

      {stage === "done" && progress && (
        <DonePanel
          progress={progress}
          outcomes={outcomes}
          onReset={reset}
        />
      )}
    </div>
  );
}

function DropZone({
  dragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onPick,
  busy,
}: {
  dragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (file: File) => void;
  onPick: () => void;
  busy: boolean;
}) {
  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        onDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onDrop(file);
      }}
      className={clsx(
        "relative flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-150",
        dragOver
          ? "border-terracotta bg-terracotta-soft/40"
          : "border-rule bg-paper",
      )}
    >
      <Icon icon={Upload} size={22} className="text-terracotta" />
      <div className="font-display text-[16px] font-semibold text-ink">
        Drop your Pocket export here
      </div>
      <p className="max-w-sm font-display text-[13px] italic text-ink-muted [text-wrap:pretty]">
        A CSV with <span className="font-mono not-italic">title, url, time_added, tags, status</span> — or any text file
        with one URL per line.
      </p>
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-terracotta px-4 py-2 font-sans text-[13px] font-medium text-white shadow-pill hover:brightness-105 disabled:opacity-60"
      >
        <Icon icon={Upload} size={14} />
        {busy ? "Reading…" : "Choose file"}
      </button>
    </div>
  );
}

function PreviewPanel({
  rows,
  onStart,
  onReset,
}: {
  rows: PocketRow[];
  onStart: () => void;
  onReset: () => void;
}) {
  const withTags = rows.filter((r) => r.tags.length > 0).length;
  const archived = rows.filter(
    (r) => (r.status ?? "").toLowerCase() === "archive",
  ).length;
  const sample = rows.slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-rule bg-paper-raised p-4">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta">
          ready to import
        </div>
        <div className="font-display text-[20px] font-semibold leading-snug text-ink [text-wrap:balance]">
          {rows.length} {rows.length === 1 ? "URL" : "URLs"} found
          <span className="font-normal text-ink-muted">
            {withTags > 0 && ` · ${withTags} with tags`}
            {archived > 0 && ` · ${archived} archived`}
          </span>
        </div>
        <p className="mt-1 font-display text-[13.5px] italic text-ink-muted">
          I’ll hit the parse service, keep Pocket tags, and move Pocket-archived
          items straight to your archive. Duplicates skip themselves.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-paper-raised">
        <div className="border-b border-dashed border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          first few rows
        </div>
        <ul className="divide-y divide-dashed divide-rule">
          {sample.map((r, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-2.5">
              <span className="mt-0.5 font-mono text-[10px] text-ink-faint tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                {r.title && (
                  <div className="truncate font-display text-[13.5px] font-medium text-ink">
                    {r.title}
                  </div>
                )}
                <div className="truncate font-mono text-[10px] text-ink-muted">
                  {r.url}
                </div>
                {r.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-pill bg-butter px-1.5 py-px font-mono text-[9px] text-ink"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center gap-1.5 rounded-pill bg-terracotta px-5 py-2 font-sans text-[13px] font-medium text-white shadow-pill hover:brightness-105"
        >
          Start import
        </button>
        <button
          type="button"
          onClick={onReset}
          className="font-sans text-[13px] text-ink-muted hover:text-ink"
        >
          Choose a different file
        </button>
      </div>
    </div>
  );
}

function RunningPanel({
  progress,
  outcomes,
  onCancel,
}: {
  progress: ImportProgress;
  outcomes: ImportOutcome[];
  onCancel: () => void;
}) {
  const pct = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;
  const recent = outcomes.slice(-5).reverse();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-rule bg-paper-raised p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta">
            importing · {pct}%
          </div>
          <div className="font-mono text-[11px] text-ink">
            {progress.done} / {progress.total}
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
          <div
            className="h-full bg-terracotta transition-all duration-150 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        {progress.current && (
          <div className="mt-3 truncate font-display text-[13px] italic text-ink-muted">
            fetching{" "}
            <span className="font-mono not-italic text-[11px] text-ink">
              {progress.current.url}
            </span>
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <TinyStat value={progress.saved} label="saved" tone="olive" />
          <TinyStat value={progress.duplicates} label="duplicates" tone="butter" />
          <TinyStat value={progress.errors} label="errors" tone="terracotta" />
        </div>
      </div>

      {recent.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper-raised">
          <div className="border-b border-dashed border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            just now
          </div>
          <ul className="divide-y divide-dashed divide-rule">
            {recent.map((o, i) => (
              <OutcomeRow key={i} outcome={o} />
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 rounded-pill border border-rule px-3 py-1.5 font-sans text-[12px] text-ink-muted hover:text-ink"
      >
        <Icon icon={StopCircle} size={12} />
        Stop
      </button>
    </div>
  );
}

function DonePanel({
  progress,
  outcomes,
  onReset,
}: {
  progress: ImportProgress;
  outcomes: ImportOutcome[];
  onReset: () => void;
}) {
  const errors = outcomes.filter((o) => o.kind === "error");
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-rule bg-paper-raised p-4">
        <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-olive">
          <Icon icon={Check} size={12} />
          import done
        </div>
        <div className="font-display text-[20px] font-semibold text-ink">
          {progress.saved} on the shelf
          {progress.duplicates > 0 && (
            <span className="font-normal text-ink-muted">
              {" "}
              · {progress.duplicates} already saved
            </span>
          )}
        </div>
        {progress.errors > 0 && (
          <p className="mt-1 font-display text-[13.5px] italic text-terracotta">
            {progress.errors} couldn’t be fetched — likely dead links or paywalls.
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <TinyStat value={progress.saved} label="saved" tone="olive" />
          <TinyStat value={progress.duplicates} label="duplicates" tone="butter" />
          <TinyStat value={progress.errors} label="errors" tone="terracotta" />
        </div>
      </div>

      {errors.length > 0 && (
        <details className="overflow-hidden rounded-lg border border-rule bg-paper-raised">
          <summary className="cursor-pointer border-b border-dashed border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink">
            show errors ({errors.length})
          </summary>
          <ul className="divide-y divide-dashed divide-rule">
            {errors.slice(0, 30).map((o, i) => (
              <OutcomeRow key={i} outcome={o} />
            ))}
          </ul>
        </details>
      )}

      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 rounded-pill bg-terracotta px-4 py-2 font-sans text-[13px] font-medium text-white shadow-pill hover:brightness-105"
      >
        Import another file
      </button>
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: ImportOutcome }) {
  const label =
    outcome.kind === "saved"
      ? "saved"
      : outcome.kind === "duplicate"
      ? "already on shelf"
      : "error";
  const tone =
    outcome.kind === "saved"
      ? "text-olive"
      : outcome.kind === "duplicate"
      ? "text-ink-muted"
      : "text-terracotta";
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span
        className={clsx(
          "mt-0.5 w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]",
          tone,
        )}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[13px] font-medium text-ink">
          {outcome.kind === "error"
            ? outcome.row.title || outcome.row.url
            : outcome.title || outcome.row.title || outcome.row.url}
        </div>
        <div className="truncate font-mono text-[10px] text-ink-muted">
          {outcome.kind === "error"
            ? outcome.message
            : outcome.row.url}
        </div>
      </div>
    </li>
  );
}

function TinyStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "olive" | "butter" | "terracotta";
}) {
  const bg =
    tone === "olive"
      ? "bg-olive-soft/70 text-olive"
      : tone === "butter"
      ? "bg-butter/70 text-ink"
      : "bg-terracotta-soft/60 text-terracotta";
  return (
    <div
      className={clsx(
        "flex flex-col items-start rounded-md px-3 py-2",
        bg,
      )}
    >
      <span className="font-display text-[22px] font-semibold leading-none tabular-nums">
        {value}
      </span>
      <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em]">
        {label}
      </span>
    </div>
  );
}
