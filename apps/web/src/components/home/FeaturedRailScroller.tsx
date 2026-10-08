"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * The interactive chrome around FeaturedRail's scrollable strip — edge fades and arrow buttons —
 * split into its own client component so the listing markup FeaturedRail renders (title, price,
 * links — the actual SEO-relevant content) stays server-rendered; this wrapper only owns the
 * scroll container ref and button/fade visibility, never the listing content itself, which arrives
 * as `children` already rendered. See CLAUDE.md's "smallest possible leaf component" rule.
 *
 * Desktop/tablet only (sm: and up, same breakpoint FeaturedRail's own card width already splits
 * on) — a touch device already has a well-learned swipe gesture for this; the "can't tell it
 * scrolls" problem these fix is specifically the desktop-mouse gap (no instinctive click-drag),
 * not something touch users hit.
 */
export function FeaturedRailScroller({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  // Runs once on mount to set the initial fade/arrow state (does this row overflow at all?), and
  // again on resize — a row that overflows at a narrow width can stop overflowing once the
  // viewport (and so the row) grows past the content's total width.
  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, []);

  function scrollByPage(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex items-stretch gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:thin] -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {children}
      </div>

      {/* Pure visual hint that there's more to scroll — pointer-events-none so it never blocks
        * the scroll/drag it's sitting on top of. */}
      {canScrollLeft && (
        <div className="hidden sm:block pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-surface to-transparent" />
      )}
      {canScrollRight && (
        <div className="hidden sm:block pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-surface to-transparent" />
      )}

      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollByPage(-1)}
          className="hidden sm:flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface border border-border shadow-md text-text cursor-pointer"
        >
          <Icon name="chevronLeft" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollByPage(1)}
          className="hidden sm:flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface border border-border shadow-md text-text cursor-pointer"
        >
          <Icon name="chevronRight" />
        </button>
      )}
    </div>
  );
}
