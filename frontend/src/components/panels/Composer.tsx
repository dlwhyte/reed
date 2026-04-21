import { useEffect, useRef } from "react";
import { Loader2, ArrowUp } from "lucide-react";
import { clsx } from "clsx";
import { Icon } from "../primitives/Icon";

type Accent = "plum" | "olive";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder: string;
  accent: Accent;
};

const ACCENT_BTN: Record<Accent, string> = {
  plum: "bg-plum text-white hover:brightness-110",
  olive: "bg-olive text-white hover:brightness-110",
};

const FOCUS_RING: Record<Accent, string> = {
  plum: "focus-within:border-plum",
  olive: "focus-within:border-olive",
};

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  busy,
  placeholder,
  accent,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(140, el.scrollHeight) + "px";
  }, [value]);

  const canSend = !!value.trim() && !busy && !disabled;

  return (
    <div className="border-t border-rule bg-paper-raised p-3">
      <div
        className={clsx(
          "flex items-end gap-2 rounded-lg border border-rule bg-paper px-3 py-2 transition-colors duration-150",
          FOCUS_RING[accent],
        )}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="min-h-[22px] max-h-[140px] flex-1 resize-none bg-transparent font-sans text-[14px] leading-[1.5] text-ink placeholder:text-ink-faint outline-none"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send"
          className={clsx(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
            canSend
              ? ACCENT_BTN[accent]
              : "bg-rule text-white/80 cursor-not-allowed",
          )}
        >
          {busy ? (
            <Icon icon={Loader2} size={14} className="animate-spin" />
          ) : (
            <Icon icon={ArrowUp} size={14} />
          )}
        </button>
      </div>
    </div>
  );
}
