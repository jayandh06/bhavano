"use server";

import type { Area, City, ReverseGeocodeResultDto } from "@bhavano/types";
import { fetchAreas, fetchCities, reverseGeocodeGoogle } from "@/lib/bff";

export async function searchCitiesAction(q: string): Promise<City[]> {
  return fetchCities(q);
}

export async function listAllCitiesAction(): Promise<City[]> {
  return fetchCities(undefined, true);
}

/** "Auto-detect my current location" in the homepage's city picker — the device's GPS coordinates,
 * reverse-geocoded through Google the same way the posting flow's map pin-picker already does.
 * `null` means Google returned no usable locality (e.g. the coordinates fall over open water or
 * outside any city we can resolve/create) — the caller falls back to asking the visitor to search
 * instead of guessing. See docs/plans/remove-automatic-ip-city-detection.md for what this
 * replaced: a plain nearest-city distance calc, and an automatic IP-based guess run without the
 * visitor asking for it. */
export async function autoDetectCityAction(
  lat: number,
  lng: number,
): Promise<{ cityId: string; cityName: string } | null> {
  try {
    const result = await reverseGeocodeGoogle(lat, lng);
    // Always present or always absent together — reverseGeocodeGoogle only ever sets cityName
    // once it has resolved (or created) the City row cityId points at.
    return result.cityId && result.cityName
      ? { cityId: result.cityId, cityName: result.cityName }
      : null;
  } catch {
    // GOOGLE_MAPS_SERVER_KEY missing, Google's API unreachable, or any other failure — callers
    // fall back to "couldn't detect your city, try searching" rather than an error.
    return null;
  }
}

export async function searchAreasAction(cityId: string, q: string): Promise<Area[]> {
  return fetchAreas(cityId, q);
}

export async function listAllAreasAction(cityId: string): Promise<Area[]> {
  return fetchAreas(cityId, undefined, true);
}

/** Called on marker drop/drag-end in the posting flow's map pin-picker — a suggestion the
 * wizard pre-fills City/Area with, never an auto-locked value. */
export async function reverseGeocodeAction(lat: number, lng: number): Promise<ReverseGeocodeResultDto> {
  return reverseGeocodeGoogle(lat, lng);
}
