import { cookies, headers } from "next/headers";
import type { City } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { fetchCityByIp } from "@/lib/bff";

/** Written by `middleware.ts` from whichever city the visitor last looked at — see the comment
 * there for why the capture lives in middleware rather than in a page. Holds the slug, never the
 * id: a cuid is invalidated by a reseed, and this cookie outlives one. */
export const CITY_COOKIE = "bhavano_city";

/** Same header, and the same last-hop rule, as `middleware.ts`'s `clientIp`. Caddy appends the
 * connecting peer to whatever arrived, so the rightmost entry is the address it actually saw and
 * the leftmost is whatever the client claimed. */
function clientIp(forwarded: string | null): string | undefined {
  if (!forwarded) return undefined;
  const hops = forwarded.split(",").map((v) => v.trim()).filter(Boolean);
  return hops[hops.length - 1];
}

/** The city to show when the URL itself does not name one — the homepage with no `?city=`, and
 * every account/static page that has no city in scope. In order:
 *
 *   1. the `bhavano_city` cookie — a city this visitor actually chose, so it beats any guess
 *   2. the visitor's IP, for a first-ever visit
 *   3. Bengaluru
 *
 * Previously this was the literal "Bengaluru" in two places, so a visitor in Chennai saw a screen
 * of Bengaluru listings however many times they had switched. See
 * docs/plans/visitor-location-default-city.md.
 *
 * The cookie is user-controllable input and outlives any given seed, so it is resolved against
 * the real city list rather than trusted — a slug for a city that has been renamed or removed
 * falls through to the next step instead of resolving to nothing.
 *
 * The IP step is a guess and is treated as one: it is skipped entirely once the cookie exists,
 * it returns null rather than an approximation when the nearest city is implausibly far, and the
 * city chip stays visible so one click corrects it. Indian mobile carriers route large regions
 * through a few peering cities, so this will be wrong a fair amount — just far less often than a
 * fixed Bengaluru default. */
export async function resolveDefaultCity(allCities: City[]): Promise<City | undefined> {
  const slug = (await cookies()).get(CITY_COOKIE)?.value;
  const remembered = slug ? allCities.find((c) => slugify(c.name) === slug) : undefined;
  if (remembered) return remembered;

  const ip = clientIp((await headers()).get("x-forwarded-for"));
  if (ip) {
    // Resolved against `allCities` by id rather than returned directly, so every caller gets the
    // same City object identity it would have got from the list — and so a city the BFF knows
    // about but this page did not fetch cannot leak in.
    const guess = await fetchCityByIp(ip);
    const matched = guess ? allCities.find((c) => c.id === guess.id) : undefined;
    if (matched) return matched;
  }

  // No Bengaluru fallback. "All cities" is now a real, expressible state — `/` and `/buy` are
  // its addresses — so a visitor who has not chosen a city has genuinely not chosen one, and
  // saying "Bengaluru" would be inventing an answer. Callers render "All cities" for undefined.
  return undefined;
}
