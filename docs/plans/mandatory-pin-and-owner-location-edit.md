# Mandatory map pin, area from the pin, and owners editing their location

Status: built and committed 2026-10-21 (web, mobile, BFF); not yet deployed. Mobile needs a store build or OTA.

## Why
A listing with no pin and an area with no centre point shows no map on its page (the detail page only draws a map
when the listing or its area has coordinates). Sellers could skip the pin and type any area, so listings ended up
filed under made-up or misspelt areas. Owners also could not fix a wrong pin, city or area after posting: the owner
update route stripped those fields (only admins could change them).

## What changed
1. **Creating an ad (web and mobile):** the pin is required. Search an address or drag the pin; City and Area are
   shown read-only and come from where the pin lands. Typing an area is gone. "Not right? Use:" chips (Google's other
   names for the spot) remain. If the pin is outside every city we list, the seller chooses the nearest city (the area
   still comes from the pin, and picking the city does not clear it). If no area can be read, the form says to move
   the pin. If the native map cannot load on mobile, posting waits for it (no typed fallback).
2. **Editing an ad (web and mobile):** a Location block with the same map. Moving the pin sets city and area; Save is
   held until the new spot has resolved. The listing's page address follows (the old address 301s through the existing
   canonical redirect, as for a title change).
3. **BFF:** `UpdateListingDto` now accepts `cityId`, `areaId`/`areaName`, `lat`, `lng` (category and transaction type
   stay admin-only). For an owner the whole set must arrive together (pin plus city plus area), and the pin must be
   within 120 km of the chosen city's centre. Admin edits are unchanged (looser, number inputs). The move is written to
   the listing edit log.
4. Create on the server still accepts a missing pin (old app versions, bulk and admin-created listings); the rule is
   enforced in the apps.

## Not done / notes
- Old listings with no pin keep working; their owners can now add one from the edit page.
- Areas that have no centre point are a separate gap; see the map-missing finding (a backfill of area centres from
  geocoding is still a good idea).
- Verified: BFF unit tests for the owner rules (176 pass), web and mobile typecheck. Not yet tried in a browser or on a
  device.
