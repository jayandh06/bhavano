# Profile city from IP for people who skip the city question

Requested 2026-10-24. The profile city is optional at login ("Preferred city (optional)"), so some
people skip it. For them, use the approximate city already logged on their visits (`Visit.ipCity`).

## Read first
`remove-automatic-ip-city-detection.md` removed an IP guess that silently chose the *home page*
city, because IP location is coarse in India (carriers route regions through a few cities) and
involuntary. `visit-ip-city-logging.md` then allowed IP city as an admin-analytics label only. This
goes one step further, by decision of the owner: the guess may be *suggested* in the city step and
*saved* when the person skips it. It still never chooses what anyone sees on the home page, and it
never overrides a city a person set.

## What it does
- **Pre-fill.** In the post-login name + city step (web and app), a person with no city gets one
  pre-selected, with "Picked from your approximate location. Change it if it isn't right." Nothing is
  saved until they continue; "Change" clears it. `GET /users/me/suggested-city`.
- **Skipped.** A daily job (04:10 IST) fills `User.cityId` for accounts with no city, at least a day
  old (time to answer), that have Indian visits with an `ipCity`, and sets `User.cityFromIp = true`.
  The write is conditional on `cityId` still being empty. Saving any city in the profile (or clearing
  it) sets `cityFromIp = false`.
- **Which city.** The most common `ipCity` over their last 30 located visits (ties go to the most
  recent), India only, mapped to a **served** city: an admin `LocalityAlias` first (Bangalore to
  Bengaluru, Bombay to Mumbai…), else a served city of that name. No match means no guess.
- **Disclosure.** `/privacy` (web and app) now says the IP estimate is also used to suggest or set a
  profile city.

## Limits
- It only works where `Visit.ipCity` is populated: the MaxMind database must be on the app host
  (`GEOIP_DB_PATH`). Earlier notes say it may not have been. With no data it silently does nothing.
- Visits link to an account only after login (`Visit.userId`), so someone who never logged in has no
  guess.
- A guess made from a mobile carrier's gateway city can be wrong; that is why it is a visible,
  changeable pre-fill and `cityFromIp` records where the value came from.
- The app's pre-fill ships with the next app build; the daily job and the web pre-fill apply now.
