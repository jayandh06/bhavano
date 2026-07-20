import type { Area, City } from "@bhavano/types";
import { fetchAreas, fetchCities } from "@/lib/bff";
import { resolveCity } from "@/lib/browseRoute";

export interface PageCityContext {
  city: City | null;
  cityAreas: Area[];
  allCities: City[];
}

/** Resolves the `?city=<slug>` query param carried by the nav links in `HeaderAuthButtons`
 * (Post/Favourites/Messages/Profile/My listings) into everything `PageHeader`/`Footer` need to
 * reflect the currently-selected city — without this, those account/static pages fall back to
 * their own generic defaults (Bengaluru, no footer area links) regardless of what city the user
 * actually had selected on the page they navigated from. */
export async function resolvePageCityContext(citySlug: string | undefined): Promise<PageCityContext> {
  const [allCities, city] = await Promise.all([
    fetchCities(undefined, true),
    citySlug ? resolveCity(citySlug) : Promise.resolve(null),
  ]);
  const cityAreas = city ? await fetchAreas(city.id, undefined, true) : [];
  return { city, cityAreas, allCities };
}
