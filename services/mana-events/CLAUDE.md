# mana-events

Public RSVP and event-sharing service. Hosts publish event snapshots from the Mana calendar/social modules; the public can RSVP via share-link tokens without needing an account.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Bun |
| **Framework** | Hono |
| **Database** | PostgreSQL + Drizzle ORM |
| **Auth** | EdDSA JWT validation via JWKS from mana-auth (`jose`) — host-side only; RSVP endpoints are intentionally unauthenticated |

## Port: 3115

## Quick Start

```bash
cd services/mana-events
bun run dev          # Watch mode
bun run db:push      # Push Drizzle schema
bun run db:studio    # Drizzle Studio
bun test             # Bun unit tests
```

## Why a separate service?

The Mana unified app stores events in the user's local-first store and syncs them via mana-sync — but those events are private and encrypted at rest. Sharing an event with someone *outside* the user's account requires a public, server-rendered snapshot that lives in plaintext on a service the share-link target can hit without login. mana-events is that surface.

## API Endpoints

### Host-side (JWT auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/publish` | Publish an event snapshot (mints share token) |
| PUT | `/:eventId/snapshot` | Update an existing published snapshot |
| DELETE | `/:eventId` | Unpublish |
| PUT | `/:eventId/items` | Set the items/tasks list (e.g. potluck dishes) |
| GET | `/:eventId/items` | Read items |
| GET | `/:eventId/rsvps` | List collected RSVPs |

### Public (no auth — share token in path)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:token` | Fetch the public event snapshot |
| POST | `/:token` | Submit an RSVP |
| POST | `/:token/items/:itemId/claim` | Claim a potluck-style item |

## Rate limiting

Public RSVP endpoints are rate-limited per share token (config: `rsvpPerTokenPerHour`, `rsvpMaxPerToken`) to prevent abuse of the unauthenticated surface. Stale rate-limit buckets are swept periodically by `lib/cleanup.ts` (`startRateBucketSweeper`) — important for long-published events that would otherwise accumulate buckets indefinitely.

## Code layout

```
src/
├── index.ts              # Bootstrap (port, sweeper, DB connection)
├── app.ts                # Hono app factory — separated so tests can import without bootstrap
├── config.ts             # Env loading (PORT, DATABASE_URL, MANA_AUTH_URL, rate limits, CORS)
├── db/
│   ├── connection.ts
│   └── schema/
│       ├── events.ts     # published event snapshots + items
│       └── index.ts
├── routes/
│   ├── events.ts         # host-side (JWT)
│   ├── rsvp.ts           # public (token)
│   └── health.ts
├── middleware/
│   ├── jwt-auth.ts       # JWKS-based EdDSA verification
│   └── error-handler.ts
└── lib/
    ├── cleanup.ts        # rate-limit bucket sweeper
    └── errors.ts
```

The Hono app lives in `app.ts` (exporting a `createApp(db, config)` factory) so unit tests in `__tests__/` can wire a test DB without triggering the production sweeper or binding the port.

## Configuration

```env
PORT=3115
DATABASE_URL=postgresql://...
MANA_AUTH_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:5173,https://mana.how
```

JWT verification fetches the JWKS from `${MANA_AUTH_URL}/api/auth/jwks` lazily on first use and caches the keyset in-process.
