"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { City } from "@bhavano/types";
import { getCityIcon } from "@bhavano/types/cityIcons";
import { autoDetectCityAction, listAllCitiesAction, searchCitiesAction } from "@/app/actions/locations";
import { buildHomeUrl } from "@/lib/homeUrl";
import { buildBrowsePath } from "@/lib/listingPath";
import type { ParsedSegments } from "@/lib/seoRoute";

export function LocationPicker({
  currentCityName,
  popularCities,
  currentSegments,
}: {
  currentCityName: string;
  popularCities: City[];
  /** The current path's parsed city-first segments (transactionGroup/category/facet), when
   * rendered on one of those pages rather than the homepage — lets switching city land on the
   * equivalent page instead of always bouncing to `/`. Locality/listing never carry across a
   * city switch, so only these three are preserved. */
  currentSegments?: ParsedSegments;
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
    if (currentSegments) {
      router.push(
        buildBrowsePath({
          cityName: city.name,
          transactionGroup: currentSegments.transactionGroup,
          category: currentSegments.category,
          facetValue: currentSegments.facetValue,
        }),
      );
    } else {
      router.push(buildHomeUrl(searchParams, { city: city.id }));
    }
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
        className="flex items-center gap-2 bg-surface-alt border border-border rounded-[10px] px-3.5 py-2.5 cursor-pointer shrink-0"
      >
        <span className="text-base">📍</span>
        <div className="text-left">
          <div className="text-[10px] text-muted leading-[1.2]">Showing ads near</div>
          <div className="text-sm font-bold text-text leading-[1.3]">{currentCityName}</div>
        </div>
        <span className="text-[11px] text-muted ml-0.5">▾</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-[var(--modal-scrim)] z-[100] flex items-center justify-center p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl w-[420px] max-w-full max-h-[80vh] overflow-y-auto p-6 animate-[modalIn_0.2s_ease_both]"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="font-lora font-bold text-[19px] text-text">Choose your location</div>
              <button onClick={() => setOpen(false)} className="bg-transparent border-0 text-xl cursor-pointer text-muted">
                ✕
              </button>
            </div>

            <button
              onClick={useAutoLocation}
              disabled={detecting}
              className="w-full flex items-center gap-2.5 bg-surface-alt border border-border rounded-[10px] px-3.5 py-[13px] text-sm font-bold text-green cursor-pointer mb-3.5"
            >
              📍 {detecting ? "Detecting…" : "Auto-detect my current location"}
            </button>

            <div className="text-xs text-muted font-bold mb-2">OR SEARCH CITY / AREA / PINCODE</div>
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g. Koramangala, Bangalore or 560034"
              className="w-full border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none mb-3.5 bg-surface text-text"
            />

            {query || !tierCities ? (
              <div className="flex flex-col gap-0.5">
                {results.map((city) => (
                  <CityRow key={city.id} city={city} onSelect={selectCity} />
                ))}
              </div>
            ) : (
              <>
                <div className="text-xs text-muted font-bold mb-1">POPULAR</div>
                <div className="flex flex-col gap-0.5 mb-3.5">
                  {tierCities.popular.map((city) => (
                    <CityRow key={city.id} city={city} onSelect={selectCity} />
                  ))}
                </div>
                <div className="text-xs text-muted font-bold mb-1">MORE CITIES</div>
                <div className="flex flex-col gap-0.5">
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
                className="mt-2 bg-transparent border-0 text-green text-[13px] font-bold cursor-pointer px-1.5 py-2"
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
      className="flex items-center gap-2.5 text-left bg-transparent border-0 px-1.5 py-2.5 text-sm text-text cursor-pointer rounded-[7px]"
    >
      <span>{getCityIcon(city.name)}</span>
      {city.name}
    </button>
  );
}
