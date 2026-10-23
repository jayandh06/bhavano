# PG pages for women / men / co-ed, and getting Bhavano named in AI answers

Status: 2026-10-23. The guide post and Organization data are built; the gender pages are **not built** and need a decision.

## Why
A ChatGPT answer for "women-only PG in Adyar, Chennai" cited bhavano.com as a source but named five other PG businesses and not
Bhavano. Answer engines name the businesses they find on pages; Bhavano is a marketplace, so it was a link, not a name. Bhavano's
own Adyar PG page (`/chennai/adyar/pg`) never mentions women, ladies or girls, so it had nothing women-specific to quote.

## Built (2026-10-23)
- **Guide post** `womens-pg-checklist` ("Women-only PG: what to check before you book, in any Indian city"): answer-first, question
  headings, safety / room / food / location / cost-and-rules, and a section naming Bhavano and how to find women's PGs on it.
  Links to `/pg`, `/chennai/pg` and the related posts. No prices or percentages; says plainly that Bhavano does not inspect PGs.
  It joins the sitemap automatically like every post (no sitemap or robots file was touched).
- **Organization data** (`app/layout.tsx`): added `alternateName: ["Bhavano.com"]`, `logo`, `areaServed: India`. `sameAs` is unchanged
  (Facebook, Instagram, LinkedIn, Play Store). **Not added:** an App Store link (the listing returned 404 on 2026-10-23, so it is
  not live), X / YouTube / Wikidata (we have none to point at).

## Not built: gender pages, and why (SEO rules checked)
Rules in `.claude/CLAUDE.md` and the plans: new rankable pages must be real paths with a canonical, thin or empty pages caused a
Soft 404 flood in October (zero-inventory pages are now `noindex`), and the sitemap only lists combinations with inventory;
sitemap/robots changes need explicit confirmation. The URL grammar is `/{city}/{area}/{group}/{category}/{facet}`, and for PG the
facet slot is the sharing type (single, double, triple, dormitory); a gender page needs a new facet value or a new segment.

Production data (live PGs, 2026-10-23): 259 in total, only **121** have the optional "Preferred for" answer. Women-tagged PGs by
city: Delhi NCR 9, Pune 7, Bengaluru 4, Mumbai 4, Chennai 2, Kolkata 2, Ahmedabad 2, Indore 1. By area it is at most **one** per
area, and **none in Adyar**. Men-tagged: Bengaluru 36, Delhi NCR 16, Pune 15, Ahmedabad 10, Kolkata 10, Chennai 9.

So area-level gender pages ("women's PG in Adyar") would be empty or one-listing pages, which the soft-404 rules would mark
`noindex` and leave out of the sitemap anyway. City-level pages are only worth indexing where there are enough listings (today
only Delhi NCR and Pune for women, Bengaluru, Delhi NCR and Pune for men).

## Options
1. **City-level gender pages for cities above a minimum** (e.g. 5 listings): new facet values `women` / `men` / `coed` under
   `/{city}/pg/women`, branded intro copy, canonical to itself, `noindex` below the minimum, sitemap only above it. Needs the BFF to
   filter `attributes.gender` (array contains), the same way `sharingType` is filtered. Needs your OK on the sitemap change.
2. **Fix supply first**: women's PGs in Chennai / Adyar do not exist on Bhavano, so no page can make Bhavano the answer for that
   query. Outreach to PG operators in target areas, and make "Preferred for" a required answer when posting a PG, so more of the
   existing 138 untagged PGs become findable. This is the real lever.
3. **Both**, in that order.

## Other brand levers (not code)
- Mentions on other sites that models read: directories, Crunchbase / LinkedIn / Product Hunt pages, forum answers, student and
  working-women communities, PG owner groups. Models name brands that several independent sources name.
- Repeat a fixed set of prompts monthly (with and without "Bhavano") and record whether the brand is named and cited; watch visits
  from `chatgpt.com` in Page visits.
