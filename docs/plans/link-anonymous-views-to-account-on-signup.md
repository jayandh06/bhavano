# Link anonymous browsing history to a real account at signup

## Context

The ask: track which listings a logged-out visitor viewed, recognize the same visitor on a later
visit, and — if they eventually sign up — retroactively attribute that pre-signup browsing to
their new account.

Most of this already exists, just not connected end to end:

- **Views are already tracked anonymously and persistently.** `ViewTracker.tsx` (web,
  `apps/web/src/components/home/ViewTracker.tsx:6-15`) and its mobile equivalent
  (`apps/mobile/app/listing/[id].tsx:23-29`) mint a `crypto.randomUUID()` once and persist it —
  `localStorage` on web, `AsyncStorage` on mobile — under the key `bhavano.viewerKey`, sent as
  `anon:<uuid>` on every `POST /listings/:id/view`. `ListingsService.recordView`
  (`apps/bff/src/listings/listings.service.ts:1871-1877`) writes it to `ListingView` (`schema.prisma
  :404-413`, unique on `[listingId, viewerKey]`). Because it's client-storage-backed (not a
  session cookie), it already survives across visits — "recognize them again later" is solved as
  long as it's the same browser/app install.
- **The retroactive-linking precedent already exists — for a different table.**
  `AnalyticsService.linkVisitToUser` (`apps/bff/src/analytics/analytics.service.ts:40-48`) fills in
  `Visit.userId` from the session cookie at login, called fire-and-forget from three spots in
  `AuthService` (`apps/bff/src/auth/auth.service.ts:130,236,304`, via the private
  `linkVisitToUser` wrapper at `:393-401` that swallows errors and never blocks login).

**The actual gap**: nothing does the equivalent for `ListingView`. Anonymous rows are deliberately
excluded from every user-facing read today (`listEngagement`'s doc comment,
`apps/bff/src/listings/listings.service.ts:740-748`), so a visitor's pre-signup history is
permanently unrecoverable even after they sign up on the same device. This plan adds exactly the
missing piece — the `ListingView` equivalent of `linkVisitToUser` — reusing the same call sites,
the same fire-and-forget/never-blocks-login shape, and the same client-persisted key both
platforms already have.

**Decided (confirmed with the user):**
- **Linking only, no new UI.** Once relinked, existing consumers (view counts, the admin
  engagement table) see accurate history automatically — no new "recently viewed" surface in this
  pass.
- **Ship for web and mobile together** — both already use the identical `anon:<uuid>` mechanism
  against the same endpoint, so the backend piece is shared regardless; leaving one platform out
  would just recreate the same gap there.

## The one real design decision: avoiding a unique-constraint collision

`ListingView` is unique on `(listingId, viewerKey)`. A visitor can plausibly have **both** an
`anon:<uuid>` row and a `user:<id>` row for the *same* listing already (viewed once logged out,
then again after logging in on the same or another device) — a naive `updateMany` that rewrites
`viewerKey` from `anon:X` to `user:Y` would violate that constraint on any listing where a
`user:Y` row already exists.

Fix: don't update in place — **upsert then delete**, per anonymous row:
```ts
async linkListingViewsToUser(viewerKey: string, userId: string): Promise<void> {
  const anonKey = `anon:${viewerKey}`;
  const userKey = `user:${userId}`;
  const rows = await this.prisma.listingView.findMany({ where: { viewerKey: anonKey } });
  for (const row of rows) {
    await this.prisma.listingView.upsert({
      where: { listingId_viewerKey: { listingId: row.listingId, viewerKey: userKey } },
      update: {},
      create: { listingId: row.listingId, viewerKey: userKey },
    });
  }
  await this.prisma.listingView.deleteMany({ where: { viewerKey: anonKey } });
}
```
This is idempotent (safe if called twice, e.g. a retried login) and never throws on the collision
case — a listing already viewed as `user:Y` simply keeps that row; the redundant `anon:X` row for
it is dropped along with the rest. Lives in `ListingsService` alongside `recordView`, mirroring
where `linkVisitToUser` lives next to `recordVisit` in `AnalyticsService`.

**Accepted trade-off, same one `Visit` already has**: a shared/public device means the next
person to sign in on it inherits whatever the previous anonymous visitor browsed. `linkVisitToUser`
already accepts this exact risk for page-visit attribution; it's not worth a different bar for
listing views.

## Wiring — reusing the existing login call sites

`AuthService`'s three login/signup methods (`verifyOtp`, `loginWithGoogle`, `loginWithApple`,
`auth.service.ts:130,236,304`) already take an options object carrying `sessionId` through to
`linkVisitToUser`. Add `viewerKey?: string` to that same options type (`:41`) and call
`this.linkListingViewsToUser(viewerKey, promoted.id)` right next to the existing
`this.linkVisitToUser(...)` call at each of the three sites — same fire-and-forget, same
error-swallowing shape as `linkVisitToUser`'s own wrapper (`:393-401`).

