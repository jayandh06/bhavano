// One-off (2026-10-21): fill Campaign / Ad group on Visits that came from the Seeker Intent campaign while it was
// missing its Final URL suffix.
//
// The campaign "Metro-Seeker Intent" (id 24297610212) was created 2026-09-30 07:43 UTC without the suffix
// `gclid={gclid}&campaignid={campaignid}&adgroupid={adgroupid}&adid={creative}` and got it on 2026-10-19 08:40:59 UTC
// (Google Ads change history). Every other campaign had it from the start, so a Google ad click (gclid present,
// campaignId empty) landing on one of that campaign's six ad-group URLs in that window can only be from it, and each
// ad group has its own landing URL, so the ad group follows from the landing page. See
// docs/plans/admin-page-visits-campaign-adgroup-names.md (update 2026-10-21).
//
// Usage (read-only unless `apply` is passed), from inside the bff container:
//   node backfill-seeker-intent-attribution.js          # dry run: prints counts, writes nothing
//   node backfill-seeker-intent-attribution.js apply    # does the update in one transaction
const { Client } = require("pg");

const CAMPAIGN_ID = "24297610212";
const FROM = "2026-09-30 07:43:00+00";
const TO = "2026-10-19 08:41:00+00";
const AD_GROUP_BY_LANDING = {
  "/bengaluru/rent-lease": "199354221574",
  "/bengaluru/buy": "199354221734",
  "/pune/rent-lease": "199354221774",
  "/pune/buy": "199354221814",
  "/kolkata/rent-lease": "202226465882",
  "/kolkata/buy": "202226465922",
};

(async () => {
  const apply = process.argv[2] === "apply";
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");
  const landings = Object.keys(AD_GROUP_BY_LANDING);
  const where = `gclid IS NOT NULL AND "campaignId" IS NULL AND source = 'google' AND medium = 'cpc'
    AND "isBot" IS NOT TRUE AND "createdAt" >= $1 AND "createdAt" < $2 AND "landingPath" = ANY($3)`;
  const before = (await client.query(
    `SELECT "landingPath" AS landing, COUNT(*)::int AS n, (COUNT(*) FILTER (WHERE "adGroupId" IS NOT NULL))::int AS already_has_ad_group
     FROM "Visit" WHERE ${where} GROUP BY 1 ORDER BY 2 DESC`, [FROM, TO, landings])).rows;
  console.log(apply ? "APPLY" : "DRY RUN", "- rows to update by landing:", JSON.stringify(before));
  const total = before.reduce((a, r) => a + r.n, 0);
  console.log("total rows:", total);

  if (apply) {
    let updated = 0;
    for (const [landing, adGroupId] of Object.entries(AD_GROUP_BY_LANDING)) {
      const r = await client.query(
        `UPDATE "Visit" SET "campaignId" = $4, "adGroupId" = COALESCE("adGroupId", $5)
         WHERE ${where.replace(`"landingPath" = ANY($3)`, `"landingPath" = $3`)}`,
        [FROM, TO, landing, CAMPAIGN_ID, adGroupId]);
      updated += r.rowCount;
    }
    console.log("updated:", updated);
    if (updated !== total) {
      console.log("updated count differs from the dry-run count - rolling back");
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
      console.log("committed");
    }
  } else {
    await client.query("ROLLBACK");
  }
  await client.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
