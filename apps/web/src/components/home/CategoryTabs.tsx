"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HOME_TABS, type HomeTabValue } from "@/lib/homeCategories";
import { buildBrowsePath } from "@/lib/listingPath";
import { segmentsForHomeCategory, type ParsedSegments } from "@/lib/seoRoute";
import { slugify } from "@bhavano/types/slugify";
import { useClickOutside } from "@/lib/useClickOutside";
import { HorizontalScroller } from "./HorizontalScroller";
import { MegaMenu } from "./MegaMenu";
import { Icon } from "./Icon";

export function CategoryTabs({
  active,
  cityName,
  currentSegments,
}: {
  active: HomeTabValue;
  /** Undefined means "All cities" — the national routes (`/`, `/buy`, `/furniture`). */
  cityName?: string;
  /** Drives the mobile chip row's highlight below — the mega menu's hover-driven column-1
   * selection has nothing to do with which page is actually loaded, but a touch visitor can't
   * hover, so the phone-only chip row needs a real "which one is this page" answer instead. */
  currentSegments?: ParsedSegments;
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

  // Which column-1 value (if any) the *current page* actually represents — PG/Furniture/
  // Interiors encode it as the URL's facet segment, Buy/Rent & Lease as the category segment
  // itself (a column-1 item's `value` for those two tabs is a ListingCategory like "apartment").
  const activeTabData = HOME_TABS.find((t) => t.value === active);
  const activeSubValue =
    active === "pg" || active === "furniture" || active === "interiors"
      ? typeof currentSegments?.facetValue === "string"
        ? currentSegments.facetValue
        : undefined
      : currentSegments?.category;

  return (
    <div ref={containerRef} className="relative" onMouseLeave={() => setOpenTab(null)}>
      <HorizontalScroller ariaLabel="categories" className="flex gap-1.5" arrowBackground="bg-surface-alt">
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === active;
          const highlighted = isActive || openTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabClick(tab.value)}
              onMouseEnter={(e) => tab.column1.length > 0 && onTabHover(tab.value, e.currentTarget)}
              className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold cursor-pointer whitespace-nowrap ${
                isActive ? "bg-green text-on-green" : "bg-transparent text-text-soft"
              } ${highlighted ? "border-b-gold" : "border-b-transparent"}`}
            >
              <Icon name={tab.icon} />
              {tab.label}
              {/* Gated on actual hover capability, not screen width — the menu this points at
                * opens on mouseenter, so what decides whether the chevron means anything is
                * whether the device can hover at all, not how wide its screen is. sm: alone got
                * this wrong for a tablet: touch-primary and often wider than the sm: breakpoint,
                * so it passed the width check and showed a chevron for a menu it can never open
                * by hovering, the exact broken promise this was meant to fix for phones. A
                * touch-tablet still just navigates on tap, identically to a tab with no dropdown.
                * (hover: hover) matches a mouse or trackpad regardless of screen size, and
                * correctly still shows this on, say, a small browser window on a desktop, or a
                * tablet with a mouse attached — width was never actually the right test. */}
              {tab.column1.length > 0 && (
                <span
                  className={`hidden [@media(hover:hover)]:inline text-[10px] ${isActive ? "text-on-green/60" : "text-muted"}`}
                >
                  ▾
                </span>
              )}
            </button>
          );
        })}
        {/* prefetch={false} — see the note on the same links in Header.tsx. A payload prefetched
          * from a city page carries that city's chip into a page opened from somewhere else. */}
        <Link
          href="/tools"
          prefetch={false}
          className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold whitespace-nowrap ${
            toolsActive ? "bg-green text-on-green border-b-gold" : "bg-transparent text-text-soft border-b-transparent"
          }`}
        >
          <Icon name="calculator" />
          Tools
        </Link>
        <Link
          href={plansHref}
          prefetch={false}
          className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold whitespace-nowrap ${
            plansActive ? "bg-green text-on-green border-b-gold" : "bg-transparent text-text-soft border-b-transparent"
          }`}
        >
          <Icon name="sparkles" />
          Plans
        </Link>
      </HorizontalScroller>

      {openTabData && (
        <div className="absolute top-full" style={{ left: menuLeft }}>
          <MegaMenu tab={openTabData} cityName={cityName} onNavigate={() => setOpenTab(null)} />
        </div>
      )}

      {/* Phone-only equivalent of the mega menu above, which opens on hover — unreachable by
        * touch. Real `<Link>`s to the same SEO pages the mega menu points at, not a client
        * filter, so this stays crawlable and every option keeps its own indexable URL. Same
        * green-fill / gold-border oval-chip treatment as the native app's tab submenu, so the
        * two only differ in what's `sm:hidden` vs always mounted. */}
      {activeTabData && activeTabData.column1.length > 0 && (
        <HorizontalScroller
          ariaLabel={`${activeTabData.label} sub-categories`}
          className="flex gap-1.5 pt-1.5"
          contentClassName="sm:hidden"
          arrowBackground="bg-transparent"
        >
          <Link
            href={buildBrowsePath({ cityName, ...segmentsForHomeCategory(active) })}
            className={`shrink-0 border rounded-2xl px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap no-underline ${
              !activeSubValue ? "bg-green text-on-green border-[color:var(--gold)]" : "bg-transparent text-text-soft border-border"
            }`}
          >
            All
          </Link>
          {activeTabData.column1.map((item) => {
            // Every current column1 item sets `href` (see MegaMenuColumn1Item's own doc) — the
            // type keeps it optional for a hypothetical fork-only item, which this row simply
            // skips rather than rendering something unclickable.
            if (!item.href) return null;
            const isActive = item.value === activeSubValue;
            return (
              <Link
                key={item.value}
                href={item.href(cityName)}
                className={`shrink-0 border rounded-2xl px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap no-underline ${
                  isActive ? "bg-green text-on-green border-[color:var(--gold)]" : "bg-transparent text-text-soft border-border"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </HorizontalScroller>
      )}
    </div>
  );
}
