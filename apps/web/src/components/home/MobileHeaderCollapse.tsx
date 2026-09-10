"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mobile-only (`< sm`) progressive collapse for the site header.
 *
 * Desktop renders `children` — the full server-rendered header — untouched; this component adds
 * nothing there. On a phone, once the page is scrolled past the top the tall pinned header is
 * swapped for a ~52px bar: `[☰] logo ········· Post ad`. The `☰` opens a drawer holding the
 * city picker, category links, the utility links, the account menu, and the theme toggle —
 * every one of them server-rendered in `drawer`, so this leaf only toggles visibility. That is
 * the whole reason it exists: Header.tsx stays a Server Component and the SEO-relevant markup
 * never moves into a client-only fetch.
 *
 * Collapse is driven by an IntersectionObserver sentinel, not a scroll handler.
 *
 * v1 limitation: swapping the ~140px header for the ~52px bar snaps the page up once per
 * collapse. A height/opacity transition is the planned refinement — see
 * docs/plans/mobile-collapsing-header.md.
 */
export function MobileHeaderCollapse({
  children,
  collapsedBar,
  drawer,
}: {
  children: ReactNode;
  /** Sits to the right of the hamburger in the collapsed bar — logo + spacer + Post ad. */
  collapsedBar: ReactNode;
  /** Contents of the hamburger drawer. */
  drawer: ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      const nextCollapsed = !entry.isIntersecting;
      setCollapsed(nextCollapsed);
      // The drawer only lives inside the collapsed bar, so scrolling back up must dismiss it.
      if (!nextCollapsed) setMenuOpen(false);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      <div className={collapsed ? "max-sm:hidden" : undefined}>{children}</div>

      <div
        ref={barRef}
        className={`sm:hidden sticky top-0 z-40 bg-[linear-gradient(180deg,var(--surface),var(--bg))] border-b border-border shadow-[0_2px_8px_rgba(11,61,46,0.09)] ${
          collapsed ? "" : "hidden"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 flex items-center gap-2.5 h-[52px]">
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-surface-alt text-text text-lg leading-none cursor-pointer"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">{collapsedBar}</div>
        </div>

        {menuOpen && (
          <div className="absolute left-0 right-0 top-full max-h-[calc(100dvh-52px)] overflow-y-auto bg-surface border-b border-border shadow-[0_12px_28px_rgba(0,0,0,0.16)]">
            {/* Delegated close: any activated link inside the drawer (tap or keyboard) navigates,
              * so the drawer should go with it. Buttons within — the city picker, the account
              * menu — are not `<a>`, so using them leaves the drawer open, which is what you want. */}
            <div
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
              }}
              className="max-w-[1280px] mx-auto px-4 py-3 flex flex-col gap-0.5"
            >
              {drawer}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
