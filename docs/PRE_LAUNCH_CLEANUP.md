# Pre-Launch Cleanup

This document tracks one-time cleanup operations that are only safe to do
**before the system goes live**. After launch, these operations would either
break existing user data or require non-trivial migrations to ship safely.

The system is currently pre-launch — no end users, no production data we
need to preserve. That makes this the cheapest moment to delete legacy
scaffolding, collapse versioned schemas, and remove backwards-compatibility
shims that exist purely to bridge between old and new code paths.

Each entry below should be checked off as it lands and the corresponding
commit linked. Once everything here is done and the system has launched,
this document becomes historical and should not be edited further.

---

## Mana unified web app — `apps/mana/apps/web`

### ✅ Collapse Dexie schema versions 1–10 into a single `db.version(1)`

**File:** `src/lib/data/database.ts`

**Status:** Done.

**What was there:** Ten sequential `db.version(N).stores()` blocks accumulated
as new modules and indexes shipped. Three of them carried *data migration*
upgrade functions (v2 emoji→icon, v3 events/timeEntries/habits/tasks →
timeBlocks projection) — large amounts of one-shot code that only ever
runs against test data on developer machines.

**Why it had to happen pre-launch:** Once a real user opens the app and
their browser persists Dexie at version 10, that user's IndexedDB will
*always* expect to see versions 1–10 declared (even if it never re-runs
the upgrade functions). Removing or rewriting old version blocks after
that point can corrupt or wipe their local data on the next page load.

**What changed:**
- All ~90 table definitions consolidated into one `db.version(1).stores({...})`
  block. Each table's index string is the *final* state — i.e. the result
  of applying every legacy version sequentially.
- Removed `EMOJI_TO_ICON` map and the `db.version(2).upgrade()` block.
- Removed the `db.version(3).upgrade()` block (the timeBlocks back-fill
  for events / timeEntries / habits / tasks). The runtime field
  (`scheduledBlockId`, `timeBlockId`) and the corresponding indexes still
  exist; only the one-shot data conversion is gone.
- Removed `db.version(4)`–`db.version(10)` blocks; their net effect is
  baked into the new `db.version(1)`.
- Verified by `module-registry.test.ts` that the post-collapse Dexie
  table set is unchanged from the pre-collapse state.

**LOC saved:** ~250 lines from `database.ts`.

### ✅ Remove `LocalLabel` deprecated type alias

**Files:** `src/lib/modules/todo/types.ts` (definition), 11 importing files
across `src/lib/modules/todo/`, `src/routes/(app)/todo/+page.svelte`.

**Status:** Done.

**What was there:** `export type LocalLabel = Tag;` annotated `@deprecated`,
kept "for backward compatibility". Eleven files in the todo module still
imported `LocalLabel` purely as a type, even though the underlying value
came from `@mana/shared-tags`.

**Why pre-launch:** A `@deprecated` symbol with eleven live consumers is
the worst kind — it looks like it's on its way out, but it isn't. The
longer it lives the more new files import it out of habit, until removing
it becomes a multi-day cross-module rename. Now is the cheap moment.

**What changed:**
- All eleven imports rewritten to import `Tag` from `@mana/shared-tags`
  directly (or via the existing barrel that re-exports it).
- All in-file `LocalLabel` references renamed to `Tag`.
- Type alias and `@deprecated` comment removed from `todo/types.ts`.
- Removed from `todo/index.ts` barrel export.

### ✅ Remove `labelsStore` backward-compat alias

**File:** `src/lib/modules/todo/stores/labels.svelte.ts`

**Status:** Done.

**What was there:** A `labelsStore` object exposing `createLabel` /
`updateLabel` / `deleteLabel` methods that internally just delegated to
`tagMutations` from `@mana/shared-stores`. Carried a `// Backward-compat
alias` comment. Zero consumers across the codebase.