`VerifyOtpDto`, `GoogleLoginDto`, `AppleLoginDto` (`apps/bff/src/auth/dto/`) each gain an optional
`viewerKey` field, read by `AuthController` (`auth.controller.ts:42-90`) alongside the existing
`dto.sessionId` and passed into the same options object.

**Getting the key from client to request body** — this differs by platform, since only web has a
cookie jar a server action can read transparently; `sessionId` reaches the BFF that way today
(`apps/web/src/lib/bff.ts:443`, `jar.get(SESSION_COOKIE)`), but `viewerKey` is `localStorage`, which
no server action can see. Rather than turning `viewerKey` into a cookie (which would leave web and
mobile using two different mechanisms for "the same" identifier), keep both platforms symmetric:
the client explicitly passes its already-stored key at login time, same as mobile already does for
every other argument on these calls today (`bffFetch` has no implicit cookie magic).

- **Web**: `lib/bff.ts`'s `verifyOtp(phone, code)` / `loginWithGoogle(idToken)` (`:472-490`) gain an
  optional `viewerKey` parameter, included in the POST body. That value has to originate from a
  client component reading `localStorage.getItem("bhavano.viewerKey")` at submit time and flowing
  through `verifyOtpAction`/NextAuth's `signIn("phone-otp", {...})` call
  (`apps/web/src/app/actions/auth.ts:18-31`) into whichever NextAuth provider's `authorize()`
  callback (`apps/web/src/auth.ts`) actually calls `lib/bff.ts`'s `verifyOtp`/`loginWithGoogle` —
  same indirection `phone`/`code` already travel through today, `viewerKey` just rides along.
- **Mobile**: `bffClient.ts`'s `verifyOtp`/`loginWithGoogle`/`loginWithApple`
  (`apps/mobile/src/lib/bffClient.ts:355-385`) each gain an optional `viewerKey` param in their POST
  body. The `getOrCreateViewerKey()` helper currently private to `app/listing/[id].tsx:25-29` should
  move to a small shared lib (e.g. `apps/mobile/src/lib/viewerKey.ts`) since both the existing
  view-tracking call site and the new login call sites need it now. Whatever screen/provider
  currently calls these login functions (e.g. `HomeSheetsProvider.tsx`'s `handleApple` and its OTP/
  Google equivalents) awaits the shared helper and passes the result through.

No change to `recordView`/`ViewTracker`/the mobile equivalent — the `anon:<uuid>` generation and
persistence mechanism stays exactly as-is; only the login path is new.

## Verification

- `pnpm -w typecheck` after the DTO/type additions.
- As an anonymous web visitor: view 2-3 listings, note `bhavano.viewerKey` in
  `localStorage`/dev tools, sign up. Query `ListingView` for `user:<newUserId>` and confirm rows for
  those listings now exist, and the old `anon:<uuid>` rows are gone.
- Repeat once viewing a listing anonymously, logging out, then viewing the *same* listing again
  while logged in as a different existing user, then having the anonymous key's owner sign up on
  the same device — confirm no unique-constraint error and no duplicate row (the upsert path).
- Confirm the admin engagement table (`ListingsService.listEngagement`) now shows the linked views
  under the new account without any change to that read path.
- Repeat the same signup flow on mobile (OTP, Google, and Apple where applicable) and confirm
  `AsyncStorage`'s `bhavano.viewerKey` rows get relinked the same way.
- Confirm a login with no stored `viewerKey` at all (very old client, storage cleared) still logs
  in successfully — this must never block or fail login, same guarantee `linkVisitToUser` already
  gives for a missing `sessionId`.

## Critical files

- `apps/bff/prisma/schema.prisma` — no changes needed (existing `ListingView` shape already
  supports this).
- `apps/bff/src/listings/listings.service.ts` — new `linkListingViewsToUser` method.
- `apps/bff/src/auth/auth.service.ts` (three call sites + options type), `apps/bff/src/auth/
  auth.controller.ts`, `apps/bff/src/auth/dto/{verify-otp,google-login,apple-login}.dto.ts` — new
  optional `viewerKey` threaded alongside the existing `sessionId`.
- `apps/web/src/lib/bff.ts` (`verifyOtp`/`loginWithGoogle`), `apps/web/src/app/actions/auth.ts`,
  `apps/web/src/auth.ts` (NextAuth provider `authorize()` callbacks) — thread `viewerKey` from the
  client-side login form through to the BFF call.
- `apps/mobile/src/lib/bffClient.ts` (`verifyOtp`/`loginWithGoogle`/`loginWithApple`), new shared
  `apps/mobile/src/lib/viewerKey.ts` (extracted from `app/listing/[id].tsx`), and whatever screen/
  provider invokes those three login calls today.
