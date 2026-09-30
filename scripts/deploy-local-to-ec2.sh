#!/usr/bin/env bash
# Pull latest git, build linux/arm64 images locally, scp to the app EC2, load + recreate containers.
# See docs/deployment.md → "Local build → copy images to app EC2".
#
# Required:
#   BHAVANO_EC2_HOST
# Optional:
#   BHAVANO_EC2_USER (ubuntu)  BHAVANO_EC2_SSH_KEY  BHAVANO_REMOTE_DIR (~/bhavano)
#   BHAVANO_ENV_FILE (.env.prod.build)  SERVICES (web,bff,admin)
#   BHAVANO_KEEP_RELEASES (2)  BHAVANO_MIN_FREE_GB (5)
#
# Usage:
#   export BHAVANO_EC2_HOST=1.2.3.4
#   export BHAVANO_EC2_SSH_KEY=~/.ssh/bhavano-app.pem
#   ./scripts/deploy-local-to-ec2.sh
#   ./scripts/deploy-local-to-ec2.sh bff          # one service
#   ./scripts/deploy-local-to-ec2.sh --build-only

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EC2_HOST="${BHAVANO_EC2_HOST:-}"
EC2_USER="${BHAVANO_EC2_USER:-ubuntu}"
SSH_KEY="${BHAVANO_EC2_SSH_KEY:-}"
REMOTE_DIR="${BHAVANO_REMOTE_DIR:-~/bhavano}"
ENV_FILE="${BHAVANO_ENV_FILE:-.env.prod.build}"
PLATFORM="${BHAVANO_PLATFORM:-linux/arm64}"
PROJECT="${COMPOSE_PROJECT_NAME:-bhavano}"
# Releases of each image left on the server after a deploy: the live one plus a rollback — same
# default and reasoning as deploy-local-to-ec2.ps1's -KeepReleases.
KEEP_RELEASES="${BHAVANO_KEEP_RELEASES:-2}"
# 5, not 2: 2 is the exact floor video-upload.guard-rails.ts refuses uploads at, so a deploy that
# left the disk at 2 GB left zero margin before a real user hit that error — confirmed live
# 2026-09-30. Matches the .ps1 script and docs/deployment.md's own guidance.
MIN_FREE_GB="${BHAVANO_MIN_FREE_GB:-5}"
SKIP_PULL=0
SKIP_MIGRATE=0
BUILD_ONLY=0
SERVICES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pull) SKIP_PULL=1; shift ;;
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    --build-only) BUILD_ONLY=1; shift ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --host) EC2_HOST="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    web|bff|admin) SERVICES+=("$1"); shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  SERVICES=(web bff admin)
fi

need() { command -v "$1" >/dev/null || { echo "Missing: $1" >&2; exit 1; }; }
need docker
need git
need scp
need ssh
need gzip

if [[ "$BUILD_ONLY" -eq 0 && -z "$EC2_HOST" ]]; then
  echo "Set BHAVANO_EC2_HOST or pass --host" >&2
  exit 1
fi
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE — copy from .env.production.example and fill NEXT_PUBLIC_*" >&2; exit 1; }

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")

TAG="$(date -u +%Y%m%d%H%M%S)_$(git rev-parse --short HEAD)"

echo "==> Services: ${SERVICES[*]}"
echo "==> Tag: $TAG"
echo "==> Platform: $PLATFORM"

if [[ "$SKIP_PULL" -eq 0 ]]; then
  echo "==> git pull --ff-only"
  git pull --ff-only
  TAG="$(date -u +%Y%m%d%H%M%S)_$(git rev-parse --short HEAD)"
  echo "==> Tag after pull: $TAG"
fi

export COMPOSE_PROJECT_NAME="$PROJECT"
export DOCKER_DEFAULT_PLATFORM="$PLATFORM"

if ! docker buildx ls 2>/dev/null | grep -q armbuilder; then
  echo "==> Creating buildx armbuilder"
  docker buildx create --name armbuilder --driver docker-container --use
  docker buildx inspect --bootstrap >/dev/null
else
  docker buildx use armbuilder
fi

echo "==> Building"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build "${SERVICES[@]}"

