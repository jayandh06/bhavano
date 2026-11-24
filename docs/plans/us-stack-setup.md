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

US app instance (its own EC2, a US region)
  Caddy.us   US_ORIGIN_DOMAIN -> web:3000      US_API_DOMAIN -> bff:4000
  web        the web app built for /us (basePath), MARKET=us
  bff        the same image as India's, MARKET=us   --DATABASE_URL (private IP)-->

US DB instance (its own EC2, same region and VPC)
  PostgreSQL 16, installed as a package (not a container), reachable only from the app instance on 5432
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

1. **AWS**: two EC2 instances in one US region and VPC, as India does (`docs/deployment.md`, "app instance + db instance"; plan: `us-east-1`, ARM,
   since the images are `linux/arm64`).
   - **App instance**: 40-60 GB gp3, an Elastic IP, a security group (80/443 open, SSH from your address only), Docker, the repo at `~/bhavano`.
   - **DB instance**: its own gp3 volume with daily snapshots, no public access: a security group that allows 5432 only from the app instance's group (and
     SSH from your address). Install PostgreSQL 16, create the `bhavano` role and database, set `listen_addresses` and `pg_hba.conf` for the VPC range
     (`docs/deployment.md` steps 1-4). Put its private IP in the app instance's `DATABASE_URL`. Never run the app containers on the DB instance.
2. **DNS**: A records to the US host for `US_ORIGIN_DOMAIN` (for example `us-origin.bhavano.com`) and `US_API_DOMAIN` (for example
   `api.us.bhavano.com`). `www.bhavano.com` itself does not move.
3. **Accounts and keys, all separate from India's**: a photo bucket and CDN host, a Google OAuth client (add `https://www.bhavano.com/us/api/auth/callback/google`
   as a redirect), a Maps server key and a browser key, SMTP, and later Stripe and Twilio. Fill `.env.us.example` into `.env` on the host.
4. **GitHub**: set the repository variables `US_NEXT_PUBLIC_BFF_URL` (`https://<US_API_DOMAIN>`), `US_NEXT_PUBLIC_SITE_URL`
   (`https://www.bhavano.com/us`), `US_NEXT_PUBLIC_GTM_ID`, `US_NEXT_PUBLIC_META_PIXEL_ID`, `US_NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY`. Run
   the workflow with `services=web-us,bff`. Log the US host in to ghcr.io as for India (`docs/plans/registry-based-deploy.md`).
5. **First deploy** (from this repo): `./scripts/deploy-from-registry.ps1 -Stack us` (this runs `prisma migrate deploy` against the DB instance; there is no data, so
   seed the US cities with the seed script before opening it up). Check `https://<US_ORIGIN_DOMAIN>/us` and `https://<US_API_DOMAIN>/health`.
6. **Route `/us` on the India host** (the only change to India's live behavior, so do it last): on the India host set `US_ORIGIN_DOMAIN` in
   `.env`, `cp caddy/market-routes/us.caddy.example caddy/market-routes/us.caddy`, then recreate Caddy
   (`docker compose -f docker-compose.prod.yml --env-file .env up -d caddy`). Roll back by deleting `us.caddy` and recreating Caddy.
7. **Keep it hidden until launch** (built 2026-11-24): two layers, both on by default. The US build's root layout sets `robots: noindex, nofollow`
   from the market's `indexable: false` (`apps/web/src/lib/marketRobots.ts`), and the US Caddy adds `X-Robots-Tag: noindex, nofollow` to every
   response (`US_ROBOTS_TAG` in the US `.env`, default noindex). India's layout still says `index, follow`. **Launch** is deliberate and has
   three parts: set `US_ROBOTS_TAG=all`, flip `indexable: true` for the US in `packages/types/src/market.ts` and rebuild the US image, then add the
   US sitemap (see "Not done").

## Not done / not verified

- **No end-to-end run.** The US-mode web build compiled here, but the stack has not been started: Docker was not running on this
  machine, so the Caddy files were not validated with `caddy validate`, and the compose file was only checked as YAML.
  There is no staging copy: the first real run is the production US host, before `/us` is routed on India's Caddy (step 6), so expect a fix-up round.
- **US `robots`/`sitemap`** (built 2026-11-24): the US build's `/us/sitemap.xml` is empty and its `/us/robots.txt` disallows everything until the US is
  indexable; once it is, the sitemap lists the home page, the browse pages, listings and the legal/company pages (no blog, calculators or
  other India content). Crawlers only read `robots.txt` at the host root, so India's `robots.ts` adds `Sitemap: https://www.bhavano.com/us/sitemap.xml`
  when `MARKETS.us.indexable` is true; until then India's robots.txt and sitemap are unchanged (tested for robots, `lib/marketRobots.ts`). Launch is the one
  `indexable` flip, plus `US_ROBOTS_TAG=all`. Not tested against a running US build; check `/us/sitemap.xml` and the root `robots.txt` on staging.
- **Latency**: India's Caddy proxying `/us/*` to the US host adds a hop for US visitors (US to India to US). The proper fix is to route
  `/us/*` at an edge (Cloudflare or a CDN) straight to the US origin; this setup works without it but is not the final shape.
- **Admin for the US**: not included. US admin is the India admin pointed at the US API (a second login) or its own deployment; undecided.
- **Backups, monitoring, Loki/Grafana** for the US hosts (India has them): EBS snapshots on the DB volume and a nightly `pg_dump` off the box, as in
  `postgres-backup-finfolia.md` (its Finfolia target is India-side; pick an S3 bucket in the US region instead).
- **Raw `<a href="/...">`/CSS `url(/...)`** and any other absolute path that is not a Next link or `fetch` through `withBasePath` would not carry `/us`.
  A search found none outside `fetch` and `sendBeacon`, but check in the running US build.
- **Mobile**: the app still points at India's API; the market switch and the US API address are separate work.
- **Payments, login (Twilio/email-first), US legal pages**: separate work, see the main plan.
