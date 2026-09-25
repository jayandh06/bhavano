#!/usr/bin/env bash
# Pull latest git, build linux/arm64 images locally, scp to the app EC2, load + recreate containers.
# See docs/deployment.md → "Local build → copy images to app EC2".
#
# Required:
#   BHAVANO_EC2_HOST
# Optional:
#   BHAVANO_EC2_USER (ubuntu)  BHAVANO_EC2_SSH_KEY  BHAVANO_REMOTE_DIR (~/bhavano)
#   BHAVANO_ENV_FILE (.env.prod.build)  SERVICES (web,bff,admin)
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

echo '==> git pull on EC2'
cd "\$REMOTE_DIR"
git pull --ff-only

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
  docker compose -f docker-compose.prod.yml --env-file .env exec -T bff npx prisma migrate deploy
fi

rm -f "\$TAR"
echo '==> done'
docker compose -f docker-compose.prod.yml ps
EOF

rm -f "$TAR"
echo "==> Deploy finished ($TAG)"
