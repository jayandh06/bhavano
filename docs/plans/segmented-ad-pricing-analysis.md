# Should Bhavano price ads differently by seller segment or listing price?

## Status: analysis + recommendation (2026-10-06) — no code changes; see "Next steps"

## The question

Four things were asked: should pricing (Boost + platform fee) differ for (1) sellers vs (2)
renters, (3) long-lived listing types (PG, coworking) vs one-off transactional ones, and
(4) agents vs owners — and separately, should pricing within a category vary by the listing's
own price range (a ₹50L flat vs. a ₹5Cr villa). Answered one at a time below, each grounded in
what already exists in this codebase, real production numbers already gathered, and what the
three main competitors actually do.

## What pricing does today (baseline, confirmed in code — `packages/types/src/boostPricing.ts`)

Exactly one axis of variation: **listing category**, bucketed into 3 tiers, used for both Boost
and the (currently ₹0-everywhere) platform fee:

| Tier | Categories | Boost 7d/15d/30d |
|---|---|---|
| Property (high) | house, apartment, villa, plot, commercial | ₹199 / ₹349 / ₹599 |
| Coworking/PG/Storage (mid) | coworking, pg, storage | ₹99 / ₹179 / ₹299 |
| Furniture/Interiors (low) | furniture, interiors | ₹49 / ₹89 / ₹149 |

**Note found while confirming this:** `docs/plans/boost-30-day-and-included-alerts.md`'s own
table and commit message mislabel the mid-value tier's ₹299 as the "property tier" 30-day price
— the actual property 30-day price is ₹599. Code (`boostPricing.ts`) is authoritative; that doc
should be corrected if anyone reads it as a price reference.

`TransactionType` (buy/sell/rent/lease) and `SellerType` (owner/agent) are **not inputs to price
at all** today — `boostPriceFor`/`platformFeeFor` take only `category`. An agent and an owner
posting the same category pay identically; a rental apartment and a sale apartment pay
identically.

## 1. Sellers vs. renters (transaction type)

**No existing analysis of this specific axis, and no competitor precedent for it either** — all
three competitors researched (99acres, Housing.com, NoBroker) tier their paid products by
*feature bundle* (relationship manager, photoshoot, social promotion) or by *contact/lead count*,
never by whether the listing is a sale or a rental.

**Recommendation: don't differentiate by transaction type.** There's no data signal in this
repo suggesting sell vs. rent sellers have different price sensitivity, and inventing a split
with no evidence behind it repeats exactly the mistake `broker-paid-bundles.md` already warns
against for agents ("no value to price yet"). If this is worth revisiting, the trigger would be
real data — e.g. do rent listings get reposted/re-boosted far more often than sale listings over
their lifetime (implying a subscription-shaped product might fit rent better than a one-off
boost)? That's a usage-pattern question to measure, not something to price on a guess.

## 2. PG / coworking (long-lived listings) vs. one-off sale/rent listings

These already share the mid-value tier with "storage" — not yet split out as their own thing.
The question underneath "should they be priced differently" is really: **does a PG/coworking
listing behave differently over its lifetime than a house/apartment listing** (stays live and
relevant for months, vs. a sale ad that comes down once sold)? If so, a recurring, smaller-ticket
product might fit better than the same one-off Boost shape used for everything else.

**No production evidence either way was found in this session** — nobody has measured
PG/coworking listing lifetime, repeat-boost rate, or renewal behavior separately from the rest of
the mid-value tier. **Competitor precedent doesn't help here either**: none of the three
publicly distinguishes PG/co-living or coworking pricing from residential.

**Recommendation: instrument before pricing.** Before splitting PG/coworking into their own
tier or product shape, check: average listing lifetime for PG/coworking vs. house/apartment, and
boost-repeat rate for PG/coworking specifically. If PG/coworking listings genuinely stay live and
get re-boosted far more than a typical sale ad, that's the case for a distinct (likely
subscription-shaped, not one-off) product — not a reason to just charge a different flat number
in the existing table.

## 3. Agents vs. owners

**This was already analyzed in depth, with real production data, nine days before this
conversation — `docs/plans/broker-paid-bundles.md`.** Don't re-derive this; the existing
conclusion is specific and evidence-based:

- Production snapshot (2026-09-28): 223 real owners, 212 have exactly 1 listing, 10 have 2 — "
  **nobody is near the 5-listing free cap.**" Active Agent Pro subscriptions: **1**, and it's the
  internal bulk-import account, not a real customer. All-time paid revenue: 20 boosts (₹1,467), 3
  platform fees (₹241), 1 seller slot pack (₹149).
