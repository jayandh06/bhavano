# Furniture/Interiors paused, Coworking promoted to its own tab (2026-10-08)

## What changed

Two home/nav changes, done together since they touch the same files (`HOME_TABS` on both
platforms, the shared `packages/types` category vocabulary):

1. **Furniture and Interiors hidden** from the post-ad wizard's category picker and from the
   home-page tab row/mega menu (both web and mobile), plus from the "create a saved search"
   category dropdown (web only — mobile has no saved-search UI). Reason: low inventory right now;
   focus is on core real estate first, with these two coming back later.
2. **Coworking promoted to its own top-level tab** (web mega menu, mobile chip row), the same
   treatment PG already has — it was previously just a sub-option nested under "Rent & Lease".

## What was deliberately left alone

Confirmed with the product owner before implementing — this is a **hide**, not a removal:

- `ListingCategory` (the Prisma enum and the shared TS union) still includes `furniture` and
  `interiors`. Postgres enum values are append-only anyway (`ALTER TYPE ... ADD VALUE`), so
  removing them would need a destructive migration — never attempted.
- Any **existing** Furniture/Interiors listings stay live and browsable at their existing URLs.
- The browse routes (`/furniture`, `/interiors`, `/{city}/furniture`, ...), `sitemap.ts`, and
  `generateMetadata`/canonical logic are all untouched — no noindex, no sitemap change, no 301s.
  The sitemap is listing-driven anyway (iterates real listings, not an enum), so it already reflects
  "fewer new ones, existing ones still appear" with no code change needed.
- Server-side DTOs (`create-listing.dto.ts`'s `LISTING_CATEGORIES`, etc.) still accept
  `furniture`/`interiors` — this is a UI-only hide, not a server-side block. Someone could in
  principle still hit the API directly and create one; that's accepted for now rather than adding
  a second enforcement layer for a "focus the UI" decision.
- Admin's boost-pricing/platform-fee settings for these categories
  (`furnitureInteriorsBoostPrice*`, `furnitureInteriorsListingFee`) are untouched — existing
  listings in these categories are still priced correctly if boosted/renewed.
- The buyer-requirement flow's Furniture/Interiors intents (`RequirementIntent`) are untouched —
  someone can still post "looking for furniture".
- **Not done**: pausing the Google Ads "Rent out Furniture" ad groups
  (`ads_disable_furniture_search_term_matching.py` names two: Metro and Other-Metro Ad Group 2.5).
  These still drive furniture-owner traffic into a picker that no longer offers Furniture — a real
  budget-leak risk worth a follow-up if this pause runs for more than a few days.

## Files touched

- `packages/types/src/postCategories.ts` — removed the "Home & furniture" group
  (`POST_CATEGORY_GROUPS`), which both `PostAdWizard`s render from directly.
- `packages/types/src/index.ts` — `HomeCategoryFilter` gained `"coworking"`.
- `packages/types/src/requirementQuestions.ts` — `RequirementIntent` is a direct alias of
  `HomeCategoryFilter`, so adding `"coworking"` there forced (correctly) a matching
  `REQUIREMENT_INTENTS`/`INTENT_CATEGORIES`/`intentOf`/`applyIntent` entry, moving `coworking` out
  of `rentLease`'s category list into its own, mirroring the home-tab change exactly.
- `packages/types/src/requirementFeed.ts` — `INTENT_SLUGS` gained the matching `coworking` slug.
- `apps/web/src/lib/homeCategories.ts` / `apps/mobile/src/components/home/categories.ts` —
  `HOME_TABS`: removed the `furniture`/`interiors` tabs, removed `coworking` from Rent & Lease's
  sub-options, added `coworking` as its own tab (icon: `building`, no further breakdown — same
  shape as "All").
- `apps/web/src/lib/seoRoute.ts` — `segmentsForHomeCategory` gained a `coworking` case.
- `apps/bff/src/listings/listings.service.ts` — `buildHomeCategoryWhere` gained a `coworking`
  early-return (`{ category: 'coworking' }`), same pattern as `pg`/`furniture`/`interiors`.
- `apps/web/src/components/home/SavedSearchesManager.tsx` — removed furniture/interiors from the
  new-saved-search category dropdown.

## Bringing them back

Reverse the `postCategories.ts`/`homeCategories.ts`/`categories.ts`/`SavedSearchesManager.tsx`
edits above. Nothing else needs to change — no data migration, no URL/SEO cleanup, since nothing
at that layer was touched.
