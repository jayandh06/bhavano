# Listing detail: admin-configurable, skippable login nudge

## Status: built (2026-09-30)

The admin setting, web One Tap, the web card, the app sheet with Skip and the WhatsApp link
are built. The "As built" section at the end records where the implementation differs from the
proposal below.

## Ask

An admin setting that shows a login dialog when someone opens a listing's details, with the
option to skip, so we can identify who viewed each ad. Must not hurt SEO or Google Ads.

## Baseline (production, last 30 days)

| Viewer kind | Views | Distinct viewers |
|---|---|---|
| Anonymous (`anon:`) | 1,522 | 1,362 |
| Logged in (`user:`) | 280 | 126 |

That produced 54 `ListingInterest` rows. About 90% of the people opening a listing are
invisible to its owner.

## Constraints already decided (do not re-derive)

[login-gated-listing-interest-owner-notify.md](login-gated-listing-interest-owner-notify.md)
chose **Option B**: listing detail stays fully public. A logged-in open registers
`ListingInterest` and notifies the owner. **Rejected:**

- Option A, a hard login wall. It breaks SEO and Ads deep links.
- Option C, public HTML for bots with a login wall for humans. That is cloaking.

This proposal stays inside Option B. The content is always in the server-rendered HTML for
everyone. The nudge is a client-side overlay the visitor can dismiss.

Already in place, and it makes a skip cheap: anonymous views are recorded under a persistent
`viewerKey`. On signup they are re-keyed to the account
([link-anonymous-views-to-account-on-signup.md](link-anonymous-views-to-account-on-signup.md)).
Anyone who skips now and logs in later still gets attributed.

## SEO and Ads rules the design must respect

1. **Same HTML for every visitor.** Never branch on user agent or "is Googlebot". The nudge is
   mounted client-side after hydration, so crawlers see the page exactly as a logged-out human
   does.
2. **No intrusive interstitial on the landing page.** Google demotes pages whose main content is
   covered by a popup right after arriving from search, especially on mobile. Ads also scores
   landing-page experience. So on web:
   - never a full-screen modal on the first page of a visit;
   - never on traffic from Google Ads (`gclid`, `gbraid`, `wbraid`, or `utm_medium=cpc`) or
     from a search engine referrer, on that landing page.
3. **Small and dismissible.** A bottom sheet or corner card that leaves the listing readable,
   with a visible "Not now". Not a centred modal with a backdrop.
4. **Never gate what the listing page is.** Title, price, photos, description and the JSON-LD
   stay visible. Don't blur content for logged-out visitors: blurred indexed content is a
   paywall. It would need `isAccessibleForFree` markup and would still read as a gate.

## Recommended approach

### Web: two layers

1. **Google One Tap (primary).** Google's own small corner prompt: one tap signs in with the
   Google account already in the browser. It doesn't count as an interstitial and is the
   lowest-friction option. The web app already has Google sign-in via NextAuth, so this wires
   the GIS `google.accounts.id.prompt()` to the same ID-token login path. Google enforces
   its own cooldown when the prompt is dismissed.
2. **Soft prompt (fallback, for browsers without a Google session).** A bottom sheet on listing
   detail: "Log in to hear back from owners faster, save listings and get alerts", with the
   existing login options and "Not now". It shows only when every trigger rule passes:
   - it is **not** the visit's landing page, e.g. the 2nd+ listing detail in the session
     (configurable);
   - the visit didn't start from an ad click or a search-engine referral, if that exclusion is on;
   - optionally after N seconds on the page or 50% scroll, so it follows engagement rather than
     preceding it;
   - "Not now" was not tapped within the cooldown (localStorage, default 7 days), and at most
     once per session.

A login from either layer runs the existing post-login path. The current listing's
`ViewTracker` fires `recordInterestAction`, so the owner is notified with the existing 24h
debounce, and earlier anonymous views are re-keyed.

### Mobile app

There's no SEO constraint in the app, so it can be firmer. Open the login sheet on listing
detail, with "Skip" (the existing `requireLogin` sheet plus a skip action). Triggers:

