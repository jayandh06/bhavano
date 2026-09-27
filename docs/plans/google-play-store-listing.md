# Google Play store listing — policy declarations

Answers given in Play Console → App content, and why, so the next submission (or an audit) doesn't
re-derive them. Package: `com.finfolia.bhavano`.

## Financial features

**Answer: "My app doesn't provide any financial features."** Nothing ticked.

Bhavano is a property classifieds app. It has no lending, banking, credit, wallets, trading,
insurance or financial advice. The only money movement is users buying Boost / Instant Alerts /
contact-unlock credits / subscriptions through Razorpay. That's a purchase of our own service
through a payment processor, not "Mobile payments and digital wallets", which means an app that
holds funds or moves money between users.

Revisit if we add a home-loan partner or referral, an EMI calculator that leads to lenders, or
tenant → owner rent payments (Loan facilitator / Money transfer).

## Privacy policy

- **Privacy policy URL:** `https://bhavano.com/privacy`
- **Account deletion URL:** `https://bhavano.com/privacy#delete-account`
- **Data deletion URL (keep account):** `https://bhavano.com/privacy#delete-data`. Covers
  photo/video removal (really deleted from R2), unfavourite, message delete (soft: text kept for
  moderation), listing deactivation (hidden, not erased), and email for anything else.
- **Partial deletion question:** answered Yes.

The page is public (no login) and linked in-app: login sheet, Help, Contact, About, LegalFooter.
The app has its own copy at `apps/mobile/app/privacy.tsx`, and the two must be kept in sync.

**2026-09-27 rewrite.** The 1 September version failed Play's "comprehensively discloses… types of
parties you share it with" test. It also contradicted the app, saying "no third-party advertising
or tracking cookies" while the site runs GTM (Google Analytics + Ads) and the backend uploads
hashed email/phone to Google Ads (`server-side-google-ads-conversion-upload.md`). The rewrite adds:

- named processors: AWS, Cloudflare, Razorpay, Google/Apple sign-in, MSG91, Meta WhatsApp, Zoho
  Mail, Expo/FCM/APNs, Google Maps Platform
- the Google Ads hashed-identifier upload, and that iOS skips it when ATT is denied
- push tokens, purchases, photos/videos picked from the library, map-pin location
- listings created from public business info (`pg-coworking-google-places-leadgen.md`)
- self-serve deletion and exactly what `AccountDeletionService` erases vs keeps (anonymised payment
  rows, sent messages)

## Data safety form — keep consistent with the policy

Declare at least: name, email, phone (account), approximate + precise location (optional, user
initiated), photos/videos (listings), in-app messages, purchase history, app interactions, device
or other IDs (push token). Shared with third parties: email/phone hashed to Google Ads (advertising
and attribution). Encrypted in transit: yes. Users can request deletion: yes.

## Open follow-ups

- `app.config.js` requests `android.permission.RECORD_AUDIO`, but the app only *picks* videos from
  the library (`PostAdWizard` → `launchImageLibraryAsync`) and never records. Play asks you to
  justify microphone access. Remove the permission unless a record-in-app flow is planned.
- Confirm the merged Android manifest has no `com.google.android.gms.permission.AD_ID`, since the
  policy says the apps don't use the advertising ID. If a transitive dependency adds it, strip it
  with `tools:node="remove"` or answer the Advertising ID declaration to match.
