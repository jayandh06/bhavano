"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Area } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { useClickOutside } from "@/lib/useClickOutside";
import { AREAS_NONE } from "@/lib/areaSelection";
import { buildBrowsePath } from "@/lib/listingPath";
import { buildHomeUrl } from "@/lib/homeUrl";
import type { ParsedSegments } from "@/lib/seoRoute";
import { Icon } from "./Icon";

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
  const [areaQuery, setAreaQuery] = useState("");
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
    : areasParam === AREAS_NONE
      ? new Set()
      : areasParam
        ? new Set(areasParam.split(","))
        : new Set(areas.map((a) => a.id));

  const allSelected = selected.size === areas.length;
  const noneSelected = selected.size === 0;
  const label = noneSelected
    ? "Pick an area"
    : allSelected
    ? "All areas"
    : selected.size === 1
      ? (areas.find((a) => selected.has(a.id))?.name ?? "1 area")
      : `${selected.size} areas`;

  function navigate(nextSelected: Set<string>) {
    // Unchecking everything used to silently re-check the first area — a control that undoes
    // what you just did, and shows a result set you didn't ask for. Zero is now a real state
    // carried as `?areas=none`, and the page answers with "select at least one area to search".
    const nextNoneSelected = nextSelected.size === 0;
    const nextAllSelected = nextSelected.size === areas.length;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("areas");

    if (currentSegments) {
      const { transactionGroup, category, facetValue } = currentSegments;
      if (nextNoneSelected) {
        // The arealess path plus the sentinel — never a single-area path, which would contradict
        // "nothing selected".
        const path = buildBrowsePath({ cityName, transactionGroup, category, facetValue });
        params.set("areas", AREAS_NONE);
        router.push(`${path}?${params.toString()}`);
        return;
      }
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
    router.push(
      buildHomeUrl(searchParams, {
        areas: nextNoneSelected ? AREAS_NONE : nextAllSelected ? undefined : [...nextSelected].join(","),
      }),
    );
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    navigate(next);
  }

  // Prefix match, not "contains": typing "ko" should narrow to Koramangala and Kodihalli, not
  // also surface every name with a "ko" buried in the middle — with a couple of hundred areas in
  // the bigger cities, the front of the name is what someone is actually typing towards.
  // Filtering starts at MIN_AREA_QUERY_LENGTH; below that the full list is shown, so clearing the
  // box always returns everything.
  const trimmedQuery = areaQuery.trim().toLowerCase();
  const filtering = trimmedQuery.length >= MIN_AREA_QUERY_LENGTH;
  const visibleAreas = filtering ? areas.filter((area) => area.name.toLowerCase().startsWith(trimmedQuery)) : areas;

  const active = open || !allSelected;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer border ${
          // Sits on the filter row's own surface-alt strip now, so "inactive" needs to be the
          // lighter surface tone (not bg, which would blend into the strip) to still read as a
          // distinct pill; "active" moves to a green tint rather than surface-alt for the same
          // reason — surface-alt no longer means "selected" once the whole row is that color.
          active ? "bg-green/10 border-green text-green" : "bg-surface border-border text-text-soft"
        }`}
      >
        <Icon name="pin" /> {label} <Icon name="chevronDown" className="text-muted" />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[240px] max-h-[360px] overflow-y-auto">
          {/* Only worth a search box once the list is long enough to be worth searching —
              below that it is one more thing between the visitor and the checkboxes. */}
          {areas.length >= AREA_SEARCH_THRESHOLD && (
            <input
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              placeholder={`Type ${MIN_AREA_QUERY_LENGTH}+ letters to find an area`}
              aria-label="Search areas"
              className="w-full box-border mb-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-[13px] text-text outline-none"
            />
          )}
          {/* Both directions, side by side. "Select all areas" existed on its own, which left
              the empty state reachable only by unchecking every box one at a time — absurd in a
              city with a hundred areas. Both act on every area in the city, not just the ones
              the search box is currently showing, which is why they say "areas" rather than
              "these". */}
          <div className="mb-1.5 flex items-center justify-between gap-3 border-b border-border pb-2">
            <button
              onClick={() => navigate(new Set(areas.map((a) => a.id)))}
              disabled={allSelected}
              className={`bg-transparent border-0 p-0 text-green text-[13px] font-bold ${
                allSelected ? "cursor-default opacity-50" : "cursor-pointer"
              }`}
            >
              Select all areas
            </button>
            <button
              onClick={() => navigate(new Set())}
              disabled={noneSelected}
              className={`bg-transparent border-0 p-0 text-[13px] font-bold ${
                noneSelected ? "cursor-default text-muted opacity-50" : "cursor-pointer text-muted"
              }`}
            >
              Clear all
            </button>
          </div>
          {filtering && visibleAreas.length === 0 && (
            <p className="m-0 px-1 py-2 text-[12.5px] text-muted">No area starts with “{areaQuery.trim()}”.</p>
          )}
          {visibleAreas.map((area) => (
            <label key={area.id} className="flex items-center gap-2 px-1 py-[7px] text-[13px] text-text cursor-pointer">
              <input type="checkbox" checked={selected.has(area.id)} onChange={() => toggle(area.id)} />
              {area.name}
            </label>
          ))}
          {filtering && visibleAreas.length > 0 && (
            <p className="m-0 mt-1 border-t border-border px-1 pt-2 text-[11.5px] text-muted">
              Showing {visibleAreas.length} of {areas.length} — clear the box to see all.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Filtering starts here, matching the threshold used by the admin dashboard's searchable
 * selects and UserPicker, so every type-ahead in the product behaves the same. */
const MIN_AREA_QUERY_LENGTH = 2;

/** Below this many areas the list is scannable and a search box is just clutter. */
const AREA_SEARCH_THRESHOLD = 8;
