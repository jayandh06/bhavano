# Unread-message count badge (web + mobile) with mobile push

## Context

A logged-in user — whether they're the seller on a listing or the buyer inquiring — has no
way to know a new chat message has arrived unless they open **Messages** and scan the list.
The per-conversation unread badges already exist on that list (`apps/web/src/app/messages/page.tsx:82`,
`apps/mobile/app/messages/index.tsx:46`), but nothing surfaces a total anywhere else, and the
mobile app only reaches Messages through a button buried in the Account tab.

This plan surfaces a **total unread-message count** on the existing **Messages** entry point on
every surface, updates it in **real time** over the socket connection that already powers the
chat threads, and adds **OS push notifications on mobile** so a new message reaches the device
when the app is backgrounded or closed.

Decisions already taken with the user:

- **Badge the existing Messages icon** — no separate "bell"/notification-centre. A dedicated bell
  implies aggregating listing-approved / saved-search / like events too, which is out of scope.
- **Count = total unread messages** (sum across all threads), matching the per-thread badges.
- **Mobile app**: a Messages icon **with a count badge** added as a visible entry point
  (Home-screen header + the Account-tab button), not a new bottom tab.
- **Push scope = new chat messages only.** `NotificationsService` (email/WhatsApp for listing
  lifecycle, saved-search matches, likes) is **not** touched — chat gets in-app realtime + push,
  never email/WhatsApp.

## Backend (`apps/bff`)

### 1. Aggregate unread endpoint — `src/messaging/`

- `MessagingService.getUnreadTotal(userId): Promise<number>` — one query, both roles:
  ```ts
  this.prisma.message.count({
    where: {
      senderId: { not: userId },
      readAt: null,
      conversation: { OR: [{ posterId: userId }, { inquirerId: userId }] },
    },
  })
  ```
- `MessagingController` (already `@UseGuards(AuthGuard)`): `GET /conversations/unread-count` → `{ count }`.
- `MessagingService.sendMessage` currently returns just `MessageDto`; change it to also return the
  **recipient id** (the other participant — `assertParticipant` already loads the conversation, so
  derive it there): `{ message, recipientId }`. Update the existing caller and
  `messaging.service.spec.ts`.

### 2. Per-user socket room + realtime unread events — `src/messaging/messaging.gateway.ts`

- In `handleConnection`, after the existing `jwt.verify`, decode `sub` from the (now verified)
  token and `client.join('user:' + userId)`. Keep the per-conversation rooms as-is.
- New `notifyUnread(userId, payload: { conversationId: string; unreadCount: number })` →
  `this.server.to('user:' + userId).emit('unread_update', payload)`.
- `MessagingController.sendMessage`: after `gateway.broadcastMessage(...)` (unchanged), also
  `gateway.notifyUnread(recipientId, { conversationId, unreadCount: await service.getUnreadTotal(recipientId) })`
  and fire the push (step 3). All best-effort — must not fail the request.
- `MessagingController.markRead`: after `service.markRead(...)`, emit `notifyUnread(user.id, …)` with
  the caller's fresh total so the badge self-heals across the user's other tabs/devices.

### 3. Push module (messages only) — new `src/push/`

- **Prisma**: `model PushToken { id, userId, user User @relation(...), token String @unique, platform String, createdAt, lastSeenAt DateTime @updatedAt }` + `pushTokens PushToken[]` on `User`. New migration.
- `PushModule` (imports `PrismaModule`), `PushService`:
  - `registerToken(userId, token, platform)` — `upsert` on `token` (re-points a device token that
    moved between accounts); bumps `lastSeenAt`.
  - `removeToken(token)`.
  - `notifyNewMessage(recipientId, message: MessageDto, senderName: string)` — load the user's
    tokens, POST to `https://exp.host/--/api/v2/push/send` via `fetch` in chunks of ≤100:
    `{ to, title: senderName, body: <message.body, truncated ~140 chars>, data: { conversationId }, channelId: 'messages' }`.
    Parse the response; on a `DeviceNotRegistered` ticket, delete that token. Wrap everything so it
    never throws into the request path; log via the existing pino logger. Raw `fetch` — no new
    dependency — mirrors `whatsapp.provider.ts` / `msg91.provider.ts` calling their HTTP APIs
    directly. Gate on a config flag (`EXPO_PUSH_ENABLED`); no-op when unset, like the other
    providers degrade.
  - Optional (note only, default off): `if (gateway.isUserOnline(recipientId)) skip push` — v1
    always pushes; the in-app socket path already covers the foreground case idempotently.
