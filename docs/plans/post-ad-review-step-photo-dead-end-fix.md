# Fix: "Post ad" can dead-end on Review with too few photos

## Context

A real user session (Harish Kumar, 3 Oct 2026) reached the Review step of the post-ad wizard and
got "At least 3 photos are required" four times in a row over ~40 minutes, then gave up without
posting. Traced the code precisely:

- The whole wizard (category → details → review) renders at one URL, `/post` — `step` is just
  client `useState`, no routing involved (`PostAdWizard.tsx:349`).
- Photos aren't uploaded when added on the Details step — only later, when "Post ad" is clicked on
  Review, inside `publish()` (`PostAdWizard.tsx:1320-1371`), for performance reasons
  (`docs/plans/posting-speed-and-progress.md`).
- The "Preview Ad" button on Details is supposed to block fewer than `MIN_PHOTOS` (3) photos
  (`detailsIssue`, `PostAdWizard.tsx:1195`, gating `detailsValid`, `:1201`, which disables the
  button at `:1991`).
- The exact error text in the trail ("At least 3 photos are required") only ever comes from the
  **server's** re-check inside `ListingsService.create()` (`listings.service.ts:1423-1424`) — a
  failed photo *upload* takes a different, earlier return path with different wording
  (`PostAdWizard.tsx:1356-1369`) and never reaches that server check at all.
- So this error can only fire when the local `photos` array was *already* below 3 the moment
  "Post ad" was clicked on Review — and once it happens, there is no way back: the Review step has
  no photo-add/remove UI of its own, so retrying "Post ad" just fails identically forever. That
  dead end, not the original cause, is what turned one validation miss into a 40-minute,
  un-recoverable session.

The exact mechanism that lets `photos.length` drop below 3 between leaving Details and clicking
"Post ad" on Review wasn't pinned down from reading the code alone (no photo-removal UI exists on
Review, and a resumed draft is explicitly forced back to the `details` step on restore specifically
to avoid this class of bug — `PostAdWizard.tsx:526`). Given that, and since moving photo upload
earlier (to catch this at Details time) would also force login to move earlier — undoing a separate,
deliberate "no login wall until Preview" decision (`PostAdWizard.tsx:1203-1214`) — the chosen fix is
the smaller, safer one: a defensive re-check at the moment "Post ad" is clicked, which sends the
visitor back to Details with a clear, actionable message instead of ever letting the request reach
the server from a dead-end screen. This closes the unrecoverable-dead-end problem outright, even
without the original root cause being fully nailed down.

**Two other approaches were considered and rejected** (both would also work, but cost more):
upload each photo eagerly as soon as it's added on Details, gating "Preview" on confirmed upload
success rather than just file count — either only for already-logged-in users (preserves the
no-login-wall decision but adds per-photo status tracking/retry UI for only part of the audience),
or for everyone (fully closes the gap, but reintroduces the login wall on Details that was
deliberately removed). Revisit one of these if the defensive re-check below turns out not to be
catching real cases in practice.

## Change

**File:** `apps/web/src/components/home/PostAdWizard.tsx`

1. Added a `photoSectionRef` (`useRef<HTMLDivElement | null>(null)`) alongside the existing
   `sellerTypeRef`, attached to the photos section's container div (`<div className="max-w-[720px]">`)
   — same pattern `sellerTypeRef` already uses for scrolling a validation failure into view.

2. In `publish()`, added a new early-return check in the same spot as the existing
   `askSellerType`/`assistedProblem` guards (right after them, before `setPending(true)`):

   ```ts
   if (photos.length < MIN_PHOTOS) {
     backToDetails();
     setPhotoNotice({
       kind: "file",
       text: `Add at least ${MIN_PHOTOS} photos before posting — only ${photos.length} ${photos.length === 1 ? "is" : "are"} ready.`,
     });
     setTimeout(() => photoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
     return;
   }
   ```

   `kind: "file"` is used (not `"limit"`) because the existing render condition only shows a
   `"limit"`-kind notice while `photos.length >= MAX_PHOTOS` — a `"file"`-kind notice always
   renders, which is needed here since the count is necessarily *below* the minimum, not at the
   maximum. `backToDetails()` already handles clearing `error` and returning to the `details` step
   (including the Review step's own browser-history entry), exactly mirroring the existing
   sellerType-missing guard immediately above it.

No backend, schema, or upload-timing changes — this is a pure client-side guard that prevents the
request from ever reaching the server with too few photos, using patterns (`backToDetails`,
`photoNotice`, scroll-into-view-on-validation-failure) that already exist in this exact function for
an identical kind of guard.

## Verification

- `pnpm --filter web exec tsc --noEmit` and `pnpm --filter web exec eslint
  src/components/home/PostAdWizard.tsx` — both clean (two pre-existing, unrelated warnings in this
  file — `boostRecoveryMessage`/`loggedIn` unused — confirmed present before this change too).
- Manual verification still open: reach Review with 3+ photos normally (confirm nothing regresses),
  and confirm the real dead-end case (if reproducible) now returns to Details with the new message
  and the photo section scrolled into view, instead of repeating the server error.
