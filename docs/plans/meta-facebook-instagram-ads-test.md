# Facebook + Instagram ads: a low-budget test in the same cities as Google Ads

## Status: budget approved (Rs 400 a day, 14 days); admin tracking built (2026-10-30); Pixel / Conversions API not built yet.

### Tracking in admin (built)

Put this in each ad's **URL parameters** field in Ads Manager (Meta fills the `{{...}}` values per click):

```
utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&meta_campaign_id={{campaign.id}}&meta_adset_id={{adset.id}}&meta_ad_id={{ad.id}}
```

- The website stores `meta_campaign_id`, `meta_adset_id`, `meta_ad_id` in the same `Visit.campaignId` / `adGroupId` / `adId` columns a Google Ads click fills (Meta ids are 15+ digits, Google's shorter, so they never collide), plus `fbclid` in a new `Visit.fbclid` column (kept for the Conversions API; never treated as "paid" by itself because organic Facebook clicks carry it too).
- Admin -> Campaign analytics counts `utm_medium=paid_social` as a paid click (like a gclid or `cpc`), so the Paid filter, Campaign / Ad group / Ad grouping and the sign-up -> posted -> paid -> revenue columns work for Meta exactly as for Google. A Meta campaign not yet in `campaign-names.ts` is labelled with its `utm_campaign` ({{campaign.name}}); add ad set and ad names there for readable rows below campaign level.
- Admin -> Page visits shows the same campaign / ad group ids and filters.
- Spend, impressions and clicks are **not** pulled from Meta (Google's cost is not in admin either); read those in Ads Manager and compare on cost per sign-up.

## Why, and what we learned from Google first

Google Ads is the only paid channel today. In the last 30 days the owner-side campaigns (Rent Out, Sell, Generic Post Ad) produced
conversions at Rs 167-218 each; the seeker campaigns spent about Rs 8,800 for 4 conversions and were paused on 2026-10-30. The lesson for
Meta: **aim at people who have something to list (owners, agents, small builders), not at people searching for a home.** Seekers do not pay;
owners buy Featured and credits. Meta has no search intent, so the ad has to create the want: "Post your property ad free, reach buyers in
your city".

## Cities to mirror (from Google Ads, read 2026-10-30)

| Group | Cities | Google daily budget |
|---|---|---|
| Metro | Bengaluru, Chennai, Delhi, New Delhi, Faridabad, Ghaziabad, Greater Noida, Gurugram, Noida, Hyderabad, Mumbai City, Navi Mumbai, Thane, Pune | Rs 700-1,200 per campaign |
| Other-Metro | Ahmedabad, Coimbatore, Jaipur, Kolkata, Lucknow | Rs 150-380 per campaign |

Meta targets a city plus a radius (use 25 km, "People living in this location"), so group them as ad sets: Bengaluru; Hyderabad; Delhi NCR (Delhi,
Gurugram, Noida, Ghaziabad, Faridabad, Greater Noida); Mumbai (Mumbai, Navi Mumbai, Thane); Pune; Chennai; Other-Metro (the five).

## Proposed test (small)

- **One campaign, objective Traffic > landing page views** at first (see "Tracking" below), later Sales/Leads once the Pixel reports Post ad success.
- **Budget: about Rs 400 a day for 14 days (about Rs 5,600 total).** Put it in the campaign (Advantage campaign budget) so Meta spends where it works. A split
  smaller than about Rs 100 a day per ad set is too thin to learn from, so start with 3 ad sets: Bengaluru, Delhi NCR, Hyderabad + Pune + Mumbai together, and
  add the rest only if those work.
- **Audience:** age 25-55, India cities above, broad (no detailed interests); let creative do the targeting. Exclude people who already have an account if we
  upload a customer list later (see docs/plans/avoid-paid-clicks-from-existing-users.md).
- **Placements:** Instagram Feed, Stories, Reels and Facebook Feed (Advantage+ placements). Mobile is where the app and WhatsApp-first users are.
- **Creative (3 variants):** (1) "Selling or renting a flat? List it free on Bhavano" image with a real listing card; (2) 15-second video of posting an ad in
  under a minute; (3) "Get calls from serious buyers" with the Featured benefit. Send to `https://bhavano.com/post?utm_source=facebook&utm_medium=paid_social&utm_campaign=<name>&utm_content=<creative>` (or the city's /post landing).
- **Special ad category:** Meta requires "Housing" in some countries; check whether Ads Manager asks for it for India and select it if prompted.

## Tracking gaps to fix before spending much

1. **No Meta Pixel / Conversions API in the repo, and `fbclid` is not captured.** Without them Meta cannot optimise for sign-ups or posted ads and
   we cannot attribute a Facebook visit to a sale. Add the Pixel through GTM (the site already runs analytics and Ads through GTM, see
   docs/plans/consolidate-analytics-and-ads-on-gtm.md) with events for sign-up and post-ad success, then a server-side Conversions API call next to the
   existing Google Ads upload (docs/plans/server-side-google-ads-conversion-upload.md).
2. **UTM capture already works:** `utm_source=facebook` lands in `Visit.source/medium/campaign`, so Admin > Campaign analytics will show paid-social sessions by
   source from day one (group by Source). Add `fbclid` to `Visit` the way `gclid` is stored if you want per-click matching.
3. **App installs:** a mobile-install campaign needs the Meta SDK in the app (a native change and a new build). Skip for the test; send to the website, which
   can then offer the app.

## What I can and cannot do

- I can write the ad copy and creatives, add the Pixel (via GTM) and `fbclid` capture, the Conversions API upload and the reporting view.
- I cannot create or change anything in Meta Ads Manager from here without being signed in to it, and spending money needs your explicit approval of the
  budget and cities. The Ads Manager link you shared already has a campaign and ad set selected (`120250394350500061`, `120250394350520061`); open it with me in the
  built-in browser if you want me to read what is there before we add to it.

## Success measure (end of day 14)

Cost per sign-up and per posted ad from Campaign analytics (source = facebook), compared with Google's Rs 167-218 per conversion; keep going only if it is
within about 1.5x of Google's, or the volume is clearly additive. Stop and keep the Pixel data if not.

## Ad images and copy (made 2026-10-30)

`python marketing/meta-ads/make_meta_ads.py` builds 9 images in `marketing/meta-ads/out/` from the owner-intent photos already made for Google Ads: three photos
in 4:5 feed (1080x1350), 1:1 feed (1080x1080) and 9:16 stories / reels (1080x1920, text kept out of the top and bottom ~250 px that the apps cover). The photo
sits whole in a band and the headline and "Post your free ad" button on a brand-green panel; nothing is cropped tight or upscaled.

| Ad | Image prefix | Headline (image) | Primary text (above the image) | Ad headline | Button |
|---|---|---|---|---|---|
| A | `post-ad-*` | Selling or renting your property? | Selling or renting out a property? Post an ad on Bhavano with your own photos and reach people searching in your city. | List your property on Bhavano | Sign Up |
| B | `sell-flat-*` | Got a flat to sell? | Got a flat to sell? Post an ad in minutes and let buyers in your city find it. | Post your ad | Sign Up |
| C | `rent-out-*` | Have a home to rent out? | Have a home to rent out? Your photos, your price, all done on your phone. | Rent out your home | Sign Up |

Use the 4:5 and 1:1 images for Feed and the 9:16 for Stories / Reels (Advantage+ placements pick the right one if all three are attached to the ad).
The copy makes no speed, price or "no brokerage" claim, only things Bhavano does today (free to post, your own photos).

## Meta account campaign (built 2026-10-30, PUBLISHED 2026-10-30; in Meta review when published)

**Published 2026-10-30** after payment was added and the user confirmed Rs 400 a day for 14 days. Placements are **Facebook and Instagram only** (Threads feed and Audience Network unticked in the ad set's Placements list; the account's Threads access is not needed then, which also cleared the Threads error on ads B and C). Ends 13 Nov 2026 11:08 IST.

Campaign **Owners - Oct 2026** (renamed on 2026-10-30 from "Owners test - Oct 2026"; the id `120250394350500061` is unchanged, so earlier visits keep the old name in admin, new ones get the new name because `utm_campaign` is `{{campaign.name}}`; objective Traffic, ad set budget, special ad category Housing), one ad set **Metro cities - owners** at **Rs 400 a day** for 14 days (30 Oct - 13 Nov 2026), website destination `https://bhavano.com/post`, goal landing page views.

Locations (12, Meta's default 17 km radius; Bengaluru 25 km): Bengaluru, Hyderabad, Pune, Mumbai, Navi Mumbai, Thane, and the Delhi NCR set New Delhi, Gurugram, Noida, Ghaziabad, Faridabad, Greater Noida. Chennai and the Other-Metro group are not in this first test.

**Why one ad set, not one per city or region:** at Rs 400 a day, separate ad sets left about Rs 133 each, close to the minimum Meta needs to learn, and Meta moves spend to the cheapest clicks on its own. It was first built as three regional ad sets (Rs 134 / 133 / 133) and merged on request. City-level results come from admin (Visit IP city) and the ad ids on every click, not from the ad set structure.

The ad set holds ads A, B and C (images per placement: 4:5/1:1 for Feeds, 9:16 for Stories and Reels; Sign up button; the URL parameters above).

Known before publishing (all resolved at publish time, see above): (1) the ad account has no access to the Instagram account's Threads profile, so ads B and C show "Ad account has no access to Threads account (#4588023)"; Meta's account placement controls cannot exclude Threads, so assign the Threads/Instagram profile to the ad account in Business Settings (ad A, the original, has no Threads value and no error); (2) the ad set shows a "securities and investments" declaration prompt (leave it unticked, it does not apply, but Meta asks you to review it); (3) the images use AI-generated photos, so consider ticking "Ad includes media created or edited with AI"; (4) Advantage+ creative and "music on Reels" were switched off on the duplicates so the images stay exactly as designed.

## Meta conversions (built 2026-10-30, off until configured)

Lets Ads Manager show sign-ups, posted ads and purchases from Meta ads, and optimise for them.

- **What is sent, and when:** server to server through the Conversions API (`apps/bff/src/ads/meta-capi.ts`), only for people who arrived from Meta (`isMetaTraffic`: a Meta click id, `utm_medium=paid_social`, or a facebook / instagram source). `CompleteRegistration` at sign-up (once per user, `User.metaConversionSentAt`), `PostAdSuccess` when an ad goes live (value = the same expected value Google gets), `Purchase` from the payment webhook (the amount actually charged, payment id as `event_id`). Each carries hashed email and phone (SHA-256, phone as digits with country code), a hashed user id, the click id as `fbc` and the Pixel's `fbp`. Nothing goes for visitors who did not come from Meta; iOS app users who denied tracking are skipped, like Google.
- **Browser:** a Pixel page view only (`apps/web/src/app/layout.tsx`, `NEXT_PUBLIC_META_PIXEL_ID`), so Meta can count landing page views and set its `_fbp` cookie, which is read at login. Single-page navigations after the first load are not counted.
- **Plumbing:** `fbclid` is stored per visit and in the acquisition cookie; at login the website sends `acquisitionFbclid` / `acquisitionFbp` and they are saved on the user (`User.acquisitionFbclid`, `acquisitionFbp`).
- **Privacy:** `/privacy` gets an "Advertising and analytics (Meta)" bullet, shown only while the Pixel id is set at build time. The mobile app does not send Meta anything.

**To switch on**
1. ~~Create the dataset~~ Done 2026-10-30: dataset **Bhavano web**, id `1112805525054100` (business `2341781933258687`, ad account `1985028886216991`), connected to the Bhavano_Ads account only; the portfolio-wide "connect all datasets to the Conversions API" option was left off. Its id is not a secret.
2. Dataset > Settings > Conversions API > Generate access token. Copy it (it is a secret).
3. Production `.env`: `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` (and, while testing, `META_CAPI_TEST_EVENT_CODE` from the dataset's Test events tab). `.env.prod.build`: `NEXT_PUBLIC_META_PIXEL_ID`. Redeploy web and bff.
4. Test: open a tagged ad link (`?utm_source=facebook&utm_medium=paid_social&fbclid=test123`), sign up, and check Test events. Remove `META_CAPI_TEST_EVENT_CODE` to go live.
5. In the campaign, change the goal from landing page views to the conversion once the dataset has received a few events.

### "Free" removed from the Meta ads (2026-10-30)

Same reason as Google (free posters never buy Featured): the copy table above is the new wording, and the images were regenerated without "free" (`post-free-*` is now `post-ad-*`; button reads "Post your ad"). The ads in Ads Manager must be edited to match (text, then new images), which sends them back through Meta review. The page they land on (`/post`) still says what the product does; only the ad text changed.

**Published 2026-10-30:** all three ads were edited and published in Ads Manager with the new copy and the regenerated "Post your ad" images (no "free" in text or pictures); they went back through Meta review. Ad B was first published with ad A's pictures by mistake (the `sell-flat-*` images had not reached Meta's library) and was republished the same day with its own sell-flat images.
