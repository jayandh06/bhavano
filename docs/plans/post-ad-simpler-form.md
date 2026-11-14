# Plan: a shorter, calmer post-ad form (essentials first, the rest optional)

Status: proposal (2026-11-14), nothing built. Revisits one decision in
[`post-details-step-experience.md`](post-details-step-experience.md) (section 6, "keep every section open"). Builds on its Phase 0 to 3
work (required-left chip, section badges, checklist, live preview rail, three mobile screens), on
[`post-ad-draft-autosave.md`](post-ad-draft-autosave.md), [`ai-listing-copy-assist.md`](ai-listing-copy-assist.md) and
[`posting-speed-and-progress.md`](posting-speed-and-progress.md). `/post` is disallowed in `robots.txt`, so none of this touches SEO.

## 1. The problem, in the seller's words

A new seller opens Details and sees one long page: a map, a photo box, **up to 54 fields in 4 to 6 open sections**, a separate video box
far below the photos, an AI button, then title and description. Required and optional fields sit side by side. They cannot tell what they
must finish, so some give up.

What the code does today (web `PostAdWizard.tsx` + `CategoryFieldsAccordion.tsx`):

| Order | Block | Note |
|---|---|---|
| 1 | Location (map pin) | required |
| 2 | Photos (3 to 6) | required, the top blocker (51% of blocked sessions on 2026-10-26) |
| 3 | Accordion: Pricing, Property details, Tenant preferences, Furnishing, Amenities | all `<details open>`; apartment/house 54 fields, 11 required |
| 4 | Video | optional, **after the whole accordion**, so photos and video are far apart |
| 5 | AI "Generate title + description" | needs facts from block 3 to be useful |
| 6 | Title (min 20), Description (min 50) | required, the next blockers |
| 7 | Owner or agent, Preview Ad | |

Two facts that shape the fix:
- **Sections mix required and optional fields.** "Property details" holds bedrooms, floor and carpet area (required) next to balcony,
  parking, gas pipeline and water source (optional). So collapsing *by section* would hide required fields. The split has to be **by
  field**.
- **Furnishing (12) and the rest appear only when relevant** (`dependsOn`), so the wall for a seller who says "unfurnished" is smaller than
  54, but they still scroll past empty optional sections to reach title and description.

## 2. Why revisit "keep every section open"

The 2026-10-22 decision protected listing quality (more fields filled), and Phase 0 to 3 added guidance on top. Since then:
- The 2026-10-26 data said the blockers were photos, description and title, not the attribute list. That sample only counts sessions that
  **tapped Preview while blocked** (80 sessions). Sellers who never reach that button are in `details_exit` ("Where people stopped"), which
  that note did not use. **Refresh both before building** (section 7, step 0).
- The decision itself said: *"Revisit collapsing only if Phase 0 shows many sellers leaving mid-form."* The new complaint is exactly that.
- Required-left chips and pills explain the wall but do not remove it. A seller still scrolls past about 40 optional fields to find the
  last required ones.

So: keep the **server rules and the field list unchanged**, but change what is on screen at once. Quality is protected a different way
(section 5), not by showing everything up front.

## 2b. Baseline refreshed (2026-11-14, admin Post-ad funnel, 22 Oct to 14 Nov, IST)

| | All | Web | App |
|---|---|---|---|
| Arrived at /post | 3,205 | 3,090 | 115 |
| Chose a category | 1,444 (45%) | 1,332 (43%) | 112 |
| Reached Details | 833 | 765 | 68 |
| Went on to Preview | 427 (**51%**) | 391 (51%) | 36 (53%) |
| Published | 317 (74% of Preview) | 287 | 30 |

**Details to Preview is flat since the Phase 1 to 3 release**: 51% for 22 to 31 Oct, 52% for 1 to 14 Nov, 56% in the last 7 days (147 to 82).
There is no pre-release baseline (the events started with that release), so this says "it has not moved", not "it got worse".
87% of Details sessions touch a field (725 of 833); median time to the first field is 6s. 266 sessions (32%) tapped Preview with things left.

