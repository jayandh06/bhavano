# Grouping the city picker by region

## The actual list, today

37 cities across 21 states, split into two tiers already — `isPopular` — and each tier sorted
alphabetically:

**Popular (12):** Bengaluru, Mumbai, Delhi NCR, Pune, Hyderabad, Chennai, Kolkata, Ahmedabad,
Surat, Jaipur, Kochi, Chandigarh.

**More cities (25):** Nagpur, Indore, Bhopal, Coimbatore, Visakhapatnam, Vijayawada, Lucknow,
Kanpur, Nashik, Vadodara, Rajkot, Patna, Ranchi, Bhubaneswar, Guwahati, Mysuru, Mangaluru,
Thiruvananthapuram, Kozhikode, Madurai, Amritsar, Ludhiana, Dehradun, Raipur, Panaji.

This is small enough that either answer — group it, or leave it — is a real option, not a case
where one is obviously right.

## Where this shows up

Two pickers read this same city list, independently: the web homepage's `LocationPicker` and the
app's equivalent bottom sheet in `HomeSheetsProvider`. Both already split Popular/More; neither
sub-sorts within a tier by anything but name. The footer's plain city list is a third, simpler
surface — just links, no tiers — that could optionally follow the same grouping or stay as-is.

## The case for leaving it alphabetical

25 items is short enough to scan in about two seconds without any grouping — nobody has to hunt.
Alphabetical also has a property regional grouping doesn't: **if you know the city's name, you
know exactly where to look.** Regional grouping trades that for a different lookup strategy (know
the region, scan within it) that only pays off once a list is long enough that neither strategy is
fast — more like 60-80 cities than 37.

## The case for grouping

Regional grouping helps most when someone doesn't have a specific city in mind yet — "somewhere in
the south" — which alphabetical order cannot answer at all; they'd have to read the whole list.
It also gives the list a growth path: seeding 15 more cities into a flat A-Z list makes scanning
slower in direct proportion, but the same 15 dropped into 5 regional buckets barely changes how
long any one bucket takes to scan.

**Recommendation: worth doing, but only for the "More cities" tier.** The 12 popular cities are
looked for as a flat set — someone scans "is my city one of the big ones" — and a region header
between Mumbai and Chennai would just be visual noise on a list that already fits without
scrolling. The 25-city tier is exactly the size where grouping starts paying for itself, and it's
the one that grows fastest as new cities get added.

## What "group by region" needs

No schema change and no BFF change. Every `City` row already carries a real `state` — five named
regions plus a state→region lookup table is enough, computed client-side on the list both pickers
already fetch. This would live once in `packages/types` (mirroring how `cityIcons.ts` is a shared,
lookup-only module today) so web and the app read the same mapping rather than risking two
answers for the same state.

```ts
const STATE_TO_REGION: Record<string, Region> = {
  "Karnataka": "South", "Tamil Nadu": "South", "Kerala": "South",
  "Andhra Pradesh": "South", "Telangana": "South",
  "Maharashtra": "West", "Gujarat": "West", "Goa": "West",
  "Madhya Pradesh": "Central", "Chhattisgarh": "Central",
  "Delhi": "North", "Punjab": "North", "Chandigarh": "North", "Uttarakhand": "North",
  "West Bengal": "East", "Odisha": "East", "Bihar": "East", "Jharkhand": "East", "Assam": "East",
  ...
};
```

**Two states are genuinely ambiguous and worth deciding rather than me guessing:**

- **Rajasthan (Jaipur)** — geographically northwest. Some lists call it North, some West. Bhavano
  has no existing convention either way.
- **Uttar Pradesh (Lucknow, Kanpur)** — commonly North in casual usage, though its geographic
  centroid sits closer to Central.

Everything else in the current 21 states maps cleanly onto exactly one of your five names, with no
real judgment call.

## What I'd actually build, if you want it

1. `packages/types/src/cityRegions.ts` — the region enum, the state→region map with the two calls
   above resolved, and a `regionFor(state)` function with a documented fallback (probably
   "Central", so a state added to `seedCities.ts` later without being added here degrades to one
   wrong bucket rather than a crash or a missing city).
2. `LocationPicker.tsx`'s "More cities" branch groups by region (alphabetical region-name order:
   Central, East, North, South, West) and stays alphabetical by city name inside each.
3. The same change to the app's location sheet in `HomeSheetsProvider.tsx`, so the two don't
   drift apart the way city-detection logic already did once this session.
4. Footer's city list — left alone unless you want it too; it's a simpler surface and grouping it
   is a five-minute add-on to the same table, not a separate design decision.

Small enough to build once you've settled the two ambiguous states and confirmed the
popular-tier-stays-flat call above — no migration, no new endpoint, touches three files.