**Why pre-launch:** Pure dead code that exists only to make a removed API
look alive in module exports. Confusing for anyone reading the todo store
code ("are these two different APIs?"). After launch, dead exports tend
to grow accidental consumers via autocomplete.

**What changed:**
- The `labelsStore` const block deleted from `labels.svelte.ts`.
- Removed from `todo/index.ts` barrel export.

### ✅ Collapse `$lib/stores/tags.svelte.ts` re-export shim

**Files:** `src/lib/stores/tags.svelte.ts` (deleted), 13 importing files
across modules and routes.

**Status:** Done.

**What was there:** A 20-line file that did nothing but re-export ten
symbols from `@mana/shared-stores`. The file's own header explicitly
called out that it existed "for backward compatibility with existing
imports".

**Why pre-launch:** A pure re-export shim is the cheapest possible piece
of code to delete *now* — every import to it is a mechanical one-line
rewrite. After launch, with new modules and new contributors, that small
fixup compounds into a permanent indirection layer that nobody touches.

**What changed:**
- All 13 `from '$lib/stores/tags.svelte'` imports rewritten to
  `from '@mana/shared-stores'`.
- File deleted.

### ✅ Remove `EMOJI_TO_ICON_MAP` legacy data-migration fallback

**Files:** `src/lib/modules/habits/types.ts`, `src/lib/modules/habits/queries.ts`,
`src/lib/modules/habits/index.ts`.

**Status:** Done.

**What was there:** A constant mapping eighteen emoji code points to
icon names, plus a fallback expression in `toHabit()` that used it
when a record had `emoji` set but not `icon`. This existed because the
v2 schema migration (now collapsed away) had renamed the field; the
fallback was the in-memory equivalent of that one-shot data migration.

**Why pre-launch:** Once the v2 upgrade block was removed in the schema
collapse above, no record with the old `emoji` field can exist anymore
(there are no legacy users). The fallback can never fire. Keeping it
around just costs LOC and confuses anyone reading the converter.

**What changed:**
- `EMOJI_TO_ICON_MAP` constant removed from `habits/types.ts`.
- `EMOJI_TO_ICON_MAP` import + the `??` fallback chain removed from
  `habits/queries.ts` — `toHabit()` now reads `local.icon ?? 'star'`.
- Removed from `habits/index.ts` barrel export.

### ✅ Remove unused `useAllEvents()` calendar query

**Files:** `src/lib/modules/calendar/queries.ts`,
`src/lib/modules/calendar/index.ts`.

**Status:** Done.

**What was there:** A `useAllEvents()` query in the calendar module that
its own JSDoc described as "for backward compatibility with
calendar-specific views". Zero external consumers — only the barrel
export referenced it. The events module has its own unrelated
`useAllEvents()` for social events.

**Why pre-launch:** Same reason as `labelsStore` above — pure dead code
with a misleading comment. Eliminating it removes one of two same-named
exports across modules, which is a real readability win.

**What changed:**
- `useAllEvents()` definition deleted from `calendar/queries.ts`.
- Removed from `calendar/index.ts` barrel export.

### ✅ Lazy-load cross-app search providers

**Files:** `src/lib/search/registry.ts`, `src/lib/search/providers/index.ts`.

**Status:** Done.

**What was there:** `registerAllProviders()` synchronously imported eleven
search provider modules (one per app: todo, calendar, contacts, chat,
storage, cards, picture, presi, music, quotes, clock) at the top of the
root `(app)` layout. The layout runs on every navigation into the
authenticated app, so all eleven providers were part of the initial JS
bundle even though spotlight search is opened on demand.

**Why pre-launch:** This is the obvious "feature opened later" pattern
that should never live in the initial bundle. Doing it now is one
mechanical edit; doing it later means convincing every contributor who
has copy-pasted from the existing eager pattern that lazy is fine.

**What changed:**
- `SearchRegistry` got a `registerLazy(appId, loader)` method. Lazy
  loaders are kept in a `Map<appId, loader>` and resolved by `search()`
  on first call (in parallel for all targeted appIds).
