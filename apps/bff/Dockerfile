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
RUN addgroup --system --gid 1001 nestjs && adduser --system --uid 1001 nestjs

COPY --from=installer --chown=nestjs:nestjs /app .
RUN mkdir -p /app/apps/bff/uploads && chown nestjs:nestjs /app/apps/bff/uploads

USER nestjs
WORKDIR /app/apps/bff
ENV PORT=4000
EXPOSE 4000
# tsc's rootDir inference includes prisma.config.ts (which sits next to src/), so the compiled
# entrypoint lands at dist/src/main.js, not dist/main.js.
CMD ["node", "dist/src/main"]
