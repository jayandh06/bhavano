/** Static id -> name lookup for this account's Google Ads campaigns/ad groups, for display only
 * (e.g. the admin Page visits table). Manually maintained — this account is small and changes
 * rarely. Regenerate by running this GAQL from the repo root:
 *   SELECT campaign.id, campaign.name, ad_group.id, ad_group.name FROM ad_group
 *   SELECT campaign.id, campaign.name, asset_group.id, asset_group.name FROM asset_group
 * (via ads_report.py's make_client() pattern) and updating the two maps below. Last regenerated
 * 2026-09-06. */
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
