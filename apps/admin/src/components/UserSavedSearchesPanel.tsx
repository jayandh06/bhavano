"use client";

import { useState } from "react";
import type {
  AdminSavedSearchDto,
  AdminUpdateSavedSearchInput,
  City,
  ListingCategory,
  TransactionType,
} from "@bhavano/types";
import { MAX_BEDROOMS, bedroomLabel } from "@bhavano/types/bedrooms";
import { formatInrWithWords } from "@bhavano/types/priceWords";
import { MAX_REQUIREMENT_AREAS } from "@bhavano/types/requirementQuestions";
import {
  deleteUserSavedSearchAction,
  fetchSavedSearchAreasAction,
  updateUserSavedSearchAction,
} from "@/app/actions/admin";

const CATEGORIES: { value: ListingCategory; label: string }[] = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "pg", label: "PG / Hostel" },
  { value: "storage", label: "Storage" },
  { value: "coworking", label: "Coworking" },
  { value: "commercial", label: "Commercial" },
  { value: "furniture", label: "Furniture" },
  { value: "interiors", label: "Interiors" },
];

const TRANSACTIONS: { value: TransactionType; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "rent", label: "Rent" },
  { value: "lease", label: "Lease" },
];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 7,
  padding: "8px 10px",
  color: "var(--text)",
  background: "var(--surface)",
  fontSize: 13,
};

