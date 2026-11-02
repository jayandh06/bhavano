# Post-ad experience feedback

## Status: plan (2 Nov 2026), nothing built yet

## Goal

Learn how it felt to fill the post-ad form, straight from the people who did it, and what they would change. Ask at the end of
posting; ask again later (push and in-app message) only the owners who have not answered for that listing. Store every answer with
enough context to act on it, and show it in admin.

Why now: the post flow is where nearly all revenue starts (62 of 64 paid boosts in 60 days, see
[`featured-expiry-reminder.md`](featured-expiry-reminder.md)), and the funnel data (`post-ad-funnel-step-tracking-and-entry-attribution.md`,
`post-details-step-experience.md`) says *where* people stop but not *why*.

## What we ask (kept to under 30 seconds)

1. **How was posting your ad?** 1 to 5 (stars or faces). One tap, saved immediately even if they stop there.
2. **What was hard?** Optional chips, multi-select, named after the real steps: Choosing category, Photos and videos, Description / details,
   Price, Location / area, Preview, Payment or the Featured offer, Logging in, Something else.
3. **What should we improve?** Optional free text (500 characters).
4. **May we contact you about this?** Optional tick, off by default (so a rating of 1 to 2 can be followed up personally).

Captured automatically, never asked: listing id and owner, category and transaction type, platform (web or app) and app version, how the
visitor arrived (the acquisition fields already on `User`), the funnel session id when known, how the request reached them
(`success_screen`, `in_app_message`, `push`), and when.

## Where it appears

| # | Surface | When | Notes |
|---|---|---|---|
| 1 | Post-ad success screen (web + app) | Right after "Your ad is live" | A compact card **below** the Featured offer and share card, never above. That screen is where the sales happen; the feedback card must not push the offer down or compete with it. |
| 2 | In-app message from "Bhavano Admin" | About 48 h after posting, only if no feedback exists for the listing | New message kind `feedback_request`, same plumbing as `boost_offer` (card on current builds, plain text with a link on old ones). |
| 3 | Push notification | Same moment as #2, only when the owner has a registered push token | Deep link `path: /feedback/post/<listingId>`; the existing tap handler (`onNotificationTap`) already opens a `path`. |
| 4 | Web page `/feedback/post/[listingId]` | Target of #2 and #3 and of old app builds | Logged-in owner only; shows the same form; "Thanks" state if already answered. |

Nudge rules (so it never becomes spam): once per listing, and at most once per owner per 30 days; skipped if feedback exists, if the owner
got any in-app message in the last 12 h (the same `MIN_GAP_HOURS` rule as the Boost follow-up), outside 09:00 to 20:59 IST, or for
placeholder / bulk-import owners. The single 24 h Boost follow-up you set stays as is; the feedback request goes out on a different day
from it (about 48 h).

## Data

New table `PostFeedback` (one Prisma migration):

- `id`, `listingId` (unique: one answer per listing, later edits update it), `userId`
- `rating Int?`, `difficulties String[]`, `suggestion String?` (text), `canContact Boolean @default(false)`
- `source` (`success_screen` | `in_app_message` | `push` | `web_link`), `platform`, `appVersion?`
- `category`, `transactionType` (copied so a later listing edit does not change the report)
- `createdAt`, `updatedAt`

Request tracking reuses `ListingNotificationLog` (kind `feedback_request`, channel `in_app` or `push`), so the existing admin notification
log shows what was sent. "Not yet answered" is simply no `PostFeedback` row for that listing.

Saving is a partial-friendly upsert: tapping a star writes the rating at once; chips and text update the same row.

## Backend

- `POST /feedback/post` (auth, owner of the listing only): upsert; validate rating 1 to 5, chips from a fixed list in `@bhavano/types`
  (`postFeedback.ts`, shared by web, app and admin), text trimmed and capped; rate-limited like the other write endpoints.
- `GET /feedback/post/:listingId` (owner): the existing answer, so the form shows it filled.
- `PostFeedbackRequestJob` (hourly 09:00 to 20:59 IST, like `BoostFollowupJob`): finds listings live for 48 h to 5 days with no feedback and
  no `feedback_request` log, applies the rules above, then sends the in-app message (through the existing admin messaging path) and the push
  (`PushService`) and writes the log rows. Switchable with `FEEDBACK_REQUEST_ENABLED=false` and an Admin settings toggle plus delay hours
  (Settings → Reminders, via `reminder-settings.ts`).

## Admin

- New **Feedback** screen (Analytics group): table with rating, chips, text, listing, person, platform, source, date; filters for rating,
  category, platform, "has text", "can contact"; headline cards (average rating, response rate = answered / posted, top difficulties
  by count, trend by week). Row highlight colours reuse `RowHighlights` (low rating stands out).
- A Feedback block on the admin listing and user pages; "Contact" button opens the existing message thread when `canContact` is on.
- Filters follow the remembered-filters rules (links into the screen carry `__skipRemember`, with a Reset link), see
  [`admin-remembered-filters.md`](admin-remembered-filters.md).

## Phasing

1. **Phase 1, web and server (no app release):** table, endpoints, shared types, web success-screen card, `/feedback/post/[listingId]`
   page, admin Feedback screen. Ships and starts collecting at once.
2. **Phase 2, nudges:** the job, the `feedback_request` in-app message and push, settings toggle. Works for old app builds because the
   message carries a web link and the push carries a `path`.
3. **Phase 3, mobile app:** success-screen card, a feedback screen, and the in-app message card renderer. Needs an app release (Android via
   GitHub Actions; iOS only after the 1.2.0 approval and release, see the project notes).

## How we know it works

- **Response rate** (answered / listings posted) from each source, targeting at least 15% on the success screen and 5% from nudges.
- **No harm to sales:** compare boost conversion of the success screen before and after, using the `post_success` purchase source added on
  1 Nov 2026. If it drops, move the card to after "Maybe later" or to the nudge only.
- **Actionable output:** after four weeks, a short ranked list of the top difficulties and quoted suggestions goes into this doc.

## Privacy and housekeeping

- Free text can contain personal details: admin-only, never shown publicly, never fed to the ads tools.
- Add one line to `/privacy` ("we may ask how posting went and store your answer with your ad") before Phase 1 goes live.
- Optional contact consent stays off by default and is stored on the row.
- Accounts that are deleted: delete their feedback with the account (cascade on `userId`).

## Tests

BFF unit tests for validation, ownership, upsert and the job's skip rules (already answered, recent message, quiet hours, placeholder
owner, once per 30 days); web test for the card states (rating only, full, already answered); a throwaway-Postgres check of the job's
candidate query, as done for the page-visit highlights.

## Decisions needed from you

1. **Incentive:** none (recommended to start), or a small reward (for example a free Featured day for a completed answer, which would
   also distort the rating)?
2. **Rating style:** 5 stars (familiar) or 3 faces (faster, fewer lazy 3s)?
3. **Who is asked:** every poster (recommended while volumes are small), or first-time posters only?
4. **Timing of the nudge:** 48 h after posting (proposed) or 24 h, which would sit on top of the Boost follow-up?
