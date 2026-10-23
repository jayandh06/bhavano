# PG keyword plan — Chennai and Bengaluru

Source: Semrush keyword research pulled 2026-10-23 (India database; top 40 rows each for "pg in chennai"
and "pg in bangalore"). Raw rows: [`docs/semrush/pg-keywords.csv`](../semrush/pg-keywords.csv). Intent
codes (Semrush): 0 = commercial, 1 = informational, 2 = navigational, 3 = transactional. Most PG locality
terms are commercial (0), i.e. people comparing options before choosing.

## What the data says

- **Demand is large and cheap to compete for.** "pg in bangalore" 22,200/month; "pg in chennai" 8,100.
  Most locality terms have difficulty 14-30, i.e. winnable for a new domain.
- **Locality terms carry the volume** (Bengaluru: Indiranagar 6,600, Marathahalli 4,400, Whitefield 2,900,
  Domlur 1,600; Chennai: Velachery 1,900, Porur 1,000, Nungambakkam 1,000).
- **Gender and room-type modifiers are real demand**: "for men/gents", "ladies/women/girls", "single room",
  "with food", "couples", "unisex", "colive". These map onto the PG gender pages plan
  ([`pg-gender-pages-and-brand-signals.md`](./pg-gender-pages-and-brand-signals.md)).
- **Bhavano ranks for none of the "pg in X" terms yet.** Its current organic keywords are bare locality
  names (mostly positions 7-48).

## The constraint is supply, not pages

The PG locality pages already exist (for example `/bengaluru/indiranagar/pg`, `/chennai/adyar/pg`).
Listing counts checked 2026-10-23: Bengaluru about 40 PG listings in total, Chennai about 32. Most
locality pages have 0-2. A page with no listings will not hold a ranking and will bounce, so:

1. Do not create more locality pages. Add listings in the localities that have volume.
2. Prioritise by volume and difficulty: Indiranagar, Marathahalli, Whitefield, Domlur, Hebbal, HSR,
   Bellandur (Bengaluru); Velachery, Porur, Adyar, T Nagar, Anna Nagar, Thoraipakkam (Chennai).
   See [`pg-operator-outreach-chennai.md`](./pg-operator-outreach-chennai.md) for the existing Chennai outreach plan.
3. Gender: women-only and men-only pages for the top 5 localities per city once each has 3+ listings.

## Page-level changes (to do, in order)

| Step | Change | Done when |
|---|---|---|
| 1 | Supply: onboard PG operators in the top localities above | 5+ listings in each target locality |
| 2 | Title/H1 on locality PG pages uses the searched form, "PG in {Locality}, {City}" | Titles match the head keyword |
| 3 | Add FAQ block and FAQPage JSON-LD to city PG pages (rent range, food, notice period, deposit) | Rich Results Test passes |
| 4 | Track the 40 target keywords in Semrush Position Tracking | Baseline positions recorded |
| 5 | Re-pull rankings monthly; compare with this CSV | Movement on locality terms |

## Not covered yet

Apartments, houses, coworking, furniture; other cities. Re-run this process per category once PG supply
is in place. API units used for this pull: about 3,600 reported (see the session note on metering).
