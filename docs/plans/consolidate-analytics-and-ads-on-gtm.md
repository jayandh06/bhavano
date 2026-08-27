# Consolidating analytics + Ads conversion tracking on GTM

## Why

Production currently serves **two Google tags on every page**, both injected by our own
`apps/web/src/app/layout.tsx`:

| Tag | Injected by | What it does today |
|---|---|---|
| `gtag/js?id=AW-18351718445` | `layout.tsx` direct `<Script>` block | `gtag('config', …)` — pageviews + remarketing only |
| `GTM-N46D868W` container | `layout.tsx` GTM loader + `<noscript>` | Loads the container; measures whatever is configured in the dashboard |

This is redundant **delivery**, not redundant measurement. `AW-18351718445` is the Google Ads
account ID and is always required — the only question is how it reaches the page. GTM can deliver
it, so shipping a second hardcoded `gtag.js` alongside the container is one courier too many.

Two concrete problems follow:

1. **A live double-count trap.** The instant a Google Ads tag for `AW-18351718445` is added inside
   `GTM-N46D868W`, that ID is configured twice on the same page — remarketing pageviews double,
   and any conversion configured on both paths counts twice. Nothing warns you.
2. **Zero conversions are being recorded despite both tags being live.** The app already pushes 8
   semantically-named events to `dataLayer` (table below), but `gtag.js` **ignores** `dataLayer`
   `event` keys — that dispatch mechanism is GTM-specific. `grep -rn "send_to" apps/web/src`
   returns nothing, so no conversion is reported to Ads from any code path.

Separately, there is **no analytics at all**: no GA4 property is referenced anywhere in the repo.
"Track analytics and ads conversion" needs both halves, and GTM delivers both from one container.

## Current state (verified)

