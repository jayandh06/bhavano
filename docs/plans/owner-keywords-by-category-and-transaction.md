# Owner (poster-side) keyword bank by category and transaction type

Generated 15 Oct 2026. **Nothing here has been applied to the Google Ads account.** It is a list to review, then load with a script like `ads_apply_keyword_audit.py` (dry run first).

## How these were chosen

- Every phrase speaks as someone **with a property to offer**: "sell my…", "rent out my…", "lease out my…", "list my…", "post free … ad", "find tenants for my…". A seeker names where they are hunting ("flats for rent in koramangala"); an owner names what they own.
- No "near me", no bare `for rent` / `for sale` phrasing, and no **bare** city or locality names ("pg in bangalore"). Those are the seeker signals the 2026-10 audit removed (see [google-ads-keyword-audit-2026-10.md](google-ads-keyword-audit-2026-10.md)). A city is allowed only inside owner wording; see "City-named owner keywords" below.
- All 122 phrases were run through `classify()` in `ads_intent.py`, the classifier `ads_retarget_owners.py` uses to pause seeker keywords: **none is read as a seeker**. 95 read as owner; 27 come back "unknown" ("lease out…", "find tenants for…"), which that script leaves alone rather than pauses, because it has no markers for those wordings yet.
- Use **phrase match** to start, like the existing poster campaigns, and review search terms weekly.

## Keywords

| Category | Transaction | Suggested ad group | Keywords |
|---|---|---|---|
| House | Sell | Sell 1.x (house/villa group, e.g. 1.3) | `sell my house`, `sell my independent house`, `list my house for sale`, `post free house ad`, `sell house without broker`, `advertise my house for sale`, `sell my house directly to buyers` |
| House | Rent | Rent Out 2.3 / 2.1 | `rent out my house`, `put my house on rent`, `give my house for rent`, `list my house for rent`, `post free house rental ad`, `find tenants for my house`, `let out my house` |
| House | Lease | Lease 3.2 | `lease out my house`, `give my house on lease`, `list my house for lease`, `post house for lease`, `lease my independent house` |
| Apartment / flat | Sell | Sell 1.1 (apartment) | `sell my flat`, `sell my apartment`, `list my flat for sale`, `post free flat ad`, `sell flat without broker`, `advertise my apartment for sale`, `sell my flat directly to buyers` |
| Apartment / flat | Rent | Rent Out 2.1 | `rent out my flat`, `put my flat on rent`, `give my apartment for rent`, `list my flat for rent`, `post free flat rental ad`, `find tenants for my flat`, `let out my flat` |
| Apartment / flat | Lease | Lease 3.2 | `lease out my flat`, `give my apartment on lease`, `list my apartment for lease`, `lease my flat` |
| Villa | Sell | Sell 1.3 | `sell my villa`, `list my villa for sale`, `post free villa ad`, `sell villa without broker`, `advertise my villa for sale` |
| Villa | Rent | Rent Out 2.3 | `rent out my villa`, `put my villa on rent`, `list my villa for rent`, `find tenants for my villa` |
| Villa | Lease | Lease 3.2 | `lease out my villa`, `give my villa on lease`, `list my villa for lease` |
| PG | Rent | Rent Out 2.2 | `list my pg`, `advertise my pg`, `get tenants for my pg`, `post pg ad`, `pg listing site`, `pg owner app`, `fill rooms in my pg`, `list my hostel online`, `advertise pg for free` |
| Storage / warehouse | Rent | Rent Out 2.4 | `rent out my warehouse`, `list my godown`, `give my warehouse on rent`, `list my storage space`, `find tenants for my warehouse` |
| Storage / warehouse | Lease | Lease 3.1 | `lease out my warehouse`, `give my godown on lease`, `lease my storage space` |
| Coworking | Rent | Generic Post Ad Intent | `list my coworking space`, `list coworking space online`, `get members for my coworking space`, `advertise my coworking space`, `post coworking space ad` |
| Coworking | Lease | Lease 3.1 | `lease out my coworking space`, `list my coworking space for lease` |
| Furniture | Sell | Generic Post Ad Intent / furniture group | `sell my used furniture`, `sell old furniture online`, `sell my sofa online`, `sell my bed online`, `sell furniture online free`, `post furniture ad free` |
| Furniture | Rent | Rent Out 2.5 (currently paused) | `rent out my furniture`, `give my furniture on rent`, `list my furniture for rent` |
| Interiors (service) | Sell | Generic Post Ad Intent | `list my interior design business`, `advertise my interior design services`, `get interior design clients`, `post interior design ad`, `list my interior design studio` |
| Plot / land | Sell | Sell (plot group) | `sell my plot`, `sell my land`, `list my plot for sale`, `post free plot ad`, `sell land without broker`, `advertise my land for sale`, `sell my agricultural land`, `sell my site` |
| Commercial | Sell | Sell 1.5 | `sell my shop`, `sell my office space`, `list my commercial property for sale`, `sell my showroom`, `sell my commercial property without broker`, `advertise my shop for sale` |
| Commercial | Rent | Rent Out 2.4 | `rent out my shop`, `rent out my office`, `list my commercial property for rent`, `put my shop on rent`, `give my office on rent`, `find tenants for my shop` |
| Commercial | Lease | Lease 3.1 | `lease out my shop`, `lease my office space`, `give my shop on lease`, `lease my showroom`, `list my office space for lease` |
| Any category | Any | Generic Post Ad Intent | `free property listing site`, `post property ad free`, `list my property free`, `property listing site for owners`, `sell property without broker`, `rent property without broker`, `where to post property ad`, `how to list my property online`, `post free property ad`, `advertise my property for free` |

