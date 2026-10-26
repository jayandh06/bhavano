# Plan: a better experience filling in ad details (web and mobile app)

Status: proposal (2026-10-22), nothing built. Builds on [`post-ad-funnel-step-tracking-and-entry-attribution.md`](post-ad-funnel-step-tracking-and-entry-attribution.md),
[`post-ad-draft-autosave.md`](post-ad-draft-autosave.md), [`posting-speed-and-progress.md`](posting-speed-and-progress.md) and
[`mandatory-pin-and-owner-location-edit.md`](mandatory-pin-and-owner-location-edit.md). `/post` is disallowed in `robots.txt` and not
indexed, so none of this touches SEO.

## 1. What the details step is today (read from the code)

One long scrolling form on both platforms, in this order: **Location** (map pin; city and area now read-only from the pin) →
**category fields** (grouped into sections, with price and price qualifier folded into "pricing") → **Photos** → **Video** →
**AI title and description** → **Title** → **Description** → **Owner or agent** → **Preview Ad**. A one-line message under the button
says why Preview is blocked ("To preview: <first missing thing>"). Web: `PostAdWizard.tsx` + `CategoryFieldsAccordion.tsx`.
Mobile: `PostAdWizard.tsx` + `CategoryFieldsForm.tsx` (same `CATEGORY_FIELD_CONFIG` from `@bhavano/types/categoryFields`).

How big the form is, from the field config:

| Category | Fields | Required |
|---|---|---|
| Apartment, house | 54 | 11 |
| Villa | 57 | 11 |
| Commercial | 26 | 7 |
| PG | 25 | 1 |
| Plot | 18 | 5 |
| Coworking | 19 | 1 |
| Storage, furniture, interiors | 12, 5, 2 | 1 each |

So the heaviest and most common listings (apartment and house) open as a wall of **54 fields with every section expanded**, 11 of which
are required and spread across the page. Optional "nice to have" fields (furnishing 12, amenities 8, preferences 3, plus about half of
the basics) look as important as the required ones.

## 2. Friction points (what to fix)

1. **The wall.** Nothing tells a first-time seller which 11 fields matter. Required and optional are mixed in one scroll.
2. **Errors arrive late and small.** The only guidance is one line, right-aligned under Preview, naming a single missing item. A seller who
   taps Preview with several gaps has to scroll to find each one. The button itself is not a way to find the problem.
3. **No sense of progress.** The 4-step header shows we are on "Details", but not how far through details. The completeness bar only counts
   optional fields and never says "3 required left".
4. **Re-typing.** Someone posting a second ad starts from scratch. Owner/agent is prefilled from the profile; nothing else is.
5. **Ordering.** Photos and the description come last, after the long attribute list, even though they are what a seller finds easiest and
   what the AI copy helper needs filled first to be useful.
6. **Input ergonomics.** Some fields use dropdowns where two to four chips would do; numeric fields rely on browser behaviour for the
   right keyboard; the draft autosave works but is invisible, so people do not know their work is safe.
7. **No live preview on desktop.** The preview card exists (`ListingPreviewCard`) but only appears on the next step, so there is no
   reward while filling.
8. **We cannot see it.** `post_step_view` tells us who reached Details, not where inside it they stalled, which field errors, or how long
   each part took. Any change below is a guess without this.

## 3. Goals and how we will know

- More sellers who reach Details reach Preview (details to preview conversion), with no fall in listing quality (completeness at publish).
- Fewer blocked Preview taps, and fewer taps before success.
- Shorter median time on Details for sellers who finish.
- Same behaviour on web and mobile wherever the same fields exist.

Baseline first (Phase 0). Do not promise a number until we have it.

## 4. Proposals, in order

