"use client";

import { useState } from "react";
import type { City, ReverseGeocodeResultDto } from "@bhavano/types";
import { labelClass } from "@/lib/formStyles";
import { LocationMapPicker } from "./LocationMapPicker";
import { SelectField } from "./SelectField";

/** A location the owner has chosen on the map, complete enough to save: the pin, the city it falls in
 * and the area (an existing one by id, or a name to create under the city). */
export interface ListingLocationChange {
  lat: number;
  lng: number;
  cityId: string;
  areaId?: string;
  areaName?: string;
}

/** Move a listing on the map. City and area are never typed: they come from where the pin lands, and
 * the listing's page address follows them (the old address redirects). Reports `null` while the pin
 * is untouched or not yet resolved to a city and area, so the caller can hold the Save button. See
 * docs/plans/mandatory-pin-and-owner-location-edit.md. */
export function ListingLocationEditor({
  cityName,
  areaName,
  initialPin,
  cityId,
  cities,
  onChange,
}: {
  cityName: string;
  areaName: string;
  /** The listing's current pin, if it has one. */
  initialPin: { lat: number; lng: number } | null;
  cityId: string;
  cities: City[];
  /** `null` = unchanged (or incomplete, see `moved`). */
  onChange: (change: ListingLocationChange | null, moved: boolean) => void;
}) {
  const [moved, setMoved] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [resolved, setResolved] = useState<{ cityId?: string; cityName?: string; areaId?: string; areaName: string } | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [fallbackCityId, setFallbackCityId] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(initialPin);

  function report(
    nextPin: { lat: number; lng: number } | null,
    r: { cityId?: string; areaId?: string; areaName: string } | null,
    pickedCity: string,
  ) {
    const effectiveCity = r?.cityId ?? pickedCity;
    if (!nextPin || !r || !r.areaName || !effectiveCity) {
      onChange(null, true);
      return;
    }
    onChange(
      {
        lat: nextPin.lat,
        lng: nextPin.lng,
        cityId: effectiveCity,
        ...(r.areaId ? { areaId: r.areaId } : { areaName: r.areaName }),
      },
      true,
    );
  }

  function onPinChange(nextPin: { lat: number; lng: number }, suggestion: ReverseGeocodeResultDto | null) {
    setPin(nextPin);
    setMoved(true);
    if (!suggestion) {
      // The pin has moved but its address is still being looked up.
      setLookingUp(true);
      onChange(null, true);
      return;
    }
    setLookingUp(false);
    const next = {
      cityId: suggestion.cityId,
      cityName: suggestion.cityName,
      areaId: suggestion.areaId,
      areaName: suggestion.resolvedLocality,
    };
    setResolved(next);
    setAlternatives(suggestion.areaAlternatives ?? []);
    if (suggestion.cityId) setFallbackCityId("");
    report(nextPin, next, suggestion.cityId ? "" : fallbackCityId);
  }

  const noCityForPin = moved && !lookingUp && resolved && !resolved.cityId;
  const unreadable = moved && !lookingUp && resolved && !resolved.areaName;
  const shownCity = resolved?.cityId
    ? resolved.cityName ?? cities.find((c) => c.id === resolved.cityId)?.name ?? cityName
    : noCityForPin
      ? cities.find((c) => c.id === fallbackCityId)?.name ?? "Choose the city below"
      : cityName;
  const shownArea = moved && resolved ? resolved.areaName || "Move the pin a little" : areaName;

  return (
    <div className="max-w-[720px]">
      <label className={labelClass}>Location</label>
      <p className="text-xs text-muted mt-0 mb-2">
        Search an address or drag the pin to where the property is. City and area are set from the pin, and the
        listing&apos;s page address updates to match.
      </p>
      <LocationMapPicker
        defaultCenter={
          initialPin ?? cities.find((c) => c.id === cityId) ?? cities[0] ?? { lat: 20.5937, lng: 78.9629 }
        }
        initialPin={initialPin}
        onPinChange={onPinChange}
      />
      <div className="mt-3 flex gap-3">
        <div className="flex-1">
          <div className="text-xs text-muted mb-1">City</div>
          <div className="text-sm text-text font-bold">{shownCity}</div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-muted mb-1">Area</div>
          <div className="text-sm text-text font-bold">{lookingUp ? "Looking up…" : shownArea}</div>
        </div>
      </div>
      {alternatives.length > 0 && moved && (
        <p className="text-xs text-muted mt-1.5 mb-0">
          Not right? Use:{" "}
          {alternatives.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                const next = { cityId: resolved?.cityId, cityName: resolved?.cityName, areaName: name };
                setResolved(next);
                report(pin, next, fallbackCityId);
              }}
              className="mr-2 underline bg-transparent border-0 p-0 cursor-pointer text-xs text-muted"
            >
              {name}
            </button>
          ))}
        </p>
      )}
      {noCityForPin && (
        <div className="mt-3 max-w-[320px]">
          <p className="text-xs text-muted mt-0 mb-1.5">
            This place isn&apos;t inside a city we list. Choose the nearest city.
          </p>
          <SelectField
            value={fallbackCityId}
            onChange={(e) => {
              setFallbackCityId(e.target.value);
              report(pin, resolved, e.target.value);
            }}
          >
            <option value="">Select a city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      {unreadable && (
        <p className="text-xs text-[#b3413a] mt-1.5 mb-0">
          We couldn&apos;t read an area for that spot. Move the pin a little or search the address.
        </p>
      )}
    </div>
  );
}
