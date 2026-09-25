# Deployment infra notes

Working notes from setting up production infra (AWS, `ap-south-1` / Mumbai). Not exhaustive —
captures decisions made and the exact commands used so they don't need re-deriving.

## Topology

- `apps/web` (Next.js, public site) + `apps/bff` (NestJS) + `apps/admin` (Next.js, moderation-only,
  `admin.bhavano.com`) — one EC2 `t4g.medium` ("app" instance), containerized via
  `docker-compose.prod.yml` (see root `Dockerfile`s / `docker-compose.prod.yml` / `Caddyfile` /
  `.env.production.example`).
- Postgres — self-hosted on its own EC2 `t4g.medium` ("db" instance), rather than RDS, per current
  cost tradeoff (see below). Not containerized — installed directly on the host.
- Image uploads (`apps/bff/src/uploads/uploads.controller.ts`) go straight to Cloudflare R2
  (S3-compatible API) and are served publicly through a CDN custom domain — see "Photo storage
  (Cloudflare R2 + CDN)" below. Resized `preview`/`full` variants are generated asynchronously by an
  in-process poller (`apps/bff/src/photo-processing/`), not on the upload request itself.

## End-to-end runbook: app instance + db instance

Two separate EC2 instances, `t4g.medium`, Ubuntu 26.04 LTS (arm64), same VPC. Do these roughly in
order — later steps depend on IDs/IPs from earlier ones.

### 0. Create the two security groups first

Console → EC2 → Security Groups → Create security group. Create both as empty shells first, then
add rules once both exist (the DB's inbound rule needs to reference the app SG's ID).

- `bhavano-app-sg`
- `bhavano-db-sg`

Then edit inbound rules:

| Security group | Type | Port | Source |
|---|---|---|---|
| `bhavano-app-sg` | HTTP | 80 | `0.0.0.0/0` |
| `bhavano-app-sg` | HTTPS | 443 | `0.0.0.0/0` |
| `bhavano-app-sg` | SSH | 22 | your IP only |
| `bhavano-db-sg` | PostgreSQL | 5432 | `bhavano-app-sg` (select the security group, **not** a CIDR) |
| `bhavano-db-sg` | SSH | 22 | your IP only |

Referencing the app SG by ID (not the app instance's IP) means this keeps working even if the app
instance is ever replaced/re-launched with a new IP.

### 1. Launch the DB instance

EC2 → Launch instance → Ubuntu Server 26.04 LTS (arm64) → `t4g.medium` → security group
`bhavano-db-sg` → 20-30GB gp3 root volume, no extra file system (see prior notes on why not
Mountpoint-for-S3). Note its **private IPv4 address** once running — you'll need it in step 5.

### 2. Install PostgreSQL 16 on the DB instance

SSH in, then:

```bash
sudo apt update && sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
apt-cache policy postgresql-16
```

If that shows a candidate from `apt.postgresql.org`:

```bash
sudo apt install -y postgresql-16 postgresql-contrib-16
```

**Fallback if the PGDG script doesn't recognize the Ubuntu 26.x codename yet** (possible on a very
new release):
1. Check the distro's own default repo: `apt-cache policy postgresql`. If it's already 16.x or
   newer, skip PGDG and just `sudo apt install postgresql postgresql-contrib`.
2. If the default repo ships something newer (17/18), it's simpler to bump the *local* dev Postgres
   image version to match than to fight an unsupported PGDG repo.

