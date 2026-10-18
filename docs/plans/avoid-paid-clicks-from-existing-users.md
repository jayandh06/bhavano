# Avoid paying for clicks from people who already have an account

## Problem
Existing users return through a Google ad instead of going to the site or app directly, and each
click costs money.

## Already in place
`ads_exclude_existing_users.py` excludes the "All Users of bhavano-23f72" remarketing list (about
3,400 members) from the poster and acquisition Search campaigns. Metro-Seeker Intent is left out on
purpose (a returning seeker searching again is wanted traffic). Google only matches people signed
in to Google, and its list lags, so it leaks.

## Plan, in order of payoff
1. **Measure first.** `apps/bff/scripts/paid-clicks-from-existing-accounts.ts` (read-only) counts
   `Visit` rows with a `gclid` whose user signed up before the click, per campaign id, plus the
   top repeat clickers. It is a lower bound: `Visit.userId` is set only when the session logs in.
2. **Brand negatives.** Add phrase negatives for "bhavano" and misspellings to every non-brand
   campaign, after a `--report` of brand-term spend from `search_term_view`. Keep any dedicated
   brand campaign.
3. **Customer Match exclusion.** Upload hashed emails and phones of existing users (posters first)
   as a CRM-based list and exclude it. Needs a consent decision first, see below.
4. **Performance Max** does not take per-campaign audience exclusions the way Search does; handle
   it with account-level customer exclusion or the new-customer-acquisition setting.
5. **Bring people back without paid clicks:** push, WhatsApp templates and the app (see
   `owner-win-back-notifications-and-mobile-email-capture.md`).

## Decisions needed before step 3
- `/privacy` must disclose sharing hashed contact details with Google for ad exclusion.
- Uploading marks consent as granted for ad user data; that is a legal statement for the business
  to make, not a default.
- Google requires account eligibility (spend history, good standing) for Customer Match.
- The export holds personal data: write it outside the repo and delete it after the upload.
