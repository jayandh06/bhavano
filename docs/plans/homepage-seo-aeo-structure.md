# Homepage structure for SEO, AEO and visitors

## Problem
The live homepage had the H1 "All Listings in India", no H2 or H3 headings, and only Organization
structured data. Crawlers and answer engines had no clear statement of what the page is or how it
is organised, and visitors who scrolled past the grid found nothing but the footer.

## Change (apps/web)
Only the **plain `/` view** (every city, every category, page 1, nothing searched or filtered):
- **H1** becomes "Buy, rent and list property across India". A filtered view keeps its own
  heading, which describes exactly what it shows; the requirement label still uses that heading.
- **New server-rendered sections** under the grid (`components/home/HomeSeoSections.tsx`), no
  client JavaScript: Browse properties by category (buy and rent/lease links built with
  `buildBrowsePath`), Browse listings by city (the popular cities plus "See all cities"), How
  Bhavano works (three steps, link to `/trust`), Own or manage a property (link to `/post`), Free
  tools and guides (four tools and the newest four posts), and a visible FAQ.
- **Structured data:** `WebSite` with a `SearchAction` pointing at `/?q={search_term_string}`, and
  `FAQPage` whose text is the same as the visible FAQ. The existing Organization block is unchanged.

## Mobile browser and the app
- **Shared text:** the steps and FAQ live in `packages/types/src/homeContent.ts`
  (`HOME_STEPS`, `homeFaqs(cityNames)`), used by the web sections and by the app, so they cannot
  disagree.
- **Mobile browser:** the sections are single-column on a phone (two or three columns from the `sm`
  breakpoint up), links are padded to a finger-sized tap target, and nothing needs client JS.
- **App:** `apps/mobile/src/components/home/HomeExploreFooter.tsx` is the feed's footer. It shows
  only once the feed has run out (an endless list would never reach a footer): how it works, Post
  your property, the four newest guides (the in-app blog), four tools (opened in the in-app
  browser) and the FAQ accordion. Search engines cannot crawl the app, so this is for users, not
  SEO. It ships with the next app release.

## Rules kept
- Title, description and canonical (`/`) untouched. Everything is server-rendered; the grid and
  header stay first, so the first screen is unchanged.
- No numbers on the page that are not computed from live data. FAQ answers avoid claims that are
  not already true on the site: browsing is free and needs no login; boosting is a paid option;
  listings are checked before going live but properties are not inspected; brokerage is stated by
  the person who posted.

## Not done
- A "popular areas" block (needs a decision on which areas qualify; the areas with published
  overviews are the natural source once some are published).
- Measuring: compare homepage impressions and clicks in Search Console before and after, and check
  `FAQPage` and `WebSite` in the Rich Results Test.

## Area links ranked by listings (2026-10-19)
The footer's "Areas in {city}" and the "Explore nearby" block took the city's areas alphabetically,
capped at a few dozen, so on Bengaluru they started "1st Block", "1st Phase", "2nd Stage" and never
reached HSR Layout, Koramangala or Whitefield: the best area pages had no internal link from their
own city page.

- **BFF:** `GET /locations/area-listing-counts?cityId=` returns `{ areaId: activeListings }`.
- **Web:** `lib/areaRanking.ts` `rankAreasForLinks` orders areas by active listings, most first. It
  keeps areas that meet the indexable minimum (`MIN_INDEXABLE_AREA_LISTINGS`); if fewer than four do,
  it keeps every area with any listing; with no data at all it returns the original list. The counts
  are cached for an hour and an empty result on failure falls back to the old order.
- **Used by:** the footer, the intro and "Explore nearby" on browse pages, the listing detail
  footer, and the homepage footer once a city is chosen. The area filter keeps the alphabetical list.
