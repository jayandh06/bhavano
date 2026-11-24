# US market: audit of India assumptions

## Status: first pass done 2026-11-24 (keyword search by directory, central files read; not a line-by-line review)

Companion to [us-market-expansion.md](us-market-expansion.md). Counts are **files** matching a keyword search in
`apps/` and `packages/` (specs/tests, `node_modules`, build output excluded), so treat them as size hints; some words
(`IST`, `cent`, `pg`) over-match. Each item is sorted into: **Config** (becomes a per-market setting, India values
unchanged), **US equivalent** (needs a second implementation), **India-only** (stays, hidden or absent in the US).

## Summary

| # | Area | Size | Class | US work |
|---|---|---|---|---|
| 1 | Phone and OTP | small (about 15 files) | US equivalent | Replace the 10-digit Indian rule with E.164 per market, MSG91/WhatsApp with Twilio Verify and email |
| 2 | Currency and price format | large (about 90 files) | Config | One money formatter taking currency and locale; USD, no lakh/crore |
| 3 | Area units and BHK vocabulary | very large (about 220 files) | Config | sq ft only in the US; bed/bath fields instead of BHK |
| 4 | Time zone | medium (about 50 files) | Config | Cron jobs and "IST day" logic read the market time zone |
| 5 | Locations, cities, geocoding | medium | Config + data | Country restriction in Places calls, US city/state/ZIP seed, state in slugs |
| 6 | Categories | medium | Config | Hide PG, coworking, plots (land) in the US; add what the wedge needs |
| 7 | Messaging channels | medium | US equivalent | Email and push first; WhatsApp templates are India-only |
| 8 | Payments and tax | small but critical | US equivalent | Razorpay and INR price tiers to Stripe or USD store tiers; GST fields dropped |
| 9 | Legal and trust copy | small | US equivalent | Entity, terms, privacy, Fair Housing; `LEGAL_ENTITY` is the Indian LLP |
| 10 | SEO, structured data, routes | small | Config | `addressCountry`, hreflang none at first, own sitemap/robots |
| 11 | Content (blog, guides, tools) | large | India-only | India law and process content stays on bhavano.com; US needs its own or none |
| 12 | Ads and attribution | outside code | US equivalent | New Google Ads setup; `ipCountry: 'IN'` filters |
| 13 | Discriminatory preferences | small, important | India-only | Remove from the US (Fair Housing) |

## Findings

### 1. Phone and OTP
- `apps/bff/src/auth/dto/send-otp.dto.ts` (and `verify-otp.dto.ts`, `dev-login.dto.ts`): the regex
  `^[6-9]\d{9}$`, message "10-digit Indian mobile number". Phone is also the login identity (`User.phone` is unique).
- `+91` handling in web (`components/home`, `lib`), mobile (`context`, `components/home`, `(tabs)`), BFF `listings`,
  `outreach`, `admin`, `ads`, and `packages/types`.
- OTP delivery is WhatsApp first then SMS through MSG91 (`notifications/providers`; DLT template rules).
- **US:** store numbers as E.164 with a country, validate per market (libphonenumber), OTP through Twilio Verify
  (A2P 10DLC, TCPA consent); make email and Google/Apple the primary login (`email-login-switch.md` already
  exists). Open decision: whether a phone is required at all in the US. Contact reveal and listing contact use phones.

### 2. Currency and price format
- `₹`/`INR`/`en-IN`/`Intl.NumberFormat` in about 25 web `components/home` files, 15 mobile, 9 admin, 15 in
  `packages/types` (`boostPricing.ts`, `listingPublishPricing.ts`, `platformFeePricing.ts`, `priceBounds.ts`,
  `priceWords.ts`, `appleProducts.ts`, `cardSpecs.ts`), tools (calculators), and ads conversion values.
- `priceWords.ts` and `listing-price-in-words` produce lakh/crore wording; `priceBounds.ts` bounds are INR ranges.
- Subscription, boost and platform-fee prices are INR amounts in settings and `paise` in Razorpay calls.
- **US:** one shared `formatMoney(amount, market)`; price bounds and price qualifiers per market; separate price
  tiers per market (not a conversion of INR).

### 3. Area units and BHK
- `areaUnit.ts` already supports `sqft`, `sqm`, `acre`, `hectare`, `cent`; web has about 99 files and mobile 53 touching
  units. **Plot/land units (cent, hectare, bigha) and `sq yd`/`gaj` are India-only.**
- BHK is the Indian bedroom/hall/kitchen shorthand used in filters, `bhk-multiselect-and-sort-by.md`, search interpretation
  and SEO titles. The US says "2 bed, 1 bath" (bathrooms are a first-class filter there).
- **US:** per-market unit list (sq ft only); bedrooms and bathrooms fields; carpet/super built-up area vocabulary in
  `categoryFields.ts` does not apply.

### 4. Time zone
- `goLive.ts` hardcodes `Asia/Kolkata`; BFF crons (`seller-jobs/*`: 08:00, 09:00 and hourly reminders) use
  `timeZone: 'Asia/Kolkata'`; admin "days are IST" in Page visits grouping (`page-visit-groups.ts`), reports and
  `formatDateTime.ts`.
- **US:** the US stack runs its own crons, so a per-market `timeZone` setting is enough for the start; reminders
  for a nationwide US audience need the user's zone (send at local morning), which India never needed.