### Phase 0: measure (small, do first, web and mobile)
- Add field-level events to the existing funnel trail: first interaction with Details, time to first field, each **Preview-blocked** tap
  with the blocking field, and the last section touched before leaving (the idiom in the funnel plan: synthetic page-view paths such as
  `/post/error?stage=` decoded in `apps/admin/src/lib/pageTrail.ts`). Mobile already fires `post_step_view`; it needs the same field-level events as web.
- One admin view: details to preview conversion and the top blocking fields by category and platform.

### Phase 1: guide through the long form (web and mobile, medium)
1. **Keep every section open (decided 2026-10-22).** The optional sections (furnishing, amenities, preferences and the rest of the basics)
   stay expanded, so listing quality does not drop. The wall is tackled with guidance instead of hiding: mark required fields clearly
   (the red asterisk stays), keep the completeness bar, and use items 2 to 4 below. Revisit collapsing only if Phase 0 shows many sellers
   leaving mid-form.
2. **Show what is left.** A small "3 required left" chip near the top of the form (sticky on mobile), tapping which scrolls to and focuses
   the first missing field.
3. **Preview never silently disabled.** Keep the button enabled. On tap with gaps: scroll to the first problem, outline it, and show an
   inline message at the field ("Add the carpet area"). Replace the one-line right-aligned message with this.
4. **Per-field validation on blur**, not only at Preview, using the rules already in `listingAttributesIssue`/`listingPriceIssue` so web, mobile
   and the BFF agree.

### Phase 2: make it feel quick (medium)
5. **Reuse the last ad.** "Use details from your last ad?" at the top for repeat sellers: copy category-compatible attributes (not title,
   photos or pin). Needs a BFF read of the user's latest listing attributes (we already have `getMine`).
6. **Smarter defaults.** Counts that are always at least one, sensible BHK-linked defaults for bathrooms and balconies, furnishing from
   the earlier answer, price qualifier by category/transaction (already partly there). Every default stays editable and is never
   submitted as a silent guess for a required fact.
7. **Chips instead of dropdowns** for options of four or fewer; Yes/No as toggles; steppers kept for counts; correct keyboards
   (`inputMode`, number pad, `autocomplete` off) on every numeric field; units shown inside the field.
8. **Order by effort.** Offer photos earlier (right after the pin) so a seller who has them ready gets quick progress, and so the
   AI title and description helper has real input. Re-test: if photos early hurts completion on slow connections, put them back.
9. **Visible autosave.** "Draft saved just now" in the header; on return, "Continue your <category> ad" with a clear Start over.

### Phase 3: platform-specific polish (medium)
- **Desktop:** two columns at wide widths with the form on the left and a **live preview card** plus the required/optional checklist on the
  right (sticky). Keyboard flow: Enter moves to the next field, Escape closes pickers, Tab order matches visual order.
- **Mobile:** break Details into three short screens with a progress bar and a sticky bottom bar (Back / Next): **Location**, **About the
  property**, **Photos and description**. Keep the keyboard-aware scroll already in place, add a sticky "3 required left" bar, and keep
  large tap targets. The mobile app needs a store build or OTA for these, so ship it after web has proved the changes (as with the offer screen).

### Phase 4: lean on what the seller already has (large, optional)
- **Paste your existing ad text** (a WhatsApp or portal listing) and pre-fill attributes, title and description from it, reusing the AI
  copy service and the ideas in [`post-ad-via-whatsapp.md`](post-ad-via-whatsapp.md). Always shown for confirmation; never published unreviewed.
- **Infer from photos** (room count, furnishing) only if the above is not enough; accuracy and cost need their own plan.

## 5. Rollout and risk
- Ship behind an admin-controlled flag (the plan settings screens already hold such switches) and compare against the baseline for a week at a
  time. Order: Phase 0, then Phase 1 on web, then the same on mobile, then Phases 2 and 3.
- Do not change what the server requires: the BFF keeps the same validation. All of this is presentation, order and guidance.
- The mandatory map pin is now the first gate; the "required left" chip must include it so a seller is not surprised at Preview.
- Accessibility: every error tied to its field (`aria-describedby`), focus moved to the first error, no colour-only signals, 16px inputs
  (already used) and 44px tap targets.
