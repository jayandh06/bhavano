# Operator plan for PG and coworking: monthly subscription with Featured (implementation plan)

Status: plan, 3 Nov 2026. Nothing built. This turns the ideas in [`pg-coworking-monthly-plans.md`](pg-coworking-monthly-plans.md) into a build order, using what the
code already has. Background: [`growth-and-monetization-analysis-2026-10.md`](growth-and-monetization-analysis-2026-10.md),
[`product-pricing-tiers.md`](product-pricing-tiers.md), [`featured-ad-benefits-and-media-limits.md`](featured-ad-benefits-and-media-limits.md),
[`broker-paid-bundles.md`](broker-paid-bundles.md).

## The one-line pitch

"Pay once a month per property. Your PG or coworking space is Featured all month, never expires, tells you the moment someone asks, and you get a
weekly report of who looked." It replaces buying a 30-day Featured every month by hand.

## What the code already gives us (reuse, don't rebuild)

| Need | Already there | Notes |
|---|---|---|
| Featured placement | `Listing.boostedUntil`, `ListingBoost`, boost rotation, 30-day option (PG/coworking/storage one-off ₹299, admin-editable) | Capped at 25% of a results page (`BOOST_FEATURED_CAP_PER_PAGE_FRACTION`): many subscribers share that space, see Risks |
| Instant alerts on every enquiry | `ListingInstantAlert`, `instantAlertsUntil`, included with every Featured | WhatsApp / SMS / app / email choice already built |
| Subscription records | `UserSubscription` (tier, startsAt, endsAt, paymentId, `grantReason`), `SubscriptionTier` (`buyerPremium`, `agentPro`, `sellerSlotPack`) | **Prepaid periods, not auto-renewing** on web: a month is paid for, then renewed by hand. Apple's are auto-renewing. Admin can grant with a reason (trial) |
| Zero-price grants | The Pro monthly boost credit and referral credits create free Payment + `ListingBoost` rows | The pattern for "Featured included in the plan" |
| Elevated media | Featured/Agent Pro: more photos, 3 videos x 120 s, rolling out 12 photos / 5 x 180 s | Featured already unlocks it |
| Performance numbers | Featured performance report (views, enquiries, reveals vs last 7 days), admin listing performance, daily activity digest job | Basis of the weekly report |
| Renewal and expiry messages | Featured-expiry reminder job (3 and 1 days), in-app Bhavano Admin message, push | Same pattern for plan renewal |
| Claiming imported listings | `/claim/<id>` with phone match; 293 coworking and 243 PG listings waiting | The trial hook |
| Operator page | `/agent/[userId]` storefront with a Pro badge | Becomes the operator page |
| Leads for owners | Requirements feed and match job (seekers who asked for a PG or desk), Featured seeker-contact | A strong benefit nobody else gives free |
| PG and coworking fields | PG: sharing types, gender, meals, rooms/beds available, gate time, notice period. Coworking: seat types, total seats, day-pass price, access hours, meeting room | Availability and day-pass data exist |

## The product

**Name:** "Bhavano Operator" (shown as "for PG owners" and "for coworking spaces").