- on the Nth listing opened (default 1);
- then cooldown days after a skip.

A "must log in, no skip" mode is possible technically, but not recommended: it would drive
uninstalls from people arriving through shared links.

### Admin setting

A new singleton `ListingLoginNudgeSetting`, following the existing `*Setting` pattern
(`ContactRevealSetting`, `SavedSearchSetting`). It is edited on the admin settings page and
served through a public cached `GET`.

| Field | Default | Meaning |
|---|---|---|
| `webOneTapEnabled` | true | Google One Tap on listing detail (and possibly home) |
| `webPromptEnabled` | false | Soft prompt fallback |
| `webPromptAfterDetailViews` | 2 | Show from the Nth listing detail in a session (never 1) |
| `webPromptDelaySeconds` | 10 | Wait before showing, once eligible |
| `excludeAdAndSearchLanding` | true | Never on a visit that started from an ad or a search engine, on the landing page |
| `appPromptEnabled` | false | Login sheet on listing detail in the app |
| `appPromptAfterDetailViews` | 1 | Nth listing opened in the app |
| `dismissCooldownDays` | 7 | Quiet period after "Not now" / "Skip" |
| `rolloutPercent` | 100 | Share of anonymous visitors (hash of `viewerKey`) who can see it, for a controlled test |

`webPromptAfterDetailViews` has a floor of 2 in validation, so rule 2 can't be switched off by
accident.

### Measurement

- Log `login_nudge_shown`, `login_nudge_dismissed` and `login_nudge_login` with a surface tag
  (`one_tap` / `web_prompt` / `app_prompt`), via the existing analytics events.
- Success means: the share of `user:` views and `ListingInterest` per week go up.
- Guardrails:
  - listing-page bounce rate and pages per session don't drop;
  - Search Console impressions and clicks on listing URLs stay flat;
  - Ads landing-page experience and conversion rate hold.
  Roll out with `rolloutPercent` (e.g. 50%) and compare the two groups before going to 100%.

## Rollout order

1. Admin setting + public GET + analytics events.
2. Web One Tap: the most upside with no SEO risk.
3. App prompt with skip.
4. Web soft prompt at 50% rollout. Keep it only if the guardrails hold after about two weeks.

## Not doing

- A hard login wall or blurred content on web (Option A / paywall).
- Any user-agent-based difference in what the page renders.
- Telling owners about anonymous viewers.

## As built

### Admin setting

- **Storage.** Prisma model `LoginNudgeSetting` (table `LoginNudgeSetting`, id `'singleton'`),
  added in migration `20260930130000_login_nudge_setting`.
- **Service.** `apps/bff/src/listings/login-nudge.service.ts` finds the row or creates it with the
  defaults.
- **Endpoints.**
  - Public: `GET /listings/login-nudge-settings`. It adds `freeRevealsPerUser` from
    `ContactRevealSetting` so the asks can quote the reward.
  - Admin: `GET` and `PATCH /admin/login-nudge-settings`. The PATCH is a full replacement, with
    every field required.
- **Admin UI.** Settings → Login prompt (`/settings/login-nudge`).
- **Types.** `LoginNudgeSettingsDto` and `PublicLoginNudgeDto` in `@bhavano/types`.

Defaults differ from the proposal table. One Tap is off because it needs Google console setup,
and the card is on but reaches only 50% of visitors:

| Field | Default | Bounds |
|---|---|---|
| `webOneTapEnabled` | false | |
| `webPromptEnabled` | true | |
| `webPromptAfterDetailViews` | 2 | 2–50 |
| `webPromptDelaySeconds` | 10 | 0–120 |
| `excludeAdAndSearchLanding` | true | |
| `webPromptRolloutPercent` (was `rolloutPercent`) | 50 | 0–100 |
| `appPromptEnabled` | true | |
| `appPromptAfterDetailViews` | 1 | 1–50 |
| `dismissCooldownDays` | 7 | 0–90 |