- `registerAllProviders()` now uses `registerLazy()` with dynamic
  `import('./<provider>')` calls — Vite splits each provider into its
  own chunk that the registry awaits the first time the user opens
  search.
- Side benefit: a search filtered to a single appId only loads that one
  provider chunk.
- Removed unused `getProviders()` method on the registry and the unused
  re-exports of every provider from `providers/index.ts`.

### Bundle analysis findings (no further action needed)

Verified after the search-provider lazy-load that the largest client
chunks the build produces are already correctly route-isolated by
SvelteKit's per-route splitting, so no additional manual lazy-loading
work is needed before launch:

- **6.0 MB chunk (`@mlc-ai/web-llm`)** — only referenced by node 84,
  which is the `/llm-test` route. The 6 MB only loads if a user visits
  that route. SvelteKit's per-route splitting handles it correctly.
- **816 KB chunk** (chart/monaco/stripe-style heavy libs) — also not
  referenced by any layout/entry node, so it only loads on the route
  that uses it.
- The entry app references ~257 chunks across the whole route graph
  (~1.97 MB transitive ceiling unzipped), but those chunks are not all
  loaded at startup — they are the *universe* the router can lazy-load
  into as the user navigates.

The conclusion is that SvelteKit's defaults are doing the structural
heavy lifting; only the search registry needed an explicit lazy
conversion because it was being eagerly initialized inside the layout
script for an on-demand feature.

### ✅ Remove `setApplyingServerChanges()` deprecated shim

**File:** `src/lib/data/database.ts`

**Status:** Done.

**What was there:** `setApplyingServerChanges(v: boolean)` was the
single-flag predecessor of `beginApplyingTables()`. It marked *every*
sync-tracked table as "currently applying server changes", which caused a
cross-app race: while one app was applying its server pull, writes from a
totally different app would silently get dropped from change tracking.
The new `beginApplyingTables()` API scopes that flag per touched table.

The legacy function was kept around solely to avoid breaking any external
caller during the migration. Pre-launch is the right moment to delete it:
no external callers exist, and no future external callers can show up
(the symbol is module-internal, not part of any package export).

**What changed:**
- Function definition removed from `database.ts`.
- The accompanying `@deprecated` block comment removed.

---

---

## Production infrastructure (mana.how)

### ✅ Ghost backend API hostnames — removed

**Status:** Done. The cleanup landed on 2026-04-07.

**What was there:** Twelve `*-api.mana.how` Cloudflare Tunnel routes
(`todo-api`, `calendar-api`, `contacts-api`, `chat-api`, `storage-api`,
`cards-api`, `music-api`, `food-api`, `picture-api`, `presi-api`,
`quotes-api`, `clock-api`) plus their matching `lib/api/services/*.ts`
clients in the unified web app, the matching `__PUBLIC_*_API_URL__`
runtime injections in `hooks.server.ts`, and the
`PUBLIC_*_API_URL_CLIENT` env entries on the `mana-app-web` compose
service. None of the underlying containers had existed since the unified
local-first migration; only `qrExportService` and a couple of
admin / `my-data` pages still imported them, producing permanent HTTP
502s through the tunnel.

**Why pre-launch:** Public hostnames on a tunnel are an implicit
contract. Every day longer they live, the higher the chance someone
externally bookmarks one or our own future work copies the dead pattern.
The fix is mechanical now and breaks nothing because no live code path
needed them.

**What changed:**
- `apps/mana/apps/web/src/lib/api/services/qr-export.ts` rewritten to
  read contacts / events / tasks directly from the local Dexie database
  (`db.table('contacts')`, `timeBlocks` joined with `events`, `tasks`)
  instead of going through the per-app HTTP services.
