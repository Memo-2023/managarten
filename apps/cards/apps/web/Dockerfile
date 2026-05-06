# syntax=docker/dockerfile:1
# Cards Standalone — cards.mana.how. Mirrors apps/manavoxel/apps/web/Dockerfile.

# ─── Stage 1: Build ──────────────────────────────────────────
FROM sveltekit-base:local AS builder

ARG PUBLIC_MANA_AUTH_URL=http://mana-auth:3001
ARG PUBLIC_SYNC_SERVER_URL=http://mana-sync:3050
ENV PUBLIC_MANA_AUTH_URL=$PUBLIC_MANA_AUTH_URL
ENV PUBLIC_SYNC_SERVER_URL=$PUBLIC_SYNC_SERVER_URL

# Cards-specific app sources. The shared @mana/* packages already live in
# the sveltekit-base image; we only copy what's unique to this app.
COPY apps/cards/apps/web ./apps/cards/apps/web
COPY packages/cards-core ./packages/cards-core

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile --ignore-scripts

WORKDIR /app/apps/cards/apps/web
RUN pnpm exec svelte-kit sync
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm build

# ─── Stage 2: Production ─────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app/apps/cards/apps/web

COPY --from=builder /app/node_modules/.pnpm /app/node_modules/.pnpm
COPY --from=builder /app/apps/cards/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/cards/apps/web/build ./build
COPY --from=builder /app/apps/cards/apps/web/package.json ./

EXPOSE 5180

ENV NODE_ENV=production
ENV PORT=5180
ENV HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5180/ || exit 1

CMD ["node", "build"]