**What blocks Preview** (sessions, first blocking item per tap, approximate because one session can block twice): photos about 110
(roughly 40% of blocked sessions), location about 48, title about 50, description about 34, posted-by about 21, entrance facing 20, floors and
carpet area under 15 each. **Attribute fields together are about a fifth of blocked taps**, so the long attribute list is not the main thing
stopping people at Preview.

**Where people left without ever tapping Preview** (406 sessions left Details):
- **Last touched the map/location: 116 (29%), median 63s.** The biggest single place to stop, on web only.
- **Touched nothing: 115 (28%), median 9s.** Bounces, probably wrong page or curiosity.
- Everything else, 175 (43%), is spread thinly: price 15, description 15, title 11, then fields with 5 or fewer each
  (security deposit, broker question, ownership, furnishing, lock-in, photos, entrance facing).
- Caveat: "last field touched" is biased early because everyone passes the map first, so a long form below it cannot be ruled out as a
  reason to leave at the map. But no later field accounts for more than a handful of exits.

**Two things this changes in the plan**
1. The case for collapsing 40 optional fields is weaker than assumed: they show up in about 20% of blocked taps and almost no exits. It is still
   worth doing for the calmer first impression (and the complaint is real), but **do not expect it to be the main conversion win**.
   The bigger levers are **location** (4.8 below), **photos**, and **title/description** (4.3).
2. **The "category drop" is mostly not the form. It is non-Indian traffic and a fall in Indian paid traffic** (checked 2026-11-14, see 2c).
   Do not read the top of the funnel (45% choose a category, 27% in November) as sellers abandoning the first screen.

### 2c. Why the category share fell (checked 2026-11-14, Page Visits for `/post`, humans-only filter)

| Week (IST) | `/post` sessions | From India | Not India | India from paid ads (cpc) | Category chosen | Published |
|---|---|---|---|---|---|---|
| 22 to 28 Oct | 706 | 513 | 193 | 335 | 507 | 156 |
| 29 Oct to 4 Nov | 1,343 | 553 | 790 | 235 | 681 | 92 |
| 5 to 11 Nov | 715 | 192 | 523 | 101 | 169 | 43 |
| 12 to 14 Nov (3 days) | 498 | 102 | 396 | 69 | 92 | 26 |

- **Total arrivals held up only because non-Indian sessions filled in.** Not-India went from 193 to 790 a week (28 to 113 a day). Many show as
  desktop, "direct", from Singapore and China IPs, landing on `/post` and listing pages and never choosing a category. They pass the humans-only and
  even the JS-confirmed filters (571, 917, 586, 441 sessions), so this is automated or unwanted traffic the classifier does not catch.
- **Real arrivals fell.** India per day: 73, 79, 27, 34. Category choices per day: 72, 97, 24, 31, which tracks India closely, so almost every
  real arrival picks a category. Paid-ad sessions from India fell from 335 to 101 a week; published ads per day fell from about 22 to about 6 to 9.
- So the lower share of "arrivals that chose a category" is the denominator being polluted; the lower **number** of published ads is lower
  real traffic, mostly paid. Neither is a form problem. Per real (Indian) arrival, publishing is roughly 22 to 30% in every week.
- **Do next, outside this plan:** (a) check the Google Ads campaigns, budgets and the Diwali period for the paid fall (the two seeker
  campaigns were paused on 2026-11-10, see `seeker-intent-campaign.md`, but the fall started earlier); (b) consider blocking or ignoring the
  datacenter traffic at the source. Caveat: country comes from IP, so a few non-Indian visitors will be real people.
- **Built (2026-11-14): country filter on admin Post-ad funnel.** A "Country" dropdown (Any / India / Outside India or unknown) now applies to the
  funnel and to "Inside the Details step". It reads `Visit.ipCountry === 'India'`; "Outside India" is the complement, so the two always add up to
  all sessions (including sessions with no geolocation or no `Visit` row). Query param `country=india|other` on `/admin/post-funnel` and
  `/admin/post-funnel/details`, `/post-funnel?country=india` in admin. Tested in `admin.service.spec.ts`. **Deployed 2026-11-14**
  (images built by GitHub Actions, `sha-0e65d4c2`) and checked live for 5 to 11 Nov: **India 179 arrived, 166 chose a category (93%), 120
  reached Details, 64 Preview (53%), 43 published; outside India 522 arrived and 3 chose a category.** Real arrivals almost all pick a
  category, so the first screen is not the problem; the form's own numbers above stand. Use **India** for every post-ad
  experiment from now on; the all-countries top row is not comparable week to week.
