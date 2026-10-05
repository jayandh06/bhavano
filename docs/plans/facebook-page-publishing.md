# Publish live listings to the Bhavano Facebook Page

## Status: proposed (2026-10-05) — not started

## Context

Bhavano currently has no distribution channel beyond the site itself, Google Ads, and WhatsApp
(`docs/plans/growth-beyond-google-ads.md` flags that real-estate activity in India happens heavily
in Facebook groups/Pages, with near-zero current Facebook traffic). The ask: every listing that
goes live on Bhavano should also appear as a post on the Bhavano Facebook Page, driving free organic
reach and linking back to the listing page.

Decisions already made with the user:
- Credentials: a Facebook Page + Meta app with a Page access token (`pages_manage_posts`) will be
  provided — this plan assumes it exists by the time Phase 1 code ships, confirmed in Phase 0.
- Scope: both new listings going forward **and** a one-time backfill of existing active listings.
- Content: title + price + first photo + link back to the listing page.

### What exists today

- No Facebook/social publishing integration exists anywhere in the repo. The only Meta-related code
  is WhatsApp Business messaging (`apps/bff/src/notifications/providers/whatsapp.provider.ts`),
  which calls Meta's Graph API for message sending, not Page posts — it's the pattern to mirror
  (raw `fetch`, `ConfigService` for secrets, a `configured` getter, best-effort `.catch` semantics,
  `logThirdPartyCall` for every call), not code to extend.
- There is no event bus/webhook system on listing create/update. Every side effect (notify buyers,
  send WhatsApp, write a notification log row) is a hand-wired, fire-and-forget call inside
  `ListingsService.runPostLiveSideEffects` (`apps/bff/src/listings/listings.service.ts:1277`) — the
  single funnel all three "listing just went live" paths already call into:
  1. `create()` direct-live path, line 1619–1621
  2. `completePendingPublish()` (after Razorpay checkout), called from
     `payments.service.ts:777` → `fulfillListingPublishPayment`
  3. `publishAssistedClaim()` (seller claims an admin-assisted listing), line ~2504
- The listing's canonical public URL is already built by a shared helper, deliberately placed in
  `packages/types/src/listingPath.ts` so the BFF doesn't need to re-derive it:
  `buildListingPath(listing)` → combined with `PUBLIC_SITE_URL` (env var already read in ~9 places
  in `notifications.service.ts`, e.g. line 739's `notifyListingPosted`) to get an absolute URL.
- The listing detail page (`apps/web/src/app/[city]/[[...rest]]/page.tsx`, `generateMetadata`,
  lines 446–468) already sets `openGraph.images` to the listing's real first-photo CDN URL
  (`listing.ogImage`, computed in `listings.service.ts:1271-1273` via `publicVariantUrl(...)`), plus
  matching `title`/`description`. Facebook's own link-scraper (`facebookexternalhit`, already
  recognized by `packages/types/src/botUserAgent.ts` and explicitly let through uncounted but
  **unblocked** in `apps/web/src/middleware.ts:204`) will read this when scraping a shared link.
- One-off backfills in this repo are plain scripts in `apps/bff/scripts/` (e.g.
  `normalize-number-attributes.ts`): a standalone `PrismaClient`, a `--dry-run` flag, idempotent by
  re-checking state before writing, run via `npx tsx scripts/<name>.ts` inside the bff container.
  They import pure helpers from `packages/types` but don't bootstrap the Nest DI container.

### Approach: post via `/{page-id}/feed` with `link`, not `/photos`

Two ways to get a photo into the Facebook post:
1. **Upload the photo directly** (`POST /{page-id}/photos` with the CDN image URL, caption = text).
   Gives a native "photo post" look, but the link becomes plain text in the caption — Facebook
   won't render it as a clickable preview card — and it bypasses the OG metadata entirely.
2. **Share the link** (`POST /{page-id}/feed` with `message` = title/price text, `link` = the
   listing's canonical URL). Facebook's scraper fetches that URL and auto-builds the preview card —
   image, title, description — from the OG tags the listing page *already* emits correctly (see
   above). The result still shows title + price (in the message) + the first photo (via the
   scraped OG image) + the link, i.e. exactly what was asked for.

Going with **option 2**: it needs zero new BFF code to resolve CDN image URLs (no touching
`photo-keys.ts`/`ListingPhoto` at all), it can't drift out of sync with the real listing photo since
it always re-scrapes the live page, and it's simpler to test (no image upload step that can fail
independently of the post itself).

## Phase 0 — before writing code

