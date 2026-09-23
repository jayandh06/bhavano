# Post-login routing and seller attention

## Status: Phase 1 + pending publish recovery (2026-09-23)

Related: [`listing-platform-fee-and-checkout-gate.md`](listing-platform-fee-and-checkout-gate.md) (`pending_checkout` listings).

## Goals

- After a **generic** login (header Login, no `redirectTo` / `onSuccess`), send sellers to **My listings** only when they must finish **publish checkout**.
- Do **not** redirect everyone who has listings — buyers and dual-role users keep landing on browse/home.
- Expose lightweight counts for Phase 2 home/account banners.

## Product rules

| Login context | Destination |
|---------------|-------------|
| `onSuccess` (PostAdWizard, Message, etc.) | Unchanged — resume in place |
| `redirectTo` (e.g. `/post`) | Unchanged |
| Generic login + one pending checkout | `/my-listings?openPublishCheckout=<id>` (auto-opens publish payment modal on web) |
| Generic login + multiple pending | `/my-listings` (row buttons + “Payment incomplete” badges) |
| Generic login otherwise | Stay on current page |

Unread messages → **Messages** tab/badge only (no auto-redirect in Phase 1).

## API

`GET /users/me/seller-attention` (auth) → `SellerAttentionDto`:

- `pendingCheckoutCount` — `publishState: pending_checkout`
- `pendingCheckoutListingId` — newest pending listing id when count is exactly 1
- `activeListingCount` — `status: active`
- `expiringWithinDaysCount` — active listings with `expiresAt` within `LISTING_RENEW_ATTENTION_WINDOW_DAYS` (7), same window as My listings renew UI

## Implementation (Phase 1)

- BFF: `ListingsService.getSellerAttention`, wired in `UsersController`
- Types: `SellerAttentionDto`, `LISTING_RENEW_ATTENTION_WINDOW_DAYS` in `@bhavano/types/listingLimits`
- Web: `resolvePostLoginRedirectAction` + `AuthGateProvider.onLoginSuccess`
- Mobile: `fetchSellerAttention` + `HomeSheetsProvider.onLoginSuccess` → `/my-listings` (with `openPublishCheckout` when unambiguous)

## Pending publish recovery (shipped with Phase 1)

- Web **My listings**: `pending_checkout` badge, **Complete payment to publish**, `PublishCheckoutRecovery` modal (`BoostPlanSelector` + `listing_publish` Razorpay — not `openBoost`).
- Deep link: `?openPublishCheckout=<listingId>` (`AutoOpenPublishCheckout`).
- Mobile: same badge/button; opens website checkout URL (iOS App Store constraint); auto-open when query param present after login redirect.

## Phase 2 (not shipped)

- Home/account banner using full `SellerAttentionDto` (expiring soon, pending checkout copy)
- Optional user preference “open My listings after login” (default off; must not override pending checkout)

## Follow-ups

- Google **full-page** sign-in fallback (popup blocked): cookie + layout one-shot redirect using the same server action
