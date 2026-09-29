# Admin-assisted posting (post on behalf of a seller)

Status: proposed (2026-09-29). Not built.

## Why

Some sellers can't get through the post-ad flow themselves and ask for help. On 29 Sept a Jaipur
seller from a Rent Out Commercial ad hit the Owner/Agent error twice and then a stuck "Posting…"
button (see post-ad-draft-autosave.md, "Restored photos on iOS"). He sent a screenshot, but staff
had no way to post the ad for him. Other sellers will phone or WhatsApp their details and photos
and expect us to put the ad up.

Today an admin can only moderate and edit existing listings. admin-moderation.md says so
deliberately: "admins moderate, they don't post on behalf of users." This plan adds a narrow,
consent-first exception. Staff prepare the ad, and the seller confirms it with an OTP on their own
phone before it goes live.

## What already exists

- **The claim flow** (outreach-direct-listing-creation.md, `ListingsService.claimListing`):
  - A listing is created under the shared "Bulk Import" account (phone `9000000002`) with
    `claimContactId` pointing at an `OutreachContact`.
  - The business gets a `/claim/<listingId>` link by email or WhatsApp.
  - Signing in with OTP on the contact's exact phone moves the listing to that account. The claim
    is one-shot (`claimedAt`), and it works whether or not the person already had an account.
- **`ListingsService.create(input, ownerId)`** accepts any owner and a `claimContactId`, and
  skips the verified-phone check. That check lives only on the user-facing route. The Bulk
  Import owner is also skipped for "posted" notifications and Google Ads conversion uploads.
- **`POST /uploads`** (photos) only needs a signed-in user. An admin session can upload photos
  under a new listing id the same way the wizard does.
- **Limits of the outreach path:**
  - PG and coworking only.
  - Photos only from the scraper's folder on the server.
  - Price 0 and no description.
  - It's tied to `OutreachContact`, a marketing-prospect table with campaign and consent state.

## Design

### Who owns it before the claim

Every assisted listing is created under the Bulk Import account, as outreach listings are. The
seller is identified only by the phone number it will be claimed with. The same path covers both
cases:

- **Seller has no account:** they sign in with OTP on that number, which creates the account,
  and the claim moves the listing to them.
- **Seller already has an account:** the admin picks them with the existing user search
  (`GET /admin/users/search`), which fills in their name and phone. They sign in as usual, and
  the claim moves the listing to their account.

This deliberately rules out attaching a listing straight to an existing user's account without
their confirmation. Their name and phone would be published on their behalf with no record that
they agreed.

### Data model

- `Listing.claimPhoneE164 String?`: the number that may claim the listing, set for assisted
  listings. `claimListing` accepts `claimContact?.phoneE164 ?? claimPhoneE164`. Outreach listings
  keep using `claimContactId`, unchanged.
  - Rejected alternative: create an `OutreachContact` row for the seller so the claim code works
    unchanged. That would put a person who asked for help into the outreach and campaign
    audience, with the consent fields that implies. Wrong table.
- `Listing.createdByAdminId String?`, related to `User`: which staff member prepared it. The
  `created` row in `ListingEditLog` is written as an admin action by that user.
- `ListingPublishState` gains `awaiting_claim`. `publishState` already gates browse visibility and
  the post-live side effects (alerts to saved searches, the "posted" notification). Public reads
  already require `live`, so a new state is hidden by default.
  - Build check: go through every public read of listings (browse, search, detail, sitemap,
    Typesense indexing, similar listings) and confirm it filters on `live`, not just
    "not `pending_checkout`".

### Admin side: where the form lives

Reuse the web post-ad wizard rather than building a second form in `apps/admin`. The wizard holds
all the category fields, price rules, photo resizing and validation, and a copy would drift.

