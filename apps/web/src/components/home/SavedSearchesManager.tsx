"use client";

import { useState } from "react";
import Link from "next/link";
import type { Area, City, ListingCategory, SavedSearchDto, TransactionType } from "@bhavano/types";
import { formatInrWithWords } from "@bhavano/types/priceWords";
import { MAX_BEDROOMS, bedroomLabel } from "@bhavano/types/bedrooms";
import { MAX_REQUIREMENT_AREAS } from "@bhavano/types/requirementQuestions";
import { createSavedSearchAction, deleteSavedSearchAction } from "@/app/actions/saved-searches";
import { listAllAreasAction } from "@/app/actions/locations";
import { pushDataLayerEvent } from "@/lib/gtm";
import { fieldClass, labelClass, outlineButtonClass, primaryButtonClass, secondaryButtonClass } from "@/lib/formStyles";
import { SelectField } from "./SelectField";

const CATEGORY_OPTIONS: { value: ListingCategory; label: string }[] = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "pg", label: "PG / Hostel" },
  { value: "storage", label: "Storage space" },
  { value: "coworking", label: "Coworking" },
  { value: "commercial", label: "Commercial space" },
  { value: "furniture", label: "Furniture" },
  { value: "interiors", label: "Interiors" },
];

const TRANSACTION_TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "rent", label: "Rent" },
  { value: "lease", label: "Lease" },
];

const BEDROOM_COUNTS = Array.from({ length: MAX_BEDROOMS }, (_, i) => i + 1);