- The **Details-onward numbers (51% Details to Preview, the blockers, the exits) are not distorted** by this: those sessions touched fields, which
  automated visitors do not.

## 3. The design in one picture

Same fields, same validation, but ordered by effort and split into **what you need to post** and **what helps your ad stand out**.

```
Post an ad · Apartment for rent                        Draft saved just now
------------------------------------------------------------------------
 1  Show your property          [Required: at least 3 photos]
    [ photo ][ photo ][ photo ][ + Add ]   [ ▶ Add a video (optional) ]
        one block: photos and the video tile together, camera or gallery

 2  Where is it?                [Required]
    map pin, "Use my current location" / search

 3  The essentials              [Required]            4 of 8 done
    2 BHK:  (1) (2) (3) (4) (5+)        Bathrooms  [-] 2 [+]
    Rent  [ ₹ 25,000 ]  per month       Carpet area [ 950 ] sq ft
    Floor [ 3 ] of [ 7 ]     Furnishing (Unfurnished / Semi / Furnished)
    Facing [ East v ]        Posted by (Owner / Agent)

 4  Title and description       [Required]
    [ ✨ Write it for me ]   Title (prefilled, editable)   Description

 5  Add more details  (optional)                        ▸
    Amenities 0 of 8 · Furnishing items 0 of 12 · Tenant preferences ·
    Parking, balcony, society name…    "Optional. You can add these after posting."
------------------------------------------------------------------------
                                              [ Preview Ad ]
```

Desktop keeps the existing right rail (live preview card + checklist). Phones show one block at a time (section 4.5).

## 4. Proposals, in order of effect

### 4.1 Split by field: "Essentials" always open, "More details" collapsed
- Essentials = every field with `required: true` for the category and transaction, plus price and the broker question. Rendered in one
  block, in a sensible reading order (rooms, area, floor, furnishing, price), not in section order.
- Everything else (optional fields, grouped by their existing sections) goes into **one** collapsed "Add more details (optional)" block.
  Inside it, each section is a row with a counter ("Amenities, 0 of 8"). Opening it shows the existing section content unchanged.
- Dependent fields stay hidden until their parent is answered (furnishing items appear only after "Furnished").
- Shared helper in `packages/types/src/categoryFields.ts`: `splitEssentialFields(category, transactionType)` returning
  `{ essential: FieldDef[], optionalBySection: ... }`, so web and the app cannot disagree. Tested for every category and transaction.
- Result for apartment/house: about 8 fields in view instead of 54, with nothing removed.

### 4.2 Photos and video become one block
- One "Show your property" block: the photo grid with an "Add a video (optional)" tile as its last cell. The video limits note
  (Featured gets more) becomes one small line under it, not its own section.
- Large empty state: a big "Add photos" target with camera and gallery choices on phones (finishes item 6 of section 10 in the old plan).
- Video logic, limits, upload and retry code are untouched; only the placement and the wrapper change.

### 4.3 Make the plainest required things nearly free
These are the top blockers today and need no thinking from the seller:
- **Prefilled title** from the facts ("2 BHK apartment for rent in Adyar"), editable. (Old plan, section 10 item 5, still to do.)
- **"Write the description for me"** as the primary action once photos and essentials are in, instead of an AI button in the middle of the
  page. The AI service and its rules are unchanged.
- Rooms as a chip row (1 to 5+ BHK) in place of a number stepper where a field is a small fixed set; the chips for 3 to 4 options already
  exist on web.
- No guessed defaults for required facts (bathrooms, floor, area): the 2026-10-22 rule stands.

### 4.4 One calm progress signal, fewer labels
- Replace per-field "Required" markers and the red asterisks inside Essentials with the block header's single pill, because the block
  itself now means "required". Optional fields carry no label at all because they live in the optional block.
- Keep the sticky "N left" chip, the checklist and jump-to-first-problem exactly as built (they still work; they now point into a short form).
- Section badges are kept only for the optional rows, shown as a gentle count, never red.

