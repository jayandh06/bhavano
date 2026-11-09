"use client";

import { useRef, useState } from "react";
import type { ListingCategory } from "@bhavano/types";
import { useClickOutside } from "@/lib/useClickOutside";
import { useClampToViewport } from "@/lib/useClampToViewport";
import { amenityOptionsFor, assetFiltersFor, type FilterableKey } from "@/lib/assetFilters";
import { customPriceLabel, parseAmount } from "@/lib/priceInput";
import { useFilterSection } from "./FilterSection";

/** `price` plus whichever config-derived select filters this asset has. */
type OpenFilter = "price" | "amenities" | FilterableKey | null;

// The filter row is a surface-alt strip, so pill tones: active is a green tint, inactive is surface rather than bg.
export const buttonClass = (active: boolean) =>
  `flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer border ${
    active ? "bg-green/10 border-green text-green" : "bg-surface border-border text-text-soft"
  }`;

// `max-w-[calc(100vw-2rem)]` (same idiom MegaMenu.tsx uses for the same problem) is what actually keeps this on-screen on a phone — without it, `min-w` is only a floor, and
// shrink-to-fit sizes the box up to its *preferred* width regardless: the price dropdown's own hint sentence is long enough on one line that the box grew to ~394px and ran
// off the right edge of a 390px viewport, since `left-0` anchors it to the trigger's own left edge, not the viewport's.
const dropdownClass =
  "absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[200px] max-w-[calc(100vw-2rem)]";

/** Category-aware refinement layer for a browse results page — narrows via query params on top of the clean canonical path (e.g. ?minPrice=..&furnished=..), never changing
 * the path itself. Which select filters appear is derived from the asset (see lib/assetFilters.ts); price is the same two boxes for every category, since a typed amount
 * needs no per-category scale. Every dropdown here only changes the filter section's draft (FilterSection); its Apply searches and its Reset clears. The `active*` props are
 * what the URL says now; a draft, when there is one, shows instead. */
