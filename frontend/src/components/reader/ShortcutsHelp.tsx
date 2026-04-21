import { X } from "lucide-react";
import { Icon } from "../primitives/Icon";

type Row = { keys: string[]; label: string };

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Reader",
    rows: [
      { keys: ["-"], label: "Smaller text" },
      { keys: ["+", "="], label: "Bigger text" },
      { keys: ["f"], label: "Toggle favorite" },
      { keys: ["a"], label: "Archive / unarchive" },
      { keys: ["t"], label: "Cycle theme (paper → sepia → dusk)" },
    ],
  },
  {
    title: "Panels",
    rows: [
      { keys: ["c"], label: "Open chat" },
      { keys: ["r"], label: "Open research" },
      { keys: ["esc"], label: "Close panel or dialog" },
    ],
  },
  {
    title: "Navigation",
    rows: [
      { keys: ["⌘K"], label: "Command palette (search + jump)" },
      { keys: ["g", "l"], label: "Go to library" },
      { keys: ["g", "h"], label: "Go to highlights" },
      { keys: ["?"], label: "Show this help" },
    ],
  },
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="bf-fade-enter fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-xl border border-rule bg-paper-raised shadow-modal"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta">
            keyboard shortcuts
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-muted hover:bg-rule/50 hover:text-ink"
          >
            <Icon icon={X} size={15} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {GROUPS.map((g, i) => (
            <section
              key={g.title}
              className={i > 0 ? "mt-5 border-t border-dashed border-rule pt-4" : ""}
            >
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                {g.title}
              </div>
              <ul className="space-y-1.5">
                {g.rows.map((r) => (
                  <li
                    key={r.label}
                    className="flex items-center justify-between gap-4 py-1"
                  >
                    <span className="font-sans text-[13px] text-ink">
                      {r.label}
                    </span>
                    <span className="flex items-center gap-1">
                      {r.keys.map((k, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          {ki > 0 && (
                            <span className="font-mono text-[10px] text-ink-faint">
                              then
                            </span>
                          )}
                          <kbd className="rounded-md border border-rule bg-paper px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink shadow-[0_1px_0_rgba(43,35,32,0.08)]">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
