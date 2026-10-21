# Pin lookup: prefer the locality over a society/community name

## Problem
A listing at Halanayakanahalli (Bengaluru) was created with area `Green Villas`, a gated community,
so its URL became `/bengaluru/green-villas/...`. `LocationsService.reverseGeocodeGoogle` takes the
first `sublocality` / `sublocality_level_1` component of `results[0]` and the post wizard pre-fills
the Area field with it. Google can tag a society or layout at level 1 and the real locality at
level 2 or `neighborhood`, which the code never reads. `ensureArea` then creates any unmatched typed
name as a new `Area` (and a public URL), so the guess becomes permanent.

Status: cause inferred from the code, not yet confirmed against Google's raw response for this pin.

## Changes
1. **Confirm first.** Reverse-geocode the listing's coordinates (or read the logged
   `google-maps reverseGeocode` response) and note which component types carry
   "Green Villas" and "Halanayakanahalli". Adjust the ranking below if the types differ.
2. **Collect candidates, don't take the first.** In `reverseGeocodeGoogle`, gather Latin-script
   names from `sublocality_level_1..3`, `sublocality`, `neighborhood` across all results.
3. **Rank them:**
   a. a candidate that is already a curated `Area` in the resolved city (case-insensitive, or via
      `LocalityAlias`), nearest to the pin when several;
   b. otherwise a candidate that is not society-like, preferring the broader level
      (level 1 over 2 over neighborhood is only the tie-break; confirm in step 1);
   c. otherwise fall back to today's behaviour.
   Society-like = name matches `\b(villas?|apartments?|residency|residences|towers?|heights|enclave|
   society|homes|park|gardens?|township|phase \d+)\b`. `Layout` and `Nagar` are not on the list:
   HSR Layout and Rajaji Nagar are real localities.
4. **Return the alternatives.** Add `areaAlternatives: string[]` to `ReverseGeocodeResultDto`
   (packages/types). The wizard (web and mobile) shows them as tappable chips under the Area
   field ("Halanayakanahalli, Green Villas"), so a wrong guess is a one-tap fix.
5. **Guard `ensureArea` for user-submitted names.** A new area whose name looks society-like is
   still allowed (a seller may mean it) but the wizard warns first: "Green Villas looks like a
   community name. Use the locality (for example Halanayakanahalli) so buyers can find it."
6. **Fix existing data.** Rename or merge `Green Villas` into `Halanayakanahalli` and add a
   301 for `/bengaluru/green-villas/*`. Use `apps/bff/scripts/suspicious-areas.sql` as a model to
   list other society-looking user-submitted areas.

## SEO / URL notes
Changing how the area name is chosen changes new URLs only. Existing area URLs must keep
resolving: any rename needs a 301 from the old slug (see CLAUDE.md URL rules).

## Status
Done in code, not deployed: steps 2-4 (candidate ranking in `reverseGeocodeGoogle`, `looksLikeSociety`,
`areaAlternatives` in the DTO, "Not right? Use:" links in the web and mobile wizards, with tests) and
the `Green Villas` -> `Halanayakanahalli` entry in `apps/bff/scripts/cleanup-area-names.ts`.
Differences from the plan: the existing-Area preference (3a) and the community-name warning (step 5)
were not built; the alternatives links cover the wrong-guess case.

## Not done
- Step 1 (reading Google's raw response for the pin 12.9011, 77.6840) needs the IP-restricted server key, i.e. a run from the prod host.
- Step 6 on prod: dry-run then `--apply` of `cleanup-area-names`. The listing page already 308s old
  listing URLs by id; the bare area page `/bengaluru/green-villas` has no redirect and will 404 once the area is gone.
