"use client";

import { useState } from "react";
import type { Area, City, ListingCategory, SavedSearchDto, TransactionType } from "@bhavano/types";
import { createSavedSearchAction, deleteSavedSearchAction } from "@/app/actions/saved-searches";
import { listAllAreasAction } from "@/app/actions/locations";

const ADD_NEW_AREA_VALUE = "__new__";

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

const fieldClass = "w-full border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none bg-surface text-text";
const labelClass = "text-[13px] font-bold text-text-soft mb-1.5 block";

export function SavedSearchesManager({ initial, cities }: { initial: SavedSearchDto[]; cities: City[] }) {
  const [searches, setSearches] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [cityId, setCityId] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState("");
  const [addingNewArea, setAddingNewArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCityChange(newCityId: string) {
    setCityId(newCityId);
    setAreaId("");
    setAddingNewArea(false);
    setNewAreaName("");
    // Prepopulate every existing area for this city — the dropdown below shows them upfront,
    // not just as you type, so there's no need to already know an area's exact name.
    setAreas(newCityId ? await listAllAreasAction(newCityId) : []);
  }

  function onAreaSelectChange(value: string) {
    if (value === ADD_NEW_AREA_VALUE) {
      setAddingNewArea(true);
      setAreaId("");
    } else {
      setAddingNewArea(false);
      setAreaId(value);
    }
  }

  async function onCreate() {
    if (!name.trim()) {
      setError("Give this saved search a name.");
      return;
    }
    if (addingNewArea && !newAreaName.trim()) {
      setError("Type a name for the new area, or pick an existing one.");
      return;
    }
    setPending(true);
    setError(null);

    const result = await createSavedSearchAction({
      name: name.trim(),
      category: (category || undefined) as ListingCategory | undefined,
      transactionType: (transactionType || undefined) as TransactionType | undefined,
      cityId: cityId || undefined,
      areaId: areaId || undefined,
      areaName: addingNewArea ? newAreaName.trim() : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
    });

    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    // The list itself only updates on next page load (this component doesn't refetch), so a
    // full reload keeps things simple rather than reconstructing the server-computed
    // cityName/areaName labels client-side.
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

      {searches.map((s) => (
        <div key={s.id} className="flex justify-between items-center border border-border rounded-[10px] p-4">
          <div>
            <div className="font-bold text-sm">{s.name}</div>
            <div className="text-[13px] text-muted mt-1">
              {[
                s.category,
                s.transactionType,
                s.cityName,
                s.minPrice !== undefined && `min ₹${s.minPrice}`,
                s.maxPrice !== undefined && `max ₹${s.maxPrice}`,
                s.bedrooms !== undefined && `${s.bedrooms} BHK`,
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
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
                <option value="">Any category</option>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Transaction type</label>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className={fieldClass}>
                <option value="">Any type</option>
                {TRANSACTION_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>City</label>
            <select value={cityId} onChange={(e) => onCityChange(e.target.value)} className={fieldClass}>
              <option value="">Any city</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {cityId && (
            <div>
              <label className={labelClass}>Area / locality</label>
              <select
                value={addingNewArea ? ADD_NEW_AREA_VALUE : areaId}
                onChange={(e) => onAreaSelectChange(e.target.value)}
                className={fieldClass}
              >
                <option value="">Any area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value={ADD_NEW_AREA_VALUE}>+ Add new area…</option>
              </select>
              {addingNewArea && (
                <input
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Type the new area's name"
                  autoFocus
                  className={`${fieldClass} mt-2`}
                />
              )}
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Min price (₹)</label>
              <input type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={fieldClass} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Max price (₹)</label>
              <input type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={fieldClass} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Bedrooms</label>
              <input type="number" min={1} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className={fieldClass} />
            </div>
          </div>
          {error && <p className="text-[#b3413a] text-[13px] m-0">{error}</p>}
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowForm(false)}
              disabled={pending}
              className="bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={onCreate}
              disabled={pending}
              className="ml-auto bg-green text-on-green border-0 rounded-lg px-5 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save search"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="self-start text-[13px] font-bold text-green border-[1.5px] border-green rounded-lg px-4 py-2.5 cursor-pointer bg-transparent"
        >
          + New saved search
        </button>
      )}
    </div>
  );
}
