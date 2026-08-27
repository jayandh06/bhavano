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

---

## Step 1 — Shared types

**File:** `packages/types/src/support.ts` (exported from the package index)

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
```

Add the back-relation on `User`. Migration: `npx prisma migrate dev --name support_tickets`,
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

## Step 7 — Track it

On success, `pushDataLayerEvent("contact_form_submit", { topic })`. The GTM container built in
`consolidate-analytics-and-ads-on-gtm.md` already has a `DLV - category` pattern; this needs a
`DLV - topic` variable, a `CE - contact_form_submit` trigger, and a GA4 event tag — a
`gtm_build.py` addition plus a publish, no app deploy beyond the event push itself.

Not an Ads conversion: a support request is a cost signal, not something to bid toward.

## Step 8 — Tests

- **BFF unit** (`support.service.spec.ts`): persists before emailing; `emailSent` false when the
  provider fails, and the row still exists; honeypot path writes nothing.
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
5. Lighthouse/PSI on `/contact` before and after — the client component is a leaf, so LCP should
   be unchanged. Confirm `metadata` still renders in view-source.

## Out of scope

- **File/screenshot attachments** — needs upload plumbing and a virus-scanning story; the
  listing photo pipeline is not reusable here as-is.
- **In-app ticket status or threaded replies** — email is the reply channel for v1.
- **Admin UI** — the `apps/admin` app could list tickets later; for v1 they're readable in the
  DB and every one is emailed.
- **Auto-responder to the reporter** — easy to add once volume justifies it.
- **CAPTCHA** — the three layers in step 3 should hold. Revisit only if spam actually appears;
  reCAPTCHA costs real conversion and adds a third-party script to a page we keep lean for SEO.

## Rollback

Additive throughout: one new page section, one new bff module, one new table. Reverting the web
commit restores the mailto-only page; the table can stay (harmless) or be dropped by a follow-up
migration. No routing, rendering-strategy, or metadata changes, so no SEO surface is at risk.
