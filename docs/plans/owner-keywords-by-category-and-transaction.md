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
