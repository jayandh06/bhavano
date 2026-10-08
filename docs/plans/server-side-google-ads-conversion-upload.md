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

## Part D — Purchases (2026-09-20)

Extended to every paid purchase, for a reason the data made plain. In 30 days Razorpay took 12
payments worth ₹1,000.50, **10 of them from a stored gclid** (`google/cpc`) worth ₹752, while
Google Ads showed one purchase conversion: ₹149. The browser tag only fires in a browser, and this
product's sellers manage their listings in the mobile app, where no tag can run at all.

- **Four `UPLOAD_CLICKS` actions** created by `ads_create_offline_conversion_actions.py`: Boost
  purchase (offline) `7781548730`, Instant alerts purchase (offline) `7781544854`, Contact reveal
  credits purchase (offline) `7781653126`, Subscription purchase (offline) `7781648601` — the last
  shared by all three tiers, matching how the client tag already grouped them.
- **A `--dry-run` caught a duplicate before it happened.** The script's names for the two original
  actions no longer matched the account: they had been renamed in the Ads UI, the upload actions
  taking the plain names and the superseded webpage ones suffixed `_removed`. Running it blind
  would have created a second "New registration (offline)" and "Post ad success (offline)".
- **The provider now carries `conversionValue` + `currency`** (Data Manager's own field names) and
  an `eventSource` of WEB or APP. Value is `Payment.amount / 100` — rupees, after discount, the
  figure actually charged.
- **Two new `Payment` columns**, captured at order time because the webhook is a server-to-server
  callback that sees neither: `adsTrackingAuthorized` (an ATT denial must never become an upload)
  and `platform` (from a new `X-Client: app` header, so an in-app purchase reports as APP —
  older mobile builds send nothing, which reads as unknown, not as web).
- **`PaymentsService.reportPurchaseConversion`** fires from the webhook after the row is marked
  paid, fire-and-forget. `transactionId` is the payment id, so a Razorpay webhook retry updates
  that event rather than counting a second conversion. 11 tests.
- **Part A repeated for purchases**: `gtm_disable_ads_tags.py` now also pauses
  `Ads - boost_purchase`, `Ads - subscription_purchase`, `Ads - contact_reveal_credits_purchase`
  and `Ads - instant_alerts_purchase`, published as container **version 9**. Without that, a web
  purchase would report twice — once per path, into two different conversion actions, which
  Google's own dedupe does not catch because it works within an action, not across them.
- **Backfill**: the 11 historical paid purchases were uploaded through the same service method,
  skipping the one subscription the browser tag had already counted.

### A correction worth keeping

Mid-investigation I read "Boost purchase: 0 conversions" from the Ads API and concluded the web tag
was broken for boosts. An hour later the same query returned **5 conversions, ₹380**. Ads conversion
reporting lags by hours and backfills against the *click* date, so a zero for recent purchases means
"not yet attributed", not "not recorded". The genuine gap was narrower than it looked: web purchases
were being counted, in-app ones were not.

One consequence of acting before that was clear: the backfill re-uploaded purchases the tag had
already counted, so up to 5 boost conversions (~₹380) now appear in **both** the webpage action and
the offline one for 14–20 September. Count one action or the other for that window, not their sum.
Everything from version 9 onward reports through exactly one path.

## Part E — Renamed the 4 purchase actions to drop "(offline)" (2026-09-21)

The `(offline)` suffix on live conversion actions read as "this one is off" in the Ads UI — the
opposite of reality, and confusing next to the now-dormant plain-named actions showing a
"Misconfigured" warning. Applied the same treatment "New registration"/"Post ad success" already
had (see Part B/D): for each of Boost purchase, Subscription purchase, Contact reveal credits
purchase, Instant alerts purchase —
1. Renamed the old dormant WEBPAGE action `"X"` → `"X_removed"` and retired it (`remove`
   operation; historical data stays visible in reports).
2. Renamed the live UPLOAD_CLICKS `"X (offline)"` action to the plain `"X"`.

Script: `rename_retire_offline_actions.py`, targeting by conversion action **ID** rather than
name — renaming and matching-by-name in the same operation is exactly what made
`ads_retire_dormant_conversion_actions.py`'s `NAMES_TO_RETIRE` stale for "Post ad success"/"New
registration" (fixed in that script's docstring alongside this change). Final state for all 6
purchase/lead actions with an offline successor now matches: plain name = live UPLOAD_CLICKS
action, `<name>_removed` = REMOVED WEBPAGE action.

## Phase 2 — "Post ad success" gets a value, not a ₹0 placeholder (2026-10-08)

**Why.** Every poster campaign bids on count (Target CPA against "Post ad success"), which treats
every post as equally valuable. It isn't — a posted plot-for-sale and a posted PG-for-rent have
very different odds of ever turning into a paid Boost. The account already has the data to know
this; it just wasn't being reported anywhere Google Ads could eventually use it.

**The model.** `apps/bff/src/ads/post-ad-value.ts` exports `postAdValueRupees(category,
transactionType)` — expected revenue per self-serve poster (payers *and* non-payers averaged
together, which is what makes it an expected value rather than an average purchase size), with a
three-level fallback: exact `category|transactionType` segment → `category` alone → the
account-wide average. Live numbers behind it, computed 2026-10-08 from real `Listing`/`Payment`
data (self-serve posts only — `source IN (direct, google_api)`, `createdByAdminId` null):

- **City was tried and dropped as a dimension.** `city x category x transactionType` gave 150
  possible segments; only 3 cleared a 10-poster minimum. `category x transactionType` is the
  finest level this account's current volume (337 self-serve posters, 41 paid payments total)
  actually supports — 8 of 15 real combinations clear the bar.
- **Window: 7 days, not the 60 originally assumed.** Checked the real post-to-payment latency
  first: median is 0 days, 98% of payments land within 7 days of the user's first post — boost
  purchases happen in the same posting session (it's offered right on the review/success screen),
  not weeks later.
- **Two independent signals now agree Villa isn't working.** `villa|rent` has a real, confirmed
  ₹0 value (10 posters, 0 payers) — not a thin-data artifact, an actual number — matching the
  separate finding in `google-ads-keyword-audit-2026-10.md` that Villa ad groups get zero ad
  impressions too. Neither keyword wording nor revenue model is the problem there; demand is.
- Full current table and the fallback reasoning live in `post-ad-value.ts`'s own doc comment,
  not duplicated here — that's the one place that should stay in sync with the live numbers.

**Wired into the existing upload**, `ListingsService.runPostLiveSideEffects`'s call to
`uploadClickConversion` — no new conversion action, no new event, just a `value`/`currency` on
the one that already fires. "New registration" stays valueless; it has no revenue model behind
it the way a post does.

**Deliberately *not* driving bids yet.** Every poster campaign still runs Target CPA, which
optimizes toward conversion count, not value — so this is purely observational in the Ads UI for
now. Static table, not a live recompute, for the same reason `campaign-names.ts` is static: 41
total paid payments is thin enough that an unattended weekly refresh would just chase noise.
Regenerate by hand once there's meaningfully more volume behind the thin segments — the same
~30/month trust threshold already used for this account's tROAS decision is the right bar before
either refreshing automatically or switching any campaign to value-aware bidding (Maximize
Conversion Value) to actually act on this.

**Regenerating the table**: `apps/bff/scripts/regenerate-post-ad-value.ts` re-runs the same
analysis against live data (posters/payers/revenue per segment, plus the latency check that
justified the 7-day window) and prints a reviewable table — never writes anything itself. Run it,
read the output, then hand-edit `post-ad-value.ts`'s three tables if anything's actually changed.
Confirmed working against production 2026-10-08: numbers were stable (337→338 posters, same
ranking), so the current hardcoded table didn't need updating yet.

**Test coverage**: `post-ad-value.spec.ts` covers the fallback chain in isolation (segment →
category → account-wide, plus Villa's real zero not being confused with a fallback). A new
`describe('ListingsService.runPostLiveSideEffects — Post ad success conversion value')` block in
`listings.service.spec.ts` covers the actual wiring — calls the private method directly (`create()`
itself needs mocking moderation/pricing/slots/locations just to reach it, which would make the
test mostly about unrelated plumbing) and asserts `uploadClickConversion` receives the right
`value`/`currency` for a plain segment, a thin one that falls back, and Villa's real zero — plus
that nothing uploads at all when tracking wasn't authorized. Neither this call path nor `create()`
itself had any test coverage before this.

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
