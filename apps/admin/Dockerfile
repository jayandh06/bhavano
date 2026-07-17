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
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@bhavano/admin...

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
