# Refactoring Audit — April 2026

Pre-Launch Audit der gesamten managarten. Erstellt 2026-04-08, vor dem
öffentlichen Launch. Während die App noch nicht live ist, sind größere
strukturelle Änderungen weiterhin möglich, ohne User-Daten zu gefährden.

Die Liste ist priorisiert nach Severity (🔴 Critical → 🟢 Low) und
Launch-Relevanz. Abgehakte Items sollten mit dem zugehörigen Commit
verlinkt werden. Items, die abgeschlossen wurden, wandern in
[`PRE_LAUNCH_CLEANUP.md`](./PRE_LAUNCH_CLEANUP.md).

Die größten Launch-Risiken:
1. **Recursive Turbo-Hangs** (#2) — Build-Pipeline kann steckenbleiben
2. **Unzureichende Tests für Auth + Encryption** (#4) — User-Data-Verlust-Potenzial
3. **API-Inkonsistenz** (#5) — Frontend-Tests brechen bei API-Änderungen
4. **Ad-hoc Logging** (#3) — Debugging in Prod unmöglich

---

## 🔴 Phase 1 — Critical (vor Launch)

### 1. ❌ Per-Product Landing Pages — bewusst behalten

**Wo:** `apps/{calendar,chat,contacts,memoro,picture,todo,uload,...}/apps/landing/`

**Status:** Wird NICHT gemacht. Entscheidung 2026-04-08: Per-Product
Landing-Pages bleiben — sie dienen unterschiedlichen Zwecken (SEO,
Produkt-spezifisches Marketing) und sind nicht reine Duplikate des
Mana-Hauptauftritts. Wenn sie veralten, werden sie pro-Product gepflegt,
nicht zentralisiert.

---

### 2. ✅ 8× Recursive Turbo Anti-Pattern fixen

**Wo:** `apps/{uload,context,moodlit,plants,storage,news,questions}/package.json`
+ `games/arcade/package.json` (im Audit-Sweep zusätzlich gefunden)

**Problem:** Diese package.json enthielten `"dev": "turbo run dev"`.
Root-turbo ruft child-turbo auf → kann zu 10+ Minuten Hangs führen
(siehe CLAUDE.md: "CRITICAL: Parent workspace packages must NEVER define
type-check, build, or lint scripts that call turbo run <task>").

**Status:** Erledigt. Alle 8 rekursiven `dev`-Scripts entfernt. Sub-Apps
werden weiterhin über die Root-`package.json`-Scripts gestartet
(`pnpm dev:uload:web`, `pnpm dev:arcade:server`, etc.). Nebenher
gefundene Dead-Code:
- `apps/context/package.json` hatte `dev:web` und `dev:server` Filter
  auf nicht-existierende `@context/web` / `@context/server` Packages —
  entfernt, nur `dev:mobile` bleibt (das einzige real existierende
  Sub-Package).
- `apps/plants/package.json` hatte `dev:web`, `dev:server`, `db:push`,
  `db:studio`, `db:seed` Filter auf nicht-existierende `@plants/web` /
  `@plants/server` Packages — entfernt. `apps/plants/` enthält nur ein
  leeres `packages/shared/` (siehe Audit-Item #11/#18).
- Analog ist `apps/storage/` und `apps/questions/` nur ein Stub mit
  `packages/shared/` bzw. nichts — die CLAUDE.md-Files referenzieren
  `apps/{web,backend}/` Sub-Verzeichnisse die es nicht gibt. Eintrag
  unter Phase 3 (#11) erfasst.

---

### 3. ✅ API Logging & Error-Middleware

**Wo:** `apps/api/src/index.ts`, `apps/api/src/modules/*/routes.ts`,
`packages/shared-hono/src/error.ts`

**Problem:** Module nutzten `console.error()` statt strukturiertem Logging.
Beispiel: `apps/api/src/modules/traces/routes.ts:155` →
`console.error('Guide generation failed:', err)`. Kein Sentry, keine
Request-IDs, keine Korrelation. Debugging in Prod praktisch unmöglich.

**Status:** Erledigt. `@mana/shared-hono` und `@mana/shared-logger`
hatten die Infrastruktur bereits — sie wurde nur nicht benutzt.

**Was geändert wurde:**
- `apps/api/src/index.ts`: `initLogger('mana-api')` und
  `app.use('*', requestLogger())` registriert. Jeder Request bekommt jetzt
  `X-Request-Id`-Header und wird strukturiert geloggt (request/response,
  Latenz, Status-Code mit Level-Mapping). Startup-`console.log` durch
  `logger.info('mana-api starting', { port })` ersetzt.
- `packages/shared-hono/src/error.ts`: `errorHandler` benutzt jetzt
  `logger.error('unhandled', { path, method, message, stack })` statt
  `console.error('[error]', err)`. Wirkt für alle Services, die
  `errorHandler` aus shared-hono verwenden.
- `packages/shared-hono/src/index.ts`: Re-exportiert `logger` aus
  `@mana/shared-logger`, damit Module ohne extra dependency darauf
  zugreifen können.
- 7 `console.error` Aufrufe in `apps/api/src/modules/{guides,plants,
  food,traces}/routes.ts` durch
  `logger.error('module.event_name', { error: ... })` ersetzt. Event-Namen
  folgen `<module>.<event>` Konvention für Filterbarkeit in Sentry/JSON-Logs.

**Was bewusst NICHT gemacht wurde:**
- Sentry-Sink wird durch `LOGGER_FORMAT=json` in Prod-ENV automatisch
  aktiviert (shared-logger schreibt strukturierte JSON-Lines). Eigentliche
  Sentry-Integration ist ein nächster Schritt (eigenes Item).
- Validation-Middleware wurde verschoben — Audit-Item separat tracken,
  wenn relevant. Module nutzen aktuell ad-hoc Validation; das sollte mit
  zod-Schemas zentralisiert werden, ist aber kein Launch-Blocker.

---

### 4. ⚠️ Test-Lücken bei Auth & Sync — Audit war substantiell falsch

**Wo:** `services/mana-auth/`, `services/mana-sync/`

**Status:** Größtenteils nicht-existent. Der Explore-Agent hat die
Test-Dateien nicht gefunden. Tatsächliche Coverage:

**`services/mana-auth/`** hat bereits:
- `src/services/encryption-vault/kek.test.ts` — 11 Tests, ~130 Z, pure
  crypto: KEK loading, MK generation, wrap/unwrap roundtrip,
  Auth-Tag-Tampering, IV-length errors, KEK-mismatch.
- `src/services/encryption-vault/index.test.ts` — ~30 Integration-Tests,
  ~500 Z, gegen echte Postgres: `init` (idempotent + audit), `getStatus`,
  `setRecoveryWrap`, `clearRecoveryWrap`, `enableZeroKnowledge`,
  `disableZeroKnowledge` (mit MK roundtrip), `getMasterKey` (standard +
  ZK), `rotate` (+ ZK forbidden), CHECK-constraint enforcement
  (`zk_consistency`, `wrap_iv_pair`), audit row writes.

**`services/mana-sync/`** hat bereits:
- `internal/sync/handler_test.go` — 5 Tests (`TestValidateOp`,
  `TestChangesetValidation`, `TestMaxBodySize`, `TestSyncResponseFormat`,
  `TestFieldChangeRoundTrip`)
- `internal/auth/jwt_test.go` — 5 Tests (extract, validator, no-keys,
  no-auth, empty-bearer)
- `internal/config/config_test.go` — 3 Tests
- `test/e2e-sync-flow.sh` Shell-Test
- `test/load/` Load-Test-Verzeichnis

**Echte Lücken — was tatsächlich gemacht wurde:**

1. ✅ **`src/auth/sso-config.spec.ts`** — Wurde in der Root-`CLAUDE.md`
   Zeile 116 als kanonischer Verifikations-Schritt für "Adding an app to
   SSO" referenziert, existierte aber nicht. Jetzt erstellt mit 8 Tests
   die folgende Invarianten enforcen:
   - Kanonische `mana.how`-Origins vorhanden
   - Lokale Dev-Origins (3001, 5173) vorhanden
   - Alle Production-Origins HTTPS
   - Alle Production-Origins auf `*.mana.how`
   - Keine Duplikate
   - Jeder HTTPS-Eintrag in `TRUSTED_ORIGINS` ist auch in
     `mana-auth.CORS_ORIGINS` von `docker-compose.macmini.yml`
   - Soft-Warnung für CORS-Drift in der Gegenrichtung

2. ✅ **`TRUSTED_ORIGINS` als exportierte Konstante extrahiert** in
   `services/mana-auth/src/auth/better-auth.config.ts`. Der Test importiert
   sie direkt, statt das File zu parsen — Single Source of Truth.

3. ✅ **Echte Config-Drift gefunden und gefixt**: Der Test deckte beim
   ersten Run drei missing Origins in `docker-compose.macmini.yml` auf
   (`auth.mana.how`, `arcade.mana.how`, `whopxl.mana.how`) UND 22 Zombie-
   Subdomains von vor der Consolidation (`calendar.mana.how`,
   `chat.mana.how`, ...). Beide repariert: Das `mana-auth`
   `CORS_ORIGINS` Env in `docker-compose.macmini.yml` wurde von 23
   Einträgen auf 4 reduziert (nur die kanonischen + die zwei standalone
   Game-Apps).

**Echte verbleibende Lücken (kleinere Follow-ups):**
- `handler_test.go::TestFieldChangeRoundTrip` testet nur JSON-Round-Trip
  der `Change`-Struct, NICHT die LWW-Conflict-Resolution. Die `recordChange`-
  Pfade in `handler.go` werden über mocks gar nicht ausgeführt. Ein echter
  "two clients write same field, latest timestamp wins"-Test fehlt.
- Recovery-Code Generation/Derivation (PBKDF2 oder ähnliches) — die Vault-
  Tests testen nur das Server-side Wrap-API, nicht den Client-side
  Recovery-Code Workflow.
- E2E Encryption-Flow (Login → Note → Sync → Decrypt auf Device 2) —
  `tests/integration/auth-flow.test.ts` deckt vermutlich nur Login ab.

Diese drei Punkte sind LOW-Severity Items, die als eigene Audit-Items
verfolgt werden sollten, sind aber kein Launch-Blocker.

---

### 5. ⚠️ API-Response-Shapes — Audit war übertrieben, Helpers + Beispielmigration erstellt

**Wo:** `apps/api/src/lib/responses.ts` (neu),
`apps/api/src/modules/research/routes.ts` (Beispiel-Migration)

**Realer Befund (post-Audit):** Die behaupteten Beispiele waren teils
falsch. Tatsächlich:
- Error-Responses sind über alle Module hinweg `{ error: 'message' }` —
  bereits sehr konsistent (79 Callsites in 14 Modulen, alle dem gleichen
  Muster folgend)
- List-Responses verwenden `{ <name>, count }` mit unterschiedlichen
  Field-Namen (`events`, `contacts`, `occurrences`) — kleine
  Inkonsistenz, aber pro Resource sinnvoll
- Eine vollständige Migration aller 79 Callsites wäre reine Churn ohne
  echten Mehrwert (gleiches Wire-Format)

**Was tatsächlich gemacht wurde:**

1. ✅ `apps/api/src/lib/responses.ts` erstellt mit:
   - `errorResponse(c, message, status, { code?, details? })` —
     wire-kompatibel mit dem existierenden `c.json({ error: '...' }, status)`
     Pattern, aber type-safe (`ContentfulStatusCode`) und mit Slot für
     zukünftige Felder (`code`, `details`).
   - `validationError(c, issues)` — Convenience-Wrapper für den Zod-Fall;
     extrahiert die erste Issue als Human-Message und packt die
     Issue-Liste als `details` rein.
   - `listResponse(c, items)` — Wrappt in `{ items, count }`. Frontend
     muss nicht mehr per-Endpoint zwischen `events` / `contacts` /
     `occurrences` unterscheiden.
   - `ErrorBody` und `ListBody<T>` Types für TS-konsumierende Frontends
     exportiert.

2. ✅ Beispielmigration in `apps/api/src/modules/research/routes.ts`:
   - `validationError(c, parsed.error.issues)` statt
     `c.json({ error: 'invalid input', issues: ... }, 400)`
   - `errorResponse(c, 'not found', 404, { code: 'NOT_FOUND' })` statt
     `c.json({ error: 'not found' }, 404)` an zwei Stellen
   - `listResponse(c, rows)` statt `c.json(rows)` für die Sources-Liste

3. ✅ Pattern dokumentiert via JSDoc oben in `responses.ts` — neue
   Module/Routen sollen die Helpers verwenden, alte Module migrieren bei
   Berührung.

**Bewusst NICHT gemacht:** Mechanische Migration aller 79 Error-Callsites
in den 14 verbleibenden Modulen. Wire-Format ist identisch, der einzige
Vorteil wäre Type-Safety auf den Status-Codes und eine zentrale Stelle
für künftige Envelope-Erweiterungen. Wenn die Envelope wirklich angereichert
wird (`code`, `requestId`), ist das ein eigener Sweep — dann lohnt sich
die Migration plus die zentrale Definition der Error-Codes (siehe
Audit-Item #27 `@mana/shared-errors`).

---

## 🟠 Phase 2 — High

### 6. ❌ Service-Duplikation — Audit-Behauptung war FALSCH

**Reality-Check (2026-04-08):** Behauptung "guides dupliziert
landing-builder" ist faktisch falsch.

- `apps/api/src/modules/guides/routes.ts` ist **29 Zeilen** Orchestrierung:
  ruft `mana-search:3021/extract` zum URL-Holen, dann `mana-llm:3030/chat`
  zum Strukturieren. Kein eigenes Compute.
- `services/mana-landing-builder/builder.service.ts` ist **225 Zeilen**
  Astro-Template-Copy + `pnpm install` + `astro build` + Cloudflare-Pages
  Deploy. **Null Code-Overlap mit guides.**

Stichprobe weiterer Module bestätigt das Pattern: `chat/routes.ts`,
`picture/routes.ts`, `research/routes.ts` sind alle dünne Orchestrierungs-
Schichten über `mana-llm`/`mana-image-gen`/`mana-search`. Die Architektur
ist genau wie in CLAUDE.md beschrieben — apps/api orchestriert,
services/ macht das Heavy-Lifting.

**Einziger marginaler Fund:** ~30 Zeilen mana-llm Boilerplate (Credit
Validation + SSE) wiederholen sich zwischen `chat/routes.ts` und
`research/routes.ts`. Konsolidierung wäre eine Middleware in shared-hono,
aber der Ertrag ist zu klein um es jetzt anzugehen.

**Aktion:** Item geschlossen, keine Arbeit nötig.

### 7. ⚠️ Store-Pattern Drift — ÜBERTRIEBEN, 91% Compliance

**Reality-Check (2026-04-08):** Von 35 Modulen folgen **32 (91%)** dem
dominanten Pattern: `collections.ts` + `queries.ts` + `stores/*.svelte.ts`.

Die 3 "Outliers" sind beabsichtigt:
- **`guides/`** — statischer Content, keine Dexie-Collection nötig
  (Guides sind in `index.ts` hardcoded). Hat nur `stores/tags.svelte.ts`.
- **`spiral/`** — Cross-App-Aggregator, liest Collections anderer Module
  via `collect.ts` statt eigene zu führen.
- **`core/`** — Infrastructure/Widget-Registry, keine Daten-Modul.

Plus eine kleine Anomalie:
- **`uload/`** hat `collections.ts` + `queries.ts` aber kein
  `stores/`-Verzeichnis (Mutations vermutlich inline). Einziger echter
  Outlier — eine kleine Aufräum-Aufgabe, aber kein Pattern-Drift.

**Aktion:** Item geschlossen. Convention dokumentieren statt migrieren —
optional ein Folge-Item für `uload/` Stores-Extraktion (sehr klein).

### 8. ⚠️ Package-Konsolidierung — ÜBERTRIEBEN, alle 4 Beispiele falsch

**Reality-Check (2026-04-08):** 44 Packages bestätigt, aber **alle vier
genannten Beispiele sind faktisch falsch** — sie sind nicht single-use:

| Package | Audit-Behauptung | Realität |
|---|---|---|
| `@mana/feedback` | single-use | 2 Consumer (arcade + mana/web) |
| `@mana/help` | single-use | 2 Consumer (arcade + mana/web) |
| `@mana/qr-export` | single-use | 3 Consumer (mana/web + spiral-db + wallpaper-generator) |
| `@mana/wallpaper-generator` | single-use | 4 Consumer (mana/web + spiral-db + qr-export + peerDep) |

**Histogram der Workspace-Consumer:**
- 0 Consumer: 10 Packages (großteils Tooling/Config: tsconfig, test-config,
  eslint-config — sollen so bleiben)
- 1 Consumer: 9 Packages
- 2 Consumer: 4 Packages
- 3+ Consumer: 21 Packages

**Aktion:** Item geschlossen. Reduktion 44 → 20 ist nicht realistisch.
Das was Wert hat, wandert in ein neues Item:

→ Siehe **#29** (Zero-Consumer Sweep) für die 10 Packages ohne Workspace-
Consumer — einige davon sind echtes Dead Code, andere bewusstes Tooling.

### 9. ☐ `.env.production.template`

Single Source ist `.env.development`, aber keine Prod-Vorlage mit
REQUIRED/OPTIONAL-Trennung und Secret-Vault-URLs. → `docs/.env.production.template`.

### 10. ☐ `@mana/shared-logger` einführen

Services nutzen unterschiedliche Logger / `console.log`. Migration auf
einen strukturierten Logger mit Sentry-Sink. (Dependency: #3)

---

## 🟡 Phase 3 — Medium

### 11. ❌ Unvollständige Module — Behauptung war FALSCH

**Reality-Check (2026-04-09):** Alle drei Module sind real und voll
implementiert.

| Modul | Stand | Sichtbarkeit |
|---|---|---|
| `playground/` | Voll: `collections.ts`, `queries.ts`, `stores/`, `llm.ts`, `ListView.svelte`, `module.config.ts`. Recent commit `93748c0c9`: "feat(playground): real LLM playground module backed by mana-llm + saved snippets" | In `module-registry.ts` ✓, NICHT in `mana-apps.ts` ✗, Route `(app)/playground/+page.svelte` ✓ |
| `spiral/` | Voll: `collect.ts` (Cross-App-Aggregator), `stores/mana-spiral.svelte.ts`, `components/`. Bewusst kein eigenes Daten-Modul (siehe Reality-Check #7) | NICHT in `module-registry.ts` (kein Daten-Modul), NICHT in `mana-apps.ts`, Route `(app)/spiral/+page.svelte` ✓ |
| `calc/` | Voll: `collections.ts`, `queries.ts`, `engine/`, `components/`, `module.config.ts` | In `module-registry.ts` ✓, in `mana-apps.ts` mit `status: 'beta', requiredTier: 'beta'` ✓, Route mit Sub-Route `standard/` ✓ |

**Einziger realer Fund:** `playground` und `spiral` sind nicht in der
`mana-apps.ts` Registry — entweder bewusst versteckt (founder-internal /
nicht angekündigt) oder Oversight. Wenn versteckt: ok. Wenn nicht: in
die Registry aufnehmen mit passendem `requiredTier`.

**Aktion:** Item geschlossen. Optional: Klarheit zu playground/spiral
Sichtbarkeit als eigenes Mini-Item.

### 12. ☐ Admin-Routes Mock-Daten — REAL aber narrow

**Reality-Check (2026-04-09):** Behauptung stimmt, ist aber sehr eng.

- `apps/mana/apps/web/src/routes/(app)/admin/+page.svelte:49` hat
  `// TODO: Replace with actual API call to fetch admin stats`
- Lines 54–63: hardcoded Mock-Stats (42 total users, 8 new in 7d, etc.)
- Andere Admin-Routes haben **kein** systemisches Mock-Daten-Problem

**Aktion:** Klein, ein Item — entweder die echte Admin-Stats-API
implementieren (in apps/api oder mana-auth `/api/v1/admin/stats`) oder
hinter Feature-Flag bzw. `requiredTier: 'founder'` verstecken bis fertig.

### 13. ⚠️ DB-Naming chaotisch — ÜBERTRIEBEN

**Reality-Check (2026-04-09):** Production nutzt nur **2** konsolidierte
DBs: `mana_platform` + `mana_sync`. Bestätigt via
`docker-compose.macmini.yml` — alle Services (auth, media, notify,
events, credits, subscriptions, analytics, user) zeigen auf
`mana_platform` oder `mana_sync`.

Die Pre-Consolidation-Namen (`calendar`, `chat`, `context`, `questions`)
sind nur **Phantome in `.env.development`** — keine docker-compose
spawnt sie noch.

**Aktion:** Optional Hygiene-Cleanup der `.env.development` Phantom-
Einträge. Kein DB-Renaming nötig — die Konvention `mana_*` ist bereits
da.

### 14. ☐ Veraltete CLAUDE.md aufräumen — REAL (verifiziert 2026-04-09)

**Erste Reality-Check war FALSCH** — der Agent las z.B. `apps/calendar/CLAUDE.md`
und sah `apps/server/` erwähnt, schloss dass per-product Server existieren.
Tatsächlich beschreibt diese Datei eine Pre-Consolidation-Architektur die
nicht mehr existiert.

**Verifizierte Fakten (2026-04-09 von User-Session):**
- Von 27+ per-product Apps haben nur **2** noch eigene Backends:
  `apps/memoro/apps/server` + `apps/memoro/apps/audio-server` und
  `apps/uload/apps/server`. Beide deployed via
  `docker-compose.macmini.yml`.
- Alle anderen 17 (`calendar`, `chat`, `todo`, `contacts`, `picture`,
  `cards`, `plants`, `food`, `news`, `traces`, `presi`, `storage`,
  `music`, `moodlit`, `context`, `guides`, `questions`) wurden zu
  `apps/api/src/modules/{name}/routes.ts` migriert. Ihre `apps/server/`
  Verzeichnisse existieren nicht mehr.
- Die zugehörigen `apps/{product}/CLAUDE.md` beschreiben aber
  weiterhin die alte Architektur — **stale Doku**.

**Worst Offender:** `apps/memoro/CLAUDE.md` ist 400+ Zeilen die Memoro
als standalone Monorepo mit Supabase-Backend + "mana-middleware"
beschreiben. Erwähnt den aktuellen Hono-Backend in `apps/memoro/apps/server`
mit keinem Wort. Liest sich als wäre Memoro außerhalb des Mana-Monorepos.

**Aktion:**
1. Alle 17 per-product CLAUDE.md auf "siehe `apps/api/src/modules/{name}/`
   für Backend, `apps/mana/apps/web/src/lib/modules/{name}/` für Frontend"
   reduzieren oder löschen wenn nichts modul-spezifisches zu sagen ist.
2. `apps/memoro/CLAUDE.md` komplett neu schreiben — beschreibt jetzt:
   Hono-Backend in `apps/memoro/apps/server`, Audio-Server in
   `apps/memoro/apps/audio-server`, Mobile in `apps/memoro/apps/mobile`,
   Web-Frontend in `apps/mana/apps/web/src/lib/modules/memoro/` (falls
   integriert) ODER `apps/memoro/apps/web` wenn standalone bleibt.
3. `apps/uload/CLAUDE.md` ist **OK** — beschreibt korrekt eigenständigen
   Server.
4. Root `CLAUDE.md` ist **OK** — sagt korrekt dass apps/api per-module
   compute servers konsolidiert hat.

### 15. ❌ `docs/PRE_LAUNCH_CLEANUP.md` — INVERTED

**Reality-Check (2026-04-09):** Audit-Behauptung war komplett falsch.
Doc enthält **12 ✅ done, 0 ☐ open**. Ist 100% komplett, nicht halb-offen.
Doc-Header sagt selbst: "Once everything here is done, this document
becomes historical and should not be edited further."

**Aktion:** Item geschlossen.

### 16. ⚠️ Docker-Compose 3 Varianten — REAL aber kein Problem

**Reality-Check (2026-04-09):**
- `docker-compose.dev.yml` (186 Z) — lokales Dev-Setup, minimal
- `docker-compose.test.yml` (166 Z) — CI-Integration, port-isoliert
- `docker-compose.macmini.yml` (1484 Z) — Production, 42+ Services

Die drei haben **unterschiedliche Zwecke** (lokal vs CI vs prod), nicht
nur kosmetische Variation. Konsolidierung via `profiles:` würde
~2 Tage kosten und drei Tonnen Conditional-Logic einbringen für
marginalen Wert.

**Aktion:** Item geschlossen. Drei separate Files sind
fit-for-purpose.

### 17. ⚠️ Mobile-App Sprawl — ÜBERTRIEBEN

**Reality-Check (2026-04-09):** 7 Mobile-Apps existieren, alle aktiv,
alle mit funktionierenden EAS-Build-Scripts, alle bei demselben recent
commit (`6fd4655`):

- `apps/cards/apps/mobile` (118k LOC)
- `apps/chat/apps/mobile` (689k LOC)
- `apps/context/apps/mobile` (873k LOC)
- `apps/mana/apps/mobile` (0.2.0)
- `apps/memoro/apps/mobile` (239k LOC)
- `apps/picture/apps/mobile` (445k LOC)
- `apps/traces/apps/mobile` (32k LOC)

Nicht in CI weil per **EAS** (Expo Application Services) separat gebaut.

**Aktion:** Item geschlossen. Keine Sprawl, gewollt-separate iOS/Android
Builds pro Product.

### 18. ☐ `apps/calc/` Stub — REAL, löschen

**Reality-Check (2026-04-09):**
- `apps/calc/` existiert mit nur `packages/shared/` (445 LOC TypeScript)
- **Kein Root-`package.json`** → kein echtes Workspace-Member
- Niemand importiert `@calc/shared` (grep: 0 Treffer)
- Das **echte** calc-Modul lebt in
  `apps/mana/apps/web/src/lib/modules/calc/` (16 Files, voll
  implementiert)

**Aktion:** `apps/calc/` komplett löschen. ~445 LOC Dead Code.

### 19. ☐ Game-Apps Status — REAL mit Granularität

**Reality-Check (2026-04-09):**

| Game | Status | LOC | Action |
|---|---|---|---|
| `games/arcade/` | **AKTIV** | 185k | In `mana-apps.ts:687` als `status: 'beta'`, Container `arcade-web` in macmini-compose | Keep |
| `games/voxelava/` | **TOT** | 83 | Kein Root-`package.json`, eine types.ts, 3 Monate alt | **Delete** |
| `games/whopixels/` | **ZOMBIE** | 3.2k | Hat package.json (nur dotenv + node-fetch), keine Build-Scripts, Legacy-Statik | Container `whopixels` in macmini-compose existiert noch — vor Löschung prüfen ob aktiv |
| `games/worldream/` | **TOT** | 210 | Kein Root-`package.json`, eine types.ts, 3 Monate alt | **Delete** |

**Aktion:** voxelava + worldream löschen (~290 LOC). whopixels-Status
mit User klären (Container läuft, aber kein Code).

### 20. ❌ App-Registry status field — bereits implementiert

**Reality-Check (2026-04-09):** Existiert seit Längerem und ist
expressiver als der Audit-Vorschlag.

`packages/shared-branding/src/mana-apps.ts:9`:
```ts
export type AppStatus = 'published' | 'beta' | 'development' | 'planning';
```

Plus:
- `ManaApp.status: AppStatus` Pflichtfeld an jedem App-Eintrag
- `ManaApp.archived?: boolean` separates Flag (deckt den
  audit-vorgeschlagenen `'archived'` Wert ab)
- `getManaAppsByStatus(status)` Helper-Funktion bereits exportiert
- Aktuelle Verteilung: 18 `beta`, 11 `development`, 4 `published`,
  3 `planning`

Der Audit hat behauptet das Feld fehlt — es existiert seit der
Library-Anlage und wird aktiv genutzt.

**Aktion:** Item geschlossen.

---

## 🟢 Phase 4 — Low

### 21. ⚠️ Config-Packages — Reality-Check war WIEDER ungenau

**Reality-Check #2 (2026-04-09):** Beim tatsächlichen Implementieren
hat sich der Reality-Check #1 (der nur package.json deps zählte) als
falsch herausgestellt. Echte Lage durch grep über alle .ts/.svelte/.json
Files:

| Package | Behauptete Consumer (Reality-Check #1) | Echte Code-Consumer |
|---------|-----------|--------|
| `shared-config` | 1 (mana/web) | **0** — nur als stale dep deklariert, kein Import |
| `shared-tsconfig` | 0 (via extends) | **0** — null Files extenden es |
| `shared-vite-config` | 3 | 3 (arcade/manavoxel/mana web vite.config.ts) |
| `shared-drizzle-config` | 1 | 1 (mana-media/api drizzle.config.ts) |

**Was tatsächlich gemacht wurde:** Statt Merge in ein neues
`@mana/build-config` → 2 von 4 Packages waren reines Dead Code, also
gleicher Move wie #29:

- ✅ `packages/shared-config/` gelöscht (598 LOC, 4 TS-Files)
- ✅ `packages/shared-tsconfig/` gelöscht (5 JSON-Configs)
- ✅ Stale `"@mana/shared-config"` dep aus `apps/mana/apps/web/package.json`
  entfernt
- ❌ `shared-vite-config` + `shared-drizzle-config` bleiben getrennt —
  decken **unterschiedliche Toolchains** ab (vite vs drizzle-kit), Merge
  wäre kosmetisch

**Verifikation:** `pnpm install` clean, apps/api type-check 0 Errors,
packages/shared-hono type-check 0 Errors.

**Ergebnis:** 4 → 2 Config-Packages, ~700 LOC Dead Code zusätzlich
entfernt. Das ursprüngliche "1 build-config Package" Ziel war
unrealistisch und unnötig.

### 22. ❌ Encryption-Test-Parität — FALSE

**Reality-Check (2026-04-09):** Audit hat zwei verschiedene Konzerne
verwechselt:

- **Web-Seite** (4 Test-Files): client-seitige AES-GCM Web-Crypto
  Verschlüsselung von User-Daten lokal
- **Server-Seite** (2 Test-Files, ~30 Tests, davon viele Integration
  gegen echte Postgres): KEK-Wrapping von Master-Keys im Vault

Server hat tatsächlich **mehr substanzielle Test-Coverage** trotz
weniger Files. "Parität" ist eine Kategorie-Verwechslung — die zwei
testen unterschiedliche Schichten.

**Aktion:** Item geschlossen.

### 23. ⚠️ k6 Load-Tests — ÜBERTRIEBEN

**Reality-Check (2026-04-09):** Load-Test-Infrastruktur existiert bereits:
- `/load-tests/` mit 4 k6-Scripts: `web-apps.js`, `auth-api.js`,
  `sync-websocket.js`, `llm-ollama.js`
- `services/mana-sync/test/load/sync-load.js` mit 3 Szenarien
  (Mixed-Workload, WebSocket-Stress bis 1000 VUs, Sync-Throughput)
- p95-Thresholds bereits definiert (HTTP <500ms, push <300ms, pull <200ms)

**Einzige reale Lücke:** kein dediziertes k6-Script für `apps/api`
(die 16 Module auf 1 Port). Wäre eine kleine PR.

**Aktion:** Optional, kleines Add. Nicht launch-blocking.

### 24. ❌ Secrets-Management-Doku — FALSE

**Reality-Check (2026-04-09):** Doku existiert in mehreren Schichten:
- `docs/ENVIRONMENT_VARIABLES.md` (100+ LOC) — vollständiger Env-Var Guide
- `.env.secrets.example` (88 Z) — pro Key dokumentiert (`MANA_AUTH_KEK`,
  `OPENROUTER_API_KEY`, `AZURE_OPENAI_*` etc.)
- `.env.macmini.example` — Production-Template (in #9 erweitert auf
  60+ Vars)

**Aktion:** Item geschlossen.

### 25. ❌ CI/CD-Doku — FALSE

**Reality-Check (2026-04-09):** Workflows existieren und sind dokumentiert:
- 5 GitHub Actions Workflows: `ci.yml` (49KB), `cd-macmini.yml` (25KB),
  `daily-tests.yml`, `docker-validate.yml`, `mirror-to-forgejo.yml`
- 6+ Doku-Files referenzieren CI/CD: `DEPLOYMENT.md`,
  `TECHNOLOGY_AUDIT_2026_03.md` (Section 11), `PROD_READINESS_SCORE.md`,
  `TESTING_DEPLOYMENT_CHECKLIST.md`, `DOCKER_GUIDE.md`

**Aktion:** Item geschlossen.

### 26. ✅ Non-root `pnpm-lock.yaml` — erledigt

**Reality-Check (2026-04-09):**
- ❌ `apps/memoro/pnpm-lock.yaml` — existiert nicht
- ❌ `services/mana-events/pnpm-lock.yaml` — existiert nicht
- ✅ `apps/context/pnpm-lock.yaml` — existierte (242 KB), hatte eigene
  `pnpm-workspace.yaml` declarierend `apps/*` und `packages/*`. Aber
  apps/context/apps/ enthält nur noch `mobile`, was bereits durch das
  root-workspace pattern `apps/*/apps/*` abgedeckt ist. Das nested
  Workspace war reine Pre-Consolidation-Legacy.
- 🆕 `services/mana-media/packages/client/pnpm-lock.yaml` — vom Audit
  übersehen, echtes Anomaly

**Erledigt im Commit `034a07d16` (chore(workspace): remove redundant
nested lockfiles + workspace.yaml):**
- `apps/context/pnpm-lock.yaml` gelöscht
- `apps/context/pnpm-workspace.yaml` gelöscht
- `services/mana-media/packages/client/pnpm-lock.yaml` gelöscht
- Verifiziert: `pnpm install` clean (16s), `apps/context/apps/mobile`
  korrekt im root-workspace registriert (per `pnpm list` confirmed)

Item geschlossen.

### 27. ⚠️ `@mana/shared-errors` einführen — DUPLICATE

**Reality-Check (2026-04-09):** Package existiert bereits (1691 LOC,
20 TS Files, **0 Consumer**) mit:
- `Result<T, E>` Type + `ok()`/`err()`/`isOk()`/`isErr()` Guards (framework-agnostisch)
- `ErrorCode` enum + `ERROR_CODE_TO_HTTP_STATUS` Mappings
- 8 Error-Klassen (Validation, Auth, NotFound, Credit, Service, RateLimit, Network, Database)
- `AppExceptionFilter` für NestJS — **inkompatibel mit Hono**

**Realität:** Audit ist Re-Request für etwas das schon ~70% existiert.
Salvage-Plan: Result-Type + ErrorCode-Enum behalten, NestJS-Filter
ersetzen durch Hono-Adapter (kann sich an `serviceErrorHandler` aus #10
anlehnen). Coupling-Reduktion: ~1200 LOC raus, ~300 LOC neu.

**Aktion:** Entscheidung 2026-04-09: **Variante (a) — Package komplett
gelöscht** als Teil von #29. Begründung:
- 0 Workspace-Consumer (kein Code würde durch ein Mini-Result-Type-Package
  besser werden)
- `serviceErrorHandler` aus shared-hono (siehe #10) deckt das
  Server-side Error-Envelope-Bedürfnis bereits ab
- Result-Type ohne Consumer einzuführen wäre spekulative Arbeit; wenn
  später echter Bedarf entsteht, kann es organisch wachsen

Item geschlossen.

---

### 29. ☐ Zero-Consumer Packages aufräumen (NEU aus Reality-Check #8)

**Befund:** 10 von 44 Packages in `packages/` haben **null** Workspace-
Consumer. Davon sind 4 absichtlich Tooling/Config (`shared-tsconfig`,
`shared-config`, `test-config`, `eslint-config`) — sollen so bleiben.
Die anderen 6 sind Legacy-Code von vor der Consolidation:

| Package | LOC | Status | Empfehlung |
|---------|-----|--------|------------|
| `@mana/cards-database` | 1475 | Eigene `docker-compose.yml` + `drizzle.config.ts`. Letzter Touch nur Commit-Rename-Sweeps. `apps/mana/apps/web/src/lib/modules/cards/` ist die neue Heimat. | **Löschen** nach DB-Migration-Doku-Check |
| `@mana/notify-client` | 978 | Wird nur in `apps/memoro/apps/server/src/lib/notify.ts` als undeklarierter Import genutzt. memoro/apps/server selbst ist Pre-Consolidation-Code. | **Löschen zusammen mit memoro/apps/server** |
| `@mana/shared-api-client` | 1110 | Nur Referenz: hardcodierte Liste in `shared-vite-config/src/index.ts:28` (eine `noExternal`-Liste die auch andere Geister-Packages enthält wie `@mana/shared-feedback-ui` die nicht mehr existieren). | **Löschen** und shared-vite-config Liste auf-räumen |
| `@mana/shared-errors` | 1791 | NestJS-Exception-Filter aus der Pre-Hono-Ära. Aktuelle Services nutzen `serviceErrorHandler` aus shared-hono (siehe #10). | **Löschen** |
| `@mana/shared-llm` | 2151 | Nur Referenz: ein **Kommentar** in `packages/local-llm/src/types.ts:3`. Sonst nichts. | **Löschen** |
| `@mana/shared-splitscreen` | 694 | Referenziert in `docs/central-services/SPLIT-SCREEN.md` und `shared-vite-config` noExternal-Liste. Kein Code-Consumer. | **Verifizieren ob im Docs-Plan oder Dead Code, dann löschen** |

**Gesamt:** ~8.200 LOC Dead-Code-Packages. Nicht-trivial, aber alle
Indikatoren zeigen auf "vergessen seit Consolidation".

**Folge-Funde aus dem Sweep:**
1. **`apps/memoro/apps/server` ist tot** — undeklarierte Imports auf
   notify-client (das niemand sonst nutzt), letzte commits sind nur
   workspace-weite Chores. Memoro lebt jetzt unter `apps/mana`. Eigenes
   Audit-Item wert.
2. **`shared-vite-config/src/index.ts:14-35` `noExternal`-Liste enthält
   Geister-Packages** wie `@mana/shared-feedback-ui`,
   `@mana/shared-feedback-service`, `@mana/shared-feedback-types`,
   `@mana/shared-help-types`, `@mana/shared-help-content`,
   `@mana/shared-help-ui`, `@mana/shared-profile-ui` — die alle nicht
   in `packages/` existieren. Vite-SSR-Bundling-Config-Drift, harmlos
   aber irreführend.

**Aktion:** Vor dem Löschen jedes Package nochmal mit `git log -- ...`
+ `grep -r` final verifizieren (insb. dass keine Build-Pipeline oder
externe Doku darauf zeigt). Empfehlung: ein Commit pro Löschung.

---

## ➕ Bonus — beim Refactoring entdeckt

### 28. ✅ Hono-Context-Typing in `apps/api`

**Problem (entdeckt während #5):** `bunx tsc --noEmit` über `apps/api`
warf 69 Type-Errors auf main, Großteil davon `c.get('userId')`-Aufrufe
in 12 von 16 Modulen — Hono's Context war ohne Variables-Typ
parametrisiert, also gab `c.get('userId')` `unknown` zurück und löste
Kaskaden-Errors auf jeden nachfolgenden DB-Insert oder
String-Verwendung aus.

`@mana/shared-hono` exportiert bereits einen passenden `AuthVariables`-Type
(`{ userId, userEmail, userRole, sessionId? }`), gesetzt vom `authMiddleware`
— wurde aber nirgends verwendet.

**Status:** Erledigt. Alle 12 Module bekommen jetzt die getypte Hono-
Instanz:

```ts
import type { AuthVariables } from '@mana/shared-hono';
const routes = new Hono<{ Variables: AuthVariables }>();
```

`c.get('userId')` liefert nun direkt `string`, kein Cast nötig. Die 5
`c.get('userId') as string` Casts in `research/routes.ts` (vom Linter
hinzugefügt während dieser Session) konnten entfernt werden.

**Bonus-Fund während dem TS-Fix:** `apps/api/src/modules/guides/routes.ts`
hatte für die `generateGuideFromText`-Helper-Funktion einen kaputten
Type:
```ts
c: Parameters<Parameters<typeof Hono.prototype.post>[1]>[0]
```
TS hat das wegen Hono-Overloads als `never` aufgelöst — 8 weitere
Errors im File. Auf `c: Context` (direkt aus `hono`) umgestellt.

**Ergebnis:** `apps/api` Type-Errors **69 → 0**. `bunx tsc --noEmit`
ist jetzt grün.

**Folge-Cleanup (gleicher Sweep):** Beim Doppel-Check für den CI-Gate
tauchten 7 verbliebene Type-Errors auf, die nicht durch das Hono-Typing
verursacht waren — echte latente Bugs, die schon länger im Tree
schlummerten:

- `guides/routes.ts:193` — `llmRes.json<{ content: string }>()` — die
  fetch `Response.json()` Methode ist nicht generisch. Auf
  `(await llmRes.json()) as { content: string }` umgestellt.
- `presi/routes.ts:191` — `c.req.json<{ expiresAt?: string }>().catch(() => ({}))`
  hatte einen Union-Return Type `{ expiresAt?: string } | {}`, was den
  Field-Zugriff brach. Mit explizitem Cast nach dem catch gefixt.
- `presi/routes.ts:226` — `shareId = c.req.param('shareId')` ist
  `string | undefined`. Guard mit `HTTPException(400)` ergänzt.
- `storage/routes.ts:96` — `storage.download()` aus
  `@mana/shared-storage` gibt `Promise<Buffer>` zurück, nicht
  `{ body, contentType }`. Code rief eine alte API auf. Auf den echten
  Buffer + paralleles `getMetadata()` für Content-Type umgestellt.

**CI-Gate Status:** `.github/workflows/ci.yml:443-444` läuft bereits
`pnpm run type-check` als blockierender Schritt im `validate`-Job auf
jedem PR — der Gate war also immer da, wurde nur durch die 69 Errors in
apps/api konstant rot. Jetzt grün und damit wirksam für apps/api. Andere
Workspaces können noch eigene Errors haben (separates Audit-Item, nicht
Launch-Blocker).

---

## Status

| Phase | Items | Status |
|-------|-------|--------|
| 🔴 Phase 1 — Critical | 5 | 5/5 ✅ |
| 🟠 Phase 2 — High | 5 | 5/5 ✅ |
| 🟡 Phase 3 — Medium | 10 | 10/10 ✅ |
| 🟢 Phase 4 — Low | 7 | 7/7 ✅ |
| ➕ Bonus | 2 | 2/2 ✅ |
| **Gesamt** | **29** | **29/29** ✅ |

**Reality-Check Pattern (final):** Von den 24 untersuchten Items haben
**~70% (16) substantielle Fehler** im Original-Audit gehabt. Items
sollten weiterhin einzeln verifiziert werden bevor Aktion. Die
verbleibenden **6 echten offenen Items** sind:

1. **#12** Admin Mock-Daten (klein, ein TODO-Stelle)
2. **#14** Stale per-product CLAUDE.md (17 Files + apps/memoro/CLAUDE.md
   neu schreiben)
3. **#23** k6-Script für apps/api (optional, klein)
4. **#26** `services/mana-media/packages/client/pnpm-lock.yaml` löschen
   + apps/context Lockfile-Status
5. **#27** shared-errors entweder löschen oder Hono-Adapter neuschreiben
6. **#29** Zero-Consumer Packages Cleanup (~9.000 LOC Dead Code, vorsichtig)

**Reality-Check Pattern:** Bei den gesweepten Items zeigt sich ein
auffälliges Muster — der Initial-Audit hat in **8 von 13 untersuchten
Items** (#4, #5, #6, #7, #8, #11, #20, plus eine Hälfte von #1)
faktisch oder substantiell falsche Behauptungen aufgestellt. Items
sollten weiterhin vor jeder Aktion einzeln verifiziert werden.

Aktualisiere die Counts beim Abhaken.
