# Paid bundles for brokers and agents (2026-09-28)

## Status: plan only; nothing built

Builds on [`product-pricing-tiers.md`](product-pricing-tiers.md) (Agent Pro ₹499 per 20 slots),
[`listing-slots-seller-notifications.md`](listing-slots-seller-notifications.md) (slot caps, Pro
boost credit), [`requirement-leads-for-brokers.md`](requirement-leads-for-brokers.md) (requirements
as leads) and [`contact-reveal-credits.md`](contact-reveal-credits.md) (the credit-batch pattern).

## What exists today

- **Agent/Broker Pro**, ₹499 a month per unit of 20 concurrent listings, stackable up to 20 units
  (`subscriptionPriceFor`, `listingSlotAllowance`, `User.agentProUntil` / `agentProUnits`). It
  includes the Pro badge on `/agent/[userId]`, elevated video limits, and one free 7-day boost a
  month (`ProBoostCredit`, unique per `userId` + `monthKey`).
- **Seller slot pack**, ₹149 a month for 10 slots.
- Monthly only: `agentPro` and `sellerSlotPack` throw on any duration other than 1 month.
- Nothing marks an account as a broker. There is no owner/agent flag on the user or the listing.

## What production says (2026-09-28)

| | |
|---|---|
| Real owners with live listings | 223: 212 have 1, 10 have 2, 1 has 3. **Nobody is near the 5-listing free cap.** |
| Active Agent Pro | 1, and it is the internal bulk-import account |
| Paid, all time | 20 boosts (₹1,467), 3 platform fees (₹241), 1 seller slot pack (₹149) |
| Contact reveals | 25, all free |

**Conclusion:** slots, the only thing Agent Pro really sells, don't bind for anyone. Brokers pay
for **leads and visibility**, not for the right to post more. Until Bhavano can send a broker
enquiries, a paid bundle has nothing to sell, and the first job is getting brokers on the platform
with depth in the 11 ad cities (see `growth-beyond-google-ads.md` §3).

## Proposal

### Phase 0: know who the brokers are (small)
- Ask once, in the post wizard and in the profile: "I am the **owner** / an **agent or broker**".
  Store `User.sellerType` (`owner | agent`), plus optional `agencyName` and `reraNumber`.
- Show "Owner" or "Agent" on listing cards and detail pages. Seekers want to know (99acres shows
  Owner/Dealer), and it keeps owner-only features, such as free posting, owner-first sorting and
  the "invite an owner" referral, honest.
- Admin: filter users by seller type; see agents' listing counts and enquiries.

### Phase 1: founding-broker programme (no payment code)
- In each of the 11 cities, offer the first ~20 agents **Agent Pro free for 3 months** via an
  admin grant (a manual `agentProUntil`, which already exists in admin), in exchange for posting
  their live inventory. That builds the listing depth every channel depends on.
- Source agents from the Google Places outreach contacts (`outreach-direct-listing-creation.md`),
  by phone or WhatsApp. Brokers are sold to by people, not self-serve.
- Measure listings per agent, enquiries per agent listing and 90-day retention. This sets the price
  of the paid bundle from real value.

### Phase 2: the paid bundle (when there are enquiries to sell)
One product, "Bhavano Pro for agents", in tiers with prepaid terms. Numbers below are
placeholders to be set from Phase 1 data:

| | Starter | Growth |
|---|---|---|
| Live listings | 20 | 50 |
| 7-day boosts included | 3 a month | 10 a month |
| Requirement leads (contact access) | 10 a month | 30 a month |
| Badge, storefront, elevated video | yes | yes |
| Lead ranking | Pro first | Pro first, ahead of Starter |
| Price | 1, 3 or 12 months, with ~15% / ~30% off for longer terms | same |

Why this shape:
- **Leads are the reason to pay.** The requirement-leads plan already has the ranking hook
  ("Agent Pro subscribers rank ahead") and a `RequirementLead` row per contact access: the paid
  unit. Seekers stay protected by the 5-brokers-per-lead cap and daily limits in that plan.
- **Boost credits are cheap for us to give** and visible to the broker.
- **Prepaid terms** suit how Indian brokers buy (quarterly or yearly packages on 99acres and
  MagicBricks) and cut monthly churn.

### Build outline (Phase 2)
- **Pricing:** extend `SubscriptionPlanSettings` with tier definitions (slots, boost credits and lead
  credits per month, and prices for 1, 3 and 12 months), admin-editable like today's plan settings.
  `subscriptionPriceFor("agentPro", months, …)` accepts 3 and 12.
- **Entitlement:** `User.agentProTier` (`starter | growth`) beside `agentProUntil`. `agentProUnits`
  stays for "+20 slots" top-ups.
- **Boost credits:** generalise `ProBoostCredit` from one per month to a count per month (drop the
  unique `userId`+`monthKey`, add a `source`), or a batch table like `ContactRevealCreditBatch`.
  Checkout already offers a ₹0 boost when a credit exists (`hasFreeBoostCredit`).
- **Lead credits:** `RequirementLeadSetting` plus a monthly allowance from the tier, charged per
  `RequirementLead` contact reveal, never per attempt (requirement-leads plan, phase 5).
- **Payments:** `PaymentPurpose.agent_pro` with `subscriptionMonths` and a new tier on the order.
  The webhook sets `agentProUntil`, the tier and units, and grants the month's credits. A monthly
  cron grants credits for multi-month terms.
- **Admin:** grant or extend a bundle manually with a note, for brokers who pay by UPI or bank
  transfer after a call. This is the main sales path early on.
- **Surfaces:** `/premium` agent tab, the Pro upsell on the lead card ("2 of 5 spots left: upgrade
  to see this lead"), and on `/my-listings` for agents. Mobile links to the web checkout, as boosts
  already do (Apple guideline 3.1.1; check Play billing policy before any in-app purchase on
  Android).

## Not recommended
- **Charging per listing for agents** while owners post free: it pushes agents to post elsewhere,
  and depth is what we lack.
- **Selling seeker phone numbers without consent or caps:** it breaks the requirement-leads
  consent rules and invites spam reports.
- **Building Phase 2 before Phase 1 shows enquiries per agent listing.** There is no value to
  price yet.

## Open decisions
1. Owner/agent question: required, or optional with a nudge?
2. Founding programme: 3 months free, or 50% off the first year?
3. Tier numbers (slots, boosts, leads, prices): set from Phase 1 data.
4. Verified agent: RERA number for the badge, or phone verification only?
