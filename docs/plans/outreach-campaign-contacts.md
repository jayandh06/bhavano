# Outreach contacts + SMS/WhatsApp campaign data model

## Context

The admin panel needs to run promotional SMS/WhatsApp campaigns to prospective and existing
customers on a recurring interval. Contacts come from **multiple external sources** (Google Maps
Places API, scraping, manual upload) — not from signup — so they are prospects, not `User` rows.
We need to store what we know about each contact, when we last promoted to them, and the full
history of what was sent.

Three decisions were confirmed before designing this:

- **Prospects live in their own `OutreachContact` model**, not on `User`. `User` is load-bearing
  for auth, listings, payments, subscriptions and messaging; adding non-authenticating marketing
  rows to it would leak prospects into every existing `User` query. A nullable `userId` link
  captures the moment a prospect *becomes* a real user (conversion attribution).
- **Send history is `OutreachCampaign` + `CampaignSend`**, one row per contact per campaign —
  the same audit-trail shape the schema already uses for `ListingBoost` and `ListingRenewal`,
  with a denormalized `lastContactedAt` on the contact for cheap reads.
- **Consent and opt-out are modelled in the schema**, not deferred. Indian marketing SMS is
  subject to TRAI/DLT rules; sending to a scraped number without consent handling is a legal and
  deliverability risk, not just a product gap.

## Design

### 1. `OutreachContact` — who we might contact

Requested fields plus the ones worth adding (marked **+**):

```prisma
model OutreachContact {
  id                String              @id @default(cuid())
  name              String
  phone             String?
  /** + E.164 (+91XXXXXXXXXX), derived from `phone` on write. Dedupe and suppression both key
   * off this, never the raw string — the same number arrives formatted a dozen ways. */
  phoneE164         String?
  email             String?
  address           String?
  lat               Float?
  lng               Float?
  /** + Reuse the existing City/Area geography so campaigns can target "agents in Pune" with the
   * same vocabulary the listing side already uses, instead of free-text matching on `address`. */
  cityId            String?
  city              City?               @relation(fields: [cityId], references: [id])
  areaId            String?
  area              Area?               @relation(fields: [areaId], references: [id])

  googleRating      Float?
  googleReviewCount Int?
  /** + Ratings drift, so a bare rating with no as-of date is unreadable six months later. */
  googleRatingAt    DateTime?
  /** + The natural dedupe key for anything Maps-sourced; unique so re-running a scrape upserts
   * rather than duplicates. */
  googlePlaceId     String?             @unique
  /** + "real_estate_agency", "property_management" — the primary targeting dimension. */
  businessCategory  String?
  website           String?

  source            ContactSource
  /** + The query/URL/file that produced this row, so a bad import can be traced and undone. */
  sourceRef         String?
  status            ContactStatus       @default(new)
  /** + Free-form segmentation without a schema change per campaign idea. */
  tags              String[]            @default([])
  notes             String?

  consentState      ConsentState        @default(none)
  consentSource     String?
  consentAt         DateTime?
  optedOutAt        DateTime?

  /** Denormalized from CampaignSend for list views and "don't contact more than once a
   * fortnight" checks — CampaignSend remains the audit trail. Same pattern as
   * Listing.boostedUntil vs ListingBoost. */
  lastContactedAt   DateTime?
  contactedCount    Int                 @default(0)

  /** + Set once a prospect signs up — the only link between outreach spend and real users. */
  userId            String?             @unique
  user              User?               @relation(fields: [userId], references: [id])

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  sends             CampaignSend[]

  @@index([cityId, businessCategory])
  @@index([phoneE164])
  @@index([status])
}

enum ContactSource { google_maps  scrape  manual_upload  referral }
enum ContactStatus { new  enriched  contacted  engaged  converted  invalid  bounced }
enum ConsentState  { none  implied  explicit  opted_out }
```

### 2. `OutreachCampaign` + `CampaignSend` — what was sent, to whom, when

