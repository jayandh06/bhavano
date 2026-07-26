# Wiring up Google Ads conversion tracking (GTM dashboard runbook)

## Context

The app already ships a GTM container (`NEXT_PUBLIC_GTM_ID`, loaded in
`apps/web/src/app/layout.tsx`) and pushes semantically-named `dataLayer`
events at the right moments in the code (`apps/web/src/lib/gtm.ts`). Per the
decision already recorded in `docs/plans/seo-google-ads-readiness.md`, the
actual Google Ads/GA4 conversion tags are configured **from the GTM dashboard
against these event names**, not in code — no deploy needed to add, change,
or remove a conversion.

This doc is the runbook for that dashboard-side setup, covering the 5
conversions decided on:

| Conversion | Event name | Value? | Fires from |
|---|---|---|---|
| Boost purchase | `boost_purchase` | Yes (₹) | `apps/web/src/components/home/BoostButton.tsx:60` |
| Subscription purchase | `subscription_purchase` | Yes (₹) | `apps/web/src/components/home/SubscribeButton.tsx:64` |
| Post ad success | `post_ad_success` | No | `apps/web/src/components/home/PostAdWizard.tsx` |
| New registration | `signup_complete` | No | `AuthGateProvider.tsx` (phone) + `SignupConversionTracker.tsx` (Google, added alongside this doc) |
| Save a search | `save_search` | No | `apps/web/src/components/home/SavedSearchesManager.tsx` |

`signup_complete` previously only fired for phone-OTP signups — Google
sign-in is a full-page redirect through NextAuth with no synchronous
"it just succeeded" moment on the client, so nothing fired for that path.
Fixed by `SignupConversionTracker.tsx`, mounted in `layout.tsx`, which checks
the already-server-side-populated `session.isNewUser`/`session.provider`
(`apps/web/src/auth.ts`) once the app reloads after the OAuth redirect back,
and fires `signup_complete` with `method: "google"` (the phone path already
fires its own with `method: "phone"` — same event name, so both roll up into
one "New registration" conversion in Ads).

## Prerequisite: connecting Google Ads and GTM

There's no single "link account" button that does everything — it's three
separate, independent things. Do them in this order:

### 1. Create a Conversion Action per row, in Google Ads

Google Ads → wrench icon (**Tools & Settings**) → **Measurement → Conversions**
→ **+ New conversion action** → **Website**. Ads will ask for your site URL
and try to scan it for existing tags — since nothing's wired yet, skip the
scan/choose "Add the tag manually" or "Use Google Tag Manager" when prompted;
either way, the actual firing happens in GTM (step 3), not from anything Ads
installs itself.

For each of the 5 conversions:
- **Category**: pick whatever's closest (Purchase for the two paid ones,
  Sign-up for registration, Lead/Submit lead form for post-ad and save-search
  — category mostly affects Ads' own reporting labels, not the tracking
  mechanics).
- **Value** — boost/subscription purchase: "Use different values for each
  conversion" (so the real ₹ amount flows through). The other three: "Don't
  use a value" unless you want them to count toward value-based bidding too.
- **Count**: "One" for all five (don't count repeat post-ad-success from the
  same session as multiple conversions, etc.).
- Save, then open the action and copy its **Conversion ID** (`AW-XXXXXXXXXX`
  — the same for every action in this Ads account) and **Conversion Label**
  (unique per action, a random-looking string like `AbC-D1efGhIjKlmNoP`).

### 2. Add a Conversion Linker tag in GTM (once, covers all 5 conversions)

This is a separate, general-purpose tag Google explicitly recommends adding
once per container — it captures the `gclid` click ID from the URL when
someone arrives via an ad click and stores it in a first-party cookie, so
whichever conversion tag fires later (maybe minutes or days after the click)
can still correctly attribute back to the ad. Without it, conversions can
silently under-report, especially on Safari/iOS.

GTM → **Tags → New** → tag type **Conversion Linker** → trigger: **All Pages**
(the built-in trigger, fires on every pageview) → **Publish**. Do this
regardless of which of the 5 conversions you set up first.

