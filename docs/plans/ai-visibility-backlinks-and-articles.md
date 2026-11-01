# AI visibility: where to get mentioned, and what to write next (2026-11-01)

Follows [`blog-backlink-content.md`](blog-backlink-content.md) and [`blog-outreach-list.md`](blog-outreach-list.md).
**No new Semrush units were spent.** The backlink baseline and the gap list against 99acres, housing.com, nobroker.in and
magicbricks.com from 2026-10-25 (in the outreach doc) already answer "where"; Semrush's backlink reports cannot show what
ChatGPT or Perplexity cite, so another call would only repeat known data. If one call is wanted later, the cheapest useful
one is `backlinks_overview` for bhavano.com (the 8 Nov check: has referring-domain quality moved off 115 noisy domains).

## How AI assistants choose what to cite
They quote pages that (a) answer the question in the first lines, (b) are mentioned on sites the model already trusts, and
(c) describe the brand the same way everywhere. Reddit, Quora, Medium, LinkedIn, YouTube, review sites and news dominate
citations for consumer questions; a site's own blog alone rarely gets cited without off-site mentions. Bhavano has 36
answer-first posts already, so the gap is off-site presence and a few angles no post covers.

## Where to get mentioned (ranked by effort against payoff)
1. **Own the entity (a day, free).** Same one-line description everywhere: "Bhavano: owner-direct property listings in India".
   Crunchbase, LinkedIn company page, Google Business Profile, Play Store and App Store listings, AlternativeTo, Product
   Hunt, Tracxn, Wellfound. Add the profile URLs as `sameAs` in the Organization JSON-LD on the site (cheap on-site change).
2. **Bing Webmaster Tools.** Bing's index feeds ChatGPT search and Copilot. Submit the site (IndexNow is already built).
3. **Reddit and Quora answers (ongoing, no links bought).** r/bangalore, r/hyderabad, r/chennai, r/pune, r/mumbai,
   r/IndiaInvestments, r/indianrealestate-style threads on "rent without broker", "is this owner genuine", "security
   deposit refund". Answer fully first, cite the matching guide once, disclose the Bhavano affiliation. This is the single
   biggest source of AI citations for these questions.
4. **Medium, Substack and LinkedIn articles.** Republish shortened versions of the legal and checklist guides with "originally
   published at" and a link. Links are mostly nofollow but these domains are heavily used by AI crawlers.
5. **YouTube.** A two-minute screen-recorded "how to check an owner before paying a token" with the guide in the description;
   transcripts get read by assistants.
6. **Guest articles and news pitch.** ipleaders.in and aurumproptech.in for the RERA, khata and title explainers; YourStory or
   Inc42 for the owner-direct data story below. Needs a real contributor name and review (see the authorship rules).
7. **Society, college and relocation communities.** Resident association newsletters, alumni groups, company relocation pages:
   offer the viewing checklist and deposit guide.

## Articles to write (none of these slugs exist yet)
Same blog rules: answer in the first two lines, question headings, no prices or percentages, no invented author, legal and tax
pieces hedged and flagged for review.

| Priority | Working title | Question it answers | Why it earns citations |
|---|---|---|---|
| 1 | Owner-listed property in India: what Bhavano's listings show (counts by city and category only) | How much property is listed directly by owners? | Original data is what gets cited; use counts, never prices |
| 2 | How to rent a house without a broker in India | Can I rent without paying brokerage? | Very common assistant question; links to `/post` and rental listings |
| 3 | Owner-direct vs broker listings: how the portals differ | What are alternatives to NoBroker, 99acres, Housing? | "Alternatives" queries; stick to verifiable facts, no disparagement |
| 4 | Police verification and tenant documents for landlords | What documents do I need from a tenant? | Complements `how-to-find-reliable-tenants` |
| 5 | Rent agreement types: 11-month agreement, leave and license, lease | Which rental agreement should I sign? | Extends `rental-agreement-questions`; legal, hedged |
| 6 | PG vs co-living vs renting a flat | Which is better for a student or a new job? | Links to `/pg`; no price comparisons |
| 7 | Moving to Bengaluru, Hyderabad, Chennai, Pune: how to choose an area (commute and amenities, not prices) | Where should I live in <city>? | City-specific answers are what people ask assistants; one post per city |
| 8 | Property registration process step by step, plus mutation and khata transfer | What happens after I pay for a property? | Fills the gap after `stamp-duty-and-registration-charges-explained`; legal, hedged |
| 9 | Buying property as an NRI: documents, power of attorney and repatriation basics | Can an NRI buy property in India? | Legal and tax; reviewer required |
| 10 | TDS on rent and on property purchase, in plain words | Do I deduct tax when paying rent? | Tax; reviewer required, no rates |

Start with 1 and 2 (data and the most-asked question), then city posts (7) one at a time so each can be checked.

## Tracking (units-free)
- Admin Page visits, Source filter: `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`.
- Ask the assistants the ten questions above monthly and note whether bhavano.com appears; keep the log with the outreach log.
- Add each new post to `apps/web/public/llms.txt` when it ships.

## Written 2026-11-01
Twelve posts in `packages/types/src/answerGuides.ts` (appended to `POSTS`; slugs added to `KNOWN_ROUTES` in
`posts.test.ts`; listed in `apps/web/public/llms.txt`): list items 2 to 10, with item 7 as four posts (Bengaluru,
Hyderabad, Chennai, Pune). Slugs: `rent-a-house-without-a-broker-india`, `owner-direct-vs-broker-listings`,
`police-verification-and-tenant-documents-for-landlords`, `rent-agreement-types-india`,
`pg-vs-co-living-vs-renting-a-flat`, `property-registration-process-india`, `buying-property-in-india-as-an-nri`,
`tds-on-rent-and-property-purchase-india`, `how-to-choose-an-area-to-live-in-{bengaluru,hyderabad,chennai,pune}`.

- **Not written: item 1 (owner-listed property data).** It needs real counts from the database; inventing them breaks the
  blog's rule. Pull counts by city and category (no prices) and write it from those.
- **Review before promoting:** `rent-agreement-types-india`, `police-verification-and-tenant-documents-for-landlords`,
  `property-registration-process-india`, `buying-property-in-india-as-an-nri`, `tds-on-rent-and-property-purchase-india`
  are legal or tax topics written from general knowledge, hedged, with no rates or thresholds. The area guides name
  well-known neighbourhoods by commute and housing type only; check the area lists against what you know of each city.
- `owner-direct-vs-broker-listings` names no competitor portals on purpose (nothing here can be verified about them).
