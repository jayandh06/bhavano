# Bhavano — Product & Technical Requirements

## 1. Overview

Bhavano is a web and mobile classifieds platform where users post and browse listings to buy, sell, rent, or lease real estate and furniture. The platform must be highly discoverable through both traditional search engines (SEO) and AI/LLM-based answer engines, and must not expose any backend API directly to the browser.

## 2. Functional Scope

**Categories**
- Real estate: House, Apartment, PG (Paying Guest), Storage space, Coworking space
- Furniture: sofas, beds, wardrobes, appliances, etc.

**Transaction types (apply across categories):** Buy, Sell, Rent, Lease

**Core user actions**
- Create an account (phone OTP or Google login)
- Post a listing with category-specific attributes, price, location, photos
- Browse/search listings with filters (price, location/radius, category-specific facets, condition)
- Optionally link a furniture listing to a related real-estate listing (e.g., "furniture available in this rented flat")
- Manage own listings (edit, mark sold/rented, deactivate)

### 2.1 Browsing navigation (IA)

Browsing is organized around seeker intent, not a flat list of every (category × transaction type) combination — several combinations never make sense to browse (nobody looks for "Buy PG" or "Buy storage space"). Four top-level tabs:

- **Buy** — House, Apartment (`transactionType` buy/sell), with a property-type sub-filter (House / Apartment / All)
- **Rent & Lease** — House, Apartment, Storage, Coworking (`transactionType` rent/lease), with a property-type sub-filter (House / Apartment / Storage / Coworking / All)
- **PG** — its own tab despite being rent-only, since its filters (sharing type, gender, meals) are entirely distinct from real-estate filters and PG search intent is high enough in the Indian market to deserve top billing rather than being buried under Rent
- **Furniture** — its own tab; filters (material, dimensions, condition) have nothing in common with real-estate filters, so mixing them into Buy would clutter that page's filter UI

"Sell" and "Lease" as poster actions are not browsing tabs — a visitor never browses to "sell." The poster picks category + transaction type together in the posting flow (below), fully decoupled from how buyers/renters browse.

### 2.2 Posting flow

Posting is a schema-driven, multi-step wizard, not a single flat form:

1. **Category** — House, Apartment, PG, Storage, Coworking, or Furniture.
2. **Transaction type** — options are constrained per category, not a fixed set: House/Apartment offer Sell, Rent out, or Lease out; PG only ever offers Rent out (this step is auto-selected/skipped); Storage/Coworking offer Rent out or Lease out; Furniture offers Sell or Rent out. `Buy` is never a postable transaction type — that's the browsing side, not the lister's action.
3. **Category-specific details** — the field set (e.g. BHK/floor/furnishing for House & Apartment; sharing-type/gender/meals for PG; size/access-hours for Storage; seat-type/amenities for Coworking; material/dimensions/condition/brand for Furniture) is defined once as a config object, not hand-coded per category. That same config renders the dynamic form and maps directly onto the `attributes` JSONB column — adding a future category means adding a config entry, not new code paths.
4. **Location** — city + area selection (typeahead over a curated, growable area list). Precise lat/long via address autocomplete + map pin is a known follow-up once PostGIS radius search is built out, not required for the current flow.
5. **Photos** — uploaded via the BFF (currently local disk; swaps to S3/R2 presigned uploads without changing the API shape once a bucket is provisioned).
6. **Review & publish** — runs auto-moderation synchronously (see 3, Trust & safety) before the listing goes live. There is currently no "pending review" queue: a submission either passes and is published immediately, or is rejected inline with a reason the poster can act on and resubmit.

A phone-verification publish gate and a poster-facing dashboard (edit / mark sold or rented / deactivate, triggering on-demand ISR revalidation of the public listing page) are deferred until real posting auth is (re-)enabled — anonymous posting has no stable owner identity to scope a dashboard to.

## 3. Non-Functional Requirements

- **SEO/LLM discoverability:** every listing must be server-rendered, individually URL-addressable, and expose clean structured data so both search engines and LLM/answer-engine crawlers can parse it reliably.
- **No direct API exposure to the browser:** the browser must never call a stable, inspectable REST/GraphQL endpoint directly. All data fetching for the web app happens server-side.
- **Security/trust & safety:** phone verification required before a user can post an ad; rate limiting and CAPTCHA on ad-posting and auth endpoints to deter spam/fake listings. *Current interim state:* posting auth is temporarily disabled (see Open Items), so trust/safety is enforced instead by synchronous auto-moderation at submission time — banned-word scan, per-category price-sanity bounds, and duplicate-photo detection (perceptual hash). This is a stopgap, not a replacement for the phone-verification gate once posting auth is re-enabled.
- **Performance:** good Core Web Vitals on all listing and search pages.
- **Initial scale target:** ~250 concurrent users, architected to scale to 1,000–2,000+ without a redesign.

## 4. Technical Architecture

### 4.1 Frontend (Web) — Next.js (App Router)
- Server Components + Server Actions handle all data fetching server-side — the browser receives rendered HTML/RSC payloads, never a directly callable public API.
- SSR/ISR for fast, crawlable, per-listing pages.
- JSON-LD structured data per listing: `RealEstateListing`/`Product` + `Offer` for real estate, `Product` + `Offer` (with `itemCondition`) for furniture.
- Auto-generated `sitemap.xml`, `robots.txt`.
- `llms.txt` summarizing site/content model for LLM crawlers.
- Semantic HTML throughout (proper headings, `<address>`, spec tables) — avoid client-side-only rendering that hides content from crawlers.

