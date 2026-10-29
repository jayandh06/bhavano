# Featured ads: let the owner see an interested seeker's phone and call them

## Status: built and deployed dark (2026-10-29) — **off until an admin ticks it** (Admin → Settings → Seeker contact). Consent: notice-only at launch, opt-in later if required.

### As built (differences from the plan below)

- **Defaults taken for the open questions:** Agent Pro also sees leads free; 0 free lead unlocks (admin-editable); WhatsApp as well as Call; one credit wallet and one price shared with seeker reveals.
- **Settings:** one new singleton `SeekerContactSetting` (`enabled`, `consentMode` notice|opt_in, `freeLeadRevealsPerOwner`) rather than extending `ContactRevealSetting`. Public read at `GET /seeker-contact/settings`; admin at `/admin/seeker-contact-settings`.
- **Consent is on the user, not per interest:** `User.contactShareChoice` (unset|yes|no); shareability is computed on every read from the mode, so switching to opt-in or a seeker opting out takes effect immediately and the `ListingInterest.contactShared` flag in the plan was not needed. `ListingInterest.contactViewedAt` records the first Call / WhatsApp / unlock.
- **Rules in one place:** `apps/bff/src/contact-reveal/lead-contact.ts` (`leadPhoneIfShareable`, `ownerSeesLeadsFree`, `buildLeadContactView`, `unlockLeadContact`, tested in `lead-contact.spec.ts`). A credit-unlocked lead is hidden again if the seeker later says no.
- **API:** `GET /listings/:id/interests` now also returns `leadContact` (pricing and balance) and, per person, `contact` (`available|unlockable|none`), `phone` (only when allowed) or `phoneMasked`. `POST /listings/:id/interests/:userId/reveal-contact` (402 when no credit; also records a tap on an already-visible number). `GET/PUT /users/me/contact-share` for the seeker's toggle.
- **Screens:** web `ListingInterestsPanel` (Call, WhatsApp, Unlock, credit purchase through the shared `BuyCreditsProvider`, "Make it Featured" link), web profile `ContactShareCard`, a one-line `ContactShareNotice` under the contact area of a listing page for logged-in visitors, admin `/settings/seeker-contact`; mobile has the same panel (unlock works with credits already held; buying a pack is on the website) and an account card. Mobile needs an app release.
- **Not built yet:** the login-screen notice line; the privacy-policy text (do this before enabling: "What we share" must say owners of Featured ads, or who unlock it, can see the verified number of people who show interest, and how to turn it off); the opt-in tick dialog (only if you switch to opt-in); the "who unlocked your contact" row.
- **Before turning it on:** privacy policy updated, then tick the switch, then watch Admin → Page visits for the `interest_contact` upsell events.

### Original plan (kept for the reasoning)

**Ask (revised):** an owner whose ad is Featured sees, free, the phone number of people who showed
interest in it (viewed it while logged in, saved it, messaged) and can call them directly. An owner
of a free ad can unlock any one lead's number by spending a contact-reveal credit, like a seeker does.

This is exactly the "Level 2 — Contact share" that
[`login-gated-listing-interest-owner-notify.md`](login-gated-listing-interest-owner-notify.md) parked
for Phase 2 ("explicit opt-in … mirrored from requirement `contactConsent`"). Everything shipped so
far (owner alerts, the interested panel `ListingInterestsPanel`, `ListingInterestDto`) deliberately
carries **name only**; the alerts in [`owner-notification-channel-preferences.md`](owner-notification-channel-preferences.md)
never include a phone or email. This plan changes that for one audience, on purpose.

## What exists today

| Piece | State |
|---|---|
| Interested list | `ListingsService.listInterests` returns `userName`, times, `conversationId`. No phone/email. Owner-only. |
| Featured check | `isListingBoosted(listing)` (`boostedUntil` in the future); Agent Pro via `resolveVideoEntitlement`-style helpers in `packages/types`. |
| Upgrade flow | `?openBoost=<listingId>` opens the purchase modal on My listings (`AutoOpenPurchaseModal`). |
| Seeker phone | `User.phone` + `phoneVerifiedAt`. Email-only accounts have none; the move-to-mobile work is making phone mandatory for them. |
| Consent pattern | `Requirement.contactConsentAt` (timestamp, not a boolean). Mirror it. |
| Reverse direction | Seekers pay (credits) to see the owner's number: [`contact-reveal-credits.md`](contact-reveal-credits.md). This plan is the owner-side equivalent, paid by Featured. |

## The decision that gates everything: consent

A seeker opened a listing to look at it; they did not agree to be phoned by the owner. Disclosing a
phone number to a third party is the part that can go wrong (spam calls, DPDP Act exposure, loss of
seeker trust that hurts the marketplace).

**Decided 2026-10-29: start with notice-only, switch to opt-in later if needed.** The mode is an admin
setting, so changing it is a switch, not a rebuild.

