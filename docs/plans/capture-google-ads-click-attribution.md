# Capture Google Ads campaign/ad-group/ad attribution on visits and signups

## Context

Google Ads conversion tracking today is entirely client-side (GTM `dataLayer` events +
Conversion Linker), which we found this session can silently miss a real signup if the visitor's
browser/network blocks the tracking script — the account and even the listing get created, but
Google Ads never hears about it. Separately, when reviewing recent account changes, several
questions ("what changed on Sep 2", "who made this change") were only answerable by digging
through Google Ads' own change-history API — there's no way to ask *our own database* which
campaign/ad group/ad actually drove a given signup.

The fix decided on: capture Google Ads' click-identifying URL parameters (`gclid`, campaign id, ad
group id, ad id) the same way this app already captures UTM parameters — server-side, on landing,
independent of any client-side script — and carry them through to the `User` row at signup. This
is *not* new infrastructure: `apps/web/src/middleware.ts` already resolves UTM source/medium/campaign
into a `bhavano_acq` cookie and a `Visit` table row, and `docs/google-ads-api-design-doc.md`
(section 7) already states an intent to correlate Ads spend against exactly this `Visit`/
`acquisition*` data — that correlation was never built because the Ads-specific params were never
captured. This plan closes that gap by extending the existing pipeline, not building a parallel one.

Scope: **visits and signups only** (as asked) — not listing-post attribution, and not reporting
these values back to Google Ads via the Conversion Upload API. Both are natural follow-ups once
this data exists, but are out of scope here.

## Part A — Google Ads: Final URL suffix

Set a **Final URL suffix** (not a per-ad-group Final URL edit) on the campaigns, so every ad click
carries the params without touching individual ads/ad groups:

```
gclid={gclid}&campaignid={campaignid}&adgroupid={adgroupid}&adid={creative}
```

Apply via the Ads API (`campaign.final_url_suffix`), reusing the existing `make_client()` from
`ads_setup_conversions.py` — same pattern as the other `ads_*.py` scripts in the repo root. Apply
to all 6 campaigns (the 4 active ones for immediate effect; the 2 paused ones too, so nothing needs
redoing if they're ever resumed). One-off mutate script, run once, no ongoing dependency.

## Part B — Capture pipeline (extends the existing UTM/Visit/acquisition flow)

### 1. `apps/web/src/middleware.ts` — `resolveSource()` (lines 16-43)

Extend `ResolvedSource` with `gclid?`, `campaignId?`, `adGroupId?`, `adId?`. These are captured
**independently** of the existing source/medium/campaign resolution (additive facts, not a
replacement branch):

- Read `gclid`, `campaignid`, `adgroupid`, `adid` from `searchParams` whenever present.
- If `gclid` is present but `utm_source` is not, default `source: "google", medium: "cpc"` before
  falling through to the referrer/"direct" logic — a bare `gclid` on the URL *is* Google's own
  auto-tagging firing, so it's a stronger signal than an absent UTM param, but an explicit
  `utm_source` should still win if both are present (an advertiser can deliberately override).

Thread the four new fields into both:
- The `bhavano_acq` cookie payload (line 114) — same cookie, extended JSON shape.
- The `/analytics/visit` POST body (lines 136-143).

### 2. `apps/bff/prisma/schema.prisma` — new columns + migration

**`Visit` model** (lines 553-580) — add, matching its existing bare-name convention
(`source`, `medium`, `campaign`, not prefixed):
```
gclid       String?
campaignId  String?
adGroupId   String?
adId        String?
```

**`User` model** (lines 225-234) — add, matching its existing `acquisition*`-prefixed convention,
right after `acquisitionCampaign`:
```
acquisitionGclid       String?
acquisitionCampaignId  String?
acquisitionAdGroupId   String?
acquisitionAdId        String?
```
Update the doc comment above `acquisitionSource` (lines 225-230) to mention these.

Run `npx prisma migrate dev --name add_google_ads_click_attribution` in `apps/bff` (matches the
existing migration convention — `apps/bff/prisma/migrations/`, 39 entries so far).

### 3. `apps/bff/src/analytics/dto/record-visit.dto.ts`

Add the same four fields as optional `@IsString() @MaxLength(...)` (mirror `campaign`'s style,
lines 18-21), plus a `@Matches(/^[\w-]+$/)` on `gclid` since it's an opaque Google-issued token
with a known character set, not free text like `source`.

### 4. `apps/bff/src/analytics/analytics.service.ts` — `recordVisit()` (lines 16-35)

Thread `dto.gclid`, `dto.campaignId`, `dto.adGroupId`, `dto.adId` into the `prisma.visit.upsert`'s
`create` block (alongside the existing `source`/`medium`/`campaign`/`landingPath`, lines 25-28).

### 5. `apps/bff/src/auth/auth.service.ts`

- `VisitContext` interface (lines 24-31): add `gclid?`, `campaignId?`, `adGroupId?`, `adId?`.
- `acquisitionCreateFields()` (lines 36-43): spread the four new fields into the same
  create-only payload — same rule as today (only written once, at row creation, on the
  `visit?.source` presence check; never touches the `update` branch, so a returning user's
  original attribution is never overwritten).

### 6. `apps/bff/src/auth/dto/verify-otp.dto.ts` and `google-login.dto.ts`

Add the same four optional fields as the existing `acquisitionSource/Medium/Campaign` (verify-otp.dto.ts
lines 16-29) — same validators, same doc-comment style.

### 7. `apps/bff/src/auth/auth.controller.ts`

`verifyOtp()` (lines 32-42) and `loginWithGoogle()` (lines 44-53): add the four fields to the
`VisitContext` object passed into `authService.verifyOtp`/`loginWithGoogle`, mirroring
`source`/`medium`/`campaign` already there.

### 8. `apps/web/src/lib/bff.ts` — `getVisitContext()` (lines 299-329)

Extend the parsed cookie shape and the returned object with `gclid`, `campaignId`, `adGroupId`,
`adId` (from the extended `bhavano_acq` JSON) — same pass-through pattern already used for
`acquisitionSource/Medium/Campaign`. No changes needed to `verifyOtp()`/`loginWithGoogle()`
themselves (lines 331-349) — they already spread the full `getVisitContext()` result into the
request body.

## Verification

1. Land on the site with `?gclid=test123&campaignid=999&adgroupid=888&adid=777` appended —
   confirm (via browser devtools) the `bhavano_acq` cookie's JSON now includes all four fields.
2. Confirm the `Visit` row created for that session (query via Prisma Studio or a `SELECT`) has
   `gclid/campaignId/adGroupId/adId` populated, matching the URL.
3. Complete a phone-OTP signup in that same browser session — confirm the new `User` row's
   `acquisitionGclid/CampaignId/AdGroupId/AdId` are populated, and that `Visit.userId` got
   backfilled (via the existing `linkVisitToUser` call, unchanged).
4. Log out and log back in (existing user, `bhavano_acq` cookie cleared/changed) — confirm the
   `User` row's acquisition fields are **not** overwritten (same guarantee as today for
   `acquisitionSource/Medium/Campaign` — proves `acquisitionCreateFields()`'s create-only guard
   still holds for the new fields).
5. `npx prisma migrate dev` applies cleanly with no manual intervention; `pnpm --filter bff build`
   and `pnpm --filter web typecheck` (or repo-equivalent scripts) pass with no type errors from the
   new DTO/schema fields.
6. Re-run `ads_report.py`-style read (or a one-off GAQL query on `campaign.final_url_suffix`) to
   confirm the Final URL suffix is live on all 6 campaigns.
