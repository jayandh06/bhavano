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

## What an India user and a US user each see (as of 2026-11-24)

The market comes from the URL path on web (`/us/...` is the US, everything else India) and from a stored setting in the app
(India by default; nothing sets it yet). The "Built" column is what exists in master today.

| | India | US | Built |
|---|---|---|---|
| Web address | `bhavano.com/...`, unchanged | `bhavano.com/us/...` | Market read from the path; no `/us` routes yet |
| Phone login | +91, 10-digit mobile starting 6-9 | +1, 10-digit US number | Rules, forms and BFF validation read the market |
| Money | `₹12,50,000`, "35 Lakh" words | `$1,250,000`, no lakh/crore words | Shared formatters, BFF and web/mobile labels |
| Time zone | India time | US business-day zone for jobs | BFF jobs read `MARKET`; per-user US zones not built |
| Dates | `en-IN` | `en-US` | Not yet (many module-level formatters) |
| Place search | Google Places restricted to India | Restricted to the US | Done (BFF and web map picker) |
| Structured data and SEO | `addressCountry: IN`, indexable | US, `noindex` until launch | Country and `noindex` (meta tag plus header) and US sitemap/robots done 2026-11-24 |
| Listing types | House, apartment, villa, PG, storage, coworking, furniture, interiors, plot, commercial | House, apartment, villa, storage, commercial (starting set), plus condo, townhouse and room for rent | Built 2026-11-26 ([us-categories-condo-townhouse-room.md](us-categories-condo-townhouse-room.md)); not yet deployed. The posting picker, validation and menus follow the market list; PG, coworking and plot entries are still visible in the US menus |
| Area and bedrooms | sq ft, sq m, acre, hectare, cent; BHK | sq ft and acre; bed/bath | Units listed in config; forms not changed |
| Fair Housing fields | "Bachelor", "Vegetarians only", PG gender | Removed in the US | Not built (needs legal review) |
| Content | Blog, guides, land-record pages, India calculators | Hidden at launch | Hidden (404, links removed) in the US build 2026-11-25; the moving guide too |
| Sign-in | Phone/WhatsApp OTP first, Google, Apple, email | Email, Google, Apple first; phone optional | Phone rules only; US flow not built |
| Notifications | WhatsApp and MSG91 SMS | Email and push (SMS only with consent) | Not built |
| Pricing and payments | Razorpay, Apple/Google INR tiers | Stripe or USD store tiers, new price numbers | Plan and contact-credit prices set in dollars 2026-11-25 (rule below); payments, boost, instant-alert and platform-fee prices not built |
| Legal | Finfolia Technologies LLP texts, DLT | US entity, CCPA, Fair Housing notice | Not built |
| Mobile app | One app, India API, India storefront link | Same app, US API, US storefront link | Market store and UI done; switch, US API and release not built |
| Search and ads | Existing pages and rankings untouched | New Google Ads setup, housing-ad rules | Not built |

Visitors are never redirected by location; someone on the wrong market gets a visible link to the other one.

## Plan

**Built 2026-11-24 (dates per market):** `marketDateFormatter(market, options)` (cached `Intl.DateTimeFormat` in the market's locale)
and a market argument on `formatArea`. The web and mobile screens that formatted dates with a fixed `en-IN` (blog, My listings,
referrals, requirements cards and feed, listing interests, Featured performance, draft-saved time, boost credit expiry, area
prices) and the BFF's referral notification dates now use the market locale (server pages use `SERVER_MARKET`, client screens
`useMarket`, mobile module-level helpers `getCurrentMarketId()`). India prints identical dates (tests compare with `en-IN`;
the US prints "Nov 24, 2026"). **Not done:** the admin app (IST by design for an India admin), area/number grouping in
`cardSpecs` chips, the Tools converters and calculators (India content), `requirementQuestions` summary text, and showing
times in the viewer's own US time zone (`marketDateFormatter` takes the zone from the caller's options).