export function SavedSearchesManager({
  initial,
  cities,
  freeRemaining,
}: {
  initial: SavedSearchDto[];
  cities: City[];
  /** Free alerts left, only when the *next* one would come from the free quota rather than an
   * active Plus subscription — undefined for a Plus subscriber, who has no count to show. Set by
   * the page's own allowance check (SavedSearchesGate), which already confirmed at least one
   * alert is available before this component ever renders. */
  freeRemaining?: number;
}) {
  const [searches, setSearches] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [cityId, setCityId] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [addingNewArea, setAddingNewArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedroomOptions, setBedroomOptions] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new area (below) is one more slot toward the same cap, so it has to count here too.
  const areaSlotsUsed = areaIds.length + (addingNewArea ? 1 : 0);
  const areaLimitReached = areaSlotsUsed >= MAX_REQUIREMENT_AREAS;

  async function onCityChange(newCityId: string) {
    setCityId(newCityId);
    setAreaIds([]);
    setAddingNewArea(false);
    setNewAreaName("");
    // Prepopulate every existing area for this city — the list below shows them upfront, not just
    // as you type, so there's no need to already know an area's exact name.
    setAreas(newCityId ? await listAllAreasAction(newCityId) : []);
  }

  function toggleArea(id: string) {
    setAreaIds((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id);
      if (areaLimitReached) return prev;
      return [...prev, id];
    });
  }

  async function onCreate() {
    if (!name.trim()) {
      setError("Give this saved search a name.");
      return;
    }
    if (!cityId) {
      setError("Pick a city.");
      return;
    }
    if (addingNewArea && !newAreaName.trim()) {
      setError("Type a name for the new area, or pick an existing one instead.");
      return;
    }
    const min = minPrice.trim() ? Number(minPrice) : undefined;
    const max = maxPrice.trim() ? Number(maxPrice) : undefined;
    if (min === undefined || max === undefined) {
      setError("Set both a minimum and a maximum price.");
      return;
    }
    if (min > max) {
      setError("Minimum price can't be more than the maximum.");
      return;
    }
    setPending(true);
    setError(null);

    const result = await createSavedSearchAction({
      name: name.trim(),
      category: (category || undefined) as ListingCategory | undefined,
      transactionType: (transactionType || undefined) as TransactionType | undefined,
      cityId,
      areaIds,
      areaName: addingNewArea ? newAreaName.trim() : undefined,
      minPrice: min,
      maxPrice: max,
      bedroomOptions,
    });

    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    pushDataLayerEvent("save_search", { category: category || undefined, transactionType: transactionType || undefined });
    // The list itself only updates on next page load (this component doesn't refetch), so a
    // full reload keeps things simple rather than reconstructing the server-computed
    // cityName/areaNames labels client-side.
    window.location.reload();
  }

  async function onDelete(id: string) {
    setSearches((prev) => prev.filter((s) => s.id !== id));
    await deleteSavedSearchAction(id);
  }

  return (
    <div className="flex flex-col gap-4">
      {searches.length === 0 && !showForm && (
        <p className="text-muted text-sm">No saved searches yet — create one and we&apos;ll email/text you the moment a match posts.</p>
      )}

      {freeRemaining !== undefined && (
        <p className="text-[13px] text-muted m-0">
          {freeRemaining} free alert{freeRemaining === 1 ? "" : "s"} left.{" "}
          <Link href="/premium" className="font-bold text-green">
            Get Bhavano Plus
          </Link>{" "}
          for unlimited.
        </p>
      )}

      {searches.map((s) => (
        <div key={s.id} className="flex justify-between items-center border border-border rounded-[10px] p-4">
          <div>
            <div className="font-bold text-sm">{s.name}</div>
            <div className="text-[13px] text-muted mt-1">
              {[
                s.category,
                s.transactionType,
                s.cityName,
                s.areaNames.length > 0 && s.areaNames.join(", "),
                s.minPrice !== undefined && `min ${formatInrWithWords(s.minPrice)}`,
                s.maxPrice !== undefined && `max ${formatInrWithWords(s.maxPrice)}`,
                s.bedroomOptions.length > 0 && s.bedroomOptions.map((n) => `${bedroomLabel(n)} BHK`).join(" or "),
              ]
                .filter(Boolean)
                .join(" · ") || "Any listing"}
            </div>
          </div>
          <button
            onClick={() => onDelete(s.id)}
            className="text-[13px] font-bold text-[#b3413a] bg-transparent border-0 cursor-pointer whitespace-nowrap"
          >
            Remove
          </button>
        </div>
      ))}

      {showForm ? (
        <div className="border border-border rounded-2xl p-5 flex flex-col gap-3.5">
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2BHK in Koramangala"
              className={fieldClass}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Category</label>
              <SelectField value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Any category</option>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Transaction type</label>
              <SelectField value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
                <option value="">Any type</option>
                {TRANSACTION_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
          <div>
            <label className={labelClass}>City *</label>
            <SelectField value={cityId} onChange={(e) => onCityChange(e.target.value)}>
              <option value="" disabled>
                Choose a city
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </div>

          {cityId && areas.length > 0 && (
            <div>
              <label className={labelClass}>
                Areas / localities <span className="font-normal text-muted">(up to {MAX_REQUIREMENT_AREAS}, optional — leave all unchecked for the whole city)</span>
              </label>
              <div className="border border-border rounded-[9px] p-2.5 max-h-[180px] overflow-y-auto flex flex-col gap-1">
                {areas.map((a) => {
                  const checked = areaIds.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className={`flex items-center gap-2 px-1.5 py-1.5 text-sm rounded-md ${
                        !checked && areaLimitReached ? "opacity-40" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && areaLimitReached}
                        onChange={() => toggleArea(a.id)}
                      />
                      {a.name}
                    </label>
                  );
                })}
              </div>
              {!addingNewArea ? (
                <button
                  type="button"
                  onClick={() => setAddingNewArea(true)}
                  disabled={areaLimitReached}
                  className="mt-1.5 bg-transparent border-0 p-0 text-[13px] font-bold text-green cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Add an area not listed here
                </button>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="Type the new area's name"
                    autoFocus
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAddingNewArea(false);
                      setNewAreaName("");
                    }}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {areaLimitReached && (
                <p className="mt-1 text-[12px] text-muted">
                  {MAX_REQUIREMENT_AREAS} areas selected — uncheck one to pick a different one.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Min price (₹) *</label>
              <input type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={fieldClass} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Max price (₹) *</label>
              <input type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Bedrooms (optional)</label>
            <div className="flex gap-1.5 flex-wrap">
              {BEDROOM_COUNTS.map((n) => {
                const active = bedroomOptions.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setBedroomOptions((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
                    }
                    className={`rounded-lg border px-3.5 py-2 text-[13px] font-bold cursor-pointer ${
                      active ? "border-green bg-green/10 text-green" : "border-border bg-surface text-text-soft"
                    }`}
                  >
                    {bedroomLabel(n)} BHK
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-[#b3413a] text-[13px] m-0">{error}</p>}
          <div className="flex gap-2.5">
            <button onClick={() => setShowForm(false)} disabled={pending} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={onCreate} disabled={pending} className={`ml-auto ${primaryButtonClass}`}>
              {pending ? "Saving…" : "Save search"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className={`self-start ${outlineButtonClass}`}>
          + New saved search
        </button>
      )}
    </div>
  );
}
