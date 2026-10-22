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