### 4.2 Mobile — React Native (Expo)
- Shares business logic/types with the web app via a monorepo (Turborepo/Nx).
- Calls the BFF gateway directly (mobile apps inherently need an API) — protected via certificate pinning and app-attestation (Play Integrity / App Attest), never calling internal services directly.

### 4.3 Backend — BFF (Backend for Frontend) pattern
- Single gateway (NestJS or GraphQL with persisted/allow-listed queries) that both Next.js and the mobile app talk to.
- Internal microservices/DB live on a private VPC, not internet-routable — only the BFF can reach them.
- **Auth transport:** httpOnly, secure session cookies for web (never a bearer token in browser JS); short-lived signed tokens for mobile.

### 4.4 Data Layer
- **PostgreSQL + PostGIS** — source of truth. Single `listings` table with shared columns (category, subcategory, transaction_type, price, location as PostGIS point, owner_id, status, created_at) plus a `JSONB attributes` column (GIN-indexed) for category-specific fields (BHK/floor/furnished for real estate; material/dimensions/condition for furniture).
- **Typesense or Meilisearch** (Elasticsearch if scale demands it later) — read-optimized search index synced from Postgres, for faceted/full-text/geo search. Rebuildable from Postgres at any time.
- **S3 / Cloudflare R2** + image optimization (Next/Image or Cloudinary) for listing photos.
- **Redis** — caching, session/rate-limit counters.

### 4.5 Infrastructure
- **Cloudflare** in front of everything: CDN, WAF, bot management, rate limiting.
- Next.js deployed on Vercel, or self-hosted on AWS/GCP behind the same gateway.
- CAPTCHA (Cloudflare Turnstile) and rate limits specifically on ad-posting and auth endpoints.

**Initial AWS sizing (≈250 concurrent users) — 2-instance setup:**

| Instance | Role | Sizing | Notes |
|---|---|---|---|
| Instance 1 | Database | RDS PostgreSQL `db.t4g.small` (or `t4g.micro` to start), single-AZ | Only the database — kept separate for automated backups, patching, point-in-time recovery, and isolation from app crashes/CPU spikes |
| Instance 2 | Everything else | EC2 `t4g.medium` (2 vCPU, 4GB), Docker Compose | Runs BFF (NestJS), Redis, Typesense/Meilisearch, and Next.js (if self-hosted rather than on Vercel) as containers |

Plus, outside these two instances: S3/R2 for media (auto-scaling, not a sizing decision) and Cloudflare in front for CDN/WAF/rate limiting.

**Why this split:** the database is the one thing you genuinely can't afford to lose or corrupt, so it goes on managed RDS for backups/failover even at small scale. Everything else (BFF, cache, search index) is stateless or rebuildable from Postgres, so it's fine to run co-located on a single box while user count is low — no redundancy at the app layer yet, which is an accepted trade-off at this stage.

**Known risks of this setup** (accepted for now, revisit once there are paying users depending on uptime):
- Single point of failure for BFF/search/cache — one crash or reboot takes down the whole app layer (not the data itself).
- t4g is burstable CPU — sustained traffic spikes can exhaust CPU credits and throttle performance.
- No isolation between services sharing the box — a runaway process in one container can starve the others.

**Upgrade path when ready:** split BFF onto its own (redundant, 2+ instance) compute tier, move Redis to ElastiCache, move Typesense to its own instance — i.e., grow into the original multi-service layout as traffic/uptime requirements increase.

## 5. Authentication

- **Primary:** Phone number + OTP (expected default for the target market). OTP delivery via MSG91 (handles India DLT/TRAI compliance) or AWS SNS/End User Messaging.
- **Secondary:** Google OAuth login.
- **Fallback:** Email/password.
- **Session model:** Auth.js (NextAuth) issuing httpOnly session cookies server-side — consistent with the "no API exposed to browser" requirement.
- **OTP flow:** rate-limited send/verify endpoints, 5-minute OTP expiry, capped verification attempts, CAPTCHA in front of send-OTP requests.
- **Trust gate:** phone verification required before a user can post an ad (primary lever against spam/fake listings).

## 6. Data Model Notes

- One `listings` table serves both real estate and furniture — category-specific schema differences live in the `JSONB attributes` column, not separate tables.
- `condition` (new/used/age) should be a first-class indexed column for furniture, since it's a primary filter/ranking signal.
- Optional `related_listing_id` column to link a furniture listing to a real-estate listing.
- Search index (Typesense/Meilisearch) should be split logically by category for relevant facets/ranking, with a category toggle in the UI search bar.

## 7. Branding

- Domain: **bhavano.com** (from "Bhavan," Sanskrit/Hindi for building/mansion, + the "-o" suffix pattern common to Indian consumer tech brands).

## 8. Open Items / Next Steps

- [ ] Monorepo structure (Turborepo/Nx) and package boundaries
- [ ] Full Postgres schema (DDL) for listings, users, transactions, messages
- [ ] BFF API contract (GraphQL schema or REST route map) between BFF, web, and mobile
- [ ] CI/CD pipeline and environment strategy (dev/staging/prod)
- [ ] Monitoring/observability stack (logs, metrics, error tracking)
- [ ] Terraform/CDK for the AWS infrastructure described above
- [ ] Re-enable phone-verification publish gate for posting (currently open without login) and build the poster dashboard (edit/mark sold or rented/deactivate + ISR revalidation) that depends on it
- [ ] Migrate photo uploads from local disk to S3/R2 presigned uploads
- [ ] Address autocomplete + draggable map pin for precise per-listing lat/long (needed for real PostGIS radius search)
