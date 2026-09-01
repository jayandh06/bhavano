# Do we know what we sent, and should views/likes notify owners in real time?

> **Status: implemented.** Every `notify*` method in `NotificationsService` now dispatches
> email-else-WhatsApp (never both, no SMS) and returns which channel actually delivered; every
> call site logs that result to `ListingNotificationLog` or `UserNotificationLog`. See commits
> `f381826`, `3b35806`, `60e83da`. The correction below (originally about `ListingNotificationLog`
> being unused) is left in place as a record of the mistake, not as still-open work.

## Direct answer to "do we track this today"

**No, not reliably, for any of it.** Three separate findings:

### 1. Welcome — a timestamp, not a delivery record

`User.welcomedAt` is the only signal, and it answers a different question than "did we send the
email." `AuthService.welcomeIfFirstLogin` marks it **before the send even starts**:

```ts
if (user.welcomedAt) return;
await this.prisma.user.update({ where: { id: user.id }, data: { welcomedAt: new Date() } });
void this.notificationsService.notifyWelcome(user);   // fire-and-forget, not awaited
```

So `welcomedAt` means "we decided not to try again," not "a message arrived." If SMTP was down
or WhatsApp was misconfigured at that exact moment, the row still gets stamped and that user is
never retried, silently.

### 2. The channel rule isn't what "priority" implies

The phrase "email (priority over SMS)" doesn't match what `notifyWelcome` actually does. It fires
**every channel the user has, simultaneously** — not email-first-else-SMS:

```ts
await Promise.all([
  user.email ? emailProvider.send(...)        : Promise.resolve(),
  user.phone ? msg91.sendTransactionalSms(...) : Promise.resolve(),
  user.phone && welcomeTemplate ? whatsapp.sendTemplate(...) : Promise.resolve(),
]);
```

A user who signed up with both an email and a phone gets three separate welcome messages today —
email, SMS, and WhatsApp all at once. **Decided:** this changes to match `notifyListingPosted`'s
rule exactly — email if present, else WhatsApp, never both, and never SMS. SMS is reserved for
OTP alone from here on; every notification (as opposed to an authentication code) goes out over
email or WhatsApp only. See "The channel rule, decided" below for what this actually touches.

### 3. Listing acknowledgement — zero tracking, despite a table built for it

`notifyListingPosted`'s result (`'email' | 'whatsapp' | null`) is fire-and-forget and the value is
never read:

```ts
this.notificationsService.notifyListingPosted(owner!, {...}).catch(() => undefined);
```

Nothing is written anywhere recording that an acknowledgement was attempted, succeeded, or which
channel carried it.

**And here's the part worth knowing:** `ListingNotificationLog` already exists in the schema —

```prisma
model ListingNotificationLog {
  id        String   @id @default(cuid())
  listingId String
  listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  kind      String
  channel   String
  sentAt    DateTime @default(now())
  @@unique([listingId, kind])
  @@index([sentAt])
}
```

— shaped exactly for "was this kind of notification sent for this listing, and how."

**Correction:** an earlier version of this document claimed this table had "zero references
anywhere in application code." That was wrong — a grep for the PascalCase model name
`ListingNotificationLog` missed the camelCase Prisma delegate `this.prisma.listingNotificationLog`
that `ListingExpiryReminderJob` already used correctly, both to write a row after a successful
send and to query `notificationLogs: { none: { kind } }` before sending again. So the table
wasn't unused — it just wasn't wired into anything *other than* the expiry-reminder job, which is
what this plan (now implemented) extended to every other notification.

## What you're actually asking for, part two: like/view notifications for paid advertisers

### Likes — this already exists, partially

`notifyListingLiked` fires today, but **only for boosted listings** — deliberately:

> "Unboosted listings can rack up many casual likes with no real intent behind most of them;
> boosted ads are a much smaller, more engaged set where 'someone just liked your ad' is a
> meaningful, non-spammy signal."

This already matches "for paid advertisers." It goes through `dispatch()` — email **and** SMS
both, if both exist. Same fix as the welcome email: moves to email-else-WhatsApp, never SMS.

### Views — this doesn't exist, and "real time" is the wrong shape for it

No view-based notification exists anywhere in the codebase. Before building one, the frequency
mismatch needs naming plainly: **a like is a rare, deliberate action; a view is not.** A single
moderately-visible boosted listing can pick up dozens of views an hour. A literal real-time
per-view email or SMS would mean an owner receiving dozens of messages a day for a single ad —
worse than the "no real intent" problem the like-notification's boost-gate was built to avoid,
not better.

**Recommendation: don't build per-view real-time notifications.** Build a **digest** instead —
"Your ad got 12 views today" (or a threshold: "your ad just crossed 50 views") — sent at most a
few times a day, not once per view. This still satisfies "tell paid advertisers their ad is
getting attention," which is presumably the actual goal, without the spam failure mode. If
literal real-time per-view alerts are genuinely wanted despite this, that's a product call
worth making explicitly and in writing, not something to build by default.

## What I'd build

### 1. Wire up `ListingNotificationLog` for every listing-scoped notification

- `notifyListingPosted`: write a row (`kind: 'posted'`, `channel: 'email' | 'whatsapp'`) after a
  successful send, so "did we acknowledge this listing" becomes a real query instead of an
  inference.
- `notifyListingExpiryReminder`: same — this one already has an implicit "don't repeat" need that
  `@@unique([listingId, kind])` was clearly built to serve, and today that rule doesn't exist in
  code at all (worth checking whether it currently *can* double-send on a retry).