### 3. Add the per-conversion tags in GTM

This is the actual "hookup" — each Conversion ID/Label from step 1 gets
entered directly into a **Google Ads Conversion Tracking** tag in GTM, per
the "Per-conversion GTM setup" section below. No further Ads-side linking is
needed for these to start counting.

### Optional: account-level link (only if you also use GA4, or want Ads' auto-created remarketing audiences)

Google Ads → **Tools → Linked accounts** → link your **Google Tag Manager**
account (lets Ads suggest/import tags) and, separately, your **Google
Analytics (GA4)** property if you have one (lets you import GA4 conversion
events into Ads as an alternative to the GTM tags above). Neither is required
for the GTM-tag approach in this doc to work — skip both if you just want the
5 conversions above firing.

### Sanity check: auto-tagging is on

Google Ads → **Settings → Account settings → Auto-tagging** should already be
**ON** (it's the default) — this is what makes Ads append `?gclid=...` to
your site's URL when someone clicks an ad in the first place. If it's off,
step 2's Conversion Linker has nothing to capture and every conversion below
will fail to attribute to a specific ad/campaign.

## Per-conversion GTM setup

Repeat for each of the 5 event names. Two shapes: **value conversions**
(boost/subscription purchase) and **lead conversions** (the other three).

### Value conversions — `boost_purchase`, `subscription_purchase`

1. **Variables** (Variables → New, if not already present):
   - `DLV - value` — Data Layer Variable, name `value`.
   - `DLV - currency` — Data Layer Variable, name `currency`.
   - `DLV - transactionId` — Data Layer Variable, name `transactionId`.
2. **Trigger** (Triggers → New): type **Custom Event**, event name exactly
   `boost_purchase` (or `subscription_purchase`). Fires on "All Custom Events"
   matching that name.
3. **Tag** (Tags → New): type **Google Ads Conversion Tracking**.
   - Conversion ID: your `AW-XXXXXXXXXX`.
   - Conversion Label: this action's label from Ads.
   - Conversion Value: `{{DLV - value}}`.
   - Currency Code: `{{DLV - currency}}` (will resolve to `INR`).
   - Transaction ID: `{{DLV - transactionId}}` — dedupes if the same purchase
     event ever fires twice (e.g. a flaky reload).
   - Trigger: the one from step 2.

### Lead conversions — `post_ad_success`, `signup_complete`, `save_search`

1. **Trigger**: type **Custom Event**, event name exactly matching the row
   (e.g. `post_ad_success`).
2. **Tag**: type **Google Ads Conversion Tracking**.
   - Conversion ID / Label: this action's values from Ads.
   - Conversion Value / Currency: leave blank (matches "Don't use a value" in
     the Ads conversion action), unless you deliberately set a fixed value.
   - Trigger: the one from step 1.

## Verify before publishing

1. GTM **Preview** mode (Preview button, top right) → open the live site in
   the preview session → trigger each action (boost/subscribe on a test
   listing with Razorpay test mode, post a test ad, sign up with a fresh
   phone number and a fresh Google account, save a search) → confirm each
   Custom Event trigger fires and the corresponding tag shows "Fired" with
   the right variable values in the Preview pane's Variables tab.
2. For the two value conversions, double check `value` isn't `0`/`undefined`
   and `currency` reads `INR` in Preview before publishing.
3. **Publish** the GTM container version once everything fires correctly in
   Preview.
4. In Google Ads, Conversions → your new actions should move from "No recent
   conversions" to showing real counts within a few hours of real traffic.

## Note on `signup_complete`'s Google path

Because `session.isNewUser` stays `true` in the JWT for the rest of that
login session (not just the instant of signup — see the doc comment in
`apps/web/src/auth.ts`), `SignupConversionTracker` guards against refiring on
every later page load with a `sessionStorage` flag, scoped to the browser
tab. This isn't airtight against every edge case (e.g. opening a brand-new
tab while that same login is still fresh could refire once more) — an
acceptable, rare over-count for an analytics event, not a correctness-
critical one. If GTM/Ads conversion counts for "New registration" ever look
inflated, this is the first place to check.
