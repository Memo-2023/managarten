# cards-server

Cards Marketplace + Community backend. Owns the published-deck side of
the Cards product (the standalone app at `cards.mana.how` is the
client). Phase α is the data skeleton — schema + bootstrap + JWT auth
in place; routes land progressively in Phase β onwards.

For the full design rationale, phasing, and contract decisions see
**[`apps/cards/docs/MARKETPLACE_PLAN.md`](../../apps/cards/docs/MARKETPLACE_PLAN.md)**.

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Bun |
| Framework | Hono |
| Database | PostgreSQL (`mana_platform.cards.*` schema) + Drizzle ORM |
| Auth | JWT via JWKS from mana-auth (EdDSA, jose) |
| Money | mana-credits — never Stripe directly |

## Port: 3072

## Quick Start

```bash
# Schema push (writes to local mana_platform DB)
bun run db:push

# Dev server with watch
bun run dev

# Type check
bun run type-check
```

## Database

Schema: **`cards`** inside the shared `mana_platform` DB. 17 tables across
six logical groups (matching the source files in `src/db/schema/`):

| File | Tables |
|------|--------|
| `authors.ts` | `cards.authors`, `cards.author_follows` |
| `decks.ts` | `cards.decks`, `cards.deck_versions`, `cards.deck_cards` |
| `tags.ts` | `cards.tag_definitions`, `cards.deck_tags` |
| `engagement.ts` | `cards.deck_stars`, `cards.deck_subscriptions`, `cards.deck_forks` |
| `discussions.ts` | `cards.deck_pull_requests`, `cards.card_discussions` |
| `moderation.ts` | `cards.deck_reports`, `cards.ai_moderation_log` |
| `credits.ts` | `cards.deck_purchases`, `cards.author_payouts` |

`co_learn_sessions` (Phase λ) is intentionally not yet in the schema.
Every table is created via `pgSchema('cards')` per the Mana convention.

## Auth model

Three middleware:

- `jwtAuth(authUrl)` — validates Bearer tokens via JWKS. Sets
  `c.set('user', { userId, email, role })`. Used on every user-facing
  `/v1/*` route.
- `serviceAuth(serviceKey)` — `X-Service-Key` check for service-to-
  service calls (e.g. mana-credits-webhook → cards-server).
- (planned) `optionalAuth` — for routes that should respond
  differently when the caller is signed-in but never reject anonymous.

## Phasing (per MARKETPLACE_PLAN §11)

| Phase | What lands | Where |
|-------|-----------|-------|
| **α** | Skeleton + schema + JWT + health | now |
| β | Author publish flow + AI-mod-first-pass | next |
| γ | Discovery (browse, search, tags, follow) | |
| δ | Subscribe + smart-merge | |
| ε | Pull-requests + discussions | |
| ζ | mana-credits marketplace | |
| η | Moderation + trust | |
| θ | Deep AI (auto-tags, embeddings, audio) | |
| ι | Optimisation + scale | |

## Environment Variables

```env
PORT=3072
DATABASE_URL=postgresql://mana:devpassword@localhost:5432/mana_platform
MANA_AUTH_URL=http://localhost:3001
MANA_CREDITS_URL=http://localhost:3061
MANA_LLM_URL=http://localhost:3025
MANA_MEDIA_URL=http://localhost:3015
MANA_NOTIFY_URL=http://localhost:3040
MANA_SERVICE_KEY=dev-service-key
CORS_ORIGINS=http://localhost:5173,http://localhost:5180

# Author payout splits (basis points). Defaults: 80/20 standard,
# 90/10 verified-mana.
AUTHOR_PAYOUT_STANDARD_BPS=8000
AUTHOR_PAYOUT_VERIFIED_BPS=9000

# Community-verified auto-thresholds.
COMMUNITY_VERIFY_STARS=500
COMMUNITY_VERIFY_FEATURED=3
COMMUNITY_VERIFY_SUBSCRIBERS=200
```

## Critical Rules

- **Never call Stripe directly.** All money flows through mana-credits.
- **`/v1` is the public contract** — additive-only changes within v1, breaking changes go to `/v2`.
- **Content-hash everything.** Per-card and per-version SHA-256s drive smart-merge, cache invalidation, and trust.
- **Subscribed Decks are unidirectional.** Author → Subscriber. Forks for the bidirectional case.
- **Verification is binary, not numeric.** Two flags (`verified_mana`, `verified_community`), the UI shows badges. Never invent a "trust score".
