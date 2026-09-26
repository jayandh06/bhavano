# A Google district label must not override the city catchment (Pallavaram → Chennai)

Status: **implemented and deployed 2026-09-26** (code); existing-data cleanup pending approval.

## Report

The place "Bolt.Earth, 4b, Bharathi Nagar 3rd St, Latheef Colony, Dargah Colony, Pallavaram,
Tambaram, Tamil Nadu 600043" (pin 12.9643, 80.1598) came back as **Kanchipuram** instead of Chennai
from the location detection (both the address search's place details and the map pin's reverse
geocode — `resolvePlaceId` calls `reverseGeocodeGoogle`, so one code path).

## Cause

`reverseGeocodeGoogle` chose the city by name *before* looking at where the pin is. Google's response
for that pin has no "Chennai" anywhere (`sublocality: Latheef Colony`, `locality: Tambaram`,
`administrative_area_level_2: Kancheepuram`) — it still uses the pre-2019 district that Tambaram and
Pallavaram belonged to. The admin's `LocalityAlias` "Kancheepuram → Kanchipuram" (meant for the real
Kanchipuram town) matched that district label at step 1, so the pin went to Kanchipuram, ~51 km
away (its catchment is 25 km). Chennai's 35 km catchment contains the pin (~18 km) but that check was
last and never ran. It also compounded: each such pin minted areas (Pallavaram, Zamin Pallavaram,
Malanganandapuram) under Kanchipuram.

## Fix (`apps/bff/src/locations/locations.service.ts`)

Component names are now split:
- **Town-level** (`locality`, `postal_town`, plus the resolved locality) — trusted exactly as before:
  alias first, then curated-city name.
- **District-level** (`administrative_area_level_2/3`) — only consulted (alias, then curated name)
  when **no curated city's catchment contains the pin**. Otherwise they fall through to the known-area
  check and finally the catchment, which yields Chennai here.

So a village outside every catchment still gets its district's city (e.g. Uthiramerur → Kanchipuram),
Delhi NCR-style town aliases are unaffected, and a metro-area pin can no longer be pulled to a district
town 50 km away.

Tests (`locations.service.spec.ts`): the exact Bolt.Earth pin files under Chennai (fails on the old
code); a village outside every catchment still uses the district label; a town-level "Kancheepuram" is
still trusted even far from the pin.

## Not done / follow-up

- **Existing rows.** The areas Pallavaram, Zamin Pallavaram and Malanganandapuram sit under
  Kanchipuram, and 4 listings are under Kanchipuram (BHEL Nagar, Ezhichur, Uthiramerur, Zamin
  Pallavaram); 2 of them have pins inside Chennai's catchment. Reparenting those to Chennai is a data
  change awaiting approval (see `apps/bff/prisma/reparentStrayCities.ts` for the pattern).
- Other districts with stale Google labels may behave the same way; the catchment-first rule for
  district names covers them generally, but a curated city with too small a catchment can still fall
  back to a district label.
