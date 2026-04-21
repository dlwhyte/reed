import { Link } from "react-router-dom";
import {
  Hash,
  Highlighter,
  Search,
  Settings as SettingsIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { Wordmark } from "./primitives/Wordmark";
import { IconButton } from "./primitives/IconButton";
import { useHideOnScrollDown } from "../lib/useScrollDirection";

type Props = {
  onFocusSearch?: () => void;
  subtitle?: string;
};

export default function LibraryHeader({
  onFocusSearch,
  subtitle = "a reading shelf you actually return to",
}: Props) {
  const hidden = useHideOnScrollDown();

  return (
    <header
      className={clsx(
        "sticky top-0 z-20 border-b border-rule bg-paper/80 backdrop-blur pt-safe transition-transform duration-200 ease-out",
        hidden && "-translate-y-full md:translate-y-0",
      )}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 md:px-10">
        <Link to="/" className="flex items-baseline gap-3.5 min-w-0">
          <Wordmark size="md" />
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:inline">
            {subtitle}
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          {onFocusSearch && (
            <IconButton
              icon={Search}
              label="Search"
              onClick={onFocusSearch}
            />
          )}
          <Link to="/tags" aria-label="All tags" title="All tags">
            <IconButton icon={Hash} label="All tags" />
          </Link>
          <Link to="/highlights" aria-label="Highlights" title="Highlights">
            <IconButton icon={Highlighter} label="Highlights" />
          </Link>
          <Link to="/settings" aria-label="Settings" title="Settings">
            <IconButton icon={SettingsIcon} label="Settings" />
          </Link>
        </div>
      </div>
    </header>
  );
}
