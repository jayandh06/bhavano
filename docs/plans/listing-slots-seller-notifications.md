# Listing slot caps, seller add-on & Pro tiers, expiry reminders, weekly seller digest

## Context

This plan **supersedes the seller-side posting model** described in
`docs/plans/monetization-boosted-listings-premium-tiers.md` Phase 3 (unlimited publish rate via
`agentProUntil` bypass). Boosted listings, buyer **Bhavano Plus**, Razorpay, and the agent
storefront (`/agent/[userId]`) stay; what changes is **how we limit inventory** and **what Pro
includes**.

**Product summary (agreed direction):**

| Tier | Concurrent active listings | Price | Notes |
|------|----------------------------|-------|--------|
| Free | **5** | ₹0 | Slot frees when a listing **expires** or is **removed/sold** (see definitions below). **No** 24h publish-frequency cap. |
| Seller add-on | **10** total (+5) | **₹149/month** | Individuals only; no Pro badge/storefront perks. One add-on at a time. |
| Agent/Broker Pro | **20** per unit | **₹499/month** | Each extra **₹499** adds **+20** slots (stackable `proUnits`). Storefront + elevated video + **1× 7-day boost credit/month**. |
| Boost | Visibility (per listing) | Existing tiered map (`packages/types/src/boostPricing.ts`) or simplified ₹99 mid-tier later | **Separate** from slots; everyone pays per boost (Pro credit covers one 7-day boost/month). |

**Related code today:**

- Publish cap: `RateLimitService` + `@RateLimitAction('publish')` on `POST /listings`
  (`apps/bff/src/rate-limit/rate-limit.service.ts`, `listings.controller.ts`) — **remove/repurpose**
  for slot checks.
- Pro today: `User.agentProUntil` bypasses rate limit only
  (`rate-limit.service.ts:37–41`).
- Listing lifetime: `DEFAULT_LISTING_DURATION_DAYS = 30`, `Listing.expiresAt`
  (`apps/bff/src/listings/listings.service.ts`).
- Metrics: `Listing.viewCount`, `Listing.likeCount` (favourites).
- Notifications: `NotificationsService` + Resend email + MSG91 SMS/WhatsApp
  (`apps/bff/src/notifications/notifications.service.ts`) — welcome already sends **email and/or
  phone**; expiry/digest will use a **different rule** (see Part C).
- Schedulers: `@nestjs/schedule` already on (`ScheduleModule` in `app.module.ts`);
  `BoostRotationService` uses `@Interval` — add `@Cron` jobs in a new `seller-jobs` module.

---

## Part A — Concurrent listing slots (core monetization change)

### A.1 Definitions (must be explicit in code + copy)

**Counts toward slot cap** — a listing owned by the user where **all** of:

- `status === 'active'`
- `moderationState === 'approved'` **or** `pending` (pending still consumes a slot — user chose to post)
- `expiresAt > now()`

**Does not count:** `expired` (past `expiresAt` but row still exists), user-deleted/sold flows if
those set `status !== 'active'`, rejected moderation (if you auto-archive — match moderation plan).

**On create:** `activeCount(ownerId) < slotAllowance(ownerId)` or reject with **403** + structured
error body for upsell UI, e.g.:

```ts
{
  code: 'LISTING_SLOT_CAP_REACHED',
  activeCount: 5,
  allowance: 5,
  upsell: ['sellerSlotPack', 'agentPro']
}
```

**On expiry:** listing drops out of browse (`expiresAt` filter already in `listings.service.ts`);
slot frees **automatically** — no cron required for cap math (count is live).

**Grace when subscription lapses:** If add-on/Pro ends and `activeCount > newAllowance`, **block new
publishes** only; do **not** auto-delete excess listings. Optional: 7-day grace banner on
`/my-listings` to remove or upgrade.

### A.2 Slot allowance resolution

Add a small pure function in `packages/types/src/listingSlots.ts` (easy to test + share with web):

```ts
const FREE_SLOTS = 5;
const SELLER_PACK_EXTRA = 5;        // 10 total with free base
const PRO_SLOTS_PER_UNIT = 20;

function listingSlotAllowance(user: {
  sellerSlotPackUntil?: Date | null;
  agentProUntil?: Date | null;
  agentProUnits?: number;            // default 1 when agentPro active
}): number;
```

**Schema (`User`):**

- `sellerSlotPackUntil DateTime?` — denormalized end of **seller add-on** (like `premiumUntil`).
- `agentProUnits Int @default(1)` — number of stacked ₹499 blocks; only meaningful while
  `agentProUntil` is active. Webhook sets `agentProUnits` from order metadata when user buys
  `agentPro` with `units: 2 | 3 | …` (or separate SKU per +20 block — see A.4).

