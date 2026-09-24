# Instant Alerts — paid real-time email/WhatsApp notification on new messages

## Status: shipped (2026-09-15) — scope extended 2026-09-24

Instant Alerts also fires email/WhatsApp on **identified listing interest** (“I’m interested”
CTA), not only new messages — see
[`login-gated-listing-interest-owner-notify.md`](login-gated-listing-interest-owner-notify.md).
Message Instant Alerts behaviour below is unchanged.

Today, when a buyer messages an owner about a listing, the owner learns about it only if:
they have the mobile app installed with an open push subscription (`PushService.notifyNewMessage`,
`apps/bff/src/push/push.service.ts:64`, free, fires immediately, already shipped), or they happen
to log back in and check `/messages` themselves. There is **no email or WhatsApp path at all** —
confirmed by reading `MessagingController.sendMessage`/`sendFirstMessage`
(`apps/bff/src/messaging/messaging.controller.ts:31-105`): the module only imports `PushModule`
(`messaging.module.ts:9`), never `NotificationsModule`.

A design for this already exists — `docs/plans/contact-owner-message-notifications.md` — written
as a **free-for-everyone** feature (email else WhatsApp, one alert per unread burst) and never
shipped. This plan **supersedes that doc's free default**: the same mechanism ships instead as a
paid, per-listing add-on called **Instant Alerts**, sold next to Boost on the Post Ad success
screen and My Listings, at a flat ₹25 (which buys alerts until the listing's own `expiresAt` — a
seller who buys right after posting gets ~30 days; buying with fewer days left on the listing gets
proportionally less for the same ₹25, since it's tied to the listing's cycle, not a fixed 30-day
timer of its own). A seller with the app already gets this for free via push; Instant Alerts is
for reaching an owner who primarily checks email/WhatsApp instead of opening the app.

Two implementation decisions were confirmed with the user before writing this plan:
- **No auto-renewal.** Instant Alerts does not extend itself when a listing is renewed — same as
  Boost today. Each renewal re-offers the ₹25 add-on as its own action.
- **Zero→nonzero edge trigger, not per-message.** One alert per "burst" of unread messages (see
  "Debounce" below) — controls WhatsApp per-send cost and avoids paying customers getting spammed
  during a fast back-and-forth.

**Naming**: call it "Instant Alerts" everywhere (UI copy and code identifiers), never "push
notification" — that name is already taken by the existing free Expo push path and reusing it here
would make a seller reading the pricing card think they don't already have push, which isn't true.

## Data model (`apps/bff/prisma/schema.prisma`)

New migration, purely additive — mirrors the existing `ListingBoost`/`Listing.boostedUntil`
denormalization pattern exactly (see `schema.prisma:366-371, 780-793`):

- `PaymentPurpose` enum (`schema.prisma:95-101`): add `instant_alerts`.
- New `ListingInstantAlert` model (audit trail, same shape as `ListingBoost` at `:783-793`):
  `id, listingId, listing (relation, onDelete: Cascade), paymentId (String @unique), activatedFrom
  (DateTime @default(now())), activeUntil (DateTime)`.
- `Listing` gets `instantAlertsUntil DateTime?` (denormalized, next to `boostedUntil` at `:370`) and
  a `listingInstantAlerts ListingInstantAlert[]` relation (next to `listingBoosts` at `:386`). No
  new index needed — unlike `boostedUntil`, nothing sorts on this; it's only ever read by listing id
  inside `MessagingService`.
- No new column on `Payment` is needed (unlike `boostDays`) — Instant Alerts has no seller-chosen
  duration; `activeUntil` is always set to the listing's *current* `expiresAt` at activation time.

**Pricing**: flat, admin-editable, following the exact singleton-row convention `BoostPriceSettings`
already uses (`apps/bff/src/plans/plans.constants.ts`'s `BOOST_PRICE_SETTINGS_ID`/
`DEFAULT_BOOST_PRICE_SETTINGS`). Add `packages/types/src/instantAlertsPricing.ts`:
```ts
export interface InstantAlertsPriceSettings { instantAlertsPrice: number }
export const DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS: InstantAlertsPriceSettings = { instantAlertsPrice: 25 };
```
Add `./instantAlertsPricing` to `packages/types/package.json`'s `exports`, plus a matching
`INSTANT_ALERTS_PRICE_SETTINGS_ID` constant + admin settings row in `plans.constants.ts`, same as
`BOOST_PRICE_SETTINGS_ID`.

## Backend checkout (`apps/bff/src/payments/`)

Mirrors `createBoostOrder` (`payments.service.ts:128-214`) and its controller wiring
(`payments.controller.ts:21-25`) exactly, minus the duration parameter:

