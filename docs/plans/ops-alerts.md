# Alerts for a full disk, a failed backup and a site that is down

Status: **approved 2026-11-27, partly built; the India site-down alerts exist** (see Order of work). Prompted by the outage of the same day
([postgres-backup-finfolia.md](postgres-backup-finfolia.md), "Incident 2026-11-27").

## What exists (checked 2026-11-27)

| Item | State |
|---|---|
| CloudWatch alarms | 8: CPU credits and status check for each of the 4 instances, all `OK` |
| Alert email (`bhavano-india-alerts`, `bhavano-us-alerts`) | Both subscriptions **confirmed** |
| Disk, backup and site-down alerts | **None** |
| India DB volume | Still 8 GB (66% used after cleanup) |
| **India app server disk** | 81% used when checked (18.3 GB Docker build cache from builds once run on the server); 34% after step 0b |
| India EBS snapshots | The 2026-11-26 22:15 UTC one completed |
| Server roles | None of the 4 Bhavano instances has an IAM role |
| CloudWatch agent | Not running on the India app server |
| Grafana and Loki | Run on the India app server; they read backend logs only |
| US server disks | App 19%, database 7% |

## Proposal

Use CloudWatch and the two confirmed email topics. Nothing new to sign up for.

| Alert | How | Fires when |
|---|---|---|
| India is down | Route 53 health checks on `https://api.bhavano.com/health` (503 when the database is unreachable) and `https://www.bhavano.com/` | 3 failed minutes |
| Disk filling | CloudWatch agent on all 4 servers reporting only the root disk's used percentage | 80% or more for 15 minutes |
| Backup failed or never ran | The dump script reports success to the local agent as its last step; the alarm treats silence as failure | No success for about a day (India and US) |

The US site check is added at launch. Route 53 health-check metrics exist only in `us-east-1`, so those alarms are
created there.

Also on all 4 servers, so the same disk does not fill again:

- Cap the system journal (`SystemMaxUse=200M`).
- Empty the apt download cache weekly (`APT::Periodic::CleanInterval "7";`).

On the India dump script, read the whole dump (`pg_restore -f /dev/null`) before uploading and reporting success.

## Order of work

| # | Step | Who | State (2026-11-27) |
|---|---|---|---|
| 0a | Grow `vol-046b184a044c7c1c4` to 30 GB, then extend the file system | Owner in AWS; then on the server | Waiting for the owner |
| 0b | Clear the build cache on the India app server (after a Docker restart) | On the server | **Done**, disk 81% to 34% |
| 1 | Site-down health checks and alarms; first, because it covers any cause | AWS console, with the owner signed in | **Done**; test-fired and the email received |
| 2 | IAM role `bhavano-monitoring` on the 4 instances | Owner (IAM) | Waiting |
| 3 | Install AWS's CloudWatch agent package, configure it, create 4 disk alarms | On the servers | After 2 |
| 4a | India dump script reads the whole dump before uploading | On the DB server | **Done**, test run succeeded |
| 4b | Dump scripts report success; create 2 backup alarms | On the DB servers | After 3 |
| 5 | Journal cap (`/etc/systemd/journald.conf.d/90-bhavano-size.conf`) and weekly apt cleanup (`/etc/apt/apt.conf.d/90bhavano-clean`) | All 4 servers | **Done** |
| 6 | Test every new alarm and see the email arrive; update the backup notes and `docs/deployment.md` | Together | After 1 to 4 |

**0b:** `docker builder prune -af` first freed nothing: every entry was reported as not reclaimable (Docker had run
since 2026-07-14). After `systemctl restart docker` (about 25 seconds of India downtime, 08:20 IST, approved) the same
command freed 16.5 GB.

India changes are made only after approval. AWS access from this machine for India is read-only.

## Owner steps in AWS

India and the US are in the same AWS account.

**Database volume** (region `ap-south-1`): EC2 → Volumes → `vol-046b184a044c7c1c4` → Create snapshot, then Modify volume
→ 30 GB.

**Site-down checks**: Route 53 → Health checks → Create health check, once for each row.

| Name | Protocol | Domain | Path |
|---|---|---|---|
| `bhavano-india-api` | HTTPS | `api.bhavano.com` | `/health` |
| `bhavano-india-web` | HTTPS | `www.bhavano.com` | `/` |

Monitor an endpoint by domain name, port 443, SNI on, request interval 30 seconds, failure threshold 6. Wait until the
checkers show healthy, then create the alarm for each (it lives in `us-east-1`) and send it to `bhavano-us-alerts`, the
confirmed topic in that region.

**Server role**: IAM → Roles → Create role → AWS service, EC2 → policy `CloudWatchAgentServerPolicy` → name
`bhavano-monitoring`. Then, for each instance, EC2 → Actions → Security → Modify IAM role. None had a role on
2026-11-27.

| Instance (name in the EC2 console) | Region |
|---|---|
| `Bhavano-App`, `Bhavano-DB` | `ap-south-1` |
| `bhavano-us-app`, `bhavano-us-db` | `us-east-1` |

On the two app instances also set Actions → Instance settings → Modify instance metadata options → hop limit **1** (it
is 2), so containers cannot use the role. No restart is needed for any of these.

**Extra recipient**: SNS → the topic → Create subscription → Email, then confirm from the message.

## Site-down checks as created (2026-11-27)

| Health check | Address | Alarm |
|---|---|---|
| `bhavano-india-api` | `https://api.bhavano.com/health` | `bhavano-india-api-alarm` |
| `bhavano-india-web` | `https://www.bhavano.com/` | `bhavano-india-web-alarm` |

Every 30 seconds from all 8 checker regions, unhealthy after 6 failures in a row, SNI on, no string matching or latency
graphs. Each alarm is `HealthCheckStatus` minimum below 1 for 1 minute (missing data left as missing), notifying
`bhavano-us-alerts` in `us-east-1` on alarm only, not on recovery. To test the email, point a check's path at an address
that does not exist, wait about 5 minutes, and change it back. India's records are DNS only, so the checkers reach the
server directly.

Tested 2026-11-27 with the API check pointed at `/alert-test`: the alarm fired 5 minutes later and AWS reported the
notification sent; the owner received the email, and the alarm returned to `OK` after the path was restored.

## Cost (estimate, check the pricing pages)

About **$6 a month**:

- Two HTTPS health checks ([pricing](https://aws.amazon.com/route53/pricing/), read 2026-11-27): about $2 a month in
  all if billed as AWS endpoints (the servers are in this account: basic checks free up to 50, HTTPS $1 each), $5.50 if
  billed as non-AWS endpoints ($0.75 plus $2.00 each).
- 6 custom metrics: inside the free allowance of 10.
- 16 alarms in total, 10 free, the rest about $0.10 each (third-party figure).

## Rejected

| Option | Why not |
|---|---|
| Grafana alerts | Runs on the India app server, so it goes down with it, sees no DB server disk, and covers one market |
| A script on each server that emails | Puts mail credentials on the DB servers and is silent when the server is down |
| An outside heartbeat service | Free of IAM work, but another account and vendor, and does not use the confirmed topics |

## Decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Method | CloudWatch and Route 53 |
| 2 | Who is told | Add an address that is read on a phone to both topics, besides support@bhavano.com |
| 3 | Disk threshold | 80% |

## Not verified

- Reporting backup success through the agent (StatsD on the local port) has not been tried.
