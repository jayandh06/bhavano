# The Oct 4 ₹1,674 click, the CPC ceiling fix, and why traffic collapsed

## Status: applied 2026-10-06

**Update:** the CPC ceiling on `Bhavano-TargetCPA` was removed entirely (user's call, not
raised to a safety-net value) via `ads_remove_cpc_ceiling.py`. Confirmed live by read-back:
`target_cpa_micros=₹75` (unchanged), `cpc_bid_ceiling_micros=₹0` (unset), `cpc_bid_floor_micros`
unchanged at ₹0.1.

## What actually happened, reconstructed from live account data

**The spike.** On 2026-10-04 at hour 8 (8–9am), a single click on the phrase-match keyword
**"property ad posting sites"** in **Metro-Generic Post Ad Intent** cost **₹1,674.36** — the
exact spike you remembered (~₹1,670). At that hour, this campaign was still running plain
**Maximize Conversions with no target CPA and no CPC ceiling at all** — fully unconstrained
automated bidding. That's the mechanical cause: with nothing capping any single auction, Smart
Bidding can and occasionally will place one very aggressive bid on an auction it judges likely to
convert. This one didn't — the whole 7-campaign group converted **zero** times on 2026-10-04.
For scale, that one click alone was ~186% of this campaign's own ₹900/day budget.

**The response, and a correction.** Change history shows two actions that same morning:
- 10:34 — this campaign's own `target_cpa_micros` was set to **₹50** (an initial attempt).
- 10:44 — ten minutes later, superseded by moving the whole group onto a new **shared portfolio**
  (`Bhavano-TargetCPA`): **Target CPA ₹75, with a CPC ceiling of ₹50.**

**The ceiling live right now is ₹50, not ₹30.** I can't find any record of ₹30 ever being set
(the API's change history doesn't track bidding-strategy-portfolio field changes, only campaign
and keyword/asset-level ones, so I can't rule out ₹30 having been entered and then adjusted) —
worth double-checking directly in Shared Library > Bidding Strategies > Bhavano-TargetCPA in the
UI, since whether it's ₹30 or ₹50 changes how severe the problem below actually is, though not
which direction the fix goes.

## Why traffic collapsed — the ceiling, not the target, is the cause

Daily totals across the 7 campaigns now on this portfolio:

| Date | Clicks | Cost | Avg CPC | Conversions |
|---|---|---|---|---|
| Sep 25 | 132 | ₹4,073 | ₹30.85 | 43 |
| Sep 28 | 135 | ₹4,287 | ₹31.76 | 34 |
| Oct 1 | 65 | ₹4,355 | ₹67.00 | 13 |
| Oct 3 | 61 | ₹3,479 | ₹57.04 | 7 |
| **Oct 4** | 28 | ₹4,004 | ₹143.00 | **0** |
| **Oct 5** | **22** | **₹560** | ₹25.43 | 8 |

Two separate things are visible here, and it's worth not conflating them:

1. **Average CPC was already climbing before the spike** — ₹31 (Sep 25) → ₹39 (Sep 29) → ₹67–82
   (Oct 1–2) — days before Oct 4. This is a separate, already-diagnosed problem: `PURCHASE` was a
   biddable goal blended into these same campaigns' Target CPA signal (fixed earlier today, see
   `docs/plans/target-roas-value-carrying-campaigns.md`) — rare, hard-to-attribute purchase
   events were muddying what the algorithm was actually optimizing for, which plausibly
   contributed to it bidding less predictably. That fix landed *after* this incident, so it
   wasn't in effect on Oct 4, but it should help prevent a repeat.

2. **The ₹50 ceiling then cratered volume on Oct 5** — clicks fell to 22 (from a ~100–130
   baseline) and cost fell to ₹560/day (from ~₹3,500–4,300/day). This is the ceiling doing
   exactly what a hard bid cap on a Smart Bidding strategy does when set near or below the
   market-clearing price: it doesn't just block the rare ₹1,674 outlier, it blocks **every**
   auction where competition requires more than ₹50, which — per the keyword's own 90-day
   history below — is most of them.

**"property ad posting sites" itself is not a bad keyword.** 90-day totals: 100 clicks, ₹6,315
cost, ~45 conversions — a **45% conversion rate**, genuinely strong. Excluding the one ₹1,674
outlier, its other 99 clicks still averaged **₹46.87** — above even the ₹50 ceiling, let alone
₹30. A flat low ceiling doesn't just stop the freak bid; it stops this keyword's *normal*, highly
productive clicks too, which is exactly what the data shows happening.

## Recommendation

**Google explicitly advises against bid caps on Target CPA/Maximize Conversions**: a cap
prevents the algorithm from bidding higher in auctions it has genuine confidence in, and if set
anywhere near the real market price, it throttles broadly rather than trimming outliers. That's
observably what happened here.

1. **Remove the CPC ceiling, or raise it well above typical cost** (e.g. ₹150–200 — a safety net
   against a true 10x-outlier like this one, not a brake on everyday competitive bidding). Keep
   the ₹75 Target CPA itself — that's a reasonable target and the right lever; the *target*
   already pushes the algorithm toward cheaper clicks on average over time, which a cap doesn't
   do any better and does do active harm to.
2. **Don't rely on a per-click cap as the guardrail against another ₹1,674-style event** — use
   what already exists: each campaign's own daily **budget** (₹300–900/day here) is the real
   backstop on total blast radius from one bad auction, and Google's standard overdelivery limit
   (up to ~2x budget on a given day) bounds the worst case further. One expensive click is a bad
   day, not a runaway account.
3. **If "property ad posting sites" specifically still feels too expensive on a bad day**, the
   surgical fix is a keyword-level decision (exact match instead of phrase, a lower individual
   max for just this term if moving off a Smart Bidding strategy, or watching it for a few more
   weeks given its strong conversion rate) — not an account-wide ceiling that also throttles
   every other keyword's legitimate, competitively-priced clicks.
4. **Give the already-fixed `PURCHASE`-goal dilution (today's earlier fix) a couple of weeks**
   before judging the ₹75 target's real CPA — the Target CPA signal it's optimizing against is
   cleaner now than it was on Oct 1–4.

## Not recommending

- Not going back to a low (₹30–50) CPC ceiling — the data shows it suppresses real, converting
  traffic, not just the rare bad click.
- Not pausing "property ad posting sites" — its 45% conversion rate doesn't support that; the
  ₹1,674 click was the outlier, not the keyword's normal behavior.
