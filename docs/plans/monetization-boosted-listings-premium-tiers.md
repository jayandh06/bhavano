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
   **Update (2026-09-13)**: the boosted-first tier is now capped at 8 guaranteed "featured" slots
   across the first 2 pages (`BOOST_FEATURED_CAP` in `listings.service.ts`) rather than unbounded
   — see docs/plans/homepage-category-mix-and-boost-page-cap.md's Part 2. Once boost adoption
   exceeds that, the cap (not this doc's original "boosted always sorts first, full stop") is what
   actually governs visibility; listings boosted past the cap still show the Featured badge but
   compete on their own merits rather than getting a guaranteed top slot.
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

## Admin-sent Boost / Instant Alerts promotion (built 2026-09-17)

Boost and Instant Alerts both existed, and both waited for the seller to go looking for them.
Nothing ever told an owner their live ad could be lifted. This closes that gap without adding a
new surface for the owner to learn.

- **Where it is.** The listings dashboard's bulk bar: select ads, press **Send boost promo**. The
  bar already held the posted-notification resend, so this is a second button on a control admins
  use, not a new screen. Row selection widened to every listing — it was limited to ads still
  missing the posted acknowledgement, which was right while that was the only action.
- **An owner with both an email and a phone gets both**, unlike every other notification in
  `NotificationsService`, which is email-else-WhatsApp. Those are confirmations of something the
  reader just did, where a second copy is noise; this is an offer, and an owner who reads only one
  of the two channels would otherwise never see it. The per-listing cooldown is what stops "both"
  becoming "more often", and the notification log gets one row per channel so the cooldown query
  still answers "has anything gone out recently" unchanged.
- **What the owner gets.** Two buttons and no links in the prose: **Boost my ad — ₹100** and
  **Boost + Instant Alerts — ₹112**. `renderEmail` grew support for stacked buttons for this (first
  filled, rest outlined); a promotional message with URLs scattered through its sentences reads
  like a phishing attempt, and the two things worth choosing between deserve to be the two things
  you can click.
- **Where the buttons go.** `/my-listings?openBoost=<id>`, and the same with `&withAlerts=1`. Both
  open the **post-ad picker** — durations, an Instant Alerts checkbox, one combined payment — so
  the seller can still change their mind about either before paying.
- **The offer is quoted from the live discount row.** `ACTIVE_PROMO_CODE` (`BHAVANO-SEP`) moved into
  `@bhavano/types/promoCode`, since web, mobile and now the BFF all need the same string. The
  message is sent in one of two wordings: `email/boost-promotion-offer/` when that code is active
  and unexpired — discounted price beside the normal one, the percentage, and the date it ends, in
  IST — and `email/boost-promotion/` when it is not. Two folders rather than conditional wording,
  because `{{}}` substitution has no conditionals and a half-empty offer sentence is worse than
  either version.
- **Prices come from the live settings and the live discount**, never the wording.
  `promoPriceFor` rounds the way `previewBoostPricing` rounds, so the figure in the email is the
  figure on the screen its buttons open. Redemption caps are deliberately not pre-checked: the
  per-user cap cannot be answered for a batch in one query, so checkout stays the authority — a
  seller who already used the code sees full price there, exactly as they do on the post-ad screen.

- **Copy is deliberately short** — four short paragraphs, the detail lives on the screen the
  buttons open. The first draft explained both products at length; nobody reads a sales email
  twice as long as the thing it is selling.
- **The Pay button no longer depends on the price having loaded.** Arriving from the email while
  logged out, logging in, and landing on the picker put the preview server action a beat ahead of
  the session refresh: it resolved as "You must be logged in", the failure was swallowed, and
  `disabled={pending || !option}` left the only button on the screen dead with nothing explaining
  why. Paying never needed the price (the amount comes from the order the BFF creates), so only
  `pending` disables it now; the preview retries once after a short delay and offers a visible
  Retry after that, and the button reads "Continue to payment" rather than showing "Pay" beside an
  empty space.

### The pricing split this uncovered

The Boost modal reached from My Listings priced boosts itself with `boostPriceFor` and ordered with
no discount code, while the post-ad picker previewed prices with the promo auto-applied. **The same
7-day boost cost ₹199 from one route and ₹100 from the other**, and only the second could bundle
Instant Alerts at all — two payments from anywhere else. `BoostProvider` now renders
`BoostBundlePicker` itself, so there is one screen, one price and one combined checkout wherever a
seller enters. Fixing that was a precondition for the promotion: quoting ₹100 in an email whose
button opened a ₹199 screen would have been a lie.
- **Restraint is the design.** This is marketing to people who have already trusted us with a
  listing, so: a 14-day per-listing cooldown (not a once-ever gate — a second nudge weeks later is
  fair, twice in a week is spam); live ads only, since selling a boost for a sold or expired ad is
  indefensible; and nothing at all to an ad that already has both boost and alerts. Each skip is
  reported per listing in the admin summary, so "nothing sent" is never silent.
- **The WhatsApp half goes through MSG91's `ad_boost_instant_alert`** (approved 2026-09-18), not
  the Meta-direct `WhatsappProvider` the rest of `NotificationsService` falls back to. The template
  shape decided that: it carries **two** dynamic URL buttons — Boost, and Boost + Instant Alerts —
  and `WhatsappProvider.sendTemplate` takes a single positional button suffix, so it could only
  ever have sent the first. Two buttons is exactly what this message wants, matching the email.
  - Sends once `MSG91_WHATSAPP_BOOST_PROMO_TEMPLATE_NAME` and
    `MSG91_WHATSAPP_BOOST_PROMO_NAMESPACE` are set (its own namespace var, not another template's —
    MSG91 has issued this account different namespaces per template before). Until then a
    phone-only owner is reported as skipped, not as a send that never happened.
  - **Its four body values are positional and unnamed**, so their meaning is their order:
    `body_1` name, `body_2` ad title, `body_3` boost price, `body_4` bundle price. MSG91 validates
    the count, never the meaning, so a wrong order sends a nonsense message perfectly successfully.
    The order is written down in `notification-templates/whatsapp/boost-promotion/README.md` and
    pinned by tests in `msg91.provider.spec.ts`.
  - **Four slots leave no room for the offer's terms.** The discount percentage and end date the
    offer email carries have nowhere to sit, so a WhatsApp recipient gets the discounted price
    without the explanation around it. Unlike the earlier Meta-direct draft, this means the
    WhatsApp path is *not* gated on a promo being live — the prices it sends are simply whatever
    the checkout will charge.
  - **The buttons send the bare listing id, and `/checkout` forwards.** The first version sent a
    path, assuming the bare-domain base `claim_listing` has. A real send on 2026-09-18 proved
    otherwise: this template's base is `https://www.bhavano.com/checkout?plan=boost&ad=`, so the
    button resolved to `…/checkout?plan=boost&ad=my-listings?openBoost=<id>` — a link to nothing.
    A template's button base cannot be edited (a change means a new template and a fresh approval),
    so `/checkout` was made a real route (`apps/web/src/app/checkout/page.tsx`) that redirects to
    `/my-listings?openBoost=<id>[&withAlerts=1]`. It also reads the older suffix form, so buttons
    in already-delivered messages keep working. 7 parse checks.
    - The lesson generalises: a dynamic-URL button's base is invisible from the code that fills it,
      and the message looks perfect either way. Send one and open the button — that is the only
      way to know.
  - `whatsapp_create_boost_promotion_template.py` is deleted: it submitted a *Meta-direct* template
    that this one supersedes, and leaving it would invite creating a duplicate.
- 22 admin-service checks: what it refuses to send, and the offer/no-offer pricing either way.

## Explicitly out of scope for this plan

- **Display/banner advertising** (Google AdSense or direct advertiser sales) — an independent
  revenue stream requiring zero schema changes, can be layered into `apps/web` ad slots any time;
  not part of this build.
- **Typesense-based ranking** — Typesense is provisioned in `docker-compose.yml` but never wired
  into `apps/bff` at all; the boosted-sort design above works entirely at the Postgres/Prisma
  level and doesn't depend on building that integration out.
- **Mobile app parity** for the boost-purchase/subscription UI — web-first; `apps/mobile` gets
  read-only awareness (e.g., showing a "Featured" badge) but not a purchase flow in this pass.
  **Update**: the boost half landed, **Android only** —
  `apps/mobile/src/components/home/BoostModal.tsx`, reachable from the post-ad success screen.
  Same `POST /payments/orders` call web's `BoostProvider` makes (the backend was already
  payment-client-agnostic — activation comes from the Razorpay *webhook*, not the checkout call
  succeeding, so it never needed to know or care which SDK opened checkout);
  `react-native-razorpay` (a new native dependency, needs an EAS dev-client rebuild before it
  runs) opens the native checkout sheet in place of the web JS SDK.
  **iOS deliberately does not get this** — `docs/plans/ios-app-store-release.md`'s own "In-app
  purchases" note already flagged exactly this: a third-party processor selling "digital
  promotion of a listing" inside the app is a Guideline 3.1.1 rejection. `PostAdWizard.tsx`
  branches on `Platform.OS` — iOS opens the website's `/my-listings` instead (the original
  browser fallback, kept for that one platform), Android opens `BoostModal`. Real Apple IAP
  (StoreKit) for boosts hasn't been built; until it is, this is the split. Android has its own
  equivalent Play Billing policy for digital goods — not addressed here either, kept as-is for
  now since enforcement/timeline differs from Apple's.
  **Update 2: subscriptions now match.** "Plans" in `HomeDrawer`/`UtilityBar` was a browser
  hand-off to the website's `/premium`; it's now a native screen (`apps/mobile/app/plans.tsx`) —
  a card per tier carrying its own price, feature list and CTA, so comparing and buying happen in
  the same place (mirroring the website's own `/premium` rework, which dropped its
  compare-vs-subscribe tab switcher for the same reason). Prices come from `fetchPlanPricing`
  (admin-editable, see admin-manage-plans-pricing.md) over the bundled defaults.
  The CTA carries the identical `Platform.OS` split as boosts above: Android opens
  `SubscribeModal.tsx` (native Razorpay, same `POST /payments/subscriptions` web's
  `SubscribeButton` calls, same webhook-driven activation), iOS opens `/premium#<tier>` on the
  website. iOS never mounts the modal. If anything, Guideline 3.1.1 applies *more* plainly to a
  subscription than to a one-off boost, so this split isn't optional there.
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
