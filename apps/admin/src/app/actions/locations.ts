"use server";

import type { Area, City } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchAreas, fetchCities } from "@/lib/bff";

/** Full city list for the admin edit-listing form's City select. Gated through requireAdmin() for
 * consistency with every other admin action, even though GET /locations/cities itself carries no
 * auth guard. See docs/plans/admin-edit-location-and-category.md. */
export async function fetchCitiesAction(): Promise<City[]> {
  await requireAdmin();
  return fetchCities(undefined, true);
}

/** Full area list for one city, for the admin edit-listing form's Area select — refetched
 * whenever the admin changes the City select. */
export async function fetchAreasForCityAction(cityId: string): Promise<Area[]> {
  await requireAdmin();
  return fetchAreas(cityId, undefined, true);
}