| Thing | State |
|---|---|
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-18351718445` in root `.env` **and** `apps/web/.env` (local dev fires the live tag) |
| `NEXT_PUBLIC_GTM_ID` | **blank** in local `.env`; **set to `GTM-N46D868W` on the prod host** (its `.env` is a separate file — confirmed from the rendered markup) |
| Direct gtag block | `layout.tsx:93-107`, live on `www.bhavano.com` |
| GTM container block | `layout.tsx:82-88` + `<noscript>` in `<body>`, live on `www.bhavano.com` |
| Conversion reporting | **None.** No `send_to`, no `gtag('event', 'conversion', …)` anywhere |
| GA4 | **None.** No `G-XXXXXXXXXX` measurement ID anywhere in the repo |
| Contents of `GTM-N46D868W` | **Unknown — must be audited in the dashboard before step 1** |

### The 8 events already firing (this is the asset — don't rebuild it)

All go through `pushDataLayerEvent()` in `apps/web/src/lib/gtm.ts`.

| Event | Fires from | Payload keys |
|---|---|---|
| `post_ad_success` | `PostAdWizard.tsx:478` | `listingId` |
| `boost_purchase` | `BoostButton.tsx:76` | `transactionId`, `listingId`, `category`, `boostDays`, `value`, `currency` |
| `begin_checkout_boost` | `BoostButton.tsx:49` | same as above |
| `subscription_purchase` | `SubscribeButton.tsx:77` | `transactionId`, `tier`, `months`, `value`, `currency` |
| `begin_checkout_subscription` | `SubscribeButton.tsx:52` | same as above |
| `signup_complete` | `AuthGateProvider.tsx:67` (phone) + `SignupConversionTracker.tsx:27` (Google) | `method` (`"phone"` or `"google"`) |
| `save_search` | `SavedSearchesManager.tsx:98` | `category`, `transactionType` |
| `contact_owner` | `ListingDetailActions.tsx:46` | `listingId` |

`value` is already in **rupees** (converted from Razorpay paise at the call site) and `currency`
resolves to `INR`. `transactionId` is the Razorpay payment ID — usable directly as the Ads dedupe
key.

## Decision

**Keep GTM (`GTM-N46D868W`) as the single delivery path. Remove the direct `gtag.js` block.**

Rationale, specific to this codebase:

- The 8 events above already speak GTM's language and are being wholly ignored by the direct tag.
  Switching makes them work with **no code changes at the call sites**.
- Future conversions become GTM dashboard edits — no code change, no `docker build`, no redeploy.
  On the direct path every new conversion label is a full deploy cycle.
- GA4 (the analytics half) rides the same container and reuses the same events.
- `docs/google-ads-conversion-setup.md` already documents the GTM route step-by-step; it becomes
  accurate again rather than needing a rewrite.

The direct tag was the correct call when `AW-18351718445` was the only ID available. Now that a
container exists, it is the weaker option.

---

## Step 0 — Audit the container first (blocking)

Before removing anything, open tagmanager.google.com → container `GTM-N46D868W` → **Tags**.

- **If a Google Ads tag for `AW-18351718445` already exists** → double-counting is already
  happening. Note which conversions, so inflated historical numbers can be discounted later.
- **If the container is empty** → no harm has occurred yet; proceed.

Record the finding in the log at the bottom of this doc. This determines whether Ads data from the
period both tags were live is trustworthy.

## Step 1 — Remove the direct gtag block (code)

**File:** `apps/web/src/app/layout.tsx`

- Delete the `{GOOGLE_ADS_ID && ( … )}` block at lines 93-107 (both `<Script>` tags).
- Delete the `GOOGLE_ADS_ID` constant and its comment (lines 27-32).
- Leave the GTM loader and `<noscript>` iframe untouched.

**Env cleanup** — `NEXT_PUBLIC_GOOGLE_ADS_ID` is no longer read by any code. Remove it from:
`.env`, `.env.production.example`, `apps/web/.env`, `apps/web/.env.example`, `apps/web/Dockerfile`
(`ARG` + `ENV`), and `docker-compose.prod.yml` (`build.args` + `environment`). This effectively
reverts commit `f24584a`.

> The Ads ID itself is **not** being discarded — `AW-18351718445` gets entered into the GTM tags in
> step 4 instead. It stops being an app env var and becomes dashboard configuration.

Also add a blank `NEXT_PUBLIC_GTM_ID=` (with the existing explanatory comment) to `apps/web/.env`
so local dev is explicitly opted out and nobody wonders why the key is missing.

Verify: `pnpm --filter @bhavano/web typecheck && pnpm --filter @bhavano/web lint`.

## Step 2 — Deploy and confirm exactly one tag

`NEXT_PUBLIC_*` is inlined at `next build`, so a restart is not enough:

```
docker compose -f docker-compose.prod.yml up -d --build web
```

Confirm the direct tag is gone and the container remains:

```
curl -sL https://www.bhavano.com | grep -oE "gtag/js\?id=[A-Z0-9-]+|gtm\.js\?id=[A-Z0-9-]+|AW-[0-9]+|GTM-[A-Z0-9]+" | sort -u
```

Expected: `GTM-N46D868W` and `gtm.js?id=GTM-N46D868W` only. **No `AW-` and no `gtag/js`.**

## Step 3 — GA4 config tag in GTM (the analytics half)

1. analytics.google.com → create a **GA4 property** for bhavano.com if one doesn't exist → copy the
   **Measurement ID** (`G-XXXXXXXXXX`).
2. GTM → **Tags → New** → **Google Tag** → Tag ID `G-XXXXXXXXXX` → trigger **Initialization - All
   Pages**.
3. For each of the 8 events, add a **GA4 Event** tag (event name matching the `dataLayer` event) on
   the matching Custom Event trigger from step 4.1. These populate GA4 reporting and can later be
   *imported* into Ads as an alternative to step 4's tags — do not do both for the same action.

## Step 4 — Ads conversions in GTM

### 4.1 Shared setup (once)

- **Conversion Linker**: Tags → New → **Conversion Linker** → trigger **All Pages**. Captures
  `gclid` into a first-party cookie so conversions attribute back to the ad click. Without it,
  conversions silently under-report, worst on Safari/iOS.
  *(The direct `gtag.js` did this implicitly; on the GTM path it must be added explicitly. Do not
  skip this step.)*
- **Data Layer Variables** (Variables → New, type *Data Layer Variable*), one each for: `value`,
  `currency`, `transactionId`, `listingId`, `method`, `category`, `transactionType`, `tier`,
  `months`, `boostDays`.
- **Custom Event triggers**, one per event name in the table above (exact string match).

### 4.2 The 5 conversion actions

In Google Ads → Tools & Settings → **Measurement → Conversions → + New conversion action →
Website** → choose **"Add the tag manually"** (the tag is already installed via GTM; letting Ads
install another recreates the redundancy this plan removes). Copy each action's **Conversion
Label**.

| Conversion | Event | Ads category | Value | Count |
|---|---|---|---|---|
| Boost purchase | `boost_purchase` | Purchase | Use different values (₹) | One |
| Subscription purchase | `subscription_purchase` | Purchase | Use different values (₹) | One |
| Post ad success | `post_ad_success` | Submit lead form | No value | One |
| New registration | `signup_complete` | Sign-up | No value | One |
| Save a search | `save_search` | Submit lead form | No value | One |

Then in GTM, one **Google Ads Conversion Tracking** tag per row:

- Conversion ID `AW-18351718445` (same for all five), Conversion Label from that action.
- **Value conversions only** — Conversion Value `{{DLV - value}}`, Currency `{{DLV - currency}}`,
  Transaction ID `{{DLV - transactionId}}` (dedupes a flaky reload or double-submit).
- Trigger: the matching Custom Event trigger.

`begin_checkout_*` and `contact_owner` are deliberately **not** Ads conversions — keep them as GA4
events for funnel analysis. `contact_owner` is the strongest future candidate if lead volume
matters more than ad postings.

### 4.3 Sanity check in the Ads account

**Settings → Account settings → Auto-tagging** must be **ON** (default). It is what appends
`?gclid=…` on ad clicks; with it off, the Conversion Linker has nothing to capture and every
conversion fails to attribute.

## Step 5 — Verify before publishing

1. GTM **Preview** → open the live site in the preview session → exercise each path: post a test
   ad, boost + subscribe with Razorpay test mode, sign up with both a fresh phone number **and** a
   fresh Google account, save a search.
2. Confirm each Custom Event trigger fires and each tag shows **Fired**, with `value` non-zero and
   `currency` reading `INR` on the two purchase tags.
3. Cross-check with **Tag Assistant** (`tagassistant.google.com`) that exactly **one** Google tag is
   present — this is the regression check for the redundancy being gone.
4. **Publish** the container version.
5. GA4 **DebugView** should show the events within seconds. Ads conversion counts can take up to 24h
   and need real ad-driven traffic.

## Step 6 — Update the docs

`docs/google-ads-conversion-setup.md` describes the GTM route and becomes correct again — but its
"Context" section predates the direct tag. Add a short note recording that the direct `gtag.js` tag
was tried and removed, and why, so the next person doesn't reintroduce it.

`docs/deployment.md` — remove the `NEXT_PUBLIC_GOOGLE_ADS_ID` paragraph added in `f24584a`, and note
that `NEXT_PUBLIC_GTM_ID=GTM-N46D868W` is the one tag variable.

## Rollback

Step 1 is a clean revert of `f24584a` plus the env deletions; step 2 is a rebuild. GTM changes are
versioned — the dashboard's **Versions** tab restores any previous container state instantly,
without a deploy. Nothing here touches routing, rendering strategy, or metadata, so there is no SEO
surface to regress.

## Out of scope

- **Enhanced conversions** (hashed email/phone sent with the conversion for better match rates).
  Worth revisiting once the five above are recording — it needs a privacy-policy review since it
  transmits user identifiers.
- **Consent Mode v2** — required for EEA/UK traffic. Not needed for India-only traffic today;
  becomes mandatory if the audience expands.
- Server-side tagging.

## Findings log

*Step 0 audit result — fill in before starting step 1:*

- Contents of `GTM-N46D868W` as of ____________:
- Was `AW-18351718445` already configured in the container? [ ] Yes [ ] No
- If yes, affected date range for discounted historical data:
