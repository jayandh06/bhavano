# Mobile UGC reporting and blocking (Apple Guideline 1.2 / 2.1)

**Update (2026-10-04):** extended to web for parity — see "Web parity" below. The title/doc stays
named for the mobile/Apple motivation since that is why this exists at all, but the backend and
UI are now cross-platform.

## Why

Apple's App Review rejected the first iOS submission under **Guideline 2.1 — Information
Needed**, explicitly asking about "any user-generated content, including the required content
reporting and blocking mechanisms." The app has two UGC surfaces — listing content and messages
between users — and, until this change, **neither had an in-app report action, and there was no
block feature at all**. The only existing path was emailing support after the fact; see
`docs/plans/ios-app-store-release.md`'s own note on this submission.

## What already existed, and what didn't

- **Reporting a listing** already had backend support: `SupportTicket` (topic `listing_report`)
  via `POST /support/tickets`, built for the website's Contact Us form — see
  `docs/plans/contact-us-support-form.md`. Mobile never called it; its own Contact screen just
  opens the website or a `mailto:` link (see that file's own comment).
- **Reporting a user/message in a conversation** had no topic and no UI anywhere.
- **Blocking another user** did not exist at all — no model, no endpoint, no enforcement.

## Design decisions

**Reporting reuses the existing support-ticket pipeline, not a new system.** `SupportTicket` is
already generic (every topic is free-text + optional `listingUrl`/`paymentId`, no per-topic
structured target column), so a conversation/user report just needed a new topic —
`user_report` — with the conversation/other-party context folded into the free-text `message`
rather than inventing a dedicated schema. Mobile now calls `POST /support/tickets` directly
(multipart, matching the endpoint's `FilesInterceptor`) for the first time; no attachments from
this path, just the text fields.

**Blocking is new, scoped to a user pair, not a conversation.** `BlockedUser` (`blockerId`,
`blockedId`, unique pair) — blocking someone stops them messaging you about *any* listing, not
just the one you blocked them from. Enforced in both `MessagingService.sendFirstMessage` and
`sendMessage`, checked in both directions (either party may have blocked the other) before a
message can be created. `ConversationDetailDto.blocked` is a single boolean, never which
direction — a blocked sender can't tell "they blocked me" apart from "I blocked them" from the
API alone, matching the existing minimal-exposure pattern `otherPartyName` already uses instead
of raw ids. `POST/DELETE /conversations/:id/block` resolves "the other participant" server-side
from the conversation and the caller's own id — the client never has to know or pass the other
party's raw user id.

**Mobile-first, not mobile-only.** Apple reviews the iOS app specifically, so that UI came first;
the backend enforcement already protected both platforms the moment it existed (a
mobile-initiated block stops messages sent via web too, since it's the same
`Message`/`Conversation` tables). Web's own UI followed the same day — see "Web parity" below.

## What shipped

- **Schema**: `ContactTopic.user_report` added; new `BlockedUser` model with named relations
  `BlockerOf`/`BlockedBy` on `User`. Migration
  `20261004090000_blocked_users_and_user_report_topic`.
- **BFF**: `MessagingService.blockOtherParticipant`/`unblockOtherParticipant`,
  `isBlockedEitherWay` (also used by `getConversation` to compute `blocked`), enforcement in
  `sendFirstMessage`/`sendMessage`. `MessagingController` gains `POST`/`DELETE
  /conversations/:id/block`.
- **Shared types**: `user_report` in `CONTACT_TOPICS`/`CONTACT_TOPIC_LABELS`;
  `ConversationDetailDto.blocked`.
- **Mobile**: `submitSupportTicket`/`blockConversationUser`/`unblockConversationUser` in
  `bffClient.ts`; `ReportSheet.tsx` (a bottom sheet with a free-text message box, reused for both
  topics); a flag icon on the listing detail screen's header opens it with `listing_report`; a
  "⋮" menu on the conversation screen offers Report (`user_report`) and Block/Unblock, and the
  composer is replaced by a fixed banner while `blocked` is true.

## Web parity (2026-10-04)

No backend work needed — `user_report`, `BlockedUser`, and the block/unblock endpoints already
existed for mobile. Web was missing only the UI:

- **`ReportDialog.tsx`**: a hand-rolled modal (matching `BoostRecoveryDialog.tsx`'s overlay
  pattern — there is no shared Modal component in this app) wrapping the same fields
  `ContactForm.tsx` already has (name/email/phone/message), submitting via the existing
  `submitSupportTicketAction`. Unlike mobile's `ReportSheet`, **not login-gated** — this is the
  same public, unauthenticated `/support/tickets` endpoint the general Contact Us form already
  uses, so a logged-out visitor reporting a listing works exactly like it already does there.
- **`ListingReportButton.tsx`**: a small client wrapper owning the dialog's open/close state, so
  the (async, Server Component) `ListingDetailView.tsx` doesn't need client state of its own —
  a plain "Report" text link next to the area/city line, hidden for the listing's own owner.
- **`MessageThread.tsx`**: a new header row above the message list ("Report" / "Block"/"Unblock"
  text buttons) and a disabled-composer banner when `blocked` — `ConversationDetailDto.blocked`
  was already returned by `fetchConversation()` but previously discarded by `page.tsx`.
  `blockConversationUser`/`unblockConversationUser` added to `apps/web/src/lib/bff.ts` and a
  `"use server"` action in `app/actions/messaging.ts`, mirroring `sendMessageAction`'s shape.
  `sendMessageAction`'s result type gained an `error?: string` field — reachable now that a
  blocked reply 403s, which previously had no surfaced-error path to reuse.
- Full web type-check clean. Not yet verified: an actual browser walkthrough (open the dialog,
  submit a report, block/unblock from a real conversation) — same caveat as mobile's own
  verification note below.

## Verification

- `MessagingService` unit tests: block/unblock resolve the right "other participant" from either
  side of a conversation without the caller naming an id; `sendMessage`/`sendFirstMessage` both
  refuse when a block exists in either direction and otherwise behave exactly as before;
  `getConversation` reports `blocked` correctly in both states.
- Full BFF, mobile, and web type-checks and test suites clean (770/47 tests respectively, plus
  web's unaffected type-check).
- Not yet verified: an actual on-device walkthrough (report a listing, report a message, block a
  user and confirm the other side can no longer message, unblock and confirm they can again) —
  needed before this ships in the next iOS screen recording for App Review.

## Out of scope / follow-ups

- An admin-facing view of `user_report` tickets beyond the existing email-to-support pipeline —
  same as every other support topic (see `contact-us-support-form.md`'s own "Out of scope").
- Blocking does not retroactively hide message history already exchanged, only prevents new
  messages — same as how most chat apps treat a block.
