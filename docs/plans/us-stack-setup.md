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
   - **Sizing (decided 2026-11-24): both `t4g.medium`** (2 vCPU, 4 GB, burstable), about $25 a month each, the same type as India's app and DB
     instances. Add a 2 GB swap file on the app instance and a `CPUCreditBalance` alarm on both; keep the default unlimited credit mode.
     Resizing within `t4g` is a stop, change type, start.
     - **Evidence (India, read with a read-only IAM profile on 2026-11-25; CloudWatch, last 30 days):** the app instance averaged 7.8% CPU (hourly
       peaks about 17%, one hour at 76%) and the DB instance 1.0% (one hour at 47%). The CPU credit balance never fell below 570.7 of 576 (app) and
       575 of 576 (DB), and no surplus credits were charged, so unlimited mode cost nothing extra. Both are in unlimited mode.
     - **Why not `m7g.medium` (dedicated CPU, about $30):** it has one vCPU, and India's 76% peak is about 1.5 vCPUs busy for an hour, so it would
       have saturated where the two `t4g` cores did not. **`t2.medium`** was rejected: x86 (the images are arm64), older, slower and dearer.
     - **Not measured:** memory (CloudWatch does not record it; India's app host has 4 GB and no swap, and a build ran it out of memory on 2026-09-28),
       and anything beyond 30 days. India's load is not a forecast of US load. Revisit the size once the US has real traffic.
   - **App instance**: 40 GB gp3, an Elastic IP, a security group (80/443 open, SSH from your address only), Docker, the repo at `~/bhavano`.
   - **DB instance**: its own 40 GB gp3 volume with daily snapshots, no public access: a security group that allows 5432 only from the app instance's group (and
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

## Provisioned 2026-11-25 (AWS account 122610498860, `us-east-1`)

Created with the `bhavano-us` CLI profile; everything is tagged `Project=bhavano-us-prod`.

| What | Id / value |
|---|---|
| VPC `10.20.0.0/16` (one public subnet `10.20.1.0/24`, `us-east-1a`, internet gateway, route table) | `vpc-0acf57880b442652f`, `subnet-08117abd980ddaed0`, `igw-08eb77bfa619dd7ac`, `rtb-0013cb3a054bc6d64` |
| App instance `bhavano-us-app`, `t4g.medium`, Ubuntu 26.04.1 arm64, 40 GB gp3 (encrypted), private `10.20.1.20` | `i-047708290a12ef7f3`, Elastic IP `52.45.78.97` |
| DB instance `bhavano-us-db`, same type and disk, private `10.20.1.10` | `i-09f2a023062a82394` (auto-assigned public IP, outbound installs only; it changes on stop/start) |
| Security groups | app `sg-016973e53df92f019` (80/443 open, SSH from the admin IP), db `sg-0d89b9e299a6898ba` (5432 from the app group only, SSH from the admin IP) |
| Key pair `bhavano-us-prod` | private key at `~/.ssh/bhavano-us-prod.pem` on the machine that created it; not in the repo |

Both instances are in unlimited credit mode with termination protection on and IMDSv2 required. The SSH rule allows one admin address only, so a changed
address needs the rule updated. `DATABASE_URL` for the US `.env` uses the DB's private address `10.20.1.10`.

**Installed on the hosts (2026-11-25):**
- **DB instance:** PostgreSQL 16.16 from PGDG (it supports Ubuntu 26.04), role and database `bhavano`, `listen_addresses = '*'` and a `pg_hba.conf`
  line for `10.20.0.0/16` with `scram-sha-256` (the security group allows 5432 from the app group only), service enabled. Default tuning, not adjusted.
- **App instance:** a 2 GB swap file (`vm.swappiness=10`), Docker 29.10 with the compose and buildx plugins (Docker has a repo for 26.04), the `ubuntu` user in the
  `docker` group, and the `psql` client (18.6). The generated database password is in `~/.us-db-password` (mode 600) on the app instance only;
  it goes into `DATABASE_URL` in the US `.env` and is not stored anywhere else. Checked: the app instance logs in to the DB at `10.20.1.10` and
  `CREATE EXTENSION pg_trgm` works as the `bhavano` role.
- **Snapshots (2026-11-25):** Data Lifecycle Manager policy `policy-00793204c3843f791`: daily at 07:00 UTC, keep 7, for volumes tagged
  `Project=bhavano-us-prod` (both US volumes), run by the AWS-defined role `AWSDataLifecycleManagerDefaultRole`. Restore by creating a volume from a snapshot.
- **Alarms and alerts (2026-11-25):** CloudWatch alarms `bhavano-us-{app,db}-cpu-credits-low` (`CPUCreditBalance` under 100 of 576 for 15 minutes) and
  `bhavano-us-{app,db}-status-check-failed`, all sending to the SNS topic `bhavano-us-alerts` (email subscription to support@bhavano.com; it must be confirmed from
  the AWS email or nothing is delivered). A new unlimited-mode `t4g` instance starts near 0 credits and earns 24 an hour, so the credit alarms read ALARM for
  the first few hours and then clear; heavy CPU in that window can bill small surplus charges.
- **Nightly dump (2026-11-25):** on the DB instance, `bhavano-pg-dump.timer` runs `/usr/local/bin/bhavano-pg-dump-us.sh` at 06:00 UTC (about 01:00 US Eastern,
  before the 07:00 UTC snapshot): `sudo -u postgres pg_dump -Fc` (no password in the script), checked with `pg_restore --list`, kept 3 deep in `/var/backups/bhavano-local`, and
  copied over the VPC to the app instance (`bhavano-backup@10.20.1.20:/var/backups/bhavano`, newest 3). The push uses a root key on the DB host
  (`/root/.ssh/us_app_backup`) authorized on the app instance only from `10.20.1.10` with `restrict`; the app security group allows SSH from the DB group for it.
  India's script copies to Finfolia instead; the US has no equivalent, so this off-box copy is a second host in the same VPC and AZ, not a different region or
  account. Run now: `sudo systemctl start bhavano-pg-dump.service`. Verified once: dump, copy, prune and a restore into a scratch database all succeeded
  (on an empty database, 1.3 KB, so it proves the plumbing, not a real restore).
- **Repo and `.env` (2026-11-25):** the repo is cloned at `~/bhavano` on the app instance through a read-only GitHub deploy key (`bhavano-us-app (read-only)`, repo Settings
  > Deploy keys; its private half is `~/.ssh/id_ed25519_github` on the instance), so `git pull --ff-only` in the deploy script works. `~/bhavano/.env` (mode 600) was made from
  `.env.us.example` with the database URL (private IP `10.20.1.10`) and two fresh random secrets (`AUTH_JWT_SECRET`, `NEXTAUTH_SECRET`); `docker compose config` parses it. The domain
  names are the template defaults (`us-origin.bhavano.com`, `api.us.bhavano.com`). Still empty: Google OAuth, Maps server key, SMTP, the `R2_*` photo bucket and `CDN_BASE_URL`,
  admin emails, and the optional keys.
- **DNS (2026-11-25):** in the Cloudflare `bhavano.com` zone, two A records to the app instance's Elastic IP `52.45.78.97`, both **DNS only** (not proxied, so Caddy can get its
  certificates): `us-origin.bhavano.com` and `api.us.bhavano.com` (TTL Auto, resolving from Cloudflare, 1.1.1.1 and 8.8.8.8). India's records were not touched. Nothing answers on 80/443 until
  the first deploy.
- **First deploy (2026-11-25):** images built with `gh workflow run build-images.yml -f services=web-us,bff` (repo variables `US_NEXT_PUBLIC_BFF_URL=https://api.us.bhavano.com` and
  `US_NEXT_PUBLIC_SITE_URL=https://www.bhavano.com/us` set; GTM, Meta Pixel and the Maps browser key unset), then `scripts/deploy-from-registry.ps1 -Stack us -Ec2Host 52.45.78.97 -SshKey <pem> -Tag sha-<8>`
  on the build of master `a450cf7d`. Result: `bff` healthy, `web` up, 135 migrations applied (77 tables), Caddy up with Let's Encrypt certificates for both names, `/health` 200, `/us` 200 with
  `X-Robots-Tag: noindex, nofollow` and the noindex meta tag. India's `www.bhavano.com` still 200.
  - **First-run ordering, fixed in the script (2026-11-25):** the first deploy on an empty database stalled, because `web` waits for `bff` to be healthy and `bff` is unhealthy until the
    schema exists, while the script only migrated afterwards. It now starts `bff` alone, runs `prisma migrate deploy`, then starts the rest, and for `-Stack us` also starts Caddy (nothing
    depends on it, so it was never started before). Tested on the US host in a throwaway compose project against an empty scratch database: migrated (77 tables), then `web` started
    healthy; the live stack was untouched. Not run against India's stack (the order is the same for it, but a failed migration now stops before web and admin are recreated).
  - `US_ROBOTS_TAG` is quoted in `.env.us.example` (`"noindex, nofollow"`) so the file can also be sourced by a shell.
  - Not yet working, by design: sign-in (Google OAuth, SMTP and the photo bucket keys are empty), the map picker (no US Maps browser key), and the site still shows India wording (title and copy).