Allowance:

1. Start at `FREE_SLOTS`.
2. If `sellerSlotPackUntil > now` → `max(allowance, FREE_SLOTS + SELLER_PACK_EXTRA)` (10).
3. If `agentProUntil > now` → `max(allowance, agentProUnits * PRO_SLOTS_PER_UNIT)` (Pro **wins**
   over add-on when higher — never stack add-on + Pro slot math for brokers).

Expose on profile API: `{ activeListingCount, listingSlotAllowance, sellerSlotPackUntil, agentProUntil, agentProUnits }`.

### A.3 Replace rate-limit publish bypass

1. **`ListingsService.create`** — before insert, call `ListingSlotsService.assertCanPublish(ownerId)`.
2. **Remove** `agentProUntil` check from `RateLimitService` for `publish` **or** stop calling
   `checkAndRecordHit` for publish entirely (preferred — admin `publishLimit` becomes obsolete for
   listings; keep **view** rate limits).
3. Update admin copy: `RateLimitSettingsForm` “Max listings” label currently misleading
   (`docs/plans/admin-logins-activity-rate-limits.md`) — document that publish limit is deprecated
   or repurpose `publishLimit` as unused.

### A.4 Payments & types

**New `SubscriptionTier`:** `sellerSlotPack` (or `sellerPlus`).

**`packages/types/src/subscriptionPricing.ts`:**

```ts
export const SELLER_SLOT_PACK_MONTHLY_PRICE = 149;
// agentPro: keep 499; support agentProUnits in order API
```

**`PaymentPurpose`:** add `seller_slot_pack`.

**`POST /payments/subscriptions`** — extend body:

```ts
{ tier: 'sellerSlotPack' | 'buyerPremium' | 'agentPro', months: 1, agentProUnits?: number }
```

Webhook (`payments.service.ts`):

- `seller_slot_pack` → set `sellerSlotPackUntil` (+30 days × months).
- `agent_pro` → set `agentProUntil` + `agentProUnits` from notes; create `UserSubscription` row.

**Pro sweetener — monthly boost credit:**

- `User.agentProBoostCreditGrantedAt DateTime?` — month bucket (e.g. first day of UTC month when credit issued).
- On successful `agent_pro` renewal **or** first day of month cron for active Pro users: if no
  unused credit for current month, set flag / insert `ProBoostCredit` row `{ userId, expiresAt: endOfMonth, redeemedAt? }`.
- `createBoostOrder`: if user has unredeemed credit and `boostDays === 7`, allow **₹0** order or
  skip Razorpay and activate boost server-side (simpler: **waive amount** in order creation when
  credit applies — still audit in `Payment` with `amount: 0` + `purpose: listing_boost` + note
  `pro_credit`).

**Stacking +20:** v1 UI — single “Agent Pro — 20 slots” at ₹499; v1.1 — quantity stepper
“+₹499 per additional 20 slots” passing `agentProUnits`.

### A.5 Frontend

- **`/premium`** — third card or reorder: Seller pack ₹149, Agent Pro ₹499 (with bullet list from
  product table).
- **`/post` + `/my-listings`** — slot meter `4/5`, `9/10`, `18/20`; cap modal with CTAs.
- **`SubscribeButton`** — new tier `sellerSlotPack`.
- **Agent storefront** — optional: hide or de-emphasize for users over 10 listings without Pro
  (product choice; API already public).

### A.6 Verification (Part A)

- Free user with 5 active approved listings → 6th `POST /listings` → 403 `LISTING_SLOT_CAP_REACHED`.
- Expire one listing (`expiresAt` in past) → 6th succeeds.
- Pay seller pack → allowance 10; Pro purchase → 20 and overrides if higher.
- Pro user publishes 21st → blocked; +1 `agentProUnits` via webhook → 40 allowed.
- Typecheck + integration test on `listingSlotAllowance()`.

---

## Part B — Boost remains separate (no plan change to ranking)

Keep `ListingBoost`, rotation job, category-tiered prices. Pro **does not** include unlimited
boosts — only **one 7-day credit per calendar month** (Part A.4).

Marketing copy on `/premium`: “Need more visibility? Boost any listing from My listings.”

---

## Part C — Listing expiry reminders

### C.1 Goals

- Remind sellers **before** ads fall off search (frees a slot, loses leads).
- **Upsell moment:** “Renew”, “Boost before expiry”, or “Post a replacement” (future paid renewal
  out of scope unless added later).

