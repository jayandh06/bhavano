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
