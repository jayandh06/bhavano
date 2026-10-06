# Sitelinks for Metro-Seeker Intent

## Status: applied 2026-10-06

**Update (2026-10-06):** applied via `ads_sitelinks.py`, confirmed live and `ENABLED` by reading
back `campaign_asset` for this campaign — all 4 sitelinks below are linked exactly as planned.
Pending Google's policy review (check Assets > Sitelinks for approval status).

## Context

`Metro-Seeker Intent` (campaign id `24297610212`, see
[`seeker-intent-campaign.md`](seeker-intent-campaign.md)) has no ad extensions at all today — no
sitelinks exist anywhere in the account's tracked config. The ask: add sitelinks to this campaign.

## Constraint this campaign already has

`seeker-intent-campaign.md`'s own ad-copy rule: *"search/browse language, never posting
language ... No mention of posting, free listing, or 'sell/list' anywhere in this campaign's
copy."* This campaign exists specifically to reach seekers (renters/buyers), not posters —
mixing the two intents in one campaign was already considered and rejected when the campaign was
built. Sitelinks are part of the ad's displayed copy, so they inherit this rule: no "Post Ad
Free"/"List Your Property" style sitelink here, unlike the poster campaigns.

## Scope

Sitelinks are linked at **campaign level** (`CampaignAssetService`), which means they show
regardless of which of the 4 ad groups (Bengaluru/Pune × rent-lease/buy) triggered the ad — a
city-specific sitelink would show to the wrong city's searchers half the time. So: generic,
non-city-specific sitelinks, matching the user's own call on this.

## The 4 sitelinks

All four point at real, already-existing site functionality — nothing new was built or invented
for this:

| Asset name | Link text | Description 1 | Description 2 | Final URL |
|---|---|---|---|---|
| `bhavano-sitelink-browse-all` | Browse All Listings | Flats, PGs, plots & more | Every city, updated daily | `https://www.bhavano.com/` |
| `bhavano-sitelink-new-listings` | New Listings Daily | Fresh listings added daily | Be the first to enquire | `https://www.bhavano.com/?sort=newest` |
| `bhavano-sitelink-owners-only` | Contact Owners Directly | Skip the broker, save on fees | Message owners directly | `https://www.bhavano.com/?postedBy=owner` |
| `bhavano-sitelink-app` | Download the App | Faster browsing & alerts | Available on Android | Play Store link, `utm_medium=google_ads_sitelink&utm_campaign=metro_seeker_intent` |

Notes on each:
- **Browse All Listings** → `/` is deliberately the all-cities, all-categories view (recent,
  explicit decision — `apps/web/src/app/page.tsx`'s own comment: *"'/' is every city and every
  category"*), not a guess or a stand-in for one city.
- **New Listings Daily** → `?sort=newest` is a real, existing sort value
  (`apps/web/src/lib/seoRoute.ts`'s `SORT_VALUES`).
- **Contact Owners Directly** → `?postedBy=owner` is the existing "Owners only" toggle
  (`apps/web/src/components/home/OwnersOnlyToggle.tsx`) — seeker-facing (skip agent fees), not
  posting language, and not a "verified" claim (checked separately: no verified-only filter
  exists in the product, so that wording was deliberately avoided).
- **Download the App** → no on-site app-download landing page exists yet
  (`docs/plans/drive-users-to-android-app.md`: App Links are "half done"), so this links straight
  to the Play Store with its own `referrer` UTM, distinct from every other existing placement's
  `medium` value, so Play Console's acquisition report can attribute installs from this sitelink
  specifically.
- No "Verified Listings Only" sitelink — checked and confirmed no such filter exists in the
  product; inventing one would make a claim the site can't back up.

Rejected: dropping to 3 sitelinks and skipping the app one — kept at 4 since Google rotates and
serves more sitelinks (up to its own display limits) with a larger pool, and all 4 are genuinely
distinct destinations, not padding.

## Implementation

New script `ads_sitelinks.py`, same shape as `ads_image_assets.py` (the only existing extension
script): creates `Asset` rows (`type = SITELINK`, `sitelink_asset.{link_text,description1,
description2}`, `final_urls`) and links them to the campaign via `CampaignAssetService`
(`field_type = SITELINK`), both in one `MutateGoogleAdsRequest` using temporary negative resource
ids — so `--validate` checks the whole change without creating anything, and a real run either
fully applies or not at all.

Run:
```
python ads_sitelinks.py --dry-run     # read-only, prints the plan
python ads_sitelinks.py --validate    # Google validates, nothing is created
python ads_sitelinks.py               # applies
python ads_sitelinks.py --remove      # rollback: unlinks (assets stay in the library)
```

## After applying

Sitelinks go through Google's policy review (same as the image assets did) — check
Assets > Sitelinks the next day for approval status. Final URL suffix
(`docs/plans/capture-google-ads-click-attribution.md`'s campaign-level `gclid=...` suffix, if set
on this campaign) applies automatically to sitelinks too — nothing extra needed here for that.
