import { useEffect, useState } from "react";

/**
 * Tracks vertical scroll direction with a small hysteresis so that tiny
 * thumb jitters don't toggle UI repeatedly. `hidden` flips true once the
 * user has scrolled down past `threshold` and resets the moment they
 * scroll up.
 */
export function useHideOnScrollDown(threshold = 80): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - last;
        if (y < threshold) {
          setHidden(false);
        } else if (delta > 4) {
          setHidden(true);
        } else if (delta < -4) {
          setHidden(false);
        }
        last = y;
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return hidden;
}
