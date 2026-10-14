# SMS campaign: invite recent 99acres ad posters to post on Bhavano

## Status: plan only; nothing built or sent

Goal: SMS everyone who recently posted an ad on 99acres in **Bengaluru, Coimbatore, Chennai and
Hyderabad**, inviting them to sign in at bhavano.com and post their ads here. Contacts are found
with an Apify Actor and loaded as `OutreachContact` rows, then sent through the existing outreach
campaign pipeline. Related: [`outreach-campaign-contacts.md`](outreach-campaign-contacts.md) (data
model and send rules), [`competitor-99acres-owner-ads-research.md`](competitor-99acres-owner-ads-research.md).

## SMS template (approved in STPL and MSG91)

```
Hi Partner, post your property ads FREE on Bhavano. Sign in with email/mobile: https://bhavano.com App: https://bhavano.com/app Reply STOP to opt out. -Bhavano
```

- Sender `BHAVNO`, DLT template ID `1777179196588086293`.
- 159 characters of plain GSM-7, so 1 segment. No variables, so no name handling is needed.
- CTAs registered in STPL: `https://bhavano.com`, `https://bhavano.com/app`, the Play listing.
- `/app` and `/android` are live (commit `adbd5c06`). `bhavano.com/app` 301s to `www.bhavano.com/app`
  first, which then 302s to Play on Android or the homepage elsewhere.

## Finding (2026-10-14): 99acres does not expose poster phone numbers, so Phase 1 is blocked

Decision 2 below was tested before any script was written. I read the output schema and readme of
the 25 Apify Actors that match "99acres":

- The best-used ones (`fatihtahta/99acres-scraper-ppe`, 2,196 runs, $3.49 per 1,000 results;
  `stealth_mode/99acres-property-search-scraper`, 3,994 runs) return the poster's **name, company
  and class label (Dealer/Owner/Builder), never a phone number**.
- Several state it outright: 99acres masks the phone and email on the page itself;
  `thirdwatch/acres99-scraper` says numbers "are gated behind login and are not returned";
  `ahmed_jasarevic/99acres-scraper` removes phones "by design" and notes the DPDP Act.
- Only `rigelbytes/99acres-scraper` mentions a "partial phone when available". A partial number
  can't be messaged.
- Getting full numbers would mean logging in and revealing contacts (many accounts, one reveal
  each), which breaches 99acres' terms and is the unlawful-access route. I have not built it and
  won't.

So **an SMS campaign to "99acres ad posters" is not possible from scraped 99acres data**. What the
Actors can give is the poster's firm name and city. Options, each needing your decision:

1. **Match the firm to Google Maps.** Use the 99acres dealer/company name and city to find the
   same agency on Google Maps, which publishes a *business* phone. This reuses the existing
   `get_pg_coworking_leads_apify.py` import path and `source: google_maps`, and targets business
   numbers, not individuals. Match quality will be partial. A name-only match needs a manual check
   before anything is sent.
2. **Google Maps agents directly.** Skip 99acres: pull "real estate agent" businesses in the four
   cities with the existing scripts, which already return phones.
3. **Buy or license a broker contact list** that comes with consent.

The sender fix in Phase 3 is independent of this and is done.

## Built (2026-10-14): portal firms matched to Google Maps

The user chose option 1, using both 99acres and Housing.com, and accepted the terms-of-use risk.
[`get_agent_leads_from_portals_apify.py`](../../get_agent_leads_from_portals_apify.py) (tests in
`test_get_agent_leads_from_portals_apify.py`, 22 passing):

1. **Portals.** `fatihtahta~99acres-scraper-ppe` (dealer and featured-dealer listings, sale and
   rent) and `sian.agency~housing-com-property-scraper` (buy and rent), per city. Owners and
   builders are dropped. Rows older than `--max-age-days` (default 30) are dropped on both portals
   (`posted_at` on 99acres, `postedDate` on Housing.com). Verified on live data: Housing.com types
   agents as `Seller` (owners are `Owner`, builders `Developer`), and its unfiltered "buy" pages
   are mostly new-launch builder rows, so buy is searched as `resale`. 99acres reports regions
   ("Bangalore East"), which are folded into the city.