- New `CreateInstantAlertsOrderDto` (`dto/create-instant-alerts-order.dto.ts`): `{ listingId: string;
  discountCode?: string }`.
- New endpoint `POST /payments/instant-alerts` (authed) → `PaymentsService.createInstantAlertsOrder`:
  verify listing ownership, read `instantAlertsPrice` from settings (falls back to
  `DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS`, same fallback idiom as `boostPriceFor`), create a
  Razorpay order + `Payment` row (`purpose: 'instant_alerts'`), return
  `CreateInstantAlertsOrderResponseDto` — same shape as `CreateBoostOrderResponseDto`, its own named
  type per the existing convention (`index.ts`'s comment on `CreateSubscriptionOrderResponseDto`
  explains why: "kept as its own named type since callers read more clearly").
- Webhook (`handleWebhook`, `payments.service.ts:316-354`): add a branch alongside the existing
  `purpose === 'listing_boost'` one —
  ```ts
  if (payment.purpose === 'instant_alerts' && payment.listingId) {
    await this.activateInstantAlerts(payment.listingId, payment.id);
  }
  ```
  `activateInstantAlerts` re-reads the listing's **current** `expiresAt` at webhook time (not the
  value from order-creation time, in case the listing was renewed in between), creates the
  `ListingInstantAlert` row, and sets `Listing.instantAlertsUntil` to it — same shape as
  `activateListingBoost` (`payments.service.ts:66-75`).

**No new "bundle" SKU.** Per the earlier discussion, `PaymentPurpose` has always been one purpose
per `Payment` row — there's no bundle concept anywhere today. "Boost + Instant Alerts" stays UI
framing only: the Post Ad / My Listings screen lets a seller check either or both, and if both are
checked the client just fires two independent order+checkout calls in sequence (boost, then
instant alerts), rather than inventing a combined-purpose row or a discounted bundle price.

## Messaging hook — where the alert actually fires

`apps/bff/src/messaging/messaging.service.ts`'s `sendMessage`/`sendFirstMessage`. Today neither
method checks the recipient's unread state before writing the message. Add, right before
`prisma.message.create`, the same shape of count `listConversations` already runs for its own
`unreadCount` (`messaging.service.ts:106-108`), scoped to the recipient and this conversation:

```ts
const wasUnread = await this.prisma.message.count({
  where: { conversationId, senderId: { not: senderId }, readAt: null, deletedAt: null },
});
```

After the message is created, if `wasUnread === 0` **and** the recipient is the listing's owner
(never the inquirer — Instant Alerts is bought by and for the advertiser, not the buyer) **and**
the conversation's `type === 'inquiry'` (never the admin↔owner `moderation` thread) **and**
`listing.instantAlertsUntil` is in the future, call a new `NotificationsService.notifyNewMessage`.
This is the exact "zero→nonzero edge" rule from `contact-owner-message-notifications.md`, now
gated on the paid flag instead of firing for everyone.

`NotificationsService.notifyNewMessage` (new method in `apps/bff/src/notifications/
notifications.service.ts`, alongside `notifyListingLiked`/`notifySavedSearchMatch`): calls the
existing shared `dispatchEmailPreferWhatsapp` helper (`notifications.service.ts:251-279`) with the
sender's display name (role label if no name — never phone/email, matching the existing rule that
already fixed this leak elsewhere), the listing title, a message preview, and a link to
`/messages/:conversationId`. Returns `'email' | 'whatsapp' | null`; write a
`ListingNotificationLog` row (`kind: 'new_message', channel`) on a non-null result, same call-site
pattern already used in `listing-expiry-reminder.job.ts:54-64` — no dedup check needed before
sending here (unlike the reminder job) since the zero→nonzero condition is itself the dedup.

`MessagingModule` (`messaging.module.ts`) needs to import `NotificationsModule`, which it doesn't
today.

## WhatsApp readiness — a real launch risk, not a formality

Flagging this because it directly affects whether the ₹25 charge is honest: `WhatsappProvider.
sendTemplate` (`apps/bff/src/notifications/providers/whatsapp.provider.ts:66-170`) has never sent a
message in production — its own doc comment says so. Most posters are phone-only (per the
already-written `post-ad-acknowledgement.md` finding), so a phone-only seller who pays ₹25 today
would get **nothing**, silently, because the WhatsApp path is unverified. Recommend: launch Instant
Alerts gated to email-only at first — either hide/disable the purchase option for a seller with no
verified email, or sell it to everyone but show "Alerts go to your email; WhatsApp support is
coming soon" — and only enable the WhatsApp branch once a real utility-category template is Meta-
approved and a live send has actually been confirmed to arrive. Selling a feature that fails
silently for the majority of your users is worse than not offering WhatsApp yet.

## UI

**Web** — two independent buttons, same card styling `BoostButton` already uses:
- `PostAdWizard.tsx`'s boost-pitch card (`:965-992`): add an `InstantAlertsButton` (new component,
  mirrors `BoostButton.tsx`'s props — `listingId`, no `category` needed since price is flat) either
  as a second card right below the existing one, or a second CTA inside it — copy should explicitly
  say "already have the app? you get this for free" so the free alternative isn't hidden behind a
  paywall pitch.
- `my-listings/page.tsx` (`:157-158`): same button next to the existing `<BoostButton>`, shown when
  `!listing.instantAlertsUntil || isExpired(instantAlertsUntil)`.

**Mobile** — mirror `BoostButton.tsx`'s (`apps/mobile/src/components/home/BoostButton.tsx:38-58`)
iOS/Android split exactly, same Guideline 3.1.1 rationale already documented there and in
`PostAdWizard.tsx:964-999`: this is a paid digital feature-unlock, same category as Boost, so it
gets the same treatment — iOS opens `/my-listings` in the browser (`WebBrowser.openBrowserAsync`),
Android opens a native `InstantAlertsModal` (mirrors `BoostModal.tsx`) via `react-native-razorpay`.

## Debounce mechanism recap

The one new piece of logic (the `wasUnread` count above) is intentionally the *only* new
conditional in the send path — everything else (channel choice, delivery logging, WhatsApp
template plumbing) reuses infrastructure that already exists and is already correct. This keeps
the feature's real risk surface small: the schema/checkout is copy-paste from Boost, and the
notification dispatch is copy-paste from `notifyListingLiked`.

## Verification

- `pnpm -w typecheck` after the schema/migration + `@bhavano/types` additions.
- Local Razorpay test-mode: buy Instant Alerts on a test listing, confirm the webhook sets
  `Listing.instantAlertsUntil` and creates the `ListingInstantAlert` row (same test flow already
  used for Boost in `monetization-boosted-listings-premium-tiers.md`'s Verification section).
- With Instant Alerts active on a test listing: send a first message as the buyer → confirm exactly
  one email/WhatsApp send to the owner and one `ListingNotificationLog` row (`kind: 'new_message'`).
  Send 3 more messages back-to-back without the owner reading → confirm **no** additional sends.
  Have the owner open `/messages` (marking read) then send another message → confirm exactly one
  more send fires.
- Confirm a listing *without* an active `instantAlertsUntil` produces zero email/WhatsApp sends on
  new messages (push/websocket still fire as today — this feature is additive, not a replacement).
- Confirm the inquirer (buyer) never receives an Instant Alerts email/WhatsApp regardless of their
  own messages — only the listing owner is ever the recipient.
- On iOS, confirm tapping the Instant Alerts button opens the website in the in-app browser rather
  than any native purchase sheet.

## Critical files

- `apps/bff/prisma/schema.prisma` (`PaymentPurpose` enum, new `ListingInstantAlert` model,
  `Listing.instantAlertsUntil`), new migration
- `apps/bff/src/payments/payments.controller.ts`, `payments.service.ts` (new endpoint, DTO,
  `activateInstantAlerts`, webhook branch)
- `apps/bff/src/plans/plans.constants.ts` (new settings singleton, mirrors `BOOST_PRICE_SETTINGS_ID`)
- `packages/types/src/instantAlertsPricing.ts` (new), `packages/types/src/index.ts`
  (`PaymentPurpose` union, `CreateInstantAlertsOrderResponseDto`), `packages/types/package.json`
  (new `exports` entry)
- `apps/bff/src/messaging/messaging.service.ts` (`wasUnread` check in `sendMessage`/
  `sendFirstMessage`), `messaging.module.ts` (import `NotificationsModule`)
- `apps/bff/src/notifications/notifications.service.ts` (new `notifyNewMessage`)
- `apps/web/src/components/home/PostAdWizard.tsx`, new `InstantAlertsButton.tsx` (web),
  `apps/web/src/app/my-listings/page.tsx`
- `apps/mobile/src/components/home/BoostButton.tsx` (pattern to mirror), new
  `InstantAlertsButton.tsx`/`InstantAlertsModal.tsx` (mobile), `PostAdWizard.tsx` (mobile)
- `docs/plans/contact-owner-message-notifications.md` — update its header to note it's superseded
  by this paid version once this ships, same convention `notification-delivery-tracking-and-
  engagement-alerts.md` already used ("Status: implemented" + a correction note) rather than
  leaving it looking like still-open free-for-everyone work
