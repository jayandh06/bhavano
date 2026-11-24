# Host Bhavano in the US as a separate market

## Status: direction decided 2026-11-24 (Option B: US under `bhavano.com/us/`), nothing built

**Decision (owner, 2026-11-24): Option B.** India stays at the root with no URL changes; the US lives under
`www.bhavano.com/us/`. This supersedes the separate-domain suggestion in "Recommendation" and "URL structure" below
(kept for the reasoning). Separate stack/database per market remains the recommendation; Caddy routes `/us/*` to it.

**Ask (owner):** serve the US market as well as India (www.bhavano.com is India-only today) and keep the two
sites properly segregated.

**Basis:** a quick read of the code (City/Area/User schema, Caddyfile, deploy layout, grep of India assumptions:
about 900 hits of `+91`, `INR`, `₹`, `en-IN`, `Asia/Kolkata` across 212 files in `apps/`) and the existing plans. It is
not a full audit; step 1 below is the audit.

## Recommendation

**One codebase and one deployment per region, with a `Country`/market dimension in the data, and a separate domain
per market.** Not a fork, and not a path prefix (`/us/...`) on bhavano.com.

- India stays on `www.bhavano.com` untouched (its SEO, ads and app links are live and must not move).
- US gets its own host, e.g. `bhavano.us` or `us.bhavano.com`. Pick the domain first: a separate ccTLD/domain reads
  as a separate site to users and to Google, and `hreflang` plus separate Search Console properties keep the two
  from competing. A subfolder shares authority but tangles canonical, sitemap and city-slug rules (see below).
- Start with a **second stack, same code** (own database, own Caddy host, own admin) rather than one shared database:
  the two markets share no users, listings, cities, prices or payment rails, and separate databases make privacy,
  outages and mistakes (a US reseed touching India data) impossible to cross. Revisit a shared admin later.

Alternative considered: one shared database with `countryId` on City/User/Listing. Cheaper to run, but every query
in about 100 plans' worth of features must be scoped correctly, and one missed filter leaks US listings into India
(or the reverse). Choose it only if cross-market users matter (NRIs searching both), which is not needed for a launch.

## What differs in the US (the real work)

This is not a translation job; the product assumptions change:

| Area | India today | US needs |
|---|---|---|
| Market shape | Owner-direct posting, brokers, rent/buy/PG/coworking | Listings flow through MLS/Zillow/Realtor.com for sale; owner-direct is FSBO and rentals (Craigslist, Facebook, Apartments.com). Decide the wedge first (rentals and FSBO are the realistic owner-direct niche). Categories (PG, coworking, plots) mostly do not apply. |
| Currency, units | INR, price in words (lakh/crore), sq ft / sq yd / cent | USD, `$1,250/mo`, sq ft only, bed/bath counts, no lakh/crore words. `listing-price-in-words` and multi-unit area features become market config. |
| Locations | 37 served cities, catchment km, Google geocoding, state names | US city + state (+ ZIP), neighbourhoods, counties. Same `City`/`Area` model works, but slugs collide (Springfield) so US slugs need the state (`austin-tx`). |
| Login | Phone OTP via MSG91, WhatsApp templates, Google, Apple, email | Phone OTP via Twilio/Verify (A2P 10DLC registration and TCPA consent for any SMS), email and Google/Apple as the primary path. WhatsApp is marginal in the US; email and push replace it. |
| Payments | Razorpay, Apple IAP and Google Play in INR | Stripe (or Apple/Google IAP at USD price tiers); sales-tax handling; refund and chargeback norms differ. |
| Legal | Finfolia entity disclosure, India privacy | US entity (or Finfolia's US arm), Terms and Privacy for CCPA/state laws, **Fair Housing Act**: ads must not state preferences by race, religion, family status etc. (affects free-text descriptions and the "bachelors/veg only" style filters, which must not exist in the US). Real-estate licensing rules for anything that looks like brokerage. |
| Ads | Google Ads customer 4214066478, India geo | New Google Ads account or campaigns geo-targeted to US, new conversion setup, USD budgets; housing-ads special category rules apply (no targeting by age, gender, ZIP on Google/Meta). |
| Mobile | Single app, India storefront App Store link | Same app and bundle: add the US storefront in App Store Connect and Play availability; storefront-specific listing text, screenshots, pricing tiers. The in-app market must follow the account or the chosen market, not the store. Min-version/forced-update stays shared. |
| Hosting | Single host in Mumbai (13.205.0.54), R2/CDN for photos | A US region host (e.g. AWS us-east/us-west) for the US stack so pages and API are not 200+ ms away; Caddy/compose pattern copies as is. Photos already on R2/CDN. |
| Time zone, locale | IST, `en-IN` | Multiple US time zones: store UTC and render in the viewer's zone; `en-US` formats. Admin Page visits "days are IST" becomes per-market. |

## Plan

**Built 2026-11-24 (step 2, first part):** `packages/types/src/market.ts` (`@bhavano/types/market`): `MARKETS` (`in`, `us`),
`getMarket` (unknown falls back to India), `marketFromPath` (only `/us` and `/us/...` are the US), `marketPath`,
`stripMarketPrefix`, `formatMoney`, `isValidNationalPhone`. India's values equal the old hardcoded ones. First consumer:
`goLiveTimeText` takes an optional market (default India; test proves identical output). Nothing else reads it yet; the US
entry is `indexable: false`. Tests: `apps/bff/src/market/market.spec.ts`.

1. **Audit (before any code):** list every India assumption (grep: `+91`, `INR`, `₹`, `en-IN`, `Asia/Kolkata`,
   `lakh`, `sq yd`, MSG91, WhatsApp, Razorpay, `isServed`, GST) and sort each into: market config, needs a US
   equivalent, or India-only (leave). This becomes the work list.
2. **Market config:** introduce a single `market` object (country code, currency, locale, time zone, units, phone
   rules, payment provider, enabled categories, legal links, support contacts) selected by environment
   (`MARKET=IN|US`) and shared through `packages/types`. India values equal today's behavior, so India is unchanged.
3. **Stand up the US stack:** domain, host, Postgres, Caddy, GitHub Actions deploying the same images to a second
   target (the current `deploy-from-registry.ps1` takes a host; parameterize it). Separate secrets and env.
4. **Seed US data:** cities (start with 3 to 5, as India started with 11 ad-target cities), neighbourhoods, slugs with
   state, categories (rent/sale houses and apartments first).
5. **US auth, payments, legal pages, Fair Housing guardrails** (description checks, no discriminatory filters).
6. **SEO:** own sitemap, robots, canonical and `hreflang` only if the same page exists in both markets (it will not
   at first, so none). Keep `bhavano.com` robots/sitemap untouched (CLAUDE.md rule).
7. **Mobile:** market-aware API base URL chosen from account/selection, US App Store/Play availability, USD store
   pricing. Needs an app release.
8. **Soft launch** with one city and a small Google Ads budget; measure before expanding.

## Decisions needed from the owner

1. Domain: `bhavano.us`, `us.bhavano.com`, or another? (Affects branding, SEO, cookies, email deliverability.)
2. Wedge: US rentals, FSBO sales, or both? This sets categories and the competitor set.
3. Legal entity and who handles US compliance (CCPA, Fair Housing, A2P SMS).
4. Budget for a second host and ongoing US ads.
5. Separate databases (recommended) or one shared database.

## Risks

- A US launch is a new product, not a deployment: demand is not proven and incumbents are strong. Validate with a
  landing page and a paid test before building the whole stack.
- Cookies and sessions are per domain, so a US visitor to bhavano.com and the India admin must never share state.
- Splitting attention: ads, support and mobile releases double. Keep the India growth loop (owner-seeker contact)
  running as the priority.

## Not doing

- No `/us/` path on bhavano.com, no change to India URLs, canonicals, robots or sitemap.
- No automatic IP-based redirect between markets (see `remove-automatic-ip-city-detection.md`); offer a link instead.

## Hosting in the US (EC2)

Today there is one EC2 host in Mumbai (`ap-south-1`) running Caddy, web, bff, admin, Postgres and Grafana through
`docker-compose.prod.yml`. For the US, add a **second EC2 host in a US region**, not a cross-region hop to Mumbai
(about 200-250 ms per round trip, so every page and API call feels slow).

- **Region:** `us-east-1` (N. Virginia, cheapest, closest to the most US users) to start. `us-east-2` (Ohio) is
  equivalent. Move to `us-west-2` or add a second region only if the first US cities are on the West Coast.
- **Same recipe, second target:** same compose file, Caddyfile and ghcr images. Parameterize the host and env in
  `scripts/deploy-from-registry.ps1` (it takes images from the registry, so nothing is built on the host).
  Never `docker build` on the host (see the 2026-10-14 outage note).
- **Size the disk up:** the Mumbai host's 29 GB fills during deploys. Start the US host with 60-80 GB gp3 and keep
  image pruning in the deploy.
- **Own everything:** Elastic IP, security group (80/443 public, SSH restricted), SSH key, DNS records for the US
  domain (www, api, admin), own Postgres volume, and its own backups to an S3 bucket in the same region (copy the
  `postgres-backup-finfolia.md` setup).
- **Photos:** Cloudflare R2 + CDN is global already; use a separate bucket for the US so listings stay separate.
- **Third parties:** the US stack needs its own keys (Twilio, Stripe, Google Maps/Places, Sentry/Loki), configured
  as separate env, not copied from India.
- **Availability:** a single instance is a single point of failure in both regions today. Acceptable for a soft
  launch; add snapshots and a restore drill before real traffic.
- **Cost (rough, check current AWS pricing):** a t3/t4g.medium-class host plus disk, IP and transfer is tens of
  dollars a month; the ads budget will dwarf it.

## URL structure (decided direction, 2026-11-24)

**India: no change.** `www.bhavano.com/bengaluru/buy/apartments`, `/cities`, `/listings/...`, `/requirements/...`,
`/blog`, `/tools` all stay exactly as they are, with the same canonicals, sitemap and robots. `bhavano.com` keeps
redirecting to `www`. No `/in/` prefix, no redirects, no new hreflang entries on India pages.

**US: its own host, same path pattern.** `https://www.bhavano.us/austin-tx/rent/apartments` (or
`us.bhavano.com/...` if the subdomain is chosen). Same route code, different host and market config.

- Slugs carry the state (`austin-tx`, `portland-or`, `portland-me`) because US names collide. India slugs stay
  name-only, so no India URL changes.
- Each host has its own `sitemap.xml`, `robots.txt`, canonical host, Search Console and Bing property, GA4 stream.
  The India sitemap lists only India cities and the US sitemap only US ones.
- Canonicals are self-referencing per host. `hreflang` is not needed while the two sites carry different listings
  and cities; add `en-in`/`en-us` alternates only for pages that exist in both (home, about, terms), and only after
  review, since editing India pages needs sign-off.
- A market mismatch is handled by a visible link ("Looking for homes in the US? Go to bhavano.us"), never an
  automatic IP redirect, which also confuses crawlers. Googlebot from the US must still see India pages.
- `.us` vs `.com` subdomain: a separate domain starts with no authority but cannot hurt India; a subdomain
  (`us.bhavano.com`) is treated by Google as a separate site anyway but shares the brand and cookie/email setup.
  Either is safe for India SEO; choose on branding and email-deliverability grounds.

**Why not `bhavano.com/us/...`:** it needs an India prefix or ambiguity rules for `/austin-tx` vs India city slugs,
shares one robots/sitemap, and any bug (a city page 404 or wrong canonical) puts India rankings at risk. A
subfolder also moves the India site's meaning from "the site" to "one market of the site".

**Guardrails for the work:** ship market config with India as the default for every existing host and test that
India HTML (canonical, title, JSON-LD, sitemap) is byte-identical before and after; deploy the US host last, with
`noindex` until launch.

### Same domain with paths (asked 2026-11-24)

Possible; two variants.

- **B: India stays at the root, US lives under `/us/`** (`bhavano.com/bengaluru/buy/apartments`,
  `bhavano.com/us/austin-tx/rent/apartments`). No India URL changes. Caddy routes `/us/*` to the US web/bff stack, or
  one stack serves both. The US shares the domain's authority; costs: one robots.txt and sitemap index (editing
  robots needs approval), shared cookies (a session cookie must be scoped per market, and separate databases mean an
  India token is invalid in the US), shared analytics property unless split by path, and root `/` stays India.
