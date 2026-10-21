# Blog content for backlinks

Articles alone do not earn backlinks; other sites link to something useful they can cite. This
adds five evergreen, link-worthy posts and a short outreach plan.

## Posts added (2026-10-18), in `packages/types/src/blogPosts.ts`
- `carpet-built-up-super-built-up-area`: explainer people cite when answering "which area is this".
- `rent-or-buy-questions`: links to the rent vs buy and affordability calculators.
- `home-loan-emi-explained`: links to the EMI, down payment and eligibility calculators.
- `flat-viewing-checklist`: a checklist, the most shared format.
- `write-a-property-listing-that-gets-enquiries`: for owners and agents, links to `/post`.

They follow the file's rules: no invented author, no prices or percentages, no legal or financial
advice. The calculators are the real linkable assets; posts point to them.

## Outreach (manual, not done)
- Offer the checklists and explainers to relocation, student, expat and HR blogs and forums that
  already write about moving or renting in Indian cities.
- Ask local communities (college groups, company relocation pages) to link the relevant checklist.
- Use the calculators as the pitch: "a free tool for your readers", not "link to our blog".
- Do not buy links or swap them in bulk; that risks a Google penalty.

## Second batch (2026-10-19): keyword-matched posts
Eight evergreen posts aimed at what people search in Bhavano's categories, each linking to the
matching listings page and to the relevant calculator or earlier post. Same rules as before: no
prices or statistics, no invented author, legal and financial notes where they matter.

| Post | Search intent | Links to |
|---|---|---|
| `buying-a-plot-checklist` | plots for sale, buying land | `/plot`, area converter, `/trust` |
| `real-estate-investment-basics` | property investment for beginners | `/buy/apartment`, rent vs buy and EMI tools |
| `ready-to-move-vs-under-construction` | ready to move vs under construction flats | `/buy/apartment` |
| `how-to-sell-your-house-or-flat-online` | sell house or flat online | `/post`, `/buy/house` |
| `how-to-find-reliable-tenants` | rent out house, find tenants | `/post`, `/rent-lease/house`, `/rent-lease/apartment` |
| `commercial-space-for-rent-what-to-check` | shop, office, warehouse for rent | `/rent-lease/commercial`, `/buy/commercial`, `/coworking` |
| `villa-or-apartment-which-to-choose` | villa vs apartment | `/buy/villa`, `/buy/apartment`, `/rent-lease/villa` |
| `storage-space-for-rent` | storage space for rent | `/storage`, `/moving-to-a-new-city` |

Category routes checked live before linking: `/plot`, `/pg`, `/coworking` and `/storage` are the
national roots (`/buy/plot` and similar redirect to them); `/buy` and `/rent-lease` work for
apartment, house, villa and commercial. The sitemap picks up new posts automatically. The mobile
app bundles the same posts, so they reach the app with the next release.

## Third batch (2026-10-19): approvals and documents
Six explainers on what each approval or document is, why a property that has it is more credible,
and what it does not prove. Written to the blog's rules (no figures, no legal advice, no invented
author) and each opens with a "general information, not legal advice; rules differ by state" note.

| Post | Covers |
|---|---|
| `property-approvals-documents-checklist` | the hub: title papers, land use, layout approval, building approvals, RERA; links to the rest |
| `rera-explained-for-home-buyers` | what the Act requires of builders, how to check a registration number, its limits |
| `dtcp-approved-plots-explained` | the state planning department's layout approval, why approved layouts are safer, how to check |
| `bda-approved-sites-bengaluru` | Bengaluru Development Authority layouts, how they differ from building-plan approval |
| `occupancy-certificate-and-completion-certificate` | commencement, completion and occupancy certificates, partial certificates, what to ask for |
| `a-khata-b-khata-bengaluru` | the khata record, A versus B, and what a khata does not prove |
| `construction-stage-to-buy-from-builder` | pre-launch to ready-to-move: what each stage offers and risks, apartment versus villa, who suits which stage, and the checks that apply at every stage |

**These are regulatory topics and must be reviewed by a qualified person before publishing.**
They were written from general knowledge, deliberately hedged, and the points most worth checking
are: which states DTCP approves layouts in, how Bengaluru's civic and planning bodies are named now,
what A and B khata mean in current practice and whether conversion schemes are open, and how
completion and occupancy certificates are combined in each state. Add a real reviewer's name as a
"reviewed by" line once one exists (see the authorship rules at the top of `blogPosts.ts`).

