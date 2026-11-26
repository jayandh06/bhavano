# US legal pages and entity line

Part of [us-market-expansion.md](us-market-expansion.md). Built 2026-11-26.

## Decisions (the owner's)

- **Operator named on the US site: Finfolia Technologies LLP (India).** The same entity as India, so the footer tagline
  ("Bhavano is a product of Finfolia Technologies LLP"), the copyright line and `entityOperatorSentence()` are unchanged
  and `legalEntity.ts` was not touched. The sentence says "registered in India", which is true. No LLPIN, GSTIN or phone
  appear (those fields are unset), and no US address is shown.
- **Terms and Privacy are written as a draft for counsel review**, not final legal text. Both carry a visible "Draft" notice
  (`components/legal/DraftNotice.tsx`) and `[bracketed]` items for counsel. The US site is noindexed, so the drafts are not
  indexed.

## What was built

US versions are separate components under `apps/web/src/components/legal/`; each page picks one when
`buildMarket().id === "us"` and otherwise renders India's text exactly as before.

| Page | US component | What differs from India |
| --- | --- | --- |
| `/terms` | `UsTerms` | No Indian law, OTP/phone sign-in, Razorpay or Apple EULA text; adds a Fair Housing section and "Equal Housing Opportunity"; says the site is free for now; governing law is a placeholder |
| `/privacy` | `UsPrivacy` | CCPA-style rights (know, delete, correct, opt-out; we do not sell or share), 45-day response, US hosting, no DPDP "data fiduciary", Razorpay, MSG91 or Meta; the Google Tag Manager paragraph appears only when the build has `NEXT_PUBLIC_GTM_ID` |
| `/about` | `UsAbout` | No plots/PG/coworking or moving-guide text; no LLPIN/GSTIN lines |
| `/trust` | `UsTrust` | Makes none of India's claims (pre-publish checks, photo matching, admin review) because the US has no moderation; safety tips, Fair Housing, how to report |

`apps/web/src/lib/usLegalPages.test.ts` fails if a US page names India's law, tax or telecom terms, Razorpay/MSG91, OTP or a
listing-check claim, if Terms/Privacy lose their draft marker, or if the entity name goes missing.

## For counsel before launch

1. Governing law, venue, arbitration and class-action terms (Terms section 12), disclaimer and liability-cap wording (7 and 8).
2. Cross-border wording: servers are in the US (AWS us-east-1) but the operator is in India and its team may access data.
3. Retention periods, the 45-day request window, and whether state laws beyond CCPA (for example Virginia, Colorado, Texas) need
   named sections or a different request process.
4. Whether phone numbers collected for posting (US SMS is not built, see us-market-expansion.md) need A2P/TCPA language.
5. A US mailing address for the entity, and whether a US entity should replace Finfolia as operator.
6. Remove `DraftNotice` from Terms and Privacy when approved.
7. Consent to calls and texts. Since 2026-11-26 the "Owners and agents with a matching property may call or message me" box on
   the "find this for me" prompt starts **unticked** in the US (`marketCopy.contactConsentPreTicked`; India stays ticked).
   Confirm the wording is enough for TCPA and state rules, and review the separate seeker-contact sharing setting (Admin ->
   Settings -> Seeker contact), whose "notice" mode shares a number unless the person opts out; it must stay off or be
   opt-in in the US unless counsel says otherwise.

## Not done

- The mobile apps' privacy and terms screens (`apps/mobile/app/privacy.tsx`, `terms.tsx`, `about.tsx`) stay India's; the app has
  no US market switch yet.
- (Done 2026-11-26) The Help page FAQs: US says Google sign-in only (phone verified before posting) and makes no listing-check claims.
- Payment terms: the US has no payments, so Terms section 10 says paid features are not offered yet.
