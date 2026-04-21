import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { Icon } from "./Icon";

type Props = {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  size?: number;
};

export function IconButton({ icon, label, onClick, active, className, size = 18 }: Props) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 ease-out",
        active
          ? "bg-rule text-ink"
          : "text-ink-muted hover:bg-rule/60 hover:text-ink",
        className,
      )}
    >
      <Icon icon={icon} size={size} />
    </button>
  );
}