- Twelve service files deleted: `todo.ts`, `calendar.ts`, `contacts.ts`,
  `chat.ts`, `storage.ts`, `cards.ts`, `music.ts`, `picture.ts`,
  `presi.ts`, `quotes.ts`, `clock.ts`, `context.ts` plus their `*.test.ts`
  siblings.
- `apps/mana/apps/web/src/lib/api/services/index.ts` collapsed from a
  thirteen-symbol re-export to just the four genuinely server-bound
  services (`adminService`, `landing`, `myDataService`, `qrExportService`).
- `apps/mana/apps/web/src/hooks.server.ts` no longer reads or injects
  any of the twelve `__PUBLIC_*_API_URL__` runtime variables, and the
  CSP `connect-src` list shrank by the same amount.
- `apps/mana/apps/web/src/routes/status/+page.server.ts` no longer probes
  the dead per-app health endpoints — only `auth`, `sync`, `uload-server`,
  `media` and `llm` remain in the public status page.
- `docker-compose.macmini.yml` had its 14 ghost
  `PUBLIC_*_API_URL{,_CLIENT}` env entries on the `mana-app-web` service
  removed.
- `~/.cloudflared/config.yml` on the Mac Mini lost its 16 dead ingress
  routes (`chat-api`, `todo-api`, `calendar-api`, `clock-api`, `clock-bot`,
  `contacts-api`, `quotes-api`, `skilltree-api`, `plants-api`, `cards-api`,
  `storage-api`, `presi-api`, `food-api`, `photos-api`, `mukke-api`,
  `picture-api`). The tunnel was reloaded via `kill -HUP <pid>`.
- After reload, every former 502 returns 404 from the Cloudflare edge
  (no ingress route → no origin → 404), confirming the cleanup is live.

**Follow-up needed for full resolution:**
- The DNS CNAME records for all twelve hostnames still resolve at the
  Cloudflare zone level. They are harmless (the tunnel ignores them),
  but for full hygiene they should be deleted from the Cloudflare
  dashboard before launch announcements go out.
- The next regular deployment of `mana-app-web` will pick up the
  removed env vars and the smaller `hooks.server.ts` injection — no
  forced rebuild was performed during the cleanup.

### ✅ Eighteen broken subdomains triaged — 15 fixed, 3 known follow-ups

**Status:** Done (15 fixed). Three follow-ups tracked below.

**What was there:** The first run of the rebuilt `health-check.sh` (which
walks the cloudflared ingress instead of probing hardcoded ports) surfaced
eighteen Cloudflare hostnames that were broken in production but had been
silently ignored by the old health check. Each was either missing a DNS
record at the Cloudflare zone, pointing at a container that wasn't
running, or pointing at a port nothing was bound to.

**What changed (six DNS records added):**
- `cloudflared tunnel route dns ... {context,credits,memoro,moodlit,questions,subscriptions}.mana.how`
- All six already had a working backend on the target port (mana-app-web
  for the four redirected subdomains, mana-credits for credits,
  mana-subscriptions for subscriptions); only the public CNAME was
  missing.

**What changed (four containers started, three Postgres databases
created):**
- `docker compose -p manacore-monorepo up -d landings umami manavoxel-web synapse`
  brought four compose-defined-but-not-running services back.
- `mana-mon-umami` initially crashed because database `umami` didn't
  exist on `mana-infra-postgres` — created it with
  `CREATE DATABASE umami;` and the container went healthy.
- `mana-matrix-synapse` initially crashed because role `synapse` didn't
  exist either, then because database `matrix` didn't exist —
  created both:
  `CREATE USER synapse WITH PASSWORD 'synapse-secure-password';`
  `CREATE DATABASE matrix OWNER synapse ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;`
- This unblocked `matrix.mana.how`, `stats.mana.how`, `it.mana.how` and
  the `element.mana.how` route (`mana-matrix-element` was already running
  by the time it was re-tested).

