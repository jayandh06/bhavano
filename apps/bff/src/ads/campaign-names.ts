/** Static id -> name lookup for this account's Google Ads campaigns/ad groups, for display only
 * (e.g. the admin Page visits table). Manually maintained — an id missing from these maps shows in
 * the admin as a bare number, which is what happens whenever a campaign or ad group is created or
 * renamed in Google Ads after the last regeneration. Regenerate by running this GAQL from the repo
 * root:
 *   SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status != 'REMOVED'
 *   SELECT campaign.id, campaign.name, ad_group.id, ad_group.name FROM ad_group
 *   SELECT campaign.id, campaign.name, asset_group.id, asset_group.name FROM asset_group
 * (via ads_report.py's make_client() pattern) and updating the two maps below. Last regenerated
 * 2026-10-08. */
export const CAMPAIGN_NAMES: Record<string, string> = {
  '24181952825': 'Leads-Performance Max-1', // paused
  '24186759508': 'Leads-Search-1', // paused
  '24192021092': 'Metro-Generic Post Ad Intent',
  '24186099720': 'Metro-Lease Property',
  '24185962743': 'Metro-Rent Out Property (Owners)',
  '24196652086': 'Metro-Sell Property (Owners/Agents)',
  '24285013659': 'Other-Metro-Generic Post Ad Intent',
  '24296211541': 'Other-Metro-Lease Property', // paused
  '24296141500': 'Other-Metro-Rent Out Property (Owners)',
  '24284961543': 'Other-Metro-Sell Property (Owners/Agents)',
  '24297610212': 'Metro-Seeker Intent',
  '24334335817': 'Other-Metro-Lease Property-MaxConv',
  '24392228394': 'Other-Metro-Seeker Intent',
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
  '199354221574': 'Ad Group — Bengaluru Rent Seekers', // Metro-Seeker Intent
  '199354221734': 'Ad Group — Bengaluru Buy Seekers', // Metro-Seeker Intent
  '199354221774': 'Ad Group — Pune Rent Seekers', // Metro-Seeker Intent
  '199354221814': 'Ad Group — Pune Buy Seekers', // Metro-Seeker Intent
  '202226465882': 'Ad Group — Kolkata Rent Seekers', // Metro-Seeker Intent
  '202226465922': 'Ad Group — Kolkata Buy Seekers', // Metro-Seeker Intent
  // Added 2026-10-21 by ads_add_seeker_city_ad_groups.py (the cities added to the campaign's location targeting)
  '201399936637': 'Ad Group — Hyderabad Rent Seekers', // Metro-Seeker Intent
  '201399937157': 'Ad Group — Hyderabad Buy Seekers', // Metro-Seeker Intent
  '206491243332': 'Ad Group — Delhi NCR Rent Seekers', // Metro-Seeker Intent
  '206491243572': 'Ad Group — Delhi NCR Buy Seekers', // Metro-Seeker Intent
  '206491243652': 'Ad Group — Chennai Rent Seekers', // Metro-Seeker Intent
  '201006388963': 'Ad Group — Chennai Buy Seekers', // Metro-Seeker Intent
  '206491243812': 'Ad Group — Mumbai Rent Seekers', // Metro-Seeker Intent
  '201006389003': 'Ad Group — Mumbai Buy Seekers', // Metro-Seeker Intent
  '196803709170': 'Ad Group — Ahmedabad Rent Seekers', // Other-Metro-Seeker Intent
  '196803710130': 'Ad Group — Ahmedabad Buy Seekers', // Other-Metro-Seeker Intent
  '200780065919': 'Ad Group — Coimbatore Rent Seekers', // Other-Metro-Seeker Intent
  '196803714610': 'Ad Group — Coimbatore Buy Seekers', // Other-Metro-Seeker Intent
  '196803715610': 'Ad Group — Jaipur Rent Seekers', // Other-Metro-Seeker Intent
  '196803716610': 'Ad Group — Jaipur Buy Seekers', // Other-Metro-Seeker Intent
  '196803717570': 'Ad Group — Lucknow Rent Seekers', // Other-Metro-Seeker Intent
  '196803718970': 'Ad Group — Lucknow Buy Seekers', // Other-Metro-Seeker Intent
  '201054972699': 'Ad Group 3.1 — Lease Commercial/Office', // Other-Metro-Lease Property-MaxConv
  '201054972659': 'Ad Group 3.2 — Lease Residential/Long-term', // Other-Metro-Lease Property-MaxConv
};

