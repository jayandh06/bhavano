# Login-gated listing interest + owner view notifications

## Status: Phase 1 implemented (2026-09-24) — **gate: Option B** + mobile push for advertiser engagement

**Mobile push (advertiser):** when the owner has the app installed with a registered push token
and `EXPO_PUSH_ENABLED=true` on BFF:

| Event | Push? | Email/WhatsApp |
|-------|-------|----------------|
| Logged-in view (interest) | Always | Instant Alerts only |
| New message | Always | Instant Alerts only |
| Favourite | Always | Boosted listings only (unchanged) |

Tap: messages → thread; view/favourite → My listings.

**Ask:** Visitors may browse search/home cards without logging in. Opening a listing’s **details**
requires login so we know who they are; that identified interest immediately notifies the listing
owner. Owners with **Instant Alerts** get email / WhatsApp (same channels as new-message alerts).
Owners should see **who viewed** their ads so they can reach out.

**Decided (2026-09-24):** **Option B — soft gate.** Listing detail stays publicly readable (SEO /
Ads / share links unchanged). **Logged-in** opens of detail auto-register interest and notify the
owner (99acres-style); anonymous visitors read without notify. Option A (hard login wall) rejected.

**Shipped in Phase 1:** `ListingInterest`; auto interest on authenticated detail view + first
Message; owner My listings interested panel; Instant Alerts on interest; push for all owners.

Related (do not re-derive):

- [`instant-alerts-paid-message-notifications.md`](instant-alerts-paid-message-notifications.md) —
  Instant Alerts today = paid email/WhatsApp on **new messages** only (`instantAlertsUntil`).
- [`listing-view-count-raw-visits.md`](listing-view-count-raw-visits.md) /
  [`link-anonymous-views-to-account-on-signup.md`](link-anonymous-views-to-account-on-signup.md) —
  `ListingView` + `viewCount` already record anon and `user:` views; anon → user rekey on signup.
- [`contact-reveal-credits.md`](contact-reveal-credits.md) — seeker pays to see **owner** contact
  (opposite direction of “owner reaches out to viewer”).
- Admin already has “Liked & Viewed” via `ListingsService.listEngagement` — **owners do not**.

---

## What exists today

| Surface | Auth? | Owner learns? |
|--------|-------|----------------|
| Home / search / cards | No | No (anonymous traffic) |
| Listing detail page (web SSR + mobile) | No | `viewCount` bumps; row in `ListingView` as `anon:` or `user:` |
| Message owner | Yes | In-app + push; Instant Alerts → email/WhatsApp |
| Reveal contact | Yes (+ credits) | Owner does **not** get a “someone unlocked you” ping today |
| Favourite | Yes | Boosted listings: like notification |
| My listings | Owner | Aggregate `viewCount` only — **no viewer list** |
| Admin listing detail | Admin | Full liked/viewed engagement table |

So the gaps are: (1) detail is public, (2) Instant Alerts ignore views, (3) owners cannot see
identified viewers or contact them from My listings.

---

## Critical product decision: SEO vs hard login wall

**Decided: Option B.** Options A and C below are retained only as rejected alternatives.

Listing detail URLs are a primary **organic + Google Ads landing** surface today
(`apps/web/src/app/[city]/[[...rest]]/page.tsx` — `generateMetadata`, JSON-LD, full
`ListingDetailView` without session).

| Option | Behaviour | Pros | Cons |
|--------|-----------|------|------|
| **A. Hard gate** ❌ rejected | Unauthenticated detail → login sheet only; no content until session | Matches an earlier literal ask | Breaks SEO/Ads deep links |
| **B. Soft gate** ✅ **chosen** | Cards + **public detail** stay open. **Logged-in** detail views register identified interest and notify the owner (99acres-style). Anonymous visitors can still read the page with no notify. | Keeps SEO/Ads; captures logged-in intent; Instant Alerts stay valuable | Logged-out readers do not create leads until they sign in |
| **C. Hybrid SSR** ❌ rejected | Public HTML for bots; login for humans | — | Cloaking risk; still hurts Ads UX |

---

## Locked defaults (alongside Option B)