**Built 2026-11-24 (Fair Housing fields per market):** `MarketConfig.hiddenFieldKeys` (India none; US `preferredTenantTypes`,
`vegetariansOnly`, `gender`, `foodType`, and since 2026-11-26 `entranceFacing`: a Vastu field that is *required* on house, apartment,
villa, condo and townhouse, so without hiding it no US listing could be posted; found when testing condo posting on the live US stack)
and `isMarketField`. `fieldIsVisible`, `pruneHiddenAttributes`,
`listingAttributeIssues`/`listingAttributesIssue`, `listingCompleteness` and `sanitizeRequirementAttributes` take an optional market;
`requirementQuestionsFor(category, market)` drops the hidden questions. The web and mobile post, edit, detail and requirement
screens and the BFF's listing and requirement validation pass the market, so the US neither shows nor accepts those fields
(the BFF answers "is not applicable"). India output is identical (tests cover every field, transaction type and question list).
**Not done, needs legal review:** screening free text (listing titles and descriptions, messages) for protected-class wording;
the search hint words and AI-search prompt examples ("bachelors", "girls", "family"); any browse filter or SEO page built on
these fields; admin forms; and the exact list of keys, which should be confirmed with counsel before the US launch.

**Built 2026-11-24 (categories and area units per market):** `market.ts` gains `marketAreaUnits` and `isMarketCategory`;
`postCategories.ts` gains `marketPostCategoryGroups`. The web and mobile posting wizards offer only the market's categories,
and the area-unit pickers (web accordion, mobile forms and wizard) only the market's units. The BFF's write-side validators
(create/update listing, create requirement, create saved search) accept the market's categories and units (India: the same ten
categories and five units as before; tests assert the lists are identical). US set for now: house, apartment, villa, storage,
commercial; sq ft and acre. **Not done:** the browse side (home category tabs and `HomeCategoryFilter`, nav and footer links,
SEO category URL segments in `seoRoute`/`browseRoute`, web saved-search options, admin forms), read-side filter DTOs,
bedroom/bathroom fields instead of BHK, and removing the Fair Housing fields. The US category list is a starting point until
the wedge (rentals, sale-by-owner or both) is decided.

**Built 2026-11-24 (mobile UI for phone and currency; ships with the next app release):** `apps/mobile/src/lib/market.ts` holds the
app's market (India by default, persisted in storage as `bhavano.market`, `useMarket()` re-renders on change,
`setCurrentMarket` for the future switch) and `components/home/Currency.tsx` renders its symbol. The login sheet, account
phone link, profile basics and completion dialog take the dial code, placeholder and length from it; Boost, plan,
subscription, purchases, requirement and post/edit price labels and the listing preview card use the currency. Nothing
sets the market yet, so every install stays India (identical text) until the market switch and the US API address are built.
**Not done on mobile:** the market switch itself and per-market API URL, dates, the saved-search and price-input short forms
(k/L/Cr), the Tools calculators (India content), `formatInr`, and `gtm`-style phone hashing.

