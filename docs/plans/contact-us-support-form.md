# Contact Us support form → support@bhavano.com

## Why

`/contact` today is a static page whose "Get in touch" section is a `mailto:` link. That has
three costs:

1. **It drops people out of the product.** They have to switch to an email client, compose from
   a blank message, and remember what to include. The page even has a "What to include" section
   listing what support needs — which is a form asking to be written.
2. **Reports arrive unstructured.** Nothing guarantees a listing URL, payment ID, or the phone
   number on the account. Support's first reply is usually a request for the missing detail.
3. **Nothing is recorded.** A `mailto:` leaves no trace in our systems, so there is no way to
   count issue types, spot a spike after a release, or find a report someone says they sent.
4. **Screenshots are the whole report, for UI bugs.** "The photo upload button does nothing" is
   unactionable; the same message with a screenshot usually diagnoses itself. A `mailto:` link
   technically allows attachments but only if the user thinks to add them, and nothing prompts
   for one.

A form fixes all three and routes to `support@bhavano.com` (`LEGAL_ENTITY.supportEmail`).

## Current state (verified)

| Thing | State |
|---|---|
| `apps/web/src/app/contact/page.tsx` | Server Component, exports `metadata`, renders `StaticPageLayout` + `PageSection`. `mailto:` link only — no form |
| Email sending | `apps/bff/src/notifications/providers/email.provider.ts` — Resend. `send(to, subject, text)`; **no `replyTo`** |
| Email failure behaviour | **Best-effort by design** — logs and returns; never throws (see its doc comment) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | On the **bff service only** (`docker-compose.prod.yml`), not on `web` |
| Server action pattern | `"use server"` in `apps/web/src/app/actions/*.ts` → `apps/web/src/lib/bff.ts` → bff |
| Public endpoint pattern | `apps/bff/src/auth/auth.controller.ts` — `@Throttle({ default: { limit: 3, ttl: 60_000 } })` on OTP send |
| Validation pattern | `class-validator` DTOs, e.g. `auth/dto/send-otp.dto.ts` |
| Support address | `packages/types/src/legalEntity.ts` → `supportEmail: "support@bhavano.com"` |
| Ticket persistence | **None** — no `SupportTicket`-like model in `apps/bff/prisma/schema.prisma` |
| Object storage | `apps/bff/src/storage/r2-storage.service.ts` — `putObject/getObject/deleteObject`, generic, exported from `StorageModule`. **Reusable as-is** |
| Existing upload endpoint | `apps/bff/src/uploads/uploads.controller.ts` — **not** reusable: `@UseGuards(AuthGuard)`, keyed to `listingId`/`photoNo` via `photo-keys.ts`, and computes a dHash for listing dedupe |
| Next.js server action body limit | **1 MB (the default)** — `apps/web/next.config.ts` sets no `serverActions.bodySizeLimit` |
| CDN | `cdn.bhavano.com` fronts the R2 bucket (`next.config.ts` `remotePatterns`) — anything written to that bucket is potentially fetchable by key |
| Deps already present in bff | `sharp`, `multer`, `resend`, `@nestjs/schedule` (cron jobs exist, e.g. `seller-jobs/listing-expiry-reminder.job.ts`) |

Two facts above drive the design: Resend credentials live only on the bff, so the submission
**must** route web → bff; and the email provider deliberately swallows failures, so email alone
would silently lose reports.

## Design decisions

**1. `/contact` stays a Server Component; the form is a client leaf.**
Per `.claude/CLAUDE.md`, marking the page `"use client"` would pull it out of the RSC output and
risk its `metadata` export. So `page.tsx` is untouched apart from rendering `<ContactForm />`,
a new `"use client"` component. All existing copy stays server-rendered and crawlable.

**2. Persist first, email second.**
`EmailProvider.send()` logs and returns on failure rather than throwing — correct for the
moderation notifications it was built for, wrong for a user's only copy of a bug report. The row
is written before the send is attempted, so a Resend outage degrades to "we have it, support
didn't get pinged" rather than losing it. This is the main reason for a DB model rather than a
pure email relay.

