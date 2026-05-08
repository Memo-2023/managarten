# Environment Variables Guide

This document explains the centralized environment variable system for the Mana monorepo.

## Quick Start

```bash
# After cloning the repo, install dependencies (auto-generates .env files)
pnpm install

# Or manually generate .env files
pnpm setup:env
```

That's it! All app-specific `.env` files are generated from `.env.development`.

## How It Works

```
.env.development          # Central config (committed, no secrets)
        │
        ├── .env.secrets   # Optional gitignored override (your API keys)
        ▼
scripts/generate-env.mjs   # Merges + transforms variables
        │
        ▼
apps/**/apps/**/.env       # Generated files (gitignored)
```

The generator reads `.env.development` first, then layers `.env.secrets` (if it exists) on
top — non-empty values in `.env.secrets` override the matching key in `.env.development`.
This is where personal dev secrets like `MANA_STT_API_KEY` live, so you don't have to
re-paste them into per-app `.env` files after every `pnpm setup:env`.

To populate `.env.secrets` from the Mac Mini in one shot, run `pnpm setup:secrets` (see
[`docs/LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md#personal-dev-secrets--envsecrets) for
the full walk-through).

The generator then creates app-specific `.env` files with the correct prefixes for each platform:

| Platform | Prefix | Example |
|----------|--------|---------|
| Expo (mobile) | `EXPO_PUBLIC_` | `EXPO_PUBLIC_SUPABASE_URL` |
| SvelteKit (web) | `PUBLIC_` | `PUBLIC_SUPABASE_URL` |
| Hono/Bun (server) | None | `DATABASE_URL` |

## File Locations

### Source File
- **`.env.development`** - Single source of truth, committed to git

### Generated Files (gitignored)
- `services/mana-auth/.env`
- `apps/chat/apps/server/.env`
- `apps/chat/apps/mobile/.env`
- `apps/chat/apps/web/.env`
- `apps/mana/apps/mobile/.env`
- `apps/mana/apps/web/.env`
- `apps/cards/apps/server/.env`
- `apps/cards/apps/web/.env`
- `apps/*/apps/server/.env` (all apps with compute servers)
- `apps/*/apps/web/.env` (all web apps)
- `apps/*/apps/mobile/.env` (all mobile apps)

## Variable Reference

### Shared Variables

| Variable | Description | Used By |
|----------|-------------|---------|
| `MANA_AUTH_URL` | Auth service URL | All apps |
| `JWT_PRIVATE_KEY` | JWT signing key | mana-auth |
| `JWT_PUBLIC_KEY` | JWT verification key | All backends |
| `POSTGRES_USER` | Database user | Docker, backends |
| `POSTGRES_PASSWORD` | Database password | Docker, backends |
| `REDIS_HOST` | Redis host | mana-auth |
| `REDIS_PORT` | Redis port | mana-auth |
| `REDIS_PASSWORD` | Redis password | mana-auth |

### Mana Auth Service

| Variable | Description | Default |
|----------|-------------|---------|
| `MANA_AUTH_PORT` | Service port | `3001` |
| `MANA_AUTH_DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_ACCESS_TOKEN_EXPIRY` | Access token TTL | `15m` |
| `JWT_REFRESH_TOKEN_EXPIRY` | Refresh token TTL | `7d` |
| `JWT_ISSUER` | JWT issuer claim | `mana` |
| `JWT_AUDIENCE` | JWT audience claim | `mana` |
| `STRIPE_SECRET_KEY` | Stripe secret key | - |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | - |
| `CORS_ORIGINS` | Allowed CORS origins | - |
| `RATE_LIMIT_TTL` | Rate limit window (seconds) | `60` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

### Chat Project

| Variable | Description | Default |
|----------|-------------|---------|
| `CHAT_BACKEND_PORT` | Backend service port | `3002` |
| `CHAT_DATABASE_URL` | PostgreSQL connection string | - |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | - |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | - |
| `AZURE_OPENAI_API_VERSION` | API version | `2024-12-01-preview` |
| `CHAT_SUPABASE_URL` | Supabase project URL | - |
| `CHAT_SUPABASE_ANON_KEY` | Supabase anonymous key | - |

### Mana Project

| Variable | Description |
|----------|-------------|
| `MANA_SUPABASE_URL` | Supabase project URL |
| `MANA_SUPABASE_ANON_KEY` | Supabase anonymous key |

### Mana API — Articles Bulk-Import Worker

| Variable | Description | Default |
|----------|-------------|---------|
| `ARTICLES_IMPORT_WORKER_DISABLED` | Set to `true` to skip starting the bulk-import worker on this apps/api instance. Useful for tests, or when running multiple apps/api replicas and you want to designate a specific one as the worker. The worker uses `pg_try_advisory_xact_lock` so multiple instances are safe by default — this env-var is the explicit opt-out. | `false` |

### Cardecky Project

| Variable | Description | Default |
|----------|-------------|---------|
| `CARDS_BACKEND_PORT` | Backend service port | `3004` |
| `CARDS_SUPABASE_URL` | Supabase project URL | - |
| `CARDS_SUPABASE_ANON_KEY` | Supabase anonymous key | - |

### Speech-to-Text (mana-stt)

Used by the unified Mana web app's voice features (Memoro recording, Dreams voice capture, Notes
voice memos, Todo voice quick-add, etc). The browser never talks to mana-stt directly — requests
go through the SvelteKit server-side proxy at `/api/v1/voice/transcribe` which attaches the API
key from `MANA_STT_API_KEY`. Keep that key out of the browser bundle.

| Variable | Description | Default |
|----------|-------------|---------|
| `STT_URL` | Public mana-stt URL — generates `MANA_STT_URL` for the web app | `https://gpu-stt.mana.how` |
| `MANA_STT_API_KEY` | API key for mana-stt. **Never commit a real value.** | _(empty)_ |

**Where to obtain a key:**

- **Production (Mac Mini)**: `MANA_STT_API_KEY` is read from `~/projects/managarten/.env`
  on the Mac Mini and injected into the `mana-web` container by `docker-compose.macmini.yml`
  (the `mana-web` service block, alongside `MANA_STT_URL=https://gpu-stt.mana.how`). To rotate,
  update the `.env` value and recreate the container with
  `docker compose -f docker-compose.macmini.yml up -d --no-deps --force-recreate mana-web`.
- **Local dev**: paste the dev key into your local `apps/mana/apps/web/.env` after running
  `pnpm setup:env` (the generator only writes an empty placeholder). Ask in `#mana-dev` or
  pull from the team's password manager under `mana-stt → web-key`.
- **Source of truth**: `services/mana-stt/.env` on the Windows GPU box, in the `API_KEYS`
  variable. Each entry is `<random>:<name>` and gets rate-limited per key.
- **Adding a new key**: SSH to the Windows GPU box (`ssh mana-gpu`), append a new entry to
  `C:\mana\services\mana-stt\.env` `API_KEYS`, restart the `ManaSTT` scheduled task. Use a
  fresh key per consumer (`mana-web`, `chat-server`, etc.) so they can be revoked individually.

**Endpoint:** `https://gpu-stt.mana.how` — Cloudflare Tunnel `mana-gpu-server` (token-managed,
runs as a Windows Service on the GPU box, **not** as a route in the Mac Mini's cloudflared).
The tunnel terminates at `localhost:3020` on the Windows host.

**Health check**:

```bash
curl https://gpu-stt.mana.how/health
# → {"status":"healthy","whisper_loaded":true,"whisperx":true,...}
```

If this returns 502, see "GPU Tunnel" in `docs/MAC_MINI_SERVER.md` for the standard
debug ladder.

### LLM gateway (mana-llm)

Used by the unified Mana web app's voice quick-add features to turn transcripts into structured
data: `/api/v1/voice/parse-task` (todo titles + due dates + priorities) and `/api/v1/voice/parse-habit`
(habit picker for voice logging). Both proxies live server-side and degrade gracefully — if
mana-llm is unreachable or unauthorized, the endpoints return a fallback shape and voice quick-add
still works, just without LLM enrichment.

| Variable | Description | Default |
|----------|-------------|---------|
| `MANA_LLM_URL` | mana-llm gateway URL (server-side, never exposed) | `http://localhost:3025` |
| `MANA_LLM_API_KEY` | API key — required when pointing at the GPU LLM proxy. **Never commit a real value.** | _(empty)_ |
| `PUBLIC_MANA_LLM_URL` | Same URL exposed to the browser for direct use (status page, playground) | mirrors `MANA_LLM_URL` |

**Local dev**: leave `MANA_LLM_URL=http://localhost:3025` and run mana-llm in Docker. If your local
mana-llm has no models loaded (`curl http://localhost:3025/v1/models` returns `{"data":[]}`), point
at the public proxy with `MANA_LLM_URL=https://gpu-llm.mana.how` and set `MANA_LLM_API_KEY` to a key
from `services/mana-llm/.env` on the GPU box.

**Endpoints:** `http://localhost:3025` (Docker), `https://llm.mana.how` (Mac Mini, no auth),
`https://gpu-llm.mana.how` (GPU server, X-API-Key required).

## Adding New Variables

### Step 1: Add to `.env.development`

```bash
# In .env.development
MY_NEW_PROJECT_API_KEY=your-api-key
MY_NEW_PROJECT_URL=https://api.example.com
```

### Step 2: Update the Generator Script

Edit `scripts/generate-env.mjs` and add your app config:

```javascript
// In APP_CONFIGS array
{
  path: 'apps/my-project/apps/mobile/.env',
  vars: {
    // For Expo, add EXPO_PUBLIC_ prefix
    EXPO_PUBLIC_API_KEY: (env) => env.MY_NEW_PROJECT_API_KEY,
    EXPO_PUBLIC_API_URL: (env) => env.MY_NEW_PROJECT_URL,
  },
},
{
  path: 'apps/my-project/apps/web/.env',
  vars: {
    // For SvelteKit, add PUBLIC_ prefix
    PUBLIC_API_KEY: (env) => env.MY_NEW_PROJECT_API_KEY,
    PUBLIC_API_URL: (env) => env.MY_NEW_PROJECT_URL,
  },
},
{
  path: 'apps/my-project/apps/server/.env',
  vars: {
    // For Hono/Bun servers, no prefix needed
    API_KEY: (env) => env.MY_NEW_PROJECT_API_KEY,
    API_URL: (env) => env.MY_NEW_PROJECT_URL,
  },
},
```

### Step 3: Regenerate

```bash
pnpm setup:env
```

## Local Overrides

If you need to override variables locally without affecting others:

1. The generated `.env` files are gitignored
2. You can manually edit them after generation
3. Or create `.env.local` files (also gitignored) that some frameworks auto-load

**Note:** Running `pnpm setup:env` will overwrite your changes, so use `.env.local` for persistent overrides.

## Docker Integration

The root `.env.development` is also used by Docker Compose:

```bash
# Start all services with shared env
pnpm docker:up:all
```

Docker services read from:
- Root `.env.development` for shared values
- Service-specific `.env` files for service-specific values

## Troubleshooting

### "Variable is undefined" Error

1. Check if the variable exists in `.env.development`
2. Run `pnpm setup:env` to regenerate
3. Restart your dev server (env changes require restart)

### Generated File Has Wrong Value

1. Check the mapping in `scripts/generate-env.mjs`
2. Ensure the source variable name matches exactly
3. Run `pnpm setup:env` again

### New App Not Getting Generated

1. Add app config to `APP_CONFIGS` in `scripts/generate-env.mjs`
2. Ensure the target directory exists
3. Run `pnpm setup:env`

### Expo Not Picking Up Changes

Expo caches environment variables. Clear the cache:

```bash
cd apps/<project>/apps/mobile
npx expo start -c
```

## Security Notes

- `.env.development` contains **development-only** values
- Never put production secrets in this file
- The JWT keys in `.env.development` are for local development only
- Use separate secrets management for production (1Password, AWS Secrets Manager, etc.)

## Migration from Old System

If you have existing `.env` files with real values:

1. Copy important values to `.env.development`
2. Delete the old `.env` files
3. Run `pnpm setup:env`
4. Verify apps still work

The old `.env.example` files can remain as documentation.
