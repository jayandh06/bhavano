"use client";

import { useRef, useState, type ReactNode } from "react";
import { useClickOutside } from "@/lib/useClickOutside";
import { Icon } from "./Icon";

/**
 * Mobile-only (`< sm`) search toggle for the header's second row. Desktop always shows the full
 * `SearchBar`; a phone has no room for it beside the city picker and Post-ad button, so this
 * starts as a plain icon and, on tap, expands to cover the row (`absolute inset-0` — the parent
 * row needs `relative`) with the same `SearchBar` passed in as `children`, so search behaves
 * identically everywhere rather than a second, simplified implementation.
 */
export function MobileInlineSearch({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setExpanded(false));

  if (!expanded) {
    return (
      <button
        type="button"
        aria-label="Search"
        onClick={() => setExpanded(true)}
        className="sm:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-surface-alt text-text text-[17px] cursor-pointer"
      >
        <Icon name="search" />
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="sm:hidden absolute inset-0 z-10 flex items-center gap-2 bg-[linear-gradient(180deg,var(--surface),var(--bg))]"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={() => setExpanded(false)}
        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-surface-alt text-text text-[17px] cursor-pointer"
      >
        <Icon name="close" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