### C.2 Schedule & idempotency

**Cron:** daily at **09:00 IST** (`@Cron('0 3 30 * * *', { timeZone: 'Asia/Kolkata' })` — adjust
for DST if needed; Nest supports `timeZone`).

**Remind at:**

| Offset | Audience |
|--------|----------|
| **7 days** before `expiresAt` | Owner |
| **1 day** before `expiresAt` | Owner |

Skip if listing not active/approved or already expired.

**Idempotency:** new table `ListingNotificationLog`:

```prisma
model ListingNotificationLog {
  id        String   @id @default(cuid())
  listingId String
  kind      String   // 'expiry_reminder_7d' | 'expiry_reminder_1d'
  channel   String   // 'email' | 'sms' | 'whatsapp'
  sentAt    DateTime @default(now())

  @@unique([listingId, kind])
  @@index([sentAt])
}
```

Unique on `(listingId, kind)` — at most one 7d and one 1d reminder per listing lifetime (if user
extends `expiresAt` later, either reset kinds on extend or use new listing id on relist).

### C.3 Channel policy (user requirement)

**Different from `NotificationsService.dispatch()`** (which sends email **and** SMS when both exist):

| User has verified email? | Channel |
|--------------------------|---------|
| **Yes** | **Email only** (Resend) |
| **No** | **SMS** via `Msg91Provider.sendTransactionalSms`; **WhatsApp** only if template configured (same as welcome — log-and-skip if not) |

Rationale: avoid double-notifying phone users who also added email; SMS costs money; email is default
when available.

**No email and no phone:** log warning, skip (rare after OTP signup). Optional later: in-app banner
on `/my-listings` driven by `expiresAt` without outbound send.

### C.4 Implementation

1. `NotificationsService.notifyListingExpiryReminder(user, listing, daysLeft)` — implements channel
   rule above; short SMS body (160 chars) with listing title + link
   `https://bhavano.com/my-listings` (or deep link to listing edit).
2. `ListingExpiryReminderJob` in `apps/bff/src/seller-jobs/listing-expiry-reminder.job.ts`:
   - Query listings where `expiresAt` in `[now+7d, now+7d+1day)` and not in log for `7d`.
   - Same for `1d` window.
   - Batch with concurrency limit (e.g. 20 at a time) to avoid Resend rate limits.
3. **Email content:** subject `Your listing "${title}" expires in 7 days`; body: expiry date, views/
   favourites snapshot (optional one-liner), CTA renew/boost/post new.

### C.5 Verification

- Seed listing expiring in 7 days → cron → one email, log row.
- User phone-only → SMS, no email attempt.
- User with both → email only, no SMS.
- Re-run cron → no duplicate (unique constraint).

---

## Part D — Weekly seller digest (views & favourites)

### D.1 Goals

- **Engagement + upsell:** sellers who see traffic are more likely to boost; zero-traffic listings
  nudge to boost or improve photos.
- **Frequency:** once per **calendar week** (Monday 09:00 IST recommended).

### D.2 Who receives it

Users who:

- Have **≥1** listing counting toward slots (active, approved, not expired) **or** had one in the
  last 7 days (optional — v1: only current active),
- And have **email** OR **phone** (same channel rule as Part C: **email if present, else SMS**).

**Opt-out (v1.1):** `User.sellerDigestOptOut Boolean @default(false)` on profile; skip if true.

### D.3 Metrics: totals vs “this week”

`viewCount` / `likeCount` are **lifetime** on the listing. Digest should show **both**:

- **All-time** views & favourites per listing (from `Listing`).
- **This week** delta — requires snapshots.

**New table:**

```prisma
model ListingMetricsSnapshot {
  id         String   @id @default(cuid())
  listingId  String
  listing    Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  capturedAt DateTime @default(now())
  viewCount  Int
  likeCount  Int

  @@index([listingId, capturedAt])
}
```

**Weekly job:**

1. For each digest recipient, load active listings.
2. Load **latest snapshot before `now - 7 days`** per listing (or snapshot taken at **last digest
   send** — store `User.lastSellerDigestAt`).
3. `viewsThisWeek = viewCount - snapshot.viewCount` (floor 0).
4. After sending, insert new snapshots for all included listings (or one batch snapshot timestamp).

**User cursor:**

```prisma
// on User
lastSellerDigestAt DateTime?
```

### D.4 Message shape

**Email (HTML-lite or plain text):**