- `/post` on the web app shows a "Posting for someone else" panel above the category step, only
  when the session's role is `admin`.
  - Fields: seller's name, seller's phone (required, Indian mobile), and owner or agent (required,
    same rule as broker-paid-bundles.md, no default).
  - "Pick existing user" fills these in from the user search.
- With that panel filled in, "Post ad" calls a new `POST /admin/listings/assisted` endpoint
  instead of `POST /listings`. It takes the same `CreateListingDto` plus `claimPhone`,
  `claimName` and `postedAs`, and is guarded by the admin role.
  - The endpoint calls `ListingsService.create` with the Bulk Import owner,
    `publishState: 'awaiting_claim'`, `claimPhoneE164` and `createdByAdminId`.
- The success screen shows the claim link, `https://www.bhavano.com/claim/<id>?via=assisted`,
  with a Copy button and a "Share on WhatsApp" link that pre-fills a short message.
  - `ClaimSource` gains `assisted`, so the admin claim column can show it.
- The draft autosave stays off in admin mode. A draft of one seller's ad must never reappear as
  the admin's own next post.

### Seller side: the claim

The existing `/claim/<id>` page (`ClaimListing`) is worded for businesses found on Google. For
assisted listings (`claimPhoneE164` set) it shows:

- A preview card of the prepared ad, plus the text "Bhavano prepared this ad for you. Sign in
  with +91 98xxx xx210 to check it and publish." The phone is masked.
- Sign-in, then a review with "Publish" and "Edit before publishing". Edit opens the normal
  owner edit page for the now-claimed listing, with publishing deferred until they press Publish.
- On Publish:
  - Run `assertCanPublish(userId)`: the free-listing and slot limits apply to the real seller at
    this point. When the listing was created, they were checked against the Bulk Import account,
    which proves nothing.
  - Set `ownerId`, `claimedAt`, `claimSource`, `publishState: 'live'` and `publishedAt`.
  - Save `postedAs` to the profile if the profile has no seller type yet, the same rule as create.
  - Run `runPostLiveSideEffects` for the real owner: the "posted" notification and saved-search
    alerts. Upload the Google Ads conversion only if the seller has an ad click on file
    (`acquisitionGclid`).
- A wrong phone gets the existing "This phone number doesn't match…" error, plus a line
  suggesting they reply to the message they got from us.

### Admin visibility

- The admin listing page shows a badge, "Assisted, awaiting claim by +91 98xxx xx210, prepared by
  <admin>", with Copy link and Delete buttons.
- The admin listings list gets a filter for `awaiting_claim`.

### Expiry

Unclaimed assisted listings are deleted after 14 days by the existing daily job pattern. Their
photos go with them through the usual listing delete. A wrong number typed by staff therefore
leaves nothing behind for good.

## Related gap, fixed first (2026-09-29)

- **The gap:** unclaimed outreach listings were live, and a contact reveal returned the Bulk
  Import placeholder number `9000000002`. Messages went to the Bulk Import account too.
- **The fix:** reveal and first message are now blocked on listings owned by Bulk Import, with a
  "not verified yet" note and no credit spent (decided over revealing the scraped Google phone).
  See pg-coworking-google-places-leadgen.md, "Unclaimed listings can't be contacted".
- Assisted listings avoid this anyway by being hidden until claimed.

## Out of scope for v1

- **An automated WhatsApp or SMS claim message.** MSG91 templates need Meta approval, and the
  existing `claim_listing_1` is worded for businesses. V1 has staff send the copied link from the
  support WhatsApp. Add a template once volume justifies it.
- **Publishing before the seller confirms,** even when they asked for it over the phone. That
  consent isn't recorded anywhere we can show later.
- **Videos.** They're optional, and the seller can add them after claiming.
- **The mobile app.** The claim link opens on the web, and the claimed listing then shows in the
  app's My listings like any other.

## Decisions (2026-09-29)

- Hidden until claimed.
- The Bulk Import reveal gap is fixed first, as a separate change.
- Expiry: 14 days, revisit once there's real usage.
