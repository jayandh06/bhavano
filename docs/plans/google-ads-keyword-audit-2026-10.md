# Google Ads keyword ↔ ad group audit (2026-10)

Read-only review: does every enabled ad group carry keywords that match its intent, and what are
those keywords actually matching? Window **2026-09-28 → 2026-10-04** (after the 09-28 changes in
[`google-ads-performance-analysis-2026-09.md`](google-ads-performance-analysis-2026-09.md)).
Data: `ads_keyword_audit.py` (writes `ads_keyword_audit.out.txt`).

## Applied 2026-10-05 (proposals 1–7, via `ads_apply_keyword_audit.py`)

Approved by the owner; bidding untouched. Differences from the proposals as written:
- PG: `pg listing site` became **`list pg online`** — "pg listing site" also reads as a seeker
  looking for a site that lists PGs.
- The Lease 3.1 owner keywords went into **both** Metro and Other-Metro 3.1 (Metro 3.1 only had two
  keywords).
- Seeker exact negatives were added at **campaign** level (both Metro and Other-Metro Sell / Rent
  Out), not per ad group.

New keywords were `UNDER_REVIEW` at read-back; a few show `RARELY_SERVED` (low volume, as
expected for the long-tail ones). The PG ads were already owner copy ("PG Owner? Post Ad Free",
"Fill Vacant PG Rooms"), so no ad change was needed.

**Follow-up ~2026-10-12:** compare the new Lease 3.2 owner keywords with `lease house online`;
pause it if they carry the conversions (proposal 3), and drop the conflicting `lease house`
ad-group negative only if it is kept. Re-run `ads_keyword_audit.py` for leakage.

## Verdict

Most ad groups are right: Generic, Sell 1.1 / 1.2 / 1.4, Rent Out 2.1 and Metro Lease 3.1 carry
genuine poster (owner/agent) keywords and convert. Three keywords are the wrong side of the
marketplace — what a *seeker* types — and they are where most of the waste sits.

| Ad group | Keyword(s) | Why wrong | Spend / post-ad conv |
|---|---|---|---|
| Rent Out 2.2 PG (both campaigns) | `coliving pg`, `colive pgs` | People looking for a PG, not PG owners. Every search term is a seeker ("pg in madhapur hyderabad", "best pg in bangalore", "gents pg near me"). | ₹3,181 / 0 (1 registration) |
| Other-Metro Lease 3.1 Commercial | `lease office space` | Someone wanting to *take* an office ("coworking space lucknow", "office on rent noida", "furnished offices for rent"). | ₹840 / 0 |
| Lease 3.2 Residential (both) | `lease house online` | Tenant phrasing (already noted in the 09 analysis). Terms: "house for lease in adambakkam", "lease 2bhk near me", "house for rent". It also *conflicts* with the ad group's own phrase negative `lease house`, which blocks the keyword's exact query. | ₹2,178 / some — the owner phrase `lease my house` beside it converts far cheaper (6 conv for ₹588) |

## Proposals (need approval)

1. **Rent Out 2.2 PG:** pause `coliving pg` + `colive pgs`; add owner keywords — "list my pg",
   "advertise pg for free", "pg listing site", "get tenants for my pg", "post pg ad", "pg owner app".
2. **Other-Metro Lease 3.1:** pause `lease office space`; add "lease my office space",
   "list office space for lease", "give my shop on lease".
3. **Lease 3.2:** add "lease out my house", "give house on lease", "post house for lease",
   "lease my flat"; pause `lease house online` once those have a week of data. Remove the
   conflicting ad-group negative `lease house` only if `lease house online` is kept.
4. **"near me" negative (phrase)** on Metro + Other-Metro Rent Out and Other-Metro Lease (Metro
   Lease already has it). Owners don't search "near me"; ~₹250 of "1rk near me", "2bhk on rent near
   me", "house rent near me" leaked through 2.1 this week despite the 09-30 bycatch pauses.
5. **Seeker exact negatives** in the poster campaigns: "property for sale in bangalore by owners",
   "plot for sale", "property buy", "free house searching app" (Sell 1.1); "good house renting
   apps", "best rental sites in hyderabad", "house rent app" (Rent Out 2.1); "shop on rent jaipur",
   "commercial warehouse for rent", "warehouse in pune for rent" (Rent Out 2.4).
6. **Generic Ad group 1 (both):** pause `coworking space`, `coworking rental` — seeker words, no
   spend this week but nothing poster about them.
7. **Dormant groups** — Sell 1.3 Villa, Sell 1.5 Commercial, Rent Out 2.3 Villa: right intent,
   ~0 impressions; keywords are too long-tail. Either broaden ("sell my villa", "sell independent
   house", "sell my shop", "sell office space", "rent out my independent house") or leave dormant.

## Outside keywords, but affects every ad group

- **Shared tCPA portfolio.** On 2026-10-04 all 9 campaigns, *including Metro-Seeker Intent*, were
  moved to one portfolio `Bhavano-TargetCPA` at **₹75**. This week's poster CPAs were ₹150–400, so
  expect delivery to drop sharply; and pooling the seeker campaign with poster campaigns is what
  [`seeker-intent-campaign.md`](seeker-intent-campaign.md) set out to avoid.
- **`property ad posting sites` paused in Metro-Generic (2026-10-04).** It was that campaign's
  biggest keyword (₹2,798, 8 conv, CPA ₹350 vs campaign ₹268). Still enabled in Other-Metro.
- **Overlap.** "free property listing site(s)" style queries are matched by Generic, Sell 1.1 and
  Rent Out 2.1 at once. Not wrong — they all convert — but Sell 1.1's top keyword
  (`free property listing site`, ₹2,175, 12 conv) is generic, not sell-specific.

## Seeker campaign keywords

Correct for seekers, but: Buy ad groups get ~0 impressions (portals outbid us); Bengaluru Rent
spent ₹1,083 with 0 saved searches; its only conversion is a "Post ad success" from Kolkata Rent.