Verify: `psql --version`. Target is 16, to match the local dev Docker image
(`postgis/postgis:16-3.4` in the repo's root `docker-compose.yml`) — same major version avoids
`pg_dump`/restore and extension-availability surprises.

### 3. Create the database + role

```bash
sudo -u postgres psql -c "CREATE USER bhavano WITH PASSWORD 'REPLACE_WITH_A_REAL_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE bhavano OWNER bhavano;"
```

### 4. Open Postgres to the app instance only

Find the config directory (usually `/etc/postgresql/16/main/`):

```bash
sudo -u postgres psql -c "SHOW config_file;"
```

Edit `postgresql.conf` — change:
```
listen_addresses = 'localhost'
```
to:
```
listen_addresses = '*'
```
(the security group from step 0 is what actually restricts who can reach port 5432 — this just
lets Postgres listen on its private network interface, not only loopback.)

Edit `pg_hba.conf`, add a line (use the VPC's CIDR, e.g. `172.31.0.0/16` — check your VPC's actual
CIDR block in the console rather than assuming):
```
host    bhavano    bhavano    172.31.0.0/16    scram-sha-256
```

Restart:
```bash
sudo systemctl restart postgresql
```

### 5. Launch the app instance

EC2 → Launch instance → Ubuntu Server 26.04 LTS (arm64) → `t4g.medium` → security group
`bhavano-app-sg` → **at least 30GB** gp3 root volume, no extra file system. Allocate/associate an
**Elastic IP** so the public address survives a stop/start.

**Learned the hard way:** a 19-20GB root volume ran out of space mid-deploy once `web`+`bff`+`admin`
+`caddy`+`alloy`+`loki`+`grafana` were all running together (that's before ever generating a
dangling image) — see "Resizing the app instance's root volume" below for the recovery, and start
new instances bigger than this to skip that entirely.

### 6. Point DNS at the app instance

`SITE_DOMAIN` / `API_DOMAIN` / `APEX_DOMAIN` / `ADMIN_DOMAIN` records → the app instance's Elastic
IP. Do this now — Caddy needs to complete a Let's Encrypt HTTP challenge on first boot in step 9,
and DNS propagation isn't instant.

**If DNS is managed through Cloudflare (or any other proxying CDN):** every one of these records
must be set to **"DNS only"**, not proxied. A proxied record means Let's Encrypt's ACME challenge —
and ordinary TLS handshakes — hit Cloudflare's edge instead of Caddy directly, which Caddy can't
complete (shows up as a `525` error in the browser, or `NXDOMAIN`/ALPN-negotiation failures in
Caddy's own logs, depending on exactly which record and challenge type is affected). This bit us
for `www`, `api`, and the bare apex domain in turn — check all of them, not just the one that's
currently broken.

`ADMIN_DOMAIN` (e.g. `admin.bhavano.example.com`) serves the moderation-only admin app — don't link
to it from the public site or its sitemap/robots.txt; only people who already know the URL and have
an allowlisted phone/email (`ADMIN_PHONES`/`ADMIN_EMAILS` in `.env`) can actually do anything there.

The bare apex (`APEX_DOMAIN`, e.g. `bhavano.com` with no `www`) doesn't serve the site itself — the
`Caddyfile` 308-redirects it to `SITE_DOMAIN` instead, which is why it needs its own DNS record and
its own "DNS only" toggle, same as the others, even though there's no separate container behind it.

### 7. Install Docker on the app instance

SSH in, then:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER   # then log out/in (or `newgrp docker`) to pick up the group
```

> **Gotcha hit during setup:** `curl -o /etc/apt/keyrings/docker.asc` without `sudo` fails with
> `curl: (23) client returned ERROR on write of 3817 bytes` — `/etc/apt/keyrings/` doesn't exist by
> default on a fresh instance, and writing under `/etc/` needs root either way. The `install -d` +
> `sudo curl` above avoids both problems.

### 8. Get the repo and configure it

`git clone` over `scp`, so future deploys are a `git pull` + rebuild instead of a full re-copy:

```bash
ssh-keygen -t ed25519 -C "bhavano-app-ec2" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub   # add as a read-only Deploy Key on the GitHub repo

git clone git@github.com:<you>/bhavano.git
cd bhavano
cp .env.production.example .env
nano .env
```

Fill in `.env` — `DATABASE_URL` uses the **DB instance's private IP** from step 1 and the password
from step 3:
```
DATABASE_URL="postgresql://bhavano:REPLACE_WITH_A_REAL_PASSWORD@<db-private-ip>:5432/bhavano"
```
Fill in the rest (`SITE_DOMAIN`, `API_DOMAIN`, `ADMIN_DOMAIN`, `NEXTAUTH_SECRET`,
`ADMIN_NEXTAUTH_SECRET`, `AUTH_JWT_SECRET`, `ADMIN_PHONES`/`ADMIN_EMAILS`, `GOOGLE_CLIENT_ID`/
`SECRET`, `R2_*`/`CDN_BASE_URL`, etc.) per the comments in the file. `ADMIN_PHONES`/`ADMIN_EMAILS`
matter before anyone logs in — there's no admin invite flow, a matching phone/email is promoted to
admin automatically the moment it logs in. `R2_*`/`CDN_BASE_URL` matter before anyone posts a
listing with a photo — see "Photo storage (Cloudflare R2 + CDN)" below for how to create them.

### 9. Build and run

Building directly on the arm64 instance avoids any cross-compilation (`buildx`) concerns for
`sharp`'s native binaries:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### 10. Run migrations against the DB instance

The `bff` container has the Prisma CLI available; run migrations through it so `DATABASE_URL` (set
in step 8) is already correct:

```bash
docker compose -f docker-compose.prod.yml exec bff npx prisma migrate deploy
```

### 10b. Seed city/area reference data

`migrate deploy` only applies schema changes — it never runs seeds, so the `City`/`Area` tables
stay empty until this is run at least once (this is why the location picker's "more cities" list
and city switching can come up empty on a fresh prod deploy). Run this once after the first
`migrate deploy`, and again any time `apps/bff/prisma/seedCities.ts`'s city/area list changes:

```bash
docker compose -f docker-compose.prod.yml exec bff npx tsx prisma/seedCities.ts
```

Every write it makes is an idempotent upsert (keyed on the real `name`+`state`/`name`+`cityId`
unique constraints), so it's safe to re-run against prod at any time — running it twice never
creates duplicates. **Don't** run the full `pnpm prisma:seed` (`prisma db seed`) against
production instead — that also seeds ~5 obviously-fake demo listings (a Koramangala apartment, a
PG for women, etc.) under a dedicated "Seed Owner" account, meant for local dev only.

### 11. Verify

```bash
curl -I https://<site-domain>
curl -I https://<api-domain>/listings/sitemap
curl -I https://<admin-domain>/login
```

If step 10's `migrate deploy` succeeded, app→DB connectivity across the two instances is already
proven — no separate check needed.

Future app deploys (pick one):

- **Build on the app EC2** (existing default): `git pull && docker compose -f docker-compose.prod.yml --env-file .env up -d --build` — see also "Building and deploying an individual service" below.
- **Build on your laptop, copy images to EC2** (shorter downtime on the app box — no compile there): see **"Local build → copy images to app EC2"** below.
- New migrations: re-run step 10 after deploying. See the sections below for schema-only updates or single-service deploys.

## Local build → copy images to app EC2

Build `web` / `bff` / `admin` on your machine, ship the images as a tarball, load them on the app
instance, then recreate containers **without** `--build`. The app EC2 only pulls/restarts — no
`next build` / Nest compile on the live box.

### Why this exists

- Step 9 / `up -d --build` compiles on the **same** 2 vCPUs that serve production traffic.
- Shipping pre-built images keeps that CPU free and keeps the cutover window to roughly
  `docker load` (ahead of time) + container recreate (seconds).

### Hard requirement: match the app instance architecture

Prod app EC2 is **`t4g.medium` = `linux/arm64`**. Images built for `amd64` (most Windows PCs,
Intel Macs) will **not** run there.

| Your machine | What to do |
|---|---|
| Apple Silicon Mac (`arm64`) | Native `docker compose build` is fine |
| Windows / Intel Mac (`amd64`) | Build with `--platform linux/arm64` (Buildx; slower under emulation) — see **Windows (amd64 → arm64)** below |
| Unsure | `uname -m` on EC2 (`aarch64`) and locally — they must match, or use `--platform linux/arm64` |

### Automated script (recommended)

From the repo root, after creating `.env.prod.build` and setting SSH details:

**Windows (PowerShell):**

```powershell
$env:BHAVANO_EC2_HOST = "YOUR_APP_ELASTIC_IP"
$env:BHAVANO_EC2_SSH_KEY = "$env:USERPROFILE\.ssh\bhavano-app.pem"
# Optional: $env:BHAVANO_ENV_FILE = ".env.prod.build"

.\scripts\deploy-local-to-ec2.ps1                  # web + bff + admin
.\scripts\deploy-local-to-ec2.ps1 -Services bff    # one service
.\scripts\deploy-local-to-ec2.ps1 -BuildOnly       # build/verify arch only
.\scripts\deploy-local-to-ec2.ps1 -SkipPull        # use current checkout
.\scripts\deploy-local-to-ec2.ps1 -SkipMigrate
```

**macOS / Linux / WSL:**

```bash
chmod +x scripts/deploy-local-to-ec2.sh
export BHAVANO_EC2_HOST=YOUR_APP_ELASTIC_IP
export BHAVANO_EC2_SSH_KEY=~/.ssh/bhavano-app.pem

./scripts/deploy-local-to-ec2.sh
./scripts/deploy-local-to-ec2.sh bff
./scripts/deploy-local-to-ec2.sh --build-only
```

The script: `git pull` → Buildx `linux/arm64` compose build → verify architecture →
`docker save` → `scp` → on EC2 `git pull` + `docker load` + `compose up -d --no-build` →
`prisma migrate deploy` (when `bff` is included).

Manual steps below remain if you prefer to run each command yourself.

### Windows (amd64 → `linux/arm64`)

Windows PCs almost always build **amd64** images by default. Prod is **arm64**, so you must
cross-build. Docker Desktop does this via Buildx + QEMU (emulation) — expect **slower** builds
than on an Apple Silicon Mac or on the EC2 itself.

#### One-time setup

1. Install **Docker Desktop for Windows** and enable the **WSL 2** backend (Settings → General).
2. Settings → **Builders** / Features: ensure containerd / Buildx are available (current Desktop
   includes `docker buildx` by default).
3. In PowerShell:

```powershell
docker version
docker buildx version

# Create a builder that can emit arm64 (once)
docker buildx create --name armbuilder --driver docker-container --use
docker buildx inspect --bootstrap

# Confirm arm64 is listed under "Platforms"
docker buildx ls
```

You should see `linux/arm64` (among others) for `armbuilder`.

4. From the repo root, prepare build env (same as macOS — `NEXT_PUBLIC_*` must match prod):

```powershell
cd D:\Repo\bhavano
copy .env.production.example .env.prod.build
# Edit .env.prod.build — set NEXT_PUBLIC_BFF_URL, NEXT_PUBLIC_SITE_URL,
# NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY to production values
```

#### Build (PowerShell)

```powershell
cd D:\Repo\bhavano
$TAG = Get-Date -Format "yyyyMMddHHmmss"
# or: $TAG = (git rev-parse --short HEAD)

$env:DOCKER_DEFAULT_PLATFORM = "linux/arm64"
docker buildx use armbuilder

docker compose -f docker-compose.prod.yml --env-file .env.prod.build build web bff admin

Remove-Item Env:DOCKER_DEFAULT_PLATFORM
```

If Compose still produces amd64 (check with the inspect command below), build each image
explicitly with Buildx `--load` (loads into local Docker so `docker save` works):

```powershell
# Example for bff (no NEXT_PUBLIC args). Repeat pattern for web/admin with --build-arg flags
# matching docker-compose.prod.yml web.build.args / admin.build.args.

docker buildx build --platform linux/arm64 `
  -f apps/bff/Dockerfile `
  -t bhavano-bff:$TAG `
  --load .

docker buildx build --platform linux/arm64 `
  -f apps/web/Dockerfile `
  --build-arg NEXT_PUBLIC_BFF_URL=$env:NEXT_PUBLIC_BFF_URL `
  --build-arg NEXT_PUBLIC_SITE_URL=$env:NEXT_PUBLIC_SITE_URL `
  --build-arg NEXT_PUBLIC_GTM_ID=$env:NEXT_PUBLIC_GTM_ID `
  --build-arg NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY=$env:NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY `
  -t bhavano-web:$TAG `
  --load .
# (load those values from .env.prod.build first, or pass literals)

docker buildx build --platform linux/arm64 `
  -f apps/admin/Dockerfile `
  --build-arg NEXT_PUBLIC_BFF_URL=$env:NEXT_PUBLIC_BFF_URL `
  --build-arg NEXT_PUBLIC_SITE_URL=$env:NEXT_PUBLIC_SITE_URL `
  --build-arg NEXT_PUBLIC_GTM_ID=$env:NEXT_PUBLIC_GTM_ID `
  -t bhavano-admin:$TAG `
  --load .
```

After a Compose build, retag whatever names Desktop created:

```powershell
docker images
docker tag bhavano-web:latest  bhavano-web:$TAG
docker tag bhavano-bff:latest  bhavano-bff:$TAG
docker tag bhavano-admin:latest bhavano-admin:$TAG
```

#### Verify the image is really arm64 (do this before scp)

```powershell
docker image inspect bhavano-bff:$TAG --format "{{.Os}}/{{.Architecture}}"
# Expect: linux/arm64
# If you see linux/amd64, do not deploy — rebuild with --platform linux/arm64
```

#### Save and copy from Windows

Use OpenSSH client (Windows optional feature) or WSL:

```powershell
docker save bhavano-web:$TAG bhavano-bff:$TAG bhavano-admin:$TAG -o bhavano-images-$TAG.tar
# gzip if you have it; otherwise scp the .tar (larger)
# with tar+gzip via WSL:
wsl gzip -c bhavano-images-$TAG.tar > bhavano-images-$TAG.tar.gz

scp bhavano-images-$TAG.tar.gz ubuntu@APP_EC2_HOST`:~/
```

Then continue from **§3 On the app EC2: load before cutting over** below (same as macOS).

#### Windows gotchas

- **Emulation is slow** — first full `web`+`admin` arm64 build can take a long time. Prefer
  building on the app EC2 or an arm64 machine if this becomes painful.
- **`--load` only supports one platform** — never omit `--platform linux/arm64` when using
  `buildx build --load`.
- **WSL path vs `D:\Repo`** — if builds fail oddly under Desktop, run the same commands inside
  **WSL2 Ubuntu** from `/mnt/d/Repo/bhavano` (often more reliable for Buildx).
- **Do not use Hyper-V-only / old Desktop without WSL2** for this — stick to WSL2 backend.

### 0. One-time: local Docker + prod build args

You need Docker Desktop (or Engine) and a checkout of this repo. For **`web` / `admin`**,
`NEXT_PUBLIC_*` values are baked in at **image build** (same rule as in "SEO / GTM" above). Use a
local env file that matches production for those args (never commit secrets):

```bash
# From the repo root on your laptop
cp .env.production.example .env.prod.build   # or scp the real .env from the app EC2 and redact
# Fill at least: NEXT_PUBLIC_* used by web/admin build args in docker-compose.prod.yml
```

Confirm Buildx can target arm64 (needed on amd64 hosts):

```bash
docker buildx version
docker buildx create --name armbuilder --use   # once, if you don't already have a builder
docker buildx inspect --bootstrap
```

### 1. Build on your laptop

Pick a tag you can recognize later (date or short git SHA):

```bash
TAG=$(date -u +%Y%m%d%H%M%S)   # or: TAG=$(git rev-parse --short HEAD)
export COMPOSE_DOCKER_CLI_BUILD=1

# Apple Silicon Mac (native arm64) — matches t4g:
docker compose -f docker-compose.prod.yml --env-file .env.prod.build build web bff admin

# Windows / Intel Mac — force arm64 so the image runs on t4g (see Windows section above for PowerShell):
export DOCKER_DEFAULT_PLATFORM=linux/arm64
docker compose -f docker-compose.prod.yml --env-file .env.prod.build build web bff admin
unset DOCKER_DEFAULT_PLATFORM
```

Compose tags images from the project directory name by default, typically:

- `bhavano-web` (or `bhavano_web`)
- `bhavano-bff`
- `bhavano-admin`

Check with `docker images | grep bhavano`, then retag to a versioned name:

```bash
# Adjust names if `docker images` shows underscores instead of hyphens
docker tag bhavano-web:latest  bhavano-web:$TAG
docker tag bhavano-bff:latest  bhavano-bff:$TAG
docker tag bhavano-admin:latest bhavano-admin:$TAG
```

On Windows / Intel hosts, use the **Windows (amd64 → linux/arm64)** section above (PowerShell +
`docker buildx build --platform linux/arm64 --load`) and always verify
`docker image inspect … --format "{{.Os}}/{{.Architecture}}"` shows `linux/arm64` before `scp`.

### 2. Save and copy to the app EC2

```bash
docker save bhavano-web:$TAG bhavano-bff:$TAG bhavano-admin:$TAG | gzip > bhavano-images-$TAG.tar.gz

# Replace with your app Elastic IP / SSH user
scp bhavano-images-$TAG.tar.gz ubuntu@APP_EC2_HOST:~/
```

Large first transfer is normal (full images). Later deploys are similar unless you use a registry
(ECR/Hub) for layer reuse — this path always sends a full tarball.

### 3. On the app EC2: load **before** cutting over

SSH in, load while the old containers are still serving traffic:

```bash
cd ~/bhavano
gunzip -c ~/bhavano-images-$TAG.tar.gz | docker load
docker images | grep bhavano
```

Retag to the names Compose expects for this checkout (must match `docker images` naming on this
host after a normal compose build — usually `<folder>-<service>`):

```bash
# Example — confirm with `docker images` after a previous compose build on this host
docker tag bhavano-web:$TAG   bhavano-web:latest
docker tag bhavano-bff:$TAG   bhavano-bff:latest
docker tag bhavano-admin:$TAG bhavano-admin:latest
```

Also keep the repo checkout in sync (migrations, `Caddyfile`, compose file) even when images are
pre-built:

```bash
git pull
```

### 4. Recreate containers without rebuilding

`--no-build` is the important flag — otherwise Compose will compile on the EC2 again:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-build web bff admin
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 bff
```

If Compose still tries to build (image name mismatch), either retag to the exact local image name
Compose uses, or temporarily set `image: bhavano-web:latest` (etc.) on those services in
`docker-compose.prod.yml` so `up` binds to the loaded tags. Prefer matching Compose’s default
image names so the file stays unchanged.

### 5. Migrations (if this release needs them)

Same as step 10 — **after** the new `bff` container is up:

```bash
docker compose -f docker-compose.prod.yml exec bff npx prisma migrate deploy
```

### 6. Verify + clean up

```bash
curl -I https://www.bhavano.com
curl -I https://api.bhavano.com/health
# optional: remove the tarball and old dangling images when disk is tight
rm ~/bhavano-images-$TAG.tar.gz
docker image prune -f
```

### Partial deploys

Same idea for one service only — save/load a single image, then:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-build bff
```

### Compared to other options in this doc

| Method | Where CPU builds | Downtime / impact |
|---|---|---|
| `up -d --build` on app EC2 | App instance | Longer; shares CPU with live traffic |
| Remote Buildx on DB instance (section below) | DB instance | App only restarts; DB CPU spikes during build |
| **Local build + `scp` (this section)** | Your laptop | App only `load` + recreate; transfer cost is bandwidth |

Do **not** run the production app containers on the DB instance. Postgres stays on the DB host;
only pre-built app images land on the app host.

## Updating the database schema (Prisma migrations)

**Creating a migration during development** (on your own machine, with a real interactive
terminal): edit `apps/bff/prisma/schema.prisma`, then from `apps/bff`:

```bash
npx prisma migrate dev --name describe_the_change
```

This generates the SQL under `apps/bff/prisma/migrations/<timestamp>_describe_the_change/`,
applies it to your local dev database, and regenerates the Prisma client. Commit the new migration
folder — production only ever *applies* migrations that already exist in the repo, it never
generates them.

**Gotcha hit repeatedly in this repo: `prisma migrate dev` refuses to run in a non-interactive
shell** (CI, an agent, anything without a real TTY) — it fails with `Prisma Migrate has detected
that the environment is non-interactive, which is not supported`. Workaround, from `apps/bff`:

```bash
# 1. Generate the SQL diff between the live dev DB and the updated schema
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > /tmp/migration.sql

# 2. Create the migration folder yourself (match the existing timestamp_name format)
mkdir -p "prisma/migrations/$(date -u +%Y%m%d%H%M%S)_describe_the_change"
mv /tmp/migration.sql "prisma/migrations/<the folder you just made>/migration.sql"

# 3. Apply it (this command IS non-interactive-safe, unlike `migrate dev`)
npx prisma migrate deploy
npx prisma generate
```

Sanity-check the generated SQL before applying it — `migrate diff` is reliable for the additive
changes (new column/table/index) this project has needed so far, but always read it once.

**Applying migrations in production** (step 10 above, repeated whenever the schema changes):

```bash
docker compose -f docker-compose.prod.yml exec bff npx prisma migrate deploy
```

This only applies migration folders that exist in the image but haven't been recorded as applied
yet (Prisma tracks this in a `_prisma_migrations` table) — safe to re-run, a no-op if nothing's
pending. Always deploy the new code (`up -d --build bff`, see below) *before* or *together with*
running this, never after — a migration that adds a column a new code path expects is harmless to
apply early, but new code expecting a column an old, still-running container's Prisma Client
doesn't know about will error.

**Rolling back:** Prisma has no auto-generated down-migration. Reverting a bad migration means
either writing a new forward migration that undoes it, or restoring the database from a backup —
there's no `prisma migrate down`.

## Photo storage (Cloudflare R2 + CDN)

Listing photos are stored in a Cloudflare R2 bucket (S3-compatible) and served publicly through a
CDN custom domain bound to that bucket — Cloudflare's edge serves these directly, Caddy/the app
servers are never involved in serving a photo.

**One-time setup (Cloudflare dashboard):**
1. **R2 → Create bucket** (e.g. `bhavano-photos`). Note the account id shown on the R2 overview page
   → `R2_ACCOUNT_ID`.
2. **R2 → Manage API tokens → Create API token** with read/write access scoped to that bucket →
   the generated Access Key ID / Secret Access Key become `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
   `R2_BUCKET` is the bucket name from step 1.
3. **Bucket → Settings → Custom Domains → Connect Domain** — bind e.g. `cdn.bhavano.com`. Cloudflare
   creates the DNS record and TLS cert automatically since the domain's zone is already on
   Cloudflare; no Caddy config needed for this domain (same "DNS-only vs proxied" consideration as
   `admin.bhavano.com`, etc. doesn't apply here — R2 custom domains are inherently Cloudflare-edge,
   not a separate origin). `CDN_BASE_URL=https://cdn.bhavano.com` (no trailing slash).
4. Add all five vars to `.env` on the app instance, then `docker compose -f docker-compose.prod.yml
   up -d bff` (recreate — env changes need a new container, not just an edited file).

**Async resizing:** `apps/bff/src/photo-processing/` polls a `PhotoVariantJob` DB table every ~3s
inside the running `bff` container — no separate worker process/deploy step. If photos aren't
appearing after a few seconds, `docker compose -f docker-compose.prod.yml logs bff | grep -i photo`
and check the `PhotoVariantJob.status`/`error` columns for stuck/failed rows.

## Running the Google Places / Apify scraper on the app instance

`get_pg_coworking_leads.py` (Google Places API) and `get_pg_coworking_leads_apify.py` (Apify's
`compass/crawler-google-places` Actor — a separate script, see its own module docstring for why)
used to be run from a developer's own machine. For the admin "Create listing directly from
OutreachContact" action to see downloaded photos (see
[docs/plans/outreach-direct-listing-creation.md](./plans/outreach-direct-listing-creation.md)),
run either **on the app instance itself** instead — same script, same command, just over SSH
there:

```bash
# On the app instance, from the repo checkout (~/bhavano)
.venv/bin/python get_pg_coworking_leads.py --cities "Bengaluru,Pune" --bff-url http://localhost:4000
.venv/bin/python get_pg_coworking_leads_apify.py --cities "Bengaluru,Pune" --bff-url http://localhost:4000
```

`--photos-dir` defaults to `./leads_output`, which from `~/bhavano` lands at
`~/bhavano/leads_output/photos/` — exactly what `docker-compose.prod.yml` bind-mounts read-only
into the `bff` container at `SCRAPED_PHOTOS_DIR` (`/app/leads_output/photos`). Nothing extra to
configure beyond that mount already being in place; a contact with no matching local files simply
isn't offered the "Create listing" action, same as any other missing-required-data case.

**Cleanup after listings exist:** once `createListingFromContact` has uploaded photos to R2, the
local JPGs for that `googlePlaceId` are unused. From `~/bhavano` on the app instance:

```bash
chmod +x scripts/cleanup-scraped-photos-for-listed-contacts.sh
./scripts/cleanup-scraped-photos-for-listed-contacts.sh                 # dry-run, PG only
./scripts/cleanup-scraped-photos-for-listed-contacts.sh --execute     # delete
# optional: --category coworking | all
```

Only contacts that already have a `Listing` (`claimContactId`) are considered; contacts still
waiting for "Create listing" keep their files.

**Python deps — no `requirements.txt` in this repo, so a one-time local venv on the app instance
is the setup** (the base AMI ships with no system `pip` at all, so `pip install` alone fails until
the venv module itself is installed):

```bash
sudo apt-get install -y python3.14-venv   # match whatever `python3 --version` reports
cd ~/bhavano
python3 -m venv .venv
.venv/bin/pip install requests python-dotenv
```

Both scripts need `AUTH_JWT_SECRET`/`GOOGLE_MAPS_SERVER_KEY` (Google) or `APIFY_API_TOKEN`
(Apify) in the app instance's own root `.env` (already there for the running `bff` container —
the script reads it directly via `load_dotenv`, see its own module docstring). No
admin-triggered scraping UI exists — this is still a manual, deliberate SSH step.

