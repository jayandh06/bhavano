# Listing price in words (Thousand / Lakh / Crore)

## Status: implemented 2026-09-27

**Ask:** show listing prices as "₹35 Thousand", "₹35 Lakh", "₹1 Crore" instead of "₹35,00,000".
Long Indian-grouped numbers are easy to misread by a factor of 10 (₹3,50,000 vs ₹35,00,000); words
are also how Indian buyers talk and search, and how the big property portals display prices.

## Design

- **Shared formatter:** `formatInrInWords` in `packages/types/src/priceWords.ts`, used by the BFF
  and by both post-ad preview cards (web and mobile) so the preview matches the live card.
- **Scales:** ≥ 1 Crore (1,00,00,000) → Crore; ≥ 1 Lakh → Lakh; ≥ 1,000 → Thousand; else digits.
- **Numerals, not spelled-out numbers:** "₹1 Crore", not "One Crore", because digits scan faster
  in a card grid. Singular unit words ("35 Lakh", like "35 Thousand"), the common Indian usage.
- **Up to 2 decimals, truncated rather than rounded, trailing zeros dropped:** "₹35.5 Lakh",
  "₹1.25 Crore". Truncating means ₹99,999 reads "₹99.99 Thousand", never an overstated
  "₹100 Thousand".
- **Per-unit prices:** "₹5 Thousand/cent", the same suffix rule as the numeric form.
- **Price on request:** stays "Contact for price".

## Why a new field instead of changing `price`

`ListingCardDto.price` ("₹35,00,000") is parsed back to digits by:

- the web listing JSON-LD Offer (`apps/web/src/app/[city]/[[...rest]]/page.tsx`, `listingJsonLd`)
- the web, mobile and admin edit forms, which prefill the price input from it
- `parseRawPrice` in the admin form

Turning `price` into words would have broken all of them silently ("₹35 Lakh" parses to 35). So
`price` stays exact, and a new `priceInWords` is added (`toCardDto` →
`formatListingPriceInWords`). Clients render `priceInWords || price`, so an older app build or a
web deploy that lands before the BFF still shows a price.

## Where it shows

| Surface | Shows |
|---|---|
| Listing cards (web `ListingCard`, mobile `ListingCard`) | words; web card has the exact figure as a hover title |
| Listing detail (web `ListingDetailView`, mobile `listing/[id]`) | words, large, with the exact figure in small text beneath |
| My listings (web and mobile) | words |
| Post-ad preview card (web and mobile) | words |
| Mobile share text | words |
| Admin, edit forms, JSON-LD, SEO meta | exact figure (unchanged) |

## Not done / possible follow-ups

- `ListingMetaDto` (page titles and meta descriptions) still uses the exact figure. Words could suit
  search snippets ("3BHK flat for ₹35 Lakh"), but that's an SEO copy change to test separately.
- Search price filters and requirement budgets still use their own formats (`formatINR` short
  "₹85L", and `toLocaleString` for requirements). Unify them later if the mix looks inconsistent.