**Built 2026-11-24 (web UI for phone and currency):** `apps/web/src/lib/useMarket.ts` reads the market from the URL path
(`/us` is the US, everything else India; one build serves both) and `components/home/Currency.tsx` renders its symbol.
The web login, profile, contact, report and assisted-seller forms take the dial code chip, placeholder, length checks and
validation from the market (`phonePlaceholder` added to the config); the Boost, plan, subscription, credit-pack, saved-search,
requirement and post/edit price labels, the listing preview card, area prices and purchases page use the market currency.
India renders the same text. **Not done on web:** dates (`en-IN` formatters, many module-level), price-input quick-pick
brackets and parsing (`priceInput.ts`, `parseSearchQuery.ts`, `seoRoute.ts` use India's k/L/Cr), the Tools calculators and
blog/guides (India content, hide in the US), `gtm.ts` phone hashing, the INR price-range bounds, and all of admin and mobile.

**Built 2026-11-24 (step 3, money in the shared helpers and BFF):** `market.ts` gains `groupAmount` (lakh grouping for India,
thousands for the US, hand-rolled so Node, browsers and Hermes agree) and `formatMoney` is now symbol + `groupAmount`.
`priceWords.ts` (`formatInrInWords`, `perUnitTotalPrice`, `formatInrWithWords`, `formatInrRangeWithWords`) takes an optional
market (default India); the US gets plain `$1,250,000` with no lakh/crore words. The BFF uses `MARKET` for the listing
price strings (symbol and locale), per-unit totals, price-in-words, requirement-match budget text, boost message amounts
and purchase-email dates. India output is identical (tests compare against the old implementations). **Not done:** the
web/mobile/admin UI that prints "₹" itself (about 45 files: boost and plan screens, price inputs and quick-pick
brackets, `PriceWithWords`, saved searches), which needs the market on the client (the URL path on web, the account in the
app); `priceBounds.ts` messages and the `listingLimits` bounds (INR ranges); `cardSpecs`/`areaUnit` en-IN number grouping;
the Tools calculators (`formatInr`), which are India content and stay hidden in the US; and US price tiers for boost,
subscriptions and platform fees (new numbers, not a conversion).

**Built 2026-11-24 (step 4, phone rules in the BFF):** `market.ts` gains `phoneNationalLength`, `phoneTrunkPrefix`, `phoneLabel`
and the helpers `nationalPhoneDigits`, `toE164`, `phoneErrorMessage`. The BFF's OTP/login/support/merge/delete DTOs, the
assisted-listing phone check and mask, admin user search, the WhatsApp Cloud recipient format and the Google Ads/Meta
hashed phone all read the deployment's market (`toE164India` is now `toE164`); India's accepted inputs, outputs and error
text are unchanged (tests compare against the old implementation). **Not done yet:** the web, admin and mobile login/profile
forms (the "+91" chip, "10-digit mobile number" placeholders and `length === 10` checks, about 15 files), MSG91 SMS (India-only
by design), `scrub-listing-phones.ts` and the log masker (India number patterns), `seekerContact` masking, admin outreach CSV
and `gtm.ts`. The US login itself (email-first, Twilio) is a separate piece of work.

**Built 2026-11-24 (step 2, country restrictions):** Google Places autocomplete (`locations.service.ts`, `components=country:<market>`),
the web map picker (`LocationMapPicker`, country from the URL path via `marketFromPath`), the JSON-LD `addressCountry`
(`apps/web/src/lib/serverMarket.ts`, runtime `MARKET` env, India when unset) and the post-funnel India flag
(`MARKET.name`) now read the market. India output is identical. **Found:** `Visit.ipCountry` stores MaxMind's English country
*name* ("India"), but `user-city-from-ip.service.ts` filters on `'IN'`, which never matches, so that job fills nothing today.
It now reads `MARKET.countryCode` (same behaviour); fixing it to the name would switch the feature on, which is a separate
decision (see `profile-city-from-ip.md` and `remove-automatic-ip-city-detection.md`). Caveat: the web `MARKET` env is read at
runtime on the server, so the US page set must be dynamic (or built per market) before launch.

**Built 2026-11-24 (step 2, time zones in the BFF):** `apps/bff/src/market/market-config.ts` exports `MARKET` and
`MARKET_TIME_ZONE` from the `MARKET` env var (`in` or `us`; unset, empty or unknown is India, so no deployment changes
unless it sets it). All 15 `@Cron` jobs and the offer-end date text in `admin.service.ts` read it instead of a literal
`Asia/Kolkata`. Deliberately **not** changed: the promotional SMS send window (`outreach/send-window.ts`, India's TRAI/DLT
rule) and the admin app's IST date formatting and `istDay*` helpers (an India admin; the US admin gets its own setting
when its stack exists). Still open from the audit: web/mobile time zones, `country:in`, `addressCountry`, `ipCountry`.

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

