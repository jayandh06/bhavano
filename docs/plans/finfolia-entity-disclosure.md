# Disclosing Finfolia Technologies LLP across Bhavano web + mobile

## Why

The STPL template submission was rejected with:

> Entity name is not mentioned in the website

This is the standard DLT verification snag: the telco/STPL reviewer checks that the registered
legal entity name tied to the SMS header is visibly displayed on the website and app, proving the
brand and the entity are the same party. The reviewer opened `bhavano.com`, looked for the entity
operating the site, and found only the brand name "Bhavano".

The three places reviewers actually check — and therefore the priority order for fastest
re-approval — are the **global footer**, the **Terms/Privacy pages**, and a **Contact/About
page**. All three are crawlable without a logged-in session or deep navigation, which is exactly
why they get checked. The same disclosure also satisfies RBI PA/PG merchant-verification, so this
work is not DLT-specific.

## Current state (verified)

| Where | Today | Gap |
|---|---|---|
| `apps/web/src/components/home/Footer.tsx` | `© 2026 Bhavano. All rights reserved.` | No legal entity anywhere on any page |
| `apps/web/src/app/terms/page.tsx` | Refers to "Bhavano (the Platform)" only | No operator clause naming the LLP |
| `apps/web/src/app/privacy/page.tsx` | Refers to "Bhavano" only | No named data fiduciary |
| `apps/web/src/app/contact/page.tsx` | `support@bhavano.com` only | No entity name, registered address, phone |
| — | No `/about` route | Reviewers look here first |
| — | No refund/cancellation policy route | **Likely next rejection** — `/premium` sells paid plans via Razorpay |
| `apps/web/src/app/layout.tsx` | `Organization` JSON-LD, `name: "Bhavano"` | No `legalName` |
| `apps/web/src/app/sitemap.ts` | Only listings + browse paths | `/terms`, `/privacy`, `/contact`, `/help`, `/premium` not listed |
| `apps/mobile/app.config.js` | `com.finfolia.bhavano`, `name: "mobile"` | Entity only in the bundle id, invisible in-app |
| `apps/mobile/app/(tabs)/account.tsx` | No legal section at all | No Terms/Privacy/entity in the app |

`grep -ri finfolia` over the repo hits exactly one thing: the iOS/Android bundle identifier.

## Status

Implemented (steps 1–3, 5–8 below). The entity **name** — the actual rejection reason — is now
live in every required spot. The optional identifiers below are wired through
`packages/types/src/legalEntity.ts` as `undefined` and every consumer renders them
**conditionally**, so nothing ships as a visible `<LLPIN>`-style placeholder. Filling them in is a
one-file edit.

Step 4 (`/refund-policy`, `/pricing`) is **not** implemented — see the note there.

## Facts still needed

These are blockers for the *remaining* copy — they can't be invented:

1. **LLPIN** (e.g. `AAA-1234`)
2. **Registered office address** exactly as on the MCA record
3. **GSTIN**, if registered
4. **Support phone number** — most PA templates require a working contact number, not just email
5. Whether the LLP name should be **visible alongside the brand** in the footer, or confined to the
   legal pages. Recommendation: footer, because that is the first place a reviewer looks.

## Plan

### 1. Single source of truth — `packages/types/src/legalEntity.ts`

Follows the existing per-file `exports` convention in `packages/types/package.json`
(`./legalEntity`), so web and mobile read the same constants and can never drift.

`LEGAL_ENTITY` holds `legalName`, `brand`, `supportEmail` (all set), plus `llpin`, `gstin`,
`supportPhone` and `registeredAddress` (all `undefined` until supplied). Alongside it:

- `ENTITY_TAGLINE` — `"Bhavano is a product of Finfolia Technologies LLP"`
- `entityCopyright(year)` — `"© 2026 Finfolia Technologies LLP. All rights reserved."`
- `entityAddressLines()` — renderable address lines, `[]` when unset
- `entityOperatorSentence()` — the long-form operator sentence for Terms/Privacy/About, which
  appends the LLPIN and registered office **only once they're set**

Every consumer guards on the optional fields, so an unset value renders as a missing line rather
than a visible placeholder. `"./legalEntity"` is added to the `exports` map in
`packages/types/package.json`.

### 2. Footer — the highest-leverage single change

`apps/web/src/components/home/Footer.tsx` renders on **every** page (homepage, city hubs, listing
detail, static pages) via `StaticPageLayout` and the page-level call sites. One edit puts the
entity name on the entire site.

- Brand block: under the `Bhavano` wordmark, `Bhavano is a product of Finfolia Technologies LLP`
  (small, `text-text-soft`).
- Bottom bar: `© 2026 Bhavano. All rights reserved.`
  → `© 2026 Finfolia Technologies LLP. All rights reserved.`
- Add `/about` to the bottom-bar link row and to the Company column.

