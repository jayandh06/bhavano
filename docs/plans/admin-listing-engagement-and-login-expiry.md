# Admin listing engagement (views/likes/messages) + login-expiry bump

## Context

The admin listing moderation dashboard is currently a card list with no visibility into how a
listing is actually performing (views, likes, buyer interest) or into buyer↔seller conversation
activity — an admin reviewing a listing has no way to see who's engaged with it short of digging
through the database directly. This adds that visibility: a proper data table on the dashboard,
and a per-listing breakdown (who liked/viewed, who messaged, with the full thread on demand) on
the listing detail page.

Separately, bundled in because it surfaced mid-session: the BFF's access token expires after 1
hour, shorter than users likely expect and shorter than the NextAuth session cookie that wraps it
(30-day default) — this is the token-staleness gap an earlier investigation this session traced as
the cause of confusing stale-session 401s. Bumping it to 24 hours is a one-line, low-risk fix
worth doing in the same pass.

**Resolved ambiguity** (user's own choice): "who liked/messaged/viewed" becomes **two** tables —
Table A merges liked + viewed (an "Action" column distinguishes them; anonymous/logged-out views
are excluded since they have no resolvable user — total view count including anonymous stays
visible as the existing `viewCount` field), Table B is buyer-inquiry messages.

## Part 1 — Login expiry: 1h → 24h

`apps/bff/src/auth/auth.service.ts:23` — `const ACCESS_TOKEN_TTL = '1h';` → `'24h'`. Single-line
change; both regular users and admins issue tokens through this same constant, so both are
covered. No NextAuth `session.maxAge` changes needed on `apps/web`/`apps/admin` — both already
default to 30 days, well above 24h, so the BFF token was always the tighter constraint.

## Part 2 — Admin listing engagement

No schema changes — `Listing` already has `views`/`favourites`/`conversations` back-relations
(`apps/bff/prisma/schema.prisma:335-337`), `Favourite` already has a real `userId` FK to `User`,
and `ListingView.viewerKey` already encodes `` `user:${userId}` `` for logged-in viewers (set
server-side in `ListingsService.recordView`) / `` `anon:${deviceKey}` `` for anonymous ones — this
is genuinely new query/endpoint/UI surface area over existing data, not new tracking.

### 2a. `packages/types/src/index.ts` — new DTOs

```ts
export interface ListingEngagementRowDto {
  userId: string;
  userName: string | null;
  userPhone: string | null;
  userEmail: string | null;
  action: "liked" | "viewed";
  at: string; // ISO
}
export interface ListingEngagementPage { items: ListingEngagementRowDto[]; total: number; }

export interface AdminConversationSummaryDto {
  id: string;
  inquirer: { id: string; name: string | null; phone: string | null; email: string | null };
  lastMessage: MessageDto | null;
  /** Last message was the buyer's and the owner hasn't read it — an admin triage signal, not a
   * per-viewer unread count (the admin isn't a conversation participant). */
  unreadByOwner: boolean;
  createdAt: string;
}
export interface AdminConversationsPage { items: AdminConversationSummaryDto[]; total: number; }
```

Plus one optional field on `ListingDetailDto`, same pattern as the existing
`postedNotificationSent` bolt-on:
```ts
/** Buyer-inquiry (`type: "inquiry"`) conversation count — never the admin↔owner moderation
 * thread. Only populated by ListingsService.listForAdmin. */
messageCount?: number;
```

### 2b. BFF — `ListingsService` (`apps/bff/src/listings/listings.service.ts`)

- **`listForAdmin`**: add `_count: { select: { conversations: { where: { type: 'inquiry' } } } }`
  to the existing `findMany`'s `include` (Prisma filtered-relation count — zero extra queries),
  and bolt `messageCount: row._count.conversations` onto the mapped result alongside
  `postedNotificationSent` etc.

- **New `listEngagement(listingId, offset, limit): Promise<ListingEngagementPage>`** — merges
  `Favourite` (real `User` FK, use as-is) and `ListingView` (filter `viewerKey: { startsWith:
  'user:' }`, strip the prefix, batch-resolve via `User.findMany({ where: { id: { in: ... } } })`)
  into one array sorted by timestamp desc, paginated in memory (`take: offset + limit` on each
  source query, then `.slice(offset, offset + limit)` after merging — bounded per-listing, not a
  global scan, so this is fine at `PAGE_SIZE_OPTIONS`'s max of 100). No raw SQL — first precedent
  for `$queryRaw` in this codebase would be a bigger, unjustified departure for what's a
  single-listing merge. A user appears twice if they both liked and viewed — intentional, action
  is per-row not per-user. Drop (don't render) a `ListingView` row whose `viewerKey` points at a
  deleted user.

### 2c. BFF — `MessagingService` (`apps/bff/src/messaging/messaging.service.ts`)

Lives here, not `AdminService` or a new service — this file already owns all
`Conversation`/`Message` domain logic including the existing admin-only
`getOrCreateModerationThread`; `AdminService` stays the thin per-domain delegator it already is.

- **New `listConversationsForListingAsAdmin(listingId, offset, limit)`** — `where: { listingId,
  type: 'inquiry' }` (excludes the moderation thread, which shares the same `listingId`), include
  `inquirer` + latest `message`, paginate, return `AdminConversationsPage`.

- **New `getMessagesAsAdmin(listingId, conversationId): Promise<MessageDto[]>`** — the
  `assertParticipant` bypass `MessagingService.getMessages` can't provide (an admin is never a
  real conversation participant). Still validates the conversation belongs to the given
  `listingId` and is `type: 'inquiry'` (404s otherwise) so a mismatched id can't leak a different
  listing's thread. Deliberately does **not** call `markRead` — an admin viewing a thread must
  never be mistaken for the owner having responded.

### 2d. BFF — `AdminService` + `AdminController`

`AdminService`: three thin delegators (`listListingEngagement`, `listListingConversations`,
`getListingConversationMessages`) calling the methods above, matching how `getThread` already
delegates to `MessagingService`.

`AdminController` (`apps/bff/src/admin/admin.controller.ts`) — three new routes under the existing
class-level `@UseGuards(AdminGuard)`, no new guard needed:
```
GET /admin/listings/:id/engagement
GET /admin/listings/:id/conversations
GET /admin/listings/:id/conversations/:conversationId/messages
```
Two new query DTOs in `apps/bff/src/admin/dto/` (`ListListingEngagementDto`,
`ListListingConversationsDto`) — same `offset?/limit=25` shape as `ListBoostsDto`.

### 2e. Admin app — pagination param-namespacing (needed before the detail page can have two
independent paginated tables)

`apps/admin/src/lib/searchParams.ts` and `apps/admin/src/components/Pagination.tsx` currently
hardcode the query-param names `"page"`/`"limit"` — two `<Pagination>` instances on one page would
collide (paging one resets the other). Generalize both to take an optional `paramNames` (defaulting
to `{ page: "page", limit: "limit" }`, so every existing call site keeps compiling/behaving
unchanged):

```ts
// searchParams.ts
export interface PageParamNames { page: string; limit: string; }
export const DEFAULT_PAGE_PARAM_NAMES: PageParamNames = { page: "page", limit: "limit" };
export function buildPageHref(basePath, sp, page, paramNames = DEFAULT_PAGE_PARAM_NAMES) { ... }
```
```tsx
// Pagination.tsx — add `paramNames?: PageParamNames` prop, use it in place of the two literal
// "page"/"limit" strings in the hidden-field-passthrough loop and the size <select>'s `name`.
```
`parsePage`/`parsePageSize` need no change — they already take a pre-extracted string, the caller
picks which `sp` key to read.

Detail page uses `likedPage`/`likedLimit` for Table A and `msgPage`/`msgLimit` for Table B.

### 2f. Admin app — dashboard table (`apps/admin/src/app/page.tsx`)

Extract **new `apps/admin/src/components/AdminListingsTable.tsx`** (plain Server Component, no
`"use client"` — no interactivity needed here), moving `StatusBadge`/`PostedNotificationBadge`
into it, matching the existing `UsersTable`/`DiscountCodesTable` convention (`thStyle`/`tdStyle`,
`var(--surface-alt)` header, `border-top` row separators, `overflowX: auto` wrapper). `page.tsx`
keeps the filter form + fetch + `<Pagination>`, swaps its current `.map()` of card `<Link>`s for
`<AdminListingsTable items={result.items} />`.

Columns: Title (whole row clickable via a stretched-link `<Link style={{position:"absolute",
inset:0}}>` inside the title `<td>`, so it stays a pure server component with no per-row
`onClick`) · Status · Notification · Views (`viewCount`) · Likes (`likeCount`) · Messages
(`messageCount ?? 0`) · Price (`price` + `priceQualifier`, display-only — `AdminListingSort` has
no price option and `price` is a pre-formatted string on the DTO, not a sortable number; out of
scope per the user's ask, which was for a column not a sort) · Created · Modified.

Widen `page.tsx`'s wrapper from `maxWidth: 1000` to ~1200-1300 to fit 9 columns comfortably (still
backed by the existing `overflowX: auto` safety net).

### 2g. Admin app — detail page (`apps/admin/src/app/listings/[id]/page.tsx`)

Add a `searchParams` prop (currently has none — same addition `discount-codes/page.tsx` needed
recently). Fetch both new pages in the existing `Promise.all` alongside `thread`/`owner`. Render
both new sections **below** the existing `<ModerationPanel>`, each in its own bordered
`var(--surface)` card matching the page's existing section styling:

- **"Liked & Viewed"** — plain server-rendered `<table>` (no interactivity), its own `<Pagination>`
  using `likedPage`/`likedLimit`.
- **"Messages"** — new `"use client"` `apps/admin/src/components/ConversationsTable.tsx`. Props:
  `listingId`, `items: AdminConversationSummaryDto[]`, `ownerId`, `ownerName` (owner is already
  fetched on this page via `fetchListingOwner` — pass down, don't refetch). Click anywhere on a
  row (`onClick` on the whole `<tr>`, valid here since the component is already client-side) to
  expand a second `<tr><td colSpan>` immediately below showing that thread, fetched **on demand**
  (not pre-fetched for the whole page — most rows never get expanded) via a new Server Action, and
  cached in local state per conversation id so re-toggling doesn't refetch. Its own
  `<Pagination>` using `msgPage`/`msgLimit`.

  Bubble styling reuses `ModerationPanel`'s CSS but can't reuse its "align by `senderId ===
  currentUserId`" logic — the admin isn't a participant here, neither side is "me." Align by role
  instead (inquirer left / owner right, via `m.senderId === c.inquirer.id`) with a small name/role
  label per bubble ("Buyer — Priya" / "Owner — Raj"), since side alone doesn't self-explain in a
  spectator view the way it does in a two-party thread.

New plumbing this needs:
- `apps/admin/src/lib/bff.ts`: `fetchListingEngagement`, `fetchListingConversations`,
  `fetchListingConversationMessages` — same `authedBffFetch(accessToken, path, {cache:
  "no-store"})` shape as every existing fetcher here.
- `apps/admin/src/app/actions/admin.ts` (or wherever admin Server Actions currently live):
  `fetchConversationMessagesAction(listingId, conversationId)` — a client component can't call
  `apps/admin/src/lib/bff.ts` directly (it's `server-only`, and the BFF access token lives only in
  the server-side NextAuth session), so this Server Action is the only path from
  `ConversationsTable`'s click handler to the new BFF route.

## Verification

1. `apps/bff`: `npx tsc --noEmit`, `npx jest` — add unit tests for `listEngagement` (merge
   ordering, the liked+viewed-same-user-twice case, an orphaned `viewerKey` being dropped) and
   `getMessagesAsAdmin` (404 on wrong listingId, 404 on a `type: 'moderation'` conversation id)
   following this file's existing test patterns.
2. `apps/admin`: `npx tsc --noEmit`, `npx eslint`, `npx next build` — confirm every existing
   `<Pagination>` call site (dashboard, users, logins, page-visits, boosts, discount-codes, the 3
   outreach pages) still compiles and behaves unchanged after the `paramNames` addition.
3. Manual: on one listing's detail page, paginate Table A and Table B independently and confirm
   neither resets the other's page/size; confirm a listing with zero buyer inquiries renders an
   empty Messages table cleanly (not an error); confirm a listing with only anonymous views
   renders an empty Liked & Viewed table cleanly; click a message row, confirm the thread expands
   with buyer/owner correctly labeled, click again to collapse; confirm the dashboard table's 9
   columns render sensibly and the whole row (not just the title text) is clickable.
4. Manual, login expiry: sign in, wait past the old 1h mark (or inspect the issued JWT's `exp`
   claim directly), confirm the BFF access token now carries a 24h expiry.

### Critical files
- `apps/bff/src/auth/auth.service.ts` (Part 1)
- `apps/bff/src/listings/listings.service.ts`
- `apps/bff/src/messaging/messaging.service.ts`
- `apps/bff/src/admin/admin.controller.ts`, `apps/bff/src/admin/admin.service.ts`
- `apps/bff/src/admin/dto/` (2 new DTO files)
- `packages/types/src/index.ts`
- `apps/admin/src/lib/searchParams.ts`, `apps/admin/src/components/Pagination.tsx`
- `apps/admin/src/lib/bff.ts`, `apps/admin/src/app/actions/admin.ts`
- `apps/admin/src/app/page.tsx` + new `apps/admin/src/components/AdminListingsTable.tsx`
- `apps/admin/src/app/listings/[id]/page.tsx` + new `apps/admin/src/components/ConversationsTable.tsx`
- Reference only, not modified: `apps/admin/src/components/UsersTable.tsx`,
  `DiscountCodesTable.tsx`, `RotatablePhotoGrid.tsx`, `ModerationPanel.tsx`
