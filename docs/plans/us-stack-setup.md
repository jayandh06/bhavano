# US stack: what is in the repo and how to bring it up

## Status: repo changes built 2026-11-24; nothing provisioned, nothing deployed

Part of [us-market-expansion.md](us-market-expansion.md) (Option B: the US lives at `www.bhavano.com/us/`). Every change below is off by
default: with no US variables set, India builds, deploys and routes exactly as before.

## How it fits together

```
visitor -> www.bhavano.com  (DNS: India host, unchanged)
              India Caddy
                /us, /us/*  -> https://US_ORIGIN_DOMAIN   (only once caddy/market-routes/us.caddy exists)
                everything else -> India web, as today

US host (its own EC2, a US region)
  Caddy.us   US_ORIGIN_DOMAIN -> web:3000      US_API_DOMAIN -> bff:4000
  web        the web app built for /us (basePath), MARKET=us
  bff        the same image as India's, MARKET=us
  postgres   its own database, volume pgdata
```

- **Web image `bhavano-web-us`**: `apps/web` built with `NEXT_PUBLIC_BASE_PATH=/us` and `NEXT_PUBLIC_MARKET=us`. Next prefixes links,
  assets and redirects with `/us`; raw `fetch("/api/...")` calls go through `withBasePath` (`apps/web/src/lib/basePath.ts`). The
  client market comes from `NEXT_PUBLIC_MARKET` when set (the path Next reports has no `/us`), else from the URL path.
- **BFF**: the same `bhavano-bff` image, run with `MARKET=us` (time zone, phone, currency, categories, units, hidden fields, dates).
  India's MSG91, WhatsApp, Razorpay and DLT variables are simply absent, so those channels stay off.
- **Cookies**: India and the US share the host, so the US build uses its own names (`bhavano_sid_us`, `bhavano_city_us`, `bhavano_acq_us`,
  `bhavano_ref_us`, `bhavano_vk_us`; Auth.js cookies `authjs.us.*`, `apps/web/src/lib/cookieNames.ts`, `apps/web/src/auth.ts`). A
  login on one market is never sent to the other.
- **CI**: `.github/workflows/build-images.yml` builds `web-us` only when the repository variable `US_NEXT_PUBLIC_SITE_URL` is set; `bff`
  is shared. `workflow_dispatch` accepts `web-us` in `services`.
- **Deploy**: `scripts/deploy-from-registry.ps1 -Stack us` (compose file `docker-compose.us.yml`, project `bhavano-us`, services `web,bff`).
  Point `BHAVANO_EC2_HOST` at the US host. Image names: registry `bhavano-web-us` and `bhavano-bff`, local `bhavano-us-web`, `bhavano-us-bff`.

## One-time setup (the parts that are not in the repo)

1. **AWS**: an EC2 instance in a US region (plan: `us-east-1`; ARM like India's, since the images are `linux/arm64`; 60-80 GB gp3), an
   Elastic IP, a security group (80/443 open, SSH from your address only), Docker, and the repo cloned at `~/bhavano`.
2. **DNS**: A records to the US host for `US_ORIGIN_DOMAIN` (for example `us-origin.bhavano.com`) and `US_API_DOMAIN` (for example
   `api.us.bhavano.com`). `www.bhavano.com` itself does not move.
3. **Accounts and keys, all separate from India's**: a photo bucket and CDN host, a Google OAuth client (add `https://www.bhavano.com/us/api/auth/callback/google`
   as a redirect), a Maps server key and a browser key, SMTP, and later Stripe and Twilio. Fill `.env.us.example` into `.env` on the host.
4. **GitHub**: set the repository variables `US_NEXT_PUBLIC_BFF_URL` (`https://<US_API_DOMAIN>`), `US_NEXT_PUBLIC_SITE_URL`
   (`https://www.bhavano.com/us`), `US_NEXT_PUBLIC_GTM_ID`, `US_NEXT_PUBLIC_META_PIXEL_ID`, `US_NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY`. Run
   the workflow with `services=web-us,bff`. Log the US host in to ghcr.io as for India (`docs/plans/registry-based-deploy.md`).
5. **First deploy** (from this repo): `./scripts/deploy-from-registry.ps1 -Stack us` (this runs `prisma migrate deploy`; there is no data, so
   seed the US cities with the seed script before opening it up). Check `https://<US_ORIGIN_DOMAIN>/us` and `https://<US_API_DOMAIN>/health`.
6. **Route `/us` on the India host** (the only change to India's live behavior, so do it last): on the India host set `US_ORIGIN_DOMAIN` in
   `.env`, `cp caddy/market-routes/us.caddy.example caddy/market-routes/us.caddy`, then recreate Caddy
   (`docker compose -f docker-compose.prod.yml --env-file .env up -d caddy`). Roll back by deleting `us.caddy` and recreating Caddy.
7. **Keep it hidden until launch**: the US pages should answer `noindex` until the launch decision (the market config has `indexable: false`);
   see "Not done" below.

## Not done / not verified

- **No end-to-end run.** The US-mode web build compiled here, but the stack has not been started: Docker was not running on this
  machine, so the Caddy files were not validated with `caddy validate`, and the compose file was only checked as YAML.
  Bring it up on a staging host first.
- **`noindex` and the US `robots`/`sitemap`** are not wired: the US build still serves the same `robots.ts` and `sitemap.ts` (which build URLs
  from `NEXT_PUBLIC_SITE_URL`, now `.../us`). Add `noindex` for the US build before the host is reachable, and have counsel and you
  agree the launch date. Do not touch India's `robots`/`sitemap` (CLAUDE.md).
- **Latency**: India's Caddy proxying `/us/*` to the US host adds a hop for US visitors (US to India to US). The proper fix is to route
  `/us/*` at an edge (Cloudflare or a CDN) straight to the US origin; this setup works without it but is not the final shape.
- **Admin for the US**: not included. US admin is the India admin pointed at the US API (a second login) or its own deployment; undecided.
- **Backups, monitoring, Loki/Grafana** for the US host (India has them); copy `postgres-backup-finfolia.md`.
- **Raw `<a href="/...">`/CSS `url(/...)`** and any other absolute path that is not a Next link or `fetch` through `withBasePath` would not carry `/us`.
  A search found none outside `fetch` and `sendBeacon`, but check in the running US build.
- **Mobile**: the app still points at India's API; the market switch and the US API address are separate work.
- **Payments, login (Twilio/email-first), US legal pages**: separate work, see the main plan.
