"use client";

import { useCallback, useLayoutEffect, useState } from "react";

/** Gap left between a clamped panel and the edge of the screen. */
const EDGE_MARGIN = 12;

/**
 * Keeps an absolutely-positioned dropdown inside the viewport by shifting it left when it would
 * spill off the right edge.
 *
 * Every filter dropdown is anchored `left-0` to its own pill, so how far right it reaches depends
 * entirely on where that pill happens to sit — which on a phone is wherever the row wrapped it to.
 * `max-w-[calc(100vw-2rem)]` (the previous attempt at this) caps the *width* but not the position:
 * a 328px panel is still 328px wide when its left edge starts at x=150 on a 360px screen. The
 * price panel was the visible case, spilling past the filter card to within 5px of the screen edge
 * with 27px of slack on the other side.
 *
 * A measured shift rather than flipping to `right-0`: a flip solves the pill-on-the-right case and
 * breaks the pill-in-the-middle one, and it moves the panel away from the control it belongs to.
 * `useLayoutEffect` measures before paint, so the panel never renders in the wrong place first.
 *
 * Returns the number of pixels to shift left — 0 when it already fits, which is every desktop case.
 */
export function useClampToViewport(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
): number {
  const [shift, setShift] = useState(0);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Measured with the shift removed, so this is idempotent: re-running must not compound the
    // correction it applied last time.
    const rect = el.getBoundingClientRect();
    const currentShift = Number(el.dataset.clampShift ?? 0);
    const unshiftedRight = rect.right + currentShift;
    const limit = document.documentElement.clientWidth - EDGE_MARGIN;
    const overflow = unshiftedRight - limit;
    // Never shift so far that the panel's own left edge leaves the screen — a panel wider than the
    // viewport can only be capped by its `max-w`, not moved into fitting.
    const next = overflow > 0 ? Math.min(overflow, Math.max(rect.left + currentShift - EDGE_MARGIN, 0)) : 0;
    el.dataset.clampShift = String(next);
    setShift(next);
  }, [ref]);

  useLayoutEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    measure();
    // Rotating a phone or an on-screen keyboard resizing the viewport both change the answer while
    // the panel is still open.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, measure]);

  return shift;
}
