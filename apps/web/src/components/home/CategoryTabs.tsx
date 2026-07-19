"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { HomeCategoryFilter } from "@bhavano/types";
import { buildHomeUrl } from "@/lib/homeUrl";
import { HOME_TABS } from "@/lib/homeCategories";
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

export function CategoryTabs({ active, cityName }: { active: HomeCategoryFilter; cityName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openTab, setOpenTab] = useState<HomeCategoryFilter | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpenTab(null));

  function onTabClick(tab: HomeCategoryFilter) {
    const clearedFilters = Object.fromEntries(FILTER_PARAM_KEYS.map((key) => [key, undefined]));
    router.push(buildHomeUrl(searchParams, { category: tab, ...clearedFilters }));
    setOpenTab((prev) => (prev === tab ? null : tab));
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-1.5 overflow-x-auto">
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === active;
          const highlighted = isActive || openTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabClick(tab.value)}
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
      </div>

      {openTab && (
        <MegaMenu tab={HOME_TABS.find((t) => t.value === openTab)!} cityName={cityName} onNavigate={() => setOpenTab(null)} />
      )}
    </div>
  );
}
