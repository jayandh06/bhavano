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

## Poster keyword cleanup, 2026-10-27
Audit of the owner/poster campaigns (Metro-* and Other-Metro-*, not the seeker ones), last 30 days: 284 live keywords, 139 with no impressions; 5 keywords spent
₹150 or more with no conversion (₹1,231 of about ₹66k); no live keyword with quality score 4 or below; no duplicate within a campaign and only 4 across campaigns.
- **Junk keywords removed (not paused) by the owner in the Ads UI** while the script was being prepared: 34 criteria, all with zero impressions. Competitor names
  (99 acres, 99acres rent house, property 24, olx rent for house, justco coworking space, home4rent), unrelated phrases (apna ... kaise beche, digital products
  selling websites free, noida property rates, corporate leasing companies), tenant-side phrases (house for rent, house rent, rent house, lease house), plus
  "i want to rent my property to brands / zepto" and "vj indiworks kothrud". `ads_clean_poster_keywords.py` would have done the same removal, with a JSON backup and
  `--restore`; it found nothing left to remove.
- **Competitor negatives added by `ads_clean_poster_keywords.py`:** 23 phrase-match negatives on all 9 poster campaigns (189 operations, validated first): olx, 99acres,
  99 acres, magicbricks, magic bricks, quikr, quicker home(s), nestaway, commonfloor, sulekha, squareyards, square yards, makaan, proptiger, home4rent, justco, zolo,
  colive, stanza living, housing.com, housing com, property24. Competitor-name search terms had cost ₹219 for 5 clicks and 0 conversions in 30 days.
  **"nobroker" was first skipped** because the live keyword "nobroker post free ad" would be blocked by it; the script checks each negative against the keywords we keep.
  Later the same day the owner asked to remove that keyword (Metro-Generic and Other-Metro-Generic Post Ad Intent, Ad group 1; 0 impressions in 30 days) and add "nobroker":
  both done by the script (11 operations), so the negatives are now 24 phrases on 9 campaigns. The two removed keywords are in `ads_removed_keywords_2026-10-27.json` and can be
  re-created with `--restore` (which also removes the 9 negatives recorded there).
- Left alone on purpose: "lease property online" (₹273, 0 conversions: a real owner phrase with a small sample), the 100 or so zero-impression city and category
  long-tail keywords in Metro-Rent Out (no cost), and the five 0-conversion keywords above ₹150 other than that (3 to 14 clicks each).
- Rollback of the negatives: remove them in the Ads UI (Negative keywords list of each poster campaign). `--restore` only re-creates keywords the script itself removed,
  from `ads_removed_keywords_2026-10-27.json`; no such file exists because the owner had already removed the junk keywords.

## Adding proven converters, 2026-10-27
In the last 30 days 126 search terms led to a "post ad" conversion in the owner campaigns, and only 9 were keywords (the rest came through phrase matches of other keywords).
`ads_add_owner_converting_keywords.py` (dry run, Google-validated, applied: 19 operations) added **19 phrase-match keywords**, each in the ad group where the term already converts:
- Metro-Rent Out, Ad Group 2.1: rent my property, post property for rent in bangalore, post property for rent, rent out property, free listing of property for rent, post property for rent free.
- Metro-Generic Post Ad, Ad group 1: free property ads posting sites in india, free property listing sites, post your property for rent, post property ad.
- Metro-Sell, Ad Group 1.1: post free property ads, free posting property ads, property sell, free real estate ads, free property sale sites.
- Other-Metro: Rent Out 2.1 "property post for rent"; Generic "free property listing"; Sell 1.1 "property selling websites"; Sell 1.2 "sell your flat".
About 50 conversions in 30 days came from these terms. **Left out on purpose:** "property sale" (phrase match also catches buyers: "property sale in <city>"), tenant-side terms ("house for rent",
"best app for room rent", "free app to search house for rent", "how to rent a house in bangalore"), "freeperty" (₹338, one conversion) and "renting sites" (₹146 for 2 clicks).
Why this is safe for quality score and ad rank: new keywords have their own quality score and do not change the existing keywords'; no broad match, no new ad groups, ads untouched.
**Check after about 14 days:** pause any of the 19 with quality score 4 or lower, or CPC above about ₹60 with no conversion. Rollback: `python ads_add_owner_converting_keywords.py --remove`.
Not done: category-gap keywords (PG, coworking, agents); check search volume before adding them.

