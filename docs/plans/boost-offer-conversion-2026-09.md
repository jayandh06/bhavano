# Boost / Instant Alerts offer: what the data says and how to raise uptake (2026-09-28)

## Status: analysis and proposals only — nothing changed

Read-only queries on production (payments, listings, conversations, views) plus a read of the offer
UI and design docs. Companion to [`google-ads-performance-analysis-2026-09.md`](google-ads-performance-analysis-2026-09.md),
which found that only ~6% of ad-acquired sign-ups pay anything.

Related: [`boost-instant-alerts-preview-selector.md`](boost-instant-alerts-preview-selector.md),
[`instant-alerts-paid-message-notifications.md`](instant-alerts-paid-message-notifications.md),
[`monetization-boosted-listings-premium-tiers.md`](monetization-boosted-listings-premium-tiers.md),
[`homepage-category-mix-and-boost-page-cap.md`](homepage-category-mix-and-boost-page-cap.md),
[`listing-platform-fee-and-checkout-gate.md`](listing-platform-fee-and-checkout-gate.md).

## How the offer works today

- **Where it appears:** on the post-ad **success screen** (`BoostBundlePicker`, web; card on mobile)
  and from My Listings. `showSelectorOnPreview = false`, so the Preview-step placement is switched
  off. iOS cannot pay in-app (Apple 3.1.1) and is sent to the website.