2. **Merge** to one firm per (city, normalised name), across both portals.
3. **Match** each firm on Google Maps (`compass~crawler-google-places`, 3 candidates). Score = name
   similarity (+0.10 if a portal locality is in the address, +0.15 if the Maps number starts with
   the portal's masked prefix such as `98200`, -0.05 if it doesn't, -0.5 if permanently closed).
   `>= 0.85` confident, `>= 0.60` review, otherwise unmatched.
4. **Output** a CSV per run. `sms_capable` is `yes` only for a confident match with a mobile.
   Landlines (STD-coded, and numbers starting 80 unless written 5+5) are kept for reference but are
   never SMS-capable.
5. **Import** only with `--import` (confident + mobile, deduped by phone) as `source: scrape`,
   `consentState: none`. Nothing is written to Bhavano by default.

Run the pilot where the Apify token lives (the app instance), CSV only:
`python get_agent_leads_from_portals_apify.py --cities Bengaluru --max-firms 50`.
Not yet run: there is no Apify token in the local checkout. Review the CSV by hand before any
`--import`.

## Decisions needed before extraction (these can stop the plan)

1. **99acres terms of use.** Scraping 99acres breaches its terms and Info Edge actively blocks
   scrapers. Account or IP blocks are likely, and legal action is possible. Apify Actors for
   99acres are third-party and can break without notice. This is the same class of risk as the
   Google Maps Apify script (see that script's docstring), but sharper, because here the data is a
   competitor's user content.
2. **Phone numbers may not be extractable.** 99acres hides the poster's number behind login and
   contact-reveal. Many Actors return only name, agency, locality and listing URL. **Run a 20-listing
   test first** and count how many rows have a phone. If the answer is near zero, the plan stops
   here, because logging in as a buyer to reveal numbers is a further terms-of-use breach and I
   would not build it.
3. **Personal data.** "All ad posters" includes individual owners, not only agents. Phone numbers of
   individuals are personal data under India's DPDP Act 2023, and these people never agreed to hear
   from us. Business and agent numbers are lower risk. **Recommendation: restrict to agents and
   brokers** (dealer/agency listings) and exclude individual owners, which also matches the earlier
   goal of inviting brokers and agents.
4. **TRAI rules.** Promotional SMS must not go to numbers on the DND/NCPR registry. The template is
   promotional and registered as such, and the telco filters DND numbers for promotional routes.
   Confirm with MSG91 that the route used is the promotional route with DND scrubbing, and that
   the delivery report shows the DND rejections.
5. **Volume and cost.** 1 segment per message, at the MSG91 rate (not yet known). Send me the rate
   and I'll put an exact estimate in the dry-run.

## Phase 1: Extraction (Apify)

1. **Pick the Actor.** Search the Apify store for a maintained 99acres listings scraper. Evaluate
   on: returns poster name, agency, phone (if exposed), listing date, locality, city; recent
   reviews and run count; price per 1,000 results. Pin the Actor ID and note its output field
   names after a real run, since docs and live output often differ (the Google Maps Actor did).
2. **Pilot.** One city, 20 listings, `--dry-run`: no import, only a CSV. Check phone coverage,
   duplicate rate, and the share that are agents versus owners.
3. **Scope.**
   - Cities: Bengaluru, Coimbatore, Chennai, Hyderabad, for rent and for sale.
   - "Recent": listings posted in the last 30 days. Define it as a CLI flag, default 30.
   - Agents only unless decision 3 changes.
4. **Script.** New `get_99acres_posters_apify.py`, modelled on
   [get_pg_coworking_leads_apify.py](../../get_pg_coworking_leads_apify.py) and importing its
   helpers (city lookup, chunked import, token minting) rather than copying them. It runs one Actor
   job per city, dedupes by normalised phone, and batches imports in chunks of 20 (the BFF body
   limit is 100 kB). Run it on the app instance over SSH, like the other scrapers
   (see `docs/deployment.md`).

## Phase 2: Load into Bhavano

- Post to `POST /admin/outreach/contacts/import` with `source: scrape`,
  `sourceRef: "99acres-apify-<run id>-<date>"`, `businessCategory: "real_estate_agent"`, and tags
  such as `99acres`, `agent`, plus the city.
- `cityId` is resolved by the same alias rules as the other scripts ("Bangalore" to "Bengaluru").
- `phoneE164` is derived on write and is the dedupe key. Existing contacts and suppression
  entries win over a re-import, and an opt-out is never downgraded by a re-import.
- `consentState` stays `none`. We must not mark scraped contacts as `implied` or `explicit`.
- Drop rows with no valid Indian mobile (10 digits starting 6-9). Landlines cannot receive SMS.
- Keep the raw Actor output in `leads_output/` for traceability. The `sourceRef` makes a bad
  import traceable and reversible.

## Phase 3: Campaign

1. **Sender fix.** `OutreachSenderService.sendSms` sends the whole body as `VAR1`. The approved
   template has no variables, so the request must carry only `mobiles` (no `VAR1`). Add a
   per-campaign "template has no variables" path and a unit test. Resolves the earlier finding.
2. **Create the campaign (draft).**
   - `channel: sms`, `dltTemplateId`: the MSG91 template ID (needed from you).
   - `bodyTemplate`: the text above (passes the STOP check).
   - `audienceFilter`: the four cities, tag `99acres`, `consentState != opted_out`.
   - `maxSendsPerRun: 200` and `minDaysBetweenSends: 14` (defaults). One-shot, no cron.
   - `dryRun: true`.
3. **Preview** (`GET outreach/campaigns/:id/preview`): audience count per city, sample rendered
   bodies, and (to add) segment count and estimated cost.
4. **Dry run**, then a **test send to our own numbers** only.
5. **Staged real send.** Turn off `dryRun`, send the first batch of 200 in one city, wait 24 hours,
   then check delivery rate, STOP replies, and sign-ups before releasing the rest in batches.
   Needs `MSG91_MARKETING_ENABLED=true`, which is off by default.

## Opt-outs and replies

- Every message carries "Reply STOP to opt out". The existing `optOut()` writes a `SuppressionEntry`
  that survives re-imports. Confirm how a STOP reply reaches us: MSG91 inbound-SMS webhook, or a
  manual import of replies. If neither exists, add a webhook before the real send, because a
  campaign that cannot honour STOP is not compliant.
- Suppressed numbers show as `suppressed` in the campaign report, not as silent skips.

## Measuring results

- **Clicks:** page views on `/app` and `/` from SMS. The `/app` Play link carries
  `utm_campaign=broker-invite`, so installs from it are attributable. The homepage link has no
  campaign tag, so the homepage sessions cannot be tied to this campaign. Optional: tag it
  `?utm_source=sms&utm_campaign=broker-invite` (this changes the registered CTA, so it needs
  re-approval).
- **Sign-ups:** `OutreachContact.userId` is set when a contact signs up. Match on phone.
- **Success metric to agree up front:** sign-ups and first posted ads per 1,000 SMS sent.

## Verification

- Pilot output reviewed by hand (phone coverage, agent share, duplicates) before anything is imported.
- Unit specs: sender sends no `VAR1` for a variable-free template; suppression, recently-contacted
  and opted-out contacts are excluded; re-import keeps an opt-out.
- Dry run produces the audience count and cost estimate, with no message sent.

## Open questions

- MSG91 template ID and per-segment rate.
- Agents only, or owners as well (decision 3)?
- How does a STOP reply reach us?
- Is a 99acres scrape acceptable to the business given decision 1? If not, the alternatives are a
  purchased broker database with consent, or Google Maps agent leads, which the existing scripts
  already pull.
