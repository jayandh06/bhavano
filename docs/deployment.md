# Deployment infra notes

Working notes from setting up production infra (AWS, `ap-south-1` / Mumbai). Not exhaustive —
captures decisions made and the exact commands used so they don't need re-deriving.

## Topology

- `apps/web` (Next.js) + `apps/bff` (NestJS) — separate EC2 `t4g.medium` instances, or containerized
  via `docker-compose.prod.yml` on a single instance (see root `Dockerfile`s / `docker-compose.prod.yml`
  / `Caddyfile` / `.env.production.example`).
- Postgres — self-hosted on its own EC2 `t4g.medium` (see below), rather than RDS, per current cost
  tradeoff. RDS remains the safer default once real user data/uptime matters more than cost — see
  `.env.production.example` for the `DATABASE_URL` shape either way.
- Image uploads (`apps/bff/src/uploads/uploads.controller.ts`) currently write to local disk
  (`apps/bff/uploads/`), flagged in code as a stand-in for S3. Plan is to swap to direct S3 SDK calls
  (not an EC2-mounted "Mountpoint for S3" file system — that still proxies reads through the app
  server and doesn't unlock CDN-direct serving).

## Deploying the app to its EC2 instance (Ubuntu 26.x, `t4g.medium`)

### 1. Install Docker Engine + Compose plugin

Use Docker's official apt repo, not Ubuntu's stale `docker.io` package.

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
> default on a fresh instance, and writing under `/etc/` needs root either way. The
> `install -d` + `sudo curl` above avoids both problems.

### 2. Get the repo onto the instance

`git clone` over `scp`, so future deploys are a `git pull` + rebuild instead of a full re-copy:

```bash
ssh-keygen -t ed25519 -C "bhavano-app-ec2" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub   # add as a read-only Deploy Key on the GitHub repo

git clone git@github.com:<you>/bhavano.git
cd bhavano
```

### 3. Configure environment

```bash
cp .env.production.example .env
nano .env
```

`DATABASE_URL` should point at the **DB EC2 instance's private IP** (app and DB are separate
instances), e.g. `postgresql://bhavano:REALPASSWORD@10.0.1.23:5432/bhavano`.

### 4. Security groups (AWS console)

- App EC2: inbound 80 + 443 from `0.0.0.0/0`, inbound 22 from your IP only.
- DB EC2: inbound 5432 **only from the app EC2's security group** (reference the SG ID, not a CIDR)
  — never expose Postgres publicly.

### 5. DNS

Point `SITE_DOMAIN`/`API_DOMAIN` A records at the app EC2's Elastic IP *before* the next step —
Caddy needs to complete a Let's Encrypt HTTP challenge on first boot.

### 6. Build and run

Building directly on the arm64 instance avoids any cross-compilation (`buildx`) concerns for
`sharp`'s native binaries:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### 7. Verify

```bash
curl -I https://<site-domain>
curl -I https://<api-domain>/listings/sitemap
```

Future deploys: `git pull && docker compose -f docker-compose.prod.yml --env-file .env up -d --build`
on the instance.

## Installing PostgreSQL on EC2 (self-hosted, Ubuntu 26.x)

Target: **PostgreSQL 16**, to match the local dev Docker image (`postgis/postgis:16-3.4` in the
repo's root `docker-compose.yml`) — keeping dev/prod on the same major version avoids
`pg_dump`/restore and extension-availability surprises.

```bash
sudo apt update && sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
apt-cache policy postgresql-16
```

If `apt-cache policy postgresql-16` shows a candidate from `apt.postgresql.org`, proceed:

```bash
sudo apt install -y postgresql-16 postgresql-contrib-16
```

**Fallback if the PGDG script doesn't recognize the Ubuntu 26.x codename yet** (possible on a very
new release):

1. Check what the distro's own default repo ships: `apt-cache policy postgresql`. If it's already
   16.x or newer, skip PGDG and just `sudo apt install postgresql postgresql-contrib`.
2. If the default repo ships something newer (17/18) and version parity with local dev matters more
   than pinning exactly to 16, it's simpler to bump the *local* dev Postgres image version to match
   prod than to fight an unsupported PGDG repo.

Verify after install: `psql --version`. If it lands on something other than 16, double check
`packages/types` / Prisma schema for anything version-specific before running migrations against it
(nothing currently depends on a specific 16.x feature, but worth a quick check).

Architecture note: this instance is Graviton (`t4g`, arm64) — if following the Amazon Linux/RHEL
instructions elsewhere instead of Ubuntu, use the `aarch64` PGDG repo RPM, not `x86_64`.

## Self-hosted Postgres vs RDS — the tradeoff being made here

Choosing to self-host on EC2 instead of RDS trades away:

- Automated backups / point-in-time recovery (need to script `pg_dump` or WAL archiving to S3)
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
