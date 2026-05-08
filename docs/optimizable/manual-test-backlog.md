# Manual / Smoke Test Backlog

Single source of truth for "features that are **code-complete + unit-tested** but still need a human click-through before release." Distinct from:

- [`test-health.md`](test-health.md) — automated test suite health
- [`docs/TESTING_DEPLOYMENT_CHECKLIST.md`](../TESTING_DEPLOYMENT_CHECKLIST.md) — CI/CD system pre-deploy
- [`docs/plans/shared-space-smoketest.md`](../plans/shared-space-smoketest.md) — detailed shared-space walkthrough (linked below)

An entry lives here as long as the feature hasn't been driven through a real browser / device / account end-to-end. When the smoke test has run green once, delete the entry.

## Format

Each entry carries:
- **Area** — feature surface
- **Why it's here** — what unit tests do *not* cover
- **Steps** — inline if short; a link to a dedicated walkthrough if long
- **Shipped?** — commit(s) that shipped the code the test would exercise
- **Priority** — `🔴 release blocker` / `🟠 important` / `🟡 nice to have`

---

## Open

### Data Export v2 — end-to-end roundtrip in a real browser

- **Priority:** 🟠 important
- **Shipped:** `fd1ea4707` (feature), `8c3d6e7bb` (test + cross-account adoption fix)
- **Why it's here:** `format.test.ts` (10) + `roundtrip.test.ts` (6) cover the pipeline with fake-indexeddb + pass-through crypto. Unit coverage is blind to: real AES-GCM through Web Crypto at browser speed, the File-download + re-upload path, Blob memory behaviour at multi-MB sizes, the passphrase-prompt modal flow, and the MyData settings-section wiring.
- **Steps:**
  1. `pnpm run mana:dev`. Log in, create a handful of notes + tasks + events.
  2. Settings → Meine Daten → export (full, no passphrase). Download the `.mana` file.
  3. Inspect the archive (`unzip -l mana-full-*.mana`) — expect `manifest.json` + `data/*.jsonl`.
  4. DevTools → Application → Storage → "Clear site data" on `localhost:5173`. Reload. Log in again.
  5. Settings → Meine Daten → import → pick the `.mana` file. Check progress bar ticks, summary lists tables + row counts.
  6. Open each module, confirm rows are back and readable (encrypted fields decrypt cleanly).
  7. Repeat 1–6 with **passphrase on** — export with passphrase, expect `data.sealed` entry in the zip, re-import must prompt for the passphrase. Try once with the wrong passphrase, expect the friendly "Passphrase stimmt nicht" message, not a crash.
  8. **Cross-account**: export from account A, log out, log in as account B (or a fresh signup), import. Confirm rows adopted by B (spaceId starts with `_personal:<B-userId>`, not A's). Verify in DevTools → IndexedDB.

### Shared Space — two-user smoke test

- **Priority:** 🟠 important
- **Shipped:** spaces-foundation 15-commit block (2026-04-20, see `project_spaces_foundation.md` memory)
- **Why it's here:** the data-layer + RLS + invite-flow integration can only be verified with two real sessions across two browser profiles.
- **Steps:** full walkthrough at [`docs/plans/shared-space-smoketest.md`](../plans/shared-space-smoketest.md) — create Family Space, invite, accept, verify cross-user sync on calendar + recipes.

### Articles bookmarklet — consent-walled sites

- **Priority:** 🟡 nice to have
- **Shipped:** articles M1–M9 (see `project_news_research_module.md` / plan at `docs/plans/articles-module.md`)
- **Why it's here:** the Weg-2 browser-HTML bookmarklet was built to route around server-side fetchers that hit a consent dialog (Golem, Spiegel, Zeit). No automation can exercise the real consent-wall detection path.
- **Steps:**
  1. Install the bookmarklet (Settings → Articles, drag to bookmarks bar).
  2. Navigate to a known consent-walled article (golem.de is the reference case — the original bug report).
  3. Accept the consent banner in the source tab, then click the bookmarklet.
  4. Expect a new tab that auto-saves the article; no extra "save to Leseliste" click required.
  5. Verify the saved article has readable body + title in `/articles`.

### MCP gateway + Persona-runner — end-to-end live smoke

- **Priority:** 🟠 important
- **Shipped:** `16c881833` (M1+M1.5 MCP gateway), `493db0c3b` (M2.a-c persona schemas + seed), `f07eae3c0` (M3.b-d tick loop), `eb8fac23e` (tool_use_id pairing + audit), `5a5e24f58` (docker searxng fix). Plan at [`docs/plans/mana-mcp-and-personas.md`](../plans/mana-mcp-and-personas.md). Memory: [`project_mana_mcp_personas.md`](.claude/projects/-Users-till-Documents-Code-managarten/memory/project_mana_mcp_personas.md).
- **Why it's here:** ~2600 lines of service code, 14 automated tests passed (type-check × 4, svelte-check, AES round-trip, HMAC 3-way parity, tool-registry integrity, seed dry-run, boot smokes × 2, Playwright config parse, drizzle SQL generate, vitest 21/21), but **none of it has run against a live Postgres + mana-auth + Anthropic**. Unit tests are blind to: real JWT issuance + SSO cookie flow, mana-sync wire-format mismatches, Dexie-table-name case drift, Better-Auth org-list response shape, Claude Agent SDK streaming edge-cases, encryption MK unwrap through the real vault endpoint, ZK-user rejection path.
- **Steps:**
  1. `pnpm dev:mana:all` — brings up Postgres + Redis + MinIO + searxng + all dev servers.
  2. `cd services/mana-auth && bun run db:push` (or verify migrations 005 + 006 already applied).
  3. `pnpm setup:dev-user` — creates `tills95@gmail.com` as founder. Log in via the web app, copy the JWT from DevTools → Application → Cookies → `better-auth.session_token` (or use the API):
     ```bash
     export MANA_ADMIN_JWT=$(curl -s -X POST localhost:3001/api/v1/auth/login \
       -H 'content-type: application/json' \
       -d '{"email":"tills95@gmail.com","password":"Aa-123456789"}' | jq -r .token)
     ```
  4. `export PERSONA_SEED_SECRET=$(openssl rand -hex 32)` — same value must stay in use for the runner + visual suite.
  5. `pnpm seed:personas` — expect "✓ Done. 10 personas upserted." Confirm in Postgres:
     ```
     psql $DATABASE_URL -c "SELECT email, kind, access_tier FROM auth.users WHERE kind='persona'"
     ```
     Row count should be exactly 10, all founder/persona.
  6. `pnpm --filter @mana/mcp-service dev` — tail the log for `[mana-mcp] listening on :3069`.
  7. Quick Claude-Code MCP check (optional): drop `.mcp.json` with `{"mcpServers":{"mana":{"type":"http","url":"http://localhost:3069/mcp","headers":{"Authorization":"Bearer $YOUR_JWT","X-Mana-Space":"$YOUR_SPACE_ID"}}}}` and `/mcp list` in Claude Code — expect 13 tools.
  8. Start the runner:
     ```bash
     export MANA_SERVICE_KEY=$(grep MANA_SERVICE_KEY .env.development | cut -d= -f2)
     export ANTHROPIC_API_KEY=sk-ant-...           # your real key
     pnpm --filter @mana/persona-runner dev
     ```
     Expect `[mana-persona-runner] listening on :3070` **without** any "MANA_SERVICE_KEY missing" or "ANTHROPIC_API_KEY missing" warning.
  9. Fire one tick manually:
     ```bash
     curl -s -X POST localhost:3070/diag/tick | jq
     ```
     Expect `{ok: true, result: {due: 10, ranSuccessfully: N, failed: [...], durationMs: …}}`. Any `failed[]` entries with error messages are the actual bugs to chase.
  10. Inspect what landed:
      ```
      psql $DATABASE_URL -c "SELECT persona_id, tool_name, result, latency_ms FROM auth.persona_actions ORDER BY created_at DESC LIMIT 30"
      psql $DATABASE_URL -c "SELECT persona_id, module, rating, notes FROM auth.persona_feedback ORDER BY created_at DESC LIMIT 30"
      ```
      Rows should include calls to `habits.create`, `todo.create`, `notes.create`, `journal.add` etc., plus 1–5 ratings per module a persona used.
  11. **Encryption check** — encrypted fields must be base64+`enc:1:` prefixed in the wire table but decrypt cleanly client-side:
      ```
      psql $MANA_SYNC_URL -c "SELECT data->'title' FROM sync_changes WHERE table_name='tasks' AND actor->>'kind'='persona' LIMIT 3"
      ```
      Expect strings beginning with `"enc:1:"`. Then log in as that persona in the web app — the tasks should show **plaintext** titles.

### Persona visual regression — capture first baselines

- **Priority:** 🟡 nice to have
- **Shipped:** `79d112657` (M5.a scaffold). One flow (`home.spec.ts`), two viewports (desktop + Pixel 5). Extension pattern documented in [`tests/personas/README.md`](../../tests/personas/README.md).
- **Why it's here:** Playwright config parses and lists tests, but no baseline screenshot has ever been captured. First capture must be a human eyeballing — otherwise the first CI run locks in whatever weird transient state happened at t=0 as "correct".
- **Steps:**
  1. Complete the MCP/persona-runner smoke above so each persona has real content (habits, tasks, journal entries). Without content, baselines are meaningless — every module is empty for everyone.
  2. Keep the web app running (`pnpm mana:dev` at :5173).
  3. `PERSONA_SEED_SECRET=<same as seed> pnpm test:personas:update` — writes PNGs under `tests/personas/__snapshots__/home.spec.ts/home-adhd-student-{desktop,mobile}.png`.
  4. **Eyeball each generated PNG** before committing. Look for: persona's actual name in header, any unexpected "no data" empty states that mean step 1 content didn't land, layout breakage on mobile.
  5. `git add tests/personas/__snapshots__/ && git commit -m "test(personas): baseline home-tour for Anna"` — now CI has a reference. Copy `home.spec.ts` to `todo.spec.ts` etc. to add more flows; repeat step 3–5 per flow.

---

### Website Builder — end-to-end smoke across M1–M7

- **Priority:** 🔴 release blocker (new feature surface, no browser validation yet)
- **Shipped:** folded into `54a12ffd5` + `89258eb45` (M1+M2), `7a4f8894e` (M3), `57be0f61b` (M4), `13efae8cd` (M5), `3eca5ac20` (M6), folded into `4fc9d6c59` + `d518169ce` (M7). Plan: [`docs/plans/website-builder.md`](../plans/website-builder.md). Memory: `project_website_builder.md`.
- **Why it's here:** ~7000 lines of code, 11 block types, 3 Postgres tables, `/metrics` endpoint, hooks-rewrite, dns-verify, analytics injection. Unit + type-checks green but nothing has run against real Postgres + mana-sync + mana-media + a browser. Blind spots: Dexie v37→v41 upgrade, SSR render, CF-friendly cache headers, same-origin form submit proxy, custom-domain `dns.resolveTxt` against real resolvers, `event.url.pathname` rewrite semantics in SvelteKit.
- **Steps:** full walkthrough at [`docs/plans/website-builder-smoketest.md`](../plans/website-builder-smoketest.md) — 10 scenarios (create/publish, block-coverage, forms, module-embed, templates/AI, subdomain, custom-domain, rollback/analytics, metrics/GC, edge-cases). Brings up dev-stack, applies three SQL migrations, walks through `/website` → edit → publish → `/s/<slug>` → custom host.

---

### Articles — PWA share-target

- **Priority:** 🟡 nice to have
- **Shipped:** share-target configured in `vite.config.ts` (routes to `/articles/add` with `?url` + `?text` + `?title`)
- **Why it's here:** only works on an installed PWA; dev-mode SW is disabled.
- **Steps:**
  1. `pnpm build && pnpm preview`, install the PWA (Chrome "install Mana" prompt on desktop, or Android "add to home screen").
  2. Share a URL from the OS share sheet (Chrome Android, WhatsApp, Mail) → expect Mana to appear and land on `/articles/add` with the URL pre-filled in the form.

---

## Recently closed

*(Move entries here with the date they were verified, prune after one release.)*

_None yet — this file was introduced 2026-04-22._

## How to add an entry

When you ship a feature with unit tests but no browser / device click-through, add a new `### <feature>` section under "Open" using the format above. Keep steps reproducible: assume a fresh clone and `pnpm docker:up && pnpm run mana:dev`. If the steps cross 20 lines, split them into a dedicated walkthrough file under `docs/plans/` and link from here.
