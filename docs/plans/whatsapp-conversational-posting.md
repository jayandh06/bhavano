# Post an ad by chatting on WhatsApp (user starts the chat, we ask, they answer)

Status: proposal (2026-10-26), nothing built. Builds on [`post-ad-via-whatsapp.md`](post-ad-via-whatsapp.md) (the doorway and one-tap login; **that plan's Phase 0
and Phase 1 are the foundation here and are still not built: there is no inbound WhatsApp code yet**), and reads
[`whatsapp-otp-primary-sms-fallback.md`](whatsapp-otp-primary-sms-fallback.md), [`post-details-step-experience.md`](post-details-step-experience.md),
[`mandatory-pin-and-owner-location-edit.md`](mandatory-pin-and-owner-location-edit.md) and [`listing-platform-fee-and-checkout-gate.md`](listing-platform-fee-and-checkout-gate.md).

## The idea
A visitor taps "Post on WhatsApp" on the website (or a Google ad). WhatsApp opens with a prefilled message; they send it. **Because they started the chat, everything
we send back for the next 24 hours is a free-form "service" message, which Meta does not charge for.** We then ask the questions the website form asks, one at a
time, they answer, and the ad is created. No OTP (WhatsApp already proves the number), no unfamiliar form.

## What it would save (last 30 days, production)
- WhatsApp **template** messages we paid to send: welcome 510, claim verification 435, "ad posted" 292, pending-checkout reminder 51, boost promo 19 (about 1,300).
  Inside a chat the seller started, the "ad posted" confirmation, the Featured offer and the payment reminder are all free-form messages.
- Logins: 640 by OTP in 30 days; a WhatsApp-initiated chat needs no OTP at all.
- Rates change, and MSG91 may add its own per-message fee on top of Meta's. **Check the current Meta India rate card and the MSG91 plan before relying on the saving**
  (Phase 0 below). Sending through Meta's Cloud API directly (`WhatsappProvider`, already configured) avoids a reseller's mark-up.
- The bigger prize is conversion, not the rupees: the OTP step and the unfamiliar site are where phone-first sellers drop off.

## Why this reverses an earlier "no"
`post-ad-via-whatsapp.md` rejected a question-by-question bot because it was fragile with typed answers, needed a state machine, would duplicate the form's rules, and
could not take payment. Cost was never the reason, so the free window alone does not change that. It is worth revisiting because the design below removes the main objections:
1. **No second copy of the rules.** The question engine is driven by `CATEGORY_FIELD_CONFIG` and `postDetailsIssues` (shared in `packages/types`), the same list the web
   and app wizards use. "What is still missing" is the next question. A new required field is asked automatically; a unit test walks every category and transaction
   to prove the chat can complete each one.
2. **Not free text where it can be avoided.** WhatsApp reply buttons (up to 3 options) and list messages (up to 10) cover the select fields; numbers are typed and
   validated with the same limits; **location is WhatsApp's native "share location" pin** (the website now requires a pin anyway).
3. **One escape hatch.** At any point "Continue on the website" sends a one-tap link that opens `/post` with what was answered so far. Payment and the Featured
   purchase always happen on the website.

## The conversation (apartment for rent, about 14 messages from the seller)
1. Seller sends the prefilled "Post my ad" (the link carries a short code tying the chat to the web visit for attribution).
2. We reply: "What are you posting?" (list: Rent / Sell / PG / Plot / Commercial ...). Same intent-first choice as the website.
3. "Share the property location" (native location request) → pin → city and area from the existing reverse geocode (same rules as the web: pin required, near the city).
4. One question per required field, in the form's order: bedrooms, bathrooms, floor, total floors, carpet area, furnishing, facing ... Buttons or list when the field has few
   options; typed number otherwise. A wrong answer ("abc" for floor) gets the same message the website gives and the question again; three misses in a row offers
   "Continue on the website".
5. Price (typed; "25000", "25k" and "1.2 cr" understood; checked with the existing price-range check).
6. Photos: "Send at least 3 photos"; each photo is acknowledged; a "Done" button once the minimum is reached.
7. Owner or broker (buttons).
8. We draft the title and description with the existing AI copy service and show them: "Looks good" / "Change the title" / "Change the description".
9. Created through the same listing service as the website (same validation, slot caps, moderation, hold-ad-live setting, platform-fee gate). Free ad: "Your ad is live"
   with a **View ad** button. Fee-gated ad: a **Pay and publish** button to the website checkout.
