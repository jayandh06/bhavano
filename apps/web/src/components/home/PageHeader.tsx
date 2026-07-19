import { auth } from "@/auth";
import { fetchCities } from "@/lib/bff";
import { Header } from "./Header";

/** Drop-in `Header` for pages that aren't a browse/listing view (account pages, static pages) —
 * resolves the session and popular-cities list itself so callers don't duplicate that fetch.
 * No active category/search context to preserve here, so it falls back to the homepage's own
 * defaults (`buy`, empty search). */
export async function PageHeader() {
  const [session, allCities] = await Promise.all([auth(), fetchCities(undefined, true)]);
  const popularCities = allCities.filter((c) => c.isPopular);
  const cityName = popularCities.find((c) => c.name === "Bengaluru")?.name ?? popularCities[0]?.name ?? "your city";

  return (
    <Header cityName={cityName} popularCities={popularCities} searchQuery="" activeCategory="buy" userName={session?.user?.name} />
  );
}
