"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
import { MAX_BEDROOMS, bedroomLabel, type ParsedSegments } from "@/lib/seoRoute";
import { buildBrowsePath } from "@/lib/listingPath";
import { useClickOutside } from "@/lib/useClickOutside";

const BEDROOM_COUNTS = Array.from({ length: MAX_BEDROOMS }, (_, i) => i + 1);

/** Multi-select BHK filter for house/apartment browse pages — same shape as `AreaFilter` (every
 * bucket checked by default = no narrowing, navigates immediately on each toggle), but for
 * bedroom-count buckets instead of areas.
 *
 * Picking exactly one bucket collapses onto the *same* clean canonical single-facet path
 * (`/{city}/{group}/{category}/{Nbhk}`) the mega-menu's own single-BHK links already produce —
 * this control is just a richer way to reach (or combine) those same buckets, not a second
 * parallel filter. Picking 2-4 buckets stays on the category-root path with `?bedrooms=1,3,5`
 * layered on top, mirroring how `AreaFilter` layers `?areas=` on top of its own canonical path. */
export function BhkFilter({
  cityName,
  category,
  currentSegments,
}: {
  cityName: string;
  category: ListingCategory;
  currentSegments: ParsedSegments;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const bedroomsParam = searchParams.get("bedrooms");

  // Selection state is derived straight from the URL (query param, then path facet, else "all") —
  // no local staging, same reasoning as `AreaFilter`.
  const selected: Set<number> = bedroomsParam
    ? new Set(bedroomsParam.split(",").map(Number).filter(Boolean))
    : typeof currentSegments.facetValue === "number"
      ? new Set([currentSegments.facetValue])
      : new Set(BEDROOM_COUNTS);

  const allSelected = selected.size === BEDROOM_COUNTS.length;
  const label = allSelected
    ? "All BHK"
    : selected.size === 1
      ? `${bedroomLabel([...selected][0])} BHK`
      : `${selected.size} BHK`;

  function navigate(nextSelected: Set<number>) {
    // Unchecking every box would mean "match nothing" — instead of blocking the click, fall back
    // to the first bucket (1 BHK), same as `AreaFilter`; "Select all" is one click away regardless.
    if (nextSelected.size === 0) nextSelected = new Set([BEDROOM_COUNTS[0]]);
    const nextAllSelected = nextSelected.size === BEDROOM_COUNTS.length;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("bedrooms");

    const { transactionGroup } = currentSegments;

    if (nextAllSelected) {
      const path = buildBrowsePath({ cityName, transactionGroup, category });
      const qs = params.toString();
      router.push(qs ? `${path}?${qs}` : path);
      return;
    }
    if (nextSelected.size === 1) {
      const onlyValue = [...nextSelected][0];
      const path = buildBrowsePath({ cityName, transactionGroup, category, facetValue: onlyValue });
      const qs = params.toString();
      router.push(qs ? `${path}?${qs}` : path);
      return;
    }
    const path = buildBrowsePath({ cityName, transactionGroup, category });
    params.set("bedrooms", [...nextSelected].join(","));
    router.push(`${path}?${params.toString()}`);
  }

  function toggle(n: number) {
    const next = new Set(selected);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    navigate(next);
  }

  const active = open || !allSelected;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer border ${
          active ? "bg-surface-alt border-green text-green" : "bg-bg border-border text-text-soft"
        }`}
      >
        🛏 {label} <span className="text-[10px] text-muted">▾</span>
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[160px]">
          <button
            onClick={() => navigate(new Set(BEDROOM_COUNTS))}
            disabled={allSelected}
            className={`block w-full text-left bg-transparent border-0 border-b border-border mb-1.5 pb-2 text-green text-[13px] font-bold ${
              allSelected ? "cursor-default opacity-50" : "cursor-pointer"
            }`}
          >
            Select all
          </button>
          {BEDROOM_COUNTS.map((n) => (
            <label key={n} className="flex items-center gap-2 px-1 py-[7px] text-[13px] text-text cursor-pointer">
              <input type="checkbox" checked={selected.has(n)} onChange={() => toggle(n)} />
              {bedroomLabel(n)} BHK
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
