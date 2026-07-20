"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
import { PRICE_BOUNDS } from "@bhavano/types/priceBounds";
import { useClickOutside } from "@/lib/useClickOutside";
import { formatINR } from "@/lib/seoRoute";

const FURNISHING_OPTIONS: { value: string; label: string }[] = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi", label: "Semi-furnished" },
  { value: "furnished", label: "Furnished" },
];

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

type OpenFilter = "price" | "furnished" | null;

export const buttonClass = (active: boolean) =>
  `flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer border ${
    active ? "bg-surface-alt border-green text-green" : "bg-bg border-border text-text-soft"
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
}: {
  category?: ListingCategory;
  isSale: boolean;
  activeMinPrice?: number;
  activeMaxPrice?: number;
  activeFurnished?: string;
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
  const furnishingLabel = FURNISHING_OPTIONS.find((f) => f.value === activeFurnished)?.label ?? "Furnishing";
  const showFurnished = category === "house" || category === "apartment";

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

      {showFurnished && (
        <div className="relative">
          <button className={buttonClass(open === "furnished" || activeFurnished !== undefined)} onClick={() => setOpen(open === "furnished" ? null : "furnished")}>
            {furnishingLabel} <span className="text-[10px] text-muted">▾</span>
          </button>
          {open === "furnished" && (
            <div className={dropdownClass}>
              <DropdownOption label="Any" active={activeFurnished === undefined} onClick={() => navigate({ furnished: undefined })} />
              {FURNISHING_OPTIONS.map((f) => (
                <DropdownOption key={f.value} label={f.label} active={activeFurnished === f.value} onClick={() => navigate({ furnished: f.value })} />
              ))}
            </div>
          )}
        </div>
      )}
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
