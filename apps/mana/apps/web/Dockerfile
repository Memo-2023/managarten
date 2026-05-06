# syntax=docker/dockerfile:1
FROM sveltekit-base:local AS builder

ARG PUBLIC_BACKEND_URL=http://mana-auth
ARG PUBLIC_MANA_AUTH_URL=http://mana-auth:3001
ARG MIDDLEWARE_URL=http://mana-auth:3001
ARG PUBLIC_SYNC_SERVER_URL=wss://sync.mana.how
ENV PUBLIC_BACKEND_URL=$PUBLIC_BACKEND_URL
ENV PUBLIC_MANA_AUTH_URL=$PUBLIC_MANA_AUTH_URL
ENV MIDDLEWARE_URL=$MIDDLEWARE_URL
ENV PUBLIC_SYNC_SERVER_URL=$PUBLIC_SYNC_SERVER_URL

COPY apps/mana/apps/web ./apps/mana/apps/web
COPY apps/calc/packages/shared ./apps/calc/packages/shared
COPY apps/quotes/packages/content ./apps/quotes/packages/content
COPY packages/shared-uload ./packages/shared-uload
COPY packages/local-llm ./packages/local-llm
COPY packages/local-stt ./packages/local-stt
COPY packages/shared-llm ./packages/shared-llm
COPY packages/shared-ai ./packages/shared-ai
COPY packages/cards-core ./packages/cards-core
COPY packages/shared-crypto ./packages/shared-crypto
COPY packages/website-blocks ./packages/website-blocks

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile --ignore-scripts

# Build dependencies that need compilation
WORKDIR /app/apps/quotes/packages/content
RUN pnpm build

WORKDIR /app/apps/mana/apps/web
RUN pnpm exec svelte-kit sync
# Build heap was bumped 4096→8192 after the unified app grew past the
# 4 GB ceiling — Vite OOMs while bundling all 32 module chunks otherwise.
RUN NODE_OPTIONS="--max-old-space-size=8192" pnpm build

FROM node:20-alpine AS production
WORKDIR /app/apps/mana/apps/web
COPY --from=builder /app/node_modules/.pnpm /app/node_modules/.pnpm
COPY --from=builder /app/apps/mana/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/mana/apps/web/build ./build
COPY --from=builder /app/apps/mana/apps/web/package.json ./

EXPOSE 5000
ENV NODE_ENV=production PORT=5000 HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "build"]
