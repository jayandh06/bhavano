# Searching for an area lands on the area's own page

## Problem
Typing "hsr layout" in the search bar while browsing Bengaluru produced
`/bengaluru?area=hsr+layout&rememberCity=0`: correct results, but under a duplicate address with the
heading "All Listings in Bengaluru" and a canonical back to `/bengaluru`, while the real, indexed
page `/bengaluru/hsr-layout` sat unused. From the all-India homepage, `/?q=hsr+layout` is only a
title search (no city, so no way to know which city's area is meant).

## Change (apps/web, `app/[city]/[[...rest]]/page.tsx`)
1. **A resolved `?area=` redirects (308) to the clean path**, keeping the category and facet the
   search bar already put in the path and every other query param (price, `rememberCity=0`);
   only `area` is dropped. `/bengaluru/rent-lease/apartment?area=hsr+layout` goes to
   `/bengaluru/hsr-layout/rent-lease/apartment`. It cannot loop, because the target has the area in
   its path. Links already shared with `?area=` keep working through the redirect.
2. **A search that does not resolve to an area** (the text is just a keyword) stays a query page,
   and its H1 now says what it shows: "All Listings in Bengaluru: results for "<text>"". Its
   canonical is still the plain route, as before.

## Not done
- Homepage search for an area name. Plan: when the text matches one area name that exists in only
  one city, go to that area page; if several cities have it, offer a city choice; otherwise keep the
  title search. Needs a small BFF lookup of area names across cities.
