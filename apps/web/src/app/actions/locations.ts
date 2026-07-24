"use server";

import type { Area, City, ReverseGeocodeResultDto } from "@bhavano/types";
import { fetchAreas, fetchCities, reverseGeocode, reverseGeocodeGoogle } from "@/lib/bff";

export async function searchCitiesAction(q: string): Promise<City[]> {
  return fetchCities(q);
}

export async function listAllCitiesAction(): Promise<City[]> {
  return fetchCities(undefined, true);
}

export async function autoDetectCityAction(lat: number, lng: number): Promise<City | null> {
  return reverseGeocode(lat, lng);
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
