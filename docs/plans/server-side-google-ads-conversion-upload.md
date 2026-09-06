# Server-side Google Ads conversion upload for signup and post-ad (Data Manager API)

## Context

The original version of this plan targeted `ConversionUploadService.uploadClickConversions` (the
classic Google Ads API offline-conversion-upload endpoint). Real-API verification — done before
touching anything live, specifically to avoid exactly this kind of surprise — caught that this
account is not allowlisted for it: Google returned `CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE`,
"New integrations... should use the Data Manager API." Confirmed via search: **as of June 15,
2026, offline conversion upload was migrated to the Data Manager API and blocked in the classic
Google Ads API for new integrations** — not a fixable allowlist request, a mandatory platform
migration already in effect.

The goal is unchanged from the original plan: use the `gclid` already captured at signup
(`docs/plans/capture-google-ads-click-attribution.md`, live in production) to report the
conversion to Google Ads directly from the backend, so a signup/listing-post a blocked browser
would otherwise hide from Google Ads gets reported anyway. Only the mechanism changes.

**What's new in this version, confirmed by direct research against Google's current docs:**
- Different endpoint: `POST https://datamanager.googleapis.com/v1/events:ingest`, not
  `googleads.googleapis.com`.
- **No developer-token header** — actually simpler auth than the original plan.
- Needs a **new OAuth scope** (`https://www.googleapis.com/auth/datamanager`) that the existing
  `GOOGLE_ADS_REFRESH_TOKEN` didn't have — minted via an interactive browser consent grant.
- Needs **two new Google Ads conversion actions**, `type: UPLOAD_CLICKS` specifically — the
  existing "New registration"/"Post ad success" actions are `type: WEBPAGE` and type is fixed at
  creation, so they can't be repurposed.
- The Data Manager API needs to be **enabled on the Google Cloud project** (Console step).

## Manual prerequisites (completed)

1. **Enabled the Data Manager API** on the Cloud project used for the Ads/GTM OAuth client
   (project `268317873723`).
2. **Re-minted `GOOGLE_ADS_REFRESH_TOKEN`** with the added scope via `get_refresh_token.py`
   (now requests both `adwords` and `datamanager`). Same env var, same token, now with both
   scopes — every existing `ads_*.py` script keeps working unchanged, and the bff provider gets
   the scope it needs.

Verified end-to-end with a disposable smoke test against the real `events:ingest` endpoint before
wiring anything into the app or touching GTM — got a clean `200` with a `requestId`, not another
allowlist rejection.

## Part A — GTM: disable the two client-side Ads tags

`gtm_disable_ads_tags.py` pauses "Ads - signup_complete"/"Ads - post_ad_success" (every other tag
untouched), applied and published as GTM container version 6. Confirmed live via `gtm_audit.py` —
both show `paused: true` in the published version. Applied only after the backend replacement was
confirmed working end-to-end via the smoke test above, never before, so there was no window with
neither tracking path live.

## Part B — New Google Ads conversion actions (`UPLOAD_CLICKS`)

`ads_create_offline_conversion_actions.py` (same `make_client()`/`--dry-run` pattern as every
other `ads_*.py` script, idempotent — skip-if-exists by name) created:
- **"New registration (offline)"** — category `SIGNUP`, type `UPLOAD_CLICKS`, id `7750776144`.
- **"Post ad success (offline)"** — category `SUBMIT_LEAD_FORM`, type `UPLOAD_CLICKS`,
  id `7750575968`.

**On the old `WEBPAGE`-type actions**: left in place. Once Part A paused their GTM tags they stop
receiving new hits entirely — no double-counting risk, since that only happens when two *live*
paths fire for the same event. They'll sit dormant in their categories going forward, which is the
same state the account already tolerates for the unused "Sign-up" action found earlier this
session — not ideal, but not a blocking problem. A full retirement (`status: REMOVED`) is a fine
future cleanup, out of scope here.

## Part C — The provider, `apps/bff/src/ads/google-ads-conversion.provider.ts`

Raw REST over `fetch`, `OAuth2Client` for the access token, never throws, fire-and-forget callers
in `AuthService.reportSignupConversion()` (called from `verifyOtp`/`loginWithGoogle`'s `isNewUser`
branch) and `ListingsService.create()`.

```
POST https://datamanager.googleapis.com/v1/events:ingest
Authorization: Bearer <access token, datamanager-scoped>
{
  "destinations": [{
    "operatingAccount": { "accountType": "GOOGLE_ADS", "accountId": "4214066478" },
    "productDestinationId": "<7750776144 | 7750575968>"
  }],
  "encoding": "HEX",
  "events": [{
    "eventTimestamp": "<RFC 3339, Date.toISOString()>",
    "transactionId": "signup-<userId> | listing-<listingId>",
    "adIdentifiers": { "gclid": "<gclid>" },
    "userData": { "userIdentifiers": [{ "emailAddress": "<sha256 hex>" }, { "phoneNumber": "<sha256 hex>" }] },
    "eventSource": "WEB"
  }]
}
```

- **No `developer-token` header** — Data Manager API ignores request headers on ingestion calls;
  access is scoped by OAuth credentials alone.
- **`transactionId`** is the dedup key (a repeated ingest with the same id, within the same
  conversion action, updates rather than double-creates) — derived from the business event's own
  identity (`signup-${user.id}` / `listing-${created.id}`), not a timestamp, so it's unambiguous
  regardless of exact call timing.
- **`userData.userIdentifiers`** — SHA-256 hashed (Node `crypto`), normalized (lowercase+trim
  email). `encoding: "HEX"` at the request level matches the hex digest directly.
- **Error handling** — gRPC-style status codes. `INVALID_ARGUMENT`/`NOT_FOUND`/
  `PERMISSION_DENIED`/`FAILED_PRECONDITION`/`UNAUTHENTICATED` logged as warnings;
  `UNAVAILABLE`/`DEADLINE_EXCEEDED`/`INTERNAL`/`UNKNOWN`/`ABORTED` logged at debug (transient, no
  retry loop — this is fire-and-forget, and the `transactionId` dedup means a future manual
  reconciliation wouldn't double-count if one were ever added).
- Config: `GOOGLE_ADS_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN` read by the bff container (added to
  `docker-compose.prod.yml`/`.env.production.example`); no developer token needed for this
  provider (still used elsewhere by the root scripts, untouched).

`adsConversionUploadedAt` migration on `User`, module wiring (`AdsModule` imported by
`AuthModule`/`ListingsModule`) — see the commit for full detail.

## Verification

1. ✅ Manual prerequisites done, confirmed via a real `events:ingest` smoke test (`200`,
   `requestId` returned).
2. ✅ `ads_create_offline_conversion_actions.py` — both `UPLOAD_CLICKS` actions created.
3. ✅ `pnpm --filter bff typecheck` / `build` pass.
4. ✅ GTM pause applied and published (container version 6), confirmed live via `gtm_audit.py`.
5. ✅ Deployed to production (see deployment notes / `docs/deployment.md` runbook).
6. Pending — a day or so out: confirm in the Google Ads UI that "New registration (offline)" /
   "Post ad success (offline)" are showing conversions, and the old `WEBPAGE` actions have gone
   quiet (proof the GTM pause actually took effect, not just the upload path working in
   parallel).
