# Outreach plan: women's PG operators in Chennai and Adyar

Status: plan, 2026-10-23. Nothing here has been sent. Part of [`pg-gender-pages-and-brand-signals.md`](pg-gender-pages-and-brand-signals.md):
Bhavano cannot be the answer to "women-only PG in Adyar" until women's PGs in Adyar are listed on it, with "Preferred for" filled in.

## Where we stand (production, 2026-10-23)
- Chennai has **32 live PG listings**; **28 are bulk imports** still owned by the Bulk Import account (nobody has claimed them) and only
  **2** say they are for women. None is in Adyar.
- The outreach table holds **29 Chennai PG contacts**: all `new`, none contacted, none with consent recorded, all with a phone and none
  with an email, all `OPERATIONAL` on Google. **None is in Adyar.** (Other cities, for scale: Delhi NCR 53, Bengaluru 35, Hyderabad 35,
  Pune 34.)
- Many Chennai PGs are named like "Raksha Womens PG" or "Sri Sai Women's PG". The name-based guess used for bulk imports only knew
  "ladies" and "girls", so these were left untagged. **Fixed 2026-10-23** (`guessGender`, and its Python twin): "women" / "women's" /
  "men's" now count. Existing untagged imports are not changed yet (see step 1).
- **"Preferred for" is now required** when a PG is posted by an owner, an admin or in the app (2026-10-23). Bulk imports are exempt, so
  the claiming owner fills it in.

## Goal
Within four weeks: at least **10 women's PGs live in Adyar and the neighbouring areas**, each with "Preferred for" set, photos and a
real contact; and the 28 existing Chennai imports claimed or corrected. Then rebuild the ChatGPT test ("women-only PG in Adyar").

## Steps

### 1. Correct what we already have (days 1 to 3, no outreach)
- Re-run the improved name guess over the 28 unclaimed Chennai imports and list the ones it would now tag women / men / co-ed. Review the
  list by eye, then apply it with a one-off script (dry run first; write only where "Preferred for" is empty; log every change in the
  listing edit log as an admin edit). This is a production data write, so it needs your go-ahead.
- Mark the rest "unknown" in the contact notes so the first call asks the question.

### 2. Find the Adyar women's PGs (days 2 to 5)
Use the existing scraper (`get_pg_coworking_leads.py`, see `pg-coworking-google-places-leadgen.md` and `pg-coworking-scraping-api-costs.md`),
one run per search term, so each is tracked separately:

```bash
python get_pg_coworking_leads.py --cities Chennai --categories pg --query-prefix "Ladies PG" --min-rating 3.5 --dry-run
python get_pg_coworking_leads.py --cities Chennai --categories pg --query-prefix "Women's hostel" --min-rating 3.5 --dry-run
python get_pg_coworking_leads.py --cities Chennai --categories pg --query-prefix "Working women hostel" --min-rating 3.5 --dry-run
```
- It queries Bhavano's curated Chennai areas. First check that **Adyar and its neighbours exist as areas** (Adyar, Besant Nagar,
  Thiruvanmiyur, Indira Nagar, Kotturpuram, Mylapore, Guindy, Saidapet, Velachery, Alwarpet, T. Nagar); add any that are missing.
- Run `--dry-run` first and read the counts and cost estimate; drop `--dry-run` only when the numbers look right. Keep `--min-rating`
  so the list is businesses a woman would actually trust.
- Import creates `OutreachContact` rows only (no listings, no messages).

### 3. Call first, message second (days 4 to 14)
Scraped numbers have **no consent on file** (`consentState: none`), and marketing SMS/WhatsApp in India is under TRAI / DLT rules, so:
- **A human phone call comes first.** One person, one script (below), a log of the outcome in the contact's notes and status.
- Message only contacts who said yes on the call (record `consentState`, source and time), using the approved templates (the "verify
  your listing" claim message), and never anyone with `optedOutAt` set. Respect the "no more often than every N days" cap.
- Do not mass-send to the scraped list.

Call script (English; add Tamil when a Tamil speaker is available):
> Hello, I'm calling from Bhavano, a property and PG listing site. Your PG <name> in <area> is already on Google. We can list it for free
> so women searching for a PG in <area> find you, and they message you directly on WhatsApp. It takes about five minutes. Can I send
> you a link on WhatsApp? One question: is the PG for women only, men only, or both?

What we promise: a free listing and direct enquiries. What we do not promise: rankings, number of enquiries, or free Featured.

### 4. Get them to publish (days 5 to 21)
- Where a listing already exists (bulk import): send the claim link on WhatsApp. The owner verifies with the phone number we have,
  then lands on the edit page. A "Preferred for" prompt on that page would help; today it only checks the field if the owner changes
  attributes (a follow-up, not built).
- Where none exists: either the owner posts it in the app or website (about five minutes, now with "Preferred for" required), or ops posts
  it for them with the admin "Posting for someone else" panel and the owner claims it.
- Photos matter more than anything: ask for four to six real photos (room, bathroom, entrance, kitchen or dining).

### 5. Quality and trust
- Verify the person on the phone is the operator (the claim flow matches the phone on file). Never list a PG from a scrape without a
  call.
- "Women-only" is a safety promise, so the operator confirms it themselves; we record it as "Preferred for: Women" and do not assert
  more. Bhavano does not inspect PGs (the trust page says so).
- Duplicates: one Google place id is one contact; check an existing listing before creating another.

## Measure
Track weekly, in a sheet or the admin contacts screen: contacts called, reached, said yes, listings claimed, listings live with "Preferred
for" set, and women's PGs live per area. Then repeat the fixed ChatGPT prompts once a month and note whether Bhavano is named, cited, or
neither.

## Next decision (not yet taken)
When there are enough women's PGs in a city (suggested minimum 5, Delhi NCR and Pune are close today), build the city-level
women / men / co-ed PG pages. That needs your confirmation of the sitemap change, as noted in the brand-signals plan.
