"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HomeCategoryFilter } from "@bhavano/types";
import { buildHomeUrl } from "@/lib/homeUrl";
import { HOME_TABS } from "@/lib/homeCategories";
import { buildBrowsePath } from "@/lib/listingPath";
import { segmentsForHomeCategory, type ParsedSegments } from "@/lib/seoRoute";
import { slugify } from "@bhavano/types/slugify";
import { useClickOutside } from "@/lib/useClickOutside";
import { MegaMenu } from "./MegaMenu";

/** Query params any mega-menu link might set — cleared whenever the top-level tab itself
 * is clicked, so switching tabs doesn't carry over a stale bedroom count/condition/etc. */
const FILTER_PARAM_KEYS = [
  "propertyType",
  "bedrooms",
  "sharingType",
  "condition",
  "serviceType",
  "listingCategory",
  "transactionType",
];

export function CategoryTabs({
  active,
  cityName,
  currentSegments,
}: {
  active: HomeCategoryFilter;
  cityName: string;
  /** Set only on the /{city}/... browse pages — its presence is what tells a tab click to stay
   * in the browse view instead of falling back to the homepage's query-string filter view. */
  currentSegments?: ParsedSegments;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const toolsActive = pathname.startsWith("/tools");
  const plansActive = pathname.startsWith("/premium");
  const plansHref = `/premium?city=${slugify(cityName)}`;
  const [openTab, setOpenTab] = useState<HomeCategoryFilter | null>(null);
  const [menuLeft, setMenuLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpenTab(null));

  // Click navigates (and always closes the dropdown, since clicking is committing to that
  // page) — opening the dropdown is a separate, hover-only interaction below, matching how
  // MegaMenu's own column-1 items already switch via onMouseEnter.
  function onTabClick(tab: HomeCategoryFilter) {
    setOpenTab(null);

    // Already on a browse page: move to the equivalent browse path rather than bouncing back to
    // the homepage. The area is deliberately dropped — switching tab is a reset (it clears every
    // filter param below for the same reason), and /{city}/{area}/{group} is often empty enough
    // to look broken.
    if (currentSegments) {
      const { transactionGroup, category } = segmentsForHomeCategory(tab);
      router.push(buildBrowsePath({ cityName, transactionGroup, category }));
      return;
    }

    const clearedFilters = Object.fromEntries(FILTER_PARAM_KEYS.map((key) => [key, undefined]));
    // Everywhere else (the homepage, and static/account pages carrying a city like /post?city=)
    // the tabs drive the homepage's own filter view. Off the homepage the city may live in the
    // path or a page-level param rather than in `searchParams`, so a bare buildHomeUrl would land
    // on "/" with no ?city= and silently fall back to the default city — carry it across
    // explicitly. On the homepage itself the param (or its deliberate absence) is already in
    // `searchParams`, so it is left untouched rather than pinning the default city into the URL.
    const cityOverride = pathname === "/" ? {} : { city: slugify(cityName) };
    router.push(buildHomeUrl(searchParams, { category: tab, ...clearedFilters, ...cityOverride }));
  }

  // The tab row itself scrolls horizontally on narrow screens (overflow-x-auto), which would
  // clip the mega menu if it lived inside that row — so it's rendered as a sibling instead,
  // positioned under whichever tab is open via this offset (measured at hover time).
  function onTabHover(tab: HomeCategoryFilter, el: HTMLButtonElement) {
    const container = containerRef.current;
    if (container) setMenuLeft(el.getBoundingClientRect().left - container.getBoundingClientRect().left);
    setOpenTab(tab);
  }

  const openTabData = HOME_TABS.find((t) => t.value === openTab);

  return (
    <div ref={containerRef} className="relative" onMouseLeave={() => setOpenTab(null)}>
      <div className="flex gap-1.5 overflow-x-auto">
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === active;
          const highlighted = isActive || openTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabClick(tab.value)}
              onMouseEnter={(e) => onTabHover(tab.value, e.currentTarget)}
              className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold cursor-pointer whitespace-nowrap ${
                isActive ? "bg-surface-alt text-text" : "bg-transparent text-text-soft"
              } ${highlighted ? "border-b-gold" : "border-b-transparent"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              <span className="text-[10px] text-muted">▾</span>
            </button>
          );
        })}
        <Link
          href="/tools"
          className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold whitespace-nowrap ${
            toolsActive ? "bg-surface-alt text-text border-b-gold" : "bg-transparent text-text-soft border-b-transparent"
          }`}
        >
          <span>🧮</span>
          Tools
        </Link>
        <Link
          href={plansHref}
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