- Explicit conclusion already on record: *"slots, the only thing Agent Pro really sells, don't
  bind for anyone. Brokers pay for **leads and visibility**, not for the right to post more."*
- Explicitly in that doc's **"Not recommended"** section: *"Charging per listing for agents while
  owners post free: it pushes agents to post elsewhere, and depth is what we lack."*

Competitor research backs the same shape, not the opposite: 99acres and NoBroker both give
owners free/cheap entry and monetize agents through **opaque, sales-negotiated subscriptions**
(99acres: ₹4,000–60,000/month, "contact sales," not a public rate card) rather than a different
per-listing price. NoBroker has no agent product at all (it's structurally anti-broker). Housing's
agent pricing isn't public either. None of the three charges agents a different *per-listing* fee
than owners for the same ad — they monetize agents through a different *product* (subscriptions
+ lead access), same direction `broker-paid-bundles.md` is already headed.

**Recommendation: don't add agent-vs-owner price differentiation to Boost/platform fee.** The
existing plan is right, and it's already mid-flight: Phase 0 (know who's a broker) and Phase 1
(founding-broker free program, building listing depth) are built; Phase 2 (the actual paid
bundle, priced on leads) is intentionally gated behind having enough enquiry volume per agent
listing to know what's worth paying for. The next real step here is **accelerating Phase 1**
(more founding brokers, more cities), not inventing a parallel pricing track.

## 4. Pricing within a category by the listing's own price range

**This is the one place where there's no competitor to copy — doing it would be a genuine point
of departure, not a catch-up.** Checked all three competitors specifically for this: none ties
boost/premium pricing to the listed property's own ₹ value. Where they tier, it's by duration,
feature bundle, or contact count — never by whether the property is ₹50L or ₹5Cr.

**The underlying logic for trying it anyway is real, though:** a ₹599 boost is a rounding error
against a ₹5Cr villa sale, but a real ask against a ₹15L flat — classic price-to-value reasoning
(charge more where the stakes, and presumably the willingness to pay, are higher), standard in
SaaS/marketplace pricing generally. It would also stay consistent with the thing that already
differentiates Bhavano from 99acres per `competitor-99acres-owner-ads-research.md`: "self-serve
upsells at a visible price, with no calls" — a transparent price band table preserves that,
unlike 99acres' sales-negotiated tiers.

**Recommendation: worth a contained experiment, not a blanket rollout.** Concretely: pick the
property tier only (house/apartment/villa/plot/commercial — the tier with by far the widest
price spread), define 2-3 price bands from real listing-price distribution data (not guessed
cutoffs), and set boost price per band. Don't touch the other two tiers (mid/low-value categories
have a much narrower internal price spread — a PG at ₹5k/month and one at ₹15k/month don't
justify the same banding logic a ₹15L flat vs. ₹5Cr villa does).

**Blocking gap: this needs real listing-price distribution data, which wasn't available from
this session** — the production database is only reachable from inside Bhavano's own
infrastructure, not from this dev machine. Before setting band cutoffs, pull: the distribution of
`Listing.price` within the property tier (what are the actual 25th/50th/75th/90th percentiles?),
and current boost-conversion rate split by price band if it can be reconstructed from existing
`Payment`/`Listing` join (to see whether higher-value sellers already convert differently at
today's flat price — that alone would validate or kill the idea before writing any pricing code).

## Summary

| Question | Recommendation | Why |
|---|---|---|
| Sell vs. rent pricing | No | No data signal, no competitor precedent |
| PG/coworking distinct pricing | Not yet — instrument first | Lifecycle/repeat-boost data doesn't exist yet |
| Agent vs. owner pricing | No — already decided against, with data | `broker-paid-bundles.md`; competitors monetize agents via subscriptions/leads, not per-listing price |
| Price-range bands within property tier | Worth a contained experiment | No competitor does it, but the price-to-value logic is real; needs listing-price distribution data first |

## Next steps

1. Pull `Listing.price` distribution for the property tier from production (needs DB/admin
   access this session didn't have) before designing price bands.
2. If pursuing PG/coworking as its own product shape: measure listing lifetime and repeat-boost
   rate for that tier specifically, split out from storage.
3. Don't start agent-pricing work independent of `broker-paid-bundles.md` Phase 1/2 — check that
   doc's "Open decisions" §3 (tier numbers "set from Phase 1 data") before building anything there.
