# Local Development Guide

This guide explains how to set up and run applications locally. All apps use a **local-first architecture** with IndexedDB (Dexie.js) for reads/writes and mana-sync for background synchronization. Server-side compute (AI, file operations, RRULE expansion, etc.) is handled by lightweight **Hono/Bun servers**.

## Quick Start

### Fastest: `dev:*:local` (recommended for daily development)

No auth service needed. Starts mana-sync + server (if any) + web:

```bash
pnpm dev:todo:local       # sync + server + web
pnpm dev:chat:local       # sync + server + web
pnpm dev:quotes:local     # sync + web (no server needed)
pnpm dev:clock:local      # sync + web (no server needed)
```

Guest mode works out of the box -- data lives in IndexedDB, no login required.

### Full stack: `dev:*:full` (with auth + database setup)

Use this when you need authentication, cross-device sync, or to test the full production flow:

```bash
pnpm dev:todo:full        # DB setup + auth + sync + server + web
pnpm dev:chat:full        # DB setup + auth + sync + server + web
pnpm dev:quotes:full      # auth + sync + web
pnpm dev:calendar:full    # DB setup + auth + sync + server + web
```

These commands automatically:
1. Create the database if it doesn't exist (for apps with Drizzle schemas)
2. Push the latest schema (`drizzle-kit push --force`)
3. Start the auth service (mana-auth)
4. Start mana-sync (Go WebSocket server)
5. Start the Hono/Bun server (if the app has one)
6. Start the web app with colored output

## Available Dev Commands

### Apps with Hono/Bun Servers

These apps have server-side compute and support both `local` and `full` modes:

| App | Server Port | Web Port | `local` | `full` |
|-----|-------------|----------|---------|--------|
| Todo | 3019 | 5188 | Yes | Yes |
| Chat | 3002 | 5174 | Yes | Yes |
| Calendar | 3003 | 5179 | Yes | Yes |
| Contacts | 3004 | 5184 | Yes | Yes |
| Picture | 3006 | 5175 | Yes | Yes |
| Cardecky | 3009 | 5176 | Yes | Yes |
| Mukke | 3010 | 5180 | Yes | Yes |
| Questions | 3011 | 5111 | Yes | Yes |
| Storage | 3016 | 5185 | Yes | Yes |
| Context | 3020 | 5192 | Yes | Yes |
| Planta | 3022 | 5191 | Yes | Yes |
| Food | 3023 | 5180 | Yes | Yes |
| Traces | 3026 | mobile | Yes | Yes |
| Presi | 3008 | 5178 | Yes | Yes |
| uLoad | 3070 | 5173 | Yes | Yes |
| News | 3071 | 5173 | Yes | Yes |
| WiseKeep | 3072 | 5173 | Yes | Yes |
| Moodlit | 3073 | 5173 | Yes | Yes |

### Apps without Servers (sync + web only)

These apps use only IndexedDB + mana-sync, no server-side compute:

| App | Web Port | `local` | `full` |
|-----|----------|---------|--------|
| Quotes | 5107 | Yes | Yes |
| Clock | 5187 | Yes | Yes |
| SkilltTree | 5195 | Yes | Yes |
| Photos | 5189 | Yes | Yes |
| CityCorners | 5196 | Yes | Yes |
| Inventar | 5190 | Yes | Yes |
| Times | 5197 | Yes | Yes |
| Calc | 5198 | Yes | Yes |
| ManaVoxel | 5028 | Yes | Yes |

### Infrastructure Ports

| Service | Port | Description |
|---------|------|-------------|
| mana-auth | 3001 | Central auth (Better Auth + EdDSA JWT) |
| mana-sync | 3050 | Data sync (Go, WebSocket, field-level LWW) |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| MinIO API | 9000 | S3-compatible storage |
| MinIO Console | 9001 | Storage web UI |

## Prerequisites

Before running any `dev:*:full` command:

```bash
# 1. Start Docker infrastructure (PostgreSQL, Redis, MinIO)
pnpm docker:up

# 2. Build mana-sync (first time only, or after Go changes)
pnpm dev:sync:build

# 3. (Optional) Pull dev secrets from the Mac Mini into .env.secrets
pnpm setup:secrets

# 4. Generate environment files (runs automatically on pnpm install)
pnpm setup:env
```

For `dev:*:local`, only mana-sync needs to be built. No Docker required unless your server uses a database.

### Personal dev secrets — `.env.secrets`

`.env.development` is committed and contains non-secret defaults. Real API keys (mana-stt,
gpu-llm, OpenRouter, etc.) live in a separate gitignored `.env.secrets` at the repo root.
The env generator merges this file on top of `.env.development`, so any key you set there
gets propagated into every per-app `.env` on `pnpm setup:env` — no more re-pasting keys
into individual app folders after every regeneration.

**One-time setup:**

```bash
# Pulls keys from ~/projects/mana-monorepo/.env on the Mac Mini via SSH
pnpm setup:secrets

# Then propagate into per-app .env files
pnpm setup:env
```

