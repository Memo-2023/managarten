# Technology Audit - Mana Monorepo

**Datum:** 27. Maerz 2026
**Status:** Noch nichts live - vollstaendiger Umbau moeglich
**Scope:** Gesamtes Repository - Architektur, Services, Frontend, Infrastruktur, Testing, Deployment

---

## Zusammenfassung

| Bereich | Bewertung | Handlungsbedarf |
|---------|-----------|-----------------|
| Architektur-Vision (Local-first) | Stark | Kein Umbau noetig |
| Backend-Proliferation | **Kritisch** | 19 NestJS + 1 Go + 1 Hono = 21 Backends |
| Frontend (SvelteKit) | Gut | Versionen konsistent, Svelte 5 durchgaengig |
| Mobile (Expo) | Mittel | Version-Divergenz (SDK 52/54/55) |
| Shared Packages | Zu granular | 55 Packages, viele konsolidierbar |
| Infrastructure | Ambitioniert | 67 Container auf einem Mac Mini |
| Testing | **Kritisch** | ~162 Testdateien fuer 24 Apps + 16 Services |
| Services-Mix | Problematisch | 4 Sprachen (TS, Python, Go, Bun) |
| CI/CD | Funktional | Change-Detection gut, kein Staging |
| Datenbank | Grundsolide | PostgreSQL 16 + Drizzle ORM |

---

## Inhaltsverzeichnis