**What changed (two more DNS records added):**
- `cloudflared tunnel route dns ... docs.mana.how it.mana.how` —
  needed because `mana-infra-landings` was newly started but its
  hostnames had never had a CNAME.

**What changed (three ghost ingress entries cleaned up):**
- `stt-api.mana.how` and `tts-api.mana.how` were re-routed from
  `http://localhost:3020` / `http://localhost:3022` (where nothing
  listens) to `http://192.168.178.11:3020` / `http://192.168.178.11:3022`
  (the GPU server, where they actually live). Same fix pattern as the
  existing `gpu-stt.mana.how` / `gpu-tts.mana.how` routes.
- `taktik.mana.how` and `link.mana.how` had no compose service, no
  backing process and no apparent owner — both ingress entries deleted
  from `~/.cloudflared/config.yml`.

**Three follow-ups — two resolved, one needs Cloudflare Dashboard:**

1. **✅ `manavoxel.mana.how` → 200.** The `manavoxel-web:local` image
   had a broken `package.json` (empty file → `SyntaxError: Unexpected
   end of JSON input` on container startup). Fixed by
   `docker compose -p manacore-monorepo build --no-cache manavoxel-web`
   followed by `up -d --force-recreate manavoxel-web`. The container
   went healthy in ~8 seconds and `manavoxel.mana.how` now returns 200.

2. **✅ `docs.mana.how` and `status.mana.how` → 200.** The
   `mana-infra-landings` nginx container had `server` blocks for both
   hostnames pointing at `/srv/landings/docs` and `/srv/landings/status`,
   but those directories did not exist on the bind mount source
   (`/Volumes/ManaData/landings/`). Created both directories on the
   host with minimal placeholder `index.html` files (the directories
   were already in nginx config but empty). Real content for
   `status.mana.how` will reappear once `mana-status-gen` is rebuilt
   (separate broken image follow-up); the placeholder explicitly says
   so and links to grafana.mana.how / glitchtip.mana.how in the
   meantime. `docs.mana.how` placeholder points users at git.mana.how
   for the README/CLAUDE.md docs.

3. **⚠️ `stt-api.mana.how` and `tts-api.mana.how` → 502 — Cloudflare
   Dashboard fix needed.** The cloudflared ingress correctly points at
   the GPU server (`http://192.168.178.11:3020` / `:3022`), the GPU
   server itself answers on those ports from the Mac Mini's LAN
   (verified with direct `curl`), the cloudflared process was fully
   restarted via `launchctl kickstart -k gui/$(id -u)/com.cloudflare.cloudflared`
   (after discovering that the system-level launchd plist
   `/Library/LaunchDaemons/com.cloudflare.cloudflared.plist` is broken
   and runs `cloudflared` with no args — the actual working tunnel
   runs as the `mana` user via `~/Library/LaunchAgents/com.cloudflare.cloudflared.plist`),
   and `cloudflared tunnel route dns --overwrite-dns ...` reports
   "already configured to route to your tunnel" for both hostnames.

   Despite all of that, the Cloudflare edge generates a 502 *before*
   contacting the origin — the response carries no `cf-cache-status`
   header, no `nel`/`report-to` headers, and a different `cf-ray`
   pattern from the working `gpu-stt.mana.how` / `gpu-tts.mana.how`
   sister hostnames (which point at the *same* origin and answer 200).

   The pattern strongly suggests an old **Public Hostname** mapping
   for `stt-api.mana.how` / `tts-api.mana.how` still exists in the
   Cloudflare Zero Trust dashboard, pointing at a deleted tunnel.
   Cloudflared CLI only sees the DNS layer, not the Public Hostname
   layer, so it reports everything as fine while Cloudflare's edge
   silently routes the traffic to a tunnel that no longer exists.

   **Manual fix:**
   1. Open `https://one.dash.cloudflare.com/` → Networks → Tunnels.
   2. Find any tunnel that has `stt-api.mana.how` or `tts-api.mana.how`
      under its Public Hostnames list (likely an old archived tunnel,
      not `mana-server` (`bb0ea86d-...`)).
   3. Delete those Public Hostname entries from the old tunnel.
   4. Add them to the active `mana-server` tunnel pointing at
      `http://192.168.178.11:3020` and `http://192.168.178.11:3022`
      respectively.
   5. Wait ~60 seconds for Cloudflare's edge to repick.

   Workaround until then: the same backend is reachable via
   `gpu-stt.mana.how` / `gpu-tts.mana.how`, which work today.
   Consumer code that hits `stt-api` / `tts-api` should be repointed
   at the `gpu-*` hostnames anyway — they are clearer about where the
   service actually runs.

