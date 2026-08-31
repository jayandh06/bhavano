import { cookies } from "next/headers";
import type { City } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";

/** Written by `middleware.ts` from whichever city the visitor last looked at — see the comment
 * there for why the capture lives in middleware rather than in a page. Holds the slug, never the
 * id: a cuid is invalidated by a reseed, and this cookie outlives one. */
export const CITY_COOKIE = "bhavano_city";

/** The city to show when the URL itself does not name one — the homepage with no `?city=`, and
 * every account/static page that has no city in scope. In order:
 *
 *   1. the `bhavano_city` cookie — a city this visitor actually chose (including via
 *      "Auto-detect my current location", which writes the same cookie by navigating there)
 *   2. undefined — "all cities", which is a real state and not a guess. See the closing comment.
 *
 * Previously this was the literal "Bengaluru" in two places, so a visitor in Chennai saw a screen
 * of Bengaluru listings however many times they had switched. See
 * docs/plans/visitor-location-default-city.md.
 *
 * There used to be a step 2 here — a coarse guess from the visitor's IP via a local MaxMind
 * database, applied automatically before the visitor had done anything. It was wrong often enough
 * (Indian mobile carriers route large regions through a handful of peering cities) that it was
 * removed in favour of asking: "Auto-detect my current location" now uses the device's actual GPS
 * position, reverse-geocoded through Google, and only ever runs on a click. See
 * docs/plans/remove-automatic-ip-city-detection.md.
 *
 * The cookie is user-controllable input and outlives any given seed, so it is resolved against
 * the real city list rather than trusted — a slug for a city that has been renamed or removed
 * falls through to "all cities" instead of resolving to nothing. */
export async function resolveDefaultCity(allCities: City[]): Promise<City | undefined> {
  const slug = (await cookies()).get(CITY_COOKIE)?.value;
  const remembered = slug ? allCities.find((c) => slugify(c.name) === slug) : undefined;
  if (remembered) return remembered;

  // No Bengaluru fallback. "All cities" is now a real, expressible state — `/` and `/buy` are
  // its addresses — so a visitor who has not chosen a city has genuinely not chosen one, and
  // saying "Bengaluru" would be inventing an answer. Callers render "All cities" for undefined.
  return undefined;
}
