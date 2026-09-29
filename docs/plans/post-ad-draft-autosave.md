# Post-ad draft autosave (web and mobile)

Status: built (2026-09-28).

## Why

On 28 Sept 2026 a seller from a Google Ads click (Bhubaneswar, "Sell Plot/Land" ad group) spent
about 11 minutes filling in `/post`, including photos. She signed in with OTP at the "Preview Ad"
button. A web deploy had gone out a minute earlier, so her browser was still on the old build.
After the login, Next.js' `router.refresh()` hit the version skew and fell back to a full page
reload. That reload wiped the wizard's in-memory state and the `requireLogin({ onSuccess })`
resume. She landed back on an empty category step, never reached the preview, and went to
`/my-listings` looking for the ad she thought she had posted.

Deploys aren't the only thing that reloads the page. Pull-to-refresh, a mobile browser discarding a
background tab while the seller reads the OTP SMS, and an accidental back/forward all do it too. On
the app, Android can kill the process in the background for the same reasons. The form has to
survive all of these.

## What shipped

- **Web** (`apps/web/src/lib/postAdDraft.ts`, `PostAdWizard.tsx`):
  - The text fields are saved to `localStorage` (`bhavano:post-ad-draft`). This covers the step,
    category, transaction type, price, qualifier, price mode, title, city (id plus the city object,
    for a pin-resolved city missing from the page's list), area, pin, description, attributes and
    the boost choice. Saves are debounced by 400 ms.
  - Photos are required, and `localStorage` can't hold them. They're saved in IndexedDB
    (`bhavano-drafts` / `post-ad-photos`) as their bytes (`{ name, type, lastModified, data }`),
    and preview URLs are rebuilt on restore. Storing the `File` objects themselves broke on
    iPhones; see "Restored photos on iOS" below.
- **Mobile** (`apps/mobile/src/lib/postAdDraft.ts`, `PostAdWizard.tsx`):
  - The same fields, including `description`, go into AsyncStorage. (Drafts from before 29 Sept
    held a `specs` box's text instead; the app's form now has a Description box like the web's.)
  - Photos are kept as the image picker's cache URIs. On restore, any URI the OS has since cleared
    (checked with `Image.getSize`) is dropped.
- **Both apps:**
  - The restore runs once on mount. Nothing is saved until that attempt has finished, so an empty
    first render can't overwrite a saved draft.
  - If the seller picks a category before the restore resolves, the restore is skipped.
  - A draft saved on the preview step resumes on the details step, because the preview is only
    shown after the account check in `onPreview`.
  - A banner reads "We restored the ad you were writing", with a **Start over** button that clears
    the draft and resets the form.
  - The draft is cleared once `createListing` succeeds, even when payment is still pending, so
    retrying payment can never try to create the same listing id again. Saving stops at that point.
  - Drafts older than 7 days are discarded.
- **Map pickers** take an `initialPin`, and a restored or previously placed pin is where the map
  opens. On web this also skips the automatic "use my current location" when permission is already
  granted. Before, going back from the preview to the details step re-ran that auto-locate. It moved
  the pin to wherever the seller was sitting and overwrote the city and area they had picked.

## Not kept

- **Videos.** They're too large to store, and they're optional. A seller who had added one adds it
  again.
- **`listingId`.** It's regenerated on every mount. Photos uploaded under an old id by a submit that
  failed partway stay orphaned, which is also how it worked before this change.
- **Anything server-side.** The draft lives only on this device and browser, so switching devices
  starts fresh. A server draft would need a login before the form, and the post flow deliberately
  asks for an account only at the preview step.

## Back button on the preview (web, 2026-09-29)

The wizard's steps are component state, so the preview had no history entry of its own. The
browser or phone Back button on it left `/post` for whatever page came before, which for an ad
visitor is the home page.

- **What happened:** on 29 Sept a Google Ads visitor filled in the whole form, signed up by OTP
  at "Preview Ad", pressed Back 11 seconds after the preview opened, and landed on `/` with
  nothing posted.
- **How often:** of ~100 web preview views since 24 Sept, 9 were followed by `/`, and only 2 of
  those visitors posted within a day.
- **The fix:** `PostAdWizard` now pushes a history entry when the preview opens, and a popstate
  listener returns to the details step.
  - The in-page "← Back" button pops that entry rather than calling `setStep` directly, so the
    history stays in step with the screen.
  - If the preview is left without popping (posted, or started over), the next Back skips the
    now-duplicate entry.
  - A Back press during an upload keeps the preview open.
  - After a reload on the preview, the surviving entry is re-adopted on mount.
- **Scope:** only the preview gets an entry. The category and transaction-type steps have their
  own resets on their in-page Back buttons.
- **Tests:** `apps/web/e2e/post-ad-preview-back.spec.ts` covers this, and fails without the fix.
- **Mobile:** the app is unchanged; it handles Back separately.

## Restored photos on iOS (web, 2026-09-29)

- **What happened:** on 29 Sept an iPhone seller (Google app browser, Jaipur, Rent Out
  Commercial) tapped "Post ad" three times after reloads that restored his draft. Each time the
  button stayed on "Posting…" for good. The web server logged `Error: Unexpected end of form`
  about 2 seconds after each tap, and no upload ever reached the BFF. Those three were the only
  times that error appeared in the logs since the 20th.
- **Why:** iOS WebKit can keep a `File` that was stored in IndexedDB as a reference to the photo
  picker's temporary copy. Once iOS deletes that copy, the restored `File` still previews, but
  uploading it sends a truncated multipart body. Next.js fails to parse the body before
  `uploadPhotoAction` runs, so the server action rejects instead of returning `{ error }`.
  `onSubmit` had no catch, so `pending` never reset.
- **Fixes:**
  - Draft photos are stored as bytes. A draft saved in the old format keeps only the photos that
    can still be read. Any dropped photo is named in a notice beside the photo picker ("couldn't
    be restored… add it again").
  - `onSubmit` reads each photo into memory before uploading it. A photo that can't be read
    fails by number, with "Remove it, add it again".
  - Since 29 Sept, photos are also read into memory when they're picked, not only at upload. A
    Delhi seller's unshrunk photo became unreadable a minute after the preview; holding the bytes
    from the start avoids it, and the upload-time check stays as the backstop.
  - `onSubmit` wraps the whole publish. A thrown server action resets the button and shows
    "Your ad couldn't be sent…". It's also reported as `post_error [publish_exception]` with the
    underlying message.
- **Tests:** `apps/web/e2e/post-ad-draft-photo-restore.spec.ts` covers the reload, the restored
  photo and the publish. The last step needs photo storage configured, so locally (no R2
  credentials) it stops at the BFF's upload 500. Chromium can't reproduce the iOS file deletion
  itself.

## Related

- The deploy itself is still what triggers the reload. Deploying outside peak ad hours (IST
  daytime) reduces how often it happens, but this autosave is what stops it losing anyone's work.
