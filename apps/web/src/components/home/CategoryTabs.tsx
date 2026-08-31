"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HOME_TABS, type HomeTabValue } from "@/lib/homeCategories";
import { buildBrowsePath } from "@/lib/listingPath";
import { segmentsForHomeCategory } from "@/lib/seoRoute";
import { slugify } from "@bhavano/types/slugify";
import { useClickOutside } from "@/lib/useClickOutside";
import { HorizontalScroller } from "./HorizontalScroller";
import { MegaMenu } from "./MegaMenu";
import { Icon } from "./Icon";

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
      <HorizontalScroller ariaLabel="categories" className="flex gap-1.5">
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
              <Icon name={tab.icon} />
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
          <Icon name="calculator" />
          Tools
        </Link>
        <Link
          href={plansHref}
          prefetch={false}
          className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold whitespace-nowrap ${
            plansActive ? "bg-surface-alt text-text border-b-gold" : "bg-transparent text-text-soft border-b-transparent"
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
    </div>
  );
}
