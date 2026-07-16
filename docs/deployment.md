# Deployment infra notes

Working notes from setting up production infra (AWS, `ap-south-1` / Mumbai). Not exhaustive —
captures decisions made and the exact commands used so they don't need re-deriving.

## Topology

- `apps/web` (Next.js) + `apps/bff` (NestJS) — one EC2 `t4g.medium` ("app" instance), containerized
  via `docker-compose.prod.yml` (see root `Dockerfile`s / `docker-compose.prod.yml` / `Caddyfile` /
  `.env.production.example`).
- Postgres — self-hosted on its own EC2 `t4g.medium` ("db" instance), rather than RDS, per current
  cost tradeoff (see below). Not containerized — installed directly on the host.
- Image uploads (`apps/bff/src/uploads/uploads.controller.ts`) currently write to local disk
  (`apps/bff/uploads/`), flagged in code as a stand-in for S3. Plan is to swap to direct S3 SDK calls
  (not an EC2-mounted "Mountpoint for S3" file system — that still proxies reads through the app
  server and doesn't unlock CDN-direct serving).

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
`bhavano-app-sg` → 20-30GB gp3 root volume, no extra file system. Allocate/associate an **Elastic
IP** so the public address survives a stop/start.

### 6. Point DNS at the app instance

`SITE_DOMAIN` / `API_DOMAIN` / `APEX_DOMAIN` records → the app instance's Elastic IP. Do this now —
Caddy needs to complete a Let's Encrypt HTTP challenge on first boot in step 9, and DNS propagation
isn't instant.

**If DNS is managed through Cloudflare (or any other proxying CDN):** every one of these records
must be set to **"DNS only"**, not proxied. A proxied record means Let's Encrypt's ACME challenge —
and ordinary TLS handshakes — hit Cloudflare's edge instead of Caddy directly, which Caddy can't
complete (shows up as a `525` error in the browser, or `NXDOMAIN`/ALPN-negotiation failures in
Caddy's own logs, depending on exactly which record and challenge type is affected). This bit us
for `www`, `api`, and the bare apex domain in turn — check all of them, not just the one that's
currently broken.

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
Fill in the rest (`SITE_DOMAIN`, `API_DOMAIN`, `NEXTAUTH_SECRET`, `AUTH_JWT_SECRET`,
`GOOGLE_CLIENT_ID`/`SECRET`, etc.) per the comments in the file.

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

### 11. Verify

```bash
curl -I https://<site-domain>
curl -I https://<api-domain>/listings/sitemap
```

If step 10's `migrate deploy` succeeded, app→DB connectivity across the two instances is already
proven — no separate check needed.

Future app deploys: `git pull && docker compose -f docker-compose.prod.yml --env-file .env up -d
--build` on the app instance. New migrations: re-run step 10 after deploying.

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