```prisma
model OutreachCampaign {
  id            String         @id @default(cuid())
  name          String
  channel       OutreachChannel
  status        CampaignStatus @default(draft)
  /** Message body with {{name}}/{{city}} placeholders resolved per contact at send time. */
  bodyTemplate  String
  subject       String?
  /** DLT-approved template ID — MSG91 rejects non-registered marketing templates in India, so
   * this is required to send on sms/whatsapp (see Msg91Provider's existing note). */
  dltTemplateId String?
  /** Audience selection (city, category, tags, rating floor) stored as a filter rather than a
   * frozen contact list, so a recurring campaign picks up newly imported matches. */
  audienceFilter Json          @default("{}")
  /** Cron expression for recurring sends; null means one-shot at scheduledAt. */
  cadenceCron   String?
  scheduledAt   DateTime?
  lastRunAt     DateTime?
  /** Guard rails: cap per run, and never re-contact the same person within N days. */
  maxSendsPerRun    Int        @default(200)
  minDaysBetweenSends Int      @default(14)
  createdById   String
  createdBy     User           @relation(fields: [createdById], references: [id])
  createdAt     DateTime       @default(now())
  sends         CampaignSend[]
}

model CampaignSend {
  id           String       @id @default(cuid())
  campaignId   String
  campaign     OutreachCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contactId    String
  contact      OutreachContact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  channel      OutreachChannel
  status       SendStatus   @default(queued)
  /** Provider message id, for reconciling delivery webhooks back to this row. */
  providerRef  String?
  /** Exact body after placeholder resolution — what was actually sent, for dispute/audit. */
  renderedBody String
  sentAt       DateTime?
  deliveredAt  DateTime?
  failureReason String?
  createdAt    DateTime     @default(now())

  /** Idempotency: one send per contact per campaign *run*. Mirrors ListingNotificationLog's
   * @@unique([listingId, kind]) — a crashed or retried job can't double-send. For recurring
   * campaigns include the run key so each scheduled run is its own attempt. */
  @@unique([campaignId, contactId, runKey])
  @@index([contactId, sentAt])
}

enum OutreachChannel { sms  whatsapp  email }
enum CampaignStatus  { draft  scheduled  running  paused  completed }
enum SendStatus      { queued  sent  delivered  failed  suppressed  opted_out }
```

`runKey` is a `String` on `CampaignSend` (e.g. `2026-07-30` for a daily cadence, or `once`) —
it makes the unique constraint the idempotency guarantee for recurring campaigns.

### 3. `SuppressionEntry` — opt-out that survives re-import

The critical piece: if opt-out lived only on `OutreachContact`, the next Maps scrape would create
a fresh row for the same business and start messaging them again.

```prisma
model SuppressionEntry {
  id        String          @id @default(cuid())
  /** phoneE164 or lowercased email — matched before every send, independent of contact rows. */
  value     String          @unique
  channel   OutreachChannel?
  reason    String
  createdAt DateTime        @default(now())
}
```

Every send path checks `SuppressionEntry` and `consentState != opted_out` before dispatch, and
records `status: suppressed` (rather than skipping silently) so the campaign report explains the
gap between audience size and messages sent.

### 4. Sending: a cron job in the existing `seller-jobs` shape

`OutreachCampaignJob` follows `ListingExpiryReminderJob` exactly — `@Cron` with
`timeZone: 'Asia/Kolkata'`, a `running` re-entrancy guard, per-contact try/catch so one failure
doesn't abort the batch. Each tick: find due campaigns → resolve `audienceFilter` to contacts →
exclude suppressed / recently-contacted / opted-out → create `CampaignSend` rows → dispatch via
a new `OutreachProvider` (MSG91 marketing endpoint, distinct from the existing transactional
`sendTransactionalSms`) → update `lastContactedAt`/`contactedCount`.

### 5. Admin surface

`apps/admin` already has `listings`, `users`, `boosts`, `logins`, `settings`. Add:
- `/contacts` — searchable/filterable list, import (CSV + "pull from Google Maps" by city+category),
  per-contact drawer showing the full `CampaignSend` timeline.
- `/campaigns` — create/schedule/pause, audience preview with a live count before sending, and a
  per-campaign report (queued/sent/delivered/failed/suppressed).

BFF routes go under the existing `AdminController` + `AdminGuard`, so admin-only access reuses
what's already tested in `auth.guard.spec.ts`.

## Compliance notes (not optional for Indian SMS)

- Marketing SMS requires a **DLT-registered template**; `dltTemplateId` is enforced at campaign
  activation, not send time, so a misconfigured campaign fails loudly before it burns an audience.
- Every marketing message must carry an opt-out instruction; the rendered body template is
  validated for it.
- Google Maps Places data is licensed — scraped/derived contact data has terms attached. Worth a
  legal check before large-scale outreach, and `sourceRef` keeps provenance auditable.
- Prefer `consentState: explicit` audiences where possible; `implied` (existing customers) is a
  much weaker footing for promotional content than for transactional.

## Verification

- `pnpm --filter @bhavano/bff prisma migrate dev --name add_outreach_contacts`.
- Unit specs alongside the new service (repo convention, mocked `PrismaService`): suppression
  blocks a send; `minDaysBetweenSends` excludes a recently-contacted contact; the
  `@@unique([campaignId, contactId, runKey])` constraint makes a re-run idempotent; opted-out
  contacts record `status: suppressed` rather than being silently dropped.
- Dry-run mode on the job (log intended sends without dispatching) verified against a seeded
  contact set before any real send.
- Manual: import ~20 Maps contacts for one city, run a campaign in dry-run, confirm the audience
  count and per-contact rendered bodies, then enable for a small real batch.

## Open questions

- Which WhatsApp provider — MSG91 also does WhatsApp Business, which would avoid a second
  integration, but Gupshup/Meta Cloud API are alternatives worth pricing.
- Whether delivery webhooks are needed in v1 (`deliveredAt`/`providerRef` support them, but the
  first version can ship with `sent` as the terminal state).
