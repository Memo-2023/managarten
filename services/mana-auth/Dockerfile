# Install stage: use node + pnpm to resolve workspace dependencies.
# Build context must be the monorepo root (see docker-compose.macmini.yml).
FROM node:22-alpine AS installer

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/mana-auth/package.json ./services/mana-auth/
COPY packages/shared-hono ./packages/shared-hono
COPY packages/shared-ai ./packages/shared-ai
COPY packages/shared-logger ./packages/shared-logger
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-error-tracking ./packages/shared-error-tracking
# Root package.json devDeps reference @mana/eslint-config; pnpm filter
# install still resolves the root, so the package needs to be present
# even though mana-auth itself doesn't import from it.
COPY packages/eslint-config ./packages/eslint-config

# Install only mana-auth and its workspace deps
RUN pnpm install --filter @mana/auth... --no-frozen-lockfile --ignore-scripts

# Runtime stage: bun
FROM oven/bun:1 AS production

WORKDIR /app

# Copy installed deps from installer stage
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/services/mana-auth/node_modules ./services/mana-auth/node_modules
COPY --from=installer /app/packages ./packages

# Copy source
COPY services/mana-auth/package.json ./services/mana-auth/
COPY services/mana-auth/src ./services/mana-auth/src
COPY services/mana-auth/tsconfig.json services/mana-auth/drizzle.config.ts ./services/mana-auth/

WORKDIR /app/services/mana-auth

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
