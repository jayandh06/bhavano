"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
import { useClickOutside } from "@/lib/useClickOutside";
import { useClampToViewport } from "@/lib/useClampToViewport";
import { amenityOptionsFor, assetFiltersFor, type FilterableKey } from "@/lib/assetFilters";
import { customPriceLabel, parseAmount } from "@/lib/priceInput";

/** `price` plus whichever config-derived select filters this asset has. */
type OpenFilter = "price" | "amenities" | FilterableKey | null;

// See the matching comment in AreaFilter.tsx — the filter row is now a surface-alt strip, so
// pill tones shift accordingly (active: green tint, inactive: surface rather than bg).
export const buttonClass = (active: boolean) =>
  `flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer border ${
    active ? "bg-green/10 border-green text-green" : "bg-surface border-border text-text-soft"
  }`;

// `max-w-[calc(100vw-2rem)]` (same idiom MegaMenu.tsx uses for the same problem) is what actually
// keeps this on-screen on a phone — without it, `min-w` is only a floor, and shrink-to-fit sizes
// the box up to its *preferred* width regardless: the price dropdown's own hint sentence
// ("Leave one empty for an open-ended range...") is long enough on one line that the box grew to
// ~394px and ran off the right edge of a 390px viewport, since `left-0` anchors it to the
// trigger's own left edge, not the viewport's.
const dropdownClass =
  "absolute top-[calc(100%+6px)] left-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[200px] max-w-[calc(100vw-2rem)]";