- **One field on the user:** `User.contactShareChoice` (`unset` | `yes` | `no`, default `unset`).
  Whether a seeker's number is shareable is computed when the owner's list is read, not stored per
  interest:
  - **Notice mode (launch):** shared unless the choice is `no`. Every seeker with a verified phone is
    shareable by default, and anyone can opt out.
  - **Opt-in mode (later):** shared only if the choice is `yes`. Flipping the switch hides everyone who
    has not ticked, immediately, with no data migration, because the check is made on every read.
- **Notice (shown in all of these, before the first time a number can be shared):**
  1. Login / sign-up screen: "Owners of Featured ads may call you about ads you show interest in."
  2. The listing page, in the contact area, one line while logged in: "If you show interest, the owner
     may contact you by phone." with a **Manage** link.
  3. Privacy policy ("What we share") and terms, updated in the same release.
- **Opt-out, from day one:** a toggle under Profile settings ("Let owners of Featured ads call me"),
  on web and mobile. Cheap, and it makes notice-only far easier to defend than no way out. Setting it
  to off hides the number on all existing interests at once.
- Only a **verified** phone counts (`phoneVerifiedAt` set). No phone → "Message only".
- Exclude: admin accounts (their number is never shown as a lead), the bulk-import placeholder phone,
  deleted accounts.
- Wording and the policy text should be reviewed by whoever handles legal before launch. Notice-only
  carries more complaint and DPDP risk than a tick; the opt-out and the admin switch are the safety
  valves, and the 30-day window and Featured/credit gating limit who sees what.
- **Switching to opt-in later:** admin flips `consentMode` to `opt_in`; add the one-time tick dialog on
  first logged-in listing view (same slot as the login nudge) that sets `yes`/`no`. Seekers stay
  hidden until they tick. Build the dialog only when you decide to switch.

## Who sees what

**Revised 2026-10-29 (owner's call): Featured sees contacts free; a free-ad owner can pay per lead
with the same credits seekers already buy.** This mirrors the seeker side exactly (free quota, then
credits, spent once per listing and permanent), so it reuses `ContactRevealCreditBatch`, the 402
"buy credits" flow, the Razorpay pack and discount codes. It replaces the earlier "free ad = locked
until you upgrade" idea.

| Owner state | Interested list shows |
|---|---|
| Featured active on **this** ad (or active Agent Pro) | Full number for every consenting lead, free, with **Call** (`tel:`) and **WhatsApp** (`wa.me`) beside Message. |
| Free ad, lead already unlocked with a credit | Full number, permanently (they paid). |
| Free ad, not unlocked | Name, time, Message, masked number (`98••••••10`) and **"Unlock contact — 1 credit"**. First unlock offers the credit pack if the balance is 0 (HTTP 402 → buy credits, same as seekers). |
| Featured lapsed | Credit-unlocked leads stay visible; leads that were only visible through Featured lock again. |

Details:
- **One wallet.** Owners spend the same credits a seeker uses to reveal an ad's contact (an owner is
  usually also a seeker). Same pack size, price, 6-month expiry, earliest-expiry-first drawing, and
  discount codes. No new SKU or payment purpose.
- **Free quota is separate:** `ContactRevealSetting.freeLeadRevealsPerOwner` (admin, default **0**).
  Do not let the seekers' 2 lifetime free reveals be spent on leads, or the other way round.
- **Per lead, per ad, permanent:** unique on (listing, seeker). The same seeker interested in two of
  your ads costs two credits, same as a seeker revealing two owners.
- **Featured nudge:** after an owner has spent credits on leads for the same ad (say the 3rd unlock),
  show "Featured shows every lead's contact free" with the upgrade button. Credits are the
  low-commitment entry; Featured should stay the better deal for an ad with real interest. Price
  check before launch: credit price × typical leads per ad versus the Featured price (both
  admin-configurable), so credits cannot undercut Featured.
- Consent, the 30-day window and the admin/bulk-import exclusions below apply **to paid unlocks too**.
  Paying never overrides a seeker's choice, and a seeker with no consent shows "Message only" rather
  than an unlock button (nothing is charged for a number we cannot show).
- Entitlement is per ad, matching how Featured is sold.

## Backend

1. Migration: `User.contactShareChoice` (enum `unset|yes|no`), `ListingInterest.contactViewedAt`
   (first time an owner opened the number — an audit trail and a conversion metric), a new
   `LeadContactReveal` (`listingId`, `seekerId`, `ownerId`, `method: credit | free`, `createdAt`,
   `@@unique([listingId, seekerId])`, mirroring `ContactReveal`), and
   `ContactRevealSetting.freeLeadRevealsPerOwner Int @default(0)`.
2. `ListingInterestDto` gains `phone: string | null`, `phoneMasked: string | null`,
   `contact: 'available' | 'unlockable' | 'none'`. **The full number is only ever set server-side when
   the caller owns the listing, the seeker is shareable under the current consent mode, the phone is verified, the interest is under
   30 days old, and either the ad is Featured now or a `LeadContactReveal` row exists.** Locked rows
   carry only the mask. Never rely on the client to hide it.