export function BrowseFilterBar({
  category,
  activeMinPrice,
  activeMaxPrice,
  activeFurnished,
  activeSharingType,
  activeCondition,
  activeServiceType,
  activeAmenities,
}: {
  category?: ListingCategory;
  activeMinPrice?: number;
  activeMaxPrice?: number;
  activeFurnished?: string;
  /** PG only. */
  activeSharingType?: string;
  /** Furniture only. */
  activeCondition?: string;
  /** Interiors only. */
  activeServiceType?: string;
  /** Amenity keys currently ticked (`?amenities=lift,gym`). */
  activeAmenities?: string[];
}) {
  const { draft, update } = useFilterSection();
  const [open, setOpen] = useState<OpenFilter>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(null));
  // Anchored to its own pill, so how far right a panel reaches depends on where the row wrapped that pill — see useClampToViewport.
  const panelRef = useRef<HTMLDivElement>(null);
  useClampToViewport(panelRef, open !== null);

  if (!category) return null;

  const query = draft.query ?? {};
  const setQuery = (key: string, value: string | undefined) => update({ query: { ...query, [key]: value } });

  // Price: the two boxes as typed. Untouched, they show what the URL says.
  const price = draft.price ?? {
    min: activeMinPrice !== undefined ? String(activeMinPrice) : "",
    max: activeMaxPrice !== undefined ? String(activeMaxPrice) : "",
  };
  const shownMin = price.min.trim() ? parseAmount(price.min) : undefined;
  const shownMax = price.max.trim() ? parseAmount(price.max) : undefined;
  // The pill names the actual range — "₹20k – ₹2L", "Above ₹20k", "Under ₹45k" — rather than the bracket it happened to match.
  const priceLabel = customPriceLabel(shownMin, shownMax) ?? "Price";

  // Derived from CATEGORY_FIELD_CONFIG rather than hardcoded — see lib/assetFilters.ts.
  const selectFilters = assetFiltersFor(category).filter((filter) => filter.options.length > 0);
  // Per property type, straight from the config — a flat's lift and gym, a PG's attached bathroom and laundry, a plot's nothing at all.
  const amenityOptions = amenityOptionsFor(category);
  const amenityValues = "amenities" in query ? (query.amenities ? query.amenities.split(",") : []) : (activeAmenities ?? []);
  const selectedAmenities = amenityValues.filter((a) => amenityOptions.some((o) => o.value === a));
  const activeValues: Partial<Record<FilterableKey, string | undefined>> = {
    furnished: activeFurnished,
    sharingType: activeSharingType,
    condition: activeCondition,
    serviceType: activeServiceType,
  };
  const valueOf = (key: FilterableKey) => (key in query ? query[key] : activeValues[key]);

  // No bottom margin here — this sits as one flex item inside the shared `flex flex-wrap` filter row alongside AreaFilter/AssetTypeFilter/BhkFilter. A margin on a flex item still
  // counts toward that row's height even under `items-start`; the row's own container already carries the spacing to whatever comes after it.
  return (
    <div
      ref={containerRef}
      className="flex gap-2.5 relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(null);
      }}
    >
      <div className="relative">
        <button className={buttonClass(open === "price" || priceLabel !== "Price")} onClick={() => setOpen(open === "price" ? null : "price")}>
          {priceLabel} <span className="text-[10px] text-muted">▾</span>
        </button>
        {open === "price" && (
          <div ref={panelRef} className={`${dropdownClass} min-w-[248px]`}>
            {/* Two boxes, no pre-baked brackets: either bound may be left empty ("above ₹20k", "under ₹45k"). Bounds are inclusive, which is what the backend's price filter does. */}
            <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Set a range</div>
            <div className="flex items-center gap-1.5 px-2.5">
              <AmountInput value={price.min} onChange={(min) => update({ price: { ...price, min } })} placeholder="Min" label="Minimum price" />
              <span className="text-[12px] text-muted">–</span>
              <AmountInput value={price.max} onChange={(max) => update({ price: { ...price, max } })} placeholder="Max" label="Maximum price" />
            </div>
            {/* The accepted shorthand has to be visible, or nobody discovers it. */}
            <div className="px-2.5 pt-1.5 text-[11px] text-muted">One bound is enough. 20k, 2L, 1.5Cr work too.</div>
            <button
              type="button"
              onClick={() => update({ price: { min: "", max: "" } })}
              disabled={!price.min && !price.max}
              className="mx-2.5 mt-2 cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-bold text-green disabled:cursor-default disabled:opacity-50"
            >
              Any price
            </button>
          </div>
        )}
      </div>

      {amenityOptions.length > 0 && (
        <div className="relative">
          <button className={buttonClass(open === "amenities" || selectedAmenities.length > 0)} onClick={() => setOpen(open === "amenities" ? null : "amenities")}>
            {/* A count, not the names: "Lift, Gym, Swimming pool" does not fit a pill, and "2 amenities" is what the visitor needs to know at a glance. */}
            {selectedAmenities.length === 0
              ? "Amenities"
              : selectedAmenities.length === 1
                ? (amenityOptions.find((o) => o.value === selectedAmenities[0])?.label ?? "1 amenity")
                : `${selectedAmenities.length} amenities`}{" "}
            <span className="text-[10px] text-muted">▾</span>
          </button>
          {open === "amenities" && (
            <div ref={panelRef} className={`${dropdownClass} min-w-[220px] max-h-[320px] overflow-y-auto`}>
              <DropdownOption label="Any" active={selectedAmenities.length === 0} onClick={() => setQuery("amenities", undefined)} />
              {amenityOptions.map((option) => {
                const checked = selectedAmenities.includes(option.value);
                return (
                  <label key={option.value} className="flex items-center gap-2 px-2.5 py-2 text-[13px] text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        // Ticked boxes are ANDed server-side, so this list only grows and shrinks; an empty list drops the param rather than sending an empty one.
                        setQuery(
                          "amenities",
                          (checked ? selectedAmenities.filter((a) => a !== option.value) : [...selectedAmenities, option.value]).join(",") || undefined,
                        )
                      }
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectFilters.map((filter) => {
        const active = valueOf(filter.key);
        const label = filter.options.find((o) => o.value === active)?.label ?? filter.label;
        return (
          <div key={filter.key} className="relative">
            <button className={buttonClass(open === filter.key || active !== undefined)} onClick={() => setOpen(open === filter.key ? null : filter.key)}>
              {label} <span className="text-[10px] text-muted">▾</span>
            </button>
            {open === filter.key && (
              <div ref={panelRef} className={dropdownClass}>
                <DropdownOption
                  label="Any"
                  active={active === undefined}
                  onClick={() => {
                    setQuery(filter.key, undefined);
                    setOpen(null);
                  }}
                />
                {filter.options.map((option) => (
                  <DropdownOption
                    key={option.value}
                    label={option.label}
                    active={active === option.value}
                    onClick={() => {
                      setQuery(filter.key, option.value);
                      setOpen(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <input
      // Not type="number": it rejects the "20k"/"2L" shorthand, and on Android it offers a keypad with no letters at all. `inputMode` still brings up the numeric pad on iOS
      // for the common case of typing plain digits.
      inputMode="numeric"
      // An input's intrinsic width comes from `size`, which defaults to about 20 characters — two of those side by side made this panel wider than a phone screen. Five
      // characters is enough for "1.5Cr", and `flex-1` still stretches them to fill the row.
      size={5}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-2 text-[13px] text-text"
    />
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
