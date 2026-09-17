"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
import { PRICE_BOUNDS } from "@bhavano/types/priceBounds";
import { useClickOutside } from "@/lib/useClickOutside";
import { formatINR } from "@/lib/seoRoute";
import { assetFiltersFor, type FilterableKey } from "@/lib/assetFilters";

interface PriceBracket {
  label: string;
  minPrice?: number;
  maxPrice?: number;
}

/** Quick-pick price brackets sized off this category's own plausibility bounds
 * (packages/types/src/priceBounds.ts) — a PG's brackets land in the thousands, a house's in
 * lakhs/crores, without hand-tuning either separately. */
function priceBracketsFor(category: ListingCategory, isSale: boolean): PriceBracket[] {
  const bounds = PRICE_BOUNDS[category][isSale ? "sale" : "rental"];
  const low = Math.min(bounds.min * 20, bounds.max);
  const high = Math.min(bounds.min * 200, bounds.max);
  return [
    { label: `Under ${formatINR(low)}`, maxPrice: low },
    { label: `${formatINR(low)} – ${formatINR(high)}`, minPrice: low, maxPrice: high },
    { label: `${formatINR(high)}+`, minPrice: high },
  ];
}

/** `price` plus whichever config-derived select filters this asset has. */
type OpenFilter = "price" | FilterableKey | null;

// See the matching comment in AreaFilter.tsx — the filter row is now a surface-alt strip, so
// pill tones shift accordingly (active: green tint, inactive: surface rather than bg).
export const buttonClass = (active: boolean) =>
  `flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer border ${
    active ? "bg-green/10 border-green text-green" : "bg-surface border-border text-text-soft"
  }`;

const dropdownClass =
  "absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[200px]";

/** Category-aware refinement layer for a browse results page — narrows via query params on
 * top of the clean canonical path (e.g. ?minPrice=..&furnished=..), never changing the path
 * itself. `furnished` only renders for house/apartment; price brackets are sized per category. */
export function BrowseFilterBar({
  category,
  isSale,
  activeMinPrice,
  activeMaxPrice,
  activeFurnished,
  activeSharingType,
  activeCondition,
  activeServiceType,
}: {
  category?: ListingCategory;
  isSale: boolean;
  activeMinPrice?: number;
  activeMaxPrice?: number;
  activeFurnished?: string;
  /** PG only. */
  activeSharingType?: string;
  /** Furniture only. */
  activeCondition?: string;
  /** Interiors only. */
  activeServiceType?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState<OpenFilter>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(null));

  if (!category) return null;

  function navigate(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(null);
  }

  function selectBracket(bracket: PriceBracket) {
    navigate({
      minPrice: bracket.minPrice !== undefined ? String(bracket.minPrice) : undefined,
      maxPrice: bracket.maxPrice !== undefined ? String(bracket.maxPrice) : undefined,
    });
  }

  const brackets = priceBracketsFor(category, isSale);
  const priceLabel =
    activeMinPrice !== undefined || activeMaxPrice !== undefined
      ? brackets.find((b) => b.minPrice === activeMinPrice && b.maxPrice === activeMaxPrice)?.label ?? "Price"
      : "Price";
  // Derived from CATEGORY_FIELD_CONFIG rather than hardcoded — see lib/assetFilters.ts. The
  // previous `category === "house" || category === "apartment"` was wrong in three ways: the
  // config says villa also has furnishing, commercial has furnishing, and PG/furniture/interiors
  // each have a select the BFF already accepts and no UI ever offered.
  const selectFilters = assetFiltersFor(category).filter((filter) => filter.options.length > 0);
  const activeValues: Partial<Record<FilterableKey, string | undefined>> = {
    furnished: activeFurnished,
    sharingType: activeSharingType,
    condition: activeCondition,
    serviceType: activeServiceType,
  };

  return (
    <div ref={containerRef} className="flex gap-2.5 mb-5 relative">
      <div className="relative">
        <button className={buttonClass(open === "price" || priceLabel !== "Price")} onClick={() => setOpen(open === "price" ? null : "price")}>
          {priceLabel} <span className="text-[10px] text-muted">▾</span>
        </button>
        {open === "price" && (
          <div className={dropdownClass}>
            <DropdownOption label="Any" active={activeMinPrice === undefined && activeMaxPrice === undefined} onClick={() => selectBracket({ label: "Any" })} />
            {brackets.map((b) => (
              <DropdownOption key={b.label} label={b.label} active={priceLabel === b.label} onClick={() => selectBracket(b)} />
            ))}
          </div>
        )}
      </div>

      {selectFilters.map((filter) => {
        const active = activeValues[filter.key];
        const label = filter.options.find((o) => o.value === active)?.label ?? filter.label;
        return (
          <div key={filter.key} className="relative">
            <button
              className={buttonClass(open === filter.key || active !== undefined)}
              onClick={() => setOpen(open === filter.key ? null : filter.key)}
            >
              {label} <span className="text-[10px] text-muted">▾</span>
            </button>
            {open === filter.key && (
              <div className={dropdownClass}>
                <DropdownOption
                  label="Any"
                  active={active === undefined}
                  onClick={() => navigate({ [filter.key]: undefined })}
                />
                {filter.options.map((option) => (
                  <DropdownOption
                    key={option.value}
                    label={option.label}
                    active={active === option.value}
                    onClick={() => navigate({ [filter.key]: option.value })}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DropdownOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left border-0 rounded-md px-2.5 py-2 text-[13px] cursor-pointer ${
        active ? "bg-surface-alt text-green font-bold" : "bg-transparent text-text font-medium"
      }`}
    >
      {label}
    </button>
  );
}