- `notifyListingLiked` (and any future view digest): `kind: 'liked'` / `kind: 'viewed_digest'`.
  `@@unique([listingId, kind])` as it stands would only allow **one** like-notification ever per
  listing — probably not what's wanted for an ongoing stream of likes, so this constraint likely
  needs loosening (drop the unique, or key it as `[listingId, kind, sentAt::date]` for
  once-per-day) before likes/views can log through it. Worth deciding intentionally rather than
  discovering the constraint mid-build.

### 2. A user-level equivalent for welcome

`ListingNotificationLog` is listing-scoped and can't record a welcome send (there's no listing
yet). Either a small parallel `UserNotificationLog` (userId, kind, channel, sentAt), or widen
`ListingNotificationLog` into a general `NotificationLog` with an optional `listingId` — the
second avoids two near-identical tables for what's conceptually one concern. `welcomedAt` stays
as the fast "is this a new user" check `AuthService` already uses it for; the log is the answer to
"did it actually go out, and how."

### 3. The channel rule, decided: email else WhatsApp, everywhere — SMS is OTP-only

Every notification in `notifications.service.ts` moves to the same rule `notifyListingPosted`
already uses: email if the user has one, else WhatsApp, never both, never SMS. That's a bigger
change than it first looks, because **almost everything today reaches SMS somewhere**:

| Method | Today | Becomes |
|---|---|---|
| `notifyListingFlagged` | `dispatch()` — email + SMS | email else WhatsApp |
| `notifyListingApproved` | `dispatch()` — email + SMS | email else WhatsApp |
| `notifyListingLiked` | `dispatch()` — email + SMS | email else WhatsApp |
| `notifySavedSearchMatch` | `dispatch()` — email + SMS | email else WhatsApp |
| `notifyListingExpiryReminder` | `dispatchEmailPreferSms()` — email else SMS | email else WhatsApp |
| `notifyWelcome` | email + SMS + WhatsApp, all three | email else WhatsApp |
| `notifyListingPosted` | already email else WhatsApp | unchanged |
| `AuthService.sendOtp` | SMS, via msg91 | **unchanged — this is the one legitimate use** |

Both existing dispatch helpers (`dispatch`, `dispatchEmailPreferSms`) get replaced by one
`dispatchEmailPreferWhatsapp` — the helper `post-ad-acknowledgement.md` originally called for and
that never got built as a shared function; `notifyListingPosted` hand-rolled the same logic
inline instead of extracting it, which is worth fixing at the same time this runs everywhere else.

Practical consequence worth being upfront about: WhatsApp becomes load-bearing for every
phone-only user across every notification, not just the two that already depended on it. A
phone-only user is currently the majority of posters (per `post-ad-acknowledgement.md`), and
until `WHATSAPP_LISTING_POSTED_TEMPLATE`/`WHATSAPP_WELCOME_TEMPLATE` are actually approved and
set, this rule change means phone-only users get **nothing** for any of these — a real silence,
same trade already accepted for `notifyListingPosted`, now extended to five more notifications at
once. Worth sequencing behind confirming those templates are live and sending successfully.

### 4. Worth investigating: WhatsApp for OTP too

Meta has a dedicated `AUTHENTICATION` template category built specifically for one-time codes —
distinct from `UTILITY`/`MARKETING` — with two delivery styles: a **copy-code button** (user taps,
code is copied to clipboard, they switch back and paste) and **one-tap autofill** (the WhatsApp
client hands the code straight to the app, no copy-paste). This is real, current Meta
functionality, not speculative.

Real, not hypothetical, before treating this as a straightforward SMS replacement:

- **Not universal.** Someone without WhatsApp installed still needs SMS — this would end up
  WhatsApp-first-else-SMS for OTP too, not a full replacement, at least until you know what
  fraction of signups lack WhatsApp entirely.
- **One-tap autofill needs native app work.** It requires an SDK-level integration (an app
  signature hash Meta verifies) similar to Android's SMS Retriever API — a mobile-app change, not
  just a backend swap, and iOS support for this pattern is narrower than Android's.
  Copy-code works everywhere but is a strictly worse login experience than autofill.
- **No web equivalent of autofill.** Some browsers auto-read an SMS OTP into a web form (the
  WebOTP API); there's no WhatsApp analogue for the browser today, so the copy-code flow is what
  web login would get — a real UX step back from what SMS autofill (where it already works)
  offers today.

Worth a spike to measure how many current phone signups actually have WhatsApp, and to test the
copy-code flow once, before deciding whether this is worth the native app work autofill would
need. Not part of this plan's own scope — flagged here because it was asked about directly, and
because it's the same MSG91-vs-Meta-Cloud-API kind of provider decision this whole notification
system has already been through once for ordinary WhatsApp sends.

### 5. Views: the digest job, if you want it

A scheduled job (daily, or hourly for boosted listings only) that reads `viewCount` deltas since
the last digest, applies a boost-only gate matching `notifyListingLiked`'s existing rule, and
sends one rollup message per listing that crossed a meaningful threshold — not a live trigger on
`trackView`. This is a materially bigger piece of work than the other three items here (a new
scheduled job, a "since last digest" delta calculation, a threshold policy to define) and is
worth scoping as its own follow-up rather than folding into the tracking-table wiring above.

## A side effect of item 3, worth knowing

`Msg91Provider.sendTransactionalSms` has exactly three callers today, and all three are the ones
item 3 removes. Once that change ships, `sendTransactionalSms` has no callers left at all —
which quietly resolves `post-ad-acknowledgement.md`'s open question about whether its free-form
text actually survives Indian DLT template registration. That question doesn't get answered; it
becomes moot, because nothing calls the method anymore. `Msg91Provider.sendOtp` — the one real
remaining SMS use — is a separate method already built around a proper DLT-registered OTP
template, and is untouched by any of this.

## What this doesn't cover

- Retrying a failed send. Today's failures are logged-and-dropped everywhere; a log table records
  that a send failed, but nothing here makes it retry. Separate decision.
