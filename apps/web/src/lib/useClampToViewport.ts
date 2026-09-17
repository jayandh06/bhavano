"use client";

import { useLayoutEffect } from "react";

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
 *
 * The offset is written straight to the node's own `transform` rather than held in React state.
 * That is what this is — a measurement pushed back into the DOM — and routing it through `setState`
 * inside a layout effect is both a cascading render and a lint error in this repo. Clearing the
 * transform before measuring makes it idempotent with no bookkeeping: every run starts from the
 * panel's unshifted position.
 */
export function useClampToViewport(ref: React.RefObject<HTMLElement | null>, open: boolean): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return;

    function clamp(): void {
      if (!el) return;
      el.style.transform = "";
      const rect = el.getBoundingClientRect();
      const overflow = rect.right - (document.documentElement.clientWidth - EDGE_MARGIN);
      if (overflow <= 0) return;
      // Never shift so far that the panel's own left edge leaves the screen — a panel wider than
      // the viewport can only be capped by its `max-w`, not moved into fitting.
      const shift = Math.min(overflow, Math.max(rect.left - EDGE_MARGIN, 0));
      if (shift > 0) el.style.transform = `translateX(-${shift}px)`;
    }

    clamp();
    // Rotating a phone, or an on-screen keyboard resizing the viewport, both change the answer
    // while the panel is still open.
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [open, ref]);
}