- Test: unit tests on the "first missing field" and required-first ordering helpers (shared in `packages/types` so both apps use them),
  and a manual pass on one slow Android phone and one iPhone.

## 6. Decisions
1. **Decided: keep all sections open** and add required-left guidance, jump-to-first-problem and per-field validation instead of collapsing.
2. Open: is it acceptable to ask for photos earlier in the step (Phase 2, item 8), or should the order stay as it is?
3. Open: mobile as three screens (recommended) or one scrolling screen with the sticky progress bar only?
4. Open: plan the paste-your-ad idea (Phase 4) in detail now, or leave it for later?

## 7. Suggested order of work
Phase 0 (about a week of analytics, nothing visible) → Phase 1 web → Phase 1 mobile (with a release) → Phase 2 → Phase 3 → Phase 4 only if
the numbers justify it.

## 8. Built: Phase 0 and Phase 1 (2026-10-22), web and mobile
Not yet deployed or tried in a browser or on a device; types, unit tests (BFF, admin, web) and typechecks pass.

**Shared (`packages/types`)**
- `listingAttributeIssues` (categoryFields.ts) lists every attribute problem with its field key; `listingAttributesIssue` is now its first entry
  (same behaviour, tested for every category and transaction).
- `postDetailsIssues` (new) turns the wizard's old one-problem ladder into an ordered list of `{target, text, missing, group}`; web and mobile
  both call it, so they agree with each other. Targets: `location`, `posted_by`, `attr:<field key>`, `price`, `brokerage`, `photos`,
  `owner_type`, `assisted`, `title`, `description`.
- `postFieldEvents` (new) builds and parses the `/post/field?event=...` paths.

**Phase 1 (decision kept: every section stays open)**
- An "N left / Next: ..." chip: sticky at the top of the form on web, a floating bar at the bottom on mobile. Tapping scrolls to and focuses the
  first problem (a collapsed section is opened on web).
- Preview is no longer disabled for a problem. Tapping it with things left scrolls to the first problem, rings it, and shows a message under
  every field that has one; the line under the button now also says "(and N more)".
- Per-field validation on blur: a field's message appears once the seller leaves it (web: the field wrapper's blur; mobile: text inputs on blur,
  segmented choices on tap). Nothing nags while typing.
- Web: `CategoryFieldsAccordion` gained an optional `feedback` prop; the edit form does not pass it, so the edit screen is unchanged.

**Phase 0 (measurement)**
- Events written as synthetic page visits: `first_touch` (with time since the step opened), `preview_blocked` (first blocking target, how many left),
  `chip_tapped`, `details_exit` (last field touched and time on step, sent only when the seller leaves without going on to Preview, including on
  `pagehide`). Only target names and the category travel, never typed values.
- BFF `GET /admin/post-funnel/details` and an "Inside the Details step" section on admin Post-ad funnel: sessions at Details and Preview and the
  conversion, sessions that touched a field or were blocked, median time to first field, "What blocked Preview" and "Where people stopped".
  Page visits shows the new events as readable lines ("Details - tapped Preview, blocked by carpetAreaSqft (3 left)").
- Numbers start from the release that ships this; compare Details-to-Preview before and after.

**Known gaps**
- Mobile `first_touch` cannot name the field (it listens to touches on the form without claiming them); `details_exit` still names the last field
  focused. Mobile selects that open the option sheet are not marked "touched" until Preview is tapped.
- No flag yet: the behaviour change ships to everyone. The plan's flag idea is left for if the numbers fall.
- The mobile changes need a store build or OTA; web ships first.

## 9. Built: Phase 2 and Phase 3 (2026-10-22), web and mobile
Not yet deployed or tried in a browser or on a device; typechecks and unit tests pass (BFF 328 listings tests, web 75).