### 4.5 Phones: four short screens, one idea each
Re-cut the app's three screens (and the mobile web, which today scrolls) into:
1. **Photos and location** (photos and video together, then the pin)
2. **The essentials**
3. **Title and description**
4. **More details (optional)**, with a visible **"Skip and preview"** button as the main action

`detailsPartOfTarget` (shared) already maps a blocking field to its screen; it gains the new split. Mobile web adopts the same screens below
the `md` breakpoint; desktop shows blocks 1 to 5 stacked, with block 5 collapsed.

### 4.6 What to do about the fields we no longer show up front
Hiding optional fields could lower how complete listings are. Counter-measures, all small:
- After publish, the success screen already exists; add a **"Make it stand out: add amenities and furnishing"** card that deep-links to the
  edit screen with the optional block open. (Edit form stays as is.)
- A reminder message later through the existing reminder machinery, only for listings under a completeness threshold.
- Show the existing completeness percentage on the Preview step with a one-tap "Add details" link, so the choice is informed, not hidden.

### 4.8 Make the map pin a one-tap step (added after the baseline, section 2b)
The map is where the most people stop (116 sessions, median 63s). Proposals, cheapest first:
- **"Use my current location" as the big primary button**, with the draggable pin as the fallback, so a seller standing at the property is
  done in one tap.
- **Search box first** ("type the locality or building"), pin drops itself, then "Is this the right spot?" Confirm / Adjust.
- Plain words on why a pin is needed ("so buyers can find the area"), shown once, not as an error.
- **A different place from where the seller is stands (added 2026-11-14).** Today's web picker already has a search box, click-to-place,
  a draggable pin and "Use my current location" (`LocationMapPicker.tsx`); none of that goes away. "Use my current location" is a shortcut
  for a seller at the property, never the only path, and the pin is always editable afterwards. Most owners list from home, so the
  **search box is the first and biggest control**, with the current-location button beside it, not above it.
  After any pin drop show "Is this the right spot? Confirm / Adjust". If the pin is far from the city chosen earlier, ask "Is this the
  right place?" so nobody posts an ad at their sofa by accident.
- **To check before building:** the app's own map component (only the web picker was read), and that search suggestions work for smaller
  localities (the search is restricted to supported areas).
- Measure it with a new `location_set` event and time-to-pin, so we see whether the stop is the map being hard or being unfamiliar.
Needs a look at the actual map screen on a phone before choosing; see decision 2 in section 8.

### 4.7 Optional, separate decision: review which attributes are truly required
Entrance facing, floors and a few others are required today and each blocks 6 to 8 sellers. Moving one to optional is a **server and
product change**, so it is not part of this plan's default scope. Listed as an open decision.

## 5. Guardrails (what does not change)
- The BFF keeps every validation rule. `listingAttributeIssues`, `postDetailsIssues`, the title and description minimums and the mandatory
  pin are untouched. This is presentation, order and defaults only.
- Same `CATEGORY_FIELD_CONFIG`; no field is removed or renamed, so listing pages, filters and the edit form keep working.
- Draft autosave, funnel events (`first_touch`, `preview_blocked`, `details_exit`) and the "N left" chip keep working; new events name the
  new blocks (`essentials`, `media`, `more_details_opened`) in the same synthetic-path style.
- Accessibility: the collapsed block is a real disclosure (button with `aria-expanded`), errors tied to fields, focus moved to the first
  problem, 44px targets, 16px inputs.
- Do not ship to everyone at once (section 6).

## 6. Rollout and how we know it worked
- **Flag and split.** Put the new layout behind an admin-controlled switch with a percentage (the plan settings screens already hold
  such flags) and assign by session, so old and new run side by side on web. The earlier phases shipped with no flag; this one changes what
  people see most, so it needs a control group.
- **Success measures** (admin Post-ad funnel, "Inside the Details step"): Details to Preview conversion up; blocked-Preview taps per
  session down; median time on Details down; photos, title and description out of the top three blockers.
- **Quality guardrail**: average completeness at publish, and enquiries per listing, must not fall by more than a small agreed margin (suggest
  5 points of completeness). If they do, lean harder on 4.6 before reverting.
