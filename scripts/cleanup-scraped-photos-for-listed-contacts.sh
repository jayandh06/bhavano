#!/usr/bin/env bash
# Delete local scraped Google photo files for outreach contacts that already have a Listing.
#
# After createListingFromContact, photos live on R2/CDN. Files under leads_output/photos are only
# needed for contacts that still have no listing. See docs/deployment.md (outreach scrape section)
# and docs/plans/outreach-direct-listing-creation.md.
#
# Run on the app EC2 from the repo root (~/bhavano):
#   chmod +x scripts/cleanup-scraped-photos-for-listed-contacts.sh
#   ./scripts/cleanup-scraped-photos-for-listed-contacts.sh              # dry-run (PG only)
#   ./scripts/cleanup-scraped-photos-for-listed-contacts.sh --execute    # actually delete
#   ./scripts/cleanup-scraped-photos-for-listed-contacts.sh --category coworking --execute
#   ./scripts/cleanup-scraped-photos-for-listed-contacts.sh --category all --execute
#
# Requires: docker compose prod stack running (uses `bff` + Prisma to list googlePlaceIds).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PHOTOS_DIR="${PHOTOS_DIR:-$ROOT/leads_output/photos}"
COMPOSE=(docker compose -f docker-compose.prod.yml)
CATEGORY=pg
EXECUTE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=1; shift ;;
    --dry-run) EXECUTE=0; shift ;;
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --photos-dir)
      PHOTOS_DIR="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$PHOTOS_DIR" ]]; then
  echo "Photos dir not found: $PHOTOS_DIR" >&2
  exit 1
fi

case "$CATEGORY" in
  pg|coworking|all) ;;
  *)
    echo "--category must be pg, coworking, or all (got: $CATEGORY)" >&2
    exit 1
    ;;
esac

hr_bytes() {
  awk -v b="$1" 'BEGIN {
    if (b >= 1073741824) printf "%.1fG", b/1073741824
    else if (b >= 1048576) printf "%.1fM", b/1048576
    else if (b >= 1024) printf "%.1fK", b/1024
    else printf "%dB", b
  }'
}

echo "==> Listing googlePlaceIds with a Listing (category=$CATEGORY)"
PLACE_IDS="$(
  "${COMPOSE[@]}" exec -T -e CLEANUP_CATEGORY="$CATEGORY" bff node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const category = process.env.CLEANUP_CATEGORY || 'pg';
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in the bff container');
  process.exit(1);
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
(async () => {
  const where = {
    googlePlaceId: { not: null },
    claimedListing: { isNot: null },
  };
  if (category !== 'all') where.businessCategory = category;
  const rows = await prisma.outreachContact.findMany({
    where,
    select: { googlePlaceId: true },
  });
  for (const r of rows) {
    if (r.googlePlaceId) console.log(r.googlePlaceId);
  }
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  try { await prisma.$disconnect(); } catch (_) {}
  process.exit(1);
});
NODE
)"

mapfile -t IDS <<< "$PLACE_IDS"
COUNT_IDS=0
for id in "${IDS[@]}"; do
  id="${id//$'\r'/}"
  [[ -z "${id// }" ]] && continue
  COUNT_IDS=$((COUNT_IDS + 1))
done

echo "==> $COUNT_IDS contact(s) with listings"
echo "==> Photos dir: $PHOTOS_DIR ($(du -sh "$PHOTOS_DIR" | awk '{print $1}'))"

MATCHED=0
BYTES=0
FILES=()

for id in "${IDS[@]}"; do
  id="${id//$'\r'/}"
  [[ -z "${id// }" ]] && continue
  shopt -s nullglob
  for f in "$PHOTOS_DIR/${id}"_*.jpg; do
    FILES+=("$f")
    MATCHED=$((MATCHED + 1))
    BYTES=$((BYTES + $(stat -c%s "$f")))
  done
  shopt -u nullglob
done

echo "==> Would remove $MATCHED file(s) (~$(hr_bytes "$BYTES"))"

if (( MATCHED == 0 )); then
  echo "Nothing to do."
  exit 0
fi

echo "==> Sample (up to 15):"
printf '  %s\n' "${FILES[@]:0:15}"
if (( MATCHED > 15 )); then
  echo "  … and $((MATCHED - 15)) more"
fi

if (( EXECUTE == 0 )); then
  echo
  echo "Dry-run only. Re-run with --execute to delete."
  exit 0
fi

echo "==> Deleting…"
for f in "${FILES[@]}"; do
  rm -f -- "$f"
done

echo "==> Done. Photos dir now: $(du -sh "$PHOTOS_DIR" | awk '{print $1}')"
df -h / | tail -1
