# Admin: trigger welcome email/WhatsApp for one or many users

## Context

The Users list page (`apps/admin/src/app/users/page.tsx`) shows a "Not welcomed" status derived
from `UserNotificationLog`, but there was no way to act on it — an admin who spots a gap (like the
34 phone-login users an earlier backfill found) had no in-product way to (re)send the welcome
message; it required a one-off script run from the terminal. This adds that as a real admin
action: select one or more users on the Users page and fire off a welcome email or welcome
WhatsApp to them, on demand.

**This is a deliberate, unconditional resend** — no gate on `welcomedAt` or an existing
`UserNotificationLog` row. The admin is choosing to (re)send, same trust-the-admin posture as
`setListingStatus`'s manual override elsewhere in the admin service.

## Reusing what already existed

`NotificationsService.notifyWelcome` (auto-picks email else Meta WhatsApp) and
`notifyMobileWelcome` (MSG91 WhatsApp only) already existed, but neither let a caller *force* a
specific channel — which is what "welcome email" vs "welcome WhatsApp" as two distinct admin
actions needs. Two new explicit-channel methods were added instead of reusing these as-is:

- `sendWelcomeEmail(user)` — the email-building logic factored out of `notifyWelcome` into a new
  private `buildWelcomeEmailContent(name)` helper, shared by both.
- `sendWelcomeWhatsapp(user)` — identical body to the old `notifyMobileWelcome` (MSG91's
  `sendWhatsappTemplate`, the one channel proven to actually deliver — see
  `docs/plans/whatsapp-welcome-mobile-signups.md`); `notifyMobileWelcome` is now a one-line wrapper
  around it, so the mobile-signup path is unaffected.

## 1. `NotificationsService` (`apps/bff/src/notifications/notifications.service.ts`)

- New private `buildWelcomeEmailContent(name)` — the subject/text/html-building block that used to
  be inlined in `notifyWelcome`.
- New `sendWelcomeEmail(user: { name, email })` — forces the email channel via `EmailProvider`
  directly, bypassing `dispatchEmailPreferWhatsapp`'s auto-selection.
- New `sendWelcomeWhatsapp(user: { name, phone })` — forces MSG91's WhatsApp template.
- `notifyMobileWelcome` now delegates to `sendWelcomeWhatsapp`.

## 2. `packages/types/src/index.ts` — new types

`WelcomeChannel` (`'email' | 'whatsapp'`), `SendWelcomeInput { userIds, channel }`,
`SendWelcomeResultDto { userId, success, error? }`, `SendWelcomeResponseDto { sent, failed,
results }`.

## 3. `apps/bff/src/admin/dto/send-welcome.dto.ts` (new)

`SendWelcomeDto { userIds: string[] (1-200, IsArray/IsString each), channel: WelcomeChannel
(IsIn) }`.

## 4. `AdminService.sendWelcome()` (`apps/bff/src/admin/admin.service.ts`)

Looks up all requested users in one query, then iterates **sequentially** (not `Promise.all` — a
bulk send hits an external API per user and shouldn't fire concurrently): skips/reports a per-user
error for a not-found user or one missing the target channel's contact field ("No email on file" /
"No phone on file"), otherwise calls the matching `NotificationsService` method and, on success,
writes a `UserNotificationLog` row (`kind: 'welcome', channel`) — the exact same bookkeeping the
earlier backfill script did by hand. Returns `{ sent, failed, results }`.

## 5. `AdminController` — `POST admin/users/welcome`

Guarded by the same `AdminGuard` as every other admin route.

## 6-7. Admin app plumbing

`apps/admin/src/lib/bff.ts`'s `sendWelcome()`, and `apps/admin/src/app/actions/users.ts`'s new
`sendWelcomeAction()` (`"use server"`, `requireAdmin()`, calls `sendWelcome`, `revalidatePath
("/users")` on success) — same shape as every other action in that file (`revokeBoostAction`,
`searchUsersAction`).

## 8. Admin UI — new `apps/admin/src/components/UsersTable.tsx`

The Users page's table moved from `page.tsx` (a server component) into this `"use client"`
component so it can hold row-selection state:

- A checkbox column (header checkbox selects/clears the current page).
- A toolbar, shown once ≥1 row is selected: "`N` selected" plus **Send welcome email** / **Send
  welcome WhatsApp** buttons, calling `sendWelcomeAction(selectedIds, channel)`.
- After the action resolves: an inline result summary (e.g. "12 sent, 1 failed — Jane Doe: No
  email on file"), selection cleared, `router.refresh()` to pick up the updated Notification
  status column (revalidated server-side by the action).
- One mechanism covers both "single" and "multiple" users — selecting exactly one row is the
  single-user case, no separate per-row buttons needed.

`page.tsx` itself only changed by replacing the inline `<table>` with `<UsersTable
users={page.items} />` and dropping the now-unused `dash`/`thStyle`/`tdStyle` constants that moved
into the new component.

## Verification (done)

1. `pnpm --filter @bhavano/types build`, `pnpm --filter bff typecheck`/`build`,
   `pnpm --filter admin typecheck`/`build` — all pass; `next build`'s route list still includes
   `/users`.
2. Ran the bff dev server locally and confirmed `POST /admin/users/welcome` is registered
   (`Mapped {/admin/users/welcome, POST} route`) and rejects an unauthenticated request with 401
   (`AdminGuard` is wired).
3. Did not fire a live test send from this session — MSG91 is fully configured in the local `.env`
   (real credentials), so an unprompted local test would have sent a real WhatsApp message; SMTP
   isn't configured locally, so the email path would only exercise the "unconfigured, log and
   no-op" branch anyway. The underlying `sendWhatsappTemplate`/`EmailProvider.send` calls are the
   exact same, already-proven-working code paths the mobile-welcome feature and its backfill
   script used this session — a real end-to-end send should be tested from the admin UI directly
   (`/users` → select a user → Send welcome email/WhatsApp) whenever convenient, rather than
   automated here.