**Phase 2**
- **Item 5, reuse the last ad.** BFF `GET /users/me/listings/last-details?category=` returns the seller's latest ad in that category
  (attributes only). `reuseAttributes` (`@bhavano/types/listingReuse`, tested) copies **only** furnishing, amenities, preferences,
  brokerage terms and Posted by, into blanks, never over typing and only values the form still offers. Property facts (size, floor,
  bedrooms, price, photos, title) are never copied, so no wrong fact can be published by accident. Web and mobile show "Use details from
  your last ad?" with a Fill them in button, then say what was filled.
- **Item 6, smarter defaults.** Deliberately limited: counts already start at zero and the price qualifier already defaults by category.
  BHK-linked bathrooms and balconies were **not** added, because they would guess a required fact; item 5 covers repeat sellers instead.
- **Item 7, chips.** Web select fields with 3 or 4 short options render as buttons (tap the chosen one again to clear an optional field);
  14 fields across categories. Yes/No toggles, steppers, units inside the field and the right number keyboards already existed. Mobile
  already used segmented buttons for up to 3 short options.
- **Item 8, photos earlier.** Photos moved to right after the location on web and mobile (video stays further down). The decision in
  section 6 was taken as agreed with this request.
- **Item 9, visible autosave.** "Draft saved on this device at HH:MM" under the heading (web) and in the progress header (mobile). The
  existing "We restored the ad you were writing" banner already covers coming back, with Start a new ad instead.

**Phase 3**
- **Desktop (xl and wider):** two columns, the form on the left and a sticky rail on the right with a **live preview card** (the real
  `ListingPreviewCard` with the current values) and the **checklist** of what is left (each line scrolls to its field) plus the optional
  completeness. Hidden below xl, where the sticky "N left" chip remains. **Keyboard:** Enter in a single-line box moves to the next
  field (not in textareas, selects, buttons or the map search); Escape closes the multi-select list; Tab order follows the page.
