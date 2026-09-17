"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
import { assetSurvivingGroupChange, buildFilterUrl } from "@/lib/filterUrl";
// From seoRoute, not browseRoute: the latter re-exports these but also pulls in lib/bff,
// which imports next/headers — a client component cannot reach that module graph.
import {
  CATEGORY_LABELS,
  categoryGroupsFor,
  PROPERTY_TYPE_VALUES,
  type TransactionGroup,
} from "@/lib/seoRoute";
import { useClickOutside } from "@/lib/useClickOutside";
import { buttonClass } from "./BrowseFilterBar";
import { Icon } from "./Icon";

const GROUP_OPTIONS: { value: TransactionGroup | undefined; label: string }[] = [
  { value: undefined, label: "Any" },
  { value: "buy", label: "Buy" },
  { value: "rent-lease", label: "Rent & Lease" },
];

/** Groups, not the four raw `TransactionType` values. `buy|sell` and `rent|lease` are one
 * browsing intent each, the path grammar speaks groups, and offering "Sell" as a *browse* filter
 * would build URLs that do not exist. */
export function TransactionFilter({
  cityName,
  areaName,
  activeGroup,
  activeAsset,
}: {
  cityName?: string;
  areaName?: string;
  activeGroup?: TransactionGroup;
  activeAsset?: ListingCategory;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const label = GROUP_OPTIONS.find((o) => o.value === activeGroup)?.label ?? "Any";

  function select(group: TransactionGroup | undefined) {
    setOpen(false);
    router.push(
      buildFilterUrl({
        cityName,
        areaName,
        group,
        // Dropped when it doesn't exist in the new group — see assetSurvivingGroupChange.
        asset: assetSurvivingGroupChange(activeAsset, group),
        searchParams,
      }),
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={buttonClass(open || activeGroup !== undefined)}>
        <Icon name="key" /> {label} <Icon name="chevronDown" className="text-muted" />
      </button>
      {open && (
        <div className={dropdownClass}>
          {GROUP_OPTIONS.map((option) => (
            <Option
              key={option.label}
              label={option.label}
              active={activeGroup === option.value}
              onClick={() => select(option.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The asset type — "All types" plus the property categories.
 *
 * Deliberately not a gate. "All types" is a real, valid, listing-showing state, because
 * `/bengaluru` and `/bengaluru/buy` are indexable landing pages that Googlebot cannot click its
 * way out of, and because at current inventory the mixed grid is often the only non-empty view in
 * a city. See docs/plans/contextual-search-filters.md.
 *
 * Which categories are offered depends on the chosen transaction: `categoryGroupsFor` knows that
 * PG is rent-only and plots and interiors are sell-only, so the list never offers a combination
 * that would return nothing by construction.
 */
export function AssetTypeFilter({
  cityName,
  areaName,
  activeGroup,
  activeAsset,
}: {
  cityName?: string;
  areaName?: string;
  activeGroup?: TransactionGroup;
  activeAsset?: ListingCategory;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  // With no transaction chosen the asset has to ride on `?propertyType=`, which only speaks the
  // five property values — so that is all this can honestly offer there.
  const options: ListingCategory[] = activeGroup
    ? (Object.keys(CATEGORY_LABELS) as ListingCategory[]).filter((c) => categoryGroupsFor(c).includes(activeGroup))
    : (PROPERTY_TYPE_VALUES as ListingCategory[]);

  const label = activeAsset ? (CATEGORY_LABELS[activeAsset] ?? "All types") : "All types";

  function select(asset: ListingCategory | undefined) {
    setOpen(false);
    router.push(buildFilterUrl({ cityName, areaName, group: activeGroup, asset, searchParams }));
  }

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={buttonClass(open || activeAsset !== undefined)}>
        <Icon name="building" /> {label} <Icon name="chevronDown" className="text-muted" />
      </button>
      {open && (
        <div className={`${dropdownClass} max-h-[320px] overflow-y-auto`}>
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

const dropdownClass =
  "absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[200px]";