```
Your Bhavano weekly summary

• "2BHK Koramangala" — 42 views (+12 this week), 3 favourites (+1)
• "Office MG Road" — 8 views (+0), 0 favourites

Tip: Boost your top ad to reach more buyers → [My listings]

— Bhavano
```

**SMS (if no email):** truncate to 1–2 listings + “+N more on Bhavano” + short URL.

### D.5 Implementation

1. `NotificationsService.notifyWeeklySellerDigest(user, rows: DigestRow[])`.
2. `WeeklySellerDigestJob` — `@Cron` Monday 09:00 IST; query owners with active listings; group by
   `ownerId`; compute deltas; dispatch; update `lastSellerDigestAt` + snapshots in a transaction
   per user (or per batch).
3. Guard: if `lastSellerDigestAt` within 6 days, skip (safety against double cron on multi-instance
   — use DB transaction with row lock on `User` or insert `SellerDigestLog` with unique
   `(userId, weekStart)`).

```prisma
model SellerDigestLog {
  id        String   @id @default(cuid())
  userId    String
  weekStart DateTime // Monday 00:00 IST as UTC instant
  sentAt    DateTime @default(now())

  @@unique([userId, weekStart])
}
```

### D.6 Multi-instance safety

BFF may run **2+ replicas** (`docs/PRD.md`). Cron must be **single-flight**:

- Option A: PostgreSQL advisory lock in job (`pg_try_advisory_lock`).
- Option B: rely on `SellerDigestLog` / `ListingNotificationLog` unique constraints + accept rare
  duplicate email (worse).

**Recommend Option A** in `seller-jobs.module.ts` base helper.

### D.7 Verification

- Two listings with known view counts; fake snapshot from 7d ago → digest shows correct deltas.
- Email-only user → no SMS.
- Phone-only → SMS, under length limit.
- Second cron same week → no send (`SellerDigestLog`).

---

## Part E — Module layout & dependencies

```
apps/bff/src/
  listing-slots/
    listing-slots.service.ts      # allowance + assertCanPublish + activeCount
    listing-slots.module.ts
  seller-jobs/
    seller-jobs.module.ts
    listing-expiry-reminder.job.ts
    weekly-seller-digest.job.ts
    job-lock.service.ts           # advisory lock wrapper
  notifications/
    notifications.service.ts      # + expiry + digest methods; + dispatchEmailOrSms()
```

Import `SellerJobsModule` from `AppModule`. `ListingSlotsModule` imported by `ListingsModule`,
`PaymentsModule`, `UsersModule` (profile).

---

## Part F — Rollout order

| Phase | Deliverable |
|-------|-------------|
| **1** | `listingSlots` types + `ListingSlotsService` + create guard; remove publish rate limit; profile fields |
| **2** | `sellerSlotPack` + `agentProUnits` payments/webhook; `/premium` UI; slot meter |
| **3** | Pro monthly boost credit |
| **4** | Expiry reminder job + `ListingNotificationLog` |
| **5** | Weekly digest + snapshots + `SellerDigestLog` |
| **6** | Admin: manual grant slot pack / Pro units (mirror boost grant) |

---

## Part G — Explicitly out of scope (this plan)

- Paid **listing renewal** (extend `expiresAt` for ₹X) — natural follow-up upsell after Part C.
- In-app **system chat** messages for expiry (use SMS fallback per user request).
- Mobile purchase UI for seller pack (web-first, same as boosts).
- Changing boost price to flat ₹99 (product decision; not required for slots).

---

## Critical files to touch

| Area | Files |
|------|--------|
| Schema | `apps/bff/prisma/schema.prisma` (+ migration) |
| Slots | new `packages/types/src/listingSlots.ts`, `listing-slots.service.ts` |
| Listings | `apps/bff/src/listings/listings.service.ts` (create), `listings.controller.ts` |
| Rate limit | `apps/bff/src/rate-limit/rate-limit.service.ts` |
| Payments | `apps/bff/src/payments/payments.service.ts`, `subscriptionPricing.ts`, `packages/types/src/index.ts` |
| Notifications | `apps/bff/src/notifications/notifications.service.ts` |
| Jobs | new `apps/bff/src/seller-jobs/*` |
| Web | `apps/web/src/app/premium/page.tsx`, `my-listings/page.tsx`, `PostAdWizard`, profile types in `bff.ts` |

---

## Cross-reference

- Supersedes **seller posting limits** in `docs/plans/monetization-boosted-listings-premium-tiers.md` Phase 3 only; Phases 1–2 (boost, buyer premium) remain.
- Channel fallback aligns with contact capture goals in `docs/plans/welcome-notification-and-profile-completion.md` (encourage email on profile for richer digests).
