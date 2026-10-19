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
