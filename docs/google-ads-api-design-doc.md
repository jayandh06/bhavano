# Bhavano — Google Ads API Standard Access: Design Documentation

**Google Ads API — access review submission**

| | |
|---|---|
| Applicant | `[Jayandhan Rajasundaram]` |
| Product | bhavano.com |
| Access requested | Standard |
| Prepared | `[27-Jul-2026]` |

> **Before submitting:** every claim about Bhavano's product, taxonomy, and existing technical
> infrastructure below is grounded in what's actually built. Fields marked `[ ]` are business
> figures — live inventory volume, sync cadence, contact details — that only the team can supply
> accurately; fill each one in before this goes to Google.

## 1. Company & product overview

Bhavano is an online classifieds marketplace serving the Indian real estate and household-goods
market. Sellers, landlords, brokers, and agents list properties and goods directly; buyers and
tenants search, save, and contact listers through the platform. The catalog spans ten listing
categories across four transaction types — sell, buy, rent, and lease — not every category
supports every type:

| Category | Transaction types |
|---|---|
| House | sell · rent · lease |
| Apartment | sell · rent · lease |
| Villa | sell · rent · lease |
| Plot | sell |
| PG / Hostel | rent |
| Storage space | rent · lease |
| Coworking | rent · lease |
| Commercial space | sell · rent · lease |
| Furniture | sell · rent |
| Interiors | sell |

Listings sit under a curated city/area location hierarchy — 37 cities at time of writing, each
with a curated set of localities, expandable as sellers post in new areas — which also defines
the platform's public URL structure: `bhavano.com/{city}/{area}/{transaction-type}/{category}/{listing-slug}`.

## 2. Use case summary

Bhavano operates **one** Google Ads account, used solely to advertise its own platform. There is
no reseller, agency, or third-party account-management use case anywhere in this integration —
every campaign, budget, and keyword created through the API belongs to Bhavano's own advertiser
account. The API keeps Search campaign structure synchronized with two things that change
constantly: the platform's live listing inventory, and its city/area/category taxonomy — and
automates routine account operations (bid and budget adjustment, pausing ad groups behind expired
or removed listings) at a scale manual management in the Google Ads UI doesn't support well.

## 3. Why Standard access

Bhavano's campaign structure is generated from its own taxonomy, not hand-built. One ad group per
active (city, category, transaction-type) combination — the same three dimensions that already
define the platform's own URL routing and location-based search filters — produces a structural
ceiling of up to **777 possible segments** today (37 cities × 21 valid category/transaction-type
pairings; not every category supports every transaction type, as shown above), growing as new
cities and localities are added.

`[current count of segments actually carrying live inventory, and the resulting ad
groups/keywords touched per sync cycle]` operations against a sync running `[frequency, e.g.
every 4 hours]` already `[exceeds / is projected to exceed within ___]` Basic access's daily
operation ceiling. This reflects steady, inventory-driven growth rather than a one-time bulk
migration.

## 4. Solution architecture

*Note: this describes a proposed integration, not something already built — worth flagging as
"planned" to Google if that distinction matters for the review.*

The integration lives inside Bhavano's existing backend service — a NestJS application — as a
new module alongside the platform's existing integrations with Razorpay (payments) and the
Google Maps Platform (location search), both of which already follow the same
credential-handling pattern this integration reuses: API credentials are read server-side via the
framework's config layer, never bundled into or exposed to any client application (web, mobile,
or admin).

A scheduled job — the app already runs equivalent periodic jobs for other features — reads the
current state of the platform's listing and location tables and reconciles it into Google Ads
campaign, ad group, and keyword state through the Google Ads API client library. Structural
changes flow one direction only, Bhavano → Google Ads, while performance data (impressions,
clicks, cost, conversions) flows back for the automation described in Section 6.

## 5. Campaign structure

Campaigns are segmented by **city**, matching the platform's own curated City table. Ad groups
within each campaign are segmented by **category × transaction type** — the same pairing already
enforced in the product's own posting flow (PG/Hostel only ever supports rent; Plot and Interiors
are sell-only). Keywords are derived from the vocabulary sellers already use when posting —
category names, bedroom counts, furnishing status, locality names — rather than a separately
maintained keyword list. Final URLs point at real listing detail pages using the platform's
existing SEO route structure, so ad traffic lands on a live, indexable page rather than a landing
page built only for ads.

## 6. Bid & budget automation

Bhavano already runs a seller-facing "boosted listing" feature — a paid placement a seller can
buy for their own listing. Boost status and boost performance (views, favourites, contact-seller
actions, all already tracked per listing) feed into bid and budget prioritization on the ads
side, so promotion the seller has already paid for and paid search spend Bhavano controls
reinforce each other instead of competing for the same buyer's attention. Ad groups behind
listings that expire, get removed, or fail moderation are paused automatically within one sync
cycle, rather than continuing to spend against a dead landing page.

## 7. Reporting & attribution

Bhavano already records first-party attribution data for every user — acquisition source, medium,
and campaign fields captured at signup — and per-session visit records, both surfaced through the
platform's existing logging and observability stack (also used for application monitoring and
moderation dashboards). Google Ads API reporting data (cost, clicks, conversions) is ingested
into this same pipeline, so ad spend can be attributed against real in-product outcomes already
being measured — listing views, favourites, and contact-seller conversions — rather than click
volume alone.

## 8. Estimated API usage

| Metric | Current | 6-month projection |
|---|---|---|
| Ad accounts managed via the API | 1 | 1 |
| Cities in the location taxonomy | 37 | `[ ]` |
| Active ad groups (live inventory only) | `[ ]` | `[ ]` |
| Sync frequency | `[ ]` | `[ ]` |
| Estimated operations / sync cycle | `[ ]` | `[ ]` |
| Estimated operations / day | `[ ]` | `[ ]` |

## 9. Security & access control

API credentials are stored as server-side environment variables on Bhavano's backend
infrastructure only, following the same client/server credential separation already in place for
the platform's Razorpay and Google Maps Platform integrations — publishable identifiers may reach
a client where a product surface requires it (a payment checkout SDK, for instance), but secrets
never do. Access to the Google Ads account itself is limited to Bhavano's own engineering team;
no external party, contractor, or third-party tool receives API or account access through this
integration. Every automated change the integration makes is logged and reviewable through the
platform's existing admin tooling.

## 10. Policy compliance

Bhavano commits to using the Google Ads API in accordance with the Required Minimum
Functionality policy and the Google Ads API Terms of Service: no falsified or synthetic
performance data is generated or reported, no automation in this integration is designed to
circumvent Google Ads policies or ad review, and no click activity is artificially generated.
Budget ceilings and the launch of any new campaign remain subject to human review before taking
effect — the automation described above operates only within the bounds of campaigns and budgets
a person has already approved.

---

Prepared by `[Jayandhan Rajasundaram / Director]`
Contact `[jayandh@finfolia.com]`
Bhavano · bhavano.com
`[27-Jul-2026]`
