"use client";

import { useRef, useState } from "react";
import { useClickOutside } from "@/lib/useClickOutside";
import { useClampToViewport } from "@/lib/useClampToViewport";
import { currentAreaIds } from "@/lib/filterApply";
import { Icon } from "./Icon";
import { useFilterSection } from "./FilterSection";

/** First filter on any results page — every area of the city checked by default (= no narrowing); uncheck to restrict to specific localities.
 *
 * Ticks, "Select all areas" and "Clear" only change the filter section's draft: nothing is searched until the section's **Apply** (and **Reset** clears every
 * filter), so several filters, and several areas, change with one search. At least one area must stay picked: Apply stays off while none is, and the section says
 * why. "Clear" empties the list so a new pick can start from nothing; its label shows how many are picked ("Clear (3)"), or "Clear all" when every area is.
 *
 * `?areas=` carries area **ids** (not slugs) — it's a pure filter, never canonical content (the canonical tag always points back at the arealess path), so there's
 * no SEO reason to prefer readable slugs there, and ids round-trip straight into the backend's `areaIds` filter. The single-area *path* case is unrelated and still
 * uses the area's name/slug (see lib/filterApply.ts, which writes the URL). */
export function AreaFilter() {
  const { base, draft, update } = useFilterSection();
  const areas = base.areas;
  const [open, setOpen] = useState(false);
  const [areaQuery, setAreaQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const panelRef = useRef<HTMLDivElement>(null);
  useClampToViewport(panelRef, open);

  if (areas.length <= 1) return null;

  // What the checkboxes and the pill show: the draft if the visitor has changed it, else what the URL says.
  const selected = new Set(draft.areas ?? currentAreaIds(base));
  const allSelected = selected.size === areas.length;
  const noneSelected = selected.size === 0;
  const label = noneSelected
    ? "Pick an area"
    : allSelected
      ? "All areas"
      : selected.size === 1
        ? (areas.find((a) => selected.has(a.id))?.name ?? "1 area")
        : `${selected.size} areas`;

  function setSelection(next: Set<string>) {
    update({ areas: [...next] });
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  }

  // Prefix match, not "contains": typing "ko" should narrow to Koramangala and Kodihalli, not also surface every name with a "ko" buried in the middle — with a
  // couple of hundred areas in the bigger cities, the front of the name is what someone is actually typing towards. Filtering starts at MIN_AREA_QUERY_LENGTH;
  // below that the full list is shown, so clearing the box always returns everything.
  const trimmedQuery = areaQuery.trim().toLowerCase();
  const filtering = trimmedQuery.length >= MIN_AREA_QUERY_LENGTH;
  const visibleAreas = filtering ? areas.filter((area) => area.name.toLowerCase().startsWith(trimmedQuery)) : areas;

  const active = open || !allSelected;

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer border ${
          // Sits on the filter row's own surface-alt strip, so "inactive" is the lighter surface tone and "active" a green tint.
          active ? "bg-green/10 border-green text-green" : "bg-surface border-border text-text-soft"
        }`}
      >
        <Icon name="pin" /> {label} <Icon name="chevronDown" className="text-muted" />
      </button>
      {/* max-w-[calc(100vw-2rem)] (same idiom as the other filter dropdowns and MegaMenu.tsx) — without it, `left-0` anchoring to the trigger's own left edge plus
        * an unconstrained width let this run off the right edge of a phone screen. */}
      {open && (
        <div
          ref={panelRef}
          className="absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[240px] max-w-[calc(100vw-2rem)] max-h-[360px] overflow-y-auto"
        >
          {/* Only worth a search box once the list is long enough to be worth searching — below that it is one more thing between the visitor and the checkboxes. */}
          {areas.length >= AREA_SEARCH_THRESHOLD && (
            <input
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              placeholder={`Type ${MIN_AREA_QUERY_LENGTH}+ letters to find an area`}
              aria-label="Search areas"
              className="w-full box-border mb-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-[13px] text-text outline-none"
            />
          )}
          {/* Both directions, side by side. Both act on every area in the city, not just the ones the search box is currently showing, which is why they say "areas"
            * rather than "these". The count on Clear tells the visitor how many are picked without counting ticks. */}
          <div className="mb-1.5 flex items-center justify-between gap-3 border-b border-border pb-2">
            <button
              onClick={() => setSelection(new Set(areas.map((a) => a.id)))}
              disabled={allSelected}
              className={`bg-transparent border-0 p-0 text-green text-[13px] font-bold ${allSelected ? "cursor-default opacity-50" : "cursor-pointer"}`}
            >
              Select all areas
            </button>
            <button
              onClick={() => setSelection(new Set())}
              disabled={noneSelected}
              className={`bg-transparent border-0 p-0 text-[13px] font-bold ${noneSelected ? "cursor-default text-muted opacity-50" : "cursor-pointer text-muted"}`}
            >
              {allSelected ? "Clear all" : `Clear (${selected.size})`}
            </button>
          </div>
          {noneSelected && <p className="m-0 mb-1 px-1 text-[12px] text-muted">Pick at least one area, then press Apply.</p>}
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

/** Filtering starts here, matching the threshold used by the admin dashboard's searchable selects and UserPicker, so every type-ahead in the product behaves the same. */
const MIN_AREA_QUERY_LENGTH = 2;

/** Below this many areas the list is scannable and a search box is just clutter. */
const AREA_SEARCH_THRESHOLD = 8;