- **What it says:** "Reach more buyers, faster — 50% OFF", two bullets ("gold Featured badge, ranked
  above regular listings"; "add Instant Alerts to get emailed when someone messages"), then Boost
  7 days / 15 days and an "Add Instant Alerts" tick. No numbers, no proof.
- **Prices:** property boost ₹99 (7 d) / ₹179 (15 d), lower for PG/coworking and furniture tiers;
  Instant Alerts ₹25. A 50% promo code **BHAVANO-SEP** is auto-applied.
- **Follow-up:** none automated. Only an admin-sent promotion email exists.
- **All platform (publish) fees are ₹0.**

## What the data shows (since 2026-09-10 unless stated)

| Measure | Number |
|---|---|
| Listings posted | 435 |
| Started a boost checkout | 34 (7.8%) |
| Paid a boost | 19 (4.4%) |
| Boost payments that used the promo code | 19 of 20 paid |
| Checkout completion with promo (₹50–₹100 price) | 19 paid / 32 started (59%) |
| Checkout completion at the old ₹199+ price, no code | 1 paid / 8 started (12%) |
| Paid boosts started within 10 minutes of posting | 18 of 19 |
| Paid boosts started later | 1 of 19 |
| Bundle (Boost + Instant Alerts) share of paid boosts | 7 of 20 (35%) |
| Instant Alerts bought on its own | 0 |
| Average amount per paid boost (after promo) | ≈ ₹77 |
| Listings that received ≥ 1 enquiry | 149 of 435 (34%) |
| Boost buyers who had an enquiry before buying | 1 of 19 |

**Visibility gap (the strongest selling point).** For listings posted 09-10 → 09-20, first 7 days:

| | Listings | Views | Enquiries |
|---|---|---|---|
| Not boosted | 340 | 1.6 avg | 0.29 avg |
| Boosted | 10 | 18.9 avg | 0.80 avg |

About 12× the views. Caveats: only 10 boosted listings; boosted sellers may also share their links;
views are de-duplicated by viewer. Re-measure before quoting in copy and keep the wording as a range.

**Active now:** 466 active listings, 14 boosted, 9 with Instant Alerts. The featured tier is capped at
8 guaranteed slots across the first 2 pages (`BOOST_FEATURED_CAP`); boosts beyond that keep the badge
but get no guaranteed rank.

**Abandoned checkouts since 09-15:** 13 users (11 with a phone number, 3 with an email) started a boost
and never paid. `Payment.status = failed` is never written — every abandoned order is still `created` —
so we cannot tell a failed payment from a closed dialog.

## What this means

1. **Price is the biggest lever seen so far**, and it is about to change: the 50% code **expires
   2026-09-30 (midnight IST)**. From 1 Oct the effective price doubles (₹49.50 → ₹99 for 7 days,
   ₹89.50 → ₹179 for 15 days). At the old ₹199 the completion rate was 12%. Expect the boost rate to
   fall unless something replaces the code.
2. **Almost all boosts are impulse buys at the moment of posting.** Nobody comes back later, and
   nobody buys because of proof of demand. The offer has only one moment today.
3. **The seller's own experience is the argument.** An unboosted ad averages under 2 views in its first
   week. Today's offer never says that.
4. **The ceiling is limited.** ₹99–₹179 add-ons at, say, 15% of 435 listings ≈ ₹8–9k per 18 days
   against ≈ ₹54k of ad spend. Better Boost conversion is worth doing, but it cannot pay for the ads on
   its own; subscriptions, Agent Pro and contact-reveal credits matter more for that.

## Recommendations

1. **Decide the promo before 1 Oct (owner decision).** Either extend BHAVANO-SEP, or replace the
   calendar expiry with a per-user "first boost 50% off, valid 48 hours after you post" (needs a small
   build: expiry relative to the listing's creation time; per-user limit is already 1). A per-user
   clock gives urgency without a cliff for everyone.
2. **Put the proof on the screen.** Replace the two generic bullets with the visibility numbers
   ("Ads without a boost average under 2 views in their first week; boosted ads about 19"), the
   Featured badge, and how long it lasts. Keep the number current.
3. **Add a second moment, driven by what the ad is doing:**
   - ~24 h after posting, if the ad has ≤ 2 views: "Your ad has had 1 view. Boost it to appear at the top."
   - At the **first enquiry**: "Someone messaged you — add Instant Alerts (₹25) so you never miss one."
   - One reminder to sellers who started a checkout and left (13 users now), via the channels we
     already use, with sensible frequency limits.
4. **Find out why checkouts are abandoned.** Record `payment.failed` / dialog-dismissed events so
   `failed` means something; look at Razorpay's failure reasons for the 19 abandoned orders (owner
   has dashboard access). Check the mobile-web UPI path and the iOS redirect.
5. **Show Instant Alerts to the people who need it.** A seller with the app already gets message push
   for free, so the paid offer fits web-only sellers best. Consider showing it there first, and testing
   it pre-ticked in the bundle (₹25 is low, 35% already add it).
6. **Test the Preview-step placement** (`showSelectorOnPreview`, admin toggle already exists) — but as a
   separate step, not the same week as the promo change (it is a global switch, so it can only be run
   one after the other, and any two changes at once cannot be told apart). Measure boost rate and
   publish completion.
7. **Do not oversell placement.** With the 8-slot cap already exceeded (14 boosted), say "Featured
   badge and priority placement", not "top of results", and decide whether the cap should be per city or
   category before pushing boost volume.
8. **Attract sellers who value visibility at the ad stage:** add a small paid-intent keyword test
   ("advertise property online", "promote property listing") and judge it on payers per ₹, not sign-ups.

## Not recommended

- Removing "free" from ad keywords (see the ads doc): the free-heavy Generic group had the *highest*
  payer rate (7 of 79).
- Raising boost prices during the promo change.
- Adding paywalls at publish: fees are ₹0 by decision, and publish-fee checkouts earlier in the
  month converted poorly.

## Question: send the boost nudge as an in-app "Bhavano Admin" message instead of WhatsApp/email? (2026-09-28)

What exists: an admin↔owner thread type (`ConversationType.moderation`, one per listing) that already
appears in the owner's unified inbox labelled "Bhavano Admin"; message bodies linkify URLs. The
admin tool `POST /admin/listings/notify-boost-promotion` already sends a Boost promotion by
email/WhatsApp to selected owners (with a cooldown).

**Reach is the problem.** Of 184 ad-acquired sellers who posted since 09-10, only **13 (7%)** are
recorded coming back on a later day, and **0** used the mobile app. (Web analytics under-links
returning logged-in visitors, so 13 is a lower bound.) They post from mobile web and leave, so an
in-app message would sit unseen, and web has no push. Of the 13 sellers who abandoned a boost
checkout, 11 have a phone number and only 3 have an email.

Verdict: add the in-app message as an **extra** channel, not a replacement.
- Good for: sellers who return, app users (push), and the automated "first enquiry" / "low views"
  nudges, at no per-message cost.
- Keep WhatsApp for the one-off reminder to the 13 abandoned checkouts (small volume).
- Do not reuse the `moderation` thread: a sales message in the same thread as a flagged-listing
  conversation could look like a warning and mixes with real moderation history. Add a separate
  type (e.g. `announcement`) with its own label, and decide whether it counts toward the unread
  badge.

**Update 2026-09-28:** the in-app message (manual button on the Listings page, tracking in the
"Boost promo" column, and a switched-off automatic nudge) is built — see
[`admin-in-app-boost-message.md`](admin-in-app-boost-message.md). The message shows as "Bhavano Admin";
the sending admin's name is never shown.

## Pricing-structure questions (2026-09-28) — recommendations, nothing changed

**Instant Alerts as a separate ₹25 product.** Weak as a standalone: 0 standalone purchases; 7 of 20
paid boosts included it (₹12.50 each after the promo) — about ₹90 of revenue in total. App users already
get message push free, and the original design (`contact-owner-message-notifications.md`) was
free-for-everyone before it was made paid. It also matters to marketplace health: a buyer's message
to a seller who never sees it is a lost lead for both sides. Recommendation: fold it into Boost as a
built-in benefit (removes a checkbox and a decision, raises what the boost is worth), and separately
decide whether a basic email alert should be free for every seller. Watch WhatsApp per-message cost;
alerts are already debounced to one per unread burst.

**7 / 15 / 30 days.** 13 of 19 buyers took 7 days (the cheapest). A 30-day option (about the whole
listing life; ≈ ₹279–329, i.e. ~₹10/day against ₹14 and ₹12) adds a high anchor and makes 15 days look
like the middle choice. Low risk; the 8-slot featured cap and rotation already limit how long any one
ad holds a slot. Volumes are too small (≈ 8 boost decisions a week) for a statistically clean test.

**Auto-applied discount vs typing the code.** Keep it auto-applied. The measured effect of the
discount is large (12% → 59% completion) and checkout already loses ~40%; a code box adds a step and
sends people off to hunt for codes. The "feel" of a discount comes from showing it: the struck-through
price, "50% off — you save ₹X", the applied-code chip, and a per-user countdown (see the 48-hour
personal offer). One caution on anchoring: a struck-through price must be a price that was really
charged recently (₹199 was, until mid-September); a permanent fake "was" price is misleading and can
breach advertising rules. Run real, time-limited offers instead.

**Update 2026-09-28:** the owner approved folding Instant Alerts into every boost and adding a 30-day boost at ₹299 with the saving shown. Built — see [`boost-30-day-and-included-alerts.md`](boost-30-day-and-included-alerts.md).