The rollout percentage applies only to the web card, not to One Tap or the app.

### Shared rules: `@bhavano/types/loginNudge`

Web and app share the decision logic, with tests in `apps/bff/src/listings/login-nudge.spec.ts`:

- `classifyVisitEntry(search, referrer)` sorts the first page of a visit into one of three kinds:
  - `ad`: the URL has `gclid`, `gbraid`, `wbraid`, `msclkid` or `fbclid`, or a paid
    `utm_medium`;
  - `search`: the referrer host is a search engine;
  - `other`: everything else.
- `rolloutBucket(viewerKey)` gives a stable bucket from 0 to 99.
- `shouldShowWebLoginPrompt` and `shouldShowAppLoginPrompt` check the thresholds.
  `WEB_PROMPT_MIN_DETAIL_VIEWS = 2` enforces the web floor in code as well as in validation.

### Web

- **Recording how the visit began.** `VisitEntryRecorder` in the root layout classifies the
  visit's first page and stores the result in sessionStorage (`bhavano.visitEntry`). The ad and
  search exclusion therefore lasts for the whole visit, not just the landing page, which is
  stricter than the proposal.
- **Where the asks mount.** `ListingDetailView` renders `ListingLoginNudge` only for logged-out
  non-owners. The settings come from the public GET, cached for 60s.
- **Choosing what to show.** On each listing view the component counts the view
  (`bhavano.nudge.detailViews`, sessionStorage) and picks at most one ask:
  - The card, if `shouldShowWebLoginPrompt` passes. It appears after `webPromptDelaySeconds` at
    the bottom of a phone screen, or in the bottom-right corner on desktop. It shows at most once
    per session (`bhavano.nudge.shown`). "Not now" starts the cooldown
    (`bhavano.nudge.dismissedAt`, localStorage).
  - Otherwise, Google One Tap, if it's enabled and `GOOGLE_CLIENT_ID` is set. It appears after
    2s.
  - They're never shown together. On a phone One Tap is itself a bottom sheet, and two stacked
    asks read as a wall.
- **One Tap login.** It posts the ID token to a NextAuth credentials provider,
  `google-one-tap`, which calls the existing BFF `loginWithGoogle`. After that it follows the
  same post-login path as the Google button, including the basics prompt for new users and the
  `signup_complete` event. **Setup needed before enabling it:** add `https://bhavano.com` and
  `https://www.bhavano.com` as Authorized JavaScript origins on the Google OAuth web client.
- **After a login from either ask.** The component calls `recordInterestAction(listingId)`, so
  the owner hears about it right away.
- **Analytics.** GTM events `login_nudge_shown`, `login_nudge_dismissed` and `login_nudge_login`,
  each with a `surface` of `web_prompt` or `one_tap`.

### App

- **When it asks.** `useListingLoginNudge(listing)` on `app/listing/[id].tsx` waits until the
  stored session has been read (`sessionReady`), so a logged-in user is never asked. It counts
  listing opens in AsyncStorage (`bhavano.nudge.detailViews`). On the Nth open it waits 1.2s,
  then calls `requireLogin({ skippable })`.
- **The sheet.** It uses the existing login sheet with a heading ("Log in to hear back from owners
  faster"), a reward line and a "Skip for now" button. Skip, or dismissing the sheet, starts the
  cooldown (`bhavano.nudge.dismissedAt`) and resets the counter.
- **After a login.** The screen's existing `accessToken` effect records interest.
- **Analytics.** None yet. The app has no custom-event pipeline, so measure with the rise in
  `user:` views.

### Contact reveal: WhatsApp

After a phone number is revealed, web and app show a "WhatsApp the owner" link. It opens
`wa.me/<number>` with an enquiry about the listing already typed in (`@bhavano/types/whatsapp`).
A bare 10-digit number gets `91` added in front. In the app the revealed number can also be
tapped to call. On web the link fires the `contact_owner_whatsapp` event.

### Deferred

Price-drop alerts and booking a visit were suggested as further reasons to log in. Each is a
separate feature and neither has been started.