## SEO: Search Console verification + analytics

**Google Search Console** — verify via a DNS TXT record (not a meta tag), so the whole domain
verifies at once: Search Console → Add property → Domain → copy the `google-site-verification=...`
TXT value → add it as a TXT record on the bare `bhavano.com` zone in Cloudflare DNS (a TXT record
doesn't need "DNS only" vs "proxied" — that distinction only matters for A/CNAME records serving
traffic). Once verified, submit `https://bhavano.com/sitemap.xml` from the Sitemaps page.

**Google Tag Manager** — set `NEXT_PUBLIC_GTM_ID` in `.env` to the container ID (`GTM-XXXXXXX`) from
tagmanager.google.com, then `docker compose -f docker-compose.prod.yml up -d --build web` (rebuild —
see below). Leave it blank to skip loading GTM entirely (the default locally). Two events are already
pushed to `dataLayer` for GTM to build Google Ads conversion triggers on: `post_ad_success` (a listing
was just posted) and `contact_owner` (a buyer started a conversation with a seller) — no code change
needed to wire up a conversion once GTM is live, just a trigger + tag in the GTM dashboard matching
those event names.

**Google Ads** — there is no separate Ads env var. The Ads conversion ID (`AW-18351718445`) is
entered into tags **inside the GTM container**, not into the app, so `NEXT_PUBLIC_GTM_ID` above is
the only tag variable. A direct `gtag.js` tag was briefly shipped instead and then removed — see
[consolidate-analytics-and-ads-on-gtm.md](./plans/consolidate-analytics-and-ads-on-gtm.md) for why,
and [google-ads-conversion-setup.md](./google-ads-conversion-setup.md) for the dashboard runbook.