**Unit:** one subscription covers N properties (like Agent Pro's units): the operator picks which listings are covered and can swap one a month.

**Price (to confirm):** PG **₹499 a month per property**, coworking **₹799 a month per location**; each extra property after the third 50% off.
Compare: one-off 30-day Featured is ₹299 for both, so the plan costs ₹200 to ₹500 more for everything below. **Founding offer:** first 20
operators keep ₹399 / ₹599 for 12 months. Prices go in the admin Plans settings like the others.

### What is included

| # | Benefit | What the operator sees | Build |
|---|---|---|---|
| 1 | **Featured all month** | Featured badge and top rotation on the PG or coworking pages of its locality, for the whole paid period | Reuse boost (`boostedUntil`), synced from the subscription |
| 2 | **Never expires** | The listing renews itself while the plan is active; no 30-day repost | Extend `expiresAt` in the sync job |
| 3 | **Instant alerts** | WhatsApp/app message the moment someone messages, saves with interest or reveals the number | Reuse (included with Featured) |
| 4 | **Weekly report** | Monday message: views, saves, reveals, enquiries vs last week, and "3 people asked for a PG in Adyar this week" | New weekly job on the performance report and digest code |
| 5 | **Vacancy line** | Card badge "3 beds left" (PG) or "2 desks free / day pass" (coworking), with a monthly "still 3 beds? reply with the number" nudge | Small badge from `roomsAvailable` / seat fields; reminder job; reply handling later |
| 6 | **Requirement leads** | PG and desk requests from seekers in its area, with the seeker's consent to be contacted | Reuse requirements feed and match job, filtered to the operator's categories |
| 7 | **Operator page** | One page with all its properties, a "Bhavano Operator" badge, reviews later | Reuse `/agent/[userId]` with an operator variant |
| 8 | **More media** | 12 photos, 5 videos of 180 s | Already unlocked by Featured |
| 9 | **Visit / tour request** | "Book a visit" (PG) or "Book a tour / day pass" (coworking) button that sends the operator a lead card | New small form on the listing page |
| 10 | **Share kit** | WhatsApp-ready poster, QR code and tracked link per property | Extend the existing share panel |
| 11 | **Faster review, trust badge** | New ads and edits reviewed first; "Quick responder" badge from response time | Moderation queue order; badge from message response data |

**Not promised:** a number of leads. Until Bhavano delivers enquiries to this segment (2 PG enquiries and 1 coworking enquiry in 30 days on ~580 listings)
the plan sells visibility and tooling, so selling it before demand exists will fail (see Order).

## How it works

- **Data:** new tier `operatorPlan` on `SubscriptionTier`; `UserSubscription.units`; a join table `OperatorPlanListing (subscriptionId, listingId)` for the covered
  properties. Price settings next to the existing ones. One Prisma migration.
- **Sync job (hourly):** for every active operator subscription, make each covered listing Featured and alert-enabled until `endsAt` (zero-price `Payment` +
  `ListingBoost`, `ListingInstantAlert`, like the Pro credit), extend `expiresAt`, and when the plan ends or a listing is swapped out, end the
  Featured and let the listing expire normally. This job is the heart of it, and the place for most tests.
- **Buying:** web and Android through Razorpay (the same order and webhook path as Agent Pro); page `/premium/operator` plus landing pages for PG owners and for
  coworking. **Not sold in the iPhone app** in v1: Apple requires In-App Purchase for subscriptions bought there, needs a new product and another review
  cycle, and the app must not point to the web purchase (guideline 3.1.1).
- **Renewing:** prepaid months, with a reminder 5 and 1 days before the end carrying a one-tap Renew link (same job pattern as the Featured-expiry reminder). Real
  auto-renew (Razorpay Subscriptions / UPI AutoPay) is Phase 3: needs a mandate flow and a cancel screen.
- **Trial:** on claiming an imported PG or coworking listing, 14 days of the plan are granted free (`grantReason: operator_trial`, no card), with the report on days
  3, 7 and 10 and a "continue" message on day 10 quoting the numbers. After the trial the ad stays live, only the Featured and extras stop.
- **Admin:** screen to see operator plans, grant or extend (with a reason), and a pilot cohort view (claimed, trial, paid, churned).

## Phases

| Phase | What | Effort | Gate |
|---|---|---|---|
| 0, now, no code | **Pilot by hand** with 20 operators (Chennai/Adyar PGs, Bengaluru coworking): 30 days free Featured through a 100% admin discount code, a weekly report sent as an admin message, then ask. Meanwhile build demand (locality pages, ads, saved-search alerts) | 1 to 2 days of ops | 20+ enquiries a month in the segment, and at least 5 of the 20 say they would pay |
| 1 | Operator plan: tier, units, sync job, never-expires, buying (web, Android), renewal reminders, trial on claim, admin screen, tests | about 8 to 10 days | Pilot gate passed |
| 2 | Weekly report, vacancy badge and reminder, requirement leads, operator page, visit/tour request | about 8 to 10 days | 5+ paying at 499 or more within 6 weeks |
| 3 | Auto-renew (UPI AutoPay), chain pricing, iPhone In-App Purchase, annual plan, pay-per-lead alternative, extension guarantee | later | Churn and demand known |

## Success and kill criteria

- **Pilot:** at least 5 paying within 6 weeks at ₹499 or more; trial to paid at least 25%; the pilot operators get more enquiries than a normal ad.
- **Plan:** monthly churn under 20%; enquiries per covered listing above the segment average; recurring revenue ₹10K a month from 20 operators (₹50K from 100).
- **Stop or rethink** if trial to paid is under 10% after 30 operators, or if covered listings get no more enquiries than uncovered ones (then the product is
  not delivering and should not be charged for).

## Risks and open points

- **Demand is the product.** Without enquiries nothing here holds. Phase 0 exists to find out before building.
- **The 25% Featured cap.** Many subscribers could crowd one locality's page and push out one-off Featured ads. Decide: a separate operator share of the cap, or
  rotate fairly inside it. Check real subscriber counts per locality before launch.
- **Cannibalising one-off Featured** (₹299 a month): the plan has to be clearly more, not a discount on the same thing.
- **GST and invoices:** decide whether prices include GST and how invoices are issued (Razorpay) before the first charge.
- **Fake or duplicate operators:** claiming needs the phone match; a plan on an unclaimed import must not be possible.
- **Wording:** "Verified" and "Quick responder" badges must be earned by a real check; no lead guarantees in copy.
- **iPhone:** the plan stays hidden in the iOS app until the In-App Purchase product is approved.

## Decisions needed from the owner

1. Price per property (suggested ₹499 PG / ₹799 coworking) and the founding offer.
2. Per property or one price per operator account.
3. Free 14-day trial at claim, yes or no.
4. Should "never expires" (auto-renewing the listing) be included? (suggested yes).
5. Run the Phase 0 pilot first (recommended), or build Phase 1 straight away.
