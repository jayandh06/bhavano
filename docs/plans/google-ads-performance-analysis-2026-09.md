# Google Ads performance analysis and conversion plan (2026-09-28)

## Status: analysis done; recommendations 1, 3 and 4 applied to the ad account on 2026-09-28

The analysis used read-only GAQL (customer 4214066478, INR) and read-only production database
queries. On the owner's go-ahead, recommendations **1, 3 and 4** were then applied — see
[Changes applied](#changes-applied-2026-09-28) for exactly what changed and how to roll it back.
Recommendations 2, 5, 6 and 7 (product changes and experiments) are still proposals.

Related: [`capture-google-ads-click-attribution.md`](capture-google-ads-click-attribution.md),
[`server-side-google-ads-conversion-upload.md`](server-side-google-ads-conversion-upload.md),
[`user-acquisition-source.md`](user-acquisition-source.md),
[`analytics-bot-filtering-and-attribution.md`](analytics-bot-filtering-and-attribution.md),
[`listing-platform-fee-and-checkout-gate.md`](listing-platform-fee-and-checkout-gate.md),
[`serve-only-ad-targeted-cities.md`](serve-only-ad-targeted-cities.md).

## Read this first: which window to trust

The account's first ~12 days (2026-08-29 → 09-09) were a ramp-up: conversions were near zero
(tracking was probably still being set up — inferred, not checked), a batch of exact-match keywords
served only 08-29 → 09-03 (~₹12k, 9 conversions; whether they were removed or paused was not
checked), and the now-paused Performance Max / Leads-Search-1 campaigns spent ₹5.3k for 0
conversions.
The 30-day headline (₹89,997, 535 conversions, CPA ≈ ₹168) is therefore **worse than the account is
today**. Everything below uses **2026-09-10 → 09-27** unless stated ("clean window": ≈ ₹54k spend,
477 conversions, **CPA ≈ ₹113**; last 7 days ≈ ₹110).

An early reading of "exact-match keywords burn money with no conversions" was a timing artifact of
that ramp-up and is **not** a finding.

## What the conversions actually are

Six primary conversion actions are live, all with the same weight in bidding:

| Action (30d) | Count |
|---|---|
| New registration | 305 |
| Post ad success | 186 |
| Boost purchase | 9 |
| Calls from ads | 8 (historic — a call asset with a phone number ran 2026-09-01/02 and was later removed; 38 calls, 8 counted as ≥60 s. No call asset is active now, so this action can no longer fire) |

Bidding is `MAXIMIZE_CONVERSIONS` on all eight active Search campaigns (no target CPA, no value
weighting), so **a sign-up that never posts counts the same as a posted ad**.

Our own data agrees with Google's counts, so the conversions are real people (sign-up needs an OTP):
300 users acquired via `google/cpc` since 09-10, against 23 with no source and 9 referrals. **Paid
ads are effectively the only acquisition channel.**

## The funnel behind the ads (users acquired via cpc, 09-10 → 09-27)

| Step | Number |
|---|---|
| Ad clicks | ≈ 1,700 |
| Visits recorded (JS-confirmed, since 09-16) | ≈ 87–90% of clicks |
| Sign-ups | 300 |
| Posted a listing (nearly all within 24 h of sign-up) | 178 (59%) |
| Posted a second listing | 8 (4.5% of posters) |
| Paid anything | 18 (6%) |

- **Cost per sign-up ≈ ₹177; cost per poster ≈ ₹300.**
- Revenue from these payments since 09-10 was about ₹1.7k against ≈ ₹54k of spend. Payments are
  small (boost avg ≈ ₹77). Boost checkouts: 37 started, 17 paid (46%). Publish-fee checkouts (17
  started, 3 paid) all date from 09-23 → 09-25, while a platform fee was active; the fee was set
  back to ₹0 on 09-25 06:52 UTC and there have been none since, so that 18% is *not* the current
  flow.
- 122 sign-ups (41%) never posted. They hold a verified phone number and cost ≈ ₹21k to acquire.
- Visit → sign-up (JS-confirmed): desktop 33%, mobile 17%, tablet ~5%. Home (`/`) lands ~94% of
  paid traffic and converts 17–33%; `/post` landings (sitelinks) converted 2 of 45.
- Session depth: 59% of paid sessions are single-page; average 2.7 page views.

## Where the money goes and what it returns (clean window)

**Campaigns** (budget ₹700/day each; all four spend the full budget):

| Campaign | Cost | Conv | CPA | IS | Lost to budget | Lost to rank |
|---|---|---|---|---|---|---|
| Sell Property | ₹14.0k | 141 | ~₹100 | 29% | 43% | 28% |
| Rent Out Property | ₹14.5k | 132 | ~₹110 | 12% | 45% | 43% |
| Generic Post Ad Intent | ₹11.1k | 118 | **₹94** | 31% | 52% | 18% |
| Lease Property | ₹11.7k | 70 | **₹166** | 15% | 56% | 30% |

The four Other-Metro campaigns (₹300/day each) only launched 2026-09-26; two days of data, too early
to judge. They are budget-capped (55–86% of impressions lost to budget), which is expected.

**Ad groups worth attention:**

- Strong: Generic "Ad group 1" (CPA ₹94), Sell House/Property 1.1 (₹93), Rent Out House/Flat 2.1
  (₹100), Rent Out PG 2.2 (₹74, small).
- Weak: Lease Commercial 3.1 (₹165), Lease Residential 3.2 (₹168), Rent Out Commercial 2.4 (₹184),
  **Rent Out Furniture 2.5 (₹835 spent, 2 conversions, CPA ₹418)** — its keywords are "furniture
  rental near me / rent a bed / sofa rental", i.e. people wanting to rent furniture, not post a
  property.

**Keywords:** the free/listing-site intent phrases carry the account — "free property listing site"
(₹90), "free property ads posting sites" (₹76), "property ad posting sites" (₹71), "list your
house/property for rent" (₹52–56), "free rental listing sites" (₹66). The weak spot is Lease:
"lease open space" ₹2,072 → 3 conversions (CPA ₹691); "lease house online" ₹3,826 → 23 (₹166).

**Search-term waste is small but real** (the account has only 8 campaign + 34 ad-group negatives):
"homedeal realty india" (a competitor/brand name, ~76 clicks, ~1 conversion), "luxury house(s)"
(57 clicks, 0), "retail office space", "website for commercial real estate", "realty near me",
"list my home on zillow", "business marketplace", "tnhb property sales online".

**Device:** mobile takes ~78% of clicks. Per click, desktop converts about 2.5× better (53% vs 21%
conversions/click) but mobile clicks are cheaper, so CPA is ₹121 mobile vs ₹102 desktop — the gap is
in the visit → sign-up step (17% vs 33%), not in what Google charges.

**Hour of day:** worst hours are 00:00–02:59 (₹2.9k for 7 conversions, CPA ≈ ₹420), 08:00–09:59
(₹6.1k for 32, CPA ≈ ₹190) and 19:00 (₹195). Best are 11:00–12:00, 14:00–18:00 and 20:00–21:00
(CPA ₹79–120). Day of week is noisier (Thursday CPA ₹203, Monday ₹66) — small samples, do not act
on it.

**Geography** (directional only; most cities have 10–60 clicks): Bengaluru ₹80, Pune ₹74,
Hyderabad ₹85, Lucknow/Noida/Gurugram ₹94–97, Ahmedabad/Vadodara/Coimbatore ₹74–78; Chennai ₹136
(on the second-largest spend), Delhi ₹264, Guwahati ₹460, Indore ₹325, Varanasi ₹490.

**Ad copy** is not the problem: 8 of 11 active ad groups are rated Excellent, the rest Good/Average.
CTR is 6–10% on the main groups.

**Site-link mismatch (already found earlier):** "Buy Property", "Rent a Home", "Plots & Land",
"Commercial Spaces" sitelinks in the poster-audience campaigns all point at `/post`. They are
mislabelled for a poster audience and convert ≈ 2%.

## Recommendations, in order of expected effect

### 1. Tell the bidder what a good conversion is (account change — needs approval)
- Make **Post ad success** the primary conversion; set **New registration** to secondary (still
  reported, no longer bid on), or give both a value (e.g. registration low, post higher) and move to
  *Maximize conversion value*. Purchases already send real rupee values.
- Why: 41% of sign-ups never post. With equal weighting Google is free to buy cheap sign-ups.
- Expected: fewer reported "conversions" at first (a re-learning dip of a week or so), but a higher
  share that are posters. Do not judge it on the raw conversion count.

### 2. Follow up the 41% who sign up and don't post (product — highest return per rupee)
- Every one of them has a verified phone/email and cost ≈ ₹177 to acquire. Send a "finish your
  listing" WhatsApp/SMS/email within a few hours of sign-up (and a second one next day) with a
  one-tap link back into the post wizard.
- Converting a third of the 122 non-posters is ≈ +40 posters (+22%) with no extra ad spend.
- Check first whether a partially filled wizard is saved server-side; if not, the nudge should link
  to a fresh wizard pre-set to the ad's intent (sell / rent / lease).

### 3. Reallocate, then raise, budget
- All four main campaigns spend their whole budget and lose 43–56% of impressions to budget; the
  three cheapest run at CPA ₹94–110. Move budget from Lease (₹166) toward Generic, Sell and Rent
  Out, and consider raising the total. Marginal CPA will rise as volume grows — raise in steps
  (+25–30%), watch a week, repeat.
- Rent Out loses 43% to *rank* as well: worth a look at its keyword mix/quality before feeding it
  more budget.

### 4. Cut waste (small, low risk — account change)
- Pause ad group **Rent Out Furniture 2.5** and the keywords "lease open space" and the weakest
  Lease phrases, or move Lease to its own tighter list. Add negatives for the search terms above
  (`homedeal`, `luxury`, `retail`, `zillow`, `realty near me`, `business marketplace`).
- Order of magnitude: ≈ ₹4–5k per 18 days (~8% of spend) recycled to winners.
- Exclude or bid down 00:00–03:00; consider a bid-down for 08:00–10:00. (Small sample — reassess
  after 4 weeks.)
- Keep the paused Performance Max and Leads-Search-1 campaigns paused: 1,721 clicks for 0
  conversions.

### 5. Fix the mobile web sign-up step (product — the largest structural gap)
- Mobile visit → sign-up is 17% vs 33% on desktop, on 78% of the traffic. Lifting mobile to 22%
  is roughly +25% mobile conversions at the same media spend.
- Hypotheses to test, none verified: above-the-fold CTA on the phone home screen, OTP entry friction
  on mobile web, whether the home screen sends a first-time visitor straight into the post flow.
- We cannot see *where* mobile users drop today. Add step-level events (wizard step reached, OTP
  requested, OTP verified) so this stops being guesswork. This is the prerequisite for #5.

### 6. Test the new login-at-preview flow with an ad landing on `/post`
- Login now happens at the Preview step (after the user has entered their listing), which is the
  opposite of the flow that made `/post` landings convert 2 of 45. Re-measure it: send one campaign
  (Generic Post Ad Intent) to `/post` as a 50/50 experiment against the home page.
- Also relabel or remove the mislabelled sitelinks (ad-account change).

### 7. Decide the intent of the ad spend
- Ads produce cheap supply (~₹300 per poster) but only ~6% of the acquired users have paid, and
  If ads are meant to pay for themselves,
  the leverage is the payment steps (fee checkout, boost upsell), not the ads. If this is a
  deliberate supply-building phase, keep the current approach and track cost per poster instead of
  CPA. Either is defensible; the account should be judged against whichever is the goal.

## Explicitly not recommended
- Do **not** cut spend on Generic/Sell/Rent Out — they are the efficient part.
- Do **not** judge the Other-Metro campaigns yet (two days of data).
- Do **not** drop cities on today's data except with a further 3–4 weeks (10–60 clicks each).
- Do not act on day-of-week differences.

## How to reproduce
Read-only GAQL helpers: `make_client()` in the repo-root `ads_setup_conversions.py` and `.env`
`GOOGLE_ADS_*`. Queries used `campaign`, `ad_group`, `keyword_view`, `search_term_view`,
`user_location_view`, `ad_group_ad`, `conversion_action` with `segments.device`, `segments.hour`,
`segments.day_of_week`, `segments.conversion_action_name`. Funnel numbers: `Visit`, `PageView`,
`User.acquisition*`, `Listing.ownerId`, `Payment` (amounts are paise).

## Changes applied (2026-09-28)

Applied via the Google Ads API after a validate-only dry run, then read back to confirm.

| # | Change | Before → after |
|---|---|---|
| 1 | "New registration" (id 7750776144) made **secondary** for bidding | primary → not primary. Post ad success, purchases and calls stay primary. Bidding is still Maximize Conversions. |
| 3 | Daily budgets | Generic Post Ad Intent ₹700 → **₹900**; Sell ₹700 → **₹900**; Rent Out ₹700 → **₹800**; Lease ₹700 → **₹500**. Other-Metro campaigns unchanged (₹300 each). Total Metro budget ₹2,800 → ₹3,100 (+11%). |
| 4a | Paused ad group "Ad Group 2.5 - Rent out Furniture" | Enabled → **paused** in both Metro-Rent Out and Other-Metro-Rent Out. |
| 4b | Paused keyword "lease open space" (phrase) | Enabled → **paused** in Metro-Lease and Other-Metro-Lease (ad group 3.1). |
| 4c | Campaign-level negative keywords (9 × 8 campaigns = 72) | Phrase: `homedeal`, `zillow`, `tnhb`, `business marketplace`. Exact: `luxury house`, `luxury houses`, `retail office space`, `realty near me`, `website for commercial real estate`. Negatives went 8 → 80. |

**Not done, and why:**
- The overnight (00:00–03:00) exclusion was **already in place**: every enabled campaign runs a
  07:00–23:00 ad schedule, and the last three days show no clicks outside 07:00–22:59.
- The 08:00–10:00 bid-down was skipped: Maximize Conversions ignores manual schedule bid
  adjustments, so it would not have done anything.
- Luxury negatives are **exact** match on purpose, so a genuine seller writing "sell luxury villa"
  is not blocked.
- Weak Lease phrases other than "lease open space" were left alone ("lease house online" converts
  at ₹166 — mediocre, not clearly bad).

**Two pitfalls hit while applying** (for the next person editing this account through the API):
`validate_only` must be passed on the request object, not as a keyword; and
`protobuf_helpers.field_mask()` drops fields set to `False`, so turning off `primary_for_goal`
silently did nothing until the mask path was set explicitly.

### What to expect and how to judge it
- Changing the conversion goal restarts Smart Bidding's learning: expect a week of noisier CPA
  and a **lower reported conversion count** (registrations no longer count). Compare on *posters
  per ₹* (from our own database: cpc-acquired users who posted ÷ spend), not on Google's raw count.
- Before-state to compare against (clean window 09-10 → 09-27): CPA ≈ ₹113 blended; 178 posters
  from 300 sign-ups; ≈ ₹300 per poster.
- Budgets raised by 11% in total, in the direction of the cheaper campaigns. Check Generic, Sell
  and Rent Out CPA after 7 days; if any exceeds ~₹130, step that budget back.
- Reassess the geo and hour-of-day findings after 3–4 weeks of data.

### Rollback
- Registration: set `primary_for_goal = true` on conversion action 7750776144.
- Budgets: set the four budgets back to ₹700 (ids 15844997968, 15844996057, 15834711278,
  15844993126).
- Ad groups: re-enable `adGroups/198875640605` and `adGroups/201629875084`.
- Keywords: re-enable `adGroupCriteria/198411059486~2498402682479` and
  `adGroupCriteria/203420143351~2498402682479`.
- Negatives: remove the 72 campaign criteria listed above (text + match type per campaign).

## Campaign structure: intent × Metro / Other-Metro (question asked 2026-09-28)

Current shape: 4 intents (Sell, Rent Out, Lease, Generic Post Ad) × 2 city tiers = 8 campaigns.
**Metro** targets 6 markets (14 geo targets: Bengaluru, Chennai, Delhi NCR ×7, Hyderabad, Mumbai
×3, Pune); **Other-Metro** targets the other 31 served cities. Both use the same landing page (`/`)
and the same conversion events; the intents differ only in keywords and ad copy.

**Important for reading the numbers:** the Other-Metro campaigns launched **2026-09-26**, carved out
of the Metro campaigns. Metro-campaign history before that date includes cities that now belong to
Other-Metro (Kolkata, Jaipur, Lucknow, …), so Metro and Other-Metro cannot be compared cleanly until
~2 weeks of post-split data exist.

**Verdict: keep the structure for now; revisit in ~4 weeks.** Reasons and review checks:
- Splitting by *intent* earned its keep: Lease runs at ~1.5× the CPA of the others, and separate
  budgets are what allowed cutting it (₹700 → ₹500) without touching the rest.
- Splitting by *tier* protects tier-2 cities from being starved by the big metros' volume, but
  "metro" is a size label, not an efficiency one: Bengaluru/Pune/Hyderabad ran ₹74–85 CPA, while
  Chennai/Mumbai/Delhi ran ₹136–264.
- Risk of too many small campaigns: each Other-Metro campaign gets ~2–3 conversions/day at ₹300;
  Smart Bidding learns slowly below ~30 conversions/month. Merge intents inside Other-Metro
  (one campaign, four ad groups) if any campaign stays under that.
- Re-cut cities by measured CPA (efficient vs expensive) rather than by metro/non-metro once each
  city has ≥ ~100 clicks, and choose cities by where listings actually get inquiries, not only cheap
  CPA — a poster in a city with no seekers churns.
- Avoid changing structure again this week: the conversion goal was just changed and Smart Bidding
  is re-learning.

## Ad group and ad copy review (2026-09-28) — proposals, nothing applied

Findings (read-only): every enabled ad group has **one** responsive search ad (no variant to test
against), ad strength is Excellent/Good almost everywhere, there are no pinned headlines, and every
ad's final URL is `https://www.bhavano.com`. Google gives no per-headline ratings yet
(`NOT_APPLICABLE`, too little data).

The weak groups (Lease 3.1 ₹165 / 3.2 ₹168, Rent Out Commercial 2.4 ₹184; Lease 3.2 has the lowest
CTR at 3.9%) are not weak because of the copy's quality but because of **who is matching**. Their
search terms are mostly *seekers*: "office rent in kolkata", "shop for rent in mg road bangalore",
"house rent", "lease house in coimbatore", "500 sqft office space for rent", "rent house near me".
The keyword "lease house online" is what a tenant types, and the 3.2 lead headline ("Lease House
Online Fast") reads like an ad for finding one.

Proposals, in order:
1. **Qualify the audience in the first headline** of the weak groups ("Own a House? List It for
   Lease", "Owners: Post Your Lease Ad Free"). CTR will fall a little; conversion rate should rise.
2. **Add a second ad per ad group** with a different angle (free listing vs. get tenant/buyer
   calls) so Google can find a winner; start with Generic, Sell 1.1 and Rent Out 2.1 (most volume).
3. **Targeted negatives for seeker terms** in Lease/Rent Out Commercial, added from the search
   terms report weekly rather than blanket ("near me" / "for rent in" would also block posters).
4. **Message match**: test one ad group with a per-intent final URL instead of the home page
   (see recommendation 6; query-param variants of rankable pages need a canonical — see
   `.claude/CLAUDE.md` URL rules).
5. **Fix the sitelinks** ("Buy Property", "Rent a Home", "Plots & Land", "Commercial Spaces" → `/post`)
   and check callouts/snippets.
6. **Check claims before scaling copy**: "Verified Tenants/Buyer Leads", "India's Trusted Lease
   Site", "Trusted by owners" — sign-up verifies a phone number only; make sure the claims are
   defensible (also an ad-policy risk).
7. Leave tiny groups alone (Sell Villa 1.3, Sell Commercial 1.5, Rent Out Villa 2.3: < ₹60 each).

### Draft copy: second ad for the Lease groups (2026-09-28) — not applied, for review

Purpose: each ad group currently has one ad whose lead headline attracts tenants. This second ad
opens with an owner qualifier (pinned to position 1; Google rotates the three) so seekers skip it.
Every line was checked against the limits (headline ≤ 30, description ≤ 90 characters). Final URL
stays the home page for now. Wording avoids "verified" and "trusted" (see claims note above) and
says "free" only because all platform fees are ₹0 (`PlatformFeeSetting`, since 2026-09-25) — if a
fee is switched on again, the "free" lines must change first.

**Lease 3.2 Residential — ad B**
- Pinned to position 1: "Own a House? List It for Lease" / "Owners: Post Your Lease Ad" /
  "Have a Home to Lease Out?"
- Other headlines: List Your Home for Lease Free · Get Tenant Calls Directly · Zero Commission
  Leasing · Post in 2 Minutes · No Broker, No Fees · Lease Out Villa or Flat · Reach Tenants Near
  You · Add Photos, Get Enquiries · Owner Listings Only Here · Post Lease Ad on Bhavano
- Descriptions:
  1. Own a house, flat or villa? Post it for lease free and get tenant calls directly.
  2. List in 2 minutes with photos. No brokerage, no commission. Manage enquiries in one place.
  3. Not looking for a house to lease? This is for owners who want to lease theirs out.
  4. Sign up with your phone number, add details and photos, and your lease ad goes live.

**Lease 3.1 Commercial — ad B**
- Pinned to position 1: "Own an Office or Shop?" / "Owners: List Space for Lease" /
  "Have Space to Lease Out?"
- Other headlines: List Commercial Space Free · Get Tenant Calls Directly · Zero Commission
  Leasing · Post in 2 Minutes · No Broker, No Fees · Lease Out Shop or Office · Reach Businesses
  Near You · Add Photos, Get Enquiries · Owner Listings Only Here · Post Lease Ad on Bhavano
- Descriptions:
  1. Own an office, shop or warehouse? Post it for lease free and get calls directly.
  2. List in 2 minutes with photos. No brokerage, no commission. Manage enquiries in one place.
  3. Looking for space to rent yourself? This is for owners who want to lease theirs out.
  4. Sign up with your phone number, add details and photos, and your lease ad goes live.

Measure: compare ad B against the existing ad on conversions per click and cost per poster after
~2 weeks; keep the winner, retire the loser. Same pattern can then be applied to Rent Out
Commercial 2.4.

### Second ads created (2026-09-28)

Three new responsive search ads, added **next to** the existing ad in each group (nothing
edited or removed), all with final URL `https://www.bhavano.com` (no landing-page change, by
decision):

| Ad group (Metro campaigns only) | New ad id | Existing ad id (control) |
|---|---|---|
| Lease 3.2 Residential | 826203751137 | 822727624064 |
| Lease 3.1 Commercial | 826203751140 | 822727106801 |
| Rent Out 2.4 Commercial | 826203751143 | 822723455732 |

Copy: as drafted above for both Lease groups. Rent Out 2.4 follows the same pattern (owner
qualifier pinned to position 1: "Own a Shop, Office or Space?" / "Owners: Post Space for Rent" /
"Have Commercial Space to Rent?"; "rent" wording in place of "lease"). All lines were length-checked
before creation (validate-only run first). Pinning three headlines to position 1 may lower the
ad-strength label; that is expected and is not a quality problem by itself.

Status at creation: enabled, policy review in progress (ad strength not yet rated). **Check
approval status the next day**; a disapproval would need rewording, most likely of "free" or
"no brokerage" claims.

Not done: Other-Metro copies of these groups (too little volume to test) and the Sell/Generic
groups (their existing ads already work).

**Test window: 2026-09-28 → ~2026-10-12.** Compare each new ad with its control on conversions per
click and cost per poster. Keep the winner, pause the other.

Rollback: pause the three new ads (`adGroupAds/202586212471~826203751137`,
`198411059486~826203751140`, `199363402229~826203751143`).