**`NEXT_PUBLIC_*` on `web` (Maps, BFF URL, site URL, GTM)** — values used in the browser bundle
(e.g. `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY` for the post-ad map) are baked in at **`docker build`**, not
when you only restart the running container. `docker-compose.prod.yml` passes them as `web.build.args`;
after adding or changing any of them in `.env`, run `docker compose -f docker-compose.prod.yml up -d
--build web` so `next build` inside the image sees the new values. Runtime `environment:` alone is
not enough for those client-inlined vars.

## Building and deploying an individual service

`docker-compose.prod.yml` has seven services: `web`, `bff`, `admin`, `caddy` (the stock
`caddy:2-alpine` image, not built from source), and `alloy`/`loki`/`grafana` (logging — see below,
also stock upstream images). Rebuilding "everything" (`up -d --build` with no service name) is
correct after a `git pull` that touched multiple apps, but for a change scoped to one app, rebuild
just that one — faster, and it doesn't bounce the others' connections:

```bash
# Rebuild and restart only the bff container (e.g. after a BFF-only code change or migration)
docker compose -f docker-compose.prod.yml up -d --build bff

# Same for web or admin
docker compose -f docker-compose.prod.yml up -d --build web
docker compose -f docker-compose.prod.yml up -d --build admin
```

