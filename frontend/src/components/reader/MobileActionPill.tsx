import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { Icon } from "../primitives/Icon";

type Accent = "plum" | "olive" | "terracotta";

type Action = {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  accent?: Accent;
  fill?: boolean;
};

const ACCENT_BG: Record<Accent, string> = {
  plum: "bg-plum text-white",
  olive: "bg-olive text-white",
  terracotta: "text-terracotta",
};

export function MobileActionPill({ actions }: { actions: Action[] }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center pb-safe md:hidden"
      aria-label="Reader actions"
    >
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-pill border border-rule bg-paper-raised/75 p-1 shadow-modal backdrop-blur-xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--bf-paper-raised) 72%, transparent)" }}
      >
        {actions.map((a) => (
          <PillBtn key={a.id} action={a} />
        ))}
      </div>
    </div>
  );
}

function PillBtn({ action }: { action: Action }) {
  const accent = action.accent ?? "olive";
  const isActive = !!action.active;
  const base =
    "flex h-10 w-10 items-center justify-center rounded-pill transition-colors duration-150 ease-out";
  const style = isActive
    ? ACCENT_BG[accent]
    : "text-ink-muted hover:text-ink hover:bg-rule/40";
  return (
    <button
      type="button"
      onClick={action.onClick}
      aria-label={action.label}
      title={action.label}
      className={clsx(base, style)}
    >
      <Icon
        icon={action.icon}
        size={18}
        fill={action.fill ? "currentColor" : "none"}
      />
    </button>
  );
}
