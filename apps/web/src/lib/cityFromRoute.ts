/**
 * Which city a request is looking at, decided from the URL alone.
 *
 * This is `middleware.ts`'s half of the city cookie, kept here rather than inline there for two
 * reasons: middleware runs in the edge runtime on every navigation, and a plain function with no
 * `NextRequest` in its signature can be unit-tested without one.
 *
 * Everything below is deliberately duplicated from `lib/seoRoute.ts`, which owns the URL grammar
 * for the rest of the app. Importing it here would pull `CATEGORY_FIELD_CONFIG` and the rest of
 * the types package into the edge bundle, which is then parsed on every request — a real cost for
 * two lists and a regex. `cityFromRoute.test.ts` asserts the copies still agree with the
 * originals, so the drift this would otherwise invite fails a test instead of silently making a
 * new category look like a city.
 */

/** The URL grammar's own vocabulary — national browsing lives at `/buy`, `/pg`, `/furniture`.
 *
 * Reaching one of these means the visitor is looking at **every** city, which is a choice worth
 * remembering as much as picking a single city is. Mirrors `isReservedSegment` in seoRoute.ts:
 * the two transaction groups plus every ListingCategory. */
export const NATIONAL_FIRST_SEGMENTS = new Set([
  "buy",
  "rent-lease",
  "house",
  "apartment",
  "villa",
  "pg",
  "storage",
  "coworking",
  "furniture",
  "interiors",
  "plot",
  "commercial",
]);

/** Top-level routes that are pages in their own right rather than city slugs.
 *
 * `/[city]/[[...rest]]` is a catch-all, so every first path segment that is not listed here (or
 * above) looks like a city. A new top-level route added without being added here would overwrite
 * a remembered city with its own name — which degrades to "forgot the city" (the read side
 * resolves the slug against the real city list and falls through), never to a broken page.
 *
 * Unlike the national segments above, these say nothing about which city the visitor wants:
 * /messages is not a statement about geography, so it leaves the remembered city alone. */
export const PAGE_FIRST_SEGMENTS = new Set([
  "about",
  "agent",
  "api",
  "contact",
  "favourites",
  "help",
  "listings",
  "messages",
  "my-listings",
  "post",
  "premium",
  "privacy",
  "profile",
  "saved-searches",
  "terms",
  "tools",
]);

/** Shape of a slug this app emits — `slugify` only ever produces lowercase, digits and hyphens.
 * Anything else is a URL nobody legitimately generated, and is not worth storing. */
export const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

/** A listing's trailing `{slug}-{id}` segment. Mirrors `looksLikeListingSlugId` in seoRoute.ts. */
export const LISTING_SLUG_ID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|-[a-z0-9]{20,}$/i;

/**
 * The city slug this request is looking at.
 *
 * Three-valued on purpose:
 *   - a slug   — this URL names a city, remember it
 *   - `null`   — this URL is explicitly all-cities, forget whichever city was remembered
 *   - `undefined` — this URL says nothing about geography, leave the memory alone
 *
 * Collapsing the last two is what made picking "All cities" and then opening /post announce the
 * city the visitor had been looking at last week.
 *
 * Not validated against real cities: middleware has no database access, and a lookup on every
 * page navigation would be the wrong trade anyway. `resolveDefaultCity` does that check when the
 * cookie is read, so a junk value costs a fallback to the default, not a wrong page.
 */
export function citySlugForRoute(pathname: string, cityParam: string | null): string | undefined | null {
  if (cityParam) return SLUG_PATTERN.test(cityParam) ? cityParam : undefined;

  const first = pathname.split("/")[1];

  // "/" and the national routes ARE the all-cities view. Reaching one is a deliberate choice to
  // stop filtering by city, so it clears the cookie rather than leaving a stale value behind.
  if (pathname === "/" || (first && NATIONAL_FIRST_SEGMENTS.has(first))) return null;

  if (!first || PAGE_FIRST_SEGMENTS.has(first) || !SLUG_PATTERN.test(first)) return undefined;

  // Viewing a listing is not choosing a city. A listing URL is
  // /{city}/{area}/{group}/{category}/{slug}-{id}, so opening a Chennai flat from an all-cities
  // browse used to rewrite the remembered city to Chennai — and the visitor then found /post and
  // every account page announcing a city they had never picked.
  const last = pathname.split("/").filter(Boolean).pop();
  if (last && LISTING_SLUG_ID.test(last)) return undefined;

  return first;
}