## Free keywords and ad relevance, 2026-10-27
Landing page experience is average or above on every scored owner keyword; the weak score is **ad relevance** (31 of 79 below average). Much of it comes from keywords that say "free"
while the ads do not: the owner ads deliberately stopped saying "free" on 2026-09-30 and 2026-10-12 so it would not prime resistance to the paid Featured upsell, although posting is free
today (every listing fee is 0). Options considered: put "free" back into the ads of the free-keyword ad groups, split Generic "Ad group 1" into themed ad groups, or take the "free"
keywords out. The owner chose to take them out of the keyword list, and keep "free" out of the ad copy (`ads_free_ads_relevance.py`, which drafted the ad and ad group version, was
never run).
- **Numbers (30 days, live owner keywords):** 62 contain "free": 32% of spend (₹21.2k of ₹66.5k), 118 of 412 conversions (29%), CPA ₹180 against ₹154 for the rest. Removing all of
  them would lose about 118 conversions a month, so only the ones with no conversions went.
- **Removed (not paused) by `ads_remove_free_keywords.py`, validated first, 30 operations:** the 30 live "free" keywords with no conversion in 30 days (30-day spend ₹1,269; 10 of them were
  below average on ad relevance), mostly Metro-Generic and Other-Metro-Generic "Ad group 1" (for example "free ad posting for house rent", "free ad posting for property sale",
  "post free rental ads online", "post free ad for flat on rent", "free ad posting for rental property" in Other-Metro, ₹353 with no conversion). Backup:
  `ads_removed_free_keywords_2026-10-27.json`; `python ads_remove_free_keywords.py --restore` re-creates them.
- **Kept:** the 23 "free" keywords that earned conversions (for example "free property listing site" 33 conversions, "post rental property for free" 14, "free property ads posting sites" 13,
  "post free ad for rent" 6) and the 9 added the same day by `ads_add_owner_converting_keywords.py` (no data yet; the script protects them).
- **Expect:** a small gain at most. The keywords left are the ones that earn, and several still score below average on ad relevance (for example "post rental property for free",
  "post free ad for rent", both quality score 8). Their price is the relevance gap; the remaining way to close it without "free" in the ads is a decision to allow "free" in the Generic
  ad group's ads again, or to accept it.
- **Check in about 14 days:** quality score and ad relevance for the kept "free" keywords, total post-ad conversions against the 118 baseline.

### Do "free" keywords hurt Featured purchases? Re-measured 2026-10-27
`python ads_free_keyword_performance.py` (read-only, ad-group level, since 2026-09-20, the day purchase conversions started uploading): 8 ad groups have an enabled "free" keyword (Generic Ad group 1 in both
city groups, Rent Out 2.1 in both, Sell 1.1 in both, and the Sell 1.5 junk group).
| | clicks | posts | posts per click | Featured purchases | per click | per post |
|---|---|---|---|---|---|---|
| Ad groups with a "free" keyword (8) | 1,766 | 339 | 19.2% | 48 | 2.72% | 14.2% |
| All other ad groups (48) | 2,118 | 170 | 8.0% | 26 | 1.23% | 15.3% |
So the September finding ("post at about twice the rate but only half as many go on to boost") **no longer holds**: the share of posters who buy Featured is the same (14% against 15%),
and the "free" ad groups produce 65% of all Featured purchases (48 of 74). Caveats: ad-group level, so a group counts as "free" even if only some of its keywords say it (Rent Out 2.1 has 6 of
about 135); "all conversions" counted; small numbers. Consequence: do **not** remove the 23 earning "free" keywords; the earlier reason for keeping "free" out of the ad copy (priming resistance to the
upsell) is not supported by this data and can be revisited with an ad test (see `ads_free_ads_relevance.py`, not run).