/** Ad id -> its first two headlines, for display (the admin campaign analytics). A responsive ad has no
 * name of its own, so the headlines stand in; the last four digits of the id keep ads that share
 * headlines apart. Ads are created and replaced often: regenerate with `python ads_ad_names.py` from
 * the repo root and paste the block over this one. An id missing here shows as the bare number.
 * Last regenerated 2026-10-24. */
export const AD_NAMES: Record<string, string> = {
  '822354745373': 'List Your Property Free / Post Property Ad Free (...5373)',
  '822598063377': 'Sell Your House Online Fast / Post Property Ad in Minutes (...3377)',
  '822598411320': 'Sell Your Flat Online Fast / Post Apartment Ad Free (...1320)',
  '822601697457': 'Sell Commercial Property / Post Office Space For Sale (...7457)',
  '822603695469': 'Post House For Rent / List Flat For Rent Online (...5469)',
  '822604458201': 'Post PG Ad Online / List PG For Rent (...8201)',
  '822605476497': 'Rent Out Villa Online / Post House For Rent (...6497)',
  '822716983838': 'Sell Your Villa Online / Post Villa For Sale Free (...3838)',
  '822717935885': 'Sell Your Plot Online / Post Land For Sale Free (...5885)',
  '822723455732': 'Rent Out Office Space / Post Shop For Rent (...5732)',
  '822727106801': 'Post Property for Lease / Lease Office Space Fast (...6801)',
  '822727624064': 'Lease House Online Fast / Post Property for Lease (...4064)',
  '822729486935': 'Post Free Property Ad / Best Site to Post Property (...6935)',
  '824077830944': '"furniture rental near me" / "rent a bed" (...0944)',
  '826005770346': 'Post PG Ad Online / List PG For Rent (...0346)',
  '826005770349': 'Rent Out Villa Online / Post House For Rent (...0349)',
  '826006007979': 'Sell Your Villa Online / Post Villa For Sale Free (...7979)',
  '826006017825': 'Sell Your Flat Online Fast / Post Apartment Ad Free (...7825)',
  '826046952841': '"furniture rental near me" / "rent a bed" (...2841)',
  '826047023656': 'Post House For Rent / List Flat For Rent Online (...3656)',
  '826130588612': 'Rent Out Office Space / Post Shop For Rent (...8612)',
  '826130875580': 'Sell Your House Online Fast / Post Property Ad in Minutes (...5580)',
  '826130875586': 'Sell Your Plot Online / Post Land For Sale Free (...5586)',
  '826130875589': 'Sell Commercial Property / Post Office Space For Sale (...5589)',
  '826131004025': 'Post Property for Lease / Lease Office Space Fast (...4025)',
  '826131361388': 'Lease House Online Fast / Post Property for Lease (...1388)',
  '826131560849': 'Post Free Property Ad / Best Site to Post Property (...0849)',
  '826203751137': 'Own a House? List It for Lease / Owners: Post Your Lease Ad (...1137)',
  '826203751140': 'Own an Office or Shop? / Owners: List Space for Lease (...1140)',
  '826203751143': 'Own a Shop, Office or Space? / Owners: Post Space for Rent (...1143)',
  '826392460278': 'Flats For Rent In Bengaluru / Verified Rental Listings (...0278)',
  '826392460281': 'Flats For Sale In Bengaluru / Verified Sale Listings (...0281)',
  '826392460284': 'Flats For Rent In Pune / Verified Rental Listings (...0284)',
  '826392460287': 'Flats For Sale In Pune / Verified Sale Listings (...0287)',
  '826452035208': 'Post Free Property Ad / Best Site to Post Property (...5208)',
  '826452047949': 'Post Free Property Ad / Best Site to Post Property (...7949)',
  '826468462278': 'Post Free Property Ad / Best Site to Post Property (...2278)',
  '826475343054': 'List Your Property Free / Post Property Ad Free (...3054)',
  '826475343117': 'Sell Your House Online Fast / Post Property Ad in Minutes (...3117)',
  '826475349114': 'Rent Out Villa Online / Post House For Rent (...9114)',
  '826475351001': 'Post House For Rent / List Flat For Rent Online (...1001)',
  '826475351445': 'Post House For Rent / List Flat For Rent Online (...1445)',
  '826475355297': 'Post PG Ad Online / List PG For Rent (...5297)',
  '826475356989': 'Post Free Property Ad / Best Site to Post Property (...6989)',
  '826475361252': 'Sell Commercial Property / Post Office Space For Sale (...1252)',
  '826475361294': 'Sell Your Flat Online Fast / Post Apartment Ad Free (...1294)',
  '826475362728': 'Post PG Ad Online / List PG For Rent (...2728)',
  '826475362947': 'Post Property for Lease / Lease Office Space Fast (...2947)',
  '826490925571': 'Sell Commercial Property / Post Office Space For Sale (...5571)',
  '826490926471': 'Post House For Rent / List Flat For Rent Online (...6471)',
  '826490930800': 'Sell Your House Online Fast / Post Property Ad in Minutes (...0800)',
  '826490937340': 'Post House For Rent / List Flat For Rent Online (...7340)',
  '826490937580': 'Sell Your House Online Fast / Post Property Ad in Minutes (...7580)',
  '826490940703': 'Sell Commercial Property / Post Office Space For Sale (...0703)',
  '826514552365': 'Post Property for Lease / Lease Office Space Fast (...2365)',
  '826514561680': 'Sell Your Plot Online / Post Land For Sale Free (...1680)',
  '826514573029': 'Sell Your House Online Fast / Post Property Ad in Minutes (...3029)',
  '826514573032': 'Sell Your Plot Online / Post Land For Sale Free (...3032)',
  '826514573182': 'Sell Your Villa Online / Post Villa For Sale Free (...3182)',
  '826514573410': 'Sell Your Villa Online / Post Villa For Sale Free (...3410)',
  '826514573647': 'Rent Out Office Space / Post Shop For Rent (...3647)',
  '826514578228': 'Own a Shop, Office or Space? / Owners: Post Space for Rent (...8228)',
  '826514581165': 'Sell Your Flat Online Fast / Post Apartment Ad Free (...1165)',
  '826514581603': 'Rent Out Villa Online / Post House For Rent (...1603)',
  '826515594429': 'Flats For Rent In Kolkata / Verified Rental Listings (...4429)',
  '826554514546': 'Flats For Sale In Kolkata / Verified Sale Listings (...4546)',
  '826596888212': 'Sell Commercial Property / Post Office Space For Sale (...8212)',
  '826597076060': 'Rent Out Office Space / Post Shop For Rent (...6060)',
  '826597247738': 'Lease House Online Fast / Post Property for Lease (...7738)',
  '826597269995': 'Own an Office or Shop? / Owners: List Space for Lease (...9995)',
  '826597270046': 'Own a House? List It for Lease / Owners: Post Your Lease Ad (...0046)',
  '826597293299': 'Lease House Online Fast / Post Property for Lease (...3299)',
  '827193859347': 'Post Property for Lease / Lease Office Space Fast (...9347)',
  '827236897873': 'Lease House Online Fast / Post Property for Lease (...7873)',
  '827318438312': 'Lease House Online Fast / Post Property for Lease (...8312)',
  '827318441690': 'Post Property for Lease / Lease Office Space Fast (...1690)',
  '827484722070': 'Post House For Rent / List Flat For Rent Online (...2070)',
  '827484855513': 'Post Free Property Ad / Best Site to Post Property (...5513)',
  '827484856506': 'Post House For Rent / List Flat For Rent Online (...6506)',
  '827484861786': 'Sell Your House Online Fast / Post Property Ad in Minutes (...1786)',
  '827486326062': 'List Your Property Today / Post Your Property Ad (...6062)',
  '827486556144': 'Post PG Ad Online / List PG For Rent (...6144)',
  '827486604129': 'Post Property for Lease / Lease Office Space Fast (...4129)',
  '827486607978': 'Sell Your Flat Online Fast / Post Your Apartment Ad (...7978)',
  '827486607990': 'Post PG Ad Online / List PG For Rent (...7990)',
  '827486609658': 'Post Property for Lease / Lease Office Space Fast (...9658)',
  '827486611371': 'Rent Out Office Space / Post Shop For Rent (...1371)',
  '827486614269': 'Post House For Rent / List Flat For Rent Online (...4269)',
  '827526827953': 'Sell Commercial Property / Post Office Space For Sale (...7953)',
  '827526827971': 'Sell Commercial Property / Post Office Space For Sale (...7971)',
  '827528286646': 'Post Your Property Ad / Best Site to Post Property (...6646)',
  '827528511499': 'Lease House Online Fast / Post Property for Lease (...1499)',
  '827528583244': 'Sell Your Plot Online / Post Your Land For Sale (...3244)',
  '827528603920': 'Lease House Online Fast / Post Property for Lease (...3920)',
  '827528603980': 'Post House For Rent / List Flat For Rent Online (...3980)',
  '827528613781': 'Own a House? List It for Lease / Owners: Post Your Lease Ad (...3781)',
  '827528616136': 'Post Your Property Ad / Best Site to Post Property (...6136)',
  '827608755023': 'Sell Your House Online Fast / Post Property Ad in Minutes (...5023)',
  '827609070698': 'Post Free Property Ad / Best Site to Post Property (...0698)',
  '827610660434': 'Sell Your Villa Online / Post Your Villa For Sale (...0434)',
  '827610693347': 'Rent Out Villa Online / Post House For Rent (...3347)',
  '827610693356': 'Lease House Online Fast / Post Property for Lease (...3356)',
  '827610707675': 'Sell Your Plot Online / Post Your Land For Sale (...7675)',
  '827610707696': 'Sell Your Flat Online Fast / Post Your Apartment Ad (...7696)',
  '827610713888': '"furniture rental near me" / "rent a bed" (...3888)',
  '827610716348': 'Sell Your Villa Online / Post Your Villa For Sale (...6348)',
  '827610717251': '"furniture rental near me" / "rent a bed" (...7251)',
  '827610719666': 'Post Property for Lease / Lease Office Space Fast (...9666)',
  '827610720461': 'Rent Out Villa Online / Post House For Rent (...0461)',
  '827610722843': 'Rent Out Office Space / Post Shop For Rent (...2843)',
  '828660818595': 'Flats For Sale In Delhi NCR / Verified Sale Listings (...8595)',
  '828709877233': 'Flats For Rent In Delhi NCR / Verified Rental Listings (...7233)',
  '828709880365': 'Flats For Sale In Hyderabad / Verified Sale Listings (...0365)',
  '828709886830': 'Flats For Sale In Chennai / Verified Sale Listings (...6830)',
  '828709886845': 'Flats For Rent In Mumbai / Verified Rental Listings (...6845)',
  '828709887253': 'Flats For Rent In Hyderabad / Verified Rental Listings (...7253)',
  '828709887298': 'Flats For Rent In Chennai / Verified Rental Listings (...7298)',
  '828788329139': 'Flats For Sale In Mumbai / Verified Sale Listings (...9139)',
};
