# Removing automatic IP-based city detection

## What this reverses

`docs/plans/visitor-location-default-city.md` added a step to `resolveDefaultCity` (web) and to
the app's startup resolution: on a visitor's first-ever visit, before they had chosen anything,
guess their city from their IP address via a local MaxMind GeoLite2 database, and use that guess
automatically.

That step is removed. The precedence is now:

```
?city=<slug> in the URL      explicit, always wins
bhavano_city cookie          what they chose last time
"All cities"                 everything else — never a guess
```

## Why

Two reasons, one practical and one about consent:

- **It never actually ran in production.** `MAXMIND_LICENSE_KEY` was never set and
  `data/geoip/GeoLite2-City.mmdb` was never downloaded — the whole mechanism had been inert since
  the day it shipped. Removing it deletes an unfinished setup task, not a working feature.
- **IP geolocation is coarse and involuntary.** Indian mobile carriers route large regions through
  a handful of peering cities, so the guess would have been wrong a meaningful fraction of the
  time — and it would have run without the visitor doing anything, silently attributing a location
  to them. "Auto-detect my current location" (below) asks first, through the browser or OS's own
  permission prompt, and answers with the device's actual GPS position — a strictly better signal
  requiring an explicit action, not a background guess.

## What "Auto-detect my current location" does instead

That button already existed, on both web and the app, but used to run its own plain
nearest-city-by-distance calculation over `City.lat/lng` — no outside source, and prone to picking
the wrong city where two are close together. It now runs through Google's Geocoding API, the same
`POST /locations/reverse-geocode` endpoint the posting flow's map pin-picker already used
(`LocationsService.reverseGeocodeGoogle`) — matching against an existing `City` row by name, or
creating one via `ensureCity` if Google resolved a locality that doesn't exist yet.

This only ever runs from the button being pressed. Nothing calls it automatically.

## What was removed

- **BFF:** `GET /locations/by-ip` (`LocationsController.cityForIp` /
  `LocationsService.cityForIp`), `GeoIpService` (the MaxMind reader) entirely, `GET /locations/reverse`
  and `LocationsService.reverseGeocode` (the haversine nearest-city scan — its only two callers
  were the by-ip path and the auto-detect button, both now gone or replaced), the `maxmind` npm
  dependency.
- **Web:** the IP step in `resolveDefaultCity`, `fetchCityByIp` in `lib/bff.ts`.
- **App:** the IP-guess step in `HomeSheetsProvider`'s startup resolution effect, `fetchCityByIp`
  in `lib/bffClient.ts`.
- **Infra:** `GEOIP_DB_PATH` and the `./data/geoip` bind mount from `docker-compose.prod.yml`,
  `MAXMIND_LICENSE_KEY` from `.env.production.example`, `scripts/update-geolite.sh`, the
  `data/geoip/` gitignore entry. `data/geoip/` was never populated on the app host, so nothing was
  lost by deleting the script that would have filled it.
- **Privacy policy:** the claim that IP addresses are used to guess a visitor's city, and the
  MaxMind/GeoLite2 attribution the EULA required while that was true. Replaced with a disclosure of
  what auto-detect actually does now: device coordinates, sent to our servers and from there to
  Google's geocoding service, only on that button being tapped.

## What stays

`Visit.ip` — the per-session IP already logged for analytics and abuse investigation — is
unrelated to city defaulting and untouched by this. `GOOGLE_MAPS_SERVER_KEY` was already
configured in production for the map pin-picker, so auto-detect needed no new secret.

## One related thing left alone

`ProfileForm.tsx` auto-triggers a browser geolocation lookup on mount when a signed-in user's
profile has no saved city yet, to suggest one to confirm. This is not IP-based and does require
the browser's own permission prompt before anything happens — but it does fire without a click, on
arriving at a page rather than on pressing a button. It was left as-is because it predates this
change and wasn't part of what was asked to be removed; worth revisiting if "only on click" should
apply here too.
