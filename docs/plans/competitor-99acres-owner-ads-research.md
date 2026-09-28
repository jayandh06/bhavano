# How 99acres runs owner acquisition ads (research, 2026-09-28)

## Status: research only; nothing applied

This asks how 99acres designs the Google Ads that bring in **property owners** (supply), which
is the job our campaigns do. Related:
[`google-ads-performance-analysis-2026-09.md`](google-ads-performance-analysis-2026-09.md), in
particular the ad landing card and recommendation 6, the `/post` landing test.

## What could and could not be verified

- **Verified (primary sources):**
  - their owner landing pages, fetched directly: `99acres.com/postproperty`, `/sell-property`
    and `/post-property-for-rent`;
  - their FAQ, which says owners get up to two free listings.
- **Not verified:**
  - their actual ad copy, keywords, bids or budgets;
  - Google's Ads Transparency Center (adstransparency.google.com, advertiser "Info Edge (India)
    Ltd") would show the live ad copy, but it can't be fetched by script and has to be checked
    in a browser.
- **Secondary and weaker:**
  - job profiles of their performance-marketing staff describe Google Search, Display, Meta and
    Taboola campaigns measured on cost per lead and lead quality;
  - a Taboola case study reports that 55% of the leads from that channel came from
    retargeting.

## What they do

1. **Each intent gets its own landing page.** They have a generic page and separate Sell and
   Rent/Lease pages, and the page titles repeat the search words: "Post Free Property Ads | Sell
   or Rent Property Online", "Sell Property Online – Sell House, Flat, Plot/land", "Post
   Property for Rent – Advertise House, Flat for Rent / Lease". An owner who searches never
   sees the buyer home page.
2. **The form starts above the fold.** The first block says "Start posting your property, it's
   free", with Sell / Rent-Lease already selected, and the first form step is right there.
3. **The page answers an owner's doubts, in order:**
   - four benefit ticks: "Advertise for FREE", "Get unlimited enquiries", "shortlisted buyers
     and tenants*", "help coordinating site visits*". The starred items are paid add-ons,
     disclosed in a footnote;
   - "Post your property in 3 simple steps": details, then photos and videos, then price and
     ownership;
   - proof: listing counts per city and property type ("32K+ Flats"), with real example
     listings;
   - testimonials from named owners and agents in named cities;
   - an FAQ covering "Is it free?", "Can I sell without a broker?", "Will I get genuine buyers
     on a free listing?" and "How do I sell faster?". That last answer is an upsell to premium
     listings and a relationship manager.
4. **They offer other ways to post.** "Drop a 'Hi' on WhatsApp to post for free", plus a
   toll-free number. That is the same idea as
   [`post-ad-via-whatsapp.md`](post-ad-via-whatsapp.md).
5. **The listing is free and the service is paid.** The free listing is the hook. Money comes
   from premium placement and "Owner Assist" plans. This matches our boost model.
6. **Buyers mostly come organically.** About 46M indexed locality and listing pages bring in a
   large share of traffic (pSEO case study), so paid spend goes mainly to owners and to builder
   leads.

## Is posting really free, or is it an upsell? (checked 2026-09-28)

Both. The listing is free, and it feeds a phone sales funnel.

- **Free:** the FAQ says owners get up to two free listings, with "unlimited enquiries (with no
  cap) even on a free property ad".
- **Paid tiers:**
  - "Premium Plan" from ₹899: a larger card in search results and animation (their
    `/do/buyourservices` page);
  - "Assist / Assist Plus / Platinum" at about ₹6k–23k for 3–6 months: a relationship manager,
    a video listing and social or Google promotion. ₹23,000 comes from their own offer PDF; the
    other figures come from owner complaints, which cite ₹14.5k–22k.
- **How it's sold:** owners consistently report the same pattern (Trustpilot,
  consumercomplaints.in, a consumer-court filing, Reddit, LinkedIn posts):
  - sales calls within minutes of posting;
  - "N buyers are looking in your area" pitches;
  - relationship managers going quiet after payment;
  - no refunds.

  One Reddit comment alleges staff pose as buyers to set up the pitch. That is a single claim
  and unverified.
- **For Bhavano:** self-serve upsells at a visible price (boost) with no calls is a real
  difference. "No sales calls" could be a line on the ad card and in the ad copy, but only if
  it is kept as policy. The card's "Free to post" line is already tied to the live platform
  fee, so it cannot be contradicted at checkout.

## How this compares with Bhavano today

| | 99acres | Bhavano (2026-09-28) |
|---|---|---|
| Where an owner ad lands | Dedicated sell or rent page | Home page plus the ad landing card |
| First thing on screen | The posting form | Card headline, then a button into `/post` |
| Proof | Listing counts and testimonials | None |
| Answers to doubts | FAQ on the page | None |
| WhatsApp posting | Yes | Planned (`post-ad-via-whatsapp.md`) |
| Free-listing limit | 2 per owner | Slot caps (`listingSlots`) |

## What this suggests (for decision; not applied)

- **Our card is a lighter version of their page.** Measure it first: the did-nothing share and
  mobile visit → sign-up, from 2026-09-28 to about 2026-10-12.
- **If the card doesn't help enough, test dedicated pages.** Keeping the home page as the final
  URL was a deliberate decision. 99acres, and standard practice, point the other way. The test
  would be `/sell-property`-style pages, one per intent, as a Google Ads experiment against the
  home page. That is recommendation 6 with a proper page rather than a bare `/post`. New routes
  need the SEO and URL rules applied (canonical, sitemap and robots decisions need
  confirmation).
- **Cheap additions to the card or form, borrowed from them:**
  - a "3 simple steps" line;
  - a real listing count ("1,200+ owners have posted", only if true);
  - one or two FAQ answers, "Is it really free?" and "Do I need a broker?".
- **The WhatsApp entry point is validated** by India's largest portal offering the same thing.
