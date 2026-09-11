# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

# --- Prune the monorepo down to just what @bhavano/web needs ---
FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @bhavano/web --docker

# --- Install deps and build ---
FROM base AS installer
WORKDIR /app
# NEXT_PUBLIC_* used in client bundles are inlined at `next build` time — pass them as build
# args (see docker-compose.prod.yml `web.build.args`), not only as runtime `environment:`.
ARG NEXT_PUBLIC_BFF_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GTM_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY
ENV NEXT_PUBLIC_BFF_URL=$NEXT_PUBLIC_BFF_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID
ENV NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY
COPY --from=pruner /app/out/json/ .
# Cache mounts persist across builds (on the host's BuildKit cache, not in the image layer) —
# `pnpm-store` is shared with the admin/bff Dockerfiles' own install steps since pnpm's store is
# content-addressed, so a package fetched for one app is already there for the others. `turbo-cache`
# and `next-cache-web` similarly let unchanged packages/routes skip rebuilding entirely instead of
# redoing a full install + build from zero on every deploy.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN --mount=type=cache,id=turbo-cache,target=/app/.turbo \
    --mount=type=cache,id=next-cache-web,target=/app/apps/web/.next/cache \
    pnpm turbo run build --filter=@bhavano/web...

# --- Slim runtime image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
