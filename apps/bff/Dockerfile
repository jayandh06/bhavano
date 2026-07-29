FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable

# --- Prune the monorepo down to just what @bhavano/bff needs ---
FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @bhavano/bff --docker

# --- Install deps, generate the Prisma client, build ---
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# Prisma generate only reads the schema — this placeholder just satisfies prisma.config.ts's
# env("DATABASE_URL") lookup at generate time; the real value is supplied at container runtime.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    pnpm --filter=@bhavano/bff exec prisma generate
RUN pnpm turbo run build --filter=@bhavano/bff...

# --- Slim runtime image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Video transcode + poster extraction (VideoProcessingService) and server-side duration
# verification (POST /uploads/video, POST /listings/:id/videos) — added only to this stage, not
# `base` (which `pruner`/`installer` also inherit and don't need it). No hardware video engine on
# Graviton2 (this instance's arm64 CPU) — pure software libx264. The version asserts are
# deliberate: Alpine has historically shuffled which subpackage ships `ffprobe`, and a missing
# binary would otherwise only surface as a runtime 500 on the first production video upload.
RUN apk add --no-cache ffmpeg && ffmpeg -version && ffprobe -version
RUN addgroup --system --gid 1001 nestjs && adduser --system --uid 1001 nestjs

COPY --from=installer --chown=nestjs:nestjs /app .
# Reused as the video-processing temp dir (VIDEO_TMP_DIR) — see docker-compose.prod.yml for the
# dedicated volume mounted here so a container restart doesn't strand temp files in the image's
# writable layer.
RUN mkdir -p /app/apps/bff/uploads && chown nestjs:nestjs /app/apps/bff/uploads
# Rotating request/response logs (see docs/plans/bff-loki-grafana-logging.md) — shared with the
# alloy container via a Docker volume mounted at this same path.
RUN mkdir -p /app/apps/bff/logs && chown nestjs:nestjs /app/apps/bff/logs

USER nestjs
WORKDIR /app/apps/bff
ENV PORT=4000
EXPOSE 4000
# tsc's rootDir inference includes prisma.config.ts (which sits next to src/), so the compiled
# entrypoint lands at dist/src/main.js, not dist/main.js.
CMD ["node", "dist/src/main"]
