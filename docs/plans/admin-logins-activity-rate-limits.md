# Admin: recent logins, per-user activity, admin-configurable publish/view rate limits

## Context

Three new admin capabilities, building on the moderation system just shipped (`apps/admin`, `AdminGuard`, `role=admin` allowlist):

1. A list of recent logins across all users, with date/time.
2. A per-user activity timeline, looked up by user id.
3. Rate limiting on publishing listings and on recording a listing view, with the limits
   themselves stored and editable from the admin app (not hardcoded).

**What's genuinely new here (confirmed via codebase research):** there is no login timestamp
anywhere today — only `User.createdAt` (account creation) and a one-time `phoneVerifiedAt`. There's
no rate-limit enforcement on `POST /listings` or the view-tracking endpoint at all today — in fact,
the *existing* `@Throttle()` decorators on the OTP routes in `auth.controller.ts` are currently inert
(no `ThrottlerGuard` is bound anywhere, globally or per-route), so those limits aren't actually
enforced despite being declared. That's a pre-existing gap, out of scope here — flagging it, not
silently fixing it, since it's unrelated to what was asked. `ListingView` (the existing view-count
table) dedupes to one row per (listing, viewer) ever, so it can't answer "how many view-attempts has
user X made recently" — rate limiting views needs its own tracking, separate from `ListingView`.

**Design decisions made while planning:**
- **Rate limiting is scoped to authenticated users only** ("rate limit *the user*") — anonymous/IP
  traffic is left untouched. This matters most for the view limit: this app deliberately allows
  browsing without login (SEO, crawlers), and rate-limiting anonymous `GET` traffic would work
  against that. The guard simply passes through when there's no logged-in user.
- **"View" is rate-limited at `POST /listings/:id/view`** (the existing view-tracking call), not the
  `GET /listings/:id` page load — that's what this codebase already calls a "view" (`ListingView`,
  `recordView`, `viewCount`), it's the same identity model (`user:<id>`) already used there, and it
  keeps crawlers/SEO completely out of scope since they never call this tracking endpoint.
  "Publish" is `POST /listings`.
  This directly follows from your answer to rate-limit both publish and view.
