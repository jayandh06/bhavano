# Postgres backups (Finfolia dump store)

Status: **deployed** for nightly `pg_dump` → Finfolia (3-day retention). **EBS snapshots added 2026-11-25:** Data Lifecycle Manager
policy `policy-0c455046ddae6e02a` in `ap-south-1`, daily at 22:00 UTC (about 03:30 IST, after the 21:00 UTC dump), keep 7, for the two Bhavano volumes
(`vol-0cff7fc719cd0370c` app 40 GB, `vol-046b184a044c7c1c4` DB 8 GB), selected by the tag `Project=bhavano-india-prod` (added to both volumes). Restore dry-run
remains a recommended follow-up. Before this there were no snapshot policies, alarms or SNS topics in `ap-south-1`; CloudWatch alarms
`bhavano-india-{app,db}-{cpu-credits-low,status-check-failed}` now exist and send to the SNS topic `bhavano-india-alerts` (`ap-south-1`, email subscription to support@bhavano.com; it must be confirmed from the AWS email or nothing is delivered). Operator runbook lives in
[`docs/deployment.md`](../deployment.md) → **Postgres backups (nightly dump → Finfolia EC2)**.

## Decision

| Choice | Why |
|--------|-----|
| Full nightly `pg_dump -Fc` | Simple restore with `pg_restore`; matches local Postgres 16 |
| Store dump **files** on Finfolia EC2 | Off-box from Bhavano DB without S3; keep last 3 days |
| No Postgres on Finfolia | Avoid coupling a live DB to another product’s host |
| Peer auth `sudo -u postgres pg_dump` | No DB password in the backup script |
| Optional EBS snapshots on Bhavano DB volume | Independent of Finfolia if that box is also down |

Rejected: S3-only (still fine later), streaming replica on Finfolia, using Finfolia amd64 as a
Buildx target for arm64 app images.

## Topology

| Role | Address |
|------|---------|
| Bhavano DB | private `172.31.18.137` |
| Finfolia | `13.127.83.62` / `172.31.10.110` |
| Dump schedule | systemd `bhavano-pg-dump.timer` — `21:00 UTC` (~02:30 IST) |

Artifacts:

- Script: `/usr/local/bin/bhavano-pg-dump-to-finfolia.sh` on DB
- Units: `bhavano-pg-dump.service` + `.timer` on DB
- Remote dir: `/var/backups/bhavano` (`bhavano-backup`, mode `700`) on Finfolia
- Local staging: `/var/backups/bhavano-local` on DB
- SSH key: `/root/.ssh/finfolia_backup` on DB (laptop copy optional: `~/.ssh/bhavano-db-finfolia_backup`)

## Users and SSH permissions

| Host | User | Role |
|------|------|------|
| Finfolia | `ubuntu` | Admin via AWS `.pem`; `sudo` required to list dumps |
| Finfolia | `bhavano-backup` | No password, no sudo; SSH only via dedicated pubkey; owns dump dir |
| Bhavano DB | `ubuntu` | Admin; jump via app |
| Bhavano DB | `postgres` | `sudo -u postgres pg_dump` only |
| Bhavano DB | `root` | systemd dump job + private key `/root/.ssh/finfolia_backup` |

SSH trust: DB private key → Finfolia `bhavano-backup` `authorized_keys` only. Separate from AWS
admin `.pem` and app GitHub deploy key. Dump path uses private IP `172.31.10.110:22`.

Filesystem: Finfolia `/var/backups/bhavano` is `700`/`bhavano-backup` — `ubuntu` gets permission
denied without `sudo`. Full operator tables in [`docs/deployment.md`](../deployment.md).

## Ops reminders

- Listing Finfolia dumps requires `sudo ls /var/backups/bhavano` (`ubuntu` gets permission denied).
- Dump writes via `/tmp` then `mv` into `bhavano-local` (postgres cannot write into root `700` dir).
- Treat dumps as production PII; never commit them.
- Rotate `finfolia_backup` if the private key is exposed; replace Finfolia `authorized_keys`.

## Follow-ups

1. AWS DLM / daily EBS snapshots of the Bhavano DB volume  
2. Dry-run restore of one dump to a spare DB or local Postgres  
3. Optional: harden Finfolia `authorized_keys` with forced `rrsync` / path restriction  
