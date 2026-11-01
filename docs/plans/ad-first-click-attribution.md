# Ads that bring people who post later (2026-11-01)

Reported: people click a Google ad, sometimes log in, then browse again hours or days later as "direct" or "www.google.com / referral" and post an ad.
Those posts were not credited to the campaign, in Campaign analytics or (in one case) in what is reported to Google Ads.

## What the system did
- **Campaign analytics counted per session.** A sign-up, post or payment was credited to a visit only if it came within 24 hours of that session
  starting. A later direct session got the credit. (This is also why a payment was counted twice when one user had two sessions; fixed the same day, see
  `admin-campaign-analytics.md`.)
- **Google Ads conversions use the account's first landing.** The permanent 30-day cookie `bhavano_acq` holds how the visitor first arrived, copied onto the
  user at sign-up (`User.acquisition*`, including `acquisitionGclid`), and the Post ad success / New registration uploads send that gclid. So a return
  visit by the same browser within 30 days already counted for Google Ads. Two gaps remained: the cookie was written once and never replaced, so a visitor
  whose first visit was direct or organic kept "direct" even when they later came through an ad; and the report never read the saved first landing.
- **Still a gap, not fixed:** the mobile app has no cookie, so a web ad click followed by a sign-up in the app loses the gclid (the iOS app is not live yet).

## What changed
1. **Cookie** (`apps/web/src/lib/acquisitionCookie.ts`, `middleware.ts`): a visit that arrives from an ad (a `gclid`, or `utm_medium` `cpc` / `paid_social`) now
   replaces a cookie that holds a direct, referral or organic landing. A cookie that already holds an ad click is left alone (the first ad click wins, no
   churn). A bare `fbclid` is not an ad click, because organic Facebook clicks carry it. Applies from now on; people who already signed up keep what was saved.
2. **Campaign analytics** (`attribution` on `GET /admin/analytics/campaigns`, "Credit sign-ups, posts and payments to" on the page): **The person's first ad
   click** credits sign-ups, posted ads, payments and revenue to the campaign, ad group, ad or source saved on the account, whenever in the range they
   happened. Default stays **The visit it followed (24 hours)**.
   - A sign-up is an account created in the range that someone logged in to (imported owners awaiting a claim have no login and are not counted).
   - Posted counts people with a user-posted listing created in the range (not `awaiting_claim`); paid counts people with a paid payment in the range.
   - Visits, bots and engaged still count sessions in the range. A row can show conversions with no visits (the click was earlier), and the percentages divide
     one population by the other, so they are not a conversion rate.
   - The "Arrived from" and campaign drill-down filters apply to the account's first landing; traffic, platform and device apply to the visits column only.
   - Grouping by landing page cannot use it (an account has no landing page) and stays on visit attribution; the page says so.
3. **Fix found on the way:** "Not from an ad" dropped every visit with no medium (all direct traffic) because `NOT (false OR NULL)` is NULL. Now
   `NOT COALESCE(..., false)`, on the visit side and the new account side.

Tested on a real Postgres with one user who clicked an ad, signed up, came back direct and posted and paid: visit mode gave the ad the sign-up only and
"direct" the post and payment; first-click gave the ad the sign-up, post and payment. Also checked ad group, ad, source, Google-only, organic and drill-down.

## To watch
- Compare the two modes for the same week; the difference is what the old view gave to "direct". Expect Google Ads to gain post and paid, "direct / none" to lose.
- Whether the new cookie rule shows up as more `acquisitionGclid` on new accounts (check in a week).