10. Still inside the free window: the Featured offer ("Get more views, ₹X for 7 days") as a link button, using the existing Boost message wording.

Optional fields are not asked ("Add more details on the website" link in the last message), so the chat stays short: 11 required fields for an apartment or house,
7 commercial, 5 plot, 1 for PG, coworking, storage.

## What has to be built
**Phase 0, no code (from the earlier plan, still open).** Which number receives messages (Meta Cloud API number vs the MSG91 one); subscribe our Meta app to the WABA and set
the webhook; `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; confirm free-window and tier pricing for India; confirm interactive and location messages work on the
number we use.

**Phase 1, doorway and login (from the earlier plan, unchanged).** Signed webhook with dedupe (`WhatsappInboundMessage`), one-time login link (`WhatsappLoginToken`),
`loginWithWhatsappLink`, `/wa/<token>`. Gives a working WhatsApp entry on its own and the handoff the chat needs.

**Phase 2, the conversation.**
- `WhatsappPostSession` (phone, step, category and transaction, answers JSON, photo list, `lastInboundAt`, expiry 7 days). One open session per phone.
- `WhatsappPostFlowService`: next step = first of `postDetailsIssues(...)`; renders a question from the `FieldDef` (buttons, list or typed number); parses and validates
  the answer with the shared helpers; saves; asks the next. Answers like "back", "skip", "restart", "website", "stop" are handled in one place.
- `WhatsappProvider`: add reply-button, list, location-request and CTA-url message senders (free-form, only valid inside the window, best-effort, masked phones, same
  `logThirdPartyCall` pattern as `sendTemplate`).
- Media: download each photo from the Cloud API (the media URL expires in minutes), store it like a website upload (resize variants, duplicate-photo hash).
- Creation: the same `ListingsService.create` path, with a new source (`whatsapp`) so Page visits, admin and the funnel can tell them apart.
- Server-side draft for "Continue on the website" (an unpublished draft the wizard can load from the link token). This is also what `post-ad-via-whatsapp.md`
  Phase 2 needed, so it is built once.
- Admin: a Settings switch to turn the chat flow off, a log of sessions (started, step reached, published) beside the funnel, and the inbound messages for support.

**Phase 3.** Hindi and regional-language prompts (language chosen from where the traffic comes from), voice-note answers if there is demand, "post another".

## Limits and risks
- **The 24-hour window.** After 24 hours with no message from the seller we cannot send free-form text. A seller who stops half-way gets nothing more from us unless we
  pay for one reminder template (decide: one utility template at ~20 hours, or none). Their draft is kept 7 days and their next message reopens the window.
- **Interactive message limits:** 3 reply buttons, 10 list rows, 20-character button titles. A field with more options is asked in two steps or by typing.
- **Photos by chat** arrive as separate messages in any order; the session counts them and confirms each.
- **Abuse:** the sender is phone-verified by WhatsApp; the existing listing slot caps, rate limits, moderation and bulk-owner rules still apply. Add a per-phone cap on new
  sessions a day and on messages a minute.
- **Policy:** a task-specific posting assistant is allowed (general-purpose AI chatbots are not). Keep opt-out (STOP), no promotional messages outside the window.
- **Quality:** chat answers can be sloppier than a form. The same moderation and price checks apply; measure published ads that are later flagged or edited.
- **Two surfaces to keep consistent.** The engine reuses the shared config, but wording for each field type still needs review when a new field type is added.

## Effort and order
Phase 0 (a day of checks and Meta setup) → Phase 1 (a few days) → Phase 2 (about 2 to 3 weeks: engine and tests 1 week, provider and media 3 to 4 days, draft handoff and
admin 3 to 4 days) → pilot behind the admin switch on one Google ad variant and the `/post` button for logged-out visitors only.

## How we will know
Share of chats that reach a published ad, compared with visitors who open `/post` without an account (the same measure the Phase 1 plan uses); drop-off by step (the
session log gives it); template messages sent per posted ad before and after; flagged or edited-within-a-day rate for WhatsApp-posted ads against web-posted ones.

## Decisions needed
1. Which number and which sender: Meta Cloud API directly (no reseller fee) or MSG91's? (Phase 0.)
2. A paid reminder template at ~20 hours for half-finished chats, or none?
3. Start with Phase 1 only (the doorway) and add the conversation after seeing usage, or build the conversation straight away?
4. Languages: English only to start, or add Hindi at launch?
