import { cookies } from "next/headers";
import type { City } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";

/** Written by `middleware.ts` from whichever city the visitor last looked at — see the comment
 * there for why the capture lives in middleware rather than in a page. Holds the slug, never the
 * id: a cuid is invalidated by a reseed, and this cookie outlives one. */
export const CITY_COOKIE = "bhavano_city";

/** The city to show when the URL itself does not name one — the homepage with no `?city=`, and
 * every account/static page that has no city in scope.
 *
 * Previously this was the literal "Bengaluru" in two places, so a visitor in Chennai saw a
 * screen of Bengaluru listings on every visit, however many times they had switched. The cookie
 * makes that choice stick. See docs/plans/visitor-location-default-city.md; IP-based detection
 * for a first-ever visit is step 2 of that plan and is not implemented here.
 *
 * The cookie is user-controllable input and outlives any given seed, so it is resolved against
 * the real city list rather than trusted — a slug for a city that has been renamed or removed
 * falls through to the default instead of resolving to nothing. */
export async function resolveDefaultCity(allCities: City[]): Promise<City | undefined> {
  const slug = (await cookies()).get(CITY_COOKIE)?.value;
  const remembered = slug ? allCities.find((c) => slugify(c.name) === slug) : undefined;
  if (remembered) return remembered;

  const popular = allCities.filter((c) => c.isPopular);
  return popular.find((c) => c.name === "Bengaluru") ?? popular[0];
}