### A second ad with "free" in six ad groups, 2026-10-27
Chosen over splitting the Generic ad group or removing more "free" keywords: keep the existing ad (no "free") as the control and add a second responsive ad that mirrors the "free" keywords,
so Google rotates the two and the "free" keywords finally have an ad that says "free". `ads_free_ads_relevance.py` (dry run, Google-validated, then applied) created **6 ads**, nothing paused or removed:
| Ad groups | New ad | Path |
|---|---|---|
| Metro-Generic and Other-Metro-Generic, Ad group 1 | "Post Free Property Ads", "Free Property Ads Posting Site", "Free Real Estate Ads Posting", "Advertise Property For Free" ... | /post/free-ads |
| Metro-Rent Out and Other-Metro-Rent Out, Ad Group 2.1 | "Free Rental Listing Site", "Post Rental Property Free", "List Your Property For Rent" ... | /post/rent-free |
| Metro-Sell and Other-Metro-Sell, Ad Group 1.1 | "Free Property Listing Site", "Post Free Property Ads", "Free Property Sale Ads", "Free Real Estate Ads" ... | /post/sale-free |
Descriptions say "Zero platform fees to post", "no broker" and "Upgrade to Featured later", which are true today (all listing fees are 0). Final URL is the home page, as for the existing ads (the posting card follows the ad group,
which did not change).
- **Not done:** the ad group split from the earlier draft (no new ad groups, no web change).
- **Judge it in 14 to 21 days:** per ad (Ads UI > Ads, segment by ad), compare "Post ad success" and "Boost purchase" conversions per click for the two ads in each group; pause the loser. Also check ad relevance
  for the "free" keywords (Keywords tab, quality score columns). Google rotates for clicks, so an uneven split is normal.
- **Rollback:** `python ads_free_ads_relevance.py --rollback` pauses the six new ads (found by their /post/free-ads, /post/rent-free, /post/sale-free paths); the old ads are untouched.

## Ad rank quick fixes, 2026-10-27
Checked first: landing page experience is average or above everywhere, expected CTR is mostly above average, and 23 of 40 enabled ads were rated Excellent. The gaps were extensions and one weak campaign.
`ads_relevance_assets.py` (dry run, Google-validated, applied as 83 operations; backup `ads_relevance_assets_backup.json`, `--rollback` undoes it):
- **Other-Metro-Seeker Intent ads:** its four Rent ads were a plain city swap of the Bengaluru ad and rated Poor (Ahmedabad, Lucknow) or Average (Coimbatore, Jaipur). Each city now has a new ad with 15 headlines and
  4 descriptions (city plus house / 2BHK / PG / apartments / rental homes variants, no "verified"); the old ads are **paused, not removed**. New ads show strength PENDING until Google rates them.
- **Sitelinks:** the same 4 sitelinks Metro-Seeker uses are now linked to Other-Metro-Seeker (it had none).
- **Images:** the 6 image assets of Metro-Generic are now also linked to Metro-Rent Out, Other-Metro-Rent Out and Metro-Lease (they had none).
- **Callouts:** 7 owner campaigns (Generic, Rent Out, Sell in both city groups, and Metro-Lease) got a campaign-level set of 7: Zero Brokerage, Free to Post Ads, Direct Owner Contact (the accurate account callouts)
  plus Photos & Video Uploads, Post In 2 Minutes, Message Tenants Directly, Reach Buyers & Tenants. A campaign-level set replaces the account-level one for that campaign, so the account callout
  "Verified Listings" no longer shows on the owner campaigns.
- **Open issue, not changed:** "verified" claims remain on the seeker side: the account callout "Verified Listings" (still on the seeker campaigns) and the Metro-Seeker ads ("Verified Rental Listings", "Browse verified flats...").
  `docs/plans/metro-seeker-sitelinks.md` records that the product has no verified-only listings, so these can be disapproved as misleading or are simply untrue. Recommend replacing them (for example
  "Owner-Posted Rental Listings"). Needs a decision, because it touches the seeker campaigns that are running.
- **Still to decide (cost money):** a modest Target CPA increase (owner campaigns lose 51 to 67% of impressions to rank, none to budget), keyword insertion in headlines for the big mixed ad groups, and bids by city and hour once
  conversions per city and hour are measured.

