# US admin site

Status: **server fixes deployed 2026-11-27; phase A deployed the same day at https://admin-us.bhavano.com, behind the
Cloudflare proxy, with admin sign-in confirmed. Dollar prices are done. A refused non-admin account has not been
checked. The rest of phase B is proposed.** Part of the US launch
([us-market-expansion.md](us-market-expansion.md), [us-stack-setup.md](us-stack-setup.md)).

## Goal

A way to run the US market: review and remove listings, read messages, manage users, publish city overviews and change
settings. Today the US stack runs only `web`, `bff` and `caddy`; `admin.bhavano.com` reaches India's data only.

## What was checked (2026-11-27)

| Item | Finding |
|---|---|
| Admin image | Already built for every push (`bhavano-admin`, arm64). It reads only runtime settings (`BFF_INTERNAL_URL`, `NEXTAUTH_*`, Google keys), so the same image runs against the US |
| US app server | 3.8 GB memory, 2.7 GB available; admin uses about 64 MB on India. Disk 19% used |
| US settings | `ADMIN_EMAILS` set; `ADMIN_PHONES` empty; `PUBLIC_SITE_URL` was not passed to the backend; no admin domain or secret |
| US data | 0 users, 0 admins, 0 listings, no saved reminder settings |
| DNS | Neither `admin.us.bhavano.com` nor `admin-us.bhavano.com` exists. India's admin is proxied by Cloudflare |
| Sign-in | The admin app offers Google and a phone code (+91, MSG91). Only Google can work in the US |

## Done first: server fixes (built 2026-11-27, deploy before any US admin sign-in)

The automatic jobs send from the oldest admin account, and do nothing while there is none. The defaults are on
(`reminder-settings.ts`), so the first `ADMIN_EMAILS` sign-in anywhere on the US would have started Boost follow-ups
offering a paid feature nobody can buy, with links to **India's site** (`PUBLIC_SITE_URL` was not passed to the US
backend). There were no US users, so nothing was sent. **Do not sign in on the US with an admin address until the
US backend runs these fixes.**

All of them follow the market (`paymentsEnabled` in `packages/types/src/market.ts`); India behaves as before.

| Where payments are off | Code |
|---|---|
| Boost nudge, Boost follow-up and Featured-expiry jobs send nothing; the manual Boost message is refused | `admin/*.job.ts`, `admin.service.ts` |
| Every Razorpay charge and every Apple purchase intent is refused (403 `PAYMENTS_UNAVAILABLE`). Free activations (credits, 100% codes) still work. The webhook, Apple verify and Apple notifications are unchanged | `market/payments-available.ts` |
| A new ad is never held for payment, whatever the fee settings say; a requested boost is ignored | `listings/holds-for-payment.ts` |
| The posted-reminder push is a plain check-in | `push.service.ts` |
| The "requirement received" email without an alert links to My requirements, not Plans | `notifications.service.ts` |

| Links and wording | Code |
|---|---|
| `bff` gets `PUBLIC_SITE_URL` (from `NEXT_PUBLIC_SITE_URL`, default `https://www.bhavano.com/us`) | `docker-compose.us.yml` |
| The requirement digest links to `ADMIN_SITE_URL`; unset, it links nowhere in the US and to `admin.bhavano.com` in India | `notifications.service.ts` |
| US copies of `welcome`, `listing-posted`, `listing-posted-reminder`, `requirement-captured-no-alert` and `claim-listing` | `notification-templates/us/email/` (see its README) |

Deploy: `bff` only, `scripts/deploy-from-registry.ps1 -Stack us -Services bff`. The script updates the server's checkout,
which brings the compose file and the US email copies.

Not changed:

- **The US website still offers paid features.** It does not read `paymentsEnabled` (only the app does): on 2026-11-27
  `/us/premium` showed prices and plan choices. The server now refuses the purchase; hiding the offers is web work.
- Free contact reveals run out and no credits can be bought.
- Emails sent only for Featured ads keep their wording ("favourites").

## Phase A: put the admin site up

