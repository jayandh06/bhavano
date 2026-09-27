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

Encrypted in transit: yes. Users can request deletion: yes. As submitted 2026-09-27 (Collected
unless noted; "shared" = the Google Ads conversion upload in `google-ads-conversion.provider.ts`,
which on Android has no consent gate):

| Data type | Shared | Required | Ephemeral |
|---|---|---|---|
| Approximate / precise location | no | optional | no (listing pins stored) |
| Name | no | required (basics gate) | no |
| Email, phone | **yes** (hashed) | required (basics gate) | no |
| User IDs | **yes** (`signup-<userId>` transactionId) | required | no |
| Purchase history | **yes** (amount, purpose, payment id) | optional | no |
| User payment info (Razorpay SDK) | no (processor) | optional | no |
| Other in-app messages | no | optional | no |
| Photos, videos | no | optional | no |
| App interactions (pageviews) | **yes** (signup/post-ad/purchase conversions) | required | no |
| In-app search history | no | optional | **yes** (mobile doesn't log searches) |
| Other UGC (listings, requirements) | no | optional | no |
| Other actions (favourites) | no | optional | no |
| Crash logs (`/client-errors`) | no | required | no |
| Device or other IDs (push token, analytics session) | no | required | no |

Not declared: address, sensitive personal info, financial other, health, emails/SMS, audio, files,
calendar, contacts, installed apps, web history, diagnostics. If a new flow sends any of these (or
a new field joins the Ads upload), update this table and the form together.

Other declarations: Government app — No. Health features — none. Advertising ID — No (AD_ID
blocked). Category: App → **House & Home**; tag: Interior design only (no real-estate tag exists).
Store listing language: en-IN only, no AI translations while the app itself is English-only.

## Store listing text

- **App name (30):** `Bhavano` (alternative within limit: `Bhavano: Buy, Rent, PG & Plots`)
- **Short description (80):** `Buy, rent or lease homes, plots, PG, coworking and furniture across India`
- **Feature graphic (1024x500):** `apps/mobile/store-assets/play-feature-graphic.png`, built by
  `make_feature_graphic.py` from `assets/icon.png` plus the web palette (green `#0b3d2e`, cream
  `#efe9dc`, gold `#c9a15a`) and fonts (Lora wordmark, Manrope text). Fonts aren't committed;
  the script's docstring says where to get them. Re-run after an icon or palette change.
- **Full description:** below. Don't claim free posting — a platform fee is required to publish
  (`BoostPlanSelector`). No "best"/"#1"/emoji per Play's metadata policy.

```text
Bhavano is a property classifieds app for buying, renting and leasing across India: houses, apartments, villas, plots, PG accommodation, coworking desks, storage and commercial spaces, plus furniture and interiors. Browse freely, with no login needed to look around.

WHAT YOU CAN FIND
• Buy: houses, apartments, villas, plots and commercial property
• Rent & Lease: flats, independent houses, shops, offices and storage space
• PG: paying-guest rooms for students and working professionals
• Coworking: desks, cabins and office space
• Furniture and interiors

SEARCH THE WAY YOU WANT
• Pick your city and area, or use your location to see listings near you
• Filter by category and property type
• See photos, videos and the location on a map
• Save favourites to come back to later

TALK DIRECTLY
• Chat with owners and buyers inside the app
• Get a notification as soon as you receive a new message
• Unlock an owner's contact details when you're ready to call

POST YOUR PROPERTY
• List a property in a few minutes with photos, video and a map pin
• Edit, deactivate or reactivate your ads any time from My listings
• Boost an ad to show it higher in search results
• A platform fee applies to publish a listing. You'll see the exact amount before you pay.

LOOKING FOR SOMETHING SPECIFIC?
• Post a requirement describing what you need, so owners can find you
• Turn on Instant Alerts to hear about matching new listings first

SAFE AND IN YOUR CONTROL
• Sign in with your phone number (OTP) or your Google account
• Listings and messages are reviewed by the Bhavano team
• Delete your photos, messages or your whole account from inside the app

Bhavano is owned and operated by Finfolia Technologies LLP.
Questions or feedback: support@bhavano.com
Privacy policy: https://bhavano.com/privacy
```

## Open follow-ups

- **Done:** `app.config.js` no longer requests `RECORD_AUDIO`, and `blockedPermissions` strips
  `RECORD_AUDIO`, `CAMERA` and `com.google.android.gms.permission.AD_ID` from the merged manifest
  (expo-image-picker also has `cameraPermission`/`microphonePermission: false`). The app only
  *picks* media from the library and never reads the advertising ID, so the Data safety form
  declares no audio and the Advertising ID declaration is answered "No". Takes effect from the
  next native build; re-add a permission here if a camera or record-in-app flow is ever added.