## City-named owner keywords (Metro-Rent Out, 2026-10-22)

**Why.** Last 30 days: generic owner keywords in Metro-Rent Out cost about Rs 24-30 a click; the city-named seeker groups cost Rs 13-15 (Bengaluru Rent Seekers Rs 15, Pune Rs 13). The owner's observation: location words are cheaper than generic ones. The seeker groups converted almost nothing (1 conversion in 227 Bengaluru clicks) because their searchers want a place, not to post one. So the aim is cheap city clicks from people who **own** something.

**Rule.** Pair the city with owner wording: `rent out my flat in bangalore`, never `flat in bangalore` or `pg in bangalore`. In this campaign, city search terms that leaked through (`pg in madhapur hyderabad`, `best pg in bangalore`, `coliving pg in pune`) were all seekers with 0 conversions.

**What `ads_add_owner_city_keywords.py` adds** (phrase match, enabled; 96 keywords):
- Cities: bengaluru, bangalore, hyderabad, chennai, mumbai, delhi, pune, kolkata.
- 2.1 House/Apartment: `rent out my flat in`, `rent out my house in`, `list my house for rent in`, `post my house for rent in`, `post rental property in`, `list my flat for rent in`.
- 2.2 PG: `list my pg in`, `post pg ad in`.
- 2.4 Commercial: `rent out my shop in`, `rent out my office in`, `rent out my warehouse in`, `list my commercial property for rent in`.
- Guards: each phrase must not classify as "seeker" in `ads_intent.classify()` (this caught `find tenants for my flat in <city>`, which has no owner marker, so it was replaced by `list my flat for rent in`); existing keywords and ones blocked by a negative are skipped. Dry run and Google `--validate` both clean.

**Not changed:** ads and landing pages (still generic), bidding, geo targeting, Other-Metro.

**To check after about a week:** search terms for seeker leakage (add exact negatives); CPA, not CPC, per city; whether the campaign's location targeting covers each city (a keyword for a city outside it will not serve); whether city-specific ad copy or `/post?city=<slug>` landing is worth adding. Status: **applied 2026-10-22** (96 keywords enabled; a re-run reports nothing left to add). First review of search terms and CPA around 2026-10-29.

**Status check, 2026-10-22 (same day):** all 96 showed "Under review" plus low search volume (`RARELY_SERVED`), expected for new, long phrases (six words, fixed word order). Review normally clears within about a day. **Fallback, prepared but NOT applied:** `python ads_add_owner_city_keywords.py --variant short` adds 80 shorter phrases (8 cities x 10): `rent out flat|house <city>`, `post rental property <city>`, `post property <city>` (2.1); `list my pg <city>`, `post pg <city>` (2.2); `rent out shop|office|warehouse <city>`, `post commercial property <city>` (2.4). Dry run clean, none skipped or blocked. Decide after 24-48 hours: if most long phrases are still low volume, apply `--variant short`; add exact negatives for any seeker terms that leak. Never move these to broad match.

## Pair with these negatives (exact) in the poster campaigns

