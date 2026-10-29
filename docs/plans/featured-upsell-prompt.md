# "Make your ad Featured" prompt for owners (2026-10-30)

Agreed 2026-10-28 / 29. Before this, an owner with a live ad that is not Featured saw the offer only right after posting, in the automatic in-app messages (4 / 24 / 72 hours after going live) and on the Feature Ad button on My listings; nothing appeared when they simply opened My listings or their own listing page.

## What it does
- **Dialog on My listings** (web): once per browser session, for the owner's **newest live ad that is not Featured**. It shows that ad's own numbers (views, interested people, saves; only those above zero) and the first five true Featured benefits (`FEATURED_BENEFITS`, the same list as the post-ad offer). "Make it Featured" opens the normal Boost dialog; "Not now" or the X dismisses it.
- **Slim card on the owner's own listing page**: a card at the top, never a dialog (that page is also a search page, and only its owner can see the card). Same rules and the same per-ad memory.
- **Rules** (`pickFeaturedUpsell` in `@bhavano/types/featuredUpsell`, unit tested): at most once per session; an ad younger than `minAgeHours` (default 1) is left alone; after "Not now" the ad is quiet for `quietDays` (default 3); one ad is offered at most `maxShowsPerAd` times (default 3), after which the next newest eligible ad is offered; never for a Featured, inactive or not-live ad.
- **Memory** is in the browser (localStorage per ad, sessionStorage for the session), so it is per device; the website and app do not share it. Every access is guarded: blocked storage means the prompt may show again, never an error.
- **Admin:** Admin -> Settings -> Featured prompt (`FeaturedUpsellSetting`, id `default`). **Off by default**; separate switch for the listing-page card; the three numbers above. A read failure counts as off.
- **Events** (dataLayer): `featured_upsell_shown`, `featured_upsell_clicked`, `featured_upsell_dismissed`, each with `surface` `my_listings` or `listing_page`. Compare Featured purchases per day with the prompt on and off.

## Not built
- The app (mobile) has no equivalent yet; it needs its own dialog and an app update.
- No server-side record of how often it was shown (the memory is the browser's), so frequency across devices is not capped.

## Cautions
- Stacking: the 4 / 24 / 72 hour in-app messages, the login dialog and this prompt can all reach the same person. The caps are meant to keep that tolerable; if owners complain, raise `quietDays` or lower `maxShowsPerAd`.
- Do not state numbers or benefits that are not true (see the "verified" clean-up): this prompt only uses the ad's own counts and the shared benefits list.
