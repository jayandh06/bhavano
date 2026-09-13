"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useClickOutside } from "@/lib/useClickOutside";
import { buttonClass, DropdownOption } from "./BrowseFilterBar";

/** "Auto" (default) mixes recently-added listings across categories/facets instead of a flat
 * newest-first feed, and caps how many boosted listings can occupy guaranteed top slots — see
 * docs/plans/homepage-category-mix-and-boost-page-cap.md. Every other option here, "Newest
 * first" included, is an explicit ask for a literal sort, so the mix turns off (boosted listings
 * still sort first, just uncapped, same as before that feature) — "Newest first" then means
 * exactly what it says: posting date, no mixing. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "popular", label: "Most viewed" },
];

/** Sits at the right edge of the filter row, separate from `BrowseFilterBar`'s price/furnishing
 * filters on the left — sorting isn't a narrowing filter, it's how the (already-filtered) results
 * are ordered, so it gets its own labeled control rather than blending into the filter group. */
export function SortDropdown({ activeSort }: { activeSort?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const sortLabel = SORT_OPTIONS.find((s) => s.value === activeSort)?.label ?? "Auto";

  function selectSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "auto") params.delete("sort");
    else params.set("sort", value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 shrink-0">
      <span className="text-[13px] font-semibold text-text-soft whitespace-nowrap">Sort by</span>
      <button className={buttonClass(open || activeSort !== undefined)} onClick={() => setOpen((o) => !o)}>
        {sortLabel} <span className="text-[10px] text-muted">▾</span>
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[200px]">
          {SORT_OPTIONS.map((s) => (
            <DropdownOption
              key={s.value}
              label={s.label}
              active={(activeSort ?? "auto") === s.value}
              onClick={() => selectSort(s.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