**Detour: stuck monitoring containers + broken images suppressed
in alerts.** The triage uncovered three more containers that had
been silently `Exited (127)` (=command not found = broken image)
for the entire 6-hour window the Mac Mini had been up:

- `mana-status-gen` — generates the `status.mana.how` JSON; broken
  image. The placeholder `index.html` above is the workaround until
  this is rebuilt.
- `mana-mon-blackbox` — Prometheus blackbox exporter; redundant now
  that `health-check.sh` walks the cloudflared ingress directly.
- `mana-infra-minio-init` — actually a normal one-shot init container
  (Exit 0 = success), not broken; suppressed because the detector
  was paging on it.

The first two were added to the `health-check.sh` stuck-container
exclusion list with a comment pointing back to this section, so they
stop drowning out real signal until they're rebuilt. The exclusion
list should be revisited after each Mac Mini update — anything in
it is technical debt by definition.

**Health-check.sh hardening done as part of this triage:**

- Switched the public-hostname probe from the local resolver to
  `dig +short HOST @1.1.1.1`. The Mac Mini's home-router DNS keeps a
  negative-cache entry for ~hours after the first failed lookup, so
  newly added CNAMEs (like the six fixes above) appeared as "no
  response" from inside the script even though external users saw them
  resolve immediately. Asking Cloudflare's DNS directly gives the
  script the same view the public internet has.
- The matrix / element / monitoring port-by-port sections were
  removed — the public-hostname walk covers all of them by going
  through the actual production tunnel rather than guessing internal
  ports.
- The "stuck container" detector now ignores `*-init` containers
  (one-shot init by design) and the two known-broken monitoring
  images (`mana-status-gen`, `mana-mon-blackbox`) so the real signal
  isn't drowned out while their rebuilds are pending.

### ✅ Memoro server detached from mana.how stack

**Status:** Done.

**What was there:** The unified web app injected
`window.__PUBLIC_MEMORO_SERVER_URL__` from a `PUBLIC_MEMORO_SERVER_URL`
env var, the docker-compose `mana-app-web` service set both the
in-network and public client URLs, and the cloudflared tunnel had a
`memoro-api.mana.how → http://localhost:3015` ingress route. The actual
memoro container (`mana-app-memoro-server`) was *not* running because
its compose definition requires `MEMORO_SUPABASE_URL`,
`MEMORO_SUPABASE_SERVICE_KEY`, `MEMORO_SERVICE_KEY`,
`MANA_CREDITS_SERVICE_KEY`, `AZURE_OPENAI_KEY` (compose name) /
`AZURE_OPENAI_API_KEY` (.env name — naming mismatch),
`AZURE_OPENAI_DEPLOYMENT` and `GEMINI_API_KEY`, and most of those
secrets were never set.

The interesting fact: the unified web app's `memoro` module
(`apps/mana/apps/web/src/lib/modules/memoro/`) is fully local-first.
Its recorder, collections, queries, stores and views all read/write
the unified Dexie database via `mana-sync`. No file in the module
reads `__PUBLIC_MEMORO_SERVER_URL__` or hits `memoro-api.mana.how`.
The injected window var was a leftover from the standalone era — chasing
secrets to start a server that mana.how doesn't actually call would have
been wasted work.

