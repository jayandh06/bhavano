# Page visits: one row per user (or device) per day

## Status: (a) grouping and (b) app session built 2026-11-23; (c) device key not built

**As built (a):** `group=user_day` ("One row per user per day" in the Page visits View select). BFF:
`groupVisitsByUserDay` and `istDay` in `admin/page-visit-groups.ts`, `ListPageVisitsDto.groupBy` accepts `user_day`,
`listPageVisitsGrouped(…, perDay)`, `PageVisitDto.groupedDay` (`YYYY-MM-DD`, logged-in rows only). Admin: select option,
explanation line, and "N sessions on YYYY-MM-DD" in the row. Reuses `mergeVisitGroup` unchanged; no migration.
**As built (b):** the app keeps its analytics session in storage (`bhavano.analyticsSession`: id, last activity and
whether the Visit/JS confirmation were already posted) and continues it after a close and reopen inside **30 minutes**
(`analyticsSessionPolicy.ts`, `analyticsSession.ts`). Activity is saved at most every 15 s and when the app leaves
the foreground; after more than 30 idle minutes (background or foreground) the next page view starts a new session,
and the account link is made again for it. Only updated apps behave this way; older versions still start a session per
launch, which the per-day grouping covers. Not verified on a device.
Days are IST by session start, as proposed (confirmed by building it; say if a different day boundary is wanted).

**Ask (owner):** show a user's activity in Admin → Page visits consolidated per day, not as separate rows, and
explain how a new row is created for the same user today. Follow-up (2026-11-23): also consolidate visitors who are
not logged in, and avoid many new sessions for one person in a short interval, from any device.

## How a new row is created today (checked in the code)

A Page visits row is one **Visit**, which is one analytics **session**. `Visit.sessionId` is unique, and
`AnalyticsService.recordVisit` inserts a row the first time it sees a new `sessionId` (a repeat of the same id only
fills in missing attribution). So a new row appears whenever the visitor gets a new session id:

| Surface | When a new session id (and so a new row) is minted |
|---|---|
| Website | The `bhavano_sid` cookie is missing: it expires after **30 minutes without a page view** (rolling, see `session-cookie-rolling-expiry.md`), or the person uses a different browser, device or profile, a private tab, cleared or blocked cookies, or an in-app browser. Android in-app browser tabs opened from email, WhatsApp or a notification do not share the earlier cookie, which is what split one person into two rows on 2026-11-02. Known crawlers never get a row. |
| Mobile app | One id **per JS process** (`analyticsSession.ts`, not persisted): a cold start (the app was closed, killed by the OS, or restarted) mints a new row. Reopening within seconds from the background does not. |
| Logging in | Does **not** create a row. It links the current session to the account (`linkVisitToUser`). A login on another device or browser has its own session, so it is another row for the same user. |

Anonymous sessions before a login on a different device can never be tied to the person, so they stay separate
rows.

## What already exists

Page visits has **Group by user** (`group=user`): `groupVisitsByUser` + `mergeVisitGroup` fold all of an account's
sessions **in the chosen date range** into one row (first session's source and device, newest activity, summed
pages, one combined trail via `groupedSessionIds`). Visits nobody logged in on stay one row each; sorting by column
is off; at most 5,000 visits are scanned (`PAGE_VISIT_GROUP_SCAN_CAP`).

The gap is that it is **per user, not per user per day**: over a week, a busy user is one row, and "first session's
details" then describes their first visit of the week, not today's.

## Design

1. **New grouping option "One row per user per day"** (`group=user_day`) beside Group by user.
   - Key: `userId` + the **IST calendar day** the session started (`Visit.createdAt`). Anonymous visits stay one row
     each, as today (never merged by IP or device: that would guess identities).
   - Each row shows the day, the number of sessions ("3 sessions"), the first session's source/device/landing of that
     day, the day's latest activity, and the day's total page views and highlights (existing `mergeHighlights`).
   - Opening a row shows that day's combined trail (existing `groupedSessionIds` mechanism, restricted to the day).
   - Newest day first, then newest activity; column sorting off, as in Group by user.
2. **BFF:** add `'user_day'` to the `group` option of `ListPageVisitsDto`; new `groupVisitsByUserDay` in
   `admin/page-visit-groups.ts` (same shape as `groupVisitsByUser`, key adds the IST day); `listPageVisitsGrouped`
   takes the mode. Add `groupedDay?: string` (`YYYY-MM-DD`) to `PageVisitDto` for the row label. Reuses
   `mergeVisitGroup` unchanged.
