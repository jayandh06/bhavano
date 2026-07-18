"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { City } from "@bhavano/types";
import { getCityIcon } from "@bhavano/types/cityIcons";
import { autoDetectCityAction, listAllCitiesAction, searchCitiesAction } from "@/app/actions/locations";
import { buildHomeUrl } from "@/lib/homeUrl";

export function LocationPicker({
  currentCityName,
  popularCities,
}: {
  currentCityName: string;
  popularCities: City[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>(popularCities);
  const [allCities, setAllCities] = useState<City[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [detecting, setDetecting] = useState(false);

  function openModal() {
    setQuery("");
    setResults(popularCities);
    setAllCities(null);
    setOpen(true);
  }

  async function onQueryChange(value: string) {
    setQuery(value);
    if (!value) {
      setResults(popularCities);
      return;
    }
    setResults(await searchCitiesAction(value));
  }

  async function onShowMoreCities() {
    setLoadingAll(true);
    setAllCities(await listAllCitiesAction());
    setLoadingAll(false);
  }

  function selectCity(city: City) {
    setOpen(false);
    router.push(buildHomeUrl(searchParams, { city: city.id }));
  }

  function useAutoLocation() {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const city = await autoDetectCityAction(pos.coords.latitude, pos.coords.longitude);
        setDetecting(false);
        if (city) selectCity(city);
      },
      () => setDetecting(false),
    );
  }

  const tierCities = allCities ? { popular: allCities.filter((c) => c.isPopular), more: allCities.filter((c) => !c.isPopular) } : null;

  return (
    <>
      <button
        onClick={openModal}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "10px 14px",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16 }}>📍</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.2 }}>Showing ads near</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
            {currentCityName}
          </div>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--modal-scrim)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              width: 420,
              maxWidth: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: 24,
              animation: "modalIn 0.2s ease both",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 19, color: "var(--text)" }}>
                Choose your location
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <button
              onClick={useAutoLocation}
              disabled={detecting}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "13px 14px",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--green)",
                cursor: "pointer",
                marginBottom: 14,
              }}
            >
              📍 {detecting ? "Detecting…" : "Auto-detect my current location"}
            </button>

            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
              OR SEARCH CITY / AREA / PINCODE
            </div>
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g. Koramangala, Bangalore or 560034"
              style={{
                width: "100%",
                border: "1px solid var(--border)",
                borderRadius: 9,
                padding: "12px 14px",
                fontSize: 14,
                outline: "none",
                marginBottom: 14,
                background: "var(--surface)",
                color: "var(--text)",
              }}
            />

            {query || !tierCities ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {results.map((city) => (
                  <CityRow key={city.id} city={city} onSelect={selectCity} />
                ))}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>POPULAR</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 14 }}>
                  {tierCities.popular.map((city) => (
                    <CityRow key={city.id} city={city} onSelect={selectCity} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>MORE CITIES</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {tierCities.more.map((city) => (
                    <CityRow key={city.id} city={city} onSelect={selectCity} />
                  ))}
                </div>
              </>
            )}

            {!query && !allCities && (
              <button
                onClick={onShowMoreCities}
                disabled={loadingAll}
                style={{
                  marginTop: 8,
                  background: "none",
                  border: "none",
                  color: "var(--green)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "8px 6px",
                }}
              >
                {loadingAll ? "Loading…" : "Show more cities ▾"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CityRow({ city, onSelect }: { city: City; onSelect: (city: City) => void }) {
  return (
    <button
      onClick={() => onSelect(city)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        textAlign: "left",
        background: "none",
        border: "none",
        padding: "10px 6px",
        fontSize: 14,
        color: "var(--text)",
        cursor: "pointer",
        borderRadius: 7,
      }}
    >
      <span>{getCityIcon(city.name)}</span>
      {city.name}
    </button>
  );
}
