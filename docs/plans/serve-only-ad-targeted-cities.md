# Serve the 37 ad-targeted cities, and fold nearby towns into them

**Status: built 2026-09-28.** Migration `20260928120000_city_is_served`. Changes the resolution
order in [canonical-city-catchment.md](canonical-city-catchment.md) and
[district-name-vs-catchment-city.md](district-name-vs-catchment-city.md): served cities are now
tried first.

## Report

"Plot for sell Yadagirigutta D T C P Layout" (₹20,00,000, posted 2026-09-28 09:48 IST) shows as
**Parvedula, Nalgonda**, not Hyderabad.

- The listing's pin is 16.6538, 79.2226. Google's reverse geocode for that exact pin (logged 09:14)
  says `locality: Parvedula`, `administrative_area_level_3: Nalgonda`. Nalgonda is a curated city
  (from the census import), so the resolver did what it was designed to.
- The pin is ~108 km from Yadagirigutta itself (17.587, 78.946). The seller used no address search
  (no autocomplete/place-details calls), so the pin was most likely "Use my current location" or a
  map tap — the seller's position, not the plot's.
- Even with a correct pin, Yadagirigutta is ~54 km from the Hyderabad centroid, outside its old
  35 km catchment; it would have landed on **Bhongir** (census city, ~10 km away).

## Why

Bhavano's market is the 37 cities the Google Ads campaigns target:

- **Metro** campaigns (6 markets): Bengaluru, Chennai, Delhi NCR (Delhi, New Delhi, Gurugram, Noida,
  Greater Noida, Ghaziabad, Faridabad), Hyderabad, Mumbai (Mumbai City, Navi Mumbai, Thane), Pune.
- **Other-Metro** campaigns (31): Ahmedabad, Amritsar, Bhopal, Bhubaneswar, Chandigarh, Coimbatore,
  Dehradun, Guwahati, Indore, Jaipur, Kanpur, Kochi, Kolkata, Kozhikode, Lucknow, Ludhiana, Madurai,
  Mangaluru, Mysuru, Nagpur, Nashik, Panaji, Patna, Raipur, Rajkot, Ranchi, Surat,
  Thiruvananthapuram, Vadodara, Vijayawada, Visakhapatnam.

These are exactly the 37 cities in `apps/bff/prisma/seedCities.ts` (12 `isPopular`, 25 tier-2). The
census import (`seedKnownCities.ts`) then added 721 more curated cities (758 in production), so every
town with 50,000+ people became its own city. That split a metro's market (Bhongir, Meerut and
Chengalpattu are Hyderabad, Delhi NCR and Chennai to a buyer) and put 746 towns in the pickers'
"More cities" list, diluting both the listings and seeker searches.

**Why the ads don't prevent far listings.** Every campaign uses `PRESENCE` geo targeting, so ads
reach only people *in* those cities. That bounds where the seller is, not where the property is: a
Hyderabad resident posting a family plot in their home town, a wrong "current location" pin, and
organic/app traffic all produce listings far from the 37.

## Production at the time (2026-09-28)

459 active listings; 429 in the 37 cities, 30 in 26 other cities. About half of those 30 are
neighbouring towns (Barabanki 25 km from Lucknow, Rishikesh 34 km from Dehradun,
Kanchipuram/Chengalpattu 47–51 km from Chennai, Kollam 48–54 km from Thiruvananthapuram, Basirhat
53 km from Kolkata, Bhiwadi/Meerut 69–71 km from Delhi NCR); the rest are separate markets 87–241 km
away (Tirunelveli, Erode, the Nalgonda pin, Jammu, Hubli, Aurangabad, Agra, Varanasi, Jabalpur…).

## Decisions

- **Reach:** the 12 popular cities reach **75 km** from their centroid (Delhi NCR **90 km**); the
  other 25 reach **40 km**. Stored as `catchmentKm`. A pin inside several reaches goes to the
  nearest centroid. Yadagirigutta (54 km) → Hyderabad; Meerut (70 km) → Delhi NCR; Chengalpattu
  (51 km) → Chennai.
- **Beyond every reach, the town keeps its own city** (the previous resolver, unchanged): Parvedula
  → Nalgonda. Posting is never blocked and there is no waitlist.
- **Existing rows are left as they are.** No reparenting, no deactivation; the reported listing
  stays under Nalgonda. Census-town pages with listings keep working and stay in the sitemap.

Considered and rejected: refusing to publish beyond every reach (with or without a waitlist), and
filing far pins under the nearest served city however far (a Jabalpur plot in Nagpur results).

## What shipped

**Schema.** `City.isServed Boolean @default(false)`. The migration sets it for the 37 by
name + state and sets their `catchmentKm` to 75 / 90 / 40. `seedCities.ts` sets both on upsert.
Census towns keep `catchmentKm` 25.

**Resolver** (`LocationsService.reverseGeocodeGoogle`, also behind `resolvePlaceId`). First hit wins:

1. **Served pass:** a `LocalityAlias` for a town-level name that points at a served city; a served
   city's name among the town-level components; a known area under a served city (the same 5 km /
   single-catchment rule as before); the nearest served city whose reach contains the pin.
2. **Fallback, unchanged from before:** any alias; a curated city's town-level name; a district
   label only when no curated catchment contains the pin; a known area under any curated city; any
   curated catchment. Outside everything, `cityId` stays unset and the seller picks a city.

**Area name.** Normally the area is Google's local place (sublocality, else locality) as before. For
a pin more than half a served city's reach from its centroid (37.5 km for a popular metro, 45 km
for Delhi NCR, 20 km for the rest), the area is Google's *town* (`locality`) instead, and that is
also returned as `resolvedLocality`. So a folded town becomes an area of its metro (Hyderabad →
Yadagirigutta, Delhi NCR → Meerut) rather than taking a neighbourhood name like "Gandhi Nagar"
(Google's sublocality at the Yadagirigutta pin), which would read as a place in the city itself.
Pins in the city proper keep their neighbourhood.

**City lists.** `CityDto.isServed` is exposed. The web `LocationPicker` and the mobile city sheet
list only served cities under "More cities" (the 25 tier-2 instead of 746 towns), and `/cities`
lists only served cities. Typed search in the pickers still matches any city, so a seller far from
every served city can pick their own town. `GET /locations/cities?all=true` still returns every
city, because the web uses it to resolve city slugs in URLs.

**Tests** (`locations.service.spec.ts`): Yadagirigutta → Hyderabad with area Yadagirigutta (not
its "Gandhi Nagar" neighbourhood); a Secunderabad pin keeps its neighbourhood as the area; a
Google locality "Bhongir" inside Hyderabad's reach → Hyderabad; the reported Parvedula pin →
Nalgonda; a "Kancheepuram" town name inside Chennai's reach → Chennai, and beyond it → Kanchipuram.

## Caveats

- A 75 km reach includes some genuinely separate towns (Tumakuru ~70 km from Bengaluru, Karjat for
  Mumbai). They become areas of the metro, which is how the big portals file them too. Tune a city
  through its `catchmentKm` if a case looks wrong.
- Overlapping reaches go to the nearest centroid, e.g. Lonavala (~65 km Mumbai, ~55 km Pune) → Pune.
- Wrong "current location" pins still file wherever the pin is. A later improvement could ask the
  seller to confirm a pin far from the place named in the title.
- `seedKnownCities.ts` / `remapToKnownCities.ts` are historical; re-running the remap would use the
  new reaches.