**3. Public and unauthenticated.**
"I can't log in" is one of the topics. Requiring auth would exclude exactly the people who most
need the form. That makes abuse protection load-bearing — see step 3.

**4. Prefill, don't require, identity.**
When a session exists, prefill name/email/phone and attach `userId` to the row. Logged-out users
supply an email so support can reply.

**5. `replyTo` the reporter.**
Support should be able to hit Reply. Requires adding an optional `replyTo` to `EmailProvider`.

**6. Attachments are delivered as email attachments, not as links.**
The R2 bucket is fronted by `cdn.bhavano.com`. Writing anonymous uploads there and mailing out
URLs would turn the form into public file hosting — the classic abuse of an unauthenticated
upload. Instead the files ride along on the email itself (Resend supports attachments), and the
R2 copy is a private durable record that is never linked publicly. 3 x 5 MB is comfortably inside
Resend's per-message ceiling.

**7. Images only for v1, and every image is re-encoded.**
A client-declared MIME type is trivially spoofed, and the existing photo controller trusts
`file.mimetype` — safe behind `AuthGuard`, not safe anonymously. Support attachments are sniffed
by magic bytes and then re-encoded through `sharp`, which strips EXIF (location data users did
not mean to send) and neutralises polyglot files by construction. PDFs cannot be neutralised that
way, so they are deferred rather than accepted — see out of scope.

---

## Step 1 — Shared types

**File:** `packages/types/src/support.ts` (exported from the package index)

Attachment limits live here too, so the form's client-side check and the bff's multer config
cannot drift: `MAX_ATTACHMENTS = 3`, `MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024`,
`MAX_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024`, `ACCEPTED_ATTACHMENT_MIME_TYPES`.

```ts
export const CONTACT_TOPICS = [
  "posting",        // trouble posting or editing an ad
  "subscription",   // subscription, boost, or payment problem
  "account",        // login / OTP / profile
  "listing_report", // reporting someone else's listing
  "website",        // bug, broken page, something looks wrong
  "other",
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export interface CreateSupportTicketInput {
  topic: ContactTopic;
  name: string;
  email: string;
  phone?: string;
  listingUrl?: string;   // shown for posting / listing_report
  paymentId?: string;    // shown for subscription
  message: string;
}
```

Keeping the topic list in `@bhavano/types` means the form's `<select>`, the DTO's `@IsIn`, and
the Prisma enum can't drift apart.

## Step 2 — Persistence

**File:** `apps/bff/prisma/schema.prisma`

```prisma
enum ContactTopic {
  posting
  subscription
  account
  listing_report
  website
  other
}

model SupportTicket {
  id         String       @id @default(cuid())
  topic      ContactTopic
  name       String
  email      String
  phone      String?
  listingUrl String?
  paymentId  String?
  message    String       @db.Text
  userId     String?      // set when submitted while logged in
  user       User?        @relation(fields: [userId], references: [id])
  emailSent  Boolean      @default(false)
  userAgent  String?
  ipHash     String?      // hashed, not raw — abuse triage without storing an IP
  createdAt  DateTime     @default(now())

  @@index([createdAt])
  @@index([topic])
}

model SupportAttachment {
  id        String        @id @default(cuid())
  ticketId  String
  ticket    SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  r2Key     String        // e.g. support/<ticketId>/1.webp — never served publicly
  mimeType  String
  bytes     Int
  createdAt DateTime      @default(now())

  @@index([ticketId])
}
```

`SupportTicket` gains `attachments SupportAttachment[]`. Add the back-relation on `User`. Migration: `npx prisma migrate dev --name support_tickets`,
applied in prod with `migrate deploy` per `docs/deployment.md`.

`ipHash` rather than a raw IP keeps rate-limit forensics possible without holding personal data
we have no reason to keep — relevant to the privacy policy the site already publishes.

## Step 3 — BFF support module

**Files:** `apps/bff/src/support/{support.module.ts,support.controller.ts,support.service.ts,dto/create-support-ticket.dto.ts}`

