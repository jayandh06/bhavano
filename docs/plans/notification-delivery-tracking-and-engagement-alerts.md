# Do we know what we sent, and should views/likes notify owners in real time?

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
email, SMS, and WhatsApp all at once. That's inconsistent with `notifyListingPosted` (built last
session), which deliberately does the opposite: exactly one channel, email if present else
WhatsApp, never both. Worth deciding whether `notifyWelcome` should match that stricter rule, or
whether three simultaneous welcomes was actually intended.

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

— shaped exactly for "was this kind of notification sent for this listing, and how." It has
**zero references anywhere in application code.** Someone built this table anticipating this
need and nothing was ever wired to it — not `notifyListingExpiryReminder`, which is the
notification whose own repeat-prevention logic (`@@unique([listingId, kind])`) this most obviously
matches, and not the `notifyListingPosted` work from last session, which duplicated the
same problem this table already solves.

## What you're actually asking for, part two: like/view notifications for paid advertisers

### Likes — this already exists, partially

`notifyListingLiked` fires today, but **only for boosted listings** — deliberately:

> "Unboosted listings can rack up many casual likes with no real intent behind most of them;
> boosted ads are a much smaller, more engaged set where 'someone just liked your ad' is a
> meaningful, non-spammy signal."

This already matches "for paid advertisers." It goes through `dispatch()` — email **and** SMS
both, if both exist, unlike the single-channel rule `notifyListingPosted` uses. Same
inconsistency as the welcome email, worth resolving the same way.

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

### 3. Decide the channel-consistency question

Either make `notifyWelcome` and `notifyListingLiked` single-channel like `notifyListingPosted`
(email else WhatsApp/SMS, never both), or leave them as "send everything available" deliberately
and just document that the two patterns coexist on purpose. Not a technical decision — a call
about how much mail one event should generate.

### 4. Views: the digest job, if you want it

A scheduled job (daily, or hourly for boosted listings only) that reads `viewCount` deltas since
the last digest, applies a boost-only gate matching `notifyListingLiked`'s existing rule, and
sends one rollup message per listing that crossed a meaningful threshold — not a live trigger on
`trackView`. This is a materially bigger piece of work than the other three items here (a new
scheduled job, a "since last digest" delta calculation, a threshold policy to define) and is
worth scoping as its own follow-up rather than folding into the tracking-table wiring above.

## What this doesn't cover

- Retrying a failed send. Today's failures are logged-and-dropped everywhere; a log table records
  that a send failed, but nothing here makes it retry. Separate decision.
- SMS's known open question from `post-ad-acknowledgement.md` — whether `sendTransactionalSms`'s
  free-form text actually survives Indian DLT template registration. Still unverified, still
  bigger than this plan.
