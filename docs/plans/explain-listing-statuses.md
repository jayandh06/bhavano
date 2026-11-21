# Explain what each ad status means when the owner changes it

## Status: built 2026-11-21 (web first; mobile in the next app release)

**As built, and where it differs from the plan below**
- Shared copy and rules: `packages/types/src/listingStatusInfo.ts` (`statusOptionsFor`, `leavingActiveNotice`,
  `ownerStatusLabel`, `publicStatusLabel`), tested in `apps/web/src/lib/listingStatusInfo.test.ts`.
- Web: `ListingStatusPicker.tsx` replaces the dropdown in `EditListingForm.tsx`; My listings badge uses
  `ownerStatusLabel`. Mobile: cards in `my-listings/[id]/edit.tsx` (always visible, not a collapsing list);
  badge in `my-listings/index.tsx`.
- **No pop-up confirm.** The "what will happen" summary appears under the cards as soon as a hiding
  status is picked, before Save. Same information without an extra tap.
- "Deactivated" is shown as **Paused** on the owner's screens only; the ad's public page still says
  Deactivated, and the summary says so ("Its page will show as Deactivated").
- **The three open checks, resolved:**
  1. Featured: nothing pauses a running Featured period when an ad is closed, so paid days keep running
     while the ad is hidden. The summary says so for Featured ads (`isBoosted`).
  2. Interested people are **not** told when an ad is marked Sold/Rented (no code path does it). The
     copy makes no such promise (a test guards this). Notifying them would be a separate change.
  3. Moving an ad back to Active is **not slot-checked** in `update()`: an owner at the limit can
     reactivate past it. Left as is; a business decision, not part of this change.

**Problem:** an owner changing an ad's status sees a bare dropdown: "Active — visible to buyers/renters",
"Sold", "Rented", "Deactivated — hidden from search". Sold and Rented say nothing about what happens,
and nothing says what is reversible, what frees a slot, or when to pick which. People pick the wrong
one (for example "Deactivated" for a rented flat, or "Sold" when they only wanted to pause).

## What each status does today (checked in the code)

All four can be set by the owner at any time on the edit screen (web `EditListingForm.tsx`, mobile
`my-listings/[id]/edit.tsx`; both carry the same `STATUS_OPTIONS`). Admin can override
(`setStatusAsAdmin`).

| Status | Search, browse, sitemap | The ad's own page | Contact / interest | Owner's ad slot | Renew |
|---|---|---|---|---|---|
| Active | Shown | Normal | Allowed | Uses one | Allowed |
| Sold | Hidden | Still opens, labelled Sold | Blocked ("no longer accepting responses") | Freed | Not allowed |
| Rented | Hidden | Still opens, labelled Rented | Blocked | Freed | Not allowed |
| Deactivated | Hidden | Still opens, labelled Deactivated | Blocked | Freed | Not allowed |

Sources: `explicit-close-not-auto-expire.md` (an ad only leaves search when the owner or admin closes
it; the page stays reachable for SEO), `listing-slots.service.ts` (`activeListingWhere` counts only
`active`), `listings.service.ts` `renew()` (active only).

In practice **Sold, Rented and Deactivated behave the same** (hidden, contact blocked, slot freed).
They differ only in the label shown on the ad's page. So the screen should explain the *label* and
the *consequence*, not imply they do different things.

## Not verified yet (check before writing the final copy)

1. Whether closing an ad changes a running **Featured** period (paid time may keep running with no
   refund). If so the confirmation must say it.
2. Whether people who showed interest or saved the ad are **told** when it is marked Sold/Rented.
3. Whether moving an ad **back to Active** is checked against the owner's slot limit. In
   `update()` I found no such check (only publish and renew call the slot checks), so an owner at the
   limit may be able to reactivate past it. Decide whether that is intended.

## Proposed design

1. **Replace the dropdown with option cards** (radio list). Each card: a title, one plain sentence,
   and 2-3 "what happens" lines. Cards:
   - **Active** — "Buyers can find and contact you." Counts toward your ad limit.
   - **Sold / Rented** — "The deal is done. Show it as Sold (or Rented) so people stop asking."
     Hidden from search, contact switched off, frees an ad slot. The page stays up with the label.
   - **Paused (Deactivated)** — "Not available for now, may come back." Hidden from search, contact
     switched off, frees an ad slot. Switch back to Active any time.
2. **Show only the relevant outcome:** Sold for sell/buy ads; Rented for rent/lease ads. Keep the
   other one only if it is the ad's current value. PG, coworking and similar get "Rented".
3. **Confirm step when leaving Active:** a one-line summary of what will happen ("Your ad will be
   hidden from search and people can no longer contact you. You can switch it back to Active later.")
   with the chosen status named. No confirm when going back to Active.
4. **Rename the label "Deactivated" to "Paused"** in the owner screens only (the stored value
   `deactivated` and admin wording stay). Add "when to use which" as a short helper line under the
   heading: "Deal done → Sold/Rented. Just not available right now → Paused."
5. **Status badge on My listings** gets the same wording, so the list and the picker agree.
6. **One shared definition** in `packages/types` (label, summary, consequence lines per status and
   transaction type) used by web and mobile, so the copy cannot drift.

## Where

- Web: `EditListingForm.tsx` (picker), `my-listings/page.tsx` (badge).
- Mobile: `my-listings/[id]/edit.tsx` (picker, already a modal list with `statusOption` cards),
  `my-listings/index.tsx` (badge). Mobile needs an app release; web can ship alone first.
- Types: new `listingStatusInfo` helper in `packages/types`.
- No BFF or database change; values unchanged.

## SEO / risk

No public page changes. The ad's own page and its status label are untouched, so there is no SEO
impact. Only owner-facing screens change. Reaching the cards must not block saving a price or other
edit (the status field stays optional in the same form).

## Rollout and checks

1. Resolve the three open checks above (about an hour), then finalise copy with the owner.
2. Build the shared helper, then the web picker; unit-test the helper (right options per
   transaction type, current value always kept).
3. Ship web; then mobile with the next app release.
4. Measure: share of closed ads later switched back to Active within 7 days (a proxy for mistaken
   choices), before and after.
