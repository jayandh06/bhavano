# Growing Bhavano's reach beyond Google Ads (2026-09-28)

## Status: plan only; nothing built

Question: "How to increase the presence of Bhavano outside of Google Ads to reach many people?"
Related: [`google-ads-performance-analysis-2026-09.md`](google-ads-performance-analysis-2026-09.md),
[`competitor-99acres-owner-ads-research.md`](competitor-99acres-owner-ads-research.md),
[`post-ad-via-whatsapp.md`](post-ad-via-whatsapp.md),
[`requirement-leads-for-brokers.md`](requirement-leads-for-brokers.md),
[`seo-locality-landing-content.md`](seo-locality-landing-content.md),
[`outreach-direct-listing-creation.md`](outreach-direct-listing-creation.md),
[`pg-coworking-google-places-leadgen.md`](pg-coworking-google-places-leadgen.md).

## Where we are (production, last 30 days, JS-confirmed non-bot web sessions)

| Source | Sessions | With a logged-in user | Sign-ups (`User.acquisition*`) |
|---|---|---|---|
| Google Ads | 1,165 | 230 | 342 (plus 14 via `syndicatedsearch.goog`, which is Google's search-partner network, so also paid) |
| "Direct" | 4,591 | 67 | 17 |
| Organic search (Google, Bing) | 99 | 14 | about 25 |
| Facebook / Instagram | 55 | 0 | 0 |
| Everything else | about 20 | 4 | 3 (1 from chatgpt.com) |

- **Paid search brings about 85–90% of sign-ups.** Organic search is about 100 sessions a month.
  For comparison, 99acres gets roughly a quarter of its traffic from SEO.
- **"Direct" is large but mostly unexplained.** WhatsApp and most in-app browsers send no
  referrer, and `ShareButton` adds no UTM tags, so a WhatsApp share of a listing lands here.
  We cannot currently tell whether sharing works at all.
- **Inventory is thin:** 471 live listings across 54 cities, about 9 per city. Every free
  channel depends on visitors finding enough to look at (SEO pages, word of mouth, a shared
  city link), and 9 listings per city is too few for any of them to take off.
- **The app barely reaches anyone:** 5 users have a push token.

## Principles

1. **Depth before breadth.** Concentrate supply in the 4–5 cities where ads already convert
   (Bengaluru, Chennai, Hyderabad, Pune, Delhi NCR) until each has a few hundred live listings.
   `serve-only-ad-targeted-cities.md` already moves in that direction.
2. **Use owners as the distribution.** Every owner wants their own ad seen, so they will share it
   if we make that one tap. Each share puts Bhavano in front of seekers for free.
3. **Measure before scaling.** Tag every link we control with UTM parameters, so each channel
   shows up in `Visit.source`.

## Channels, in order of expected return per effort

### 1. Owner sharing, made measurable (built 2026-09-28, web; mobile ships with the next app build)
- **Tagging:** `apps/web/src/lib/shareLinks.ts` tags every shared link with:
  - `utm_source`: `whatsapp`, `copy`, `email`, `share_sheet`, or `app_share` on mobile;
  - `utm_medium=share`;
  - `utm_campaign`: `owner_share` when the viewer owns the listing (`isOwner`), otherwise
    `listing_share`.

  Middleware records these on `Visit.source/medium/campaign` and in the first-touch acquisition
  cookie, so sign-ups from shares show up in `User.acquisitionSource`.
- **Where owners can share:** `OwnerWhatsAppShare` opens WhatsApp with the message already
  written (title, price, area and city, and the tagged link).
  - It appears as a prominent block on the "Your ad is live!" step, below the boost offer so it
    doesn't compete with it.
  - It appears as a compact button on each active listing in `/my-listings`.
  - GTM event: `owner_share_whatsapp {listingId, placement}`. `share_listing` now also carries
    `owner`.
- **Mobile:** `sharedWebUrl()` in `apps/mobile/src/lib/appWebUrl.ts` tags app shares
  (`utm_source=app_share`). The post-success screen has the same "Get enquiries sooner" card
  (`apps/mobile/src/components/home/OwnerWhatsAppShare.tsx`), which opens `wa.me` with the message
  pre-written; a tap records the synthetic page view `/post/success/share-whatsapp`. Both ship with
  the next app build.
- **"Your ad is live" email:** a second button, "Share on WhatsApp", opens `wa.me` with the same
  pre-written message and an `owner_share` link (`NotificationsService.notifyListingPosted`; label
  in `notification-templates/email/listing-posted/secondaryButtonLabel.txt`).
- **Not done yet:**
  - a share button in the "your ad is live" WhatsApp message: the MSG91 template is Meta-approved
    wording, so it needs a new template submitted and approved;
  - measurement of shares per listing, visits from shares and enquiries from shares. For
    visits, query `Visit` where `medium = 'share'`, grouped by `campaign`/`source`.

### 2. WhatsApp as a channel, not just a login (medium)
- Posting through WhatsApp (`post-ad-via-whatsapp.md`), the same thing 99acres offers.
- One WhatsApp Channel per focus city ("Bhavano Bengaluru – new rentals"), with new listings
  posted daily and linked with UTM tags. This can be automated from new approved listings.
  Channels are free to create and followers opt in.
- Saved-search and requirement alerts already exist. Letting people get them on WhatsApp
  brings people back, and returning visitors spread the word.

### 3. Supply outreach in the focus cities (ongoing, mostly people-time)
- Continue `outreach-direct-listing-creation.md` and `pg-coworking-google-places-leadgen.md`:
  contact PGs, coworking spaces and commercial owners with a public business listing and offer
  "we'll post it for you, free".
- Brokers (`requirement-leads-for-brokers.md`): one broker brings dozens of listings, so a free
  or discounted tier for early brokers in each focus city is the fastest way to get depth.
- Don't copy listings from other portals: it breaks their terms and brings in stale, duplicate
  ads.

### 4. Community groups (low cost; needs someone to do it)
- In India, property lets happen heavily in Facebook groups ("Flats & Flatmates <city>", society
  and RWA groups), Telegram groups and WhatsApp society groups.
- Tactic: helpful posts of real listings with UTM-tagged links, and replies to "looking for a
  2BHK in X" posts with a Bhavano search link. Follow each group's rules; spam gets banned.
- Offer RWAs or societies a free "our society's listings" page or link, which they share once
  and which keeps sending traffic.

### 5. SEO (slow; compounds over 3–6+ months)
- Already under way: city-first URLs, locality landing content and footer links
  (`seo-locality-landing-content.md`, `seo-remaining-improvements.md`).
- Focus pages on the focus cities and their busiest areas. Thin pages with 2 listings don't
  rank. This depends on principle 1.
- Tools and calculators (`tools-calculators-section.md`), such as EMI, stamp duty and rent
  agreements, attract searches that don't depend on inventory. Link them to posting.
- Create a Google Business Profile for Bhavano. It's free and gives branded-search trust.
- Subject to the SEO/URL rules: sitemap and robots changes need confirmation.

### 6. Referral: "Invite an owner, get a free boost" (small–medium build)
- A boost costs us nothing to give, so it's a cheap incentive. Give the referrer a 7-day boost
  when the invited owner publishes a listing.
- Guard against self-referral: phone-verified accounts, one reward per new phone number, paid
  out only after publishing.

### 7. Short video from listings (medium; later)
- Listings already have photos and video. Auto-generate Instagram Reels and YouTube Shorts per
  city ("New this week in Whitefield: 3 homes under ₹30k"), with the owner's consent, which the
  posting terms could cover.
- Meta ads are the paid alternative to Google for owner awareness. Treat them as a separate test
  with their own budget once the UTM tags are in place.

### 8. The app (later)
- Android app-store listing optimisation and the iOS release (`ios-app-store-release.md`).
  Push reaches 5 users today, so this matters once the web channels bring people in.

## Proposed order

| When | What |
|---|---|
| This week | #1 UTM tags on shares plus a "share your ad" prompt after posting. It's small, and it makes "direct" readable. |
| Next 2–4 weeks | #3 outreach and broker depth in 4–5 cities; #4 community posting (people-time); #2 city WhatsApp Channels |
| Next 1–3 months | #2 WhatsApp posting; #6 referral boosts; #5 SEO on focus cities |
| Later | #7 video; #8 app |

## How to judge it

- Monthly sign-ups and new listings from non-paid sources (`User.acquisitionSource` other than
  google/cpc and `syndicatedsearch.goog`). Today this is about 60 a month.
- The share of "direct" sessions we can explain, i.e. UTM-tagged.
- Live listings per focus city, with a target of a few hundred each before scaling to more
  cities.