Seeker phrases that match owner keywords by accident, per the audit: `house rent app`, `good house renting apps`, `best rental sites in hyderabad`, `plot for sale`, `property buy`, `property for sale in bangalore by owners`, `free house searching app`. Keep the phrase negative `near me` on Rent Out and Lease.

## Notes

- **Furniture and interiors** are included for completeness. Furniture rent (Rent Out 2.5) is paused because its search terms were furniture renters; interiors listers are service providers, a small audience. Start with the property categories.
- **Coworking and storage** have low search volume. Expect a handful of impressions each.
- **Landing pages:** an owner keyword should land on a posting page (`/post?...`), not a browse page. `/post` is disallowed in robots.txt, which is fine for paid traffic.
- Phrases that already exist in the account (`sell my villa`, `lease my flat`, `list my pg`, …) will be duplicates; check before loading.

## Thin ad groups filled (2026-11-01)
`ads_keyword_coverage.py` showed Sell Apartment / Villa / Commercial, Lease Commercial, both Generic Post Ad Intent groups and both Rent Out
Villa groups at 1-4 keywords each, and every keyword in the account as phrase match. `ads_add_thin_group_keywords.py` added **139 keywords**
(applied; a re-run reports nothing to add): about 80 owner-phrased phrase keywords in those ten ad groups (no "free"; phrases that
`ads_intent.classify()` reads as seeker, e.g. "post flat for sale", were skipped) and 57 exact-match copies of phrases that converted in the last
90 days, in the same ad group. Bids, ads and landing pages were not touched. Groups are now 7-16 keywords. **Check after about a week:** search
terms for seeker leakage, whether the exact copies take the converting traffic, and the Rent Out Villa groups (still near zero impressions).
**Ads vs keywords:** each ad group has one or two enabled responsive search ads whose headlines match its category (flat, villa, shop/office, lease,
generic), strength Good or Excellent, villa-for-rent Average. Headlines do not yet mention warehouse, showroom or "by owner". All ads land on the
home page. Coworking (8 keywords, 0 impressions) was not diagnosed.