- Confirm the Page ID and generate a long-lived Page access token with the `pages_manage_posts`
  permission (Meta Business Suite → Page settings → Page access tokens, or a System User token if
  this will run server-side indefinitely — long-lived Page tokens don't expire unless revoked).
- Confirm which Graph API version to pin (mirror `WHATSAPP_API_VERSION`'s current value, e.g. `v23.0`,
  unless there's a reason to differ).

## Phase 1 — Implementation

### BFF: new Facebook provider

- **New pure module** `apps/bff/src/notifications/providers/facebook.ts` — no NestJS decorators, so
  both the live-request path and the standalone backfill script can import it directly:
  - `buildFacebookMessage(listing): string` — `` `${listing.title}\n${priceText(listing)} · ${listing.area}, ${listing.cityName}` ``
  - `postListingToFacebookPage(params: { pageId: string; accessToken: string; apiVersion: string; message: string; link: string }): Promise<{ ok: true; postId: string } | { ok: false }>`
    — single `fetch` POST to `https://graph.facebook.com/${apiVersion}/${pageId}/feed` with
    `message`, `link`, `access_token` in the body; logs via
    `logThirdPartyCall` (`apps/bff/src/logging/thirdPartyCallLogger.ts`) with the access token
    redacted from the logged request (never log it raw, same rule `WhatsappProvider` follows for
    the access token it holds); no retry, single attempt, matches `WhatsappProvider`'s
    log-and-swallow philosophy.

- **New NestJS wrapper** `apps/bff/src/notifications/providers/facebook.provider.ts`, structured
  exactly like `whatsapp.provider.ts`:
  - `configured` getter checks `FACEBOOK_PAGE_ID` / `FACEBOOK_PAGE_ACCESS_TOKEN` are set via
    `ConfigService`.
  - `publishListing(listing): Promise<string | false>` — builds the message, calls
    `postListingToFacebookPage`, returns the post id or `false`; never throws.
  - Registered in `apps/bff/src/notifications/notifications.module.ts` providers/exports, same as
    `WhatsappProvider`.

- **Hook point** — inside `ListingsService.runPostLiveSideEffects`
  (`apps/bff/src/listings/listings.service.ts:1277`), add a sibling fire-and-forget call next to
  the existing `notifyListingPosted(...)` block (lines 1312–1332), following the same
  `.catch(() => undefined)` pattern used for `savedSearchesService.notifyMatchingBuyers` (line 1297):
  on success, write a `ListingNotificationLog` row (`channel: 'facebook', kind: 'posted',
  providerMessageId: <fb post id>`) — reusing the existing log table/pattern rather than a new one,
  consistent with how WhatsApp/email sends are already logged there.
  This one hook covers all three "just went live" paths (direct create, post-checkout, assisted
  claim) since they all funnel through this method.

- **Env vars** — add to `.env.production.example`, mirroring the WhatsApp block's style (comment
  explaining each, no real values committed):
  ```
  FACEBOOK_PAGE_ID=
  FACEBOOK_PAGE_ACCESS_TOKEN=
  FACEBOOK_API_VERSION=
  ```
  No validation schema exists for env vars in this repo (`ConfigModule.forRoot({ isGlobal: true })`
  has no `validationSchema`) — nothing else to register.
- **Compose wiring (added 2026-10-05).** `docker-compose.prod.yml` lists the bff's environment
  one variable at a time, so the three `FACEBOOK_*` lines also have to be there, or the server
  `.env` values never reach the container (it shipped without them at first). Compose passes an
  unset `FACEBOOK_API_VERSION` as `""`, so the provider falls back to the default with `||`, not
  `??`.

### Backfill script

- **New file** `apps/bff/scripts/backfill-facebook-posts.ts`, following
  `normalize-number-attributes.ts`'s shape:
  - Standalone `PrismaClient` (`new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })`).
  - Query listings where `status: 'active'`, `publishState: 'live'`, and no existing
    `ListingNotificationLog` row with `channel: 'facebook', kind: 'posted'` — this is what makes a
    re-run idempotent/resumable if it's interrupted partway.
  - For each: build the message/link the same way as the live hook (import
    `buildFacebookMessage`/`postListingToFacebookPage` from the pure module above, and
    `buildListingPath` from `packages/types`), call the Graph API directly with
    `process.env.FACEBOOK_PAGE_ID!` / `FACEBOOK_PAGE_ACCESS_TOKEN!` / `FACEBOOK_API_VERSION!`
    (no Nest DI needed, same as `ConfigService` would read), write the `ListingNotificationLog` row
    on success, `console.log`/`console.error` per item (don't abort the batch on one failure).
  - A short delay between calls (e.g. 1–2s via `setTimeout`) to stay well under Graph API rate
    limits for a bulk run.
  - Support `--dry-run` (list what would be posted, post nothing) same as the existing script.
  - Documented run command in a header comment: `npx tsx scripts/backfill-facebook-posts.ts [--dry-run]`
    inside the bff container.

### Security

- The Page access token and Page ID are secrets: only in the production env, never committed
  (including as placeholder values in `.env.production.example` — empty, like every other secret
  there).
- Never log the raw access token — `logThirdPartyCall`'s request summary must have it redacted
  before being passed in, the same discipline `WhatsappProvider` applies to phone numbers.

### Tests

- Unit test `buildFacebookMessage` (pure function — exact string given a listing fixture).
- Unit test `FacebookProvider.configured` (true/false based on env).
- Unit test `postListingToFacebookPage` with a mocked `fetch` — success parses `postId`; non-2xx and
  thrown-exception cases both return `{ ok: false }` without throwing.
- Manual checklist after deploy: create one real listing end-to-end, confirm it appears on the
  actual Facebook Page with the right image/title/price/link; confirm the `ListingNotificationLog`
  row was written; run the backfill script with `--dry-run` first against production data to sanity
  check the candidate count before the real run.

### Rollout

1. Get the Page ID + long-lived Page access token (Phase 0), set them in the production env.
2. Deploy the BFF changes (provider + hook + env var additions). New listings going live start
   posting automatically — verify with one real listing before moving on.
3. Run `backfill-facebook-posts.ts --dry-run` in production to see the candidate count, then run it
   for real once satisfied.
4. Copy this plan doc into `docs/plans/facebook-page-publishing.md` once approved, per this repo's
   convention of keeping implemented-plan docs in git history alongside the code they describe.

## Open questions (explicitly out of scope for v1 unless flagged otherwise)

- Listing edits, status changes (sold/rented/deactivated), or deletions do **not** update or remove
  the Facebook post in this plan — it's a one-way, post-once-on-going-live integration. Revisit if
  stale "still available" posts become a real problem.
- No per-listing opt-out/category filter — every live listing gets posted, as requested ("all ads").
