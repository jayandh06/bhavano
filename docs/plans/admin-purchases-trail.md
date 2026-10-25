# Admin: purchases and the trail behind an upgrade

Status: built 2026-10-25 (BFF, web, admin, mobile). Mobile needs a release for its part.

## Why
A seller posted a plot on 21 Oct and bought Featured on 25 Oct. Admin showed nothing: the payment sat in the Payments screen only,
the user page and the listing page listed no purchases, and the Page visits row for his session was dated 21 Oct because that is
when the browser session started (the cookie lives for weeks), so a look at "today" never found it. Nothing recorded the Featured
screen being opened or the Pay tap either, and the payment's "From" was blank.

## What changed
- **Purchases panel** on the admin user page and the listing page (`components/PurchasesPanel.tsx`): every payment, newest first, with
  when the checkout started, what was bought (and for how many days), any discount code, amount, status (paid, started but not
  paid, failed, refunded), when it was paid, and where it was started from. Failed and abandoned checkouts show too. Data from
  `GET /admin/payments` (now also filterable by `listingId`). Each panel links to the full Payments screen.
- **Page visits by last activity.** `Visit.lastActivityAt` (migration `20261025120000_visit_last_activity`, backfilled: every session
  starts as its start time, recent ones move to their newest page view) is stamped on every page view. The Page visits date range now
  means "active in the range", the list sorts by **Last active** (new default), and a session started on an earlier day shows
  "started <date>" under its last-active time. Sort by "started" is still there. Older rows with no value read as their start time.
- **Featured upgrades outside the post flow are logged.** Opening the dialog from My listings, choosing a plan, tapping Pay, paying,
  a free activation, cancelling the payment window, an error, and closing it without buying are written as `/post/action?screen=boost&event=...`
  (web: `BoostProvider`; mobile Android: `BoostModal`). The trail reads "Featured upgrade — tapped Pay (30 days)".
- **Purchase source `my_listings`** is recorded for purchases from the Boost / Feature Ad button in My listings (web and Android app),
  shown as "My listings" in Payments and the Purchases panel. Existing payments are not changed.

## Caveats
- A payment made before this (such as the 25 Oct one) has no events and no source; its trail is the plain `/my-listings` visits before and
  after, now visible under "Last active" and in the Purchases panel.
- The iOS app is not live yet; its purchase sheet is untouched.
- The mobile My listings modal (`BoostModal`) still orders without the automatic promo code the post-flow picker applies, so the same
  Feature can show a different price there than right after posting. Not changed here; worth a look.
