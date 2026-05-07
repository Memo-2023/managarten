# Install stage: use node + pnpm to resolve workspace dependencies.
# Cards-server is bun-runtime, but pnpm is the only sane way to do
# workspace deps with @mana/shared-hono symlinks.
FROM node:22-alpine AS installer

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/cards-server/package.json ./services/cards-server/
COPY packages/shared-hono ./packages/shared-hono
COPY packages/shared-logger ./packages/shared-logger
COPY packages/shared-types ./packages/shared-types

# Workspace name is `@mana/cards-server`; the trailing `...` includes
# its workspace dependencies.
RUN pnpm install --filter @mana/cards-server... --no-frozen-lockfile --ignore-scripts

# Runtime stage: bun
FROM oven/bun:1 AS production

WORKDIR /app

COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/services/cards-server/node_modules ./services/cards-server/node_modules
COPY --from=installer /app/packages ./packages

COPY services/cards-server/package.json ./services/cards-server/
COPY services/cards-server/src ./services/cards-server/src
COPY services/cards-server/tsconfig.json services/cards-server/drizzle.config.ts ./services/cards-server/

WORKDIR /app/services/cards-server

EXPOSE 3072

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3072/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
