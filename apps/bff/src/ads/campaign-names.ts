/** Static id -> name lookup for this account's Google Ads campaigns/ad groups, for display only
 * (e.g. the admin Page visits table). Manually maintained — an id missing from these maps shows in
 * the admin as a bare number, which is what happens whenever a campaign or ad group is created or
 * renamed in Google Ads after the last regeneration. Regenerate by running this GAQL from the repo
 * root:
 *   SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status != 'REMOVED'
 *   SELECT campaign.id, campaign.name, ad_group.id, ad_group.name FROM ad_group
 *   SELECT campaign.id, campaign.name, asset_group.id, asset_group.name FROM asset_group
 * (via ads_report.py's make_client() pattern) and updating the two maps below. Last regenerated
 * 2026-09-26. */
export const CAMPAIGN_NAMES: Record<string, string> = {
  '24181952825': 'Leads-Performance Max-1', // paused
  '24186759508': 'Leads-Search-1', // paused
  '24192021092': 'Metro-Generic Post Ad Intent',
  '24186099720': 'Metro-Lease Property',
  '24185962743': 'Metro-Rent Out Property (Owners)',
  '24196652086': 'Metro-Sell Property (Owners/Agents)',
  '24285013659': 'Other-Metro-Generic Post Ad Intent',
  '24296211541': 'Other-Metro-Lease Property',
  '24296141500': 'Other-Metro-Rent Out Property (Owners)',
  '24284961543': 'Other-Metro-Sell Property (Owners/Agents)',
};

export const AD_GROUP_NAMES: Record<string, string> = {
  '196798436102': 'Ad group 1', // Leads-Search-1
  '198419903663': 'Ad group 1', // Metro-Generic Post Ad Intent
  '198411059486': 'Ad Group 3.1 — Lease Commercial/Office', // Metro-Lease Property
  '202586212471': 'Ad Group 3.2 — Lease Residential/Long-term', // Metro-Lease Property
  '199595834373': 'Ad Group 2.1 — Rent Out House/Apartment', // Metro-Rent Out Property (Owners)
  '201241143962': 'Ad Group 2.2 — Rent Out PG', // Metro-Rent Out Property (Owners)
  '201241519122': 'Ad Group 2.3 — Rent Out Villa/Independent House', // Metro-Rent Out Property (Owners)
  '199363402229': 'Ad Group 2.4 — Rent Out Commercial', // Metro-Rent Out Property (Owners)
  '201629875084': 'Ad Group 2.5 - Rent out Furniture', // Metro-Rent Out Property (Owners)
  '200702632978': 'Ad Group 1.1 — Sell House/Property Online', // Metro-Sell Property (Owners/Agents)
  '205333958048': 'Ad Group 1.2 — Sell Apartment/Flat', // Metro-Sell Property (Owners/Agents)
  '202583649071': 'Ad Group 1.3 — Sell Villa', // Metro-Sell Property (Owners/Agents)
  '201190284913': 'Ad Group 1.4 — Sell Plot/Land', // Metro-Sell Property (Owners/Agents)
  '196651916541': 'Ad Group 1.5 — Sell Commercial Property', // Metro-Sell Property (Owners/Agents)
  '201547741818': 'Ad group 1', // Other-Metro-Generic Post Ad Intent
  '203420143351': 'Ad Group 3.1 — Lease Commercial/Office', // Other-Metro-Lease Property
  '203420143191': 'Ad Group 3.2 — Lease Residential/Long-term', // Other-Metro-Lease Property
  '198875640405': 'Ad Group 2.1 — Rent Out House/Apartment', // Other-Metro-Rent Out Property (Owners)
  '198875640685': 'Ad Group 2.2 — Rent Out PG', // Other-Metro-Rent Out Property (Owners)
  '198875640445': 'Ad Group 2.3 — Rent Out Villa/Independent House', // Other-Metro-Rent Out Property (Owners)
  '198875640645': 'Ad Group 2.4 — Rent Out Commercial', // Other-Metro-Rent Out Property (Owners)
  '198875640605': 'Ad Group 2.5 - Rent out Furniture', // Other-Metro-Rent Out Property (Owners)
  '200422013973': 'Ad Group 1.1 — Sell House/Property Online', // Other-Metro-Sell Property (Owners/Agents)
  '200422014173': 'Ad Group 1.2 — Sell Apartment/Flat', // Other-Metro-Sell Property (Owners/Agents)
  '200422013933': 'Ad Group 1.3 — Sell Villa', // Other-Metro-Sell Property (Owners/Agents)
  '200422013893': 'Ad Group 1.4 — Sell Plot/Land', // Other-Metro-Sell Property (Owners/Agents)
  '200422014133': 'Ad Group 1.5 — Sell Commercial Property', // Other-Metro-Sell Property (Owners/Agents)
  '6742871063': 'Asset Group 1', // Leads-Performance Max-1 (Performance Max has no ad groups)
};
