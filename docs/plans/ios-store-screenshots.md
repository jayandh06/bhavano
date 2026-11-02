# iOS App Store screenshots and previews for 1.2.0

## Status (2 Nov 2026)

No app screenshots existed in the repo (only the icon and `app-store-header.png` / `app-store-universal.png`), and App Store Connect needs real
iPhone screens. The plan was to capture them on an EAS cloud iPhone simulator, but **EAS Simulator is not enabled for the
`finfolia-technologies-llp` Expo account** (`eas simulator:availability` returned `available: false`; waitlist
https://expo.dev/services/simulators). Nothing was started or billed. So the screens have to be captured on a real iPhone or a Mac simulator,
and `apps/mobile/assets/store-screenshots/make_store_screenshots.py` turns them into the upload files.

## Capture (about 20 minutes)

Use a build of 1.2.0 (the TestFlight build on an iPhone, or a Mac simulator). Take portrait screenshots, one per screen, logged in as a test
user with sample data. Any modern iPhone works: a 6.1" iPhone (1170x2532) has the same shape as the 6.5" size, and the script scales it.

Shot list, in order. Save as `raw/01-home.png`, `raw/02-search.png`, ... (the names after the number must match `CAPTIONS` in the script):
1. `home` Home with listings
2. `search` Search results with filters open
3. `listing` A listing page with photos and details
4. `messages` A conversation with an owner
5. `post` The Post ad form (details step)
6. `alerts` The saved search / alerts screen
7. `saved` Saved listings
8. `requirements` The Requirements feed ("See what people are looking for")

**Apple 2.3.7:** none of the screens may show a price in the app's own paid offers, the word "free", a discount, or a plan with a price. Listing
prices on ads are fine; avoid the Plans, Featured and boost screens. Do not show real phone numbers, emails or other people's names.

## Make the upload files

```bash
cd apps/mobile/assets/store-screenshots
python make_store_screenshots.py --check     # raw files, captions, and the no-price rule
python make_store_screenshots.py             # writes out/6.9in-1320x2868, out/6.7in-1290x2796, out/6.5in-1284x2778
```

Each file is the real screen inside a brand-green frame with a short caption (no prices, no "free", checked by the script). `raw/` and `out/`
are git-ignored. To change a caption, edit `CAPTIONS`.

## Upload

App Store Connect > the 1.2.0 version > Previews and Screenshots > iPhone: upload the 6.9" set (or the 6.7" / 6.5" set if 6.9" is not offered);
Apple scales them for the other iPhone sizes. `supportsTablet: false`, so no iPad set. Up to 10 per language; repeat for every localization.
Keep the same order. Then re-upload `app-store-header.png` / `app-store-universal.png` if they are used (they were edited on 31 Oct to drop
"free").

## App previews (video)

Optional, and not needed to submit. If one is added later: 15 to 30 seconds, recorded from the real app (QuickTime on a Mac screen-records a
connected iPhone), and it must follow the same rule as the screenshots (no prices, no "free", no paid plans). Skipping it for 1.2.0 removes a
review risk while the submission is already blocked once.