- **Enforcement storage is a small DB table (`RateLimitHit`), not in-memory.** In-memory counters
  (what `@nestjs/throttler`'s default storage does) reset on every deploy/restart, which would let a
  burst through right after any deploy — a DB row per hit, counted over a rolling window, is simple,
  durable, and easy to verify directly in Postgres (same approach used to verify the moderation
  feature). Tradeoff worth flagging: at real scale this adds a write per rate-limited action; fine
  for this app's current traffic, would move to Redis if that ever changes.
- **Login history is a real event log (`LoginEvent`), not just a `lastLoginAt` column** — "recent
  logged in users by date and time" reads as a list/history, and the same table feeds directly into
  the per-user activity timeline as one event type among several.
- **Per-user activity is aggregated on read, not a new unified log table.** Listings posted,
  messages sent, favourites, and views already have `userId`-ish fields + timestamps scattered
  across `Listing`, `Message`, `Favourite`, `ListingView`; a new `AdminService` method queries all of
  them in parallel and merges into one sorted timeline, rather than duplicating that data into a new
  table that could drift out of sync.

## Data model (`apps/bff/prisma/schema.prisma`)

```prisma
enum LoginMethod { otp google }

model LoginEvent {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id])
  method    LoginMethod
  createdAt DateTime    @default(now())

  @@index([userId, createdAt])
  @@index([createdAt])
}

enum RateLimitKind { publish view }

/** One row per rate-limited action attempt — counted over a rolling window at check time,
 * not pruned (same non-cleanup precedent as OtpChallenge). */
model RateLimitHit {
  id        String        @id @default(cuid())
  identity  String        // "user:<id>" — anonymous requests never reach this guard
  kind      RateLimitKind
  createdAt DateTime      @default(now())

  @@index([identity, kind, createdAt])
}

/** Singleton row (fixed id "singleton", upserted) — the admin-editable limits. */
model RateLimitSetting {
  id                   String   @id
  publishLimit         Int      @default(5)
  publishWindowMinutes Int      @default(1440)
  viewLimit            Int      @default(200)
  viewWindowMinutes    Int      @default(60)
  updatedAt            DateTime @updatedAt
}
```

- `User` gains `loginEvents LoginEvent[]`.
- `ListingView` gains `@@index([viewerKey])` — needed so "listings viewed by user X" (the activity
  timeline) doesn't do a full scan; today `viewerKey` is only the trailing column of a composite key.

Migration is additive (new tables/enums/index, one new back-relation) — no backfill needed.

## Backend (`apps/bff`)

**New `rate-limit` module** (`apps/bff/src/rate-limit/`), mirroring the existing `AuthGuard`/
`AdminGuard` pattern:
- `rate-limit.service.ts` — `getSettings()` (reads the singleton, creating the default row on first
  read), `updateSettings(input)` (upsert), `checkAndRecordHit(userId, kind)` (counts
  `RateLimitHit` rows for `user:<userId>` + `kind` created within the current window; if at/over the
  configured limit, throws `ThrottlerException` (429, from `@nestjs/throttler`, already a
  dependency); otherwise inserts a new hit row and returns).
- `rate-limit-kind.decorator.ts` — `@RateLimitAction('publish' | 'view')`, a `SetMetadata` helper
  (named `RateLimitAction` rather than `RateLimitKind` to avoid colliding with the `RateLimitKind`
  shared type of the same name in the same file).
- `rate-limit.guard.ts` — `RateLimitGuard implements CanActivate`: reads the kind via `Reflector`;
  if absent, passes through (not applied to this route); if `request.user` is absent (anonymous),
  passes through (rate limiting only applies to authenticated users, per the design decision above);
  otherwise calls `checkAndRecordHit`.
- `rate-limit.module.ts` — exports `RateLimitService`, `RateLimitGuard`.

**`ListingsModule`** imports `RateLimitModule`. In `listings.controller.ts`:
- `create()` (`POST /listings`): `@UseGuards(OptionalAuthGuard, RateLimitGuard) @RateLimitAction('publish')`.
- `recordView()` (`POST /listings/:id/view`): same pattern with `@RateLimitAction('view')`.
(Guard order matters — `OptionalAuthGuard` must run first so `request.user` is populated before
`RateLimitGuard` checks it.)

**`AuthService`** — `verifyOtp()` and `loginWithGoogle()` each insert a `LoginEvent` row (method
`otp`/`google` respectively) right before `issueSession()`. `linkPhone()` is not a login, untouched.

**`AdminModule`** imports `RateLimitModule` (already imports `ListingsModule`/`MessagingModule`).
New routes on the existing `AdminController` (all already under class-level `@UseGuards(AdminGuard)`):
- `GET /admin/logins` — paginated (`cursor`/`limit`, optional `from`/`to` date filters), joins
  `LoginEvent` → `User` for name/phone/email, ordered `createdAt desc`.
- `GET /admin/users/:id/activity` — new `AdminService.getUserActivity(id)`: fetches the user's
  profile plus, in parallel, `Listing` (by `ownerId`), `Message` (by `senderId`), `Favourite` (by
  `userId`), `ListingView` (by `viewerKey = 'user:<id>'`), and `LoginEvent` (by `userId`); maps each
  into a common `{type, timestamp, summary}` shape and returns them merged, sorted `desc`, capped
  (e.g. most recent 100).
- `GET /admin/listings/:id/owner` — small helper returning `{id, name, phone, email}` for the
  listing's owner, generalizing the existing private `getOwnerContact` helper in `AdminService`
  (renamed `getListingOwner`, now public and includes `id`) — used by the admin listing-detail page
  to link to "View owner activity" without leaking `ownerId` through the public `ListingDetailDto`.
- `GET /admin/rate-limits` / `PATCH /admin/rate-limits` — read/update the settings singleton via
  `RateLimitService`.

## Shared types (`packages/types/src/index.ts`)

- `LoginMethod`, `RateLimitKind` (mirroring the Prisma enums).
- `LoginEventDto { id, userId, userName, userPhone, userEmail, method, createdAt }`, `LoginEventsPage`.
- `ActivityEventDto { type: "login" | "listing_posted" | "listing_updated" | "message_sent" | "favourite_added" | "listing_viewed", timestamp, summary, refId? }`.
- `UserActivityDto { user: { id, name, phone, email, cityName, role, createdAt }, events: ActivityEventDto[] }`.
- `ListingOwnerDto { id, name, phone, email }`.
- `RateLimitSettingsDto` / `UpdateRateLimitSettingsInput` — `{ publishLimit, publishWindowMinutes, viewLimit, viewWindowMinutes }`.

## Admin app (`apps/admin`)

Following the existing `requireAdmin()` + `lib/bff.ts` thin-fetch-wrapper pattern:
- `src/app/logins/page.tsx` — table of recent logins (name/phone/email, method, when), each row
  linking to `/users/[id]`.
- `src/app/users/[id]/page.tsx` — user summary header + the merged activity timeline as a simple
  chronological list.
- `src/app/settings/rate-limits/page.tsx` — a small form (4 number inputs + Save), client component
  posting to a new `updateRateLimitsAction`.
- `src/app/listings/[id]/page.tsx` (existing moderation page) — add an owner summary line + "View
  owner activity" link, fetched via the new `GET /admin/listings/:id/owner`.
- `src/app/page.tsx` (dashboard) — add nav links to Logins and Rate limit settings alongside the
  existing tab filters.
- `src/lib/bff.ts` — add `fetchRecentLogins`, `fetchUserActivity`, `fetchListingOwner`,
  `fetchRateLimitSettings`, `updateRateLimitSettings`.

## Verification

- BFF (all confirmed live against the running dev server): logged in as two test users (OTP),
  confirmed `GET /admin/logins` showed both, newest first, correct phone/method/timestamp; a
  non-admin token got 403. Posted a listing and viewed another as one test user, confirmed
  `GET /admin/users/:id/activity` returned `login` → `listing_posted` → `listing_viewed` events,
  newest first. Lowered `publishLimit` to 2 via `PATCH /admin/rate-limits`, confirmed the 3rd
  publish attempt 429'd while a different (admin) user's publish and an anonymous publish were both
  unaffected; reset settings back to defaults afterward. Confirmed `GET /admin/listings/:id/owner`
  returns the right owner. All test users/listings/login events/rate-limit hits cleaned up after.
- Full monorepo `pnpm typecheck` (5 packages) — clean.
- Remaining: build out `apps/admin`'s new pages (logins list, user activity page, rate-limit
  settings page, dashboard nav links, owner link on the listing moderation page) — BFF side is done
  and verified; the UI is what's left.
