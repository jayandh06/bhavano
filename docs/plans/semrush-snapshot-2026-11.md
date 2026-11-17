# Semrush snapshot — bhavano.com (India DB), 2026-11-17

Pulled with the last of the monthly API quota before the Semrush subscription ended (~42.9k units at start, ~27.6k left unspent).

## Headline numbers
| Metric | Value |
|---|---|
| Semrush rank (IN) | 271,478 |
| Organic keywords / est. traffic | 292 / 1,095 per month |
| Paid keywords | 0 |
| Backlinks / referring domains | 175 / 129 |
| Authority Score | 11 |

## Growth trend (monthly, resource_rank_history)
| Month | Keywords | Traffic |
|---|---|---|
| 2026-07 | 7 | 0 |
| 2026-08 | 75 | 97 |
| 2026-09 | 130 | 206 |
| 2026-10 | 226 | 909 |
| now | 292 | 1,095 |

Only one keyword was lost in the last period, so the locality-page strategy is compounding.

## What ranks (top by traffic)
Almost all traffic comes from **locality landing pages** (`/<city>/<locality>`), not buy/rent facet pages or blog:
- kalindi housing (pos 6, vol 5.4k) → `/kolkata/kalindi-housing-estate`
- arekere mico layout 2nd stage (5, 4.4k), seethappa layout (5), chinnappa layout (7), bogampatti (7), aditi apartment (14)
- Blog barely contributes (BHK explainer, down payment, DTCP) — ranks 14–60.

## Quick wins: high volume, already ranking 11–30 (push to page 1)
| Keyword | Pos | Volume | Page |
|---|---|---|---|
| ghatlodiya | 25 | 33.1k | /ahmedabad/ghatlodiya |
| iti layout | 14 | 22.2k | /bengaluru/iti-layout |
| thirumalashettyhally | 11 | 12.1k | /bengaluru/thirumalashettyhally |
| kalasipalya bengaluru karnataka | 23 | 22.2k | /bengaluru/kalasipalya/buy |
| telecom nagar gachibowli | 26 | 22.2k | /hyderabad/telecom-nagar |
| rbi layout | 23 | 12.1k | /bengaluru/rbi-layout |
| house for rent in hyderabad | 26 | 14.8k | /hyderabad/rent-lease/house |
| karolan ka barh | 24 | 14.8k | /jaipur/karolan-ka-barh/buy |
| naya bans | 20 | 9.9k | /delhi-ncr/naya-bans-village/buy |
| down payment | 26 | 9.9k | /blog/down-payment-for-a-home-loan |
| bund garden road | 16–17 | 6.6k | /pune/bund-garden-road |

Position 30–60 with big volume (content/internal-link candidates): anchepalya rent (38, 33k), carmelaram (48, 40k), chikkalasandra rent (41, 27k), bongulur (38, 22k), bhk (35, 12k), dtcp approval (66, 12k).

## Wrong-page / cannibalisation signals
- Several keywords land on a **city page** instead of the locality: `white wings zenon`, `renuka bhavan surat` → /surat; `magnolia baner`, `navjeevan sundarban` → /pune; `bhuvanappa layout`, `balangala` → /bengaluru/koramangala; `hsr 6th sector`, `fernhill gardens...`, `hnr layout` → /bengaluru/hsr-layout.
- Some **individual listing pages** rank (e.g. `bren champions square`, `ruby royal tower`) — listing detail pages are indexable and picking up long-tail.
- `bhuiyadih` and `anugondanahalli` rank on deep facet URLs (`/rent-lease/villa`, `/buy/apartment/4bhk`) rather than the locality page — consider a canonical/internal-link check.
- Mixed `bhavano.com` vs `www.bhavano.com` URLs appear in the index (`https://bhavano.com/pune`, `/bengaluru/hsr-layout`). Verify the apex → www redirect is a 301 everywhere.

## Backlinks — profile is mostly junk
Of the 129 referring domains almost all are spam: `.xyz`/`.shop`/`.site` SEO-service domains (`seolinkagency`, `pbnlinks`, `offpage*`, `domraider.*`), casino and pharma sites. Authority Score 11. Looks like negative-SEO / link-spam noise, not earned links.
- Action to consider: Google Search Console disavow file for the obvious spam TLD clusters. Google mostly ignores this, so low priority, but check GSC "Manual actions" is clean.
- Real opportunity is earned links (local press, builder/RWA directories) — none exist today.

## Competitors (organic, shared keywords)
housing.com (45), 99acres.com (42), magicbricks.com (39), nobroker.in (27), mappls.com (20), aurumproptech.in (18), dwello.in (14), squareyards.com (10). Mappls and dwello.in are the beatable ones (smaller footprint).

## Keyword gap vs housing.com (they rank top-100, we don't)
Top gap terms are big head locality names with 300k–1.5M volume: kashmere gate, hosur, indira nagar, shivaji nagar, hadapsar, hebbal, koramangala, marathahalli, mehdipatnam, uppal, bellandur, btm layout, kompally, madhapur. These are heavily contested (KD 30–50); the shape that worked is the **long-tail locality** pages, so prefer the unusual localities housing.com doesn't cover.
Also non-listing utility intents with huge volume: `meters to feet`, `feet to meter`, `meter to feet` (550k), `home loan calculator` (450k, KD 81) — a calculator/converter page is a possible tool-page play, but check intent fit first.

## Not done
- No Site Audit / Position Tracking: needs a Semrush project; none was set up.
- No gap vs 99acres/magicbricks (only housing.com).
- Keyword research tools (related/questions/KD) not used.

## Keyword gap vs 99acres.com (added later, top 100 by volume)
Same shape as the Housing.com gap: head locality names we have no ranking for, all 300k–1M searches/month and KD 30–50 (hebbal, hadapsar, electronic city, whitefield, kukatpally, kengeri, miyapur, wakad, chakan, bandra kurla complex, anna nagar, velachery, nangloi, zirakpur, ameerpet, hitech city).
Overlap with Housing.com gap: indira nagar, karol bagh, marathahalli, hsr layout, mehdipatnam, uppal, guindy, sholinganallur — these are the ones **both** big portals cover, so likely worth having a strong page for.
New vs the Housing.com list: 99acres also ranks for government/land-record queries (bhu naksha, bhulekh up, mp bhulekh, jharbhoomi, bhoomi rtc, cg bhuiya, apna khata, digital 7/12 — 0.5M–2.7M searches, KD 21–47). Cheapest to attack: `bhu naksha` (KD 21), `rtc online` (KD 19), `mpbhulekh` (KD 23), `ppp haryana` (KD 17). Per-state "how to check land records online" guides would fit the blog and the existing DTCP/BDA content. Caveat: users of these queries want the government portal, so expect low conversion to listings.
Also: `home loan emi calculator` (450k, KD 63) and `pg near me` (550k, KD 38; we already have /pg pages).
Units left after this pull: ~19.6k.
