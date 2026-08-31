"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { City } from "@bhavano/types";
import { autoDetectCityAction, listAllCitiesAction, searchCitiesAction } from "@/app/actions/locations";
import { buildBrowsePath } from "@/lib/listingPath";
import type { ParsedSegments } from "@/lib/seoRoute";
import { Icon } from "./Icon";

export function LocationPicker({
  currentCityName,
  popularCities,
  currentSegments,
}: {
  /** Undefined means every city — the chip reads "All cities" and the national routes are in
   * play. Distinct from a city that failed to resolve, which never reaches here. */
  currentCityName?: string;
  popularCities: City[];
  /** The current path's parsed city-first segments (transactionGroup/category/facet), when
   * rendered on one of those pages rather than the homepage — lets switching city land on the
   * equivalent page instead of always bouncing to `/`. Locality/listing never carry across a
   * city switch, so only these three are preserved. */
  currentSegments?: ParsedSegments;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>(popularCities);
  const [allCities, setAllCities] = useState<City[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  function openModal() {
    setQuery("");
    setResults(popularCities);
    setAllCities(null);
    setDetectError(null);
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

  /** Clears the city filter, keeping whatever category the user is looking at — /bengaluru/buy
   * becomes /buy rather than dumping them back on the homepage. */
  function selectAllCities() {
    setOpen(false);
    router.push(
      buildBrowsePath({
        transactionGroup: currentSegments?.transactionGroup,
        category: currentSegments?.category,
        facetValue: currentSegments?.facetValue,
      }),
    );
  }

  /** Shared by picking a city from the list (a full `City` on hand) and by auto-detect (Google
   * only ever gives us a name — see `autoDetectCityAction`). Only `.name` is actually load-bearing
   * for navigation, so a full `City` object was never required here. */
  function selectCityByName(cityName: string) {
    setOpen(false);
    if (currentSegments) {
      router.push(
        buildBrowsePath({
          cityName,
          transactionGroup: currentSegments.transactionGroup,
          category: currentSegments.category,
          facetValue: currentSegments.facetValue,
        }),
      );
    } else {
      // From the homepage, go to the city's own route rather than /?city=<slug>. That URL is the
      // one the footer links to and the one crawlers index — the homepage canonicalises every
      // query-string variant back to "/", so /?city=chennai can never rank as a Chennai page.
      // Note this is a destination change as well as a URL one: /chennai renders the browse view
      // ("All Listings in Chennai") rather than the homepage's category-tab view ("Buy in
      // Chennai").
      router.push(buildBrowsePath({ cityName }));
    }
  }

  function selectCity(city: City) {
    selectCityByName(city.name);
  }

  /**
   * The device's real GPS position, reverse-geocoded through Google — never an automatic guess.
   * This only ever runs from this button being clicked; nothing on the page calls it on its own.
   * See docs/plans/remove-automatic-ip-city-detection.md for what used to run automatically
   * instead (a coarse guess from the visitor's IP address, applied before they had done anything)
   * and what this button itself used to do (a plain nearest-city distance calculation with no
   * outside source, prone to picking the wrong city where the two are close together).
   */
  function useAutoLocation() {
    if (!navigator.geolocation) {
      setDetectError("Location isn't available in this browser — try searching instead.");
      return;
    }
    setDetecting(true);
    setDetectError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await autoDetectCityAction(pos.coords.latitude, pos.coords.longitude);
        setDetecting(false);
        if (result) selectCityByName(result.cityName);
        else setDetectError("Couldn't detect your city — try searching instead.");
      },
      () => {
        setDetecting(false);
        setDetectError("Location access was denied — try searching instead.");
      },
    );
  }

  const tierCities = allCities ? { popular: allCities.filter((c) => c.isPopular), more: allCities.filter((c) => !c.isPopular) } : null;

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 bg-surface-alt border border-border rounded-[10px] px-3.5 py-2.5 cursor-pointer shrink-0"
      >
        <Icon name="pin" className="text-base" />
        <div className="text-left">
          <div className="text-[10px] text-muted leading-[1.2]">Showing ads near</div>
          <div className="text-sm font-bold text-text leading-[1.3]">{currentCityName ?? "All cities"}</div>
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
                <Icon name="close" />
              </button>
            </div>

            {/* Above auto-detect on purpose: with listings still thin in most cities, "show me
              * everything" is the more useful answer more often than "narrow me down". */}
            <button
              onClick={selectAllCities}
              className={`w-full flex items-center gap-2.5 border rounded-[10px] px-3.5 py-[13px] text-sm font-bold cursor-pointer mb-2.5 ${
                currentCityName ? "bg-surface-alt border-border text-text" : "bg-surface-alt border-green text-green"
              }`}
            >
              <Icon name="allCities" /> All cities
              {!currentCityName && <span className="ml-auto text-xs">Selected</span>}
            </button>

            <button
              onClick={useAutoLocation}
              disabled={detecting}
              className="w-full flex items-center gap-2.5 bg-surface-alt border border-border rounded-[10px] px-3.5 py-[13px] text-sm font-bold text-green cursor-pointer"
            >
              <Icon name="pin" /> {detecting ? "Detecting…" : "Auto-detect my current location"}
            </button>
            {detectError && <p className="text-[#b3413a] text-[12px] mt-1.5">{detectError}</p>}

            <div className="text-xs text-muted font-bold mt-3.5 mb-2">OR SEARCH CITY / AREA / PINCODE</div>
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g. Koramangala, Bangalore or 560034"
              className="w-full border border-border rounded-[9px] px-3.5 py-3 text-base sm:text-sm outline-none mb-3.5 bg-surface text-text"
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
      {/* One pin for every city, not 47 different emoji.
        *
        * A per-city glyph — a rhino for one, a palm tree for another — cannot survive being
        * outlined in a single colour: the whole point of those was that they were little coloured
        * pictures, and stroked versions of 47 unrelated objects would read as noise in a list
        * where every row means the same kind of thing. The list is of cities; the icon says
        * "city", and the name says which. */}
      <Icon name="pin" className="text-muted" />
      {city.name}
    </button>
  );
}