- `PushController` (`@UseGuards(AuthGuard)`): `POST /users/me/push-tokens { token, platform }`,
  `DELETE /users/me/push-tokens { token }` (matches the repo's existing `users/me/*` convention).
- `MessagingModule` imports `PushModule`; `MessagingController` injects `PushService`.

### 4. Shared types — `packages/types/src/index.ts`

Add near `MessageDto` (line 260):

- `UnreadCountDto { count: number }`
- `UnreadUpdateEvent { conversationId: string; unreadCount: number }`
- `PushTokenInput { token: string; platform: "ios" | "android" }`

## Web (`apps/web`)

### 5. Data plumbing

- `src/lib/bff.ts`: `fetchUnreadCount(accessToken) → GET /conversations/unread-count`
  (uses the existing `authedBffFetch`).
- `src/app/actions/messaging.ts`: `getUnreadCountAction()` — `"use server"`, `auth()` +
  `fetchUnreadCount`, same shape as the neighbouring `markReadAction` (returns `{ count }` or
  `{ requiresLogin: true }`). Keeps the count off the server render path of every page.
- Thread `accessToken` to the header: add optional `accessToken?: string` to `Header.tsx` and
  `HeaderAuthButtons.tsx` (already `"use client"`). The 4 `<Header …>` render sites already call
  `auth()` — pass `session?.accessToken` through:
  `src/components/home/PageHeader.tsx`, `BrowseListingsView.tsx`, `ListingDetailView.tsx`,
  `src/app/page.tsx`.

### 6. `MessagesNavItem` client component — new `src/components/home/MessagesNavItem.tsx`

Replaces the two inline `<Link href="/messages"><Icon name="message" /> Messages</Link>` blocks in
`HeaderAuthButtons.tsx` (lines 29–31 desktop, 77–79 dropdown) and adds a compact phone variant.

- `"use client"`. Props: `accessToken?: string`, `cityQuery: string`,
  `variant: "inline" | "menu" | "compact"`.
- On mount, if `accessToken`: `getUnreadCountAction()` → `count`.
- `useEffect`: `getSocket(accessToken).on("unread_update", e => setCount(e.unreadCount))`
  (`src/lib/socket.ts` singleton — this now connects the socket on every page for logged-in
  users, which is the intent); also refetch the count on `window` `focus` / `visibilitychange`
  to cover socket sleep/reconnect and reads on another device.
- Renders the existing `<Icon name="message" />` + label (label omitted for `compact`) with a
  badge bubble when `count > 0`, capped `99+`, reusing the exact badge classes from
  `messages/page.tsx:82` (`bg-green text-on-green rounded-full text-[11px] font-bold px-2 py-[3px]`,
  shrunk for `compact`).

### 7. Placement in `HeaderAuthButtons.tsx`

- **Desktop / tablet** (`hidden sm:inline-block` group, ≥640px): keep order Favourites →
  `MessagesNavItem variant="inline"`. The badge on the icon is what draws the eye; Messages
  already sits adjacent to Favourites. (Original ask was "before Favourites" — if the count
  should be the leftmost element, swap the two `<Link>`s; one-line change, flagged for the
  reviewer.)
- **Mobile web** (phone): add `<MessagesNavItem variant="compact" />` into the always-visible
  flex row returned at the top of `HeaderAuthButtons` (before `<AccountMenu>`), `sm:hidden`.
  Keep the labelled `variant="menu"` entry inside `AccountMenu` for navigation. This fixes the
  fact that the phone Messages link is otherwise hidden inside a closed dropdown where a badge
  is invisible.

### SEO

`Header.tsx` stays a Server Component; only the small `MessagesNavItem` leaf is `"use client"`
(sibling of the already-client `HeaderAuthButtons`). No `metadata` / `generateMetadata`, route,
redirect, or JSON-LD change. The count is login-gated and non-crawlable. Net SEO impact: none.

## Mobile app (`apps/mobile`)

> Per `apps/mobile/AGENTS.md`, confirm the exact `expo-notifications` API against
> https://docs.expo.dev/versions/v57.0.0/ before writing this code.

### 8. Push registration

- Add `expo-notifications` (SDK 57 build) to `package.json`; add `"expo-notifications"` (with
  notification icon/color config) to `plugins` in `app.config.js`.
- `src/lib/push.ts`:
  - `registerForPushAsync(accessToken)` — guard `Platform.OS !== "web"` and `Device.isDevice`;
    request permissions; `getExpoPushTokenAsync({ projectId })` reading `projectId` from
    `expo-constants` `expoConfig.extra.eas.projectId` (already `1d49dddb-…` in `app.config.js`);
    `POST /me/push-tokens`. On Android, create the `messages` channel first.
  - Called from `HomeSheetsProvider.onLoginSuccess` and from the existing startup effect that
    restores the token (when `accessToken` transitions to non-null). `logout()` → `DELETE
    /me/push-tokens` (best-effort, before the token is cleared).
- `src/lib/bffClient.ts`: `registerPushToken(accessToken, token, platform)`,
  `deletePushToken(accessToken, token)`.
- `app/_layout.tsx` (or a tiny `PushProvider` mounted there): set the foreground notification
  handler; add a response listener → `router.push(`/messages/${data.conversationId}`)`; on a
  received notification invalidate the `["conversations"]` and `["unread"]` queries.

### 9. In-app realtime unread + the badged Messages icon

- `src/lib/queries.ts`: `useUnreadCountQuery(accessToken)` → `GET /conversations/unread-count`,
  `enabled: !!accessToken`. Plus a hook/effect subscribing
  `getSocket(accessToken).on("unread_update", e => queryClient.setQueryData(["unread", accessToken], e.unreadCount))`
  and refetching on `AppState` → `"active"`.
- `src/lib/bffClient.ts`: `fetchUnreadCount(accessToken)`.
- **Home screen** `app/(tabs)/index.tsx` — in the `headerTop` right-side `brandRow` (next to the
  theme toggle), add a Messages icon `Pressable` (`onPress={() => router.push("/messages")}`)
  with a count badge, shown only when `isLoggedIn`. Reuse the green `styles.badge` pattern
  already used by the Filters pill in the same file.
- **Account tab** `app/(tabs)/account.tsx` — badge the existing "Messages" button
  (`onOpenMessages`) with the same count.
- `app/messages/index.tsx` / `[id].tsx` — invalidate `["unread"]` on focus / after send; the
  BFF `markRead` `unread_update` emit makes this mostly automatic.
- App-icon badge: `Notifications.setBadgeCountAsync(count)` wherever the count updates (one line).

## Files touched (summary)

| Area | Files |
|---|---|
| BFF messaging | `src/messaging/messaging.{service,controller,gateway,module}.ts`, `messaging.service.spec.ts` |
| BFF push (new) | `src/push/push.{module,service,controller}.ts`, `push.service.spec.ts` |
| BFF schema | `prisma/schema.prisma` (+ migration) |
| Types | `packages/types/src/index.ts` |
| Web | `src/lib/bff.ts`, `src/lib/socket.ts` (reuse), `src/app/actions/messaging.ts`, `src/components/home/{Header,HeaderAuthButtons,PageHeader,BrowseListingsView,ListingDetailView}.tsx`, `src/app/page.tsx`, `src/components/home/MessagesNavItem.tsx` (new) |
| Mobile | `package.json`, `app.config.js`, `src/lib/push.ts` (new), `src/lib/bffClient.ts`, `src/lib/queries.ts`, `app/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/account.tsx`, `app/messages/{index,[id]}.tsx` |

## Implementation notes (as built)

- Endpoints are `POST`/`DELETE /users/me/push-tokens` (repo convention), not `/me/push-tokens`.
- Web: `MessagesNavItem` is split into a shared `UnreadCountProvider` (one fetch + one socket
  subscription, mounted in `HeaderAuthButtons`) and the `MessagesNavItem` leaf, so the three
  render spots (desktop link / phone icon / account-menu row) don't each open their own.
- No web unit test added: `apps/web` vitest is Node-env, pure-logic only (`src/**/*.test.ts`),
  with no RTL/jsdom set up. Covered by the manual verification steps instead.
- BFF `pnpm lint` runs `eslint --fix` and is **not** a clean gate on this repo (~91 pre-existing
  prettier errors); changed files match the surrounding wide-line style rather than being
  reformatted.
- Pre-existing unrelated test failure on `master`: `listings.service.spec.ts` › "rejects a fee
  amount when the fee is not applicable" (message drift introduced in `e3956307`). Untouched by
  this work.
- `expo-notifications ~57.0.15` + `expo-constants ~57.0.16` added to `apps/mobile`; run
  `npx expo install --check` if the pins need reconciling for a build.

## Known limitations (v1, acceptable)

- Web `getSocket` is a singleton created once with the first token; a tab open past the 1h token
  TTL keeps the socket on the stale token (server only checks at handshake). Same as today's
  `MessageThread`; not addressed here.
- Android FCM v1 needs a service-account JSON uploaded to EAS credentials for production push —
  an ops step, not code.

## Verification

1. `pnpm --filter @bhavano/bff prisma:migrate` (PushToken); `pnpm -w typecheck`.
2. `pnpm --filter @bhavano/bff test` — `getUnreadTotal` (both roles, ignores own + read messages);
   push token upsert + `DeviceNotRegistered` cleanup + disabled-when-unconfigured;
   `sendMessage`/`markRead` emit `unread_update`.
3. Web: run BFF + `pnpm --filter @bhavano/web dev`. Two logged-in users (two browser profiles).
   User B messages User A's listing → A's header Messages icon shows a badge that increments in
   real time with no reload; opening the thread clears it and the badge also clears in A's other
   open tab. Check ≥640px (inline label + badge) and phone width (compact icon+badge in the top
   row, labelled entry still in the account menu).
4. `pnpm --filter @bhavano/web test` — `MessagesNavItem`: no badge at 0, badge at N, updates on a
   mocked `unread_update`, caps `99+`.
5. Mobile on a physical device (`pnpm --filter @bhavano/mobile ios|android`): log in → grant
   notification permission → verify `POST /me/push-tokens`. Background the app; other account
   sends a message → OS notification in the `messages` channel; tapping deep-links to the
   conversation. Foreground: Home-header Messages badge + app-icon badge update live via socket.
6. Confirm no email/WhatsApp fires for a chat message (`NotificationsService` unchanged).
