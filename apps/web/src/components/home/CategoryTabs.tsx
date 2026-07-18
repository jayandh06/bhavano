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
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === active;
          return (
            <button
              key={tab.value}
              onClick={() => onTabClick(tab.value)}
              style={{
                background: isActive ? "var(--surface-alt)" : "transparent",
                color: isActive ? "var(--text)" : "var(--text-soft)",
                border: "none",
                borderBottom: `3px solid ${isActive || openTab === tab.value ? "var(--gold)" : "transparent"}`,
                padding: "12px 18px 10px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
              <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
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
