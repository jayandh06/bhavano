# US launch cities

Part of [us-market-expansion.md](us-market-expansion.md). Built 2026-11-26.

## Decisions (the owner's)

- **Fifteen cities:** New York, Los Angeles, Chicago, Houston, Dallas, Austin, Phoenix, Atlanta, Miami, Washington (DC),
  Boston, San Francisco, Seattle, Denver and Charlotte. Chosen on metro size and on rental and for-sale activity (the large
  renter markets plus the main Sun Belt sales markets). This is a judgment informed by partial public rankings, not a
  measured ranking; revisit it with real search and listing data.
- **URLs carry the state** (`/us/austin-tx/rent-lease/condo`, `/us/washington-dc`), as the US plan already said.

## How the state slug works

City names are stored plain ("Austin"), so headings, search and map-pin matching show and match "Austin".
`citySlug(name)` in `packages/types/src/citySlug.ts` adds the state code for the US market only
(`NEXT_PUBLIC_MARKET || MARKET`); India's slugs are exactly `slugify(name)`.

- **Rule:** any link to a city, and any lookup of a city from a URL, goes through `citySlug`, never `slugify`. Area and
  listing slugs still use `slugify`.
- A new US city needs an entry in `apps/bff/prisma/data/usCities.json` and in `US_CITY_STATE_CODES`
  (`apps/bff/src/market/us-cities.spec.ts` keeps them equal, and checks no India city shares a name).
- **Limit:** the code is looked up by name, so two US cities with the same name (Portland OR and ME) cannot both be added
  without first giving the lookup the state.

## Data

15 cities with 12 neighbourhoods or close suburbs each (180). All are `isServed` and `isPopular` (listed first in the
pickers, header, footer and `/cities`). `catchmentKm` (how far a map pin still files under the city): 60 for the
sprawling metros (Los Angeles, Houston, Dallas, Phoenix, Atlanta, Miami), 50 for New York and Chicago, 35 for San
Francisco, 40 for the rest. Suburbs such as Plano, Mesa, Cambridge or Oakland are areas of their metro city, the same way
India's wards and nearby towns are.

Coordinates are from general knowledge (as India's were) and were cross-checked against Google geocoding on 2026-11-26: all
15 city centres matched, and the neighbourhoods more than 2.5 km apart were broad areas or Google matching something else
(a street, a school district, another "Mesa"). Google's results were not stored.

Aliases: NYC, New York City, Washington DC, Washington, D.C., SF, LA.

## Loading

On the US app host, after a deploy:

```
docker exec -w /app/apps/bff bhavano-us-bff-1 npx tsx prisma/seedUsCities.ts
```

Safe to repeat (upserts). It refuses to run unless `MARKET=us`.

## Targeting

- The US site is **noindexed**, so these pages are not in search yet; they start counting for SEO when the owner lifts
  noindex and submits the US sitemap.
- No ads were set up. US ad campaigns and budget are the owner's decision (open item in us-market-expansion.md).
## City overview drafts (2026-11-26)

`apps/bff/scripts/us-city-overview-drafts.ts` holds a draft for each of the 15 cities (About, Getting around, FAQs), in the
same format and with the same validator as India's ([area-overview-pages.md](area-overview-pages.md)); the validator now
also rejects dollar amounts. `us-city-overviews.spec.ts` additionally rejects wording about who lives somewhere, safety or
schools (Fair Housing). They are **written from general knowledge and not reviewed**.

- Load as drafts on the US host (invisible to visitors):
  `docker exec -w /app/apps/bff bhavano-us-bff-1 npx tsx scripts/seed-area-overview-drafts.ts`
- **Publishing is not possible yet from the US stack:** review and publish happen in the admin app, which is not deployed
  there. Either deploy admin to the US stack, or publish by script after the owner approves the text.
- Reviewer should check each fact (transit lines, neighbouring cities, the New York co-op, San Francisco rent ordinance and
  Boston lease-date notes) against a current source.
- No US area (neighbourhood) overviews are drafted.