DTO, mirroring `send-otp.dto.ts`'s style, with caps that bound abuse:

| Field | Rule |
|---|---|
| `topic` | `@IsIn(CONTACT_TOPICS)` |
| `name` | `@IsString() @Length(1, 100)` |
| `email` | `@IsEmail() @Length(1, 200)` |
| `phone` | optional, `@Matches(/^[6-9]\d{9}$/)` — same rule as the auth DTO |
| `listingUrl` | optional, `@IsString() @Length(0, 500)` |
| `paymentId` | optional, `@IsString() @Length(0, 100)` |
| `message` | `@IsString() @Length(20, 4000)` |
| `website` | honeypot — must be empty; see below |

Controller:

```ts
@Post('support/tickets')
@HttpCode(201)
@Throttle({ default: { limit: 3, ttl: 60_000 } })   // matches auth OTP send
```

Three layers of abuse protection, because this is an unauthenticated endpoint that causes an
email to be sent:

1. **`@Throttle` 3/minute per IP** — the same budget as OTP send.
2. **Honeypot field** named `website`, hidden via CSS in the form. Bots fill every input; humans
   never see it. Non-empty → return `201` as if accepted, persist nothing, send nothing. Silence
   beats an error, which just tells a bot to retry differently.
3. **Minimum dwell time** — the form stamps mount time and the action rejects submissions under
   ~3 seconds. Catches naive scripted posts without a CAPTCHA.

Service, in order: validate → write `SupportTicket` → attempt email → set `emailSent`. The email:

- **To:** `LEGAL_ENTITY.supportEmail`
- **Subject:** `[Bhavano support] <topic label> — <name>`
- **Reply-To:** the reporter's email
- **Body:** every field, plus the ticket id, `userId` when present, and the listing URL /
  payment ID when supplied

Returns `{ ticketId }`. Deliberately **not** returning whether the email succeeded — the user's
report is safe either way, and exposing infrastructure state to an anonymous caller adds nothing.

## Step 4 — `EmailProvider` gains `replyTo`

**File:** `apps/bff/src/notifications/providers/email.provider.ts`

```ts
async send(to: string, subject: string, text: string, options?: { replyTo?: string }): Promise<void>
```

Optional and passed straight through to Resend, so all existing callers are unaffected.

## Step 5 — Web wiring

- **`apps/web/src/lib/bff.ts`** — `submitSupportTicket(input): Promise<{ ticketId: string }>`,
  following the existing unauthenticated-call shape (no `accessToken`).
- **`apps/web/src/app/actions/support.ts`** — `"use server"`,
  `submitSupportTicketAction(input)` returning the codebase's usual
  `{ success: true; ticketId } | { success: false; error }`. Reads `auth()` and forwards
  `userId` when a session exists.

## Step 6 — The form component

**File:** `apps/web/src/components/home/ContactForm.tsx` (`"use client"`)

Follows `ProfileForm.tsx`'s conventions: local `useState` per field, a `pending` flag, and a
`message: { type: "success" | "error"; text }` for feedback.

Behaviour:

- **Topic-conditional fields** — `listingUrl` shows for `posting` / `listing_report`;
  `paymentId` for `subscription`. Avoids a wall of irrelevant inputs.
- **Prefill** from the session's profile when logged in; `email` read-only if verified.
- **Client-side validation** mirroring the DTO, so mistakes surface without a round trip. The
  server stays the authority.
- **Success state** replaces the form with a confirmation showing the ticket id and the
  `support@bhavano.com` address as a fallback route.
- **Accessibility** — real `<label>`s, `aria-describedby` on errors, `aria-live` on the result.

**`apps/web/src/app/contact/page.tsx`** — add one `PageSection` rendering `<ContactForm />`,
above the existing "What to include" section, and reword the mailto paragraph to present email
as the alternative rather than the only route. Nothing else changes: `metadata` export,
`StaticPageLayout`, and all existing copy stay exactly as they are.

## Step 7 — Attachments

### 7.1 What's reusable

