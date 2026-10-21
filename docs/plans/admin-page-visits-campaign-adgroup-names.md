# Show campaign/ad-group name on the admin "Page visits" page

## Context

The `Visit` table already stores `campaignId`/`adGroupId` (raw numeric Google Ads IDs, captured
by `apps/web/src/middleware.ts` from the Final URL suffix — see
`docs/plans/capture-google-ads-click-attribution.md`), but the admin "Page visits" page
(`/page-visits`) and its backing endpoint never surface them — only the free-text UTM `campaign`
field is shown. A raw numeric campaign/ad-group ID isn't useful to look at in the admin UI; this
adds the human-readable names next to it.

**Name resolution**: a static, hardcoded ID→name mapping in the bff (decided over a DB-synced
table) — this account is small (6 campaigns, 13 ad groups, 1 Performance Max asset group) and
changes rarely, and this mirrors the exact pattern already used this session for conversion
action IDs (`NEW_REGISTRATION_CONVERSION_ACTION_ID` etc. in
`apps/bff/src/ads/google-ads-conversion.provider.ts`). Trade-off, accepted: needs a manual edit
whenever a campaign/ad group is added or renamed in Google Ads — acceptable for an account this
size, and the mapping notes how to regenerate it.

Scope: the `/page-visits` page only (the one literally titled "Page visits" — the closest match
to "recent visits"). The smaller visit-history block on `/users/[id]` is a separate future
extension, not touched here.

## 1. New mapping file: `apps/bff/src/ads/campaign-names.ts`

```ts
/** Static id -> name lookup for this account's Google Ads campaigns/ad groups, for display only
 * (e.g. the admin Page visits table). Manually maintained — this account is small and changes
 * rarely. Regenerate by running this GAQL from the repo root:
 *   SELECT campaign.id, campaign.name, ad_group.id, ad_group.name FROM ad_group
 *   SELECT campaign.id, campaign.name, asset_group.id, asset_group.name FROM asset_group
 * (via ads_report.py's make_client() pattern) and updating the two maps below. */
export const CAMPAIGN_NAMES: Record<string, string> = {
  '24192021092': 'Generic Post Ad Intent',
  '24186759508': 'Leads-Search-1',
  '24186099720': 'Lease Property',
  '24185962743': 'Rent Out Property (Owners)',
  '24196652086': 'Sell Property (Owners/Agents)',
  '24181952825': 'Leads-Performance Max-1',
};

export const AD_GROUP_NAMES: Record<string, string> = {
  '198419903663': 'Ad group 1', // Generic Post Ad Intent
  '196798436102': 'Ad group 1', // Leads-Search-1
  '198411059486': 'Ad Group 3.1 — Lease Commercial/Office',
  '202586212471': 'Ad Group 3.2 — Lease Residential/Long-term',
  '199595834373': 'Ad Group 2.1 — Rent Out House/Apartment',
  '201241143962': 'Ad Group 2.2 — Rent Out PG',
  '201241519122': 'Ad Group 2.3 — Rent Out Villa/Independent House',
  '199363402229': 'Ad Group 2.4 — Rent Out Commercial',
  '200702632978': 'Ad Group 1.1 — Sell House/Property Online',
  '205333958048': 'Ad Group 1.2 — Sell Apartment/Flat',
  '202583649071': 'Ad Group 1.3 — Sell Villa',
  '201190284913': 'Ad Group 1.4 — Sell Plot/Land',
  '196651916541': 'Ad Group 1.5 — Sell Commercial Property',
  '6742871063': 'Asset Group 1', // Leads-Performance Max-1 (Performance Max has no ad groups)
};
```

(Full current list already fetched this session via the Ads API — values above are accurate as
of today.)

## 2. Backend: `apps/bff/src/admin/admin.service.ts` — `listPageVisits` (lines 236-293)

The row-mapping block (lines 274-289) currently builds each `PageVisitDto` without
`campaignId`/`adGroupId` at all. Add them, plus resolved names via the new maps (undefined when
an ID doesn't match — e.g. a very new campaign not yet added to the list — so the UI can fall
back to showing the raw ID rather than silently hiding it):

```ts
campaignId: v.campaignId ?? undefined,
adGroupId: v.adGroupId ?? undefined,
campaignName: v.campaignId ? CAMPAIGN_NAMES[v.campaignId] : undefined,
adGroupName: v.adGroupId ? AD_GROUP_NAMES[v.adGroupId] : undefined,
```

The `this.prisma.visit.findMany` call above already selects full `Visit` rows (no explicit
`select`, per the existing code) — `campaignId`/`adGroupId` are already coming back from Prisma,
just not passed through to the DTO yet.

## 3. Shared type: `packages/types/src/index.ts` — `PageVisitDto` (lines 420-444)

Add four optional fields: `campaignId?: string`, `adGroupId?: string`, `campaignName?: string`,
`adGroupName?: string`.

## 4. Admin UI: `apps/admin/src/app/page-visits/page.tsx`

