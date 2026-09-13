"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Mobile-only (`< sm`) progressive collapse for the site header.
 *
 * Desktop renders `children` — the full server-rendered header — untouched; this component adds
 * nothing there. On a phone, once the page is scrolled past the top the tall pinned header is
 * swapped for a ~52px bar: `[☰] [🔍] logo ········· Post ad`. The `☰` opens a drawer holding the
 * city picker, category links, the utility links, the account menu, and the theme toggle —
 * every one of them server-rendered in `drawer`, so this leaf only toggles visibility. The `🔍`
 * drops an "extended header" strip below the bar holding the same `SearchBar` passed in as
 * `searchBar` — the full header's search box is otherwise off-screen once collapsed, since it
 * only lives in `children`. That is the whole reason it exists: Header.tsx stays a Server
 * Component and the SEO-relevant markup never moves into a client-only fetch.
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
  searchBar,
}: {
  children: ReactNode;
  /** Sits to the right of the hamburger (and search icon) in the collapsed bar — logo + spacer +
   * Post ad. */
  collapsedBar: ReactNode;
  /** Contents of the hamburger drawer. */
  drawer: ReactNode;
  /** The same `SearchBar` shown in the full header's second row — reused here (not duplicated
   * logic) for the "extended header" search panel that drops below the collapsed bar. */
  searchBar: ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      const nextCollapsed = !entry.isIntersecting;
      setCollapsed(nextCollapsed);
      // The drawer/search panel only live inside the collapsed bar, so scrolling back up must
      // dismiss them.
      if (!nextCollapsed) {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // Pin the page behind the panel. `overflow: hidden` on <body> is ignored by iOS Safari, so
    // pin with position:fixed and restore the scroll offset on close (same approach as
    // MediaLightbox) — otherwise the listing scrolls behind the menu, and closing it drops a
    // mid-page reader back at the top.
    const scrollY = window.scrollY;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [menuOpen]);

  // No scrim and no scroll lock for the search panel — unlike the drawer it's a thin strip, not
  // a modal takeover, so the page stays scrollable/interactable behind it; only Escape closes it.
  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {/* `display: contents` so this wrapper adds no box of its own — otherwise it becomes the
        * containing block for the sticky <header> inside `children`, shrinking its sticky range
        * to this wrapper's ~150px height and unpinning it as soon as you scroll (the util bar
        * scrolling away while identity/search/tabs stay put is the behaviour this restores).
        * When collapsed on a phone, `max-sm:hidden`'s media rule overrides `contents` with
        * `display: none`. */}
      <div className={collapsed ? "contents max-sm:hidden" : "contents"}>{children}</div>

      {/* Reserves the fixed bar's height in flow (only when it's actually shown: mobile +
        * collapsed) so page content isn't hidden behind it. */}
      {collapsed && <div aria-hidden className="sm:hidden h-[52px]" />}
      {/* Same reservation for the extended search panel below the bar — an approximation of its
        * rendered height (SearchBar's own ~50px plus this panel's padding), not a measured value. */}
      {collapsed && searchOpen && <div aria-hidden className="sm:hidden h-[70px]" />}

      <div
        className={`sm:hidden fixed top-0 inset-x-0 z-40 bg-[linear-gradient(180deg,var(--surface),var(--bg))] border-b border-border shadow-[0_2px_8px_rgba(11,61,46,0.09)] ${
          collapsed ? "" : "hidden"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 flex items-center gap-2.5 h-[52px]">
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((o) => !o);
              setSearchOpen(false);
            }}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-surface-alt text-text text-[19px] cursor-pointer"
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
          <button
            type="button"
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen((o) => !o);
              setMenuOpen(false);
            }}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-surface-alt text-text text-[17px] cursor-pointer"
          >
            <Icon name={searchOpen ? "close" : "search"} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">{collapsedBar}</div>
        </div>

        {searchOpen && (
          <div className="border-t border-border px-4 py-2.5">{searchBar}</div>
        )}

        {menuOpen && (
          <>
            {/* Scrim — dims the page and is the tap target to dismiss. Starts under the 52px bar
              * so the bar and its ✕ stay visible and tappable above it. */}
            <div
              aria-hidden
              onClick={() => setMenuOpen(false)}
              className="fixed inset-x-0 top-[52px] bottom-0 z-40 bg-black/35 animate-[scrimIn_0.2s_ease-out]"
            />
            {/* A panel, not a takeover — ~84vw capped at 19rem, so a strip of the page stays
              * visible and it reads as a menu over content. Height follows its content (it only
              * scrolls if that would overflow the viewport), so it ends where the menu ends
              * rather than running a bare column to the bottom of the screen. Delegated close:
              * activating any link inside navigates, so the panel goes with it; the city picker
              * / account rows are buttons, not <a>, so those leave it open. */}
            <div
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
              }}
              className="fixed left-0 top-[52px] z-40 w-[19rem] max-w-[84vw] max-h-[calc(100dvh-52px)] overflow-y-auto overscroll-contain bg-surface border-r border-b border-border rounded-br-2xl shadow-[6px_8px_28px_rgba(0,0,0,0.18)] px-3 py-3 flex flex-col gap-0.5 animate-[drawerInLeft_0.2s_ease-out] motion-reduce:animate-none"
            >
              {drawer}
            </div>
          </>
        )}
      </div>
    </>
  );
}