### Removing the "verified" claims, 2026-10-27
Scan: 110 ads in the account mention "verified" ("Reach Verified Tenants" 31 times, "Verified Rental Listings", "Verified Sale Listings", "Browse verified flats...", "...verified buyer inquiries", lease ads), plus 4 "Buy Property"
sitelinks ("Browse verified listings online") and the account callout "Verified Listings". The product has no verified-only listings, so these are claims we cannot back (misleading-ad risk). Only what is serving now was touched:
27 ads (Metro-Seeker 7, Metro-Rent Out 4, Metro-Sell 5, Metro-Lease 2, Other-Metro-Rent Out 4, Other-Metro-Sell 5), 7 sitelink links, the callout. Ads that are paused, or in paused ad groups or campaigns, still contain the word and are left as they are.
`ads_remove_verified_claims.py` works in two phases because Google cannot edit ad or sitelink text and a gap while new text is reviewed would cost impressions:
1. **Phase 1 (done, 40 operations, validated first):** created the replacement ads ("Reach Tenants In Your City", "Owner-Posted Rental Listings", "Owner-Posted Sale Listings", "Get Tenant Enquiries Directly", "Reach PG Seekers In Your City"...; the word is simply
   dropped from descriptions), a callout "Owner-Posted Listings" and 4 sitelinks "Browse listings online". The old ones are untouched and still serve. Backup: `ads_remove_verified_claims_backup.json`.
2. **Phase 2 (pending):** `python ads_remove_verified_claims.py --status`, and once the new ads show APPROVED, `python ads_remove_verified_claims.py --finish` pauses the old ads (never removes) and unlinks the old callout and sitelinks.
   `--finish` only touches items whose replacement is approved. At the time of writing the new callout and sitelinks were APPROVED and the 27 ads still under review.
`--rollback` pauses the replacement ads and unlinks the replacement assets.

### Keyword words missing from headlines, 2026-10-27
Ad relevance compares the ad with the keyword, so a keyword word that appears in no headline of the ad group hurts. Live keywords weighted by 30-day spend, words missing from every headline:
- Rent Out 2.1: "best" and "place" ("best place to list apartment for rent": cost 3,486, 25 conversions), "advertisement" (436); Generic Ad group 1: "rental" (4 keywords, 1,375, 11 conversions), "apartment", "house", "advertising";
  Sell 1.1: "advertise"; Sell 1.2: "classified" (490); Lease 3.2 and Bengaluru seekers: "apartment" (583 and 1,490); Rent Out 2.4: "property" (10 keywords, 966).
`ads_keyword_headlines.py` adds one new ad per ad group (path /post/kw-match), a copy of the group's main ad with the "verified" wording stripped and its last generic headlines swapped for ones carrying the missing words
("Advertise Rental Property", "Apartment Rental Ads", "Apartment Classified Ads", "Rent Out Your Property"...). Nothing paused or removed.
- **Created now (6, validated first):** Generic Ad group 1 and Sell 1.2 and Rent Out 2.4 in both city groups.
- **Waiting (5 groups at the 3-ads-per-group limit):** Rent Out 2.1 (Metro and Other-Metro, the 3,486 keyword), Sell 1.1 (both) and Lease 3.2. They free up when `ads_remove_verified_claims.py --finish` pauses the old versions; then rerun
  `python ads_keyword_headlines.py` (it skips groups that already have the ad). Metro-Seeker "apartment" headlines are deferred until the replacement seeker ads are final.
- Rollback: `python ads_keyword_headlines.py --rollback` pauses these ads. Re-measure ad relevance (Keywords tab) in about 14 days, together with the free-ads test and the verified-claims fix.

### Star keyword ad groups, 2026-10-27
One ad group per keyword is a poor idea for a whole account (close variants make the "perfect" match leak, and about 370 conversions a month spread over hundreds of groups gives bidding and ad tests almost no data), but it is worth it for the few
keywords that carry the conversions and whose ad relevance lags. `ads_star_keyword_groups.py` (dry run, Google-validated, applied: 24 operations) created **8 star ad groups**, each in the same campaign as the original, with one keyword
(same text and match type) and one ad written for exactly that keyword (12 headlines, 4 descriptions):
| Keyword | Campaigns |
|---|---|
| best place to list apartment for rent (25 conversions, ₹3,486) | Metro-Rent Out |
| free property listing site (33 + 14 conversions) | Metro-Sell, Other-Metro-Sell |
| post rental property for free (14 + 3) | Metro-Rent Out, Other-Metro-Rent Out |
| free property ads posting sites (13 + 4) | Metro-Generic, Other-Metro-Generic |
| post free ad for rent (6) | Metro-Generic |
The **original keywords stay enabled** in their old ad groups: Google serves one ad per search, so old and star compete for 14 days and the better one wins. Nothing was paused or removed.
Home page card: the posting card follows the ad group id, so the new ids were added to `AD_GROUP_INTENTS` in `apps/web/src/lib/adLandingCard.ts` (rent_home for rent ones, sell_property for the two Sell stars; "free property ads posting sites" keeps the generic card)
and to `apps/bff/src/ads/campaign-names.ts` for the admin names. Needs a web and BFF deploy.
**Judge in 14 days** (Ads UI > Keywords, same keyword text, two rows): impressions, conversions and cost per conversion for the star against the original, plus quality score and ad relevance. Pause the loser (the original if the star wins).
Rollback: `python ads_star_keyword_groups.py --rollback` pauses the star ad groups.

