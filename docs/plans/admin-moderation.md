# Admin moderation: admin.bhavano.com, posting review, soft-delete, admin↔user messaging, notifications

## Context

Right now there is no concept of an admin or staff user anywhere in the system (confirmed: no `role` field, no admin guard, no bootstrapping). Listing "moderation" today is a fully automated, pre-publish gate (`ModerationService.moderate()` — banned-word/price-sanity/duplicate-photo checks) with no human-in-the-loop and no persisted review state. Owners can already edit their own listings and self-set status (active/sold/rented/deactivated), but there's no way for staff to flag a bad posting, take it offline, tell the owner what's wrong, and re-approve it once fixed. This plan adds that whole loop, a locked-down `admin.bhavano.com` app to drive it, and email/SMS notifications for when it happens.

This is a large, multi-part feature. It's phased below so it can be built and verified incrementally rather than as one giant change.

**Decisions made while planning (flagging since they weren't explicit in the request):**
- **Admin app = new sibling `apps/admin` Next.js app** (not a route inside `apps/web`), per your answer — matches the existing per-app monorepo convention and keeps admin auth/session fully isolated.
- **Admin bootstrapping**: no admin signup flow exists or is being built. An `ADMIN_PHONES`/`ADMIN_EMAILS` env-var allowlist is checked at login time (both OTP and Google) — matching phone/email gets `role=admin` upserted automatically. This avoids needing a manual DB edit or a separate invite system to create the first admin.
- **"Soft delete" = "flag"**: reading the request closely, "soft delete the posting" and "message user about discrepancy" are the same admin action, not two separate features — flagging takes the listing offline (soft-delete) *and* is how the discrepancy gets communicated. One admin action does both.
- **Admin↔user messaging reuses the existing Conversation/Message system** (same `/messages` inbox the user already has for buyer/seller chat) rather than a separate admin inbox — this directly satisfies "messages is one to one between users or user and admin." Requires a small schema change (see below) so a moderation thread can't collide with a real buyer inquiry.
- **Email + SMS notifications are net-new infrastructure** — zero email-sending capability exists anywhere in the repo today, and the only SMS integration (MSG91) is hardwired to OTP delivery, not free-form transactional messages. This is flagged clearly in Phase 4 below since it needs an external account (Resend, or SES since deployment is already on AWS) and, for SMS in India, DLT template registration — neither of which I can provision myself.

---

## Data model changes (`apps/bff/prisma/schema.prisma`)

- **`User`**: add `role UserRole @default(user)` where `enum UserRole { user admin }`.
- **`Listing`**: add
  - `moderationState ModerationState @default(approved)` where `enum ModerationState { approved flagged }` — `flagged` = soft-deleted/hidden from public browse & search, regardless of `status`.
  - `adminReviewed Boolean @default(false)` — the literal "admin reviewed" marker per posting, used as the admin queue's completion tracker. Reset to `false` automatically whenever the *owner* edits a `flagged` listing (signals "resubmitted, please look again"); set to `true` whenever an admin flags or approves.
  - `moderatedAt DateTime?` — last time an admin acted on this listing (basic audit; who-said-what is already captured by the moderation conversation's messages, so no separate `moderatedBy`/`moderationReason` column is needed).
- **`Conversation`**: add `type ConversationType @default(inquiry)` where `enum ConversationType { inquiry moderation }`. Change `@@unique([listingId, inquirerId])` → `@@unique([listingId, inquirerId, type])` so a moderation thread (admin as `inquirerId`, listing owner as `posterId`) can't collide with a genuine buyer-inquiry thread on the same listing, and reopening after an edit still resolves to the same thread (listing id never changes on edit — confirmed in `ListingsService.update()`).

Migration is additive with sane defaults (`user`, `approved`, `false`, `inquiry`) — no backfill/truncate needed, unlike some earlier required-column additions in this project's history.

`packages/types/src/index.ts`: mirror `UserRole`, `ModerationState`, add `moderationState`/`adminReviewed`/`moderatedAt` to `ListingDetailDto`, add `type: ConversationType` to `ConversationSummaryDto`.

---

## Phase 1 — Admin role, guard, and moderation data model (BFF only, no UI)

1. Schema migration above; regenerate Prisma client.
2. `AuthService`: in both `verifyOtp()` and `loginWithGoogle()`, after upserting the user, check the verified phone/email against `ADMIN_PHONES`/`ADMIN_EMAILS` (comma-separated env vars, parsed once) and upsert `role: 'admin'` if it matches and isn't already set. `issueSession()`'s JWT gains a `role` claim (`jwt.sign({ sub: user.id, role: user.role }, ...)`) so downstream guards don't need a DB hit per request within the existing 1h token TTL.
3. `RequestUser` interface (`auth.guard.ts`) gains `role: 'user' | 'admin'`; `extractUser()` reads it off the verified JWT payload.
4. New `AdminGuard` (`apps/bff/src/auth/guards/admin.guard.ts`): extends the same JWT verification as `AuthGuard` but additionally throws `ForbiddenException` if `role !== 'admin'`.
5. `ListingsService`:
   - `list()` (public browse): add `moderationState: 'approved'` to the existing `where` alongside `status: 'active'`/`expiresAt`.
   - `findOne()`/`getMine()`: unchanged (owner/direct-id access still sees a flagged listing — they need to, to fix it).
   - `update()` (existing owner-only PATCH): if the listing being edited has `moderationState === 'flagged'`, reset `adminReviewed: false` as part of the same update (signals resubmission). No new owner-facing "Resubmit" button needed — any edit to a flagged listing IS the resubmission.
6. New `apps/bff/src/admin/` module (`AdminModule`, `AdminController`, `AdminService`), all routes under `@Controller('admin')` `@UseGuards(AdminGuard)`:
   - `GET /admin/listings` — all listings regardless of status/moderationState, filterable by `moderationState`/`adminReviewed`/`cityId`/`category`, paginated (same cursor pattern as the public `list()`).
   - `PATCH /admin/listings/:id/review` — toggles `adminReviewed` only (quick "mark as looked at" without a moderation action).
   - `POST /admin/listings/:id/flag` — body `{ message: string }`. Sets `moderationState: 'flagged'`, `adminReviewed: true`, `moderatedAt: now`; in the same transaction, gets-or-creates the moderation `Conversation` for `(listingId, adminId, type: 'moderation')` and creates the `Message` with the admin's text. This is the combined soft-delete + notify-owner action.
   - `POST /admin/listings/:id/approve` — sets `moderationState: 'approved'`, `adminReviewed: true`, `moderatedAt: now`; posts an auto-message ("Your listing has been reviewed and is live again.") into the same moderation thread if one exists.
7. `MessagingService`: add `getOrCreateModerationThread(listingId, adminId)` (mirrors `createOrGetConversation` but keys on `type: 'moderation'` and doesn't block on `ownerId === inquirerId`, since here `inquirerId` is the admin, not the owner). `listConversations()`'s query and `ConversationSummaryDto` mapping pass through `type` so the web inbox can badge admin threads.

**Verification (Phase 1):** With a seeded/manual admin user (set `role=admin` directly via Prisma Studio for local dev, or log in with a phone/email matching `ADMIN_PHONES`/`ADMIN_EMAILS`) — `GET /admin/listings` works with the admin's token and 403s with a normal user's token; `POST /admin/listings/:id/flag` hides the listing from `GET /listings` (public) but it still appears via `GET /users/me/listings/:id` for the owner, and a message shows up in `GET /conversations` for both the owner and the admin; owner edits the flagged listing via the existing `PATCH /listings/:id` and `adminReviewed` flips back to `false`; `POST /admin/listings/:id/approve` makes it reappear in public `GET /listings`.

---

## Phase 2 — Admin web UI (`apps/admin`, new Next.js app)

New sibling app mirroring `apps/web`'s structure (Server Components/Actions calling the BFF directly, same `lib/bff.ts`-style thin fetch wrapper — largely copy the auth/session plumbing from `apps/web/src/auth.ts` since the BFF's login endpoints are shared).

- **Auth**: same NextAuth phone-OTP/Google config as `apps/web`, but after establishing a session, if `role !== 'admin'` immediately sign the user back out and show "Not authorized for admin access" — never render any admin page for a non-admin session.
- **`/` (dashboard)**: queue of listings, default-filtered to `adminReviewed: false` (what needs attention), with tabs/filters for flagged/all.
- **`/listings/[id]`**: full listing detail (reuse the same field rendering logic as `apps/web`'s detail page, duplicated rather than shared — this is a small, focused admin view and a shared `packages/ui` package isn't justified yet for one screen), an "Admin reviewed" toggle, "Flag & message" (opens a textarea for the discrepancy message), "Approve" button, and the moderation conversation thread rendered inline (reusing the same message-list/send-message pattern as `apps/web/src/app/messages/[id]/page.tsx`, duplicated for the same reason as above).
- No listing creation/deletion UI beyond flag/approve — admins moderate, they don't post on behalf of users.

**Verification (Phase 2):** log in to the admin app with an allowlisted phone/email, confirm a non-admin session gets bounced; flag a listing with a message from the dashboard and confirm it's now hidden on the public site and the message appears in the owner's `/messages` on `apps/web`; edit the listing as the owner and confirm it reappears in the admin queue as needing re-review; approve it and confirm it's public again.

---

## Phase 3 — Deployment (`admin.bhavano.com`)

- `Caddyfile`: new block `{$ADMIN_DOMAIN} { reverse_proxy admin:PORT }`, alongside the existing `SITE_DOMAIN`/`API_DOMAIN`/`APEX_DOMAIN` blocks.
- `docker-compose.prod.yml`: new `admin` service (mirrors the `web` service block — same `output: "standalone"` pattern, own Dockerfile at `apps/admin/Dockerfile` copying `apps/web/Dockerfile`'s turbo-prune → install → build → standalone-runner structure), and add `ADMIN_DOMAIN` to the `caddy` service's `environment`.
- `.env.production.example` / `apps/bff/.env.example`: add `ADMIN_DOMAIN=admin.bhavano.example.com` and the new `ADMIN_PHONES`/`ADMIN_EMAILS` allowlist vars, following the existing `{ROLE}_DOMAIN` / comma-list-of-secrets naming conventions.
- `docs/deployment.md`: add the new DNS A record step (same "DNS only, not proxied" Cloudflare gotcha called out for the other three domains).

**Verification (Phase 3):** `docker compose -f docker-compose.prod.yml build admin` succeeds locally; after DNS + deploy, `https://admin.bhavano.com` serves the admin app and gets its own Caddy-issued TLS cert automatically, same as the other two domains did.

---

## Phase 4 — Email + SMS notifications on flag/approve

This is genuinely new infrastructure, not a wire-up of something existing — flagged clearly so expectations are set correctly.

- **Email**: add a provider (recommend **Resend** for simplicity — a real AWS SES setup is also reasonable since deployment is already on AWS/EC2, either works, easy to swap later). New `apps/bff/src/notifications/email.provider.ts`, `RESEND_API_KEY` env var (or SES access key/secret/region), `apps/bff/package.json` gains the real dependency.
- **SMS**: `Msg91Provider` gains a `sendTransactionalSms(phone, body)` method hitting MSG91's flow/transactional API (distinct endpoint from the existing OTP-only `sendOtp`). **Real-world caveat that no amount of code solves**: arbitrary message bodies require a DLT-registered template in India — this needs to be requested through MSG91's dashboard before production SMS notifications will actually deliver; local/dev can log instead of send.
- New `NotificationsService` (`apps/bff/src/notifications/notifications.service.ts`): `notifyListingFlagged(user, listing, message)` and `notifyListingApproved(user, listing)` — sends email if `user.email` is set, SMS if `user.phone` is set, plain-text templates (matching the project's current lack of any templating engine). Called from `AdminService.flag()`/`approve()` right after the DB writes.
- New env vars follow the existing convention: a `# Notifications` block in `.env.example`/`.env.production.example`.

**Verification (Phase 4):** with a real (or sandbox) Resend/SES key configured, flagging a listing sends an actual email to the owner; without a key configured, it logs a clear "not configured" warning rather than crashing the flag action (same graceful-degradation pattern already used by `Msg91Provider` when `MSG91_AUTH_KEY` is missing).

---

## Full-stack verification (after all phases)

1. `pnpm typecheck` across the monorepo (now 5 packages including `apps/admin`).
2. End-to-end walkthrough: admin logs in at `admin.bhavano.com` → flags a listing with a message → owner sees it vanish from the public site and gets an email/SMS + a message in `/messages` on the main site → owner edits the listing → admin queue shows it needing re-review → admin approves → listing is public again and owner gets a second notification.
3. Confirm a non-admin can never reach an `/admin/*` BFF route (403) or the admin app (bounced at login).
