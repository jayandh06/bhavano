import { auth } from "@/auth";
import { fetchCities } from "@/lib/bff";
import { resolveDefaultCity } from "@/lib/defaultCity";
import { sessionHeaderName } from "@/lib/session";
import { Header } from "./Header";

/** Drop-in `Header` for pages that aren't a browse/listing view (account pages, static pages) —
 * resolves the session and popular-cities list itself so callers don't duplicate that fetch.
 * No active category/search context to preserve here, so it falls back to the homepage's own
 * defaults (`buy`, empty search). */
export async function PageHeader({
  cityName: cityNameOverride,
}: {
  /** Pages that *do* have a resolved city in scope (e.g. `/post?city=`) pass it through here —
   * otherwise the "Showing ads near" chip falls back to the generic Bengaluru/first-popular
   * default below regardless of any city context the page actually has. */
  cityName?: string;
} = {}) {
  const [session, allCities] = await Promise.all([auth(), fetchCities(undefined, true)]);
  const popularCities = allCities.filter((c) => c.isPopular);
  // Shared with the homepage: the city this visitor last looked at, else Bengaluru. Without it
  // these pages announced "Showing ads near Bengaluru" to someone who had been browsing Chennai
  // one click earlier.
  const cityName = cityNameOverride ?? (await resolveDefaultCity(allCities))?.name ?? "your city";

  return (
    <Header cityName={cityName} popularCities={popularCities} searchQuery="" activeCategory="buy" userName={sessionHeaderName(session)} />
  );
}