- **Mobile:** Details is three screens with a progress bar: **Location and photos**, **About the property**, **Title and description**
  (the plan's grouping, adjusted so photos come early). A bar pinned to the bottom has **Back** and **Next** (the last is **Preview Ad**),
  with "N left on this screen: Next: ..." above it. Next moves on only when the screen is complete; otherwise it shows what is missing and
  scrolls to it. The header back arrow steps back through the screens. `detailsPartOfTarget` (tested) maps a problem to its screen, so
  Preview can jump to a problem on an earlier screen.

**Known gaps and notes**
- `preview_blocked` is now also sent when Next is blocked on a mobile screen, with the field that blocked it.
- No feature flag (as in Phase 1). Compare Details to Preview before and after in admin Post-ad funnel.
- Mobile needs a store build or OTA. Wizard behaviour is not covered by automated UI tests; do a manual pass on one slow Android phone
  and one iPhone, and a desktop at 1280px and wider, before widening any rollout.

## 10. Plan: making the required fields obvious before Preview (2026-10-26, proposal, nothing built)

**What production shows** (`/post/field?event=preview_blocked`, since 2026-10-22; 80 sessions, 183 blocked taps, small sample):
- The blocker is rarely the long attribute list. **Photos** blocked 41 of the 80 sessions, then **description** (17), **location** (11),
  **title** (12), **posted by** (9). Entrance facing, furnishing and carpet area follow with 6 to 8 each.
- 85 of the 183 taps had **one** item left: people are almost done and use Preview to find out what is missing.
- Platform (sessions): mobile browser about 50, desktop about 22, app 8. The sticky "N left" chip exists on web, but a phone browser seller
  sees only the chip, not what a field is.

**Why it still happens:** the required things are the plainest ones (photos, title, description), they sit in different parts of a long
form, and nothing says "required" until Preview is tapped. The red asterisk is too small to read as a rule.

**Proposals, in order of effect:**
1. **Say "Required" in words, on the three big blocks.** Photos, Title and Description headers carry a "Required" pill (and
   "Optional" on the rest of the form), with the rule beside it: "Add at least N photos" (N from the existing minimum), "Title,
   minimum characters". Same in web, mobile browser and app (shared label from `packages/types`).
2. **A "To post, you need" checklist at the top of the form on every platform**, not only the desktop rail: pin, photos, the required facts,
   title, description, each with a tick that turns green live. On phones it is a collapsed row ("4 of 7 done") that opens on tap; tapping a
   line jumps to the field. The sticky chip stays.
3. **Section badges.** Each section header shows a red "2 left" or a green tick, so a seller sees which section to open without Preview.
4. **Make Preview say what is missing.** With gaps the button reads "Add a photo to preview" (first missing item, "and 2 more") and looks
   unfinished; with none it reads "Preview Ad". It stays tappable and keeps today's jump-and-ring behaviour.
5. **Remove two blockers with the AI helper.** Once photos and the required facts are in, offer "Write the title and description for me"
   as the main action in the title block, and prefill an editable title from the facts ("2 BHK apartment for rent in Adyar"). This takes
   out title and description for most sellers.
6. **Photos first on phones.** Photos are already right after the pin; on mobile browser make the empty photo block a large "Add photos"
   target with camera and gallery choices, not a small uploader.

**Do not:** change what the server requires, hide optional sections (decision in section 6 stands), or disable the Preview button.

**Measure:** share of Details sessions that tap Preview while blocked, taps per session, Details to Preview conversion, and top blocking
field. Today: 183 taps over 80 sessions; photos 51% of blocked sessions. Success is photos and description dropping out of the top three.

**Order:** 1, 3 and 4 together (small, shared labels, web first), then 2, then 5 and 6. Mobile app changes need a store build or OTA.

### Built (2026-10-26): items 1, 3 and 4 of section 10, web and mobile app
Not yet deployed or tried on a device; web, mobile and BFF typechecks pass and the shared-helper tests pass (13).
- **Item 1, "Required" in words.** Location, Photos, Title and Description carry a red pill ("Required: at least 3 (1 added)",
  "Required: at least N characters") that turns into a green "Added" once satisfied. The red asterisk stays on the other fields.
- **Item 3, section badges.** Each section header shows "N left" (red) or a green tick when it holds required fields and none are left.
  `issueCountForFields` (shared) counts by field key; Price and brokerage count toward Pricing. Web: `CategoryFieldsAccordion`
  (`FieldFeedback.issues`). Mobile: the section loop in `PostAdWizard.tsx`.
- **Item 4, the button names the gap.** `previewButtonLabel` (shared): "Add photos (+2 more)", "Add a title", and so on; plain
  "Preview Ad" when nothing is left. While things are left the button is outlined, not filled, and stays tappable (it still scrolls to
  the problem). On the app, Next shows the same label for the problems on that screen.
- **Item 2, checklist on phones (2026-10-26).** Web below xl: a "See all" button beside the sticky chip opens a list of every missing item, each
  jumping to its field. App: a "To post, you need N things: see all" row in the bottom bar (shown when items are left on other screens)
  opens the same list; tapping one switches screen and scrolls to it. Desktop keeps its side checklist.
- Still to do from section 10: 5 (AI helper as the main action, prefilled title), 6
  (large camera/gallery photo target). Compare blocked taps and Details to Preview in admin Post-ad funnel after release.

### Title minimum raised to 20 (2026-10-26)
`TITLE_MIN_LENGTH` is now 20 (was 3) in `packages/types/src/listingLimits.ts`, so the wizard (web and app), the create and update DTOs and the pills all say 20.
Description stays at 50. 298 of 1,179 active listings had titles under 20 ("Rent", "PG for boys"), so the three edit forms (web, app, admin)
only check the title when it is changed and send it only then, the same rule the description already follows; an old listing can still be
edited for price or status without being retitled.