Server Component, plain text — no `"use client"`, no bundle cost, fully crawlable and visible to
the reviewer's automated scrape.

### 3. New route: `/about`

`apps/web/src/app/about/page.tsx`, built on the existing `StaticPageLayout` + `PageSection` (same
shape as `/contact`). Content:

- **Who we are** — "Bhavano is a real-estate classifieds marketplace owned and operated by Finfolia
  Technologies LLP, a limited liability partnership registered in India (LLPIN: …)."
- **Registered office** — full address block.
- **Contact** — support email + phone.
- `export const metadata` with title/description, matching the sibling static pages.

### 4. New routes: `/refund-policy` and `/pricing` — NOT IMPLEMENTED

Not part of the stated rejection, and out of scope for the entity-disclosure fix — but `/premium`
sells subscriptions and boosts through Razorpay, and payment-aggregator templates check for these.
Worth doing before the *payment* onboarding, not before the DLT resubmission. Both would use
`StaticPageLayout`, naming the LLP as the party issuing refunds. Deliberately left out here
because the refund terms are a business decision, not a copy decision.

### 5. Amend Terms and Privacy to name the operator

- `apps/web/src/app/terms/page.tsx` § 1: after "By accessing or using Bhavano (the "Platform")",
  insert — "The Platform is owned and operated by **Finfolia Technologies LLP**, a limited liability
  partnership incorporated in India (LLPIN: …), with its registered office at … ("we", "us",
  "our")." The existing "we/us" language then has a defined referent, which it currently lacks.
- `apps/web/src/app/privacy/page.tsx`: name Finfolia Technologies LLP as the **data fiduciary** under
  the DPDP Act, with the registered address and grievance-contact email.
- Update the `updated=` date prop on both.

### 6. `Organization` JSON-LD — `apps/web/src/app/layout.tsx`

Machine-readable confirmation, picked up by automated verification scrapes:

```ts
{
  "@type": "Organization",
  name: "Bhavano",
  legalName: LEGAL_ENTITY.legalName,
  url: SITE_URL,
  address: { "@type": "PostalAddress", /* … */ },
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email, telephone },
  description: SITE_DESCRIPTION,
}
```

Preserves the existing block — adds fields, removes none.

### 7. `sitemap.ts` — add the static routes

`/about`, `/contact`, `/help`, `/terms`, `/privacy`, `/premium`, `/tools`. Previously `sitemap.ts`
emitted only listings and browse paths, so none of the legal pages were discoverable from the
sitemap. `robots.ts` already allows them (its `disallow` list covers only the authenticated
routes), so no robots change is needed.

### 8. Mobile app

The PA reviewer may check the store listing too, and the app takes payments on the same account.

- `apps/mobile/app.config.js`: set `name: "Bhavano"` (currently the literal string `"mobile"`, which
  is what shows under the icon on device). Bundle id `com.finfolia.bhavano` already carries the
  entity — leave it.
- New `apps/mobile/src/components/home/LegalFooter.tsx`: a **Legal** section linking out to
  `/about`, `/terms`, `/privacy` and `/contact` on the web (via `Linking.openURL` against
  `EXPO_PUBLIC_SITE_URL`, added to `.env.example`, defaulting to `https://bhavano.com`), plus the
  `ENTITY_TAGLINE` and `entityCopyright()` lines from the shared module.
- `apps/mobile/app/(tabs)/account.tsx`: render `<LegalFooter />` at the bottom of the profile
  ScrollView **and** in the logged-out branch — that branch previously returned an empty `View`,
  so without this the disclosure would be unreachable to a reviewer who never signs up.
- Play Store / App Store console: developer name and the in-listing "Contact" block must read
  Finfolia Technologies LLP. Console setting, not a code change.

## SEO impact (per `.claude/CLAUDE.md`)

- All new pages are **Server Components** — no `"use client"` added anywhere.
- Each new route exports `metadata`; no existing `metadata` export is touched.
- No route renames, no redirects, no slug changes — additive only.
- `Organization` JSON-LD is extended, not replaced.
- `robots.ts` untouched; `sitemap.ts` gains entries only.
- Footer change is static text in an existing Server Component — zero client-bundle delta.

## Verification before resubmitting

Run these **after deploying** — the disclosure has to be live on the public origin, not just in
the repo:

1. `curl -s https://bhavano.com | grep -i "Finfolia"` returns a hit on the bare homepage HTML —
   this is the check most automated reviewers run, and it passes only if the string is
   server-rendered (it is: the footer is a Server Component).
2. Same for `/about`, `/terms`, `/privacy`, `/contact`.
3. The entity name on the site matches the STPL submission **character for character**
   ("Finfolia Technologies LLP" — not "Finfolia Technologies", not "Finfolia Tech LLP").
4. Once the address is filled in, it matches the MCA record.
