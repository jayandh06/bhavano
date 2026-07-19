"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Area } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { useClickOutside } from "@/lib/useClickOutside";
import { buildBrowsePath } from "@/lib/listingPath";
import { buildHomeUrl } from "@/lib/homeUrl";
import type { ParsedSegments } from "@/lib/seoRoute";

/** First filter on any results page — every area of the city checked by default (= no
 * narrowing); uncheck to restrict to specific localities. Navigates immediately on each toggle
 * (matching `BrowseFilterBar`'s click-to-navigate pattern) rather than staging a batch of
 * changes behind an "Apply" button — simpler, and area counts per city are small enough (a
 * couple dozen at most) that per-click navigation stays snappy.
 *
 * `?areas=` carries area **ids** (not slugs) — it's a pure filter, never canonical content (the
 * canonical tag always points back at the arealess path), so there's no SEO reason to prefer
 * readable slugs there, and using ids means this never needs its own slug↔id resolution step —
 * the same id round-trips straight into the backend's `areaIds` filter. The single-area *path*
 * case is unrelated and still uses the area's name/slug, same as always. */
export function AreaFilter({
  cityName,
  areas,
  currentSegments,
}: {
  cityName: string;
  areas: Area[];
  /** Present on the `/{city}/...` browse pages, where a single selected area becomes a clean
   * path (`buildBrowsePath`) — omitted on the homepage, which has no path-based area, so every
   * selection there is `?areas=`. */
  currentSegments?: ParsedSegments;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  if (areas.length <= 1) return null;

  const areasParam = searchParams.get("areas");
  // The single-area *path* only carries a slug (it's a URL segment) — resolve it back to the
  // matching area's id so "selected" can be one consistent id-based set regardless of source.
  const pathAreaId = currentSegments?.areaSlug
    ? areas.find((a) => slugify(a.name) === currentSegments.areaSlug)?.id
    : undefined;

  // Selection state is derived straight from the URL (path area, then `?areas=`, else "all") —
  // no local staging, so it can never drift out of sync with what's actually being shown.
  const selected: Set<string> = pathAreaId
    ? new Set([pathAreaId])
    : areasParam
      ? new Set(areasParam.split(","))
      : new Set(areas.map((a) => a.id));

  const allSelected = selected.size === areas.length;
  const label = allSelected
    ? "All areas"
    : selected.size === 1
      ? (areas.find((a) => selected.has(a.id))?.name ?? "1 area")
      : `${selected.size} areas`;

  function navigate(nextSelected: Set<string>) {
    // Unchecking every box would mean "match nothing" — instead of blocking the click, fall back
    // to the first area rather than leaving the previous selection in place, so the control
    // always lands somewhere concrete; "Select all" is one click away regardless.
    if (nextSelected.size === 0) nextSelected = new Set([areas[0].id]);
    const nextAllSelected = nextSelected.size === areas.length;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("areas");

    if (currentSegments) {
      const { transactionGroup, category, facetValue } = currentSegments;
      if (nextAllSelected) {
        const path = buildBrowsePath({ cityName, transactionGroup, category, facetValue });
        const qs = params.toString();
        router.push(qs ? `${path}?${qs}` : path);
        return;
      }
      if (nextSelected.size === 1) {
        const onlyId = [...nextSelected][0];
        const areaName = areas.find((a) => a.id === onlyId)?.name;
        const path = buildBrowsePath({ cityName, transactionGroup, category, facetValue, areaName });
        const qs = params.toString();
        router.push(qs ? `${path}?${qs}` : path);
        return;
      }
      const path = buildBrowsePath({ cityName, transactionGroup, category, facetValue });
      params.set("areas", [...nextSelected].join(","));
      router.push(`${path}?${params.toString()}`);
      return;
    }

    // Homepage — always query-based, whatever the count.
    router.push(buildHomeUrl(searchParams, { areas: nextAllSelected ? undefined : [...nextSelected].join(",") }));
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
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
        📍 {label} <span className="text-[10px] text-muted">▾</span>
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[220px] max-h-[320px] overflow-y-auto">
          <button
            onClick={() => navigate(new Set(areas.map((a) => a.id)))}
            disabled={allSelected}
            className={`block w-full text-left bg-transparent border-0 border-b border-border mb-1.5 pb-2 text-green text-[13px] font-bold ${
              allSelected ? "cursor-default opacity-50" : "cursor-pointer"
            }`}
          >
            Select all
          </button>
          {areas.map((area) => (
            <label key={area.id} className="flex items-center gap-2 px-1 py-[7px] text-[13px] text-text cursor-pointer">
              <input type="checkbox" checked={selected.has(area.id)} onChange={() => toggle(area.id)} />
              {area.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