- **Photo bucket and CDN (2026-11-25):** a separate R2 bucket `bhavano-photos-us` (location hint ENAM, in the same Cloudflare account as India's `bhavano-photos`), public through the custom domain
  **`cdn-us.bhavano.com`** (one subdomain level, because Cloudflare's free certificate covers `*.bhavano.com` only; the CNAME was added by the R2 custom-domain flow), and an account API
  token `bhavano-us-photos` with Object Read & Write on that bucket only, restricted to the US app instance's IP `52.45.78.97`. The five values are in `~/bhavano/.env` (`R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=bhavano-photos-us`, `CDN_BASE_URL=https://cdn-us.bhavano.com`; the previous file is `.env.bak-before-r2`) and `bff` was recreated.
  Verified from the US host: upload to the bucket, fetch through the CDN (`200`), delete. Uploads go through the API with `PutObject`, so no CORS rule is set. Not yet verified: a real photo
  upload through the app (needs sign-in), and `apps/web/next.config.ts` now allows the `cdn-us.bhavano.com` image host, which takes effect after the US web image is rebuilt and redeployed.
- **Keys copied from India's `.env` (2026-11-25), as decided:** `GOOGLE_CLIENT_ID`/`SECRET`, `SMTP_*`, `GOOGLE_MAPS_SERVER_KEY`, `ADMIN_EMAILS`, plus `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID` and `APPLE_BUNDLE_ID`
  (public identifiers of the same mobile app), copied host to host through the deploy machine without printing them (lengths match India's; the US `.env` before the copy is `.env.bak-before-india-keys`).
  The secrets (`AUTH_JWT_SECRET`, `NEXTAUTH_SECRET`, the database password, the R2 token) stay separate. Checked from the US host: SMTP login works (nothing sent). **The Maps server key is denied from
  the US IP** (`REQUEST_DENIED`, "This IP ... is not authorized"): add `52.45.78.97` to that key's IP restrictions in Google Cloud Console (or make a US key). Google OAuth: the two US redirect URIs were added to India's
  client `Bhavano-Web` (2026-11-25; existing URIs untouched): `https://www.bhavano.com/us/api/auth/callback/google` and `https://us-origin.bhavano.com/us/api/auth/callback/google`. Verified: the US
  site's `/us/auth/google` redirects to Google with `redirect_uri=https://www.bhavano.com/us/api/auth/callback/google` and Google shows its sign-in page (no `redirect_uri_mismatch`). A full sign-in cannot
  finish yet: the app always sends the www address (`AUTH_URL`), so Google returns the user to `www.bhavano.com/us/...`, which India's Caddy does not route to the US host until the `/us` routing step (or
  `NEXTAUTH_URL` is temporarily pointed at `us-origin` for a test).
- **Sign-in route fix (2026-11-25):** `/us/api/auth/*` answered 400 (`UnknownAction: Cannot parse action at /api/auth/csrf`): Auth.js takes its base path from the pathname of `AUTH_URL`
  (`/us/api/auth`), but Next strips `/us` before the route handler runs. `apps/web/src/lib/authRequest.ts` restores the prefix on the incoming request (a no-op for India), used by the auth route. Unit-tested,
  and verified on the US host after deploying `sha-da3807b8` (2026-11-25): `/us/api/auth/providers`, `csrf` and `session` answer 200, and the providers list Google with the callback
  `https://www.bhavano.com/us/api/auth/callback/google`. The Google sign-in flow itself is not tried yet (needs the US redirect URIs on the OAuth client). Note: Compose does not recreate a container whose image
  has the same content, even when the registry digest differs (each build adds a provenance record), so `bff` stayed on the previous build while only `web` was recreated; that is correct.
- **US Maps keys (2026-11-25):** two new keys in the same Google Cloud project as India's (`Bhavano`), so billing and quota are shared with India but the keys are separate and India's were not edited.
  `Bhavano-US-Server`: restricted to the US app IP `52.45.78.97` and to the Geocoding API, Places API and Places API (New); it replaced the copied India key in the US `.env` (`GOOGLE_MAPS_SERVER_KEY`; the
  previous file is `.env.bak-before-us-maps-key`) and `bff` was recreated. Verified from the US host: geocode, reverse geocode, Places autocomplete (US) and Places nearby search all succeed.
  `Bhavano-US-Web`: restricted to the Maps JavaScript API, Places API and Places API (New) and to the referrers `https://www.bhavano.com/us/*` and `https://us-origin.bhavano.com/*`; it is the GitHub variable
  `US_NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY`, baked into the web image. Rebuilt (`sha-e88538f2`, `web-us` only) and deployed (`-Services web`): the served `/us/post` page carries the US key and not India's, and from the
  `https://us-origin.bhavano.com` origin the Maps JavaScript API loads and Places autocomplete returns predictions. The in-browser Geocoder is refused, as intended (the key has no Geocoding API; the app
  only uses the map, the marker and the Places Autocomplete widget in the browser, and reverse-geocodes on the server). The full map-picker screen has not been exercised (it sits behind the post flow).
- **Still to do on the hosts:** a dump copy outside the region or account (an S3 bucket needs an
  instance role); the monthly OS-update routine (the DB's public address is for outbound access only). The `bhavano-us`
  CLI profile had a temporary inline policy `bhavano-us-ops` (DLM, SNS, one IAM role) for this; remove it from the IAM user when done.

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