`R2StorageService` is generic (`putObject(key, body, contentType)`) and already exported from
`StorageModule` — import it into the support module and use it directly. The *uploads controller*
is not reusable: it is `@UseGuards(AuthGuard)`, keys objects by `listingId`/`photoNo`, and
computes a dHash for listing dedupe. None of that applies here, so the support module gets its
own handling rather than bending that endpoint.

Key convention, mirroring `photo-keys.ts`: `support/<ticketId>/<n>.webp`.

### 7.2 Limits

| | |
|---|---|
| Count | max **3** files |
| Size | max **5 MB** each, **10 MB** total per submission |
| Types accepted | JPEG, PNG, WebP, GIF, HEIC |
| Stored as | WebP, always re-encoded, max 2000px on the long edge |

### 7.3 Validation — do not trust the client

In order, rejecting at the first failure:

1. **Multer limits** (`fileSize`, `files: 3`) with `memoryStorage()`, as the photo controller does.
2. **Magic-byte sniff** on the buffer — the real format, not `file.mimetype`, which the client
   controls. Reject anything not on the allowlist.
3. **`sharp(buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside' }).webp()`** —
   re-encode unconditionally. This is the security step, not just a size optimisation: it strips
   EXIF (including GPS coordinates a user did not realise were in their screenshot) and makes
   polyglot files (a valid image that is also a valid script/archive) structurally impossible.
   A file that fails to decode is rejected.

### 7.4 Transport — the 1 MB wall

`next.config.ts` sets no `serverActions.bodySizeLimit`, so server actions cap request bodies at
**1 MB**. A 5 MB screenshot fails there before reaching any of our code. Two options:

- **(a) Raise the limit** — `experimental: { serverActions: { bodySizeLimit: '12mb' } }`, and post
  the whole form as one `FormData` through the existing server action. Simplest, one round trip,
  atomic: no ticket without its files, no orphaned objects. Cost: the web container buffers up to
  12 MB per submission in memory.
- **(b) Direct-to-bff upload** — a separate `POST /support/attachments` returning keys, which the
  form then submits with the ticket. Keeps the web app thin, but adds a second endpoint to
  rate-limit, plus orphaned objects to reap when someone uploads and abandons the form.

**Recommend (a).** Volume on a support form is low, the cap is bounded, and the atomicity is worth
more than the memory. Revisit only if attachment sizes grow.

### 7.5 Delivery

`EmailProvider.send()` gains an optional `attachments` array alongside `replyTo`, passed through
to Resend as `{ filename, content }` (base64). Support receives the screenshots inline — no link
to leak, no public bucket exposure.

R2 keeps the durable copy so the record survives an email failure, consistent with decision 2.

### 7.6 Retention

Support attachments are user-submitted content we hold only to resolve a ticket. A
`@nestjs/schedule` cron in the support module (following `seller-jobs/listing-expiry-reminder.job.ts`)
deletes R2 objects and their `SupportAttachment` rows after **90 days**, leaving the ticket text
intact. Without this, an anonymous upload endpoint accumulates storage forever.

### 7.7 Form UI

A file input accepting `image/*` with `multiple`, showing selected filenames and sizes with a
remove control, and client-side rejection of oversized/too-many files before submit so the user
gets an instant answer. Total-size counter next to the input. On mobile this surfaces the camera
roll, which is where the screenshot already is.

## Step 8 — Track it

On success, `pushDataLayerEvent("contact_form_submit", { topic })`. The GTM container built in
`consolidate-analytics-and-ads-on-gtm.md` already has a `DLV - category` pattern; this needs a
`DLV - topic` variable, a `CE - contact_form_submit` trigger, and a GA4 event tag — a
`gtm_build.py` addition plus a publish, no app deploy beyond the event push itself.

Not an Ads conversion: a support request is a cost signal, not something to bid toward.

## Step 9 — Tests

- **BFF unit** (`support.service.spec.ts`): persists before emailing; `emailSent` false when the
  provider fails, and the row still exists; honeypot path writes nothing.