`pnpm setup:secrets` reads `.env.secrets.example` to know which keys to look for, asks
before overwriting an existing `.env.secrets`, and reports which keys it couldn't find on
the remote (some service-specific keys live in their own per-service `.env` files on the
Mac Mini and need to be filled in manually).

If you don't have SSH access to `mana-server`, copy the template and fill values manually:

```bash
cp .env.secrets.example .env.secrets
$EDITOR .env.secrets
pnpm setup:env
```

Empty values in `.env.secrets` are no-ops — they fall through to the `.env.development`
defaults. So a freshly-copied template doesn't change anything until you start filling
keys in.

## Database Setup Commands

### Individual Service Setup

```bash
pnpm setup:db:auth        # Setup mana-auth database + schema
pnpm setup:db:chat        # Setup chat database + schema
pnpm setup:db:todo        # Setup todo database + schema
pnpm setup:db:contacts    # Setup contacts database + schema
pnpm setup:db:calendar    # Setup calendar database + schema
pnpm setup:db:picture     # Setup picture database + schema
pnpm setup:db:uload       # Setup uload database + schema
pnpm setup:db:context     # Setup context database + schema
pnpm setup:db:storage     # Setup storage database + schema
pnpm setup:db:mukke       # Setup mukke database + schema
pnpm setup:db:plants      # Setup plants database + schema
pnpm setup:db:food    # Setup food database + schema
pnpm setup:db:questions   # Setup questions database + schema
pnpm setup:db:traces      # Setup traces database + schema
```

### Setup All Databases

```bash
pnpm setup:db             # Creates ALL databases and pushes ALL schemas
```

## Local Login & Dev Users

The local mana-auth has `requireEmailVerification: true` and no real
SMTP wired up, so a freshly-registered user can't actually log in until
the verification flag is flipped manually. There's also no built-in
admin seed and no `DEV_BYPASS_AUTH` env var. Use the convenience script:

```bash
pnpm setup:dev-user
```

Creates three founder-tier accounts with `email_verified = true` so
you can immediately exercise every tier-gated module:

| Email | Password | Tier |
|---|---|---|
| `tills95@gmail.com` | `Aa-123456789` | founder |
| `tilljkb@gmail.com` | `Aa-123456789` | founder |
| `rajiehq@gmail.com` | `Aa-123456789` | founder |

Login at http://localhost:5173/login with any of them.

**Single account / custom credentials:**

```bash
./scripts/dev/setup-dev-user.sh you@example.com YourPassword
```

**Override defaults via env:**

```bash
TIER=alpha AUTH_URL=http://localhost:3001 pnpm setup:dev-user
```

The script is **idempotent** — re-running re-applies `email_verified`
+ `access_tier` to existing users without touching their password.

**Prereqs**: Postgres up (`pnpm docker:up`), mana-auth running on
:3001 (`pnpm dev:auth`), `psql` in `PATH`. Both gates fail loud if
missing.

**How it works internally**: `POST /api/v1/auth/register` so Better
Auth's `signUpEmail` handles password hashing correctly, then
`UPDATE auth.users SET email_verified = true, access_tier = 'founder'`
to bypass the missing local SMTP and lift the tier in one step.

This is useful when setting up a fresh environment or after pulling new schema changes.

## How It Works

### Architecture

```
Guest:      App -> IndexedDB (Dexie.js) -> UI              (no sync)
Logged in:  App -> IndexedDB -> UI -> SyncEngine -> mana-sync (Go) -> PostgreSQL
                                    <- WebSocket push <-
```

**mana-sync** (Go, port 3050) handles WebSocket-based sync with field-level last-write-wins conflict resolution. All CRUD goes through IndexedDB first, making the UI instant regardless of network.

**Hono/Bun servers** handle operations that cannot run client-side:
- AI/LLM calls (chat, questions, picture generation)
- File operations (storage, media processing)
- RRULE expansion and reminder scheduling (todo, calendar)
- Server-side data processing (news extraction, transcription)

### Docker Init Script

On first `pnpm docker:up`, the PostgreSQL container runs `docker/init-db/01-create-databases.sql` which creates all databases.

### Setup Script

The `scripts/setup-databases.sh` script:

1. **Creates database** if it doesn't exist (using `psql`)
2. **Pushes schema** using `drizzle-kit push --force`

The `--force` flag auto-approves schema changes without interactive prompts.

### What each command starts

| Command pattern | What it runs |
|-----------------|-------------|
| `dev:*:local` | mana-sync + server (if any) + web |
| `dev:*:full` | DB setup + mana-auth + mana-sync + server (if any) + web |
| `dev:*:server` | Just the Hono/Bun server (`bun run --watch src/index.ts`) |
| `dev:*:web` | Just the SvelteKit web app |
| `dev:*:app` | Server + web (no sync, no auth) |

## Troubleshooting

### Database doesn't exist

If you see `database "xxx" does not exist`:

```bash
# Option 1: Run the setup script
pnpm setup:db:chat  # or whichever service

# Option 2: Create manually
PGPASSWORD=devpassword psql -h localhost -U mana -d postgres -c "CREATE DATABASE chat;"
```

### Schema out of date

If you see errors about missing tables/columns:

```bash
# Push the latest schema from the server package
pnpm --filter @chat/server db:push --force
```

### mana-sync not built

If you see `./server: No such file or directory`:

```bash
pnpm dev:sync:build
```

### Port already in use

If auth (port 3001) or sync (port 3050) is already running:

```bash
# Check what's using the port
lsof -i :3001
lsof -i :3050

# Kill the process if needed
kill <PID>
```

### Fresh Start (Nuclear Option)

To completely reset all databases:

```bash
# Stop and remove all containers + volumes
pnpm docker:clean

# Start fresh
pnpm docker:up

# Setup all databases
pnpm setup:db
```

## Adding a New Application

### Step 1: Create Project Structure

Create the standard project structure under `apps/`:

```
apps/newproject/
├── apps/
│   ├── server/       # Hono/Bun server (if needed for compute)
│   ├── mobile/       # Expo React Native app
│   ├── web/          # SvelteKit web app
│   └── landing/      # Astro marketing page
├── packages/         # Project-specific shared code
├── package.json      # Workspace root
├── pnpm-workspace.yaml
└── CLAUDE.md         # Project documentation
```

### Step 2: Set Up Local-First Data Layer

1. Create `apps/newproject/apps/web/src/lib/data/local-store.ts` with `createLocalStore()`
2. Create `apps/newproject/apps/web/src/lib/data/guest-seed.ts` for onboarding data
3. Use `collection.getAll()` / `collection.insert()` in stores (not API calls)
4. In layout: `await store.initialize()`, `store.startSync()` on login

### Step 3: Create Hono/Bun Server (if needed)

Only needed if your app requires server-side compute (AI, file ops, etc.).

Create `apps/newproject/apps/server/` with:
- `src/index.ts` -- Hono app entry point
- `src/config.ts` -- Port and env config
- `src/routes/health.ts` -- Health check endpoint
- `package.json` with `"name": "@newproject/server"`

### Step 4: Configure Database (if the server uses Drizzle)

1. **Add database to Docker init** (`docker/init-db/01-create-databases.sql`):
   ```sql
   CREATE DATABASE IF NOT EXISTS newproject;
   GRANT ALL PRIVILEGES ON DATABASE newproject TO mana;
   ```

2. **Add to setup script** (`scripts/setup-databases.sh`):
   ```bash
   newproject)
       create_db_if_not_exists "newproject"
       push_schema "@newproject/server" "newproject"
       ;;
   ```

3. **Add DATABASE_URL to `.env.development`**:
   ```env
   NEWPROJECT_DATABASE_URL=postgresql://mana:devpassword@localhost:5432/newproject
   ```

4. **Update `scripts/generate-env.mjs`** to generate the server `.env` file.

### Step 5: Add Package.json Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "dev:newproject:web": "pnpm --filter @newproject/web dev",
    "dev:newproject:server": "cd apps/newproject/apps/server && bun run --watch src/index.ts",
    "dev:newproject:local": "concurrently -n sync,server,web -c magenta,yellow,cyan \"pnpm dev:sync\" \"pnpm dev:newproject:server\" \"pnpm dev:newproject:web\"",
    "dev:newproject:full": "./scripts/setup-databases.sh newproject && ./scripts/setup-databases.sh auth && concurrently -n auth,sync,server,web -c blue,magenta,yellow,cyan \"pnpm dev:auth\" \"pnpm dev:sync\" \"pnpm dev:newproject:server\" \"pnpm dev:newproject:web\"",
    "setup:db:newproject": "./scripts/setup-databases.sh newproject"
  }
}
```

For apps **without** a server (sync + web only):

```json
{
  "scripts": {
    "dev:newproject:web": "pnpm --filter @newproject/web dev",
    "dev:newproject:local": "concurrently -n sync,web -c magenta,cyan \"pnpm dev:sync\" \"pnpm dev:newproject:web\"",
    "dev:newproject:full": "concurrently -n auth,sync,web -c blue,magenta,cyan \"pnpm dev:auth\" \"pnpm dev:sync\" \"pnpm dev:newproject:web\""
  }
}
```

### Step 6: Create Project CLAUDE.md

Create `apps/newproject/CLAUDE.md` with project overview, structure, commands, and API endpoints.

### Step 7: Test the Setup

```bash
# Quick start (no auth needed)
pnpm dev:newproject:local

# Full stack (with auth + DB setup)
pnpm dev:newproject:full
```

## Checklist for New Projects

- [ ] Create project structure under `apps/newproject/`
- [ ] Add `pnpm-workspace.yaml` in project root
- [ ] Set up local-store with Dexie.js collections
- [ ] Create guest seed data
- [ ] Add Hono/Bun server (if compute needed)
- [ ] Add database to `docker/init-db/01-create-databases.sql` (if using Drizzle)
- [ ] Add service to `scripts/setup-databases.sh` (if using Drizzle)
- [ ] Add DATABASE_URL to `.env.development` (if using Drizzle)
- [ ] Update `scripts/generate-env.mjs` for env generation
- [ ] Add scripts to root `package.json`
- [ ] Create `CLAUDE.md` with project documentation
- [ ] Test with `pnpm dev:newproject:local`
