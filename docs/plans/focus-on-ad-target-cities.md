# Focus the site and SEO on the 11 ad-target cities

**Status: built 2026-09-30.** Migration `20260930100000_popular_cities_are_ad_cities`.

## Ask

"We have only 11 cities in the Google Ads campaign; first focus has to be on those." Scope chosen:
the site itself (city pickers, header, footer, `/cities`) and SEO. Not outreach, requirement leads
or anything that changes where a listing is filed.

## Why

Since 2026-09-28 the campaigns target 11 cities (6 Metro + 5 Other-Metro; see
[google-ads-performance-analysis-2026-09.md](google-ads-performance-analysis-2026-09.md)):
Bengaluru, Delhi NCR, Hyderabad, Pune, Chennai, Mumbai, Kolkata, Ahmedabad, Jaipur, Lucknow,
Coimbatore.

The site's "Popular" tier (`City.isPopular`) was still the 12 metros picked at launch. Production on
2026-09-30 (live listings):

| | Live listings |
|---|---|
| The 11 ad cities | 409 of 440 (Bengaluru 88 … Jaipur 7) |
| Popular but not targeted: Chandigarh, Surat, Kochi | 3, 0, 0 |
| Targeted but not popular: Coimbatore, Lucknow | 12, 10 |

So the pickers' Popular tier and every page's footer linked to two empty city pages, while two of the
eleven ad cities sat in "More cities".

## What changed

- **`isPopular` = the 11 ad cities.** Migration plus `seedCities.ts`. Everything already keyed on it
  follows with no code change: the web `LocationPicker` and mobile city sheet (Popular tier), the
  header's city list, the footer's "Browse Cities" links on every page (the main internal links to
  city hubs), `GET /locations/cities` without a query, and the city-page link lists.
- **Reach is decoupled.** `catchmentKm` was derived from `isPopular` in the seed; it is now its own
  `WIDE_REACH_CITIES` list, so Surat, Kochi and Chandigarh keep 75 km and Lucknow and Coimbatore keep
  40 km. The migration doesn't touch `catchmentKm`. Where a listing is filed is unchanged.
- **`isServed` stays the 37.** Posting, the "More cities" tier and `/cities` still cover them; only
  the ordering and prominence change.
- **`/cities`:** a "Top cities" row (the 11) above "All cities by state".
- **Sitemap:** the 11 cities' hubs first (`priority` 0.9), then their area, transaction and category
  pages (0.8), then other cities' hubs (0.6) and drill-downs (0.5); home 1.0. Google ignores
  `priority` and order; Bing reads `priority`. The real SEO lever is the footer's internal links,
  which the flag change moves.

## Keeping it in sync

When the campaigns' city list changes, update `isPopular` (a migration plus `seedCities.ts`). Don't
touch `WIDE_REACH_CITIES` unless a city's reach itself should change.

## Not done

- Adding city or area pages with no listings to the sitemap: they would be thin pages.
- A "browse by city" block on the home page: the footer already links the 11 from every page.
- SEO titles and headings are the same for every city.
