# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

# --- Prune the monorepo down to just what @bhavano/admin needs ---
FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @bhavano/admin --docker

# --- Install deps and build ---
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
# See apps/web/Dockerfile's own comment — `pnpm-store` is shared across all three Dockerfiles'
# install steps (content-addressed, so already-fetched packages are reused), `turbo-cache` and
# `next-cache-admin` let unchanged packages/routes skip rebuilding on every deploy.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN --mount=type=cache,id=turbo-cache,target=/app/.turbo \
    --mount=type=cache,id=next-cache-admin,target=/app/apps/admin/.next/cache \
    pnpm turbo run build --filter=@bhavano/admin...

# --- Slim runtime image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=installer --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

USER nextjs
ENV PORT=3001
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
