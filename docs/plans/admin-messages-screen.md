# Admin Messages screen: who messaged whom

Status: built 2026-10-22 (admin + BFF); not yet deployed. Before this, conversations could only be seen one listing at a time,
inside a listing's own Messages box (`/listings/[id]`).

## What it is
Admin → Moderation → **Messages** (`/messages`): every conversation on the platform, newest started first.
- **Columns:** started, From (buyer), To (owner), Listing (link, with area and city), last message with its time, number of
  messages. A green dot on the buyer means the owner has not read the buyer's latest message.
- **Click a row** to read the whole thread (fetched on demand and cached). Reading never marks anything read, so it never
  counts as the owner replying.
- **Click a name** to see everything that person sent or received (same type and dates).
- **Filters:** started date range (IST; default last 7 days; empty from/to = all time), type (buyer enquiries by default;
  everything incl. staff threads; staff moderation; staff announcements), a person (either party), text search over either
  party's name, phone, email and the listing title, a listing id. Numbered pagination and page size like the other screens.
- **Links in:** the **Enquiries** count on Users opens that person's messages (all time, all types); a listing's Messages box
  has "Open in Messages".

## Implementation
- BFF: `GET /admin/conversations` (`MessagingService.listConversationsAsAdmin`, filters in `list-admin-conversations.dto.ts`) and
  `GET /admin/conversations/:id/messages` (any conversation type; the older per-listing route is unchanged). Both are admin-only.
- Shared types: `AdminConversationRowDto`, `AdminConversationRowsPage`.
- Admin: `app/messages/page.tsx`, `components/MessagesTable.tsx`, `fetchAdminConversations` / `fetchAnyConversationMessages`.
- Tests: four cases in `messaging.service.spec.ts` (default type, staff threads, filters, no messages). Admin typechecks and
  builds; the page has not been clicked through against real data.

## Not included
- No "unread by owner" filter (it needs the last message's sender per conversation, a raw query); the dot shows it per row.
- Sorted by when the conversation started, not by latest activity (the last message time is shown).
- Privacy: this shows private messages between users. Admins could already read any listing's threads; this makes it searchable
  across all of them, so keep admin access tight and make sure the privacy policy still describes staff access accurately.

## Fix 2026-10-22: From and To follow who wrote first
The first version printed "From (buyer)" and "To (owner)" from the conversation's two roles: the person who *opened* the
conversation (`inquirerId`) and the listing's owner (`posterId`). That is not always who wrote. Production example: a chat
about a BTM Layout listing was opened by the admin account (Jayandhan) but its only message, "Hello - pls let me know", was
written by the listing's owner (Chandra), so the row showed Jayandhan -> Chandra when the message went Chandra -> Jayandhan.
Staff threads looked right only because the admin opens and writes them.

Now: the BFF also returns `firstSenderId` (who wrote the first message; null if nobody has), and the screen shows **From** =
that person and **To** = the other, each tagged buyer, owner or staff. The Last message cell names its sender. The green dot
moved to the **To** side and now means "the person it was sent to has not read the latest message" (`lastMessageUnread`,
replacing `unreadByOwner` on this screen only; the per-listing Messages box is unchanged). A conversation nobody has written in
yet falls back to opener -> owner.

## On the user page (2026-11-01)
`/users/[id]` now has a **Messages (N)** section between Purchases and Visit history, so one page shows listings, activity, purchases, messages and visits.
It reuses the Messages screen: `fetchAdminConversations` with that user, type `any` (buyer enquiries plus staff moderation and announcement threads) and
no date range (all time), newest started first, 25 shown; the same `MessagesTable`, so a row opens the whole thread and a name opens that person's messages.
"See all N in Messages" links to `/messages?userId=…&type=any&from=&to=` when there are more than 25. No backend change. Reading a thread never marks it read.
Privacy note above applies: this puts private messages on the user page, visible to admins only.

## Fix 2026-11-01: empty "messages" from staff to advertisers
The user page's Messages section showed a staff moderation thread with no messages ("—" in Msgs and Last message) from the admin to an advertiser, and the
Messages screen listed many like it. Nothing had been sent to the advertiser. Opening any listing in admin calls `getOrCreateModerationThread`
(`AdminService.getThread`) so the listing's Messages box can send, and that creates the thread row. The customer inbox already hides these
(`messages: { some: { deletedAt: null } }`); the admin Messages screen did not. Now `listConversationsAsAdmin` leaves out a moderation thread that has no message
(`NOT: { type: 'moderation', messages: { none: {} } }`), in the rows and in the total. Empty buyer enquiries still show, since a lazily created
enquiry has a message and only old rows from before that change can be empty. Existing empty rows stay in the database, harmless.

## Stop creating the empty threads (2026-11-01)
The hide filter above only hid them; every admin opening of a listing still created one. Now `GET /admin/listings/:id/thread` is a lookup (`MessagingService.findModerationThread`)
and returns `id: null` until a message has been sent. The listing page shows no messages in that case instead of creating a thread to read from. A new
`POST /admin/listings/:id/thread` (`AdminService.createThread`, the old get-or-create) is used only by `sendThreadMessageAction`, so the thread comes into existence with the
first message. The internal flows that post a moderation note (flag, approve, status change, update) already create the thread together with the message and are unchanged.
The hide filter stays, for the empty rows already in the database. Those are harmless; deleting them (no messages, `type = 'moderation'`) is a separate, approved
production clean-up and has not been done.
