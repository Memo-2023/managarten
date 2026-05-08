# syntax=docker/dockerfile:1
#
# apps/api — unified Hono/Bun API server
#
# Multi-stage build:
#   - builder: node:20-alpine with pnpm to resolve the workspace
#     dependency graph (@mana/shared-hono + 3 more workspace packages).
#     Bun's install command doesn't read pnpm-workspace.yaml, so we use
#     pnpm here even though the runtime is Bun.
#   - runtime: oven/bun:1 to actually run the server. Bun handles the
#     pnpm symlink farm at node_modules/.pnpm/* natively, so the only
#     thing the runtime stage needs is the workspace tree the builder
#     produced and the entry script.
#
# Build context MUST be the monorepo root, not apps/api/. The compose
# service uses `context: .` for this reason.

FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9.15.0

# Copy the workspace manifest first so the dependency graph is known
# before we add source. This caches the install layer for incremental
# rebuilds when only source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Repo-`.npmrc` enthält die Auth-Variable `${NPM_TOKEN}` für
# `npm.mana.how`. pnpm substituiert die Variable aus dem ENV unten —
# der Token landet nicht in einem Layer (kein `RUN echo` mit dem Wert).
COPY .npmrc ./
COPY apps/api/package.json ./apps/api/package.json

# Workspace packages that apps/api depends on, plus their transitive
# workspace deps. Listed explicitly so the install layer doesn't pull
# in the entire monorepo. When adding a new @mana/* import to any
# apps/api module, add the package here too — otherwise the runtime
# fails with "ENOENT reading /app/apps/api/node_modules/@mana/<x>".
COPY packages/shared-hono ./packages/shared-hono
COPY packages/shared-logger ./packages/shared-logger
COPY packages/shared-storage ./packages/shared-storage
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-ai ./packages/shared-ai
COPY packages/shared-rss ./packages/shared-rss
# Root package.json devDeps reference @mana/eslint-config; pnpm filter
# install still resolves the root, so the package needs to be present
# even though apps/api itself doesn't import from it.
COPY packages/eslint-config ./packages/eslint-config
# `@mana/media-client` kommt seit dem 8-Doppel-Cutover (2026-05-08) aus
# Verdaccio (`npm.mana.how`), nicht mehr als Workspace-COPY aus
# `services/mana-media/packages/client/` (das Verzeichnis verschwindet
# mit Phase 7).

# Resolve the dependency graph for apps/api only (--filter ...
# follows the workspace transitive deps automatically). NPM_TOKEN ist
# Build-Arg aus `docker-compose.macmini.yml` → `args.NPM_TOKEN` und wird
# von pnpm in `.npmrc` substituiert.
ARG NPM_TOKEN
ENV NPM_TOKEN=${NPM_TOKEN}
RUN pnpm install --filter @mana/api... --no-frozen-lockfile --ignore-scripts

# Copy the api source and tsconfig last so source-only changes don't
# bust the install cache.
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json


# ─── Runtime stage ─────────────────────────────────────────────
#
# Bun can run TypeScript directly without a compile step, so the
# runtime image just needs the workspace tree the builder produced.
# We copy /app wholesale rather than try to slice node_modules — the
# pnpm symlink farm is fragile and easy to break with selective copies.

FROM oven/bun:1 AS production

WORKDIR /app
COPY --from=builder /app /app

WORKDIR /app/apps/api

EXPOSE 3060

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:3060/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
