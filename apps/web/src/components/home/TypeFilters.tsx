"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
import { HOME_TABS, type HomeTabValue } from "@/lib/homeCategories";
import { buildFilterUrl } from "@/lib/filterUrl";
import { assetsForIntent, intentOffersAssets } from "@/lib/assetFilters";
// From seoRoute, not browseRoute: the latter re-exports these but also pulls in lib/bff,
// which imports next/headers — a client component cannot reach that module graph.
import { CATEGORY_LABELS, segmentsForHomeCategory } from "@/lib/seoRoute";
import { useClickOutside } from "@/lib/useClickOutside";
import { useClampToViewport } from "@/lib/useClampToViewport";
import { buttonClass } from "./BrowseFilterBar";
import { Icon } from "./Icon";

/** Where a given (intent, asset) pair lives. The intent supplies the base segments — which for
 * PG/Furniture/Interiors already carry the category — and a chosen asset overrides that category
 * only where the intent actually offers a choice. */
function urlForSelection(params: {
  intent: HomeTabValue;
  asset: ListingCategory | undefined;
  cityName?: string;
  areaName?: string;
  searchParams: URLSearchParams;
}): string {
  const { intent, asset, cityName, areaName, searchParams } = params;
  const base = segmentsForHomeCategory(intent);
  return buildFilterUrl({
    cityName,
    areaName,
    group: base.transactionGroup,
    asset: intentOffersAssets(intent) ? asset : base.category,
    searchParams,
  });
}

/**
 * The transaction filter: this product's real top-level choice — All, Buy, Rent & Lease, PG,
 * Furniture, Interiors — read from `HOME_TABS` so it and the tab row can never disagree about the
 * vocabulary, and resolved from the URL by the caller via `homeCategoryForSegments` so they can
 * never disagree about which one is active.
 */
export function TransactionFilter({
  cityName,
  areaName,
  activeIntent,
  activeAsset,
}: {
  cityName?: string;
  areaName?: string;
  activeIntent: HomeTabValue;
  activeAsset?: ListingCategory;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const panelRef = useRef<HTMLDivElement>(null);
  useClampToViewport(panelRef, open);

  const label = HOME_TABS.find((tab) => tab.value === activeIntent)?.label ?? "All";

  function select(intent: HomeTabValue) {
    setOpen(false);
    router.push(
      urlForSelection({
        intent,
        // Carried over only where it still exists under the new intent: switching Rent & Lease to
        // Buy while holding an asset that is rent-only would otherwise build a path that parses,
        // returns nothing, and looks broken.
        asset: activeAsset && assetsForIntent(intent).includes(activeAsset) ? activeAsset : undefined,
        cityName,
        areaName,
        searchParams,
      }),
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={buttonClass(open || activeIntent !== "all")}>
        <Icon name="key" /> {label} <Icon name="chevronDown" className="text-muted" />
      </button>
      {open && (
        <div ref={panelRef} className={dropdownClass}>
          {HOME_TABS.map((tab) => (
            <Option
              key={tab.value}
              label={tab.label}
              active={activeIntent === tab.value}
              onClick={() => select(tab.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The asset type under the chosen intent.
 *
 * Renders nothing when the intent has no assets to choose between — PG, Furniture and Interiors
 * *are* the asset, so a dropdown there would either be empty or, as it was before this, offer
 * houses and apartments the page cannot show.
 *
 * "All types" stays a real, valid, listing-showing state: `/bengaluru` and `/bengaluru/buy` are
 * indexable landing pages Googlebot cannot click its way out of, and at current inventory the
 * mixed grid is often the only non-empty view in a city. See
 * docs/plans/contextual-search-filters.md.
 */
export function AssetTypeFilter({
  cityName,
  areaName,
  activeIntent,
  activeAsset,
}: {
  cityName?: string;
  areaName?: string;
  activeIntent: HomeTabValue;
  activeAsset?: ListingCategory;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const panelRef = useRef<HTMLDivElement>(null);
  useClampToViewport(panelRef, open);

  const options = assetsForIntent(activeIntent);
  if (options.length === 0) return null;

  const label = activeAsset ? (CATEGORY_LABELS[activeAsset] ?? "All types") : "All types";

  function select(asset: ListingCategory | undefined) {
    setOpen(false);
    router.push(urlForSelection({ intent: activeIntent, asset, cityName, areaName, searchParams }));
  }

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={buttonClass(open || activeAsset !== undefined)}>
        <Icon name="building" /> {label} <Icon name="chevronDown" className="text-muted" />
      </button>
      {open && (
        <div ref={panelRef} className={`${dropdownClass} max-h-[320px] overflow-y-auto`}>
          <Option label="All types" active={activeAsset === undefined} onClick={() => select(undefined)} />
          {options.map((category) => (
            <Option
              key={category}
              label={CATEGORY_LABELS[category]}
              active={activeAsset === category}
              onClick={() => select(category)}
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
      className={`block w-full text-left bg-transparent border-0 cursor-pointer rounded-md px-2.5 py-2 text-[13px] ${
        active ? "text-green font-bold" : "text-text"
      }`}
    >
      {label}
    </button>
  );
}

// max-w-[calc(100vw-2rem)] — same fix as BrowseFilterBar's own dropdownClass, see its comment:
// without a cap, `left-0` anchoring plus an unconstrained shrink-to-fit width let this run off
// the right edge of a phone screen whenever the trigger wasn't flush against the viewport's own
// left edge.
const dropdownClass =
  "absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[200px] max-w-[calc(100vw-2rem)]";
