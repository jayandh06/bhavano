# Blog outreach list and indexing steps (2026-10-22)

Follows [`blog-backlink-content.md`](blog-backlink-content.md). The posts are live; this is the manual work that
gets them found and cited. Nothing here is automated, and no real contact names are listed (we have none verified).

## Indexing (Search Console)
The sitemap at `https://www.bhavano.com/sitemap.xml` already lists every blog post, so if it is submitted nothing
more is needed. To speed up the 11 new posts:
1. Search Console → URL inspection → paste each URL → **Request indexing** (a small daily quota, so do a few a day).
2. Later, Search Console → Performance → filter by page `/blog/` to see impressions and clicks per post.
3. In admin Page visits, filter Source for `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`
   to see visits that arrived from AI assistants.

New URLs: `what-does-bhk-mean`, `real-estate-terms-explained-india`, `security-deposit-for-rent-in-india`,
`verify-property-owner-before-paying-token`, `freehold-vs-leasehold-property-india`,
`society-maintenance-charges-explained`, `down-payment-for-a-home-loan`, `how-to-check-property-title-is-clear`,
`how-to-calculate-rental-yield`, `stamp-duty-and-registration-charges-explained`,
`capital-gains-tax-on-property-explained` (all under `/blog/`).

## Who to ask, post by post
Ask for a link only where the post genuinely helps that site's readers. Never pay for links or swap them in bulk.

| Post | Who it helps | Where to find them (search these) |
|---|---|---|
| `security-deposit-for-rent-in-india`, `verify-property-owner-before-paying-token` | tenants, students, people relocating | relocation and "moving to <city>" blogs, college alumni and hostel groups, company HR relocation pages, tenant forums |
| `what-does-bhk-mean`, `real-estate-terms-explained-india` | first-time renters and buyers, NRIs | NRI community sites, "first home" blogs, expat guides for Indian cities |
| `down-payment-for-a-home-loan`, `how-to-calculate-rental-yield` | first-time buyers, small investors | personal-finance blogs, money newsletters, investor communities |
| `how-to-check-property-title-is-clear`, `freehold-vs-leasehold-property-india`, `stamp-duty-and-registration-charges-explained` | buyers doing due diligence | property-law explainers, resident welfare associations, consumer-awareness groups |
| `capital-gains-tax-on-property-explained` | sellers, NRIs | tax and CA practice blogs (offer it as a plain-language reference, not as advice) |
| `society-maintenance-charges-explained` | apartment residents | resident association newsletters, society-management software blogs |

Search patterns: `"moving to <city>" guide`, `"first time home buyer" India blog`, `"write for us" real estate India`,
`resource page "home loan" India`, and broken or outdated links on pages that cover the same topic.

## A short pitch to adapt
> Hi <name>, I read your guide on <their page>. We published a plain-language explainer on <topic> that your readers
> may find useful as a reference: <post URL>. It has no ads or sign-up. If it fits, a link would be welcome, and we are
> happy to correct anything you think is unclear.

For the calculators (EMI, down payment, rent vs buy, rent affordability, area converter) the pitch is "a free tool for
your readers", which earns links more easily than a blog post.

## Rules
- The legal and tax posts (`how-to-check-property-title-is-clear`, `freehold-vs-leasehold-property-india`,
  `stamp-duty-and-registration-charges-explained`, `capital-gains-tax-on-property-explained`) should be reviewed by a
  qualified person before you promote them. Add a real "reviewed by" name once one exists.
- Keep a simple log (page, contact, date asked, result) so nobody is asked twice.
- Do not claim Bhavano verifies owners or documents; the posts and the trust page say what we do and do not check.

## Faster discovery, built (2026-10-22)
- **Related guides on every post.** The old "More from the blog" showed the same three newest posts under every post.
  It is now "Related guides": up to four posts, chosen by the post's own link graph (posts it links to, posts that link
  back to it) then same format, then newest (`relatedPosts` in `apps/web/src/lib/blog/posts.ts`, tested). Each post now
  has its own internal links, so crawlers reach the whole set. The homepage already lists the four newest guides and the
  footer links to the blog index, so those were left alone.
