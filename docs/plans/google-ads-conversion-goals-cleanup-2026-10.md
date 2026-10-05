# Google Ads conversion goals cleanup (2026-10-05)

## The report

Google Ads → Goals → Conversions showed Boost purchase, Subscription purchase and Contact reveal
credits purchase as "Misconfigured" / "Needs attention". Instant alerts purchase is no longer a
real conversion. Diagnosed with `ads_conversion_health.py` (read-only) plus the production
`Payment` table.

## What the data says

All four are `UPLOAD_CLICKS` actions fed by the Razorpay webhook through the Data Manager API
(`server-side-google-ads-conversion-upload.md`, Part D). The upload path itself is healthy:

- Upload client summary: status EXCELLENT, success rate 100%, no alerts.
- Account: customer data terms accepted, enhanced conversions for leads on.
- Boost purchase: daily uploads with 0 failures, 22 conversions / ₹920 in the last 30 days.

Paid purchases in the last 90 days, by `Payment.purpose`:

| purpose | paid | ₹ | reported as |
|---|---|---|---|
| listing_boost | 30 | 3,104 | Boost purchase |
| listing_publish | 4 | 241.50 | Boost purchase |
| seller_slot_pack | 1 | 149 (17 Sep) | Subscription purchase (before uploads began on 20 Sep; counted by the old tag) |
| contact_reveal_credits / buyer_premium / agent_pro / instant_alerts | 0 | — | — |

So:

1. **Subscription purchase and Contact reveal credits purchase have never received an upload.**
   Not broken, just unsold since the action was created. Google shows "no conversions"-type
   warnings for any import action with nothing recorded. Clears on its own with the first sale.
2. **Instant alerts purchase can never receive data again.** Instant Alerts stopped being sold on
   its own (`boost-30-day-and-included-alerts.md`); it now comes free with every boost.
   `POST /payments/instant-alerts` only survives for old app builds.
3. **Every purchase action counts "One per click".** `ads_create_offline_conversion_actions.py`
   created them with `ONE_PER_CLICK`, the setting for leads. For purchases Google recommends
   "Every" (and flags "One"): a seller who boosts two ads, or boosts again a week later, from the
   same ad click is counted once and only the first payment's value reaches Smart Bidding.
   `transactionId` = payment id already stops a webhook retry from double-counting, so "Every" is
   safe.

## Changes

1. **Remove "Instant alerts purchase"** (id `7781544854`) via a `remove` operation. Reporting
   history stays; it leaves the Purchase goal and the conversions table.
2. **Code: report a standalone instant-alerts payment as "Boost purchase"**, not to the removed
   action (an upload to a removed action fails). Only old builds can make one; it's a
   listing-promotion add-on, the same thing Boost now includes, so its value still reaches bidding.
3. **Counting → `MANY_PER_CLICK` ("Every")** on Boost purchase, Subscription purchase and Contact
   reveal credits purchase, and in `ads_create_offline_conversion_actions.py` for future purchase
   actions.
4. **Subscription / Contact reveal credits purchase: keep as-is**, primary in the Purchase goal. A
   primary action with no conversions doesn't hurt bidding, and removing them would lose those
   sales when they happen. Rejected alternative: merging every purchase into one "Purchase"
   action. It would clear the warnings today but lose per-product reporting in Ads (GA4 still has
   it).

Script: `ads_fix_purchase_conversions.py` (`--dry-run` first), targeting by conversion action ID,
not name (see `ads_retire_dormant_conversion_actions.py` for why).

Not touched: GTM's paused `Ads - instant_alerts_purchase` tag (paused since container v9, points
at an already-removed webpage action, fires nothing).

## Follow-up

- In a day or two, recheck the Goals page: Boost purchase should be clean. Subscription / Contact
  reveal credits will keep a "no recent conversions" style status until someone buys one.
- `python ads_conversion_health.py` re-prints everything above.
