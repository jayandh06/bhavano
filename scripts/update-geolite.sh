#!/usr/bin/env bash
# Downloads/refreshes the MaxMind GeoLite2-City database used by the BFF's GeoIpService to label
# each Visit row with a best-effort city/region/country (docs/plans/visit-ip-city-logging.md).
# Admin-analytics only — never used to decide what a visitor sees.
#
# Run on the app host, not in a container. docker-compose.prod.yml mounts the output directory
# read-only into the bff, so the database is NOT baked into the image: it is ~60MB, it has to be
# refreshed periodically under MaxMind's licence, and the app instance is already at 80% disk.
# Refreshing therefore needs no rebuild and adds nothing per deploy.
#
# Requires MAXMIND_LICENSE_KEY in .env — free, from a MaxMind account
# (https://www.maxmind.com/en/geolite2/signup).
#
# Suggested monthly cron on the app host:
#   0 4 1 * * cd ~/bhavano && ./scripts/update-geolite.sh >> /var/log/geolite.log 2>&1
#
# The BFF opens the file once at boot, so restart it after a refresh to pick up the new data:
#   docker compose -f docker-compose.prod.yml restart bff

set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

: "${MAXMIND_LICENSE_KEY:?MAXMIND_LICENSE_KEY is not set — add it to .env}"

DEST_DIR="./data/geoip"
DEST="$DEST_DIR/GeoLite2-City.mmdb"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST_DIR"

echo "Downloading GeoLite2-City…"
curl -fsSL -o "$TMP/db.tar.gz" \
  "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz"

tar -xzf "$TMP/db.tar.gz" -C "$TMP"
FOUND="$(find "$TMP" -name 'GeoLite2-City.mmdb' -print -quit)"
[ -n "$FOUND" ] || { echo "No .mmdb inside the archive — is the licence key valid?" >&2; exit 1; }

# Move into place in one step. A partial file at $DEST would be opened at the next bff boot and
# either fail or, worse, answer wrongly.
mv "$FOUND" "$DEST.tmp"
mv "$DEST.tmp" "$DEST"

echo "Installed $DEST ($(du -h "$DEST" | cut -f1))"
echo "Restart the bff to load it: docker compose -f docker-compose.prod.yml restart bff"