**Why pre-launch:** Same shape as the ghost API hostnames above. A
Cloudflare ingress route to a non-running origin produced permanent 502s,
and the env var injection promised a backend that didn't exist. Fixing
it is one cleanup; ignoring it would be a permanent footgun.

**What changed:**
- `hooks.server.ts` no longer reads `PUBLIC_MEMORO_SERVER_URL{,_CLIENT}`,
  no longer injects `window.__PUBLIC_MEMORO_SERVER_URL__`, and the CSP
  `connect-src` list dropped that origin.
- `routes/status/+page.server.ts` no longer probes the memoro server's
  `/health`.
- `docker-compose.macmini.yml` `mana-app-web.environment` lost its
  `PUBLIC_MEMORO_SERVER_URL` and `PUBLIC_MEMORO_SERVER_URL_CLIENT` lines.
- `~/.cloudflared/config.yml` on the Mac Mini lost its
  `memoro-api.mana.how` ingress entry. Tunnel reloaded with `kill -HUP`.
- The `memoro-server` and `memoro-audio-server` compose services
  themselves were left intact — they remain available for the mobile
  app team to revive later when they have valid Supabase credentials,
  but they no longer block mana.how production health.

**Open follow-up (low priority):**
- Long term, the memoro server should be refactored off Supabase onto
  the unified Postgres + sync architecture so it stops depending on a
  third-party database for a feature that's already local-first on the
  client. Tracked separately — not pre-launch critical.
- The DNS CNAME for `memoro-api.mana.how` still resolves; same hygiene
  cleanup as the ghost API hostnames above.

### Original ghost-API entry (kept for the Git history)

The earlier `## How to add an entry` block previously listed the ghost
API removal as **open** — it is now **done** above. If a future audit
finds another similar pattern, follow the same shape: identify the
single live consumer, rewrite it to use Dexie or the canonical
gateway, then strip the env vars / compose entries / tunnel routes
in one batch.

### ✅ Production restoration — 2026-04-07 outage

**Status:** Done. Documented for future post-mortem reference.

**What was wrong:**
1. `mana-core-sync` (Go local-first sync server) container was missing.
   Frontend had no place to push pending changes — silent local writes
   only.
2. `mana-api-gateway` container was missing.
3. Four Cloudflare Tunnel hostnames (`sync.mana.how`, `media.mana.how`,
   `uload-api.mana.how`, `memoro-api.mana.how`) were configured in the
   tunnel ingress but had **no DNS records on the Cloudflare zone**, so
   resolution NXDOMAIN'd at the edge. The tunnel had a route to
   nowhere.
4. `mana-sync` Dockerfile pinned `golang:1.23-alpine` but the project's
   `go.mod` requires `go 1.25.0` — every rebuild attempt failed.
5. The same Dockerfile copied `go.mod` directly without staging the
   `packages/shared-go` workspace replace, so `go mod download` could
   not resolve `github.com/mana/shared-go`.
6. Postgres DB `mana_sync` did not exist on the Mac Mini's Postgres
   instance — only `mana_platform` had been created. mana-sync booted,
   ping'd the DB, failed, restart-looped.

**What changed:**
- `services/mana-sync/Dockerfile` rewritten to mirror the
  `services/mana-api-gateway/Dockerfile` pattern: monorepo root build
  context, explicit `COPY packages/shared-go/ /shared-go/`,
  `go mod edit -replace`, golang 1.25-alpine.
- `docker-compose.macmini.yml` `mana-sync.build.context` changed from
  `services/mana-sync` to `.` so the new Dockerfile can see the shared
  package.
- `mana_sync` Postgres database created
  (`CREATE DATABASE mana_sync;`).
- `mana-core-sync` and `mana-api-gateway` containers built and started
  (`docker compose -p manacore-monorepo up -d mana-sync api-gateway`).
