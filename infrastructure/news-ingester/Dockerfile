# News-ingester for GPU-Box — workspace-aware (vendors shared-rss).
# Context: repo root. Use this Dockerfile when deploying news-ingester
# on the GPU-Box (the one in services/news-ingester/Dockerfile is
# Mini-side and assumes the cached pnpm-workspace state).
FROM oven/bun:1 AS production
WORKDIR /app

COPY packages/shared-rss ./packages/shared-rss
COPY services/news-ingester/package.json ./services/news-ingester/
COPY services/news-ingester/src ./services/news-ingester/src
COPY services/news-ingester/tsconfig.json services/news-ingester/drizzle.config.ts ./services/news-ingester/

WORKDIR /app/services/news-ingester
RUN sed -i 's|"@mana/shared-rss": "workspace:\*"|"@mana/shared-rss": "file:../../packages/shared-rss"|' package.json && \
    bun install

EXPOSE 3066
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://localhost:3066/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