| Change | Where | State |
|---|---|---|
| `admin` service (image `bhavano-us-admin`, the registry's `bhavano-admin`) with its own `NEXTAUTH_*` and the US Google keys | `docker-compose.us.yml` | Built |
| Site block for `US_ADMIN_DOMAIN` (never indexed), proxy to `admin:3001` | `Caddyfile.us`, compose | Built |
| `admin` is a US service, deployed by default like `web` and `bff` | `scripts/deploy-from-registry.ps1` | Built |
| The four settings below | `.env.us.example`, the server's `.env` | Done (previous file kept at `~/.us-env.before-admin`) |
| DNS record `admin-us.bhavano.com` to `52.45.78.97` | Cloudflare | Done, proxied |
| Redirect address `https://admin-us.bhavano.com/api/auth/callback/google` | Google Cloud console, client `Bhavano-Web` (shared with India) | Done |

Until `US_ADMIN_DOMAIN` is set, Caddy is given a name nobody can request, so a deploy before the DNS record exists
changes nothing visible.

Order:

1. Owner: the DNS record, **DNS only** (grey cloud) so the server can get its certificate, and the Google redirect address.
2. Server `.env`: `US_ADMIN_DOMAIN=admin-us.bhavano.com`, `ADMIN_NEXTAUTH_URL` and `ADMIN_SITE_URL` =
   `https://admin-us.bhavano.com`, `ADMIN_NEXTAUTH_SECRET` (new, generated on the server).
3. `scripts/deploy-from-registry.ps1 -Stack us -Services bff,admin` (also recreates Caddy and gives `bff` the admin
   address).
4. Sign in, then the owner turns the Cloudflare proxy on.

India is not touched.

**Done when:** an `ADMIN_EMAILS` account signs in with Google at the new address, sees US data, and another Google
account is refused.

Until phase B the screens show India's conventions: times in IST, date filters on Indian days, rupees, and India-only
screens that stay empty. Links from visit trails and requirements open India's site. Use it for moderation; **do not
change prices or send outreach from the US admin.**

## Dollar prices (built 2026-11-27, ahead of the rest of phase B)

The Plans screen showed dollar subscription prices under rupee labels, and the Feature and Instant Alerts prices were
India's: only subscriptions and contact credits had US defaults.

- The admin reads `MARKET` at request time (`apps/admin/src/lib/market.ts`, set in `docker-compose.us.yml`). Price
  screens, the listing price field and a user's listing prices use that market's currency. The US price screens name the
  US categories and leave out the furniture tier and the value bands.
- US Feature prices by the owner's rule (rupees divided by 60, rounded up to the next $5): property $5 / $10 / $10 for
  7 / 15 / 30 days, storage and the furniture tier $5, Instant Alerts $5, no price-by-value bands.
- Condo, townhouse and room are priced as property (they fell into the cheapest tier).

The defaults only reach a fresh database. The US database held India's rows, so they were set once after the deploy on
2026-11-27 (the old values are in `~/us-prices-before-20261127.json` on the US app server):

```sql
UPDATE "BoostPriceSetting" SET "propertyBoostPrice7d" = 5, "propertyBoostPrice15d" = 10, "propertyBoostPrice30d" = 10,
  "coworkingPgStorageBoostPrice7d" = 5, "coworkingPgStorageBoostPrice15d" = 5, "coworkingPgStorageBoostPrice30d" = 5,
  "furnitureInteriorsBoostPrice7d" = 5, "furnitureInteriorsBoostPrice15d" = 5, "furnitureInteriorsBoostPrice30d" = 5,
  "valueBandRules" = '[]', "updatedAt" = now() WHERE id = 'singleton';
UPDATE "InstantAlertsPriceSetting" SET "instantAlertsPrice" = 5, "updatedAt" = now() WHERE id = 'singleton';
```

Still rupees in the US admin: the ad-campaign analytics (India's Google Ads spend).

## Phase B: make the admin app fit the US

Build a second image, `admin-us`, with `NEXT_PUBLIC_MARKET=us` (as `web-us` is built), because dates and money are
formatted by plain functions in server and browser code.

- Login: Google only.
- Times, date ranges and "today" in the US business zone (`America/New_York`); `en-US` dates. (Dollar prices are done.)
- Hide: Outreach, Billing and promotions, Referrals, and the settings for plans, contact reveal, referral rewards,
  featured prompt, featured reminders, owner alerts and seeker contact. Hide the phone code button.
- India stays byte-for-byte the same; tests pin its formatting.

The India formatting to change is spread widely (a search for IST, `en-IN`, ₹ and `+91` finds well over a hundred
lines), so phase B is clearly larger than phase A.

## Decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Address | **Chosen: `admin-us.bhavano.com`**, proxied by Cloudflare like India's. `admin.us.bhavano.com` would need to bypass the proxy (or a paid certificate), since the free certificate covers one level |
| 2 | Extra protection | Put Cloudflare Access (email allow-list) in front of both admin sites; the app's own login stays |
| 3 | When to do phase B | After phase A, before US users arrive in numbers |

## Rollback

Remove the DNS record or stop the `admin` container; nothing else depends on it. The server fixes stay.

## Not verified

- No admin screen has been run against the US backend; some may fail on empty or US-shaped data.
- Whether Cloudflare Access fits the current Cloudflare plan.