function searchSummary(search: AdminSavedSearchDto): string {
  return [
    search.category,
    search.transactionType,
    search.cityName,
    search.areaNames.length > 0 ? search.areaNames.join(", ") : search.cityName ? "Any area" : undefined,
    search.minPrice !== undefined ? `min ${formatInrWithWords(search.minPrice)}` : undefined,
    search.maxPrice !== undefined ? `max ${formatInrWithWords(search.maxPrice)}` : undefined,
    search.bedroomOptions.length > 0
      ? search.bedroomOptions.map((bedrooms) => `${bedroomLabel(bedrooms)} BHK`).join(" or ")
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ") || "Any listing";
}

export function UserSavedSearchesPanel({
  userId,
  initialSearches,
  cities,
}: {
  userId: string;
  initialSearches: AdminSavedSearchDto[];
  cities: City[];
}) {
  const searches = initialSearches;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [cityId, setCityId] = useState("");
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedroomOptions, setBedroomOptions] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function beginEdit(search: AdminSavedSearchDto) {
    setError(null);
    setEditingId(search.id);
    setName(search.name);
    setCategory(search.category ?? "");
    setTransactionType(search.transactionType ?? "");
    setCityId(search.cityId ?? "");
    setAreaIds(search.areaIds);
    setMinPrice(search.minPrice?.toString() ?? "");
    setMaxPrice(search.maxPrice?.toString() ?? "");
    setBedroomOptions(search.bedroomOptions);
    setAreas([]);
    if (search.cityId) {
      const result = await fetchSavedSearchAreasAction(search.cityId);
      if (result.success) setAreas(result.areas);
      else setError(result.error);
    }
  }

  async function onCityChange(nextCityId: string) {
    setCityId(nextCityId);
    setAreaIds([]);
    setAreas([]);
    if (!nextCityId) return;
    const result = await fetchSavedSearchAreasAction(nextCityId);
    if (result.success) setAreas(result.areas);
    else setError(result.error);
  }

  function toggleBedroom(bedroom: number) {
    setBedroomOptions((current) =>
      current.includes(bedroom) ? current.filter((item) => item !== bedroom) : [...current, bedroom].sort(),
    );
  }

  async function save(searchId: string) {
    setPending(true);
    setError(null);
    const input: AdminUpdateSavedSearchInput = {
      name: name.trim(),
      category: category ? (category as ListingCategory) : undefined,
      transactionType: transactionType ? (transactionType as TransactionType) : undefined,
      cityId: cityId || undefined,
      areaIds,
      minPrice: minPrice.trim() ? Number(minPrice) : undefined,
      maxPrice: maxPrice.trim() ? Number(maxPrice) : undefined,
      bedroomOptions,
    };
    const result = await updateUserSavedSearchAction(userId, searchId, input);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  async function remove(search: AdminSavedSearchDto) {
    if (!window.confirm(`Soft-delete saved search "${search.name}"? It will stop matching listings but remain visible here.`)) return;
    setPending(true);
    setError(null);
    const result = await deleteUserSavedSearchAction(userId, search.id);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        margin: "22px 0",
        background: "var(--surface)",
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>
        Saved-search subscriptions ({searches.filter((search) => !search.deletedAt).length} active)
      </h2>
      {searches.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>No saved searches for this user.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {searches.map((search) => {
            const isEditing = editingId === search.id;
            const isDeleted = search.deletedAt !== null;
            const unavailableAreaIds = isEditing ? areaIds.filter((id) => !areas.some((area) => area.id === id)) : [];
            return (
              <article
                key={search.id}
                style={{ border: "1px solid var(--border)", borderRadius: 9, padding: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <strong style={{ fontSize: 13.5 }}>{search.name}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 3 }}>{searchSummary(search)}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 5 }}>
                      {search.source} alert · created {new Date(search.createdAt).toLocaleString()}
                      {search.lastNotifiedAt && ` · last match processed ${new Date(search.lastNotifiedAt).toLocaleString()}`}
                      {isDeleted && ` · soft-deleted ${new Date(search.deletedAt!).toLocaleString()}`}
                    </div>
                  </div>
                  <span style={{ color: isDeleted ? "#9b3c36" : "var(--green)", fontSize: 11.5, fontWeight: 700 }}>
                    {isDeleted ? "Deleted" : "Active"}
                  </span>
                </div>

                {!isDeleted && !isEditing && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button type="button" disabled={pending} onClick={() => void beginEdit(search)} style={buttonStyle}>
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void remove(search)}
                      style={{ ...buttonStyle, color: "#a23832" }}
                    >
                      Soft-delete
                    </button>
                  </div>
                )}

                {isEditing && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 14 }}>
                    <label style={labelStyle}>
                      Name
                      <input value={name} onChange={(event) => setName(event.target.value)} style={fieldStyle} />
                    </label>
                    <label style={labelStyle}>
                      Category
                      <select value={category} onChange={(event) => setCategory(event.target.value)} style={fieldStyle}>
                        <option value="">Any category</option>
                        {CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label style={labelStyle}>
                      Transaction
                      <select value={transactionType} onChange={(event) => setTransactionType(event.target.value)} style={fieldStyle}>
                        <option value="">Any transaction</option>
                        {TRANSACTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label style={labelStyle}>
                      City
                      <select value={cityId} onChange={(event) => void onCityChange(event.target.value)} style={fieldStyle}>
                        <option value="">Any city</option>
                        {cityId && !cities.some((city) => city.id === cityId) && (
                          <option value={cityId}>{search.cityName ?? "Unavailable city"}</option>
                        )}
                        {cities.map((city) => <option key={city.id} value={city.id}>{city.name}, {city.state}</option>)}
                      </select>
                    </label>
                    <label style={labelStyle}>
                      Minimum price
                      <input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} style={fieldStyle} />
                    </label>
                    <label style={labelStyle}>
                      Maximum price
                      <input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} style={fieldStyle} />
                    </label>
                    {cityId && (
                      <fieldset style={{ ...labelStyle, gridColumn: "1 / -1", border: "1px solid var(--border)", borderRadius: 7, padding: 9 }}>
                        <legend>Areas (up to 5; none means any area in the city)</legend>
                        {areas.length === 0 ? (
                          unavailableAreaIds.length === 0 && (
                            <span style={{ color: "var(--muted)", fontWeight: 400 }}>No areas available.</span>
                          )
                        ) : (
                          <div style={{ maxHeight: 170, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 5 }}>
                            {areas.map((area) => (
                              <label key={area.id} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                                <input
                                  type="checkbox"
                                  checked={areaIds.includes(area.id)}
                                  disabled={!areaIds.includes(area.id) && areaIds.length >= MAX_REQUIREMENT_AREAS}
                                  onChange={() => setAreaIds((current) => current.includes(area.id)
                                    ? current.filter((id) => id !== area.id)
                                    : [...current, area.id])}
                                />
                                {area.name}
                              </label>
                            ))}
                          </div>
                        )}
                        {unavailableAreaIds.map((id) => (
                          <label key={id} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, marginTop: 5 }}>
                            <input
                              type="checkbox"
                              checked
                              onChange={() => setAreaIds((current) => current.filter((areaId) => areaId !== id))}
                            />
                            Unavailable area ({id}) — remove
                          </label>
                        ))}
                      </fieldset>
                    )}
                    <fieldset style={{ ...labelStyle, gridColumn: "1 / -1", border: "1px solid var(--border)", borderRadius: 7, padding: 9 }}>
                      <legend>Bedrooms</legend>
                      <div style={{ display: "flex", gap: 7 }}>
                        {Array.from({ length: MAX_BEDROOMS }, (_, index) => index + 1).map((bedroom) => (
                          <label key={bedroom} style={{ display: "flex", gap: 4, alignItems: "center", fontWeight: 400 }}>
                            <input type="checkbox" checked={bedroomOptions.includes(bedroom)} onChange={() => toggleBedroom(bedroom)} />
                            {bedroomLabel(bedroom)}
                          </label>
                        ))}
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}>None = any</span>
                      </div>
                    </fieldset>
                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                      <button type="button" disabled={pending} onClick={() => void save(search.id)} style={buttonStyle}>
                        {pending ? "Saving…" : "Save changes"}
                      </button>
                      <button type="button" disabled={pending} onClick={() => setEditingId(null)} style={buttonStyle}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {error && <p role="alert" style={{ color: "#a23832", fontSize: 12.5, margin: "10px 0 0" }}>{error}</p>}
    </section>
  );
}

const buttonStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  borderRadius: 7,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "var(--text)",
  fontSize: 12,
  fontWeight: 700,
};
