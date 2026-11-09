"use client";

import { useRef, useState } from "react";
import { assetsForIntent } from "@/lib/assetFilters";
// From seoRoute, not browseRoute: the latter re-exports these but also pulls in lib/bff, which imports next/headers — a client component cannot reach that module graph.
import { CATEGORY_LABELS } from "@/lib/seoRoute";
import { useClickOutside } from "@/lib/useClickOutside";
import { useClampToViewport } from "@/lib/useClampToViewport";
import { buttonClass } from "./BrowseFilterBar";
import { Icon } from "./Icon";
import { useFilterSection } from "./FilterSection";

/**
 * The asset type under the chosen intent.
 *
 * Renders nothing when the intent has no assets to choose between — PG, Furniture and Interiors *are* the asset, so a dropdown there would either be empty or, as it
 * was before this, offer houses and apartments the page cannot show. The pick only changes the filter section's draft; Apply writes the new path (lib/filterApply.ts).
 *
 * "All types" stays a real, valid, listing-showing state: `/bengaluru` and `/bengaluru/buy` are indexable landing pages Googlebot cannot click its way out of, and at
 * current inventory the mixed grid is often the only non-empty view in a city. See docs/plans/contextual-search-filters.md.
 */
export function AssetTypeFilter() {
  const { base, draft, update } = useFilterSection();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const panelRef = useRef<HTMLDivElement>(null);
  useClampToViewport(panelRef, open);

  const options = assetsForIntent(base.intent);
  if (options.length === 0) return null;

  const asset = draft.asset ? draft.asset.asset : base.category;
  const label = asset ? (CATEGORY_LABELS[asset] ?? "All types") : "All types";

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button onClick={() => setOpen((o) => !o)} className={buttonClass(open || asset !== undefined)}>
        <Icon name="building" /> {label} <Icon name="chevronDown" className="text-muted" />
      </button>
      {open && (
        <div ref={panelRef} className={`${dropdownClass} max-h-[320px] overflow-y-auto`}>
          <Option
            label="All types"
            active={asset === undefined}
            onClick={() => {
              update({ asset: { asset: undefined } });
              setOpen(false);
            }}
          />
          {options.map((category) => (
            <Option
              key={category}
              label={CATEGORY_LABELS[category]}
              active={asset === category}
              onClick={() => {
                update({ asset: { asset: category } });
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Option({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left bg-transparent border-0 cursor-pointer rounded-md px-2.5 py-2 text-[13px] ${active ? "text-green font-bold" : "text-text"}`}
    >
      {label}
    </button>
  );
}

// max-w-[calc(100vw-2rem)] — same fix as BrowseFilterBar's own dropdownClass, see its comment: without a cap, `left-0` anchoring plus an unconstrained shrink-to-fit width let
// this run off the right edge of a phone screen whenever the trigger wasn't flush against the viewport's own left edge.
const dropdownClass =
  "absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[200px] max-w-[calc(100vw-2rem)]";
