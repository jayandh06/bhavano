import { auth } from "@/auth";
import { fetchCities } from "@/lib/bff";
import { resolveDefaultCity } from "@/lib/defaultCity";
import { sessionHeaderName } from "@/lib/session";
import { Header } from "./Header";

/** Drop-in `Header` for pages that aren't a browse/listing view (account pages, static pages) —
 * resolves the session and popular-cities list itself so callers don't duplicate that fetch.
 * There is no category context on these pages, which is what the "all" tab means; it used to
 * hardcode "buy", so opening /post from the All tab appeared to switch the user to Buy. */
export async function PageHeader({
  cityName: cityNameOverride,
}: {
  /** Pages that *do* have a resolved city in scope (e.g. `/post?city=`) pass it through here.
   * Without it the chip falls back to whichever city the visitor last chose, and to "All cities"
   * if they have not chosen one. */
  cityName?: string;
} = {}) {
  const [session, allCities] = await Promise.all([auth(), fetchCities(undefined, true)]);
  const popularCities = allCities.filter((c) => c.isPopular);
  // The city this visitor last chose. Undefined all the way through means "All cities", which
  // the header renders as such — better than naming a city they never picked, which is what
  // opening /post from the all-cities view used to do.
  const cityName = cityNameOverride ?? (await resolveDefaultCity(allCities))?.name;

  return (
    <Header cityName={cityName} popularCities={popularCities} searchQuery="" activeCategory="all" userName={sessionHeaderName(session)} />
  );
}