- **Attachment validation** (`support.attachments.spec.ts`): a `.png`-named file whose magic
  bytes are a ZIP is rejected; a valid JPEG is re-encoded to WebP with EXIF stripped; a 4th file
  and an oversized file are both rejected; a truncated/corrupt image is rejected rather than
  crashing `sharp`.
- **BFF e2e**: validation rejections; `@Throttle` returns 429 on the 4th call in a minute.
- **Web e2e** (Playwright, `apps/web/e2e/`): fill and submit, assert the success state; assert
  conditional fields appear per topic.

## Verification

1. Locally with `RESEND_API_KEY` unset — the provider logs and skips, so confirm the ticket row
   is still written and the user still sees success. This is the degradation path that matters.
2. With a real key, submit one of each topic; confirm arrival at `support@bhavano.com` and that
   **Reply** addresses the reporter, not the from-address.
3. `curl` the endpoint 4× in a minute → the 4th returns 429.
4. Submit with the honeypot filled → 201, no row, no email.
5. Attach a screenshot with GPS EXIF; confirm it arrives at support as WebP and that
   `exiftool` on the received file shows no GPS block.
6. Attach a renamed non-image (`mv payload.zip shot.png`) → rejected.
7. ~~Confirm the R2 key is not reachable at the CDN~~ — **checked on 2026-08-27, and it IS
   reachable.** `https://cdn.bhavano.com/support/<key>` returned `200`. See the open issue below.
5. Lighthouse/PSI on `/contact` before and after — the client component is a leaf, so LCP should
   be unchanged. Confirm `metadata` still renders in view-source.

## Out of scope

- **PDF and document attachments** — images are made safe by re-encoding them; a PDF cannot be,
  so accepting one means either running a scanner or asking support to open untrusted files.
  Images cover the screenshot case that motivates this, and payment receipts are usually
  screenshots on mobile anyway. Revisit with a real AV step (ClamAV sidecar or an API) if users
  actually ask.
- **Virus scanning** — not needed while the allowlist is images-that-get-re-encoded. It becomes
  mandatory the moment any format is accepted that is passed through untouched.
- **In-app ticket status or threaded replies** — email is the reply channel for v1.
- **Admin UI** — the `apps/admin` app could list tickets later; for v1 they're readable in the
  DB and every one is emailed.
- **Auto-responder to the reporter** — easy to add once volume justifies it.
- **CAPTCHA** — the three layers in step 3 should hold. Revisit only if spam actually appears;
  reCAPTCHA costs real conversion and adds a third-party script to a page we keep lean for SEO.

## Rollback

Additive throughout: one new page section, one new bff module, two new tables. Reverting the web
commit restores the mailto-only page; the table can stay (harmless) or be dropped by a follow-up
migration. No routing, rendering-strategy, or metadata changes, so no SEO surface is at risk.

---

## OPEN ISSUE — support attachments are publicly readable

Verified in production on 2026-08-27: an uploaded attachment is fetchable at
`https://cdn.bhavano.com/support/<key>` and returns `200`. The R2 bucket that backs the CDN is
public, and the support module writes into it.

This is worse than a guessable-key problem. The submission confirmation shows the reporter their
own ticket id ("Your reference is cmtb…"), so under the original `support/<ticketId>/1.webp`
convention an uploader could construct their own file's public URL immediately — which is
functioning file hosting on the CDN, reachable by anyone, from an endpoint that requires no
login.

**Mitigated, not fixed:** keys now carry 16 random bytes that are never disclosed
(`support/<ticketId>-<32 hex>/1.webp`), so holding the ticket id is no longer enough. Objects
already uploaded under the old convention remain predictable and should be deleted.

**The actual fix is at the CDN**, and it needs dashboard access:

- **Preferred** — a Cloudflare rule on `cdn.bhavano.com` blocking any path starting `/support/`.
  One rule, no code, and it closes the hole for every past and future object.
- **Alternative** — move support attachments to a separate, non-public R2 bucket. Cleaner
  separation, but needs a second bucket plus its own credentials in the bff config.

Until one of those is in place, treat attachments as public-if-the-key-leaks. The email path is
unaffected: files reach support as email attachments and no URL is ever published.