- Four Cloudflare Tunnel DNS records added via
  `cloudflared tunnel route dns bb0ea86d-8253-4a54-838b-107bb7945be9
  {sync,media,uload-api,memoro-api}.mana.how`.

**Current health (post-fix and post-ghost-cleanup):**
- `mana.how/`, `/todo`, `/tags`, `/llm-test` → 200
- `auth.mana.how`, `llm.mana.how`, `api.mana.how`, `sync.mana.how`,
  `media.mana.how`, `uload-api.mana.how`, `glitchtip.mana.how` → 200
- `memoro-api.mana.how` → 404 (no ingress route — see "Memoro server
  detached" entry above; the unified web app does not need it)
- 12 ghost API hostnames (`todo-api`, `calendar-api`, `contacts-api`,
  `chat-api`, `storage-api`, `cards-api`, `music-api`, `food-api`,
  `picture-api`, `presi-api`, `quotes-api`, `clock-api`) → 404 (no
  ingress route — see "Ghost backend API hostnames" entry above)

**Root-cause lessons for the runbook (now applied):**

1. **`status.sh` compose-vs-running diff added.** The script now reads
   every service from `docker compose config` and reports any
   `container_name` that is not currently running, instead of just
   printing `X / Y`. The 2026-04-07 outage state would have been flagged
   on the very first run as five missing containers (incl. `mana-sync`
   and `mana-api-gateway`) — the original script reported those as
   "37/42 running" with no indication of the gap.

2. **`health-check.sh` walks the cloudflared ingress.** The hardcoded
   port-by-port block (`Chat Backend localhost:3030`, `Todo Backend
   localhost:3031`, …) is gone. The script now reads every `hostname:`
   line from `~/.cloudflared/config.yml` and probes the public URL —
   so DNS gaps, missing tunnel routes, 502/530 origin failures and
   timeouts surface as failures even when the corresponding LAN port
   would have happened to answer. On its first run after the cleanup
   it surfaced eighteen previously-invisible failures
   (`context.mana.how`, `credits.mana.how`, `docs.mana.how`,
   `it.mana.how`, `memoro.mana.how`, `moodlit.mana.how`,
   `questions.mana.how`, `subscriptions.mana.how` → no DNS, plus
   `element`, `link`, `manavoxel`, `matrix`, `stats`, `status`,
   `stt-api`, `taktik`, `tts-api` → 502). Each is its own follow-up
   ticket; the script just stopped hiding them.

3. **`COMPOSE_PROJECT_NAME=manacore-monorepo` pinned.** The Mac Mini's
   existing containers were created under the old project name
   (`manacore-monorepo`) but the working tree directory is
   `managarten`. Without a pin, every `docker compose up` from the
   repo root spawns a *second* project, creating duplicate
   container/volume conflicts (the 2026-04-07 recovery had to pass
   `-p manacore-monorepo` manually). The pin now lives in:
   - `.env` and `.env.macmini` on the Mac Mini (so any `docker compose`
     invocation from that working tree picks it up automatically).
   - `.env.macmini.example` in the repo (so a fresh checkout inherits
     the same name with a clear comment about why removing it would
     break the next deployment).

4. **`apps/mana/apps/web/Dockerfile` heap bumped 4 GB → 8 GB.** The
   unified app outgrew `--max-old-space-size=4096` after the module
   count crossed ~30 — every clean rebuild OOM'd before producing the
   client bundle. Bumping the build heap is the same one-line change
   we already had to apply locally to run `pnpm build` against the
   monorepo on a developer machine.

---

## How to add an entry

Append a new section under the affected app/service. Each entry should
explain:
1. **What was there** — the old code/structure being removed
2. **Why it had to happen pre-launch** — the user-facing risk if done later
3. **What changed** — the concrete diff
4. **LOC / size impact** — to motivate the next cleanup

Keep entries small and atomic — one concept per section. If a single
change touches several files, list them all under one entry rather than
splitting it.