| Question | Decision |
|----------|----------|
| When to create interest | **Logged-in detail view** (99acres-style) + **auto on first Message**. No “I’m interested” tap required. Anonymous detail views never notify. |
| Re-notify window | **24 hours** between Instant Alerts / push interest pings for the same `(listing, user)` |
| Reach-out level | **Level 1 — Message only** (name + time + Message). No seeker phone/email to owner in v1 |
| Non–Instant Alerts owners | **Push + in-app only** (email/WhatsApp remain Instant Alerts paid value) |

---

## Target behaviour (Option B)

### Seeker

1. Browse home/search **without** login (unchanged).
2. Open listing detail **publicly** (SSR/SEO unchanged). Anonymous view → no owner notify.
3. **Logged-in** open of detail → upsert `ListingInterest` and notify the owner (debounced 24h).
   Same on first **Message**. No separate “I’m interested” button (99acres-style auto intent).
4. Short disclosure on the detail actions panel when logged in: the owner may be told you viewed
   this ad.

### Owner

1. **Immediate notify** when a *new* identified interest arrives (see debounce below).
2. Channels:
   - Always: in-app (My listings interested list) + Expo push if subscribed.
   - If `listing.instantAlertsUntil > now`: email else WhatsApp — **same** channel rule as
     `notifyNewMessage` in Instant Alerts.
3. **My listings → “Who’s interested”** (or per-listing panel): identified viewers with time,
   optional name, and a **Message** action (start/open conversation). No seeker phone/email in v1.

### What Instant Alerts becomes

Extend Instant Alerts from “messages only” to **“high-intent buyer signals”**:

| Signal | Notify Instant Alerts owners? |
|--------|-------------------------------|
| New message (today) | Yes |
| Identified listing interest / authenticated detail intent (this plan) | Yes |
| Favourite | Keep existing boost-like path; do **not** double-send IA unless we fold like into interest |
| Anonymous card impression | Never |

Update Instant Alerts marketing copy: “Get email/WhatsApp when someone messages **or shows
interest** in your ad.”

---

## Privacy & reach-out model

“Owners reach out” can mean three different things — pick one for v1:

| Level | Owner sees | Owner can | Consent needed |
|-------|------------|-----------|----------------|
| 1. Message only (recommended v1) | Display name (or “Interested buyer”), time | Open chat thread (existing messaging) | Login + open listing implies they may be messaged — short disclosure on detail when logged in |
| **2. Contact share** | Phone and/or email | Call / WhatsApp outside app | Explicit opt-in (toggle on interest or profile), mirrored from requirement `contactConsent` |
| **3. Credits reverse** | Contact only after owner spends a credit | Same as 2 | Paid + consent |

**Recommend Level 1 for v1** — reuses messaging + Instant Alerts; avoids leaking phones to every
seller on every view. Level 2 can be Phase 2 if owners demand dialable leads.

Exclude: owner viewing own listing; admin impersonation; bots (reuse existing view/bot filters
where applicable).

---

## Data model

Prefer a dedicated interest row over overloading raw `ListingView` for notifications:

```prisma
model ListingInterest {
  id         String   @id @default(cuid())
  listingId  String
  userId     String
  /// First authenticated intent on this listing (detail open after login, or CTA).
  createdAt  DateTime @default(now())
  /// Last time we counted / refreshed interest (optional; for “viewed again”).
  lastSeenAt DateTime @default(now())
  /// When we last fired an Instant Alerts / push notify for this pair.
  lastNotifiedAt DateTime?

  listing Listing @relation(...)
  user    User    @relation(...)

  @@unique([listingId, userId])
  @@index([listingId, lastSeenAt])
  @@index([userId, createdAt])
}
```

**Why not only `ListingView`?** Views are every visit, noisy, and already anonymous-heavy.
Interest is **one row per (listing, user)** for “this person showed intent,” with a notify cursor.
Keep incrementing `ListingView` / `viewCount` as today for aggregate stats.

Optional: `ListingNotificationLog.kind` add `listing_interest` (alongside `new_message`,
`instant_alerts_activated`, etc.).

---

## Backend behaviour

### Capture interest

