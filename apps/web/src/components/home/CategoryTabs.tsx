"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HOME_TABS, type HomeTabValue } from "@/lib/homeCategories";
import { buildBrowsePath } from "@/lib/listingPath";
import { segmentsForHomeCategory } from "@/lib/seoRoute";
import { slugify } from "@bhavano/types/slugify";
import { useClickOutside } from "@/lib/useClickOutside";
import { MegaMenu } from "./MegaMenu";

export function CategoryTabs({
  active,
  cityName,
}: {
  active: HomeTabValue;
  /** Undefined means "All cities" — the national routes (`/`, `/buy`, `/furniture`). */
  cityName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toolsActive = pathname.startsWith("/tools");
  const plansActive = pathname.startsWith("/premium");
  // No city selected means no ?city= to carry — /premium resolves its own default rather than
  // being handed the literal string "undefined".
  const plansHref = cityName ? `/premium?city=${slugify(cityName)}` : "/premium";
  const [openTab, setOpenTab] = useState<HomeTabValue | null>(null);
  const [menuLeft, setMenuLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpenTab(null));

  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  /** Tracks whether there is more tab row in either direction, so the arrows below appear only
   * when they mean something.
   *
   * The row has always scrolled horizontally; nothing said so. On a phone the last two or three
   * tabs sit off-screen with no scrollbar to hint at them — desktop browsers hide overlay
   * scrollbars until you scroll, and touch devices never draw one — so a visitor could easily
   * conclude Buy and Rent were the whole set.
   *
   * A ResizeObserver as well as a scroll listener: the row also becomes scrollable, or stops
   * being, when the viewport changes or a font loads and reflows it, with no scroll event. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      // 1px of slack — fractional scroll positions on zoomed or high-DPI displays otherwise
      // leave an arrow lit at the very end of the track.
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

  function scrollTabs(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  // Click navigates (and always closes the dropdown, since clicking is committing to that
  // page) — opening the dropdown is a separate, hover-only interaction below, matching how
  // MegaMenu's own column-1 items already switch via onMouseEnter.
  //
  // Every tab now has a real path in every city state, so this is one expression rather than the
  // two branches it used to be. With a city selected: /bengaluru, /bengaluru/buy. Without one:
  // /, /buy. The area is deliberately dropped — switching tab is a reset, and
  // /{city}/{area}/{group} is often empty enough to look broken.
  function onTabClick(tab: HomeTabValue) {
    setOpenTab(null);
    const { transactionGroup, category } = segmentsForHomeCategory(tab);
    router.push(buildBrowsePath({ cityName, transactionGroup, category }));
  }

  // The tab row itself scrolls horizontally on narrow screens (overflow-x-auto), which would
  // clip the mega menu if it lived inside that row — so it's rendered as a sibling instead,
  // positioned under whichever tab is open via this offset (measured at hover time).
  function onTabHover(tab: HomeTabValue, el: HTMLButtonElement) {
    const container = containerRef.current;
    if (container) setMenuLeft(el.getBoundingClientRect().left - container.getBoundingClientRect().left);
    setOpenTab(tab);
  }

  const openTabData = HOME_TABS.find((t) => t.value === openTab);

  return (
    <div ref={containerRef} className="relative" onMouseLeave={() => setOpenTab(null)}>
      {/* Fade plus chevron rather than a bare arrow: the fade shows content continuing under it,
        * which is what tells you to scroll, and the chevron gives a mouse something to click.
        * Rendered only on the side that actually has more.
        *
        * The chevron sits in a bordered circle rather than floating as a bare glyph — over a row
        * of bordered tabs a loose character reads as punctuation, not a control. */}
      {overflow.left && (
        <button
          type="button"
          aria-label="Scroll categories left"
          onClick={() => scrollTabs(-200)}
          className="absolute left-0 top-0 bottom-0 z-20 w-14 flex items-center justify-start pl-0.5 border-0 cursor-pointer bg-gradient-to-r from-bg via-bg to-transparent"
        >
          <span className="w-8 h-8 rounded-full bg-surface border border-border shadow-[0_1px_4px_rgba(0,0,0,0.18)] flex items-center justify-center text-text text-xl leading-none pb-0.5">
            ‹
          </span>
        </button>
      )}
      {overflow.right && (
        <button
          type="button"
          aria-label="Scroll categories right"
          onClick={() => scrollTabs(200)}
          className="absolute right-0 top-0 bottom-0 z-20 w-14 flex items-center justify-end pr-0.5 border-0 cursor-pointer bg-gradient-to-l from-bg via-bg to-transparent"
        >
          <span className="w-8 h-8 rounded-full bg-surface border border-border shadow-[0_1px_4px_rgba(0,0,0,0.18)] flex items-center justify-center text-text text-xl leading-none pb-0.5">
            ›
          </span>
        </button>
      )}
      {/* scrollbar-none: the row is scrolled by these arrows or a swipe, and a visible bar under
        * the tabs would read as a second border. */}
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === active;
          const highlighted = isActive || openTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabClick(tab.value)}
              onMouseEnter={(e) => tab.column1.length > 0 && onTabHover(tab.value, e.currentTarget)}
              className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold cursor-pointer whitespace-nowrap ${
                isActive ? "bg-surface-alt text-text" : "bg-transparent text-text-soft"
              } ${highlighted ? "border-b-gold" : "border-b-transparent"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.column1.length > 0 && <span className="text-[10px] text-muted">▾</span>}
            </button>
          );
        })}
        {/* prefetch={false} — see the note on the same links in Header.tsx. A payload prefetched
          * from a city page carries that city's chip into a page opened from somewhere else. */}
        <Link
          href="/tools"
          prefetch={false}
          className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold whitespace-nowrap ${
            toolsActive ? "bg-surface-alt text-text border-b-gold" : "bg-transparent text-text-soft border-b-transparent"
          }`}
        >
          <span>🧮</span>
          Tools
        </Link>
        <Link
          href={plansHref}
          prefetch={false}
          className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold whitespace-nowrap ${
            plansActive ? "bg-surface-alt text-text border-b-gold" : "bg-transparent text-text-soft border-b-transparent"
          }`}
        >
          <span>✨</span>
          Plans
        </Link>
      </div>

      {openTabData && (
        <div className="absolute top-full" style={{ left: menuLeft }}>
          <MegaMenu tab={openTabData} cityName={cityName} onNavigate={() => setOpenTab(null)} />
        </div>
      )}
    </div>
  );
}