### Empty Rent Out Villa ad groups, 2026-10-27
Google's recommendation "1 ad group does not have any keywords" (+11.3%) points at "Ad Group 2.3 - Rent Out Villa/Independent House". It exists in Metro-Rent Out and Other-Metro-Rent Out with enabled ads, but all four of its keywords
("rent out villa online", "list bungalow for rent", "post independent house for rent", "rent out my independent house") were paused on purpose: zero impressions in 30 days, "a demand problem, not a wording one"
(`ads_keyword_cleanup_2026_10_08.py`). The +11.3% is Google's generic estimate and is most likely 0 here, because there is little search volume.
`ads_add_villa_rent_keywords.py` (dry run, Google-validated, 8 operations) added four different, owner-voice phrases from `owner-keywords-by-category-and-transaction.md` to both groups, PHRASE match: rent out my villa,
put my villa on rent, list my villa for rent, find tenants for my villa. A keyword with no search volume costs nothing, so this is a free test and clears the flag. **If both groups still have zero impressions after 30 days (about 27 November), pause the
ad groups instead.** Rollback: `python ads_add_villa_rent_keywords.py --remove`.

### AI Max for Search, 2026-10-27
Found while reading Google's "Turn on Final URL expansion" card: `campaign.ai_max_setting.enable_ai_max` is **True on 11 campaigns** (all enabled owner campaigns, Metro-Lease, Metro-Seeker, and the paused ones); off only on Other-Metro-Seeker (created through the API) and the paused Performance Max.
It was not set by us on purpose. Its contribution, from the search term report split by `segments.search_term_match_source` (last 30 days):
| | impressions | clicks | cost | conversions |
|---|---|---|---|---|
| Owner campaigns, matched by our keyword | 8,065 | 743 | ₹25,815 | 156 (CPA ₹165) |
| Owner campaigns, AI Max (keywordless + broad) | 33 | 2 | ₹23 | 0 |
| Owner campaigns, source "unknown" | 955 | 101 | ₹3,567 | 5 (CPA ₹717) |
| Seeker campaigns, AI Max broad | 96 | 8 | ₹247 | 0 |
So AI Max-matched traffic is negligible and has not converted. Its other parts carry risk: automatic headline rewriting (could reintroduce claims such as "verified") and final URL expansion (breaks the per-ad-group landing card and tracking).
Decision (owner, 2026-10-27): turn it off if it proves not useful; the numbers say so. `ads_turn_off_ai_max.py` (dry run lists 8 enabled campaigns; `--rollback` turns it back on) was written, but **Google's validation rejected the change
("This feature is only available for campaigns with AI Max enabled") and then rate-limited the API (retry in about 23 minutes).** Not applied yet. If the API cannot disable it, do it in the Ads UI: Campaign > Settings > AI Max for Search > turn off.

### Six sitelinks on the seeker campaigns, 2026-10-27
Google: "add at least six sitelinks to your campaigns" (ads serve in the most prominent formats). The owner campaigns already have 7 each; Metro-Seeker and Other-Metro-Seeker had 4. `ads_seeker_six_sitelinks.py` (validated first, 4 operations) linked two
existing assets to both: "Rent a Home" (/rent-lease, "no brokerage fee") and "Contact Us" (/contact), so each now has 6. No new assets, nothing removed; `--rollback` unlinks them.
Note: the ad preview in that recommendation still shows "Browse verified flats..." because the old seeker ads keep serving until `ads_remove_verified_claims.py --finish` runs after Google approves the replacements (status could not be read: the API
is rate-limited, "Retry in about 15 minutes").
**Operational note:** the Google Ads developer token has *explorer access*, so the API rejects requests after a limited number of operations per period (HTTP 429 "Number of operations for explorer access"). Large read-only audits trigger it. Applying
for basic access removes the limit.

