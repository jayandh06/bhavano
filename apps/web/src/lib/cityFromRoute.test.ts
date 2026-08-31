import { describe, expect, it } from "vitest";
import {
  LISTING_SLUG_ID,
  NATIONAL_FIRST_SEGMENTS,
  citySlugForRoute,
} from "./cityFromRoute";
import {
  LISTING_CATEGORIES,
  isReservedSegment,
  looksLikeListingSlugId,
} from "./seoRoute";

/**
 * `cityFromRoute` keeps edge-runtime copies of two things `seoRoute` owns. The copies exist for a
 * real reason (see that file's header), but nothing stops them drifting — and drift here is
 * silent and expensive: a category added to the grammar alone starts looking like a city name to
 * middleware, which then overwrites whichever city the visitor had chosen with, say, "plot".
 *
 * These are the tests that turn that into a failure at build time.
 */
describe("the edge copies still match the URL grammar", () => {
  it("covers exactly the segments seoRoute reserves", () => {
    // Derived from the grammar rather than retyped, so adding a category to seoRoute and not to
    // the middleware fails here rather than in production.
    const reserved = ["buy", "rent-lease", ...LISTING_CATEGORIES];
    expect([...NATIONAL_FIRST_SEGMENTS].sort()).toEqual([...reserved].sort());
  });

  it("reserves every word seoRoute considers reserved", () => {
    for (const segment of NATIONAL_FIRST_SEGMENTS) {
      expect(isReservedSegment(segment)).toBe(true);
    }
  });

  it("recognises the same listing-id shapes", () => {
    const cases = [
      "3bhk-for-sale-30461aca-726d-4fdf-a0d7-9f665080ccee", // uuid suffix
      "test-b9a467a3-46db-4788-a462-1e988472b7e0",
      "villa-cmrkwg8gk00004qquau1sbbim", // cuid suffix
      "indiranagar", // a locality, not a listing
      "hsr-layout",
      "sector-14",
    ];
    for (const segment of cases) {
      expect(LISTING_SLUG_ID.test(segment)).toBe(looksLikeListingSlugId(segment));
    }
  });
});

describe("citySlugForRoute", () => {
  it("remembers the city from a browse path", () => {
    expect(citySlugForRoute("/bengaluru", null)).toBe("bengaluru");
    expect(citySlugForRoute("/chennai/buy", null)).toBe("chennai");
    expect(citySlugForRoute("/hyderabad/gachibowli/rent-lease/apartment", null)).toBe("hyderabad");
  });

  it("remembers the city from ?city=", () => {
    expect(citySlugForRoute("/post", "bengaluru")).toBe("bengaluru");
    // A query param wins over the path — the nav links carry it deliberately.
    expect(citySlugForRoute("/chennai/buy", "mumbai")).toBe("mumbai");
  });

  it("clears the memory on the all-cities routes", () => {
    // null, not undefined: reaching these is a choice to stop filtering, and leaving a stale city
    // behind is what made /post announce a city the visitor had left days earlier.
    expect(citySlugForRoute("/", null)).toBeNull();
    expect(citySlugForRoute("/buy", null)).toBeNull();
    expect(citySlugForRoute("/pg", null)).toBeNull();
    expect(citySlugForRoute("/rent-lease/apartment", null)).toBeNull();
    for (const segment of NATIONAL_FIRST_SEGMENTS) {
      expect(citySlugForRoute(`/${segment}`, null)).toBeNull();
    }
  });

  it("leaves the memory alone on pages that are not about geography", () => {
    // undefined, not null: /messages is not a statement that the visitor wants every city.
    // /auth is the Google popup's own route pair. Left off this list it would look like a city
    // slug and overwrite the visitor's real city with "auth" every time they signed in.
    for (const path of ["/messages", "/messages/abc123", "/post", "/help", "/profile", "/tools", "/auth/google", "/auth/complete"]) {
      expect(citySlugForRoute(path, null)).toBeUndefined();
    }
  });

  it("does not treat opening a listing as choosing its city", () => {
    // The regression that had a visitor browsing all cities, opening one Chennai flat, and
    // finding every account page switched to Chennai afterwards.
    expect(
      citySlugForRoute("/chennai/anna-nagar/buy/house/3bhk-for-sale-30461aca-726d-4fdf-a0d7-9f665080ccee", null),
    ).toBeUndefined();
    expect(citySlugForRoute("/mumbai/andheri/rent-lease/apartment/2bhk-cmrkwg8gk00004qquau1sbbim", null)).toBeUndefined();
  });

  it("ignores slugs it could not have emitted", () => {
    // slugify only ever produces lowercase, digits and hyphens, so anything else is a URL nobody
    // legitimately generated — not worth storing, and not worth trusting.
    expect(citySlugForRoute("/Bengaluru", null)).toBeUndefined();
    expect(citySlugForRoute("/beng%20aluru", null)).toBeUndefined();
    expect(citySlugForRoute("/post", "../../etc/passwd")).toBeUndefined();
    expect(citySlugForRoute("/post", "a".repeat(65))).toBeUndefined();
  });
});
