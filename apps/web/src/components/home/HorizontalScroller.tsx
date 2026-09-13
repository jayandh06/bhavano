"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * A horizontally scrolling region that says it scrolls.
 *
 * Nothing else does. Scrollbars are hidden here (a bar under a tab row or inside a bordered
 * table reads as a second border), desktop browsers keep overlay scrollbars invisible until you
 * scroll, and touch devices never draw one — so content past the right edge is simply invisible,
 * and a comparison table looks like it has three columns when it has six.
 *
 * A chevron appears only on a side that actually has more, and clicking it scrolls: a hint you
 * cannot act on is a worse hint. Both a scroll listener and a ResizeObserver, because a region
 * also becomes scrollable — or stops being — when the viewport changes or a font loads and
 * reflows it, neither of which fires a scroll event.
 *
 * Arrow styling mirrors the native app's own scrollable-row chevrons (`ScrollableRow` in
 * `CategoryChips.tsx`) — a flat, muted icon on a solid background rather than a bold green
 * circle, so the two apps' scroll affordance reads the same. `arrowBackground` exists for the
 * same reason it does there: this row rarely sits directly on the page background, and a solid
 * swatch needs to know what to blend into.
 */
export function HorizontalScroller({
  children,
  className = "",
  contentClassName = "",
  ariaLabel = "content",
  arrowBackground = "bg-surface",
}: {
  children: ReactNode;
  /** On the scrolling element itself. */
  className?: string;
  /** On the positioned wrapper the arrows are anchored to — border and radius belong here, so
   * the arrows sit inside the frame rather than over its edge. */
  contentClassName?: string;
  ariaLabel?: string;
  /** Tailwind background class the arrow buttons sit on — default matches the two existing
   * table callers (`bg-surface`); `CategoryTabs` overrides it to the tab strip's own
   * `bg-surface-alt` band. */
  arrowBackground?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      // 1px of slack — a fractional scroll position on a zoomed or high-DPI display otherwise
      // leaves an arrow lit at the very end of the track.
      setOverflow({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  function scrollBy(delta: number) {
    ref.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  const arrow = (side: "left" | "right") => (
    <button
      type="button"
      aria-label={`Scroll ${ariaLabel} ${side}`}
      onClick={() => scrollBy(side === "left" ? -220 : 220)}
      className={`absolute ${side === "left" ? "left-0" : "right-0"} top-0 bottom-0 z-20 w-6 flex items-center ${
        side === "left" ? "justify-start pl-0.5" : "justify-end pr-0.5"
      } border-0 cursor-pointer text-text-soft text-lg opacity-90 ${arrowBackground}`}
    >
      <Icon name={side === "left" ? "chevronLeft" : "chevronRight"} />
    </button>
  );

  return (
    <div className={`relative ${contentClassName}`}>
      {overflow.left && arrow("left")}
      {overflow.right && arrow("right")}
      <div ref={ref} className={`overflow-x-auto scrollbar-none ${className}`}>
        {children}
      </div>
    </div>
  );
}