- Header array (line 160, currently `["Time (IST)", "User", "Source", "Medium", "Campaign",
  "Landing path", "IP", "City", "Region", "Country"]`): rename `"Campaign"` to `"UTM campaign"`
  (so it's not confusable with the new column) and add `"Campaign"` and `"Ad group"` right after
  it.
- Row cells (after line 182's `<td style={tdStyle}>{v.campaign ?? dash}</td>`): add two more
  `<td>`s using the same existing `dash` constant already used throughout this table:
  `{v.campaignName ?? v.campaignId ?? dash}` and `{v.adGroupName ?? v.adGroupId ?? dash}` — name
  when resolvable, raw ID as a debuggable fallback if an ID exists but isn't in the map yet,
  `dash` when neither is present (the common case for non-ad traffic).

No changes needed to `fetchPageVisits`/`PageVisitsQuery` in `apps/admin/src/lib/bff.ts` — this is
new response data, not a new filter/query param.

## Verification

1. `pnpm --filter bff typecheck` / `pnpm --filter admin typecheck` pass.
2. Visit `/page-visits` in the admin app locally, confirm the two new columns render — check a
   row known to have `campaignId`/`adGroupId` set (any signup/visit captured since the Final URL
   suffix went live) shows the resolved name, and a plain organic/direct visit shows "—" in both
   new columns without erroring.
3. Spot-check one ID intentionally not in the map (temporarily) to confirm the raw-ID fallback
   renders instead of a blank cell or a crash.

## Update 2026-09-26 — why some rows showed numbers

The maps had not been regenerated since 2026-09-06. In the meantime the account gained four
"Other-Metro-…" campaigns (with 14 new ad groups, e.g. "Ad Group 2.5 - Rent out Furniture") and the
original campaigns were renamed with a "Metro-" prefix, so every new id showed as a bare number.
Regenerated from the Ads API (10 campaigns, 27 ad groups, 1 asset group).

Two ids seen in real visits (campaign `12135962218`, ad group `493144636151`, 3 visits on
2026-09-26) are not in this account at all — not even as removed items — so they cannot be named
from it; they most likely come from a different Google Ads account sending traffic to the site.

The static approach means this will recur whenever a campaign or ad group is added or renamed:
re-run the GAQL in `campaign-names.ts`'s header comment. A scheduled sync from the API would
remove that chore if it becomes frequent.

## Update 2026-10-08 — two more campaigns added

Regenerated again — the account gained `Metro-Seeker Intent` (6 ad groups: Bengaluru/Pune/Kolkata
× Rent/Buy Seekers — see `docs/plans/seeker-intent-campaign.md`) and
`Other-Metro-Lease Property-MaxConv` (2 ad groups, mirroring the original Lease 3.1/3.2 — the
original `Other-Metro-Lease Property` is now paused, suggesting this is an A/B split testing
Maximize Conversions against the shared Target CPA portfolio). 12 campaigns, 35 ad groups, 1 asset
group total now.

## Update 2026-10-21 — why some ad clicks had no Campaign / Ad group, and the fix

**Symptom:** some Page visits rows from Google ads showed a dash in Campaign and Ad group. About 95% of rows are not ad
clicks at all (direct, Facebook, WhatsApp, organic), and a dash there is correct. Of the 1,200 ad-click visits (those
with a `gclid`) in the 14 days to 2026-10-21, **131 (11%)** had a click id but no campaign or ad group.

**Cause 1 (122 of the 131): the Seeker Intent campaign had no Final URL suffix for its first three weeks.**
`Metro-Seeker Intent` (id 24297610212) was created 2026-09-30 without
`gclid={gclid}&campaignid={campaignid}&adgroupid={adgroupid}&adid={creative}`; Google Ads change history shows the suffix was
added on 2026-10-19 08:40 UTC. The missing rows are on the three "Rent Seekers" landing pages
(`/bengaluru|pune|kolkata/rent-lease`) between 6 and 18 October and stop after the 19th. Every other campaign had the suffix
from the start; no ad, ad group or keyword has a suffix of its own that could override it. Redirects (apex to www) keep the
query string, so nothing on the site dropped the parameters.

**Cause 2 (about 8): sitelink assets.** Sitelinks have their own URLs and an empty suffix of their own.

### What was done (production, 2026-10-21)

1. **Backfill** (`apps/bff/scripts/backfill-seeker-intent-attribution.js`, dry run first, one transaction, count-checked):
   226 Visit rows (Google cpc, not bots, `gclid` set, `campaignId` empty, created between the campaign's creation and the
   suffix fix, landing exactly on one of the six Seeker ad-group URLs) got `campaignId = 24297610212` and the ad group
   that owns that landing page (each ad group has its own URL: Bengaluru Rent 199354221574, Pune Rent 199354221774,
   Kolkata Rent 202226465882, and the paused Buy groups 199354221734 / 199354221814 / 202226465922). This is **inferred,
   not captured**: no other campaign lands on those URLs with parameters and the others all had the suffix, so the
   campaign is certain and the ad group follows from the URL. The original rows cannot show which ad (`adId`) was clicked.
2. **Sitelinks:** `ads_add_sitelink_url_suffix.py` set the same suffix on the 38 editable sitelink assets (only
   `final_url_suffix`, final URLs untouched, so no ad review). **4 Google-created sitelinks** (automatically created
   assets such as `/?postedBy=owner`, `/?sort=newest`) cannot be edited, so their clicks will stay unattributed.
3. Removed two Visit rows created by my own redirect tests (`gclid=TEST`, campaign 111, ad group 222).

**Result:** ad-click visits without a campaign in the last 14 days went from 131 to **9** (under 1%). The Seeker Intent
campaign now shows its ad groups in Page visits for the whole period.

### Checking this again

Any new campaign must be given the Final URL suffix when it is created (the Ads scripts that create campaigns should set
`campaign.final_url_suffix`). Quick check: `SELECT campaign.name, campaign.final_url_suffix FROM campaign` should show it
on every campaign, and `Visit` rows with a `gclid` but no `campaignId` should stay near zero.
