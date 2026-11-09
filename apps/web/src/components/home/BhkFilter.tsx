"use client";

import { useRef, useState } from "react";
import { bedroomLabel } from "@/lib/seoRoute";
import { BEDROOM_COUNTS, currentBhk } from "@/lib/filterApply";
import { useClickOutside } from "@/lib/useClickOutside";
import { useClampToViewport } from "@/lib/useClampToViewport";
import { Icon } from "./Icon";
import { useFilterSection } from "./FilterSection";

/** Multi-select BHK filter for house/apartment/villa pages — same shape as `AreaFilter` (every bucket checked by default = no narrowing), for bedroom-count
 * buckets instead of areas. Ticks only change the filter section's draft; the section's Apply searches (see FilterSection), and at least one bucket must stay picked.
 *
 * Picking exactly one bucket becomes the *same* clean canonical single-facet path (`/{city}/{group}/{category}/{Nbhk}`) the mega-menu's own single-BHK links
 * already produce; several buckets stay on the category-root path with `?bedrooms=1,3,5`. On the homepage, which has no browse path, every choice is `?bedrooms=`.
 * Both grammars are written by lib/filterApply.ts. */
export function BhkFilter() {
  const { base, draft, update } = useFilterSection();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const panelRef = useRef<HTMLDivElement>(null);
  useClampToViewport(panelRef, open);

  const selected = new Set(draft.bhk ?? currentBhk(base));
  const allSelected = selected.size === BEDROOM_COUNTS.length;
  // "3 BHK" for three *selected buckets* was indistinguishable from "3 BHK" the bedroom count — picking 2 and 3 read as "2 BHK". A count of selections has to say that it is one.
  const label = allSelected ? "All BHK" : selected.size === 0 ? "Pick a BHK" : selected.size === 1 ? `${bedroomLabel([...selected][0])} BHK` : `${selected.size} selected`;

  function toggle(n: number) {
    const next = new Set(selected);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    update({ bhk: [...next].sort((a, b) => a - b) });
  }

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
          active ? "bg-green/10 border-green text-green" : "bg-surface border-border text-text-soft"
        }`}
      >
        <Icon name="bed" /> {label} <Icon name="chevronDown" className="text-muted" />
      </button>
      {open && (
        // max-w-[calc(100vw-2rem)] — same fix as the other filter dropdowns; without it this can run off the right edge of a phone screen.
        <div
          ref={panelRef}
          className="absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[160px] max-w-[calc(100vw-2rem)]"
        >
          <button
            onClick={() => update({ bhk: [...BEDROOM_COUNTS] })}
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
