# Boost: 30-day option, and Instant Alerts folded into every Boost

## Status: built 2026-09-28

Follows [`boost-offer-conversion-2026-09.md`](boost-offer-conversion-2026-09.md), which found that
Instant Alerts was never bought on its own (0 standalone; 7 of 20 boosts included it, ~₹90 in total)
and that 13 of 19 boost buyers took the cheapest 7-day option. Decisions from the owner: **stop
selling Instant Alerts as a product, add a 30-day boost at ₹299, and show how much the longer options
save.**

Related: [`monetization-boosted-listings-premium-tiers.md`](monetization-boosted-listings-premium-tiers.md),
[`instant-alerts-paid-message-notifications.md`](instant-alerts-paid-message-notifications.md),
[`boost-instant-alerts-preview-selector.md`](boost-instant-alerts-preview-selector.md),
[`admin-in-app-boost-message.md`](admin-in-app-boost-message.md).

## What changed

**Prices** (property tier; the other tiers follow the same shape):

| Duration | Price | Per day | Saving vs the 7-day price |
|---|---|---|---|
| 7 days | ₹99 | ₹14 | none |
| 15 days | ₹179 | ₹12 | ₹33 (16%) |
| 30 days | **₹299** | **₹10** | **₹125 (29%)** — "Best value" |

- New columns `propertyBoostPrice30d`, `coworkingPgStorageBoostPrice30d`,
  `furnitureInteriorsBoostPrice30d` on `BoostPriceSetting` (migration `20260928200000_boost_price_30d`;
  defaults 299 / 299 / **149**). The coworking/PG/storage tier is ₹299 because its 7- and 15-day prices
  are the same as property's; furniture/interiors is ₹149, in proportion to its ₹49 / ₹89. Both are
  editable in admin → Plans (three fields per tier now). **Please confirm the two non-property
  numbers**; they were a judgement call.
- The saving is computed from the *charged* amounts (`boostSavings` in `packages/types`): "30 days at
  the 7-day rate would be ₹424; this is ₹299". The 50% promo takes the same percentage off every
  duration, so the saving keeps the same shape (about 30%) while a promo is running.
- The post-ad picker now pre-selects **15 days** (it was 7). The 7-day default was taken by 13 of 19
  buyers; the longer options cost less per day. Easy to change back.

**Instant Alerts is included in every boost, at no extra charge.**
- The order endpoints ignore `includeInstantAlerts` for pricing and always record
  `boostIncludesInstantAlerts = true`. Alerts run **for the length of the boost** (capped at the
  listing's expiry), not to the listing's expiry as the paid add-on did — this bounds the WhatsApp/email
  cost of a cheap 7-day boost. The Agent Pro free monthly 7-day boost now includes alerts too.
- Removed from the UI: the "Add Instant Alerts" checkbox/switch (web + Android picker + preview-step
  selector), the "Get Instant Alerts" button on My Listings (web + mobile), the standalone modals and
  provider (web `InstantAlertsProvider`/`Button`, mobile `InstantAlertsModal`/`Button`), the iOS
  "Get Instant Alerts" card, and the admin "Instant Alerts price" form. An old link with
  `?openInstantAlerts=<id>` now opens the Boost screen for that ad; `withAlerts` is ignored.
- Kept for older app builds: `POST /payments/instant-alerts` and its price row still work, the preview
  DTO still carries `boost7WithInstantAlerts` / `boost15WithInstantAlerts` (now equal to the plain
  options, so an old build shows the same price), and `includeInstantAlerts` is still accepted and
  ignored. Existing paid alerts run to their end date unchanged.
- Admin/marketing copy follows: the in-app "Bhavano Admin" message and the email promotion describe
  alerts as included, quote the 30-day price as the better value, and drop the second
  "Boost + Instant Alerts" button. An ad that is already boosted is skipped by the promotion (it used
  to need both to be skipped). **The WhatsApp promo text is an MSG91-approved template whose wording
  cannot be changed from here** and still names Instant Alerts.

## Rollback

- Prices: set the three `…30d` fields back or simply stop selling it by hiding the row — it is
  driven by the shared `BOOST_DURATIONS` list in `packages/types/src/boostPricing.ts`.
- Alerts: restoring the paid add-on means re-adding the checkbox and the `+alerts price` term in
  `createBoostOrder` / `createListingPublishOrder`; the price row and endpoint were left in place for
  that reason.

## Caveats

- Mobile changes need a new build or OTA to reach users; the server side is backwards compatible with
  every existing build.
- The 50% discount code `BHAVANO-SEP` still expires 2026-09-30 (see the boost-offer doc): from 1 Oct the
  prices shown are the list prices above.
- Volume is about 8 boost decisions a week, so judge the 30-day option over a month, not a few days.
