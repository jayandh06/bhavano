# Scheduled go-live: hold a free ad off the site until the Posted confirmation time

Requested 2026-10-22. Free ads normally go live the moment "Reach more …" is pressed. With this on,
a free ad stays off the site for the same number of minutes as the **Posted confirmation** wait
(Admin → Settings → Posted confirmation), then goes live and the "your ad is posted" message goes out
at that moment.

## How it works
- **One time setting.** The wait is the existing Posted confirmation `delayMinutes` (default 60). A new
  checkbox on the same admin page, **"Don't show a free ad to buyers until the wait above has passed"**
  (`PostedConfirmationSetting.holdAdLive`), turns the hold on. It is **off by default**, because the
  60-minute default would otherwise hide every new free ad for an hour the moment this deploys.
- **State.** `ListingPublishState.scheduled` plus `Listing.publishAt`. Every public query already
  filters `publishState = 'live'`, so a scheduled ad is invisible to buyers (feed, search, sitemaps,
  direct link) with no further change. The owner and admins can still open it.
- **Create.** `ListingsService.create` sets `scheduled` / `publishAt = now + delay` when the hold is on,
  the delay is above zero, and the ad is a seller's own post from the website or app (it carries a
  session id). Not held: admin-assisted ads, bulk imports, outreach posts, and ads that wait on a
  posting fee or Featured payment (`pending_checkout`, which goes live when paid). Decision in
  `scheduledPublishAt` (`posted-confirmation-settings.ts`, tested).
- **Going live.** `ScheduledPublishJob` runs every minute and calls `publishDueScheduled`, which uses
  `completePendingPublish`: saved-search alerts, the Google Ads conversion, the posted confirmation,
  `publishedAt` set to the real time. `completePendingPublish` now flips the row with a conditional
  `updateMany`, so the job and a payment webhook arriving together cannot both run the side effects.
- **Overrides.** Paying for Featured makes a scheduled ad live at once
  (`PaymentsService.fulfilPaidPayment`). An admin can **Publish now** from the listing's moderation
  panel (`forcePublishListing`, with a moderation-thread note).
- **Seller wording.** Web and mobile: the confirmation screen says "Your ad is posted! It goes live at
  3:40 pm … Make it Featured to go live right now" while scheduled and not Featured; My listings shows a
  "Going live at 3:40 pm" badge. Times are India time (`@bhavano/types/goLive`).
- Migration `20261022120000_scheduled_go_live` (enum value, `publishAt`, `holdAdLive`, index).

## Not covered / to know
- The reaching-the-live-screen release for the *confirmation message* is unchanged, but for a held ad
  it finds nothing live to send; the message goes out at go-live instead.
- `expiresAt` is still set at posting time, so a held ad's 30 days start a few minutes to hours
  earlier than its go-live. Negligible at these waits.
- Older app versions do not know `scheduled`: they show "Your ad is live!" for a held ad. The admin
  page says so; turn the hold on after the new app is the common version.
- The edit-listing page and the admin listings table show only a plain "Scheduled" state, not the
  time.

## Update 2026-10-23: a "Going live" tab in Listing moderation
Scheduled ads were already returned by the admin listing query (nothing filters on publish state), but they sat among the
day's other ads and nothing said when they would go live. Listing moderation now has a **Going live** tab (publish state
`scheduled`, no date window like Awaiting claim), and the status badge reads "Scheduled — goes live <time>"
(`AdminListingRowDto.publishAt`). From there an ad opens like any other, so it can be edited, deleted or released with
"Publish now". Checked on production on 2026-10-23: one scheduled ad ("Test test test") existed and passed the default
filters, so the earlier "not showing" report may have come from the default Needs review tab or the one-day window; if a
scheduled ad is still missing from All listings, send its link.