- `up -d --build <service>` rebuilds that service's image and recreates+restarts just that
  container; the others keep running untouched.
- `docker compose -f docker-compose.prod.yml build <service>` (no `up`) builds the image without
  restarting anything yet — useful to pre-build during a maintenance window before cutting over.
- Turbo's remote-cache-less local build still only recompiles what changed inside that service's
  `turbo prune` scope (see each app's `Dockerfile`), so `apps/types` changes get picked up by
  whichever app(s) you rebuild, but only those apps' images get regenerated.
- **`caddy` almost never needs `--build`** — it's an unmodified upstream image. If you only changed
  the `Caddyfile` itself (e.g. adding a domain), `docker compose -f docker-compose.prod.yml restart
  caddy` is enough (it's bind-mounted, so a restart re-reads it) — no rebuild.
- Tail logs for just the one service you touched: `docker compose -f docker-compose.prod.yml logs
  -f bff` (swap in `web`/`admin`/`caddy` as needed) — much less noise than `logs -f` across all four.

## Speeding up deploys: build on the DB instance's spare CPU (remote Buildx builder)

Building three Next.js/NestJS images from scratch is the actual CPU cost behind a slow deploy, not
runtime traffic — the app instance does that work on the same 2 vCPUs currently serving live
requests. If the DB instance is comfortably below its own CPU/IO limits, it's a better place for
that build work than adding new inbound ports for a live *service* there (moving `admin` or the
logging stack to the DB instance would mean new security-group rules, a second TLS/reverse-proxy
setup, and a container permanently sharing runtime CPU with Postgres). Docker's `buildx` remote
builder offloads *build* CPU only, over SSH — nothing about where the running containers live
changes, and nothing runs on the DB instance except during a build.

Both instances are the same `t4g.medium`/arm64, so this is a same-architecture remote build, not
cross-compilation — no QEMU emulation, no new `sharp`/native-binary concerns beyond what already
applies building on the app instance today (see step 9's note above).

**Trade-off to accept going in:** the DB instance's CPU (and some memory/disk I/O for build cache
layers) gets used for the few minutes a build takes. It's idle *right now*, but that's not the same
as idle during your busiest hour — if a deploy ever lands during peak traffic, Postgres is
contending with a `next build` on the same box. Worth watching instance CPU graphs (or
`pg_stat_activity`) the first few times this runs, and preferring a quieter window for deploys until
you've seen it under real load.

### 1. Open SSH from the app instance to the DB instance

`bhavano-db-sg` currently only allows SSH from your own IP (see the topology table above). Add a
second inbound rule so the app instance can reach it too, referencing the SG rather than an IP, same
reasoning as the Postgres rule:

| Security group | Type | Port | Source |
|---|---|---|---|
| `bhavano-db-sg` | SSH | 22 | `bhavano-app-sg` |

### 2. Create a restricted user on the DB instance for this — not `ubuntu`

The app instance SSHing in for builds shouldn't come with the `sudo` access your own login has — if
the app instance is ever compromised, that shouldn't hand over the DB instance too. On the DB
instance:

```bash
sudo adduser --disabled-password --gecos "" docker-builder
sudo usermod -aG docker docker-builder   # needs Docker installed first — step 3 below
sudo mkdir -p /home/docker-builder/.ssh
sudo chmod 700 /home/docker-builder/.ssh
```

`docker-builder` is in the `docker` group and nothing else — no `sudo`, so it can start build
containers but can't touch Postgres, its data directory, or anything else on the box.

### 3. Install Docker on the DB instance

Same steps as app-instance step 7 above — Docker isn't there yet, since Postgres runs directly on
the host rather than containerized:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

(No need to add your own login user to the `docker` group here — only `docker-builder` needs it.)

### 4. Generate a dedicated keypair on the app instance and authorize it

Don't reuse the app instance's existing GitHub deploy key (`~/.ssh/id_ed25519` from step 8) — a
separate key keeps "can pull from GitHub" and "can build on the DB instance" as independent,
individually revocable grants:

```bash
# On the app instance
ssh-keygen -t ed25519 -C "app-to-db-builder" -f ~/.ssh/db_builder -N ""
cat ~/.ssh/db_builder.pub
```

Paste that public key into `/home/docker-builder/.ssh/authorized_keys` on the **DB instance**, then
back on the DB instance:

```bash
sudo chown -R docker-builder:docker-builder /home/docker-builder/.ssh
sudo chmod 600 /home/docker-builder/.ssh/authorized_keys
```

From the app instance, confirm it connects non-interactively before wiring it into buildx:

```bash
ssh -i ~/.ssh/db_builder docker-builder@<db-private-ip> docker version
```

### 5. Create the remote builder and switch to it

On the app instance:

```bash
docker buildx create --name db-builder --driver docker-container \
  ssh://docker-builder@<db-private-ip>
docker buildx use db-builder
docker buildx inspect --bootstrap   # first run pulls the buildkit image onto the DB instance
```

`docker buildx use` sets this as the default builder for the shell/user — `docker compose build`
picks it up automatically from here on, no compose file changes needed. Buildx's Compose
integration loads the finished image layers back onto the app instance for you; no registry or
`--push` required for this to work.

### 6. Deploy as usual

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Compilation now happens on the DB instance's CPU; only the finished layers come back over the
private VPC link, and `up -d` still recreates/restarts the containers on the app instance exactly
as before.

**To go back to building locally** (e.g. to rule this out if something looks wrong):
```bash
docker buildx use default
```

## Cleaning up old Docker build artifacts

Every `--build` leaves the previous image's layers behind as dangling (`<none>`) images once the
new one replaces it, and BuildKit's cache mounts (the `pnpm-store`/`turbo-cache`/`next-cache-*`
caches baked into the Dockerfiles, plus the DB instance's own builder cache if using the remote
builder above) grow without bound — none of this is reclaimed automatically. Worth checking
periodically, on whichever instance is actually doing the building:

```bash
df -h /                      # confirm there's an actual problem before reclaiming anything
docker system df             # breakdown of what Docker is holding — images/containers/cache
```

**Safe, routine cleanup** — dangling images plus build cache older than a week; never removes an
image or volume something running still depends on:
```bash
docker image prune -f
docker builder prune -f --filter "until=168h"
```

**If using the remote builder (DB instance):** its cache lives inside the `db-builder` builder's
own container, not the local `docker builder prune` above — clear it separately, from the app
instance:
```bash
docker buildx prune -f --builder db-builder
```

**Don't run `docker system prune -a` (or `-a --volumes`) on either instance without checking
first.** `-a` removes every image not currently referenced by a running container — on the app
instance that's usually just the previous `web`/`bff`/`admin` image, fine to lose, but you're also
throwing away the layer cache that made the *next* build fast, trading disk space back for build
time. `--volumes` additionally removes unused named volumes — run `docker volume ls` first so
nothing unexpected gets swept up. Never run either casually on the DB instance; confirm `docker ps`
first, since that box's only job is the builder container.

**If `docker system df` / `docker builder prune` / `docker image prune` all report 0B reclaimed
but `df -h` still shows the disk nearly full, don't trust those numbers — verify directly.** This
app instance runs Docker with the containerd image store (`docker info | grep -i "driver-type"`
shows `io.containerd.snapshotter.v1` rather than classic `overlay2`), and under that mode the
prune commands' own bookkeeping doesn't always reconcile with what's actually on disk — every
prune command can genuinely return `0B` while real usage sits at 90%+. Skip straight to checking
the filesystem itself:
```bash
docker info 2>/dev/null | grep -i "root dir"     # confirms /var/lib/docker vs elsewhere
sudo du -xh / 2>/dev/null | sort -rh | head -30  # -x stays on this filesystem, doesn't cross into /boot
docker images -a                                  # newer CLI table shows an explicit "U" (in use) column per image
```
If every image shown is genuinely `U` (in use) by a running container, there's nothing left to
safely prune — the disk is just full of real, currently-needed data, not cruft. At that point the
fix isn't a better prune command, it's more disk — see the next section.

## Resizing the app instance's root volume

For when cleanup genuinely won't free enough — every image is legitimately in use, and the disk is
just too small for what's actually running. This is an online resize; no stop, no reboot, no
downtime for the running containers.

### 1. Check the current layout first

```bash
lsblk
df -hT /
```
Confirms which disk/partition `/` actually lives on (on this instance: disk `nvme0n1`, partition 1
→ device `/dev/nvme0n1p1`, filesystem `ext4`) — don't assume these names without checking, they're
not the same on every instance type.

### 2. Grow the EBS volume itself

AWS Console → EC2 → Volumes → find the app instance's root volume → **Actions → Modify volume** →
increase the size (e.g. 20GB → 40GB) → confirm. The volume state moves through
`modifying` → `optimizing` (a background performance-tuning pass that can take hours) →
`completed` — **you don't need to wait for `completed`**; the new size is usable as soon as the
console shows the bigger number, "optimizing" doesn't block anything.

### 3. Extend the partition, then the filesystem, on the instance

```bash
sudo growpart /dev/nvme0n1 1      # extend partition 1 to fill the newly-grown disk
sudo resize2fs /dev/nvme0n1p1     # extend the ext4 filesystem to fill the now-larger partition
df -h                              # confirm `/` now shows the new size
```
(If `df -hT /` in step 1 showed `xfs` instead of `ext4`, the last command is `sudo xfs_growfs /`
instead of `resize2fs`.) Both commands are safe to run against the live, mounted root filesystem —
no unmounting, no downtime for the containers already running.

## Logging & observability (Loki + Grafana)

Every BFF request/response gets a structured JSON log line (method, path, status, duration,
userId, ip, user-agent, and an explicit `login`/`logout` event pair bounding each user's session) —
written asynchronously to a rotating file, shipped by Grafana Alloy into Loki, searchable/filterable
in Grafana at its own subdomain. Full design in `docs/plans/bff-loki-grafana-logging.md`. Scoped to
the BFF only — `web`/`admin` have no equivalent request logging.

**One-time setup:**
1. Add `LOGS_DOMAIN` (DNS A record pointed at the app instance, same as the other three domains)
   and `GRAFANA_ADMIN_PASSWORD` (a long random string) to `.env` on the app instance.
2. `docker compose -f docker-compose.prod.yml up -d --build` (or just `alloy loki grafana bff` if
   the other services are already current) — this also picks up the `bff_logs` volume the `bff`
   service now mounts.
3. Visit `https://{LOGS_DOMAIN}`, log in as `admin` / `GRAFANA_ADMIN_PASSWORD`. The Loki datasource
   and a starter "BFF Overview" dashboard are both auto-provisioned from
   `observability/grafana/provisioning/` — nothing to click-ops here.
4. **Pin image versions before relying on this.** `docker-compose.prod.yml` currently pins
   `grafana/alloy`, `grafana/loki`, `grafana/grafana` to `:latest` — fine to get started, but
   `:latest` can change under you on a future `--build`. Check
   [hub.docker.com](https://hub.docker.com) for the current stable tags, pin them explicitly, and
   confirm the tag publishes a `linux/arm64` image (the app instance is `t4g.medium`/arm64) before
   using it in anything you depend on.

**Everyday use:**
- Grafana → Explore, filter by user: `{service="bff"} | json | userId="<uuid>"`, sorted by time —
  bounded by that user's `event="login"` and `event="logout"` log lines.
- Errors only: `{service="bff", level="error"}`. The provisioned dashboard's "Recent errors" panel
  is the same query, always visible without typing anything.
- `docker compose -f docker-compose.prod.yml logs alloy` if log lines aren't showing up in
  Grafana — confirms Alloy is actually tailing/shipping (no scrape/parse errors).
- All timestamps — pino's own log lines and Grafana's display — are IST (`Asia/Kolkata`), not UTC.

## Postgres backups (nightly dump → Finfolia EC2)

Self-hosted Postgres on the Bhavano DB EC2 has **no** RDS-style automated backups. Production
uses a **full** nightly `pg_dump -Fc` (not incremental) copied off-box to the Finfolia EC2, with
a 3-day retention. Optional second layer: daily **EBS snapshots** of the DB volume in AWS (not
yet required for the dump path to work). Design notes: `docs/plans/postgres-backup-finfolia.md`.

**Do not** install Postgres on Finfolia or run a hot standby there — only store dump **files**.

### Topology (as deployed)

| Role | Host | Notes |
|---|---|---|
| Bhavano DB (runs dump) | private `172.31.18.137` (jump via app `13.205.0.54`) | arm64; Postgres 16 |
| Finfolia (stores dumps) | `13.127.83.62` / private `172.31.10.110` | amd64; files only |
| App | `13.205.0.54` / `172.31.17.141` | not involved in dumps |

| Path | Where | Purpose |
|---|---|---|
| `/var/backups/bhavano/` | **Finfolia** | Off-box dumps (last **3** nights). Mode `700`, owner `bhavano-backup` — use `sudo ls` |
| `/var/backups/bhavano-local/` | **Bhavano DB** | Staging; keeps newest dump only after upload |
| `/root/.ssh/finfolia_backup` | **Bhavano DB** | Private key used by the dump script to `scp` |
| Laptop copy (optional) | `~/.ssh/bhavano-db-finfolia_backup` | Recovery copy of that private key |

SSH for dumps uses the **private** IP `bhavano-backup@172.31.10.110` (Finfolia SG must allow SSH
from the Bhavano DB security group / private IP).

RPO ≈ 24 hours. RTO = time to restore a dump (or an EBS snapshot).

### Users and SSH permissions

#### Linux users

| Host | User | Purpose | Login / privileges |
|---|---|---|---|
| Finfolia | `ubuntu` | Human admin (your AWS key pair) | SSH with `Jay_AWS_KeyPair_Mumbai.pem` (or whatever key is on the instance). Has `sudo`. **Cannot** read `/var/backups/bhavano` without `sudo` (dir is `700` / `bhavano-backup`). |
| Finfolia | `bhavano-backup` | Machine account that owns dump files | **No password** (`--disabled-password`). SSH only via the dedicated pubkey in `~/.ssh/authorized_keys`. **No sudo.** Home: `/home/bhavano-backup`. Owns `/var/backups/bhavano`. |
| Bhavano DB | `ubuntu` | Human admin (same AWS key; usually via app jump host) | SSH + `sudo`. Runs setup; the dump **timer** runs as root via systemd. |
| Bhavano DB | `postgres` | OS user for peer-auth dumps | Used only as `sudo -u postgres pg_dump …`. Not used for SSH to Finfolia. |
| Bhavano DB | `root` | Owns dump script, SSH private key, staging dir | systemd `bhavano-pg-dump.service` runs as root; `scp`/`ssh` use `/root/.ssh/finfolia_backup`. |

Check users on a host:

```bash
getent passwd | awk -F: '$3 >= 1000 { print $1, $3, $6 }'
id bhavano-backup    # Finfolia
id ubuntu
```

#### SSH keypair (DB → Finfolia only)

| File | Location | Mode | Who uses it |
|---|---|---|---|
| `/root/.ssh/finfolia_backup` | Bhavano DB | `600`, root | Private key — dump script / `scp` to Finfolia |
| `/root/.ssh/finfolia_backup.pub` | Bhavano DB | `644` | Public key — copied into Finfolia `authorized_keys` |
| `/home/bhavano-backup/.ssh/authorized_keys` | Finfolia | `600`, owner `bhavano-backup` | Must contain **only** that pubkey (comment `bhavano-db-to-finfolia-backup`) |
| `/home/bhavano-backup/.ssh/` | Finfolia | `700`, owner `bhavano-backup` | SSH dir for the backup user |
| `~/.ssh/bhavano-db-finfolia_backup` (+ `.pub`) | Operator laptop (optional) | private key readable only by you | Recovery copy of the same private key — **not** used by the nightly job |

This key is **separate** from:

- Your AWS instance `.pem` (`ubuntu@…` admin login)
- The app instance GitHub deploy key (`~/.ssh/id_ed25519` on the app box)

Do **not** reuse those for Finfolia backup SSH. If the private key is ever exposed, rotate: regenerate on the DB, replace Finfolia `authorized_keys`, update the laptop copy.

Test (from Bhavano DB as root):

```bash
sudo ssh -i /root/.ssh/finfolia_backup -o IdentitiesOnly=yes -o BatchMode=yes \
  bhavano-backup@172.31.10.110 'whoami; ls -la /var/backups/bhavano'
# expect: whoami → bhavano-backup
```

From laptop with the recovery copy:

```bash
ssh -i ~/.ssh/bhavano-db-finfolia_backup -o IdentitiesOnly=yes \
  bhavano-backup@13.127.83.62 'ls -la /var/backups/bhavano'
```

#### Filesystem permissions (why `ubuntu` “sees nothing”)

| Path | Owner | Mode | Effect |
|---|---|---|---|
| `/var/backups/bhavano` (Finfolia) | `bhavano-backup:bhavano-backup` | `700` | Only that user (or root via `sudo`) can list/read dumps |
| Files `bhavano_YYYYMMDD.dump` | `bhavano-backup` | `600` | Same — not world-readable |
| `/var/backups/bhavano-local` (DB) | `root:root` | `700` | Staging for root/`scp` only; `postgres` cannot write here (script dumps to `/tmp` then `mv`) |
| Dump script | `root` | `700` | `/usr/local/bin/bhavano-pg-dump-to-finfolia.sh` |

On Finfolia as `ubuntu`:

```bash
ls /var/backups/bhavano          # Permission denied — expected
sudo ls -lah /var/backups/bhavano   # works
sudo -u bhavano-backup ls -lah /var/backups/bhavano
```

#### Network / security group

| Source | Dest | Port | Why |
|---|---|---|---|
| Bhavano DB private IP / SG | Finfolia SG | TCP 22 | Nightly `scp`/`ssh` as `bhavano-backup` |
| Your IP | Finfolia SG | TCP 22 | Admin as `ubuntu` |
| Your IP | App SG | TCP 22 | Jump to DB as `ubuntu` |
| App SG | Bhavano DB SG | TCP 22 | Jump host path for DB admin |

`bhavano-backup` has **no** sudo on Finfolia and should not be in the `docker` or `sudo` groups — dump upload only.

#### Optional hardening (not applied yet)

Restrict the backup pubkey in Finfolia `authorized_keys` so it can only write to the dump dir, e.g. `command="rrsync -wo /var/backups/bhavano",no-agent-forwarding,no-port-forwarding,no-pty …` plus the key. Until then, that key can open a normal shell as `bhavano-backup` (still no sudo).

### One-time setup — Finfolia

```bash
sudo adduser --disabled-password --gecos "" bhavano-backup
sudo mkdir -p /var/backups/bhavano /home/bhavano-backup/.ssh
sudo chown -R bhavano-backup:bhavano-backup /var/backups/bhavano /home/bhavano-backup/.ssh
sudo chmod 700 /var/backups/bhavano /home/bhavano-backup/.ssh
# After creating the key on the DB (next section), install the pubkey:
#   sudo tee /home/bhavano-backup/.ssh/authorized_keys  # paste .pub line
sudo chown bhavano-backup:bhavano-backup /home/bhavano-backup/.ssh/authorized_keys
sudo chmod 600 /home/bhavano-backup/.ssh/authorized_keys
```

List dumps (must use sudo — `ubuntu` cannot read the directory):

```bash
sudo ls -lah /var/backups/bhavano
```

### One-time setup — Bhavano DB (key + script + timer)

```bash
sudo mkdir -p /var/backups/bhavano-local /root/.ssh
sudo ssh-keygen -t ed25519 -f /root/.ssh/finfolia_backup -N "" -C "bhavano-db-to-finfolia-backup"
sudo cat /root/.ssh/finfolia_backup.pub
# → paste into Finfolia authorized_keys as above

sudo ssh -i /root/.ssh/finfolia_backup -o StrictHostKeyChecking=accept-new \
  bhavano-backup@172.31.10.110 'ls -la /var/backups/bhavano'
```

Install `/usr/local/bin/bhavano-pg-dump-to-finfolia.sh` (peer auth via `sudo -u postgres` — no
password in the script):

```bash
#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date -u +%Y%m%d)
LOCAL_DIR=/var/backups/bhavano-local
REMOTE=bhavano-backup@172.31.10.110
REMOTE_DIR=/var/backups/bhavano
KEY=/root/.ssh/finfolia_backup
DUMP="$LOCAL_DIR/bhavano_${STAMP}.dump"
TMP_DUMP="/tmp/bhavano_${STAMP}.dump"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes)
SCP=(scp -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes)

mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR"

echo "[$(date -Is)] dumping bhavano -> $TMP_DUMP"
sudo -u postgres pg_dump -Fc -d bhavano -f "$TMP_DUMP"
mv "$TMP_DUMP" "$DUMP"
chown root:root "$DUMP"
chmod 600 "$DUMP"
ls -lh "$DUMP"

echo "[$(date -Is)] uploading to $REMOTE:$REMOTE_DIR/"
"${SCP[@]}" "$DUMP" "${REMOTE}:${REMOTE_DIR}/"

echo "[$(date -Is)] pruning remote to last 3 dumps"
"${SSH[@]}" "$REMOTE" "cd '$REMOTE_DIR' && ls -1t bhavano_*.dump 2>/dev/null | tail -n +4 | xargs -r rm -f && ls -lh"

echo "[$(date -Is)] pruning local to newest dump only"
ls -1t "$LOCAL_DIR"/bhavano_*.dump 2>/dev/null | tail -n +2 | xargs -r rm -f

echo "[$(date -Is)] done"
```

```bash
sudo chmod 700 /usr/local/bin/bhavano-pg-dump-to-finfolia.sh
```

`/etc/systemd/system/bhavano-pg-dump.service`:

```ini
[Unit]
Description=Bhavano Postgres dump to Finfolia
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/bhavano-pg-dump-to-finfolia.sh
Nice=10
```

`/etc/systemd/system/bhavano-pg-dump.timer` (21:00 UTC ≈ **02:30 IST**):

```ini
[Unit]
Description=Nightly Bhavano pg_dump to Finfolia

[Timer]
OnCalendar=*-*-* 21:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bhavano-pg-dump.timer
sudo systemctl start bhavano-pg-dump.service    # run once now
sudo journalctl -u bhavano-pg-dump.service -n 50 --no-pager
systemctl list-timers bhavano-pg-dump.timer --no-pager
```

### Day-to-day ops

```bash
# On Bhavano DB — next scheduled run / last result
systemctl list-timers bhavano-pg-dump.timer --no-pager
sudo journalctl -u bhavano-pg-dump.service -n 50 --no-pager
sudo ls -lah /var/backups/bhavano-local/

# On Finfolia — off-box copies (sudo required)
sudo ls -lah /var/backups/bhavano/
```

Manual dump anytime: `sudo systemctl start bhavano-pg-dump.service`.

### Restore dump to a new / repaired DB host

1. Copy a dump from Finfolia (`sudo scp` / download `bhavano_YYYYMMDD.dump`).
2. On a Postgres **16** host with an empty database and role (same pattern as step 3 earlier in
   this doc — `CREATE USER` / `CREATE DATABASE`):

```bash
pg_restore -d bhavano --no-owner --role=bhavano -j 4 bhavano_YYYYMMDD.dump
```

3. Point the app instance `.env` `DATABASE_URL` at the restored host and recreate/restart `bff`
   (and run `prisma migrate deploy` if the dump is older than current migrations — prefer a dump
   taken after the last successful migrate).

### Restore dump to local Postgres (dev copy of prod)

Same major as prod (**16** — `postgis/postgis:16-3.4` in root `docker-compose.yml`). Treat the
file as **production PII** — do not commit it.

```bash
# from laptop, after scp'ing the dump from Finfolia
dropdb bhavano_prod_copy 2>/dev/null || true
createdb bhavano_prod_copy
pg_restore -d bhavano_prod_copy --no-owner -j 4 bhavano_YYYYMMDD.dump
# point local .env DATABASE_URL at this database
```

### EBS snapshots of the DB volume (recommended second layer)

Independent of Finfolia: AWS Console → EC2 → **Lifecycle Manager** (or Snapshots) → policy on the
Bhavano DB root/data volume, daily, retain ~7–14 days. Restore path: create volume from snapshot →
attach to a new/replaced instance → start Postgres. Use this if Finfolia is also unavailable.

### What this is not

- Not incremental / WAL PITR (no point-in-time between dumps)
- Not a live replica on Finfolia
- Not a substitute for eventually moving to RDS if you need managed backups/failover

## Self-hosted Postgres vs RDS — the tradeoff being made here

Choosing to self-host on EC2 instead of RDS trades away:

- Automated backups / point-in-time recovery (partially mitigated by the **Postgres backups**
  section above — nightly `pg_dump` to Finfolia + optional EBS snapshots; still not RDS PITR)
- Minor-version patching (manual `apt upgrade`)
- Multi-AZ failover
- Online storage/instance resizing without a maintenance script

... for a straightforward host-cost saving (RDS carries a management premium over equivalent raw
EC2, more pronounced in `ap-south-1` than in `us-east-1`). Revisit this once the app has real users
depending on data durability/uptime — migrating self-hosted data to RDS later is a `pg_dump`/restore
+ cutover, not a same-day change.

## Regional pricing caveat

Live `ap-south-1` on-demand pricing wasn't reliably scrapeable from aggregator sites at the time of
writing (they render region selection client-side). Use the official AWS Pricing Calculator
(calculator.aws.amazon.com) for current numbers before budgeting — don't trust stale figures copied
into chat history.
