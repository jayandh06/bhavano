# Delete-your-own-message + don't create a thread until a message is sent

## Context

Two gaps in the messaging feature:

1. **No way to delete a message you sent.** Deleting replaces the message with a "This
   message was deleted" placeholder for the other participant (not silent removal), so the
   thread's flow/timing stays intact — confirmed with the user before building.
2. **A `Conversation` row was created the instant "Contact owner" was tapped**, before any
   message existed, leaving an empty thread behind. The fix folds "start a conversation"
   into "send the first message" as one atomic step.

Neither had any existing code to build on (no soft-delete on `Message`, no "pending
conversation" concept). This was additive work across `apps/bff`, `apps/web`,
`apps/mobile`, and `packages/types`.

## Feature A — delete your own message

**Schema**: `Message.deletedAt DateTime?` (`apps/bff/prisma/schema.prisma`), migration
`20260914083058_add_message_deleted_at`.

**Redaction, not filtering.** `Message.deletedAt` does not behave like `User.deletedAt`
(filtered out of every query). The row stays visible for both sides with content masked:
`toMessageDto` (`messaging.service.ts`) nulls `body` when `deletedAt` is set, taking an
`opts.revealDeletedBody` flag that only `getMessagesAsAdmin` sets — the one place this acts
as an admin bypass so moderation keeps full text visibility. Every other read (`getMessages`,
`listConversations`'s `lastMessage`, `sendMessage`/`sendFirstMessage`'s return) redacts.

**`packages/types`**: `MessageDto.body` is now `string | null` (null once deleted),
`MessageDto.deletedAt: string | null` added, plus `MessageDeletedEvent` (the socket
tombstone payload: `{ messageId, conversationId, deletedAt }`).

**Backend**: `MessagingService.deleteMessage(messageId, userId)` — 404s if the message
doesn't exist or is already deleted, 403s if `senderId !== userId`, otherwise sets
`deletedAt` and returns the redacted DTO. A new top-level `MessagesController`
(`apps/bff/src/messaging/messages.controller.ts`, `@Controller('messages')`, separate from
`MessagingController`'s `/conversations` prefix) exposes `DELETE /messages/:id`, then
broadcasts `message_deleted` to the conversation's socket room via
`MessagingGateway.broadcastMessageDeleted` (mirrors `broadcastMessage`).

**Web** (`apps/web/src/components/home/MessageThread.tsx`): a hover-revealed delete icon on
your own, non-deleted bubbles (`group`/`group-hover`, positioned to the bubble's left);
click → `window.confirm` → `deleteMessageAction` (`apps/web/src/app/actions/messaging.ts`,
mirrors `sendMessageAction`'s pattern — no generic `BffError` class exists on web, only
`BffAuthError`, so a non-auth failure just rethrows). A `message_deleted` socket listener
patches the message to `{ body: null, deletedAt }` in place. Deleted bubbles render "This
message was deleted" instead of `MessageBody`. The inbox (`apps/web/src/app/messages/page.tsx`)
shows the same tombstone text when the last message is deleted.

> **Known gap, not yet fixed**: the delete icon is hover-only (`opacity-0
> group-hover:opacity-100`), which doesn't work on touch/mobile-browser — there's currently
> no way to delete a message from a phone's browser. Fixing this means making the icon
> always visible on your own messages rather than hover-reveal.

**Mobile** (`apps/mobile/src/components/home/ConversationThread.tsx`): long-press your own,
non-deleted bubble → native `Alert.alert` confirm → `deleteMessage`. Same
`message_deleted` socket listener and tombstone rendering as web. No existing
long-press/swipe/multiselect pattern existed in this codebase — `Alert.alert` was the
lightest fit, no new dependency.

**Inbox visibility once nothing active remains**: `listConversations`'s filter is
`messages: { some: { deletedAt: null } }`, not just `some: {}` — a conversation whose
messages have *all* been deleted has no active content left, so it drops out of both
participants' `/messages` list the same as one that never had a message. The
`Conversation`/`Message` rows themselves are untouched (soft-delete stays soft — admin
moderation still sees everything via `getMessagesAsAdmin`'s bypass), and
`sendFirstMessage`'s upsert still finds and reuses the same row if either side messages
again, so nothing is lost or duplicated by re-contacting. Both unread-count queries
(`listConversations`'s per-conversation count and `getUnreadTotal`) also exclude
`deletedAt` rows, so a message deleted before being read can't leave a phantom badge count
pointing at a conversation that's no longer even listed.

## Feature B — don't create a Conversation until a message is sent

**Backend**: `MessagingService.sendFirstMessage(listingId, senderId, body)` replaces
`createOrGetConversation` — a `$transaction` that upserts the `Conversation`
(`@@unique([listingId, inquirerId, type])`, buyer-only by construction via the
`ownerId === senderId` guard) and creates the `Message` atomically, so a buyer tapping
"Contact owner" can never leave an empty thread behind. Exposed as
`POST /conversations/messages` (`messaging.controller.ts`) — a static one-segment path,
no collision with `POST /conversations/:id/messages` (replies on an existing conversation,
unchanged). `POST /conversations` (the old immediate-create route) and
`create-conversation.dto.ts` are removed.

**Web**: "Contact owner" (`ListingDetailActions.tsx`, `ListingCard.tsx`) makes no API call
at tap time — just `hasSessionAction()` (existing helper, already used by
`AuthGateProvider` to detect a completed popup login) to decide whether to show the login
gate, then navigates straight to `/messages/new/[listingId]`
(`apps/web/src/app/messages/new/[listingId]/page.tsx`, same shell as `/messages/[id]`
but sourcing the listing bar from the public `fetchListingMeta` instead of
`fetchConversation`, no message history to fetch). `MessageThread` takes a nullable
`conversationId`: null skips the socket join/history entirely; `onSend()` in that state
calls `sendFirstMessageAction(listingId, body)` and `router.replace`s to the real thread's
canonical URL once it exists.

**Mobile**: same shape — "Contact owner" (`app/listing/[id].tsx`, `ListingCard.tsx`) makes
no API call, just the existing `requireLogin` gate, then `router.push('/messages/new/' + id)`.
The thread UI was extracted from `(tabs)/messages/[id].tsx` into a shared
`ConversationThread` component (`apps/mobile/src/components/home/ConversationThread.tsx`),
parameterized the same way as web's `MessageThread` (nullable `conversationId` +
`listingId`), used by both `(tabs)/messages/[id].tsx` (thinned to a data-loading wrapper)
and the new `(tabs)/messages/new/[listingId].tsx`.

## Out of scope / known follow-ups

- Cleaning up legacy zero-message `Conversation` rows already in production from before
  this change — the inbox filter hides them going forward; no cleanup script was built.
- No time limit on deleting a message — available indefinitely.
- **Mobile-browser delete affordance** (see Feature A's callout above) — the web delete
  icon needs to stop being hover-only before it works on a phone browser.

## Critical files

- `apps/bff/prisma/schema.prisma`, migration `20260914083058_add_message_deleted_at`
- `apps/bff/src/messaging/messaging.service.ts`, `messaging.controller.ts`,
  `messages.controller.ts`, `messaging.gateway.ts`, `messaging.module.ts`,
  `dto/send-first-message.dto.ts`
- `packages/types/src/index.ts`
- `apps/web/src/lib/bff.ts`, `app/actions/messaging.ts`,
  `components/home/MessageThread.tsx`, `ListingDetailActions.tsx`, `ListingCard.tsx`,
  `app/messages/new/[listingId]/page.tsx`, `app/messages/page.tsx`
- `apps/mobile/src/lib/bffClient.ts`, `src/components/home/ConversationThread.tsx`,
  `app/(tabs)/messages/[id].tsx`, `app/(tabs)/messages/new/[listingId].tsx`,
  `app/listing/[id].tsx`, `src/components/home/ListingCard.tsx`
