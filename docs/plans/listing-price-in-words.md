# Listing price in words (Thousand / Lakh / Crore)

## Status: implemented 2026-09-27; number + words everywhere 2026-09-28; words only on cards and share text 2026-09-30

**Ask (2026-09-27):** show listing prices as "₹35 Thousand", "₹35 Lakh", "₹1 Crore" instead of
"₹35,00,000". Long Indian-grouped numbers are easy to misread by a factor of 10 (₹3,50,000 vs
₹35,00,000); words are also how Indian buyers talk and search, and how the big property portals
display prices.

**Follow-up (2026-09-28):** "Wherever we show price show it number + word form, even in admin."
Words alone hid the exact figure (a buyer or admin couldn't tell ₹35,00,000 from ₹35,49,999), so
every price now reads **"₹35,00,000 (35 Lakh)"**: the exact figure first, then the words in brackets.

**Follow-up (2026-09-30):** "Do we need to show both total price and price in words for all
listings, or is price in words enough?" Split by surface:

- **Browse cards and share text: words only, from ₹1 lakh up** ("₹60 Lakh"). A card is for
  scanning and comparing; the words are what's easy to compare, and the exact figure is one tap
  away. Below ₹1 lakh the plain number stays ("₹23,500"), since "₹23.5 Thousand" reads worse than
  the digits. (`compactPrice`: words when they contain Lakh or Crore.)
- **Detail page, my listings, post preview, admin: number + words**, unchanged — the places
  where the exact figure is being checked (the buyer deciding, the seller or admin confirming what
  was typed).
- A per-unit rate line ("₹5,000/sq ft · 1,200 sq ft") stays a number everywhere — see
  multiple-area-units-price-per-unit.md.

## Design

- **Shared formatters** in `packages/types/src/priceWords.ts`:
  - `formatInrInWords(n)` → "₹35 Lakh" (word form only; the BFF uses it to fill `priceInWords`).
  - `groupInr(n)` → "35,00,000". Hand-rolled Indian grouping, so Node, browsers and Hermes agree.
  - `formatInrWithWords(n)` → "₹35,00,000 (35 Lakh)".
  - `priceWithWords(price, priceInWords)` → the same, from a listing DTO's two strings. It also
    handles per-unit prices ("₹5,000/cent (5 Thousand/cent)").
  - `priceWordsNote(price, priceInWords)` → just "35 Lakh", for UIs that style the words separately.
  - `formatInrRangeWithWords(min, max)` → "₹30,00,000 – ₹60,00,000 (30 Lakh – 60 Lakh)",
    "up to ₹60,00,000 (60 Lakh)", "from ₹15,000 (15 Thousand)".
  - `compactPrice(price, priceInWords)` → "₹60 Lakh" from ₹1 lakh up, else `price` (cards, share).
  - `listingHeadlinePrice(item)` / `listingPriceText(item, "compact" | "full")` → a listing DTO's
    headline price, leading with `totalPrice` for a per-unit listing and adding the rate line.
- **Scales:** ≥ 1 Crore (1,00,00,000) → Crore; ≥ 1 Lakh → Lakh; ≥ 1,000 → Thousand; else digits.
  Below ₹1,000 there are no words, so the bracket is dropped ("₹500").
- **Numerals, not spelled-out numbers:** "35 Lakh", not "Thirty-five Lakh". Singular unit words.
- **Up to 2 decimals, truncated rather than rounded, trailing zeros dropped:** "35.5 Lakh",
  "1.25 Crore". Truncating means ₹99,999 reads "99.99 Thousand", never an overstated "100 Thousand".
- **Price on request:** stays "Contact for price", with no bracket.
- **Styling:** on the detail page the exact figure keeps the big green style and the words sit
  after it, smaller and muted; cards show the compact form in the same style (web and mobile
  `PriceWithWords` / `ListingPrice` components). Plain-text spots (my listings, admin tables,
  share text, notifications) use the string form.

## Why a separate field instead of changing `price`

`ListingCardDto.price` ("₹35,00,000") is parsed back to digits by:

- the web listing JSON-LD Offer (`apps/web/src/app/[city]/[[...rest]]/page.tsx`, `listingJsonLd`)
- the web, mobile and admin edit forms, which prefill the price input from it
- `parseRawPrice` in the admin form

So `price` stays the exact figure only, and `priceInWords` carries the words (`toCardDto` and
`toAdminQueueRowDto` → `formatListingPriceInWords`). Clients combine the two with `priceWithWords`.
When `priceInWords` is missing (an older BFF), they show just `price`.

## Where it shows

| Surface | Shows |
|---|---|
| Listing cards (web `ListingCard`, mobile `ListingCard`) | words from ₹1 lakh, else number |
| Listing detail (web `ListingDetailView`, mobile `listing/[id]`) | number + words |
| My listings (web and mobile) | number + words |
| Post-ad preview card (web and mobile) | number + words |
| Share text (mobile card share, web and mobile owner WhatsApp share) | words from ₹1 lakh, else number |
| Price inputs: post-ad, edit listing (web, mobile), admin edit form | live hint under the box, e.g. "₹35,00,000 (35 Lakh)" |
| Requirement budget: my requirements (web, mobile), admin requirements table | number + words range |
| Requirement refine wizard budget boxes (web, mobile) | live number + words hint |
| Matching requirements page (web), owner match notification (BFF) | "up to ₹60,00,000 (60 Lakh)" |
| Saved searches (web) | "min/max ₹… (…)" |
| Admin listings table, admin listing detail header | number + words (`priceInWords` added to `AdminListingRowDto`) |
| Admin listing edit history, `price` field | number + words |
| Moderation price-sanity message | number + words for the price and both bounds |
| Tools calculators (`formatInr`) | number + words |
| JSON-LD, edit form prefill | exact figure (unchanged) |

## Deliberately left compact or exact

- **Filter chips, budget presets, search-bar interpretation** (`formatINR` / `formatCompactInr`,
  "₹85L", "Under ₹50L"): these are short picker labels and the L/Cr suffix is already a word
  form. The full form would not fit a chip.
- **Requirement `searchLabel`** keeps the compact budget ("₹30L–60L"). It is a stored one-line
  title; the budget line under it on every card shows the full number + words.
- **SEO titles, meta descriptions, H1s** (`ListingMetaDto`, `seoRoute.ts` headings): unchanged,
  an SEO copy change to test separately.
- **Platform fees and plan prices** (boost, subscription, Instant Alerts, payments list): small
  fixed amounts (₹99–₹4,999), where words add nothing.
