# Link a person's web visits to their account when they log in on the app

## Status: built and committed (2026-10-21); needs a BFF + web deploy, and a mobile release before it does anything

## Problem

Admin **Page visits** shows one row per session. A person who browses the website (anonymous, session `bhavano_sid`),
installs the Android app from a "Get the app" button and logs in **on the app** gets their app session linked to their
account, but the earlier web session stays anonymous forever: the web and app sessions share no identifier, and login only
links the session it happens in (`AuthService.linkVisitToUser`, `/analytics/link-session`). So the journey looks like an
anonymous visitor plus an unrelated logged-in app user.

## Design

The only thing that survives the trip from the website to a fresh install is the **Play install referrer**
(`referrer=` on the Play link, read by the app on first launch: `recordInstallReferrerOnce`). So the website puts the
visitor's session in it.

1. **Web:** the site's own "Get the app" buttons (Play badge, desktop header link, phone header icon) now point at
   `/android?m=<medium>&c=<campaign>` (`androidInstallHref`). The route reads the visitor's httpOnly `bhavano_sid` cookie
   on the server and 302s to Play with `utm_source=bhavano_web&utm_medium=…&utm_campaign=…&ws=<session id>`
   (`playInstallUrl`). Without the params (the SMS link) or without a cookie it behaves exactly as before. `m`/`c` accept
   only `[a-z0-9_-]{1,40}`; `ws` must be a UUID.
2. **App:** `parseInstallReferrer` keeps `ws` as `webSessionId` (UUID-checked) inside the stored install attribution
   (`installAttributionStore.ts`); `linkAnalyticsSessionToUser` (already called once per launch when logged in) now sends it
   as `webSessionId` to `POST /analytics/link-session`.
3. **BFF:** `LinkSessionDto.webSessionId` (optional UUID). The controller links the app session as before and then calls
   `AnalyticsService.linkExistingVisitToUser(webSessionId, userId)`: an `UPDATE … WHERE "sessionId" = … AND "userId" IS NULL`,
   so it **never creates rows** (a made-up id does nothing) and **never overwrites** an owner (two people on one browser
   keep the first claim).

No schema change, no migration.

## What it covers, and what it does not

- Covers: **Android installs started from the website's dynamic buttons**, where the visitor's browser had a session cookie.
- Does not cover: the static QR codes (`public/app-qr/*`) and the SMS link (no per-visitor value possible), organic Play
  installs, **iOS** (no install referrer), people who clear cookies or whose browser blocks them, and anyone who installed
  before the app release below. Their web visits stay anonymous, as today.
- It needs the **mobile release**: the referrer is read on the first launch after install by whichever app version Play
  delivered, so the build that parses `ws` and sends `webSessionId` must be the production Play build before the installs
  that should be linked (1.2.0 or later; runtime-compatible OTA is not enough because the read happens at first launch of
  the installed binary).
- A person who browses on one device and installs on another gets no link (the `ws` goes with the button they tapped).

## Privacy note

`ws` is the website's anonymous session id (a random UUID, no personal data) and now appears in a Google Play URL.
It lets the BFF attach one anonymous Visit to an account **only after that person logs in on the app**. It confers no access
and cannot be used to read anything. If you need a stricter position, add the new data flow to the privacy policy wording
about analytics before releasing, or replace the raw id with a short-lived token mapped to the session server-side.

## Verification

- Web: `appStoreRedirect.test.ts` (referrer with `ws`, no cookie, junk cookie, unsafe params, SMS link unchanged) and
  `appLinks.test.ts`.
- BFF: `analytics.service.spec.ts` (update-only, owner-null-only, no insert).
- Mobile: `parseInstallReferrer` checked by compiling the real file and running it with stubbed imports (with `ws`, bad
  `ws`, old format, organic). The mobile jest suite could not be run in this checkout (jest/ts-jest are not installed in
  `apps/mobile/node_modules`); `installReferrer.spec.ts` has the new case and should be run in CI.
- Typecheck of web, BFF and mobile is clean.