- **Order**: web first (flagged), then the app with a store build or OTA (as with the earlier mobile phases), after web has proved it.
- **Testing**: unit tests for `splitEssentialFields` and the updated target-to-screen map; a manual pass on one slow Android phone, one
  iPhone, and desktop at 1280px and wider (the wizard has no automated UI tests).

## 7. Suggested order of work (reordered after the 2026-11-14 baseline)
0. **Done: baseline refreshed** (section 2b). Targets to set: Details to Preview from 51% to 60% or better; blocked-Preview taps per session down.
1. **Location and photos first** (4.8 and 4.2): a one-tap location, and the merged photos-and-video block with a big camera/gallery target.
   These are the top exit and the top blocker, so they should move the numbers most.
2. **Title and description for free** (4.3): prefilled title, "write it for me" as the main action. Covers about a third of blocked taps.
3. Shared `splitEssentialFields` + tests, then **Essentials / collapsed optional block** (4.1, 4.4) for the calmer first impression.
   Behind the flag with a control group, since the data does not promise a big conversion gain.
4. Compare one to two weeks; widen or adjust. Then post-publish nudge and Preview-step link (4.6).
5. App and mobile web: the four screens (4.5), with a release.
6. Only if the numbers still disappoint: paste-your-ad prefill ([`post-ad-via-whatsapp.md`](post-ad-via-whatsapp.md) ideas) and 4.7.

Rough size: steps 1 to 2 are about two to three days of work, step 3 about two days, step 5 about three to four days plus a build.

## 7b. Built: slice 1 (2026-11-14), web only, behind a rollout percentage
Steps 1 of section 7 for the web: the **redesigned form is "v2"**, the current one "v1". Deployed and checked in production on 2026-11-14.

- **Who gets v2.** The share of visitors (0 to 100) is a setting in **Admin > Settings > Post ad form** (table `PostFormSetting`, singleton row; it first
  lived in a `POST_FORM_V2_PERCENT` environment variable, which was removed). The web `/post` page reads it from the BFF (`GET /listings/post-form-settings`,
  cached about 30 seconds), so a change needs no restart and no deploy. Each browser has a stable bucket (`bhavano.postFormKey` in localStorage, hashed with the
  existing `rolloutBucket`), so a visitor keeps the same form. A missing setting or an unreachable BFF means 0 (nobody). **`/post?form=v2` or `?form=v1` forces
  a version** for testing. **Admin accounts always get v2** (the override is ignored for them), and their sessions are recorded as `form=admin`, so staff testing
  never counts towards the v1 / v2 comparison. Code: `apps/web/src/lib/postFormVariant.ts`, `apps/bff/src/listings/post-form.service.ts` (+ tests).
- **What v2 changes on the Details step:**
  - **Location (4.8):** heading "Where is the property?"; the search box and **Use my current location** sit side by side, search first;
    the hint says "Not at the property? Search for its address, or tap the map...". Behaviour is unchanged (`LocationMapPicker` `variant="v2"`).
  - **Photos and video (4.2):** one "Show your property" card holding the photo uploader and the video uploader together, straight after the
    location, instead of the video sitting after the whole category form. The same two blocks (now `renderPhotosBlock` / `renderVideoBlock`)
    are used by both versions, so upload, limits, retry and the Featured callout are untouched.
- **Not in slice 1:** essentials-first with the optional fields collapsed (4.1), the prefilled title and "write it for me" as the main
  action (4.3), the "Is this the right spot?" confirmation and the far-from-city warning, the app and mobile web.
- **Measuring it.** Every funnel step event now carries `form=v1|v2`. Admin Post-ad funnel has a **Form version** filter (Both / Original
  / Redesigned) that applies to the funnel and to "Inside the Details step"; sessions from before the split match neither. Compare v1 and v2
  with the **Country: India** filter on. Volume is low (about 120 Indian sessions a week reach Details), so expect weeks, not days, before
  the difference is clear.
- **Switched on at 50% on 2026-11-14 (about 10:00 IST).** `POST_FORM_V2_PERCENT=50` in the server `.env` (the previous file is kept as `.env.bak-before-form-v2`), web recreated
  with `docker compose up -d --no-build web`. Checked in production with two keys either side of the split: bucket 12 gets v2, bucket 50 gets v1. **Compare v1 and v2
  only from this moment on**, with the Country: India filter; earlier sessions have no form version.
