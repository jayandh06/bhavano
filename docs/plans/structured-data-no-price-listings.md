# Structured data for listings with no price

## Status: fixed and committed (2026-10-20); needs a production deploy and a re-crawl to clear the audit

## Problem

A site audit (2026-10-20) reported **49 invalid structured-data items**, all "Product snippet: a value for the
`aggregateRating`, `offers` or `review` field is required", on PG and coworking listing pages, for example
`/bengaluru/bellandur/rent-lease/coworking/lad-workspaces-…` and
`/bengaluru/marathahalli-village/rent-lease/pg/sln-grand-gents-pg-…`.

Cause (`listingJsonLd` in `apps/web/src/app/[city]/[[...rest]]/page.tsx`): every non-real-estate category was
emitted as `Product`, and a "contact for price" listing (`priceOnRequest`, which is what imported PG and coworking
rows are) deliberately has no `offers` (a fake `price: "0"` would be worse). A Product with none of
offers/aggregateRating/review is invalid.

## Fix

For a non-real-estate listing **without** an offer, describe it as what it is instead of a Product:

| Category | Type when no price |
|---|---|
| PG, coworking, storage | `Place` (name, description, url, images, `PostalAddress`, geo when known) |
| Interiors | `Service` (with `areaServed` = city) |
| Furniture | `Thing` |

Anything with a real price keeps `Product` + `Offer` exactly as before; real-estate categories
(`RealEstateListing`) are unchanged. No URL, metadata, canonical or sitemap change.

## Verification

Local server against production data: both URLs above now emit `Organization`, `BreadcrumbList` and `Place` (with
an address, no `Product`). Not yet re-validated in Google.

## After deploy

- Re-run the site audit (or "Validate fix" in Search Console's Product snippets report); the report only
  updates on the next crawl.
- Not rich-result eligible either way (no price, no rating); this only removes the errors.
- If you want star/price rich results for these pages later, they need real `offers` or reviews, which the data
  does not have today.
