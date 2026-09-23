# Canonical city, local place as area

A dropped pin stays on a curated city. The neighbourhood Google returns is an area under that city. Reverse geocoding does not create a city. This replaces the `ensureCity` fallback described in [fix-wrong-city-geocoding-locality-alias.md](fix-wrong-city-geocoding-locality-alias.md).

## Why one city was splitting

Google's first geocode result often names a ward (`Saravanampatti`, `New Siddhapudur`) and omits the district, or names the district `Coimbatore North`. The previous chain trusted that string and called `ensureCity`, so search for Coimbatore missed listings filed under the ward.

The city is the market people search. The local place is an area. That is how 99acres, Magicbricks, Housing, and NoBroker treat a pin: their own city list, locality underneath, Google's label matched into that list. `catchmentKm` stands in for the city boundary those sites draw.

## Resolution order

`LocationsService.reverseGeocodeGoogle` in [apps/bff/src/locations/locations.service.ts](../../apps/bff/src/locations/locations.service.ts). First hit wins. `ensureCity` is not called.

1. **LocalityAlias** — spelling pairs and names Google treats as their own city that Bhavano already models under a parent.
2. **Curated city name** — every geocode result's `locality`, `postal_town`, `administrative_area_level_2`, and `administrative_area_level_3`. A trailing `Urban`, `Rural`, `District`, `Taluk`, `Tehsil`, `Tahsil`, `North`, `South`, `East`, `West`, or `Central` is stripped first, so `Coimbatore North` matches Coimbatore. `Delhi` is not fuzzy-matched to `Delhi NCR`. Only `source: 'curated'` rows are eligible.
3. **Known area** — if the place name is already an `Area` under a curated city, use that city. When the name exists in more than one city, use it only when that area's lat/lng is within 5 km of the pin, or when only one of those cities' catchments contains the pin.
4. **Catchment** — nearest curated city whose `catchmentKm` contains the pin.

The area name is the local place (sublocality, else locality) and is not the city name itself. `ensureArea` creates it under the resolved city.

Outside every catchment, `cityId` stays unset and nothing is created. Web and mobile prefill the area name and ask the seller to pick a city. Submit already sends `areaName` when `areaId` is empty.

## Catchment sizes

`City.catchmentKm` defaults to 25. The migration and [apps/bff/prisma/seedCities.ts](../../apps/bff/prisma/seedCities.ts) set Delhi NCR to 50 km and Bengaluru, Mumbai, Chennai, Hyderabad, Kolkata, Pune, and Ahmedabad to 35 km.

Seeded aliases: Delhi, New Delhi, Gurugram, Gurgaon, Noida, Greater Noida, Faridabad, Ghaziabad → Delhi NCR; Bangalore → Bengaluru; Bombay → Mumbai; Calcutta → Kolkata; Madras → Chennai; Trivandrum → Thiruvananthapuram; Calicut → Kozhikode; Baroda → Vadodara.

## Existing auto-created cities

[apps/bff/prisma/reparentStrayCities.ts](../../apps/bff/prisma/reparentStrayCities.ts) runs after this resolver is deployed:

```
pnpm --filter bff exec tsx prisma/reparentStrayCities.ts
```

Each listing uses its lat/lng, then its area's, then the stray city's. An area uses its own lat/lng, else the stray city's. An outreach contact with coordinates uses those; other rows that only have `cityId` (users, saved searches, requirements, search events, places-fetch logs) use the stray city's centroid. Inside a catchment, that curated city wins. Outside every catchment, the nearest curated city is used and the script prints the row — existing data has no seller to ask. The stray city's slug is stored on `CitySlugRedirect` (unless it collides with a live city slug) and `/{slug}/...` 308s to the parent, keeping the rest of the path. The user-submitted city is then deleted.

## Verification

`pnpm --filter bff test` covers: alias wins; a later geocode result naming Coimbatore wins; `Coimbatore North` matches Coimbatore; a ward inside 25 km stays Coimbatore with no `city.create`; a pin far from every centroid returns no city; a Noida pin lands on Delhi NCR.