- New authenticated endpoint, e.g. `POST /listings/:id/interest` (idempotent upsert).
- Call sites (Option B):
  - **Authenticated listing detail view** (web `ViewTracker` / mobile listing screen) — mode
    `view`, may notify.
  - Auto on **first Message** to that listing — mode `message`, upsert only (message path already
    notifies).
- Owner self-view / self-message: no-op.
- Fire-and-forget notify after upsert when notify rules say so.

### Notify rules (mirror Instant Alerts debounce)

- **First interest** on `(listingId, userId)` → notify.
- **Repeat visits:** notify again only if `lastNotifiedAt` older than **24 hours**.
- Instant Alerts email/WhatsApp only if `instantAlertsUntil` active; else push + in-app only.
- Reuse `NotificationsService` channel selection (email else WhatsApp) and
  `ListingNotificationLog`.

### Owner APIs

- `GET /listings/mine/:id/interests` (or embed on my-listings detail) — paginated interests with
  user display fields safe for Level 1.
- Unread/new count for My listings badge (optional Phase 1.5).

### Admin

- Engagement table can later join `ListingInterest`; not required for v1.

---

## Frontend

### Web

- Browse unchanged.
- Detail: if Option B, add primary **I’m interested** (and keep Message / Reveal). After login
  with `redirectTo` back to listing, auto-fire interest once.
- My listings: per-row or expand panel **Interested buyers (n)** with Message buttons.
- Instant Alerts cards/copy: mention interest + messages.

### Mobile

- Same flows; reuse `requireLogin({ onSuccess })` then `POST .../interest`.
- My listings panel parity.

### Login copy

Short line: “We’ll let the owner know you’re interested so they can reply in Messages.”

---

## What we deliberately do *not* do in v1

- Hard-login detail without an SEO decision (Option A deferred).
- Sharing seeker phone/email to owners by default (Level 2).
- Notifying on anonymous views or card impressions.
- Replacing Instant Alerts pricing (still per-listing paid add-on; scope expansion is **what** it
  fires on, not a new SKU).
- Deduping `viewCount` back to unique viewers (already decided raw visits).

---

## Phasing

### Phase 1 — Interest + notify + owner list (Level 1)

1. `ListingInterest` + `POST /listings/:id/interest` + notify (push always; IA email/WhatsApp when
   active).
2. Web + mobile: capture after login/CTA; My listings interested-buyers list + Message.
3. Instant Alerts copy update.
4. Tests: idempotent upsert, owner self excluded, IA on/off, debounce.

### Phase 2 — Stronger gate and/or contact (optional)

- Hard gate or blurred detail until login — only if SEO strategy changes later.
- Level 2 contact share with consent toggle.
- Owner digest email (“3 people interested today”) for non-IA owners.

### Phase 3 — Analytics / monetization (optional)

- Admin dashboards on interest→message conversion.
- Whether interest notify stays inside Instant Alerts or becomes a higher tier.

---

## Open questions

None blocking Phase 1 — Option B and the locked defaults above are enough to implement. Revisit
only if product wants Level 2 contact share or a different re-notify window.

---

## Verification (Phase 1)

- Logged-out browse → cards work; detail per Option A/B.
- Login → interest row created once; owner push; with IA active → one email/WhatsApp; refresh
  does not re-spam inside debounce window.
- Owner My listings shows the seeker and can open Messages.
- Own listing view creates no interest.
- SEO spot-check (if B): listing URL still returns 200 with title/description for logged-out
  fetch / crawler UA.

## Critical files (expected)

- `apps/bff/prisma/schema.prisma` + migration (`ListingInterest`)
- `apps/bff/src/listings/` (interest endpoint, owner list)
- `apps/bff/src/notifications/notifications.service.ts` (`notifyListingInterest`)
- Instant Alerts path reuse from `messaging.service.ts` / payments (eligibility via
  `instantAlertsUntil`)
- `apps/web` + `apps/mobile` listing detail, My listings, login redirect
- `docs/plans/instant-alerts-paid-message-notifications.md` — amend scope to interest signals

---

## Summary

Browse and **public detail** stay open (Option B). **Identified interest** (“I’m interested” +
first Message) drives owner notification. Instant Alerts is the paid email/WhatsApp pipe for
interest and messages. Owners get a My listings **interested buyers** list and Message them
(Level 1). Ready for Phase 1 implementation.