3. **Admin:** one more option in the existing "Group" select, a short explanation line under it (like the Group by
   user line), and the day shown in the row. Same URL parameter style (`group=user_day`), so a link keeps it.
4. **Day boundary:** a session that starts before midnight and is still active after is counted wholly on the day it
   started, so its late page views land on the earlier day. Splitting by each page view's own time is possible
   (count `PageView` rows per day) but costs another query per page; start with start-day and revisit if it misleads.
5. **Optional, separate change: fewer rows at the source for the app.** Keep the app's session across a cold start
   for 30 minutes (persist the id with a last-active time, like the web cookie) so a quick close and reopen continues
   one row. The existing comment rejects a durable per-install id because it would merge weeks into one row; a
   30-minute idle window does not. Needs an app release and changes mobile session counts before and after, so it
   is not part of this plan unless asked for.

### Logged-out visitors: group by device key

Logged-out sessions cannot be tied to a person, but they can be tied to a **device or browser**. Both the app
(`bhavano.viewerKey` in app storage, `viewerKey.ts`) and the website (the same value in local storage,
`ViewTracker.tsx`) already keep a persistent anonymous key, used today for listing views and, at login, to link
those views to the new account. `Visit` does not store it.

6. **Store the key on the session.** New nullable `Visit.viewerKey` (migration, indexed with `createdAt`). The app
   sends it with `/analytics/visit` (it already has it); the website's middleware passes it when present (a cookie
   copy may be needed, since local storage is not readable in middleware: decide when building).
7. **Grouping.** In `user_day` mode a logged-out session is keyed by `viewerKey` + IST start day, so one phone or
   browser with four sessions is one row ("device" label instead of a user). Sessions with no key stay one row
   each, as today.
8. **Backfill at login.** In `linkVisitToUser` (and the app's `linkAnalyticsSessionToUser`), also set `userId` on
   earlier anonymous `Visit` rows with the same `viewerKey`, the same idea as the existing claim of pre-signup
   listing views. Their history then joins the account's row. Only for sessions that carry a key; old rows cannot
   be recovered.

Limits: same device and browser only (a phone and a laptop of one logged-out person stay separate); clearing
storage, private tabs or blocked storage give a new key; sessions before this ships have no key. **IP and device
type are never used to merge** (shared and changing addresses would merge strangers); at most a "probably the same"
hint later.

**Privacy:** the key is already a persistent identifier, disclosed for listing views. Before using it for analytics
rows, check that `/privacy` covers it, and keep the app's iOS tracking choice (`trackingConsent.ts`) in force: do
not send or store the key when tracking was denied.

### Fewer sessions at the source (the app)

The app mints one session id per JS process, so every launch is a new row (confirmed 2026-11-23 on one user: four
launches in about 28 minutes, two lasting 0 and 3 seconds, so four rows). Step 5 above (persist the id with a
last-active time and keep it for 30 minutes idle, like the web cookie) turns those into one row. It needs an app
release and only helps updated apps, which is why the read-time grouping comes first: it also fixes old versions.

Order: (a) `user_day` grouping for logged-in users, BFF and admin only; (b) the app's 30-minute session with the next
app release; (c) `Visit.viewerKey`, device grouping and the login backfill.

## Not doing

- No merging of anonymous visits by IP or device type, and (for (a)) no change to how sessions or rows are created
  or stored. Step (c) adds one column and the login backfill; nothing else about storage changes.
- No change to Campaign analytics, which counts a visit per session.
- No database migration for (a) and (b): grouping is computed at read time, as Group by user is. Only (c) needs one.

## Risks and open questions

- **Time zone:** days are computed in IST. Confirm that is the day you want to read (the site's users and campaigns
  are India-only).
- **Scan cap:** 5,000 visits are scanned, so a very wide range drops the oldest. The page already warns about this
  for Group by user; keep the warning.
- **Combined trail across a long day:** one heavy user can have many sessions in a day; the trail view should cap
  or collapse by session so it stays readable.
- **First session's details:** a user who arrives from an ad in the morning and returns direct in the evening shows
  the morning source for the whole day. That matches how Group by user works.

## Rollout

(a): BFF and admin only, no migration or app release; (b): app release; (c): migration, BFF, admin and app. Tests: `page-visit-groups` unit tests (same user same day merges,
same user on two days does not, anonymous never merges, IST midnight edge), plus the admin page's group param.
Deploy the BFF first, then admin.
