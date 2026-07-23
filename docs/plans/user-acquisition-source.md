# Acquisition source: first-touch on User + a per-session Visit log

## Goal

Know which website/source (Google, Facebook, a partner referral link, a UTM-tagged campaign, or
direct) each user arrived from. Two complements, mirroring the existing
denormalized-field-plus-audit-trail pattern in this codebase (e.g. `User.premiumUntil` +
`UserSubscription`, `Listing.boostedUntil` + `ListingBoost`):

1. **`User.acquisitionSource/Medium/Campaign`** — a cheap-to-read, permanent summary of how the
   user *originally* found Bhavano, set once at signup and never touched again.
2. **`Visit`** — a full audit log, one row per browser session (not per page load), covering
   *every* visit including ones that never convert to a signup, i.e. `userId` starts `null` for
   anonymous visitors and gets filled in later if that session logs in.

## Design decisions

- **What's captured** (both mechanisms): UTM params (`utm_source`/`utm_medium`/`utm_campaign`) if
  the landing link was tagged; otherwise the external `Referer` header's hostname (medium
  `"referral"`); otherwise `"direct"`.
- **`User.acquisitionSource` timing**: first-touch, immutable. The `bhavano_acq` cookie (30-day
  expiry) is written on the user's very first page visit and never overwritten afterward. It's
  persisted to the `User` row only on account creation, not on later logins — so it always
  reflects the user's *original* first touch, independent of which session they happen to sign up
  in.
- **`Visit` session boundary**: a new session = a new browser sitting. The `bhavano_sid` cookie has
  no `maxAge` (a true session cookie — cleared when the browser/tab closes), so reopening the site
  later starts a new session and a new `Visit` row, even for a returning, previously-logged-in
  user. This covers anonymous visitors too (not just people who eventually sign up).
- **Where the write happens**: `apps/web`'s middleware can't reach Prisma directly (it lives in
  the BFF, a separate Node process), so on a new session middleware fires a non-blocking
  `event.waitUntil(fetch(...))` call to a new public `POST /analytics/visit` BFF endpoint — it
  never blocks or delays the page response. `AnalyticsService.recordVisit` upserts by `sessionId`
  so a retried/duplicate call is a no-op.
- **Linking a session to a user**: when a session goes on to log in, `verifyOtp`/`loginWithGoogle`
  now also receive the session's `sessionId` and fire a best-effort, non-awaited
  `AnalyticsService.linkVisitToUser(sessionId, userId)` — an `updateMany` that only touches rows
  where `userId` is still `null`, so a session's attribution is never reassigned once set.

## Implementation

- **`apps/bff/prisma/schema.prisma`**:
  - `User.acquisitionSource/Medium/Campaign` (nullable `String`) — migration
    `20260723000000_add_user_acquisition_source`.
  - `Visit` model (`sessionId` unique, `userId` nullable FK `onDelete: SetNull`, `source`/
    `medium`/`campaign`/`landingPath`, `createdAt`) + `User.visits` relation — migration
    `20260723010000_add_visit_log`.
- **`apps/web/src/middleware.ts`** — resolves the source once per request (shared helper), then:
  sets `bhavano_acq` (30-day) if not already present; sets `bhavano_sid` (session cookie, no
  `maxAge`) if not already present and, only in that case, fires `event.waitUntil(fetch(...))` to
  `POST /analytics/visit` on the BFF with `{ sessionId, source, medium, campaign, landingPath }`.
  Skips `/api`, `_next`, and static assets via `matcher`. Pure passthrough otherwise (no
  redirects/rewrites) — doesn't affect SEO/rendering.
- **`apps/web/src/lib/bff.ts`** — `verifyOtp`/`loginWithGoogle` read both cookies (via
  `next/headers` `cookies()`) and include the parsed acquisition fields *and* `sessionId` in the
  POST body to the BFF. Missing/malformed cookies are silently treated as "nothing to attribute" —
  never blocks login.
- **`apps/bff/src/analytics/`** (new module) — `RecordVisitDto`; `AnalyticsController` (public
  `POST /analytics/visit`, protected only by the app-wide default throttle); `AnalyticsService`
  with `recordVisit()` (upsert by `sessionId`) and `linkVisitToUser()` (`updateMany` guarded by
  `userId: null`). Registered in `app.module.ts` and imported into `AuthModule`.
- **`apps/bff/src/auth/dto/{verify-otp,google-login}.dto.ts`** — added optional
  `acquisitionSource`/`acquisitionMedium`/`acquisitionCampaign`/`sessionId` string fields.
- **`apps/bff/src/auth/auth.controller.ts`** — forwards the DTO's fields to `AuthService` as a
  `VisitContext`.
- **`apps/bff/src/auth/auth.service.ts`** — `VisitContext` interface (renamed from
  `AcquisitionSource`, now also carries `sessionId`) + `acquisitionCreateFields()` helper, which
  only appears in the `create` branch of the `verifyOtp`/`loginWithGoogle` upserts (same
  never-overwrite pattern as `welcomedAt`). After a successful login, a new private
  `linkVisitToUser()` fires a best-effort, non-awaited call into `AnalyticsService`.

## Admin UI

The per-user detail screen (`apps/admin/src/app/users/[id]/page.tsx`, reached from `/logins` by
clicking a row) now shows:

- **"Found via: ..."** in the user header — the permanent `User.acquisitionSource/Medium/Campaign`
  summary (or "unknown (predates acquisition tracking)" for users who signed up before this
  shipped).
- **"Visit history"** — a new section listing that user's `Visit` rows (newest first): resolved
  source/medium/campaign, landing path, and timestamp.

Wiring: `UserActivityDto` (packages/types) gained the three `acquisition*` fields on `user` plus a
`visits: VisitDto[]` array; `AdminService.getUserActivity` now also queries `prisma.visit.findMany`
alongside the existing logins/listings/messages/favourites/views and maps it into the response.
No new BFF endpoint was needed — it's the same `GET /admin/users/:id/activity` call.

## Not done / explicitly out of scope

- No admin UI to view/filter by acquisition source or visit history yet (data model + capture
  only).
- No backfill for existing users/sessions — pre-existing `User` rows have `null` acquisition
  fields, and there's no `Visit` history before this shipped.
- No IP address or user-agent captured on `Visit` rows (kept to source/medium/campaign/landing
  path only) — revisit if richer analytics are needed later.
- `POST /analytics/visit` relies only on the app-wide default rate limit (20 req/60s/IP) since it's
  unauthenticated by necessity (fires before any login) — revisit if it's abused.