- **A: `/in/` and `/us/`.** Symmetric and clean, but every India URL moves to `/in/...` with 301s (site, sitemap,
  Google Ads final URLs, app deep links and Universal/App Links files, WhatsApp templates, emailed links, external
  backlinks). Rankings normally recover but dip for weeks; this is the one change in the plan that puts live India
  traffic at risk. Not recommended unless a symmetric structure is worth that.

If one domain is preferred, choose B. The earlier "ambiguity" objection to `/us/` applied only to unprefixed
slugs; an explicit `/us/` prefix has none.

## Mobile apps (checked 2026-11-24 in `apps/mobile/app.config.js` and `apps/web/public/.well-known/`)

**Option B (US under `bhavano.com/us/`) needs no new app-link setup.** iOS claims `applinks:www.bhavano.com` and the
apple-app-site-association file has `"paths": ["*"]`; Android's `intentFilters` use `autoVerify` for host
`www.bhavano.com` with no path filter. So `/us/...` links open in the app, and the web open-in-app and install prompts
(host-based) carry over. A separate US domain would need new `associatedDomains`, intent filters, and a `.well-known`
file on that host, which is an app release.

**What needs work either way**
- **API selection:** the app uses one backend, `EXPO_PUBLIC_BFF_URL=https://api.bhavano.com` (India). The US needs its
  own API host (for example `api.us.bhavano.com`) chosen by market (account or an explicit choice), with the India URL
  as the default. Needs an app release; older versions keep using India's API.
- **In-app routing:** parse `/us/...` paths from links and notifications and send them to the US backend; if the
  signed-in account is in the other market, show a "switch market" prompt, never a blank or wrong screen.
- **Market content:** the app's own formatters (money, units), categories and fields, phone rule, and WhatsApp-style
  login follow the shared `market` config (see the audit).
- **Stores and payments:** same bundle (`com.finfolia.bhavano`) offered in US storefronts; USD App Store/Play price
  tiers (today's Apple product ids are INR); US store text and screenshots; US App Store link
  (`apps.apple.com/us/app/bhavano/id6811878602`), since the India link fix is storefront-specific.
- **Forced-update minimum** stays shared across markets; set it only when the market-aware version ships.

**Sequencing:** web US pages can launch first. Gate the US launch (ads, store availability) on the app release with the
market switch and API selection, so a US user who installs the current app is not sent to the India backend.
**Open:** one binary for both markets (recommended) or separate listings; per-account or per-install market.