**Built 2026-11-25 (US wording, front door):** `apps/web/src/lib/marketCopy.ts` holds the market-specific website wording (India's strings are the ones that were hardcoded, pinned by
`marketCopy.test.ts` and checked against what production serves; the US strings name nothing India-only and make no claim the US cannot back yet). Covers the site title, description, social card
and `<html lang>`/Open Graph locale, the structured data (country; the US markup carries no Indian legal name, address, phone or App Store storefront), the home page headline, intro and owner
blurb, the header and footer taglines, the search box placeholder and example chips, the Browse Cities page, the 404 page, the Help page's opening and "What can I list?", and the home page's
category lists (US: only the market's categories) and FAQ and steps (`homeFaqs(cityNames, marketId)` and `homeSteps(marketId)` in `packages/types`, India the default, so mobile is unchanged).
The calculators, blog and guides, the moving guide and the Diwali banner are not offered in the US: those routes answer 404 (a `layout.tsx` gate) and their links are hidden. The popular-search
fallback offers only the market's categories and nothing in the US without a city. Deployed to the US stack as `sha-6b06fe15` and checked on the live pages (title, description, H1, locale, structured data, the four 404 gates). A second pass
(2026-11-25) fixed what that check found: the requirement prompt's "anywhere in India" now uses the market's place name, and the visible "favourite" spellings (header and drawer nav, the Favorites page, listing
button, guest prompt, Help text, profile merge prompt) use US spelling through `spell()` in `marketCopy.ts` (India unchanged). **Not done, needs a decision or legal text:** About, Trust, Terms and Privacy (India entity, GST and DLT text), the
footer's legal-entity line and copyright, the Help page's FAQs about phone-OTP login and listing checks, the category tabs and menus (PG, plots, coworking, furniture, interiors), "BHK" in search
and headings (bed and bath), the `/premium` plans page (INR), browse and city page copy, and the mobile app's wording.

**Built 2026-11-25 (US plan prices):** the owner's rule for US prices is the rupee amount divided by 60, rounded up to the next $5 (never below $5), which gives the owner's examples (Rs 199 = $5, Rs 799 = $15, Rs 1,200 = $20). `usdTierFromInr` in
`packages/types/src/subscriptionPricing.ts` is that rule; `US_SUBSCRIPTION_PLAN_SETTINGS` and the US contact-credit default are it applied to India's amounts (a test keeps them equal). Result: seller slot pack Rs 149 = $5 a month, Agent Pro Rs 499 = $10 a
month per unit, Bhavano Plus Rs 99 / 549 / 899 = $5 / $10 / $15 for 1 / 6 / 12 months, contact-credit pack (5 reveals) Rs 125 = $5. The BFF writes these defaults on a US stack (`defaultSubscriptionPlanSettings(MARKET.id)` and
`DEFAULT_CONTACT_REVEAL_SETTINGS`; India's values are unchanged and tested). The US database's two settings rows were also updated directly (they already existed with India's numbers), so `/us/premium` shows the dollar prices now.
**Not done:** buying is not possible in the US (no payment provider: the Subscribe and credit buttons would fail), and the boost, instant-alert and listing-publish (platform fee) prices are still India's rupee numbers shown with a `$`.

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

Today there are two EC2 instances in Mumbai (`ap-south-1`): an app instance running Caddy, web, bff, admin and Grafana through
`docker-compose.prod.yml`, and a DB instance running PostgreSQL (`docs/deployment.md`). For the US, add **a second pair of EC2 instances (app and DB) in a US region**, not a cross-region hop to Mumbai
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

## US stack in the repo (built 2026-11-24)

The repo now contains everything needed to build and run a separate US stack under `www.bhavano.com/us/`, switched off by default; see
[us-stack-setup.md](us-stack-setup.md) for what it contains, the one-time setup and what is not verified. In short: the web app builds
with a `/us` base path, its own cookie names and market; `docker-compose.us.yml`, `Caddyfile.us` and `.env.us.example` define the US host; India's
Caddy has an optional import hook (`caddy/market-routes/us.caddy.example`); CI builds a `web-us` image when the US variables exist; and
`deploy-from-registry.ps1 -Stack us` deploys it. Nothing is provisioned or deployed.
