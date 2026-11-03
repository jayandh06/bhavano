# PG and coworking operator pilot kit (Phase 0)

Status: ready to run, 3 Nov 2026. Phase 0 of [`pg-coworking-operator-plan-implementation.md`](pg-coworking-operator-plan-implementation.md): give about 20 operators a free
30 days of Featured, show them what happened every week, then ask whether they would pay. **No charge, no card, and no promise of leads.**

## What the pilot has to answer
1. Do operators who are Featured get more views, reveals and enquiries than they did, and than similar ads that are not?
2. Will they pay ₹499 (PG) or ₹799 (coworking) a month for it, or at what price?
3. What do they ask for that we have not planned? (their words go in the tracker's notes)

**Do not start the paid plan until:** the segment gets 20+ enquiries a month (query 4) **and** at least 5 of the 20 say they would pay.

## How a pilot ad is made Featured (built 3 Nov 2026)
Admin > open the operator's listing > **Grant free Featured**: choose 30 days, reason code `pilot_pg` or `pilot_coworking`, confirm. It records a paid-at-zero payment (visible on
Payments with source `admin_grant:pilot_pg`), starts the Featured period and Instant Alerts, and adds to a period already running. It refuses an ad that is still owned by the
Bulk Import account (the operator has to claim it first) and one that is not live. To undo it: Subscriptions > Revoke on that boost. **Check the ad's expiry date on the box**:
a PG ad lives 30 days, so if it expires before the Featured days end, the operator must renew it (or alerts stop). Say so in the message.

Why not a 100% discount code: operators cannot type a code (only admins see that box), so a code would not reach them.

## Who to pick (20)
Run query 1 in `pilot/pg-coworking-pilot-queries.sql` on the production database. Choose:
- **10 PG operators** in Chennai (Adyar and nearby first) and **10 coworking operators** in Bengaluru; if there are fewer real operators, fill from Delhi NCR PG and Chennai coworking.
- A real phone number, a live approved ad with at least 3 photos, and no Featured running now.
- A mix: some with views but no enquiries, some with none. **Keep 10 comparable ads out of the pilot as the comparison group** (same cities and categories, not Featured) and
  track their numbers with query 2.
- Unclaimed imports are not eligible. To get more operators in, run the claim campaign first; claiming is the entry ticket.

## Timeline per operator
| Day | What | Who |
|---|---|---|
| 0 | Personal message or call (template A). If yes: grant 30 days, send the confirmation (template B) | You |
| 3 | First numbers (template C) | You |
| 10 | Numbers and one question: "what is missing?" (template C + question) | You |
| 17 | Numbers (template C) | You |
| 24 | Numbers, then the ask (template D) | You |
| 30 | Featured ends. Ask again if no answer; log the answer | You |

Send numbers even when they are poor (honestly: "3 views, no enquiries yet, here is what we are doing"). Pull them with query 2 and paste into the tracker.

## Messages (edit the brackets; send from your own WhatsApp, not as a bulk template)
**A. Invitation**
> Hi [name], this is [you] from Bhavano. We are trying out a "Featured all month" service for PG owners and coworking spaces and I would like to switch it on for your listing
> "[title]" for 30 days, free: shown above other listings in [area], and a WhatsApp alert whenever someone asks about it. I will also send you a short weekly note with how many
> people looked. No payment, nothing to sign. At the end I will ask if it was useful. Shall I switch it on?

**B. Confirmation (after the grant)**
> Done, "[title]" is Featured until [date]. You will see a Featured badge on it. One thing: the listing itself runs until [expiry date]; if it lapses before then, tap Renew in
> My listings so the Featured days are not wasted. I will send you the first numbers in 3 days.

**C. Weekly numbers**
> Hi [name], week [n] for "[title]": [views] people viewed it ([views last week] the week before), [saves] saved it, [reveals] saw your number, [enquiries] messaged. [One honest line:
> what that means / what we will change.] Anything you would like us to show or fix?

**D. The ask (day 24)**
> Hi [name], your Featured month ends on [date]. Over the month: [views] views, [reveals] numbers seen, [enquiries] messages. If you would like to keep it, it would be
> ₹[499 / 799] a month ([founding price ₹399 / ₹599 for 12 months, if you decide by [date]]), cancel any time. Would you keep it at that price? If not, what would be a fair price,
> or what is missing?

**E. No reply to the first message:** one follow-up after 3 days; then stop.

Rules for the messages: no promise of a number of enquiries; do not call anyone "verified" or "top rated"; if they say stop, stop and note it.

## Measure
Tracker: `pilot/pg-coworking-pilot-tracker.csv` (one row per operator). Weekly: query 2 for the 20 pilot ads and the 10 comparison ads. At day 30: compare per-ad views, reveals
and enquiries before, during and against the comparison group.

| Result | Meaning | Next |
|---|---|---|
| 5+ say they would pay at 499 or more, and Featured ads clearly beat the comparison | Demand for the product | Build Phase 1 of the plan |
| People like it but only at a lower price | Price is wrong | Test ₹299 to 399, or per-lead |
| Featured ads do not get more enquiries than the comparison | The product does not deliver | Fix demand (Phase 0 of the plan) before any plan |
| Few reply at all | Reach, not product | Call them; use the claim flow |

## Safety
- Nothing is charged, and nothing is automatic: each grant is one admin action, one ad, one reason code.
- Every grant is findable with query 3. Revoke clears the Featured; the audit rows stay.
- Operators keep their ad when the month ends. Only the Featured and the alerts stop.