1. [Groesstes Problem: 19 identische NestJS-Backends](#1-groesstes-problem-19-identische-nestjs-backends)
2. [NestJS vs. Alternativen](#2-nestjs-vs-alternativen)
3. [Sprachen-Wildwuchs](#3-sprachen-wildwuchs-4-runtime-umgebungen)
4. [Mobile Apps: Expo-Version-Divergenz](#4-mobile-apps-expo-version-divergenz)
5. [Frontend: Svelte 5 + SvelteKit](#5-frontend-svelte-5--sveltekit)
6. [Local-First Architektur](#6-local-first-dexie--mana-sync)
7. [Infrastruktur & Deployment](#7-infrastruktur--deployment)
8. [Datenbank](#8-datenbank)
9. [Testing](#9-testing)
10. [Shared Packages](#10-shared-packages)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Frontend Store-Duplikation](#12-frontend-store-duplikation)
13. [Services-Analyse](#13-services-analyse-detail)
14. [Sicherheit & fehlende Stuecke](#14-sicherheit--fehlende-stuecke)
15. [Was nicht geaendert werden sollte](#15-was-nicht-geaendert-werden-sollte)
16. [Priorisierte Empfehlungen](#16-priorisierte-empfehlungen)

---

## 1. Groesstes Problem: 19 identische NestJS-Backends

Das ist mit Abstand das dringendste Thema. Es gibt **19 separate NestJS-Backends**, die alle quasi identisch aufgebaut sind:

```
ConfigModule + DatabaseModule + HealthModule + MetricsModule + AdminModule + CRUD-Module
```

Jeder einzelne Backend-Service:
- Ist ein eigener Docker-Container (~50 MB node_modules)
- Braucht seinen eigenen Port (3007, 3031, 3032, 3033, 3034...)
- Hat eigene Health-Checks, Metrics, Auth-Integration
- Wird separat gebaut, deployed, ueberwacht
- Dupliziert ~300-400 Zeilen identischen Boilerplate

### Backend-Komplexitaets-Analyse

| Kategorie | Backends | Source Files | Empfehlung |
|-----------|----------|-------------|------------|
| **Komplex (behalten)** | Chat, Todo, Calendar, Contacts, Storage, Mukke | 60-89 pro Backend | Eigenstaendige Services |
| **AI-spezialisiert (behalten)** | Picture, Plants, Food | 30-50 pro Backend | Eigene AI-Pipelines |
| **Triviales CRUD (konsolidieren)** | Quotes (20!), Clock (31), Presi, CityCorners, Questions, Context | 20-35 pro Backend | -> 1 Content Service |
| **Eliminieren** | Photos (mana-media Proxy), Skilltree (Frontend-only) | minimal | Backend loeschen |

### Beispiel: Quotes Backend

Das Quotes Backend hat **20 TypeScript-Dateien** und genau zwei Features:

```typescript
// app.module.ts - Das ist der gesamte Service:
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    FavoriteModule,    // CRUD fuer Favoriten
    ListModule,        // CRUD fuer Listen
    HealthModule.forRoot({ serviceName: 'quote-backend' }),
    MetricsModule.register({ prefix: 'quotes_' }),
    AdminModule,
  ],
})
export class AppModule {}
```

Dafuer laeuft ein eigener Docker-Container mit eigenem Port, eigener Health-Check, eigenem Prometheus-Scrape-Target.

### Empfehlung: Konsolidierung auf 2-4 Backends

Da bereits **mana-sync (Go)** als zentraler Sync-Server existiert und **local-first** das Paradigma ist, brauchen die meisten NestJS-Backends nicht mehr zu existieren. Die Daten leben in IndexedDB und synchen ueber mana-sync nach PostgreSQL.

| Service | Zweck | Ersetzt |
|---------|-------|---------|
| **mana-sync** (Go) | Sync, CRUD, Echtzeit | 7+ CRUD-only Backends |
| **mana-auth** (NestJS) | Auth, Credits, Billing, Admin | Bleibt |
| **mana-compute** (Hono/Bun) | App-spezifische Logik (RRULE, Reminders, AI-Pipelines) | Todo-Server-Pattern fuer alle |
| **mana-chat** (NestJS) | AI Chat (Streaming, Azure OpenAI) | Chat-Backend |

**Geschaetzte Einsparung:** ~5.500 Zeilen duplizierter Code, 7-8 Docker-Container weniger, ~1 GB RAM.

### Duplizierten Boilerplate pro Backend

| Pattern | Zeilen pro Backend | Total (19x) | Einsparbar |
|---------|-------------------|-------------|-----------|
| app.module.ts | 40 | 760 | ~70% |
| main.ts bootstrap | 10 | 190 | ~80% |
| database.module.ts | 35 | 665 | ~90% |
| CRUD Controllers (Durchschnitt) | 60 | 1.140 | ~65% |
| CRUD Services (Durchschnitt) | 80 | 1.520 | ~70% |
| Entity Schemas (Durchschnitt) | 25 | 475 | auto-generierbar |
| **Gesamt** | **~290** | **~5.500** | **~85%** |

---

## 2. NestJS vs. Alternativen

### Problem mit NestJS fuer CRUD-Backends

- Schwer (~50 MB node_modules pro Backend)
- Viel Boilerplate (Module, Controller, Service, DTO fuer jede Entity)
- Overkill fuer simple CRUD-Operationen
- NestJS Version-Drift: 18 Backends auf ^10.4.x, Cardecky auf ^11.0.1

### Empfehlung

| Technologie | Wann verwenden |
|-------------|---------------|
| **Hono + Bun** | Leichte Compute-Server (wie der Todo-Server) |
| **Go (mana-sync)** | Performance-kritisch, Echtzeit, WebSocket |
| **NestJS** | Nur fuer mana-auth (komplex, viele Module, 174 Source Files) |

Der Todo Hono/Bun Server ist ein gutes Pattern:

```json
{
  "dependencies": {
    "drizzle-orm": "^0.45.1",
    "hono": "^4.7.0",
    "postgres": "^3.4.5",
    "rrule": "^2.8.1"
  }
}
```

Leicht, schnell, genau die Abhaengigkeiten die er braucht.

---

## 3. Sprachen-Wildwuchs: 4 Runtime-Umgebungen

Aktuell im Einsatz:

| Sprache | Services | Berechtigung |
|---------|----------|-------------|
| **TypeScript/Node.js** (NestJS) | 19 Backends + Auth + 5 Infra-Services | Historisch, aber zu viel |
| **Python** (FastAPI) | mana-llm, mana-stt, mana-tts, mana-voice-bot, mana-image-gen | Berechtigt (ML/AI Libraries) |
| **Go** | mana-sync, mana-matrix-bot, mana-api-gateway-go | Berechtigt (Performance) |
| **Bun** (Hono) | Todo Server | Gutes Pattern |

### Problem: Drei angefangene Go-Rewrites

| Service | Go-Version Status | NestJS-Version Status |
|---------|------------------|----------------------|
| mana-api-gateway-go | ~35% fertig | Funktional |
| mana-search-go | <10%, kaum Code | Funktional |
| mana-matrix-bot | Fertig (21 Services -> 1 Go Binary) | Entfernt |

### Empfehlung

Entscheidet euch:
- **Option A:** Go fuer alle Infrastruktur-Services (sync, gateway, search), TypeScript nur fuer Auth
- **Option B:** Alles bei TypeScript lassen, aber NestJS durch Hono/Bun ersetzen

Mischt nicht beides halbfertig. Die angefangenen Go-Rewrites (api-gateway-go, search-go) entweder fertigstellen oder loeschen.

---

## 4. Mobile Apps: Expo-Version-Divergenz

| App | Expo SDK | React Native | NativeWind |
|-----|----------|-------------|------------|
| context, chat | **52** | 0.76 | ^3.4.0 |
| picture, cards, mana | **54** | 0.81 | ^4.2.1 |
| matrix | **55** | 0.83 | latest |

### Empfehlung

Alle auf **Expo SDK 55** (neueste) bringen. Bei 7 Mobile-Apps ist das noch machbar. Expo hat gute Upgrade-Guides. Zusaetzlich:

- NativeWind Version vereinheitlichen (v3 vs v4 ist ein Breaking Change)
- Navigation-Timing-Workarounds fixen (requestAnimationFrame-Hacks in Picture Mobile)

---

## 5. Frontend: Svelte 5 + SvelteKit

### Bewertung: Gut

- Alle 22 Web-Apps auf Svelte 5.41.0 und SvelteKit 2.47.1 (konsistent)
- Runes-Mode durchgaengig (korrekt: `$state`, `$derived`, `$effect`)
- Shared packages gut extrahiert (shared-auth, shared-ui, shared-theme)
- Tailwind CSS 4 durchgaengig
- TypeScript strict mode ueberall

### Probleme

- 2 Apps skippen type-check (`picture/web`, `chat/web`) wegen shared-ui Type-Errors
- Store-Pattern wird manuell kopiert statt shared (siehe Abschnitt 12)

### Kein Handlungsbedarf bei der Technologie-Wahl. Svelte 5 war die richtige Wahl.

---

## 6. Local-First (Dexie + mana-sync)

### Bewertung: Stark

Der Local-first Stack (Dexie.js IndexedDB + Go Sync-Server + WebSocket Push) ist architektonisch solid:

```
Guest:      App -> IndexedDB (Dexie.js) -> UI            (kein Sync)
Logged in:  App -> IndexedDB -> UI -> SyncEngine -> mana-sync (Go) -> PostgreSQL
                                    <- WebSocket push <-
```

- 19/22 Apps bereits migriert
- Guest-Mode funktioniert
- Offline-CRUD moeglich
- Field-level LWW Conflict Resolution

### ABER: mana-sync braucht dringend Haertung

| Metrik | Wert | Bewertung |
|--------|------|-----------|
| Go-Quellcode | **426 Zeilen** | Zu wenig fuer die kritischste Komponente |
| Tests | **0** | **Kritisch** |
| Dokumentation | Minimal | Kein CLAUDE.md |
| Error Handling | Unklar | Nicht dokumentiert |

**mana-sync ist der Single Point of Failure des gesamten Stacks.** Wenn der Sync-Server Daten verliert oder falsch merged, betrifft das alle 19 Apps.

### Empfehlung

Investiert hier sofort:
1. Go Tests (table-driven tests fuer Sync-Logik, Conflict Resolution)
2. Dokumentation (CLAUDE.md, Sync-Protokoll, Conflict-Resolution-Strategie)
3. Error Handling und Recovery
4. Monitoring/Alerting (Sync-Failures, Latenz, Connection-Counts)
5. Horizontal Scaling Strategie (aktuell: Single Instance)

---

## 7. Infrastruktur & Deployment

### 67 Docker-Container auf einem Mac Mini

| Tier | Container | Anzahl |
|------|-----------|--------|
| Infra | Postgres, Redis, MinIO, Nginx, Backup | 5 |
| Core | Auth, API Gateway, Search, SearXNG, Media, Landing Builder | 6 |
| App Backends | 19x NestJS | 19 |
| App Frontends | 19x SvelteKit | 19 |
| Matrix | Synapse, Element, Bot | 3 |
| AI/ML | mana-llm, Ollama, STT, TTS, Image-Gen | 5+ |
| Monitoring | Grafana, VictoriaMetrics, Alertmanager, cAdvisor, Exporters, Loki, GlitchTip | 11 |
| Misc | Watchtower, Games | 2+ |
| **Gesamt** | | **~67** |

### Empfehlung

Mit Backend-Konsolidierung (Abschnitt 1) und Frontend-Konsolidierung:

1. **Backend-Konsolidierung:** 19 NestJS -> 4-6 Services = **-13 Container**
2. **SvelteKit-Apps konsolidieren:** Statt 19 separate Node-Container, ein Nginx-Reverse-Proxy der alle statischen Builds served = **-18 Container**
3. **Monitoring vereinfachen:** Node-Exporter, cAdvisor, Redis-Exporter, Postgres-Exporter sind fuer einen Mac Mini Overkill = **-4 Container**

**Ziel: ~30 Container statt 67.**

### Production-Compose ist gut aufgesetzt

Positiv:
- PostgreSQL mit tuning (shared_buffers=512MB, WAL config)
- Automatisches Backup (hourly pg_dumpall + daily pg_basebackup)
- Health-Checks auf allen Services
- Deploy-Metrics werden in PostgreSQL getrackt
- Matrix-Notifications bei Deploy-Failures
- Cloudflare Tunnel fuer Zugang

Negativ:
- Kein Staging-Environment
- Kein Blue-Green Deployment
- Kein automatischer Rollback bei Health-Check Failure
- Mac Mini ist Single Point of Failure

---

## 8. Datenbank

### Bewertung: Grundsolide

- PostgreSQL 16 mit guter Konfiguration
- Drizzle ORM ueberall konsistent (Code-first Schemas, Type-safe)
- Backup-Strategie vorhanden
- Schema-Isolation pro Service

### Aktuelle Situation

- 23 separate Datenbanken in einer PostgreSQL-Instanz
- Jeder Service hat eigenes Drizzle-Schema
- `db:push` fuer Schema-Aenderungen (kein manuelles SQL)
- `db:studio` fuer Daten-Inspektion

### Empfehlung

- Drizzle ist perfekt hier. Bleibt dabei.
- Ueberlegt ob Konsolidierung auf weniger DBs mit Schema-Isolation (PostgreSQL Schemas statt separate DBs) sinnvoll ist
- Drizzle-Kit Version vereinheitlichen (aktuell Mix aus ^0.30.2 und ^0.38.3)

---

## 9. Testing

### Bewertung: Kritisch

| Bereich | Test-Dateien | Abdeckung |
|---------|-------------|-----------|
| Apps (24 Stueck) | ~162 (inkl. node_modules-Artefakte) | Duenn |
| Services (16 Stueck) | ~23 | **11 von 16 Services haben 0 Tests** |
| mana-auth | Gut (5 E2E Specs) | Einziger Service mit guter Abdeckung |
| mana-sync | **0 Tests** | Kritischster Service ohne Tests |
| mana-llm | Vorhanden (Python) | Unit Tests |

### Services ohne Tests (kritisch)

- mana-sync (Sync-Engine - Datenverlust-Risiko!)
- mana-search
- mana-crawler
- mana-notify
- mana-media
- mana-api-gateway
- mana-image-gen
- mana-stt
- mana-tts
- mana-voice-bot
- mana-landing-builder

### Empfehlung (Prioritaet vor Go-Live)

1. **mana-sync:** Integration Tests fuer Sync-Logik und Conflict Resolution (Go)
2. **mana-auth:** Weiter ausbauen (bereits gut)
3. **@mana/local-store:** Unit Tests fuer SyncEngine und Conflict Resolution
4. **E2E Tests:** Fuer die wichtigsten User-Flows (Auth -> CRUD -> Sync -> Multi-Device)

---

## 10. Shared Packages

### Bewertung: Zu viele (55 Stueck)

Sinnvolle Packages:
- `@mana/local-store` - Kern der Local-first Architektur
- `@mana/shared-auth` - Auth-Abstraktion
- `@mana/shared-nestjs-auth` - NestJS JWT Guards
- `@mana/shared-ui` - UI-Komponenten (hat aber Type-Errors)
- `@mana/shared-tailwind` - Tailwind Config
- `@mana/shared-vite-config` - Vite Config

Zu granulare Packages (Konsolidierungskandidaten):

| Aktuell (einzeln) | Konsolidiert zu |
|-------------------|----------------|
| shared-credit-service, shared-credit-ui, credit-operations | `@mana/credits` |
| shared-feedback-service, shared-feedback-types, shared-feedback-ui | `@mana/feedback` |
| shared-help-content, shared-help-mobile, shared-help-types, shared-help-ui | `@mana/help` |
| shared-subscription-types, shared-subscription-ui | `@mana/subscriptions` |
| shared-nestjs-health, shared-nestjs-metrics, shared-nestjs-setup | `@mana/nestjs-bootstrap` |
| cards-database, food-database, spiral-db | Zurueck in die jeweiligen Apps |

### Ziel: ~25-30 Packages statt 55

---

## 11. CI/CD Pipeline

### Bewertung: Funktional

**CI (ci.yml):**
- Laeuft auf PRs und Push zu main/dev
- Change-Detection: Nur geaenderte Services werden gebaut
- Type-Check, Lint, Format, Tests
- Docker-Image-Builds selektiv

**CD (cd-macmini.yml):**
- Self-hosted Runner auf Mac Mini
- Erkennt geaenderte Services automatisch
- Baut Base-Images (nestjs-base, sveltekit-base) wenn noetig
- Health-Checks nach Deploy
- Deploy-Metrics in PostgreSQL
- Matrix-Notifications bei Failures

### Root package.json: 294 Scripts

Das ist nicht mehr wartbar. Jede neue App fuegt ~15 Scripts hinzu.

### Fehlend

- **Kein Staging-Environment** - dev und main Branches only
- **Kein automatischer Rollback** - Bei Deploy-Failure manuelles Recovery
- **Kein Blue-Green Deployment** - Alle User bekommen Update sofort
- **Keine automatische Deployment-Trigger** - workflow_dispatch ist manuell

---

## 12. Frontend Store-Duplikation

Ueber 15 SvelteKit-Apps haben **identische Kopien** der gleichen Store-Dateien:

```
apps/*/apps/web/src/lib/stores/auth.svelte.ts      # ~80 Zeilen, 15x kopiert
apps/*/apps/web/src/lib/stores/user-settings.svelte.ts  # ~60 Zeilen, 15x kopiert
apps/*/apps/web/src/lib/stores/theme.svelte.ts      # ~40 Zeilen, 15x kopiert
```

### Geschaetzte Duplikation: ~500+ Zeilen ueber 15 Apps

Das Package `@mana/shared-stores` existiert bereits, wird aber nicht voll genutzt. Diese Stores sollten dort zentralisiert werden.

---

## 13. Services-Analyse (Detail)

### Services Maturity Matrix

| Service | Tech | Tests | Error Handling | Config | Completeness |
|---------|------|-------|----------------|--------|-------------|
| mana-auth | NestJS/TS | Gut (E2E + Integration) | Gut | Env-driven | 95% |
| mana-llm | Python/FastAPI | Unit Tests | Implizit | Pydantic | 80% |
| mana-api-gateway | NestJS/TS | Keine | Gut | Env-driven | 75% |
| mana-search | NestJS/TS | Keine | Maessig | Env-driven | 70% |
| mana-crawler | NestJS/TS | Keine | Minimal | Env-driven | 75% |
| mana-media | NestJS/TS | Keine | Minimal | Env-driven | 70% |
| mana-notify | NestJS/TS | Keine | Minimal | Env-driven | 75% |
| mana-stt | Python/FastAPI | Keine | Keine | Env | 55% |
| mana-tts | Python/FastAPI | Keine | Keine | Env | 55% |
| mana-image-gen | Python/FastAPI | Keine | Keine | Env | 50% |
| mana-voice-bot | Python/FastAPI | Keine | Keine | Basic | 40% |
| mana-sync | Go | **Keine** | **Unklar** | Minimal | **40%** |
| mana-matrix-bot | Go | Keine | Unklar | Minimal | 50% |
| mana-api-gateway-go | Go | Keine | Unklar | Minimal | 35% |
| mana-landing-builder | NestJS/TS | Keine | Minimal | Env-driven | 60% |
| mana-search-go | Go | Keine | Keine | Keine | 10% |

### Port-Konflikte

| Port | Beansprucht von | Problem |
|------|----------------|---------|
| 3025 | mana-llm **UND** mana-image-gen | Koennen nicht parallel laufen |
| 3030 | mana-api-gateway **UND** mana-landing-builder **UND** mana-api-gateway-go | Dreifach-Konflikt |

---

## 14. Sicherheit & fehlende Stuecke

### Sicherheit

| Thema | Status |
|-------|--------|
| JWT (EdDSA) | Gut - Better Auth + jose Library |
| CORS | Konfiguriert, aber 20+ Domains hardcoded in docker-compose |
| Passkeys/WebAuthn | Implementiert |
| SMTP (Brevo) | Konfiguriert |
| Secrets | Env-basiert, aber Default-Passwoerter in dev compose |
| Rate Limiting | Vorhanden (Redis-based) |

### Fehlende Stuecke

| Luecke | Risiko | Aufwand |
|--------|--------|---------|
| Kein Distributed Tracing (OpenTelemetry) | Debugging in Prod unmoeglich | 2-3 Tage |
| Kein Staging-Environment | Bugs erst in Prod sichtbar | 1 Tag |
| shared-ui Type-Errors | 2 Apps skippen type-check | 2-3 Tage |
| Kein API-Dokumentation (OpenAPI/Swagger) | Nur mana-auth hat Swagger | 1 Woche |
| Logging nicht standardisiert | Winston vs NestJS Logger vs FastAPI vs Go | 3-5 Tage |
| Keine Correlation IDs | Requests nicht ueber Services verfolgbar | 2 Tage |

---

## 15. Was NICHT geaendert werden sollte

Diese Technologie-Entscheidungen sind gut und sollten beibehalten werden:

| Technologie | Grund |
|-------------|-------|
| **Svelte 5 + SvelteKit** | Modern, performant, gut umgesetzt |
| **Local-first Architektur** | Zukunftssicher, Guest-Mode, Offline-CRUD |
| **Dexie.js** | Solide IndexedDB-Abstraktion |
| **PostgreSQL + Drizzle ORM** | Type-safe, bewaehrtes Duo |
| **Better Auth** | Self-hosted, EdDSA JWT, Passkeys |
| **MinIO** | S3-kompatibel, self-hosted |
| **Python fuer ML/AI** | Einzige sinnvolle Wahl (STT, TTS, LLM, Image-Gen) |
| **Go fuer mana-sync** | Performance-kritisch, kleine Binary |
| **Turborepo** | Funktioniert gut fuer Monorepo-Orchestrierung |
| **Cloudflare Tunnel** | Einfaches Routing ohne oeffentliche IP |
| **Astro fuer Landing Pages** | Perfekt fuer statische Marketing-Seiten |

---

## 16. Priorisierte Empfehlungen

### Phase 1: Vor Go-Live (Kritisch)

| # | Massnahme | Aufwand | Impact |
|---|-----------|---------|--------|
| 1 | **mana-sync hardenen** - Tests, Docs, Error Handling | 1 Woche | Datensicherheit |
| 2 | **7 triviale Backends eliminieren/konsolidieren** (Quotes, Clock, Presi, CityCorners, Questions, Context, Photos) | 1 Woche | -7 Container, -3.500 LOC |
| 3 | **Port-Konflikte loesen** (3025, 3030) | 1 Stunde | Services laufen parallel |
| 4 | **shared-ui Type-Errors fixen** | 2-3 Tage | Alle Apps type-checken wieder |
| 5 | **Expo-Versionen alignen** (alle auf SDK 55) | 3-5 Tage | Konsistenz, Security |

### Phase 2: Kurzfristig

| # | Massnahme | Aufwand | Impact |
|---|-----------|---------|--------|
| 6 | **Go-Rewrites entscheiden** (api-gateway-go, search-go: fertig oder loeschen) | Entscheidung | Klarheit |
| 7 | **Store-Duplikation fixen** (shared-stores richtig nutzen) | 2-3 Tage | -500 LOC Duplikation |
| 8 | **Shared Packages konsolidieren** (55 -> ~30) | 1 Woche | Einfacheres Dependency-Management |
| 9 | **SvelteKit-Container konsolidieren** (Nginx statt 19 Node-Container) | 3-5 Tage | -18 Container |
| 10 | **Staging-Environment einrichten** | 1 Tag | Bugs vor Prod fangen |

### Phase 3: Mittelfristig

| # | Massnahme | Aufwand | Impact |
|---|-----------|---------|--------|
| 11 | **OpenTelemetry Tracing** einfuehren | 3-5 Tage | Debugging in Prod |
| 12 | **Structured Logging** (JSON, Correlation IDs) | 3-5 Tage | Log-Aggregation funktioniert |
| 13 | **Test-Coverage aufbauen** (Fokus: Sync, Auth, CRUD-Pfade) | Fortlaufend | Qualitaet |
| 14 | **NestJS-Version alignen** (alle auf 10.4 oder 11.0) | 2-3 Tage | Konsistenz |
| 15 | **Monitoring vereinfachen** (weniger Exporters, mehr App-Level Metrics) | 2-3 Tage | -4 Container |

### Phase 4: Langfristig

| # | Massnahme | Aufwand | Impact |
|---|-----------|---------|--------|
| 16 | **Root package.json Scripts aufraemen** (294 -> CLI Tool) | 1 Woche | Developer Experience |
| 17 | **Mac-Mini Scripts konsolidieren** (31 Shell Scripts -> 1 CLI) | 1 Woche | Wartbarkeit |
| 18 | **API-Dokumentation** (OpenAPI/Swagger fuer alle Services) | 2 Wochen | Developer Experience |
| 19 | **Blue-Green Deployment** | 1 Woche | Zero-Downtime Deploys |
| 20 | **Mobile Platform-Paritaet** - fehlende Apps implementieren oder entfernen | Fortlaufend | Klarheit |

---

## Anhang: Bestandsaufnahme

### Apps (24)

calendar, chat, citycorners, clock, contacts, context, docs, inventar, mana, cards, matrix, mukke, food, photos, picture, plants, playground, presi, questions, skilltree, storage, todo, traces, quotes

### Services (17)

it-landing, mana-api-gateway, mana-api-gateway-go, mana-auth, mana-crawler, mana-image-gen, mana-landing-builder, mana-llm, mana-matrix-bot, mana-media, mana-notify, mana-search, mana-stt, mana-sync, mana-tts, mana-voice-bot, ollama-metrics-proxy

### Shared Packages (55)

credit-operations, eslint-config, local-store, mana-core-nestjs-integration, cards-database, notify-client, food-database, qr-export, shared-api-client, shared-app-onboarding, shared-auth, shared-auth-stores, shared-auth-ui, shared-branding, shared-config, shared-credit-service, shared-credit-ui, shared-drizzle-config, shared-error-tracking, shared-errors, shared-feedback-service, shared-feedback-types, shared-feedback-ui, shared-gpu, shared-help-content, shared-help-mobile, shared-help-types, shared-help-ui, shared-i18n, shared-icons, shared-landing-ui, shared-llm, shared-logger, shared-nestjs-auth, shared-nestjs-health, shared-nestjs-metrics, shared-nestjs-setup, shared-profile-ui, shared-pwa, shared-splitscreen, shared-storage, shared-stores, shared-subscription-types, shared-subscription-ui, shared-tags, shared-tailwind, shared-theme, shared-theme-ui, shared-tsconfig, shared-types, shared-ui, shared-utils, shared-vite-config, spiral-db, test-config, wallpaper-generator

### Games (3)

voxelava, whopixels, worldream

### Archivierte Apps (apps-archived/)

bauntown, memoro, news, food, reader, uload, wisekeep
