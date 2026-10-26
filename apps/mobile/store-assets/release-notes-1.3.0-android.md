# Bhavano 1.3.0 — Android release notes

Play Console → Release → Production (or Internal testing) → "Release notes". Play allows 500
characters per language.

## Play "What's new" (en-IN)

```
<en-IN>
What's new in 1.3.0
• Easier posting: choose sell, rent or lease, then your category, in three clear steps. Reuse your last ad and jump to anything left to fix.
• Pin your property on the map for an exact location.
• Compare your ad with its Featured version before you decide.
• Blog guides and free calculators (EMI, rent vs buy and more) in the app.
• Area filter on All; Requirements and Blog on the home tabs.
• Log in with a code sent on WhatsApp.
• Fixes and improvements.
</en-IN>
```

## Longer changelog (for the team, not for Play)

Covers everything since the last released Android build (1.1.0). 1.2.0 was built but never
uploaded to Play, so its changes ship here too.

**Posting**
- The first screen asks what you want to do (sell, rent, lease) and then the category; three steps,
  each headed by a plain question.
- Details step: an "N left" counter and "jump to first problem", messages under a field as you
  leave it, reuse of your last ad, quick-pick chips, photos asked for earlier, a saved indicator.
- A map pin is required: city and area come from the pin, and owners can edit the location later
  from the edit page.
- After posting, a dedicated Featured offer screen shows your ad as it is and as Featured side by
  side, with what Featured adds (priority placement, gold badge, 12 photos and 5 videos of up to 3
  minutes, instant message alerts), and a one-tap "No thanks". Closing the payment window goes
  straight to "Your ad is live!". The confirmation names who the ad is for (tenants, buyers, PG
  seekers…).
- Featured: after paying, the ad reloads with the new photo/video limits; a Featured performance
  report on the edit page; a shareable poster.
- Ads held off the site for a few minutes before going live show "Your ad is posted! It goes live at
  …" (only when an admin turns that on).

**Browsing**
- Blog guides in the app (menu and the home tab strip).
- Free calculators (EMI, home loan eligibility, rent affordability, rent vs buy, down payment, area
  converter) as native screens. Opening Tools no longer ends in "Unmatched route".
- Requirements and Blog sit in the home tab strip with the same header and collapsing bar as Home.
- Area filter on the All tab once a city is chosen.
- Search understands old city names (Bangalore, Bombay…).
- End-of-feed sections on Home: how it works, guides, tools and FAQ.

**Account**
- Login by phone sends the code on WhatsApp first, with SMS as the fallback.
- "Delete my account" moved below "Log out".
- Plans shows ads that were posted but not yet paid for, so a failed payment can be finished.

**Fixes**
- A stray "'n" after "Make it Featured" (a missing arrow character on some phones) is now a proper arrow icon.
- Scrolling to the first problem in the post form no longer throws a layout error.
- The app can show a blocking "Update required" screen if a minimum version is ever set.

**Not in this build:** App Store in-app purchases are iOS only.
