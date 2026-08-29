# Showing every city by default, and national category routes

## The proposal

1. The homepage opens with city = **All**, showing every listing rather than one city's.
2. Category browsing without a city gets its own routes: `/buy`, `/rent-lease`, `/pg`,
   `/furniture`.
3. Picking a city switches to the existing shape: `/bengaluru/buy`.

The motivation is real and correctly diagnosed: a visitor landing on a city with nothing in it
concludes the site is dead, and leaves.

## The number that has to be said first

```
active listings          15
Bengaluru                10
Pune                      2
Ahmedabad / Mumbai / Hyderabad   1 each
the other 33 cities       0
```

**Removing the city filter takes a visitor from 0 listings to 15.** Both look empty. The
proposal moves the number, not the impression — a national page with 15 results across 12
categories reads as abandoned in exactly the way a city page with 0 does, and it costs the
relevance that made the city page worth showing.

So the honest answer to "is this a good idea?" is: **the diagnosis is right and this particular
fix does not address it**. That does not make the work worthless — parts of it are genuinely
worth doing — but it should not be adopted expecting the empty-site feeling to go away.

## What actually fixes the empty feeling

**Never render an empty result set.** Whatever city and filter is active, when the query returns
nothing, show what does exist instead of a void:

> **No apartments for rent in Coimbatore yet.**
> Here are 15 listings from across India — or [post the first Coimbatore ad](/post).

This is strictly better than defaulting to All, on every axis:

- The page keeps its local intent, so `/coimbatore/rent-lease/apartment` stays a page that can
  rank for a Coimbatore query, instead of becoming a duplicate of a national page.
- A visitor who *does* have local inventory never sees irrelevant results from 2,000km away.
- A visitor who doesn't sees the site is alive, plus the one call to action that helps at 15
  listings: post one.
- It is a change to one component, not to the routing tree.

This is what OLX, Airbnb and every marketplace with a cold-start problem does. Nobody defaults to
global; they expand the radius when local comes up short.

**And the real fix is inventory.** At 15 listings no amount of routing helps. That is what the
`OutreachContact`/`OutreachCampaign` machinery already in the schema is for, and what the ad
campaigns were just re-pointed at posters to do.

---

## If the national routes are still wanted

They have a legitimate use even under the recommendation above: an explicit **"All cities"**
choice in the picker needs a real URL to live at, rather than a query param. Worth building for
that reason — as a destination the user asks for, not as the default.

### Routing — the part that will bite

`parseSegments` treats the first path segment as the city, and anything that is not a transaction
group as an area. `/buy` therefore resolves as `city = "buy"`, fails `resolveCity`, and 404s.

Making `/buy` work means reserving the category vocabulary at the city position:

```
/buy                    transaction group, no city
/rent-lease             transaction group, no city
/rent-lease/pg          group + category, no city
/bengaluru/buy          city + group          (unchanged)
```

The reserved set is small and closed (`buy`, `rent-lease`, plus the ten `ListingCategory`
values), so the check is cheap. But it permanently forbids a city slug colliding with any of
them — worth writing down, because a future city named "Commercial" or an area-first URL would
silently resolve as a category.

### It interacts with what shipped today

`middleware.ts` writes the `bhavano_city` cookie from the first path segment unless that segment
is in `RESERVED_FIRST_SEGMENTS`. **Adding `/buy` without adding these words to that set means
visiting `/buy` stores `bhavano_city=buy`.** The read side validates against the real city list
so it degrades to the default rather than breaking — but the visitor silently loses their
remembered city. Same list, same file, must be updated in the same change.

### It also reverses a decision made today

`docs/plans/visitor-location-default-city.md` shipped this morning: remember the visitor's city,
then guess it from their IP, so the homepage opens on somewhere relevant. Defaulting to **All**
discards both. They are answers to opposite questions — "show me what is near me" versus "show me
everything" — and only one can be the default.

If All becomes the default, the geo work is not wasted (it still powers the city chip and the
`/post` flow), but it stops affecting what the homepage lists. **Decide this deliberately rather
than letting the newer change quietly win.**

### SEO

- **`/buy` will not rank, and that is fine.** Generic national terms in Indian real estate are
  owned by 99acres, MagicBricks and NoBroker. The pages that can realistically rank are the long
  tail — `/bengaluru/hsr-layout/rent-lease/apartment/2bhk`. National routes should be built for
  navigation, not acquisition.
- **They must not compete with the city pages.** `/buy` and `/bengaluru/buy` describe overlapping
  content. Keep `/buy` out of `sitemap.xml`, or accept that it dilutes the city pages that are
  the actual strategy.
- **Do not make `/buy` the homepage's canonical.** `app/page.tsx` canonicalises every filtered
  variant back to `/`; national category routes must not become a second front door with the same
  content.
- **Thin-content risk is live at 15 listings.** A `/pg` page with 2 results and a `/interiors`
  page with 0 are exactly what Google's thin-content heuristics target. Do not emit a national
  route for a category with no inventory.

### Work

1. `parseSegments`: accept a transaction group or category in the first position, returning a
   `cityless` shape. Keep every existing URL resolving unchanged.
2. `buildBrowsePath`: allow `cityName` to be omitted.
3. `RESERVED_FIRST_SEGMENTS` in `middleware.ts`: add the group and category words.
4. `BrowseListingsView`: tolerate a null city — heading ("Apartments for Rent in India"), the
   footer's city links, and `AreaFilter` all currently assume one.
5. `LocationPicker`: an "All cities" entry that navigates to the cityless route.
6. `sitemap.ts`: deliberately exclude the national routes, per the SEO note above.
7. `generateMetadata`: national titles/descriptions, and a self-canonical on each.

### Verification

- Every existing URL still resolves: `/bengaluru`, `/bengaluru/buy`,
  `/bengaluru/hsr-layout/rent-lease/apartment/2bhk`, and the legacy shapes that 301.
- `/buy` renders nationally; `/bengaluru/buy` still renders Bengaluru only.
- Visiting `/buy` does **not** overwrite `bhavano_city`.
- A city whose slug would collide with a category word is rejected at seed time, not at request
  time.

## Recommended order

1. **The never-empty fallback.** One component, no routing risk, and it is the change that
   actually addresses the complaint.
2. **Inventory.** Nothing else matters at 15 listings.
3. **National routes**, if an explicit "All cities" option is still wanted after 1 and 2 — and as
   a choice the user makes, not as the default.