3. `GET /listings/:id/interests` builds the above; one extra owner/boost read, one `user` select with
   `phone, phoneVerifiedAt`, one `LeadContactReveal` read for the page. `POST
   /listings/:id/interests/:userId/reveal-contact` (owner only): no-op for Featured; otherwise spends
   a free lead reveal or one credit inside a transaction and re-derives eligibility there (copy
   `ContactRevealService.revealContact`'s double-spend protection), idempotent on the unique key,
   402 when there is no balance. It also stamps `contactViewedAt`, and the Call/WhatsApp taps do too.
4. Consent endpoints: `PUT /users/me/contact-share { enabled }` (sets/clears the timestamp and flips
   that user's existing interests). Included in the profile DTO so web and mobile can render the toggle.
5. Admin singleton setting (same pattern as `FeaturedUpsellSetting`): `SeekerContactSetting.enabled`
   and `consentMode` (`notice` | `opt_in`), **off by default**, so we can ship dark, turn it on, and kill it instantly. Read failure falls to off.
6. Rate-limit the interests endpoint; log nothing sensitive (no phone in logs).

## Web and mobile

- **Owner, My listings → interested panel** (web `ListingInterestsPanel`, mobile equivalent): Call and
  WhatsApp buttons when available; masked number plus **Unlock contact (1 credit)** when locked,
  with a small "or make it Featured to see them all free" link to the boost purchase for that ad.
  Out of credits → the existing credit-pack purchase dialog (reuse the one on the listing page).
  **Mobile has no native purchase flow** (see the 2026-… note in `contact-reveal-credits.md`; verify it
  is still true): the unlock works with an existing balance, and otherwise points to the web app.
- **Seeker**: the notice lines (login screen, listing page contact area) and an opt-out toggle under
  profile settings, web then mobile. The tick dialog is built only if we switch to opt-in.
- **Copy for Featured**: add "See interested buyers' phone numbers and call them" to the Featured
  benefits list, the Preview comparison, the Featured upsell dialog/card, and the boost offer. This is
  likely the strongest paid benefit we have, so lead with it.
- **Alerts stay as they are.** The WhatsApp/SMS templates are approved Utility text with name only;
  changing them means re-approval. Instead the in-app and push text can say "Open My listings to call
  them" for Featured owners. No number ever goes into WhatsApp, SMS, email or push.

## Tracking

Reuse the page-trail pattern from the Featured prompt (`reportPostAction("upsell", …)` with
`surface: "interest_contact"`): events `lock_shown`, `upgrade_clicked`, `call_tapped`, `whatsapp_tapped`.
Admin page trail gets matching wording. Measure upgrade rate from `lock_shown`, and whether
`contactViewedAt` leads to message/ownership of a reveal on the seeker side. Feeds the Google Ads
"likelihood to pay" signal too.

## Risks and mitigations

- **Spam/harassment of seekers:** consent gate, 30-day window, Featured-only (paid, identifiable
  owner), `contactViewedAt` audit, and a report/revoke path from the seeker profile. Add "stop
  sharing" to the first message an owner sends if complaints appear.
- **Seekers stop logging in:** the consent is optional; viewing never requires it. Watch the consent
  rate and login-to-view rate for two weeks after launch.
- **Free-ad owners annoyed by locked numbers:** locked row always keeps the working Message button.
- **Support burden:** admin listing page should show whether an interest was contact-shared and viewed.

## Phases

1. **Dark launch**: migration, consent endpoint and toggle, DTO fields, admin switch (off), tests.
2. **Owner UI** web then mobile (needs an app release; old apps simply never show the new rows),
   Featured copy updates, tracking.
3. **Turn on**, watch consent rate, upgrade rate and complaints; then decide the free "first lead"
   taste and a "who unlocked your contact" row (a `ContactReveal` by a seeker is the highest-intent
   signal and today's owner alert shows no identity).

## Tests

- DTO never contains `phone` for: a non-owner, a free ad, a lapsed Featured ad, a seeker without
  consent, an unverified phone, an admin seeker, the bulk-import phone, interests over 30 days.
- Revoking consent hides numbers on existing interests immediately.
- Featured purchase unlocks without a deploy; expiry relocks feature-only leads but not credit-unlocked ones.
- Unlock spends exactly one credit, draws the earliest-expiring batch, is idempotent per (listing,
  seeker), two concurrent taps cannot double-spend, and 402 when empty. No charge for a lead with no
  consent, no verified phone, or over 30 days old.
- Admin switch off ⇒ behaves as today (name only).

## SEO

No effect: owner-only, authenticated surfaces. No public page, metadata, sitemap or URL changes.

## Open questions

1. ~~Opt-in tick or notice-only?~~ Decided: notice-only now, opt-in later.
2. Free for Featured on that ad only, or also Agent Pro? (Plan assumes both.)
3. Free lead reveals for a new owner: 0 (recommended) or 1?
4. Should WhatsApp deep-link be offered, or Call only?
5. Same credit price for leads as for seeker reveals (recommended, one wallet), or a separate price?