**Headlines for the new keywords (2026-11-01, `ads_add_keyword_headlines.py`):** 10 enabled ads in Sell Apartment, Sell Villa, Sell Commercial,
Lease Commercial and Rent Out Villa (Metro and Other-Metro) were replaced by new ads with headlines that echo the added phrases ("Sell Flat By
Owner", "Lease Out Your Warehouse", "Rent Out Your Villa" and so on), swapping out slogan headlines ("Villa Sale Made Simple", "Trusted ... Site")
so each ad stays at 15; the old ads are paused, not removed. **Not done: the four enabled Generic Post Ad Intent ads (Metro and Other-Metro).**
Creating a new ad failed with "limit on the number of allowed resources": those two ad groups are at Google's ad limit because of paused ads
from earlier rewrites. Room needs one or more old paused ads removed, which the pause-never-remove rule forbids, so it is a decision for the owner.

## Sell keywords, generic and city-named (2026-11-18)
Trigger: "sell my house btm layout bangalore" showed no Bhavano ad while "rent my apartment in btm layout bangalore" did. Ad Group 1.1 only had
"sell my house online" (phrase match keeps word order, so no "online" means a weak match), and the 2026-10-22 city-named batch covered Rent Out only.
Live check: Metro-Sell search impression share 17% over 14 days, ~83% lost to rank and ~0% to budget, so the fix is relevance, not budget.

`ads_add_owner_sell_keywords.py` (applied, **298 phrase keywords**, validated first; a re-run reports nothing to add):
- Generic, no location ("sell my house", "sell my flat", "sell my plot", "sell my independent house", "sell my office"...), in Metro-Sell and Other-Metro-Sell groups 1.1-1.5.
  A plain "sell my house" phrase also catches locality searches such as "sell my house btm layout bangalore".
- City-named ("sell my house in bengaluru") for the cities each campaign targets today: Metro-Sell = bengaluru, bangalore, hyderabad, chennai, mumbai, delhi, pune, gurgaon, noida;
  Other-Metro-Sell = ahmedabad, jaipur, coimbatore, lucknow, kolkata (its 5 targeted cities).
- No "free" phrases; seeker-reading phrases, existing keywords and negative-blocked phrases skipped. Bids, ads and landing pages untouched.

**Not done / check after about a week:** search terms for seeker leakage; ad headlines that echo the new phrases ("Sell My House By Owner", "Sell House In Bengaluru") via `ads_add_keyword_headlines.py`;
impression share for Metro-Sell (the rank loss may persist if bids/tCPA are the limit).

**Headlines for the sell keywords (2026-11-18, `ads_add_sell_headlines.py`, applied):** 6 enabled ads were replaced by new ads (old ones paused, not removed): Sell House/Property 1.1 (2 ads each in Metro-Sell and Other-Metro-Sell) gained "Sell My House By Owner", "Sell Your House Online" (+ "List Your House For Sale" on the 12-headline ads), and Sell Villa 1.3 (both campaigns) gained "Sell Independent House" (+ "Sell My Villa Online" in Other-Metro). Slogan headlines ("Bhavano.com - Sell Faster", "India's Trusted Real estate", "Villa Sale Made Simple", "Sell Property, Save Time", "Post Ad, Get Genuine Leads") made room. **Not done:** Sell Flat 1.2, Plot 1.4 and Commercial 1.5 ads are at 15 headlines with nothing droppable, so they were skipped; city names are not in headlines (one ad serves several cities).

**Coworking and commercial owner keywords (2026-11-18, `ads_add_owner_coworking_keywords.py`, applied, 127 phrase keywords, validated first):** "rent my coworking space", "rent my coworking space in bangalore" and "rent my office space" showed no ad. Metro Rent Out Ad Group 2.6 (coworking) had 8 phrases, none "rent my" / "lease", no city names, 7 of 8 Rarely served (13 impressions in 30 days); Ad Group 2.4 (commercial) had one generic phrase ("list commercial space for rent") and only city-named "rent out my office in <city>" phrases, all Rarely served.
- 2.6 Metro: 43 (7 generic such as "rent my coworking space", "lease my coworking space"; 36 city-named across the 9 Metro cities).
- 2.4 Metro: 80 (15 generic such as "rent my office space", "rent my shop", "lease my office space"; city-named "rent my office space in <city>" etc.). 2.4 Other-Metro: 4 generic only (its city list was not re-checked).
- `ads_intent.py` OWNER_MARKERS gained "rent my", "lease my", "lease out", otherwise "rent my ... in bangalore" read as a seeker. Ads, bids and landing pages untouched.

**Plot headlines (2026-11-18, `ads_add_sell_headlines.py`, applied):** the 2 enabled Sell Plot/Land (1.4) ads, Metro and Other-Metro, were full at 15 (strength Excellent), so 3 slogan headlines ("Plot Sale Made Simple", "Post Ad, Get Real Buyers", "Plot Sellers Start Here") were swapped for "Sell My Plot By Owner", "Sell My Land Online", "Sell Land, No Broker"; old ads paused, not removed. Still skipped: Sell Flat 1.2 and Commercial 1.5 (full, nothing droppable).

**Flat and commercial headlines (2026-11-18, `ads_add_sell_headlines.py`, applied, 7 ads):** Sell Apartment/Flat 1.2 (4 ads) gained "Sell My Flat Online", "Sell Flat, No Broker" (+ "Sell My Apartment Online" on the two ads that had a third droppable); Sell Commercial 1.5 (2 ads) gained "Sell My Shop Online", "Sell My Office Space". Swapped out: "Get Buyer Calls for Flat", "Reach Buyers for Your Flat", "List Your Flat in 2 Mins", "Commercial Sellers Start Here", "List Your Property Today". The Metro Sell Villa ad also finally got "Sell My Villa Online". Old ads paused, not removed. Flat ads were rated Good and commercial Excellent before the change; recheck strength in the Ads UI.

**PG owner keywords (2026-11-18, `ads_add_owner_coworking_keywords.py`, applied, 45 phrase keywords, validated first):** "rent my pg in bangalore" showed no ad. Rent Out PG (2.2) already served ("list my pg" 101 impressions, "post pg for rent" 402 in 30 days) but had nothing worded "rent my pg" / "rent out my pg" / "lease my pg", and its city phrases ("list my pg in X", "post pg ad in X") were all Rarely served. Added 9 generic phrases to Metro and Other-Metro 2.2 and city-named "rent my pg in X", "rent out my pg in X", "list my pg for rent in X" for the 9 Metro cities (36 in Metro, 9 in Other-Metro). "find tenants for my pg in X" was dropped: ads_intent reads it as a seeker phrase.
