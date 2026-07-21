# Monetization: boosted listings, premium buyers, agent/broker Pro

## Context

Bhavano has zero revenue mechanism today — posting is free, browsing is free, and there's no
payment integration anywhere in the codebase (confirmed: no Razorpay/Stripe/billing dependency,
no payment/subscription table). The `Listing` model's `expiresAt` field already has a code
comment flagging itself as "the spot a paid-plan tier would compute a different duration"
(`apps/bff/src/listings/listings.service.ts:35`) — this feature was clearly anticipated, never
built.

Classifieds sites overwhelmingly monetize through some mix of: **(1) featured/boosted listings**
(sellers pay to rank higher / get a badge, usually for a fixed duration), **(2) premium
subscriptions** (buyer-side: alerts, unlimited contact, ad-free; seller-side: higher posting
limits, analytics, a branded storefront — think 99acres/MagicBricks/Housing.com's "premium
member" tiers, OLX's "featured ad" credits), **(3) pay-per-lead/contact-reveal**, and **(4) display
advertising** (a separate, independent revenue stream — no schema changes needed, out of scope
here, noted at the end as a future addition). This plan builds (1) and (2) — matching the user's
explicit ask ("premium ad post" = boosted listings, "premium user to view ads" = a buyer
subscription) — with a seller-side Pro tier as a third pillar, since it reuses existing
infrastructure almost for free (see Phase 3).

**Payment gateway: Razorpay** (confirmed) — the standard choice for an India-first marketplace
(UPI/cards/netbanking/wallets natively); Stripe stopped onboarding new India-based merchants in
2022, so it isn't a realistic option here.

## Data model additions (`apps/bff/prisma/schema.prisma`)

A new migration adding:

- **`Payment`** — the central transaction ledger (mirrors this codebase's existing single-source-
  of-truth style, e.g. `LoginEvent`): `id, userId, razorpayOrderId, razorpayPaymentId (unique,
  nullable until paid), amount (Int, paise), currency ("INR"), status (PaymentStatus: created |
  paid | failed | refunded), purpose (PaymentPurpose: listing_boost | buyer_subscription |
  seller_subscription), relatedId (the ListingBoost.id or UserSubscription.id this payment
  activates), createdAt, paidAt`. Unique constraint on `razorpayPaymentId` makes webhook
  processing idempotent (Razorpay can redeliver webhooks) — same upsert idiom already used for
  `User` records elsewhere in this codebase.
- **`ListingBoost`** — one row per purchased boost: `id, listingId, boostedFrom, boostedUntil,
  paymentId`. History/audit trail; `Listing` gets one new denormalized field, `boostedUntil:
  DateTime?` (nullable — null means not currently boosted), updated by the same service that
  creates the `ListingBoost` row, so the hot-path browse query (`listings.service.ts`'s `list()`)
  never needs a join to check boost status.
- **`UserSubscription`** — one row per purchased subscription period: `id, userId, tier
  (SubscriptionTier: buyerPremium | sellerPro), startsAt, endsAt, paymentId, autoRenew`. `User`
  gets two new denormalized fields, `premiumUntil: DateTime?` and `agentProUntil: DateTime?`,
  same reasoning as `boostedUntil` — cheap reads everywhere else in the app, `UserSubscription` is
  the audit trail.

No changes to existing fields' meaning — this is purely additive, consistent with how
`add_admin_moderation`/`add_listing_photos_and_variant_jobs` etc. were added as their own
migrations previously.

## Phase 1 — Boosted/Featured listings (build first — highest ROI, most standard)

**Backend** (`apps/bff/src/payments/` — new module, mirrors the existing module-per-domain
pattern):
- `POST /payments/orders` (authed) — body `{ purpose: 'listing_boost', listingId, boostDays }` →
  looks up the category-tiered price (see Pricing below), creates a Razorpay order via their
  Node SDK, inserts a `Payment` row (`status: created`), returns the order id + key for the
  frontend's Razorpay Checkout.
- `POST /payments/webhook` (public, HMAC-verified — **never trust a client-side "payment
  succeeded" callback alone**, this webhook is the only source of truth) — verifies
  `x-razorpay-signature` against the raw body using the webhook secret
  (`crypto.createHmac('sha256', secret)`), upserts the `Payment` row to `status: paid` keyed on
  `razorpayPaymentId` (idempotent), then creates the `ListingBoost` row and sets
  `Listing.boostedUntil`.
- `listings.service.ts`'s `ORDER_BY` gains a boosted-first tier ahead of the existing 4 sorts:
  `orderBy: [{ boostedUntil: 'desc' }, ...existingOrderBy]` (a listing with `boostedUntil: null`
  sorts last under `desc`, exactly right). See "Rotating boost" under Unique features for why this
  isn't a flat "highest bidder pinned forever" — same `orderBy` clause, just periodically
  re-randomizing tie order among currently-boosted listings (a `boostRank: Float` column bumped by
  a small scheduled job, reusing the `ScheduleModule` already wired into `app.module.ts`).

**Frontend (web)**: a "🚀 Boost this ad" button on `apps/web/src/app/my-listings/page.tsx`'s each
row, opening a small pricing modal (see tiers below), then Razorpay's `checkout.js` (a `<script>`
tag + `.open()` call — no server redirect needed) firing `POST /payments/orders` first. On
success, poll or just optimistically show "Boost pending" until the webhook lands (webhooks
typically land in seconds).

**Admin**: a new `apps/bff/src/admin` endpoint + `apps/admin` page listing active/expired boosts
(reuses the exact controller → DTO → service pattern already used for moderation), with a manual
grant/revoke action for support cases (e.g. a failed payment that should still get the boost).

**Pricing — tiered by category value**, not one flat fee (furniture's ₹50 floor and real estate's
crore-scale listings can't sensibly share a price point):
| Category tier | Categories | 7-day boost | 15-day boost |
|---|---|---|---|
| High-value | house, apartment, plot, commercial | ₹199 | ₹349 |
| Mid-value | coworking, pg, storage | ₹99 | ₹179 |
| Low-value | furniture, interiors | ₹49 | ₹89 |

(Exact numbers are a starting point, easy to tune — stored as a small constant map in
`packages/types`, same pattern as `PRICE_BOUNDS`.)

## Phase 2 — "Bhavano Plus" premium buyer subscription

This is the "premium user to view ads" half of the ask — reframed as concrete, buildable value
rather than a vague paywall:

- **Early-access alerts**: premium buyers get notified (reusing the existing
  `NotificationsService`/email-or-SMS infra already used for moderation notices) the moment a new
  listing matching their saved search criteria posts — before it's even visible to free users on
  the public browse pages (e.g., a 2-hour head start on high-demand categories). This is a genuine
  competitive edge in fast-moving rental markets, not a cosmetic perk.
- **Unlimited/priority messaging** + a **"⭐ Verified Buyer"** badge shown to sellers on inbound
  messages (via the existing `Conversation`/`Message` flow in `apps/bff/src/messaging/`) — reduces
  seller time wasted on unserious inquiries, a two-sided value prop rather than only monetizing
  sellers.
- Subscription purchase flow: same `payments/orders` endpoint, `purpose: 'buyer_subscription'`,
  monthly (₹99) or annual (₹899) — sets `User.premiumUntil`.
- A `/account/premium` page (web) for managing/renewing, mirroring the existing profile page
  pattern.

## Phase 3 — Agent/Broker Pro subscription (cheapest to build — reuses existing infra)

- Raises or removes the existing posting-frequency cap: `RateLimitSetting`
  (`apps/bff/src/admin/`) already models exactly this per-role/per-window limit — a Pro
  subscriber's rate-limit check just reads `User.agentProUntil` before applying the free-tier
  limit. No new rate-limiting logic needed, just a bypass condition.
- A public **agent storefront** page (`/agent/[userId]` or similar) listing all of that agent's
  active listings under one branded profile — valuable for the brokers who evidently already use
  this platform (the existence of `coworking`/`commercial`/`pg` categories suggests business/agent
  usage, not just individual homeowners).
- ₹499/month — priced well above the buyer tier since it's a business tool, not a consumer perk.

## Unique features for this website (the differentiators, not a generic OLX clone)

1. **Rotating boost, not pay-to-permanently-pin** — boosted listings share the top slots on a
   fairness rotation rather than one seller with the deepest pockets squatting position #1
   forever. A quality/trust differentiator worth calling out in marketing copy.
2. **Category-tiered boost pricing** — a ₹49 furniture boost and a ₹199 apartment boost, not one
   flat fee that's either exploitative for cheap categories or too cheap to matter for expensive
   ones.
3. **Early-access alerts for premium buyers** — genuinely useful in a hot rental/housing market,
   not just a cosmetic "premium" label with no real benefit.
4. **Two-sided premium** — both sellers (boost/Pro) *and* buyers (Bhavano Plus) have a paid tier,
   each with real, distinct value — most classifieds only monetize the seller side.
5. **Verified Owner badge** tied to ID verification (not just payment) — reinforces the site's
   existing "Verified listings" tagline (`apps/web/src/app/layout.tsx`'s `SITE_DESCRIPTION`) as an
   actual trust mechanism, not just marketing copy. (Flagged as a Phase 4/future item — needs an
   ID-upload + admin-review flow, a bigger lift than the payment-gated tiers above.)

## Explicitly out of scope for this plan

- **Display/banner advertising** (Google AdSense or direct advertiser sales) — an independent
  revenue stream requiring zero schema changes, can be layered into `apps/web` ad slots any time;
  not part of this build.
- **Typesense-based ranking** — Typesense is provisioned in `docker-compose.yml` but never wired
  into `apps/bff` at all; the boosted-sort design above works entirely at the Postgres/Prisma
  level and doesn't depend on building that integration out.
- **Mobile app parity** for the boost-purchase/subscription UI — web-first; `apps/mobile` gets
  read-only awareness (e.g., showing a "Featured" badge) but not a purchase flow in this pass.
- **ID-verification workflow** (Unique feature #5) — sketched as a future Phase 4, not detailed/
  built here.

## Verification

- `pnpm -w typecheck` after the new Prisma models + `@bhavano/types` price-tier constants.
- Local: a Razorpay **test-mode** account (free, no real KYC needed for sandbox) — create a boost
  order, complete checkout with Razorpay's documented test card/UPI, confirm the webhook fires
  (Razorpay CLI has a `razorpay-cli webhook` local-forwarding tool, similar to Stripe's) and
  `Listing.boostedUntil`/`Payment.status` update correctly.
- Confirm a boosted listing actually sorts ahead of non-boosted ones on `/`, and that the
  rotation job (Phase 1) reshuffles tie-order among multiple simultaneously-boosted listings
  without ever demoting them below unboosted ones.
- Confirm a premium buyer's saved-search alert fires before the listing appears in a logged-out
  browse of the same city/category.
- Confirm `RateLimitSetting`'s existing enforcement correctly skips the check entirely for a user
  with `agentProUntil` in the future.

## Critical files

- `apps/bff/prisma/schema.prisma` (new models/enums), new migration folder
- `apps/bff/src/payments/` (new: `payments.module.ts`, `payments.controller.ts`,
  `payments.service.ts`, Razorpay order-create + webhook-verify logic)
- `apps/bff/src/listings/listings.service.ts` (boosted-first `ORDER_BY`, boost-rotation job)
- `apps/bff/src/admin/` (boost management endpoint, mirroring existing moderation pattern)
- `packages/types/src/` (new `PaymentPurpose`/`SubscriptionTier` types, boost-price-tier constants
  alongside the existing `priceBounds.ts`)
- `apps/web/src/app/my-listings/page.tsx` (Boost button), new `apps/web/src/app/account/premium/`
  page, new `/agent/[userId]` storefront route
- `apps/bff/src/notifications/` (early-access alert hook, reusing existing service)