## Fourth batch (2026-10-20): "how to sell property online" pillar post
`how-to-sell-property-online-in-india` is a pillar guide for owners selling any property type
(flat, house, villa, plot, commercial). It walks the whole path (documents, pricing, listing,
posting, reach, safe visits, closing) and says where Bhavano helps at each step. It deliberately
claims only things the product does: browse-by-area search, map pin, WhatsApp sharing and the ad
poster with QR code, direct messaging, optional Featured (badge, higher placement, interest alerts,
daily recap), and an explicit "what Bhavano does not verify" section pointing to `/trust`. It does
not say "free" (ad copy was softened away from that) and gives no prices or percentages.
It overlaps with the shorter `how-to-sell-your-house-or-flat-online`; the two link to each other
and the new one is the one to promote.

**Internal backlinks added** (pass link equity and send readers to the guide):
`write-a-property-listing-that-gets-enquiries`, `how-to-sell-your-house-or-flat-online`,
`buying-a-plot-checklist` and `property-approvals-documents-checklist` now link to it. The pillar
links out to the listing, area, scam, plot, approvals, calculator, `/post`, `/trust` and moving pages.
New linked slugs were added to `KNOWN_ROUTES` in `apps/web/src/lib/blog/posts.test.ts`.

**External backlinks (manual, not done):**
- Pitch it to housing-society, RWA and resident-community newsletters and forums as a seller's
  checklist; the closing checklist is the quotable part.
- Offer it to personal-finance and NRI-property blogs (NRIs often sell remotely), alongside the EMI
  and eligibility calculators.
- Answer "how to sell a flat without a broker" questions on Quora and Reddit with a helpful answer
  that cites the guide, disclosing the Bhavano affiliation. No link swaps or purchased links.
- Share on Bhavano's own Facebook page and WhatsApp channels with the tracked link.

**Needs review before relying on it:** step 7 (agreement, registration, stamp duty, tax) is
generic and hedged; have a qualified person check it. Rebuild `packages/types` (done) so the mobile
bundle's committed `dist` carries the post; it reaches the app with the next release.

## Fifth batch (2026-10-21): answer-first posts for AI assistants and answer engines
Six posts written for the questions people put to ChatGPT, Perplexity, Google AI Overviews and similar tools. Each
opens with a one- or two-sentence direct answer, then uses question-style headings with a short answer under each,
lists and ordered steps (easy to quote), and links to the matching Bhavano listings, tools and earlier posts. They
follow the blog's rules: no prices, rents or percentages, no invented author, and a "general information, not legal
advice" note on the legal ones. The topics are not covered by the earlier 24 posts.

| Post | Question it answers | Links to |
|---|---|---|
| `what-does-bhk-mean` | What does 1 BHK, 2 BHK, 3 BHK, RK and studio mean? | area explainer, converter, apartments for rent and sale |
| `real-estate-terms-explained-india` | glossary: furnishing, token amount, lock-in, possession, sale deed, khata, RERA | hub linking the other new posts and the approvals posts |
| `security-deposit-for-rent-in-india` | How does a rental security deposit work and how do I get it back? | rental agreement, viewing checklist, affordability calculator |
| `verify-property-owner-before-paying-token` | How do I verify an owner before paying a token amount? | bad-ad guide, `/trust`, documents checklist |
| `freehold-vs-leasehold-property-india` | What is the difference between freehold and leasehold? | documents and plot checklists, listings |
| `society-maintenance-charges-explained` | What do maintenance charges, sinking fund and corpus fund cover? | calculators, viewing checklist, listings |

- **Review before relying on them.** `freehold-vs-leasehold-property-india`, `security-deposit-for-rent-in-india` and
  `verify-property-owner-before-paying-token` touch legal ground. They were written from general knowledge and
  hedged; have a qualified person read them and add a real "reviewed by" name when one exists.
- **Already in place:** every post gets `BlogPosting` and `BreadcrumbList` JSON-LD and is in the sitemap
  automatically; `robots.ts` does not block AI crawlers. The mobile app bundles the same posts (next release).
- **Not done:** an `llms.txt` file (optional, and `robots`/sitemap-adjacent changes need confirmation), and
  `FAQPage` markup on these posts (the blog renderer has no FAQ block; question headings carry the structure).
- **How to tell if it worked:** in Page visits, filter Source for `chatgpt.com`, `perplexity.ai`, `gemini.google.com`
  and `copilot.microsoft.com`; in Search Console, look at impressions on the six new URLs after a few weeks.
