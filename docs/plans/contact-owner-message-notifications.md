# Telling an owner someone contacted them

## The gap

`MessagingService.sendMessage` does exactly two things: writes the `Message` row, and emits it
over the socket to whoever is currently in that conversation's room.

```ts
async sendMessage(conversationId: string, senderId: string, body: string): Promise<MessageDto> {
  await this.assertParticipant(conversationId, senderId);
  const message = await this.prisma.message.create({ data: { conversationId, senderId, body } });
  return toMessageDto(message);
}
```

If the recipient isn't looking at the site with an open socket connection at that exact moment,
they get **nothing** — no email, no WhatsApp, no badge that fires later. They find out only if
they happen to open Messages themselves.

Everything else that happens on a listing already has this covered:

| Trigger | Channels today |
|---|---|
| First login (welcome) | email, else WhatsApp |
| Listing flagged by an admin | email + SMS |
| Listing approved by an admin | email + SMS |
| Someone favourites your boosted ad | email + SMS |
| Saved-search match | email + SMS |
| **Someone messages you about your ad** | **nothing** |

## Why now

"Contact owner" just got easier to reach and bolder to look at — this session moved it from a
dead `requireLogin()` stub to an actual working action, gave it its own breadcrumb back from the
thread, and just now made the button itself the obvious thing on the page. All of that raises how
often a buyer actually sends a message. None of it matters if the seller never learns one arrived.

## Channel: email, else WhatsApp

Same rule already established for the (unshipped) post-ad-acknowledgement plan, kept for the same
reason — one message, never two, and it maps directly to your "based on what they provided to
login" framing:

```
user has an email  ->  email
otherwise          ->  WhatsApp
```

**This is the phone channel, not a phone call.** There is no voice-calling infrastructure in this
app — no Twilio Voice, no click-to-call, nothing that dials a number. "Call" in the request is
being read as *the channel tied to a phone number*, which today means WhatsApp. If an actual voice
call was meant — Bhavano ringing the seller, or a masked-number bridge between buyer and seller —
that is a materially bigger feature (telephony provider, call routing, recording/consent rules)
and would need its own plan. Worth confirming before this ships.

`email` is safe to gate on directly, without a separate verified check: `UsersService.updateProfile`
no longer accepts a raw email at all — "an address now reaches the profile solely through the
verified flow" (see its own comment). So `email` non-null already implies `emailVerifiedAt`
non-null for every account created or edited today; there's no unverified-address case to guard
against.

## What it says

- Who's asking — the sender's name (or phone, if they have no name — same fallback
  `listConversations` already uses).
- Which ad — the listing's title, since a seller may have several live.
- Enough of the message to be worth opening, not the whole thing — a preview.
- A link straight to `/messages/<id>` (email) or a WhatsApp template variable carrying that URL.

## The one real design decision: when to fire it

Every `sendMessage` call notifying unconditionally would mean an email or WhatsApp message for
every line of a live back-and-forth — the seller replies, gets pinged for their own reply's echo
in a busy thread, and the "an ad got a message" alert turns into noise they mute.

**Proposed default:** notify only when the recipient's unread count *for that conversation* was
zero immediately before this message — i.e., this is the message that puts them back into an
unread state, not the second or fifth one piling on top. That's one query against `Message` (same
shape `listConversations` already runs for its `unreadCount`), no schema change, and it naturally
throttles itself: a seller mid-conversation with the socket open won't get emailed for a message
they're already watching arrive, because `markRead` will have zeroed the count before the next one
lands. One who's away gets exactly one nudge, not one per message, until they come back and read.

The plainer alternative — notify on literally every message — needs no unread-tracking logic at
all, at the cost of being the spammy version above. Worth you picking rather than me guessing:
this is a judgement call about how much noise is acceptable, not a technical one.

## What WhatsApp needs before this can ship

Unchanged from the post-ad plan, because it's the same untested provider:

1. A registered WhatsApp Business sender + an **approved utility-category template** (Meta's
   approval, takes days) with the small number of variables this message needs (sender name,
   listing title, link).
2. `sendWhatsapp`/`WhatsappProvider.send` has never sent a real message — the endpoint was written
   against Meta's docs and never exercised. Send one for real before trusting it here.
3. Per-conversation WhatsApp billing, on top of whatever SMS allowance already exists.

**Until then, a phone-only buyer messaging a phone-only seller produces total silence on both this
feature and the unshipped post-ad one.** Most posters are phone-only. This is the same trade
already accepted there, restated because it compounds: two silent notification paths sharing one
missing prerequisite.

## Where it hooks in

`MessagingService.sendMessage`, after the `Message` is created: look up the *other* participant
(poster or inquirer, whichever didn't send), and call a new `NotificationsService.notifyNewMessage`
— same shape as `notifyListingLiked`, which already fires from an interaction rather than a status
change.

## One unrelated thing noticed while reading this code

`MessagingGateway.onJoinConversation` lets any authenticated socket join **any** conversation's
room by id — it checks that the JWT is valid, never that the joining user is a participant of that
specific conversation. A conversation id is a cuid, not guessable, so this isn't an open door today
— but it means anyone who obtained one id (e.g. one they were a legitimate participant of a moment
ago, or leaked in a referrer) could keep listening to that thread's live messages after being
removed, or fish for ids. Not part of this plan — flagging it because building on top of "who's in
this room" for anything trust-sensitive later would inherit the gap. Worth its own fix regardless
of whether this notification feature goes ahead.