- **Moved to the admin screen (2026-11-14).** The migration `20261114090000_post_form_setting` creates the table and inserts the live value (50), so the share did not
  change when the setting moved out of `.env`. To change it: Admin > Settings > Post ad form, type a percentage or pick 0, 10, 25, 50 or 100, Save; visitors see it
  within about 30 seconds. Switch off with 0. The old `POST_FORM_V2_PERCENT` line can be deleted from the server `.env` (nothing reads it now).

## 7c. Built: the step-by-step form, "v3" (2026-11-14), web including mobile browser
One page, no Next or Skip buttons: each section appears below the last **once the one above it is complete**. It is v2 (location row and the photos-and-video card)
plus the progressive reveal. **Not in the rollout percentage:** only admin accounts get it, and anyone can preview it with `/post?form=v3`.

- **The order on the page:** location; photos and video (once the pin is set); **the essentials** (every required field plus the price, once there are enough photos);
  **title and description** with the AI helper and the owner question (once the essentials are done); then the **optional sections, one at a time**, each after the
  previous one has an answer. The optional sections are the existing groups (pricing extras, property extras, tenant preferences, furnishing items, amenities), labelled
  "(optional)"; the furnishing section only exists once "Furnished" is chosen.
- **Optional sections never stop Preview.** The Preview button works as soon as the required things are done. A section counts as answered when **any** field in it has an
  answer (not every field, because many do not apply to every property, such as a RERA number, and the next section must not wait for an answer that cannot exist).
  So "everything mandatory" is **not** what this does; that decision is still open (section 8).
- **A section that has appeared stays.** Changing an earlier answer never hides a later section or the text typed in it. Nothing scrolls on its own, because a section can
  complete while the seller is still typing (the first digit of a size is already a valid value). The existing "N left / Next: ..." chip is the guide.
- **The first problem is always visible.** Problems are listed in the order the sections appear (photos before the essentials, which is not the order they are found in),
  so the chip, the Preview button and "See all" never point at a section that is not showing yet; a hidden target falls back to the first problem.
- **Admins get v3 always** (the override is ignored for them) and their funnel events are recorded as `form=admin`. The admin funnel's Form version filter has a v3 option.
- **Mobile browser:** the same component and layout. Checked at 390 px wide: one column, no sideways scrolling, each section fading in (not for visitors who have asked for
  reduced motion). A screen reader hears "New section: ..." when one appears. Screenshots of each stage were reviewed.
- **Tests:** unit tests for the reveal rules (including: for every combination of problems the first one is in a section that is showing) and the variant rules; a browser
  spec (`apps/web/e2e/post-ad-step-by-step.spec.ts`) that starts from a seeded draft with only a category and a pin and checks each section is absent until the one above is
  done, on desktop and at phone width, and that v1 and v2 are unchanged. The whole e2e suite also passes against a local stack.
- **Not done yet:** a rollout percentage for v3 (the setting is one number for v2 today), the "recommended fields" middle tier, an explicit "not applicable" answer on fields
  that may not apply, and the app. Choosing what to ask first from the real fill rates of the optional fields still needs those numbers.
- **Test-suite note:** a fresh database now starts the v2 share at 50 (the migration carries the live value), so a browser test that does not name a version can get v1 or
  v2 at random. The existing suite passed, but new tests should pin a version with `?form=`.

## 8. Decisions needed
1. **Confirm reversing "keep all sections open"** for optional fields (recommended, on the evidence in section 2 once refreshed).
2. **Keep Location first, or put Photos first?** Recommended: keep Location first (it is the mandatory gate and sets city and area), but make
   it one tap ("Use my current location"). Photos first is a one-line order change if the refreshed data shows the map is where people stall.
3. **Phones: four screens (recommended) or one scrolling page with the same blocks?**
4. **Review required attributes** (4.7): in scope or later?
5. **Ship behind a flag with a control group** (recommended) or to everyone at once?
6. **Resolved (2026-11-14, section 2c):** the category-share drop is automated non-Indian traffic plus fewer Indian paid visits, not the first
   screen. Remaining separate to-dos: look at the Google Ads campaigns, and add a country or automated-traffic filter to the admin funnel.