- **IndexNow (Bing, Yandex and others; not Google).** The key file is `apps/web/public/<32 hex>.txt` (its content is
  the same key; it is public by design). `scripts/indexnow-ping.mjs` tells those engines which URLs are new or changed:
  `--dry-run` lists them, no argument sends the sitemap's blog URLs, `--all` sends every sitemap URL, or pass URLs. **Run
  it after the deploy that publishes the key file**, because the engines fetch the key from the live site; a 403 means the
  file is not live yet. Run it again after you add or change posts. Bing's index feeds ChatGPT search and Copilot.
- Still manual: Search Console "Request indexing" per URL, and submitting the site in Bing Webmaster Tools.

## Backlink baseline (Semrush, 2026-10-25)
| Domain | Authority Score | Backlinks | Referring domains |
|---|---|---|---|
| bhavano.com | 9 | 132 (67 follow, 65 nofollow) | 115 |
| commonfloor.com | 65 | 118,737 | 5,911 |
| quikr.com | 58 | 2,313,216 | 12,166 |
| nobroker.in | 86 | 399,376 | 11,223 |
| housing.com | 87 | 1,481,492 | 18,597 |
| magicbricks.com | 91 | 1,105,216 | 12,955 |
| 99acres.com | 92 | 2,687,049 | 12,468 |

- The 25 highest-scoring referring domains of bhavano.com are almost all junk: SEO-directory and link-farm sites, spam shops, adult and
  pharmacy pages. The best has an Authority Score of 14. So Bhavano has effectively **no real backlinks yet**; the 115 domains are noise.
- Semrush returned no data for "backlink competitors" of bhavano.com (the profile is too small to match), so a gap analysis needs
  named competitors, not a Semrush suggestion.
- Re-run the overview monthly. A useful target: 30 genuine referring domains (real sites a person would visit) in six months.

## Backlink gap (Semrush, 2026-10-25): sites that link to all of 99acres, housing.com, nobroker.in and magicbricks.com, but not to bhavano.com
Sorted by how many of the four link to them, then Authority Score. Most of the top rows are giants that cannot be "earned"
(apple.com, google.com, yahoo.com, bing.com, wikipedia.org, amazonaws.com, alibaba.com, indeed.com, grokipedia.com): ignore them.
The realistic ones, by type:

| Type | Domains | How to get the link |
|---|---|---|
| App and web-app directories | appbrain.com, webcatalog.io, uptodown.com, aptoide.com | List the Android app and the website. AppBrain reads the Play Store; WebCatalog takes web-app submissions. The APK stores (Uptodown, Aptoide) host app files, so only do it if you are happy with copies outside Play. |
| Company profiles | crunchbase.com, glassdoor.co.in / glassdoor.com, zoominfo.com | Create or claim the company profile and add the website. Glassdoor needs employee reviews to look real. |
| Indian startup and news media | yourstory.com, indiatimes.com, hindustantimes.com, moneycontrol.com, freepressjournal.in, gadgets360.com, opindia.com | Needs a news hook: a launch, a data story ("women's PG supply by city"), a founder article. YourStory takes contributed pieces. Do not buy placements. |
| Indian legal and proptech writing | ipleaders.in, aurumproptech.in | Offer the RERA / khata / title-check / stamp-duty explainers as guest articles, or ask to be listed in proptech roundups. |
| Publishing platforms | medium.com, substack.com, home.blog | Republish a shortened version of a guide with a link and a canonical or "originally published" note. Links are usually nofollow but bring readers. |
| Developer and tools lists | apify.com, accio.com, explodingtopics.com | Low priority. |

Bhavano has zero of these today (`bhavano.com` column is 0 on every row). Start with the profile and directory links (a day's work,
free), then the guest articles, then the news pitch.