/** Category-aware refinement layer for a browse results page — narrows via query params on top of
 * the clean canonical path (e.g. ?minPrice=..&furnished=..), never changing the path itself. Which
 * select filters appear is derived from the asset (see lib/assetFilters.ts); price is the same two
 * boxes for every category, since a typed amount needs no per-category scale. */
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState<OpenFilter>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(null));
  // Anchored to its own pill, so how far right a panel reaches depends on where the row wrapped
  // that pill — see useClampToViewport.
  const panelRef = useRef<HTMLDivElement>(null);
  useClampToViewport(panelRef, open !== null);

  if (!category) return null;

  function navigate(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(null);
  }

  // The pill names the actual range — "₹20k – ₹2L", "Above ₹20k", "Under ₹45k" — rather than the
  // bracket it happened to match.
  const priceLabel = customPriceLabel(activeMinPrice, activeMaxPrice) ?? "Price";
  // Derived from CATEGORY_FIELD_CONFIG rather than hardcoded — see lib/assetFilters.ts. The
  // previous `category === "house" || category === "apartment"` was wrong in three ways: the
  // config says villa also has furnishing, commercial has furnishing, and PG/furniture/interiors
  // each have a select the BFF already accepts and no UI ever offered.
  const selectFilters = assetFiltersFor(category).filter((filter) => filter.options.length > 0);
  // Per property type, straight from the config — a flat's lift and gym, a PG's attached bathroom
  // and laundry, a plot's nothing at all. See lib/assetFilters.ts.
  const amenityOptions = amenityOptionsFor(category);
  const selectedAmenities = (activeAmenities ?? []).filter((a) => amenityOptions.some((o) => o.value === a));
  const activeValues: Partial<Record<FilterableKey, string | undefined>> = {
    furnished: activeFurnished,
    sharingType: activeSharingType,
    condition: activeCondition,
    serviceType: activeServiceType,
  };

  // No bottom margin here — this sits as one flex item inside BrowseListingsView's shared
  // `flex flex-wrap` filter row alongside AreaFilter/AssetTypeFilter/BhkFilter, not stacked below
  // them. A margin on a flex item still counts toward that row's height even
  // under `items-start`, so the `mb-5` this used to carry (from before it lived in that row)
  // was adding 20px of dead space under the whole filter box on every page where this actually
  // renders a pill — every single-category tab (PG/Furniture/Interiors) and Buy/Rent once a
  // specific property type is chosen — while pages where it renders nothing (Buy/Rent's "All
  // types" state) never showed the gap. The row's own container already carries the spacing to
  // whatever comes after it (BrowseListingsView.tsx's outer `mb-3`).
  return (
    <div ref={containerRef} className="flex gap-2.5 relative">
      <div className="relative">
        <button className={buttonClass(open === "price" || priceLabel !== "Price")} onClick={() => setOpen(open === "price" ? null : "price")}>
          {priceLabel} <span className="text-[10px] text-muted">▾</span>
        </button>
        {open === "price" && (
          <div ref={open === "price" ? panelRef : undefined} className={`${dropdownClass} min-w-[248px]`}>
            {/* "Any", then the two boxes — no pre-baked brackets. They were derived from each
              * category's plausibility bounds, which made them sane but arbitrary: three buckets
              * per category, none of them the range anyone actually wanted, and each one a second
              * way to set the same two numbers. */}
            <DropdownOption
              label="Any price"
              active={activeMinPrice === undefined && activeMaxPrice === undefined}
              onClick={() => navigate({ minPrice: undefined, maxPrice: undefined })}
            />
            <CustomPriceRange
              activeMinPrice={activeMinPrice}
              activeMaxPrice={activeMaxPrice}
              onApply={(minPrice, maxPrice) =>
                navigate({
                  minPrice: minPrice !== undefined ? String(minPrice) : undefined,
                  maxPrice: maxPrice !== undefined ? String(maxPrice) : undefined,
                })
              }
            />
          </div>
        )}
      </div>

      {amenityOptions.length > 0 && (
        <div className="relative">
          <button
            className={buttonClass(open === "amenities" || selectedAmenities.length > 0)}
            onClick={() => setOpen(open === "amenities" ? null : "amenities")}
          >
            {/* A count, not the names: "Lift, Gym, Swimming pool" does not fit a pill, and "2
              * amenities" is what the visitor needs to know at a glance. */}
            {selectedAmenities.length === 0
              ? "Amenities"
              : selectedAmenities.length === 1
                ? (amenityOptions.find((o) => o.value === selectedAmenities[0])?.label ?? "1 amenity")
                : `${selectedAmenities.length} amenities`}{" "}
            <span className="text-[10px] text-muted">▾</span>
          </button>
          {open === "amenities" && (
            <div ref={panelRef} className={`${dropdownClass} min-w-[220px] max-h-[320px] overflow-y-auto`}>
              <DropdownOption
                label="Any"
                active={selectedAmenities.length === 0}
                onClick={() => navigate({ amenities: undefined })}
              />
              {amenityOptions.map((option) => {
                const checked = selectedAmenities.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 px-2.5 py-2 text-[13px] text-text cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        // Ticked boxes are ANDed server-side, so this list only grows and shrinks;
                        // an empty list drops the param rather than sending an empty one.
                        navigate({
                          amenities:
                            (checked
                              ? selectedAmenities.filter((a) => a !== option.value)
                              : [...selectedAmenities, option.value]
                            ).join(",") || undefined,
                        })
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
        const active = activeValues[filter.key];
        const label = filter.options.find((o) => o.value === active)?.label ?? filter.label;
        return (
          <div key={filter.key} className="relative">
            <button
              className={buttonClass(open === filter.key || active !== undefined)}
              onClick={() => setOpen(open === filter.key ? null : filter.key)}
            >
              {label} <span className="text-[10px] text-muted">▾</span>
            </button>
            {open === filter.key && (
              <div ref={open === filter.key ? panelRef : undefined} className={dropdownClass}>
                <DropdownOption
                  label="Any"
                  active={active === undefined}
                  onClick={() => navigate({ [filter.key]: undefined })}
                />
                {filter.options.map((option) => (
                  <DropdownOption
                    key={option.value}
                    label={option.label}
                    active={active === option.value}
                    onClick={() => navigate({ [filter.key]: option.value })}
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

/**
 * The price filter itself: two amount boxes, and that is all.
 *
 * Either bound may be left empty, which is how "above ₹20k" and "under ₹45k" are expressed; both
 * empty clears the filter, exactly like the "Any price" option above it.
 *
 * Bounds are inclusive (`>=` / `<=`), which is what the backend's price filter already does. There
 * is no separate strict-greater mode: at rupee granularity `> 20000` and `>= 20000` differ by a
 * single rupee, and offering both would be two controls for one meaning.
 */
function CustomPriceRange({
  activeMinPrice,
  activeMaxPrice,
  onApply,
}: {
  activeMinPrice?: number;
  activeMaxPrice?: number;
  onApply: (minPrice: number | undefined, maxPrice: number | undefined) => void;
}) {
  const [min, setMin] = useState(activeMinPrice !== undefined ? String(activeMinPrice) : "");
  const [max, setMax] = useState(activeMaxPrice !== undefined ? String(activeMaxPrice) : "");

  const parsedMin = min.trim() ? parseAmount(min) : undefined;
  const parsedMax = max.trim() ? parseAmount(max) : undefined;
  const error =
    (min.trim() && parsedMin === undefined) || (max.trim() && parsedMax === undefined)
      ? "Enter an amount like 20000, 20k or 2L"
      : parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax
        ? "Min must be less than max"
        : undefined;

  function apply() {
    if (error) return;
    onApply(parsedMin, parsedMax);
  }

  return (
    <div className="border-t border-border mt-2 pt-2">
      <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Set a range</div>
      <div className="flex items-center gap-1.5 px-2.5">
        <AmountInput value={min} onChange={setMin} onEnter={apply} placeholder="Min" label="Minimum price" />
        <span className="text-[12px] text-muted">–</span>
        <AmountInput value={max} onChange={setMax} onEnter={apply} placeholder="Max" label="Maximum price" />
      </div>
      {error ? (
        <div className="px-2.5 pt-1.5 text-[11px] text-danger">{error}</div>
      ) : (
        // The accepted shorthand has to be visible, or nobody discovers it — the brackets above are
        // written in the same notation, so this is telling them the box speaks the chips' language.
        <div className="px-2.5 pt-1.5 text-[11px] text-muted">One bound is enough. 20k, 2L, 1.5Cr work too.</div>
      )}
      <button
        onClick={apply}
        disabled={error !== undefined}
        className={`mt-2 mx-2.5 mb-0.5 block w-[calc(100%-20px)] rounded-lg border px-3 py-2 text-[13px] font-semibold ${
          error ? "border-border bg-surface text-muted cursor-not-allowed" : "border-green bg-green/10 text-green cursor-pointer"
        }`}
      >
        Apply
      </button>
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  onEnter,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  placeholder: string;
  label: string;
}) {
  return (
    <input
      // Not type="number": it rejects the "20k"/"2L" shorthand the brackets themselves use, and on
      // Android it offers a keypad with no letters at all. `inputMode` still brings up the numeric
      // pad on iOS for the common case of typing plain digits.
      inputMode="numeric"
      // An input's intrinsic width comes from `size`, which defaults to about 20 characters — two
      // of those side by side made this panel's preferred width wider than a phone screen, so it
      // only fitted by hitting its own max-width cap. Five characters is enough for "1.5Cr", and
      // `flex-1` still stretches them to fill the row.
      size={5}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEnter();
      }}
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