### 5. Locations
- Places autocomplete is restricted with `components=country:in` (`locations.service.ts:539`); the map picker has a
  client-side equivalent (`LocationMapPicker.tsx`). Reverse geocoding, `LocalityAlias`, `catchmentKm`, `isServed`,
  `isPopular` (11 ad-target cities), `CitySlugRedirect`, and the "37 served markets" model are all India-shaped.
- `user-city-from-ip.service.ts` filters visits with `ipCountry: 'IN'`.
- City page JSON-LD has `addressCountry: "IN"` (`app/[city]/[[...rest]]/page.tsx`).
- `City.state` exists, but slugs are name-only; a US slug needs the state.
- **US:** country from market config in all Places/geocode calls; US seed (city, state, ZIP, county); keep
  `isServed` as the "open" flag per city; no IP-city auto-detection (already removed in India).

### 6. Categories
- `ListingCategory` and `postCategories.ts`/`categoryFields.ts` (about 1,700 lines of field definitions) include PG,
  coworking, plots and commercial; transactions are `buy | sell | rent | lease`.
- **US:** enable only what the wedge needs per market (houses, apartments for rent and for sale); fields differ
  (HOA, pets, parking, lease term, deposit, utilities included).

### 7. Messaging channels
- WhatsApp (WABA templates, `whatsapp.ts`, `whatsapp-webhook.controller.ts`, `whatsapp-conversational-posting.md`),
  MSG91 SMS and DLT, `owner-alerts`, `notifications/providers`.
- **US:** email and push by default; SMS only with consent and registration; WhatsApp conversational posting is
  India-only.

### 8. Payments and tax
- Razorpay (`payments/`, orders in paise), Apple IAP (`payments/apple`, INR product ids in `appleProducts.ts`),
  Google Play billing, GST/`gstin` fields in `legalEntity.ts`, platform fee, checkout gate, promo codes, referral rewards.
- **US:** Stripe or app-store billing with USD tiers; sales-tax handling; invoices; refund policy copy.

### 9. Legal and trust
- `legalEntity.ts` names the Indian LLP (written to match MCA and DLT), plus `/terms`, `/privacy`, `/trust`,
  `/about` (mentions GST), `finfolia-entity-disclosure.md`.
- **US:** the operating entity, CCPA-style privacy, Terms, Fair Housing statement, accessibility, and licensing
  disclaimers. Do not reuse the India texts.

### 10. SEO and routes
- Public routes: `[city]/[[...rest]]`, `cities`, `listings`, `requirements`, `tools`, `blog`, etc. Sitemap and robots
  are generated per host (`app/sitemap.ts`, `app/robots.ts`); changing them on bhavano.com needs explicit approval
  (CLAUDE.md). The US host gets its own; no change to India files beyond reading market config.
- Structured data country, `sameAs`, `lang="en"` (should become `en-US` for the US), Open Graph locale.

### 11. Content
- Blog, `answerGuides.ts`, `builderGuides.ts`, `homeJourneyGuides.ts`, `landRecordGuides.ts`, `areaOverview`,
  calculators (EMI, rent vs buy, down payment, area converter) are India-specific (RERA, stamp duty, land records).
- **US:** hide these on the US site at launch; add US content later (SEO-driven, slowly).

### 12. Ads and attribution
- Google Ads customer 4214066478, tCPA in INR, offline conversion values in INR, `ads_*.py` scripts, GTM, GA4; `ipCountry: 'IN'` checks.
- **US:** separate account or campaigns, own conversion actions in USD, own GA4 stream; same scripts parameterized.

### 13. Discriminatory preferences (do not ship in the US)
- `categoryFields.ts`: tenant preference `bachelor` (line about 1018), `vegetariansOnly` (about 1033), "Veg only" (about 1351),
  PG gender fields; search interpretation prompt examples ("bachelors allowed"); `SearchBar` hint words (girls, boys, family).
- **US:** remove or disable such fields and filters on the US market, and screen free-text descriptions for
  protected-class language (Fair Housing Act). Needs legal review.

## Implementation order (proposed)

1. Add the `market` config in `packages/types` (country, currency, locale, time zone, units, phone rule, payment
   provider, categories, legal entity); read it everywhere below. India values reproduce today's behavior exactly.
2. Replace hardcoded `Asia/Kolkata`, `en-IN`, `country:in`, `addressCountry: "IN"`, `ipCountry: 'IN'`.
3. One money and unit formatter shared by web, mobile and admin; migrate the 90 currency call sites.
4. Phone: E.164 plus country, then OTP channel per market.
5. Categories and fields per market; remove discriminatory fields in the US.
6. Payments and legal entity per market.
7. Content gating for the US site.
Each step must leave India output byte-identical; guard with the existing tests plus snapshot tests of formatted
prices and generated pages.

## Open questions

- Is a phone number required for US sellers, or is email enough?
- Which US categories and the rental-first field set (needs the wedge decision in `us-market-expansion.md`)?
- Does the mobile app switch market per account or per install (an NRI may want both)?
- Same app binary for both markets (recommended) or separate app listings?

## Not verified

This pass did not read each flagged file in full, count Prisma migrations, review admin-only screens in detail, or check
third-party dashboards (MSG91, WABA, Razorpay, Google Ads). Treat sizes as estimates.
