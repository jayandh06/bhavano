# Plan: hold on to sellers who start an ad and leave without posting

Status: week 1 built (2026-11-15): 2b, 2c and 3c on the website (desktop and mobile browser), see section 10. The rest is a proposal. Builds on [`post-ad-simpler-form.md`](post-ad-simpler-form.md) (funnel baseline in 2b,
v2 form), [`post-ad-draft-autosave.md`](post-ad-draft-autosave.md) (browser draft, built),
[`admin-assisted-posting.md`](admin-assisted-posting.md) (post on a seller's behalf, built),
[`pending-checkout-payment-reminder.md`](pending-checkout-payment-reminder.md) (unpaid listings, built),
[`owner-win-back-notifications-and-mobile-email-capture.md`](owner-win-back-notifications-and-mobile-email-capture.md) and
[`post-ad-via-whatsapp.md`](post-ad-via-whatsapp.md) (proposed, not built). `/post` is not indexed, so nothing here touches SEO.

## 1. Where sellers leave (admin Post-ad funnel, 22 Oct to 14 Nov 2026)

| Step | Sessions | Lost here |
|---|---|---|
| Reached Details | 833 | |
| Went on to Preview | 427 | **406 (49%)** left Details |
| Published | 317 | **110 (26%)** left between Preview and Published |

Of the 406 who left Details without tapping Preview: 116 (29%) last touched the **map/location**, 115 (28%) **touched nothing** (mostly
bounces), the rest were spread thinly (price, description, title, a handful each). Of those who tapped Preview while blocked, the first
blocker was **photos** about 40% of the time, then location, title and description. The top of the funnel (choosing a category) is mostly
non-Indian and bot-like traffic, not sellers (2c in the simpler-form plan), so this plan starts at Details.

## 2. The key constraint: most leavers are anonymous

Login is asked only at the last step (`onSubmit`, "Post ad"). Someone who leaves Details has usually never logged in, so we have **no phone,
email or push token** for them. The only thing that survives is the browser draft (`post-ad-draft-autosave.md`), and only on the same device
and browser. So the plan has three layers, and each needs something different:

1. **Fewer reasons to leave** (works for everyone).
2. **A way to reach them before they go** (turns an anonymous visitor into someone we can remind).
3. **Bring them back afterwards** (only possible for people we can reach, or through ad remarketing).

Before choosing, measure how many Details leavers were in fact logged in (returning users). Query in section 7.

## 3. Layer 1: fewer reasons to leave (in the form)

| # | Change | Targets | Effort | Notes |
|---|---|---|---|---|
| 1a | **Measure v2's location row first.** v2 (search first, one-tap "Use my current location") went to 100% on 14 Nov. | 29% of Details exits | none | Compare map exits before and after 14 Nov with the Country: India filter. Only build more if it hasn't moved. |
| 1b | If the map is still the main exit: **"Pin it later"**. Pick city and area, publish with the pin placed at the area's centre and flagged approximate; ask for the exact pin on the success screen and in a reminder. | map exits | 2-3 days | Revisits the mandatory-pin decision ([`mandatory-pin-and-owner-location-edit.md`](mandatory-pin-and-owner-location-edit.md)); needs owner's OK. |
| 1c | **Title and description written for them.** Prefill the title from category, BHK and area; make "Write it for me" (AI, already built) the main action instead of an option. | title, description blockers | 1-2 days | Section 4.3 of the simpler-form plan, not built yet. |
| 1d | **Photos:** clearer "take photos now" on phones (open the camera directly), and allow **posting with fewer than the minimum, hidden until photos are added**. | 40% of Preview blocks | 1 day / 3 days | The second half changes a listing-quality rule; owner decision. |

## 4. Layer 2: reach them before they go

| # | Change | Effort | Notes |
|---|---|---|---|
| 2a | **"Save and finish later"** link on Details once something is filled in: asks only for a mobile number (WhatsApp), no OTP. We send one WhatsApp message with a link that reopens the ad. | 2-3 days with 3a | Needs an approved WhatsApp utility template and the number's consent wording on the box. The number is not a login; the link opens the draft, and posting still logs in as today. |
| 2b | **"Let us post it for you"**: a WhatsApp click-to-chat link on Details and on the Preview blocker ("Stuck? Send us the photos and details on WhatsApp and we'll post it"). Staff use the existing admin-assisted posting. | half a day | Cheapest and most human. Costs staff time per seller; cap it by city or hours if volume grows. |
| 2c | **Exit question (one tap):** on desktop, when the mouse leaves the window on Details; on phones, after a long idle on Details. "What stopped you? Location / Photos / Too many fields / Just looking / Other" with the 2a and 2b offers under it. | 1 day | Also gives the reasons the funnel can only guess at. Shown at most once per draft. |

## 5. Layer 3: bring them back afterwards

| # | Change | Who it reaches | Effort | Notes |
|---|---|---|---|---|
| 3a | **Server-side draft.** When the visitor is logged in or left a number (2a), save the draft on the server as well as in the browser, keyed to the user or number, so a reminder link works on any device. | logged-in and 2a leavers | 2-3 days | New table; photos stay in the browser (IndexedDB) unless already uploaded, so the reopened draft may ask for photos again. Delete when posted or after 30 days. |
| 3b | **Unfinished-ad reminder job** (in `seller-jobs`, like `PendingCheckoutReminderJob`): about 2 hours and 24 hours after the last edit, push, then WhatsApp, then email, in the user's channel preference. At most two, never after a post, respects notification settings. "Your 2BHK in Indiranagar is almost ready: 2 things left. Finish in a minute." | logged-in and 2a leavers | 2 days after 3a | Measure as "posted within 7 days of a reminder". |
| 3c | **A "Finish your ad" banner across the site** (header or home) whenever a browser draft exists, not only on `/post`. | anonymous, same device | half a day | Check first whether the draft offer already shows outside `/post`. |
| 3d | **Ad remarketing** for anonymous leavers: a GA4 or Google Ads audience "reached /post/details, no post_ad_success, last 30 days" used as a bid boost on the existing owner campaigns, not a new campaign. | anonymous, any device | half a day, plus spend | Paid, and only works on the ads side. Exclude people who did post. |

## 6. The Preview to Published leak (26%)

This is a different problem: they reached the end. Before building anything, split the 110 sessions by what happened after Preview, from the
funnel events: login prompt shown but not completed, OTP sent but not verified, phone-verification step, Featured offer or checkout
cancelled. The cancelled-checkout path already has a reminder and a "Post without Featured" escape; OTP failures would point at
[`whatsapp-otp-primary-sms-fallback.md`](whatsapp-otp-primary-sms-fallback.md).

## 7. Measure first (one query, run on the server like the other production queries)

How many Details leavers in the last 30 days were logged in, which decides how much 3a/3b can recover before 2a exists:

```sql
WITH d AS (SELECT DISTINCT "sessionId" FROM "PageView" WHERE path = '/post/details' AND "createdAt" >= now() - interval '30 days'),
     s AS (SELECT DISTINCT "sessionId" FROM "PageView" WHERE path = '/post/success' AND "createdAt" >= now() - interval '30 days')
SELECT (v."userId" IS NOT NULL) AS logged_in, COUNT(*) AS sessions
FROM d JOIN "Visit" v ON v."sessionId" = d."sessionId"
WHERE d."sessionId" NOT IN (SELECT "sessionId" FROM s)
  AND v."ipCountry" = 'India' AND v."isBot" IS NOT TRUE
GROUP BY 1;
```

## 8. Suggested order

1. **Week 1, cheap:** run the query in 7 and the Preview-leak split in 6; ship **2b** (WhatsApp "we'll post it for you"), **2c** (exit
   question) and **3c** (site-wide finish banner); check **1a** (has v2's location row moved map exits?).
2. **Week 2:** **1c** (title and description written for them); **3d** (remarketing audience as a bid boost).
3. **Weeks 3-4:** **3a + 3b + 2a** together (server draft, reminder job, "finish later" number capture), after the WhatsApp template is
   approved. Web and app both: the app needs a store build for the Details-step pieces.
4. Only if exits stay high: **1b** (pin later) and **1d** (fewer photos), which change listing-quality rules.

**Success measure:** India sessions reaching Details that publish within 7 days (today about 38%, 317 of 833), plus posts that came from a
reminder or a WhatsApp hand-off, counted separately.

## 9. Decisions needed

1. Is staff time available to post ads for sellers over WhatsApp (2b), and in which hours?
2. OK to ask for a WhatsApp number without OTP for "finish later" (2a), with consent wording?
3. Open to relaxing the exact-pin rule (1b) or the photo minimum (1d), or keep them as they are?
4. Spend for remarketing (3d): a bid boost on existing campaigns only, or none?

## 10. Week 1 as built (2026-11-15), website only

- **2b, "Let us post it for you":** a line under the Preview button on Details, and in the exit question below. It opens the Contact
  form (owner's choice, instead of a WhatsApp number) at `POST_FOR_ME_PATH` (`/contact?topic=posting&help=post-for-me`, in
  `packages/types/src/support.ts`): the existing "Trouble posting or editing an ad" topic, with the message box already started ("Please
  help me post my ad on Bhavano. What I want to list..."). The form already takes up to 3 photos. Staff post the ad with
  admin-assisted posting. Opens in a new tab, so the form stays as it was. No new topic, so no migration.
- **2c, the exit question:** `PostExitPrompt.tsx`, a card (not a modal) on Details while something is still missing. Desktop: when the
  mouse heads for the tab bar, after at least 15 seconds on the step. Phones (no hover): after a minute with no tap, typing or scrolling.
  Five answers (location / map, photos, too many questions, just looking, something else), each showing a short tip, plus the hand-off
  and "your ad is saved on this device". At most once a week per browser. Not shown to admins.
- **3c, "Finish your ad":** `UnfinishedAdPrompt.tsx` in the root layout, a floating card (no layout shift, not in the server HTML) on
  every page while a browser draft exists, except `/post`, listing pages (they have their own bottom login card) and `/claim`.
  "You have an unfinished ad: Apartment for sale, saved on this device", with Finish it (to `/post`, which offers the draft) and Hide
  (for that draft only; editing the draft brings it back). While it shows, the profile-completion pill in the same spot is hidden.
- **What admin sees:** each event is a Page-visits entry, read as words: `/post/exit-reason?event=shown|answered|dismissed|post_for_me`
  ("Exit question: photos") and `/post/finish-prompt?event=shown|clicked|dismissed`; tests in `apps/admin/src/lib/pageTrail.test.ts`.
  Count answers with `SELECT path, count(*) FROM "PageView" WHERE path LIKE '/post/exit-reason%' GROUP BY 1;`.
- **Checked** in a browser against a local stack: the link and both exit-question triggers (desktop and a 390 px phone with touch), a tip
  per answer, not asked again after a reload, the Contact form starting written, the finish prompt on the home page, hidden on `/post`,
  hide-able, and every event stored once. Whole browser suite and unit tests pass.
- **Not done:** the app (needs a store build; next), and the measurement queries (sections 6 and 7, and whether v2's location row cut map
  exits), which need production data.