IMAGE_REFS=()
for svc in "${SERVICES[@]}"; do
  local_latest="${PROJECT}-${svc}:latest"
  if [[ -z "$(docker images -q "$local_latest")" ]]; then
    local_latest="${PROJECT}_${svc}:latest"
  fi
  [[ -n "$(docker images -q "$local_latest")" ]] || { echo "Image not found for $svc"; docker images; exit 1; }

  arch="$(docker image inspect "$local_latest" --format '{{.Os}}/{{.Architecture}}')"
  echo "    $local_latest → $arch"
  [[ "$arch" == "$PLATFORM" ]] || { echo "Wrong arch $arch (want $PLATFORM)"; exit 1; }

  versioned="${PROJECT}-${svc}:${TAG}"
  # Keep underscore form in the loaded name if that's what compose used
  if [[ "$local_latest" == *"_"* ]]; then
    versioned="${PROJECT}_${svc}:${TAG}"
  fi
  docker tag "$local_latest" "$versioned"
  IMAGE_REFS+=("$versioned")
done

if [[ "$BUILD_ONLY" -eq 1 ]]; then
  echo "==> BuildOnly — ready: ${IMAGE_REFS[*]}"
  exit 0
fi

TAR="bhavano-images-${TAG}.tar.gz"
echo "==> docker save → $TAR"
docker save "${IMAGE_REFS[@]}" | gzip > "$TAR"

REMOTE="${EC2_USER}@${EC2_HOST}"
echo "==> scp → ${REMOTE}:~/"
scp "${SSH_OPTS[@]}" "$TAR" "${REMOTE}:~/${TAR}"

SVC_LIST="${SERVICES[*]}"
DO_MIGRATE=1
[[ "$SKIP_MIGRATE" -eq 1 ]] && DO_MIGRATE=0

echo "==> remote load + up --no-build"
ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s <<EOF
set -euo pipefail
TAG='$TAG'
PROJECT='$PROJECT'
REMOTE_DIR='$REMOTE_DIR'
TAR=~/$TAR
SERVICES='$SVC_LIST'
DO_MIGRATE='$DO_MIGRATE'
KEEP_RELEASES=$KEEP_RELEASES
MIN_FREE_KB=$((MIN_FREE_GB * 1024 * 1024))

# Drops all but the newest KEEP_RELEASES timestamped tags of every app image. A tag still used by a
# running container only loses its name; the container keeps running. Same as
# deploy-local-to-ec2.ps1's prune_old_releases — kept in sync with it by hand.
prune_old_releases() {
  for svc in web bff admin; do
    docker images --format '{{.Tag}}' "\${PROJECT}-\${svc}" | grep -E '^[0-9]{14}_' | sort -r | \
      tail -n +\$((KEEP_RELEASES + 1)) | while read -r old; do
        docker rmi "\${PROJECT}-\${svc}:\${old}" >/dev/null && echo "    removed \${PROJECT}-\${svc}:\${old}"
      done || true
  done
  docker image prune -f >/dev/null || true
}

echo '==> git pull on EC2'
# A quoted "~/bhavano" is not tilde-expanded, so expand a leading ~ by hand.
cd "\${REMOTE_DIR/#\~/\$HOME}"
git pull --ff-only

echo '==> free disk before load'
prune_old_releases
FREE_KB=\$(df --output=avail -k / | tail -1)
echo "    \$((FREE_KB / 1024)) MB free"
# docker load can report success while failing to unpack layers on a full disk, and retagging
# :latest onto a half-extracted image breaks the next restart. Stop here instead.
if (( FREE_KB < MIN_FREE_KB )); then
  echo "Not enough disk on the server (need ${MIN_FREE_GB} GB free). Nothing was changed." >&2
  rm -f "\$TAR"
  exit 1
fi

echo '==> docker load'
gunzip -c "\$TAR" | docker load

for svc in \$SERVICES; do
  if docker image inspect "\${PROJECT}-\${svc}:\${TAG}" >/dev/null 2>&1; then
    docker tag "\${PROJECT}-\${svc}:\${TAG}" "\${PROJECT}-\${svc}:latest"
  else
    docker tag "\${PROJECT}_\${svc}:\${TAG}" "\${PROJECT}_\${svc}:latest"
  fi
done

echo '==> compose up --no-build'
export COMPOSE_PROJECT_NAME=\$PROJECT
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-build \$SERVICES

if [[ "\$DO_MIGRATE" == "1" ]] && echo "\$SERVICES" | grep -qw bff; then
  echo '==> prisma migrate deploy'
  # </dev/null: exec -T would otherwise read the rest of this script from stdin and swallow it.
  docker compose -f docker-compose.prod.yml --env-file .env exec -T bff npx prisma migrate deploy </dev/null
fi

rm -f "\$TAR"

echo "==> keeping the newest \$KEEP_RELEASES releases of each image"
prune_old_releases
df -h / | tail -1

echo '==> done'
docker compose -f docker-compose.prod.yml ps
EOF

rm -f "$TAR"
echo "==> Deploy finished ($TAG)"
