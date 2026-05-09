---
title: 'Local-First + NestJS-Elimination + Konsolidierung: ~89.000 LOC weniger'
description: 'Komplette Architektur-Transformation: 19 Apps auf Local-First (IndexedDB + Sync), NestJS-Monolith aufgelöst in 5 Hono-Services, 12 App-Backends durch ~120-LOC Compute-Server ersetzt, 5 NestJS-Packages gelöscht. Netto: ~80.000 LOC weniger, 80% weniger RAM, 98% schnellere Cold Starts.'
date: 2026-03-28
author: 'Till Schneider'
category: 'infrastructure'
tags:
  [
    'local-first',
    'hono',
    'bun',
    'indexeddb',
    'dexie',
    'nestjs',
    'migration',
    'performance',
    'microservices',
    'offline-first',
    'guest-mode',
    'better-auth',
  ]
featured: true
readTime: 24
stats:
  filesChanged: 1581
  linesAdded: 19172
  linesRemoved: 110087
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
workingHours:
  start: '2026-03-27T08:00'
  end: '2026-03-28T22:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Was passiert ist

In zwei intensiven Sessions wurde die gesamte ManaCore-Backend-Architektur grundlegend transformiert. Der Kern: **Daten gehören dem Client, nicht dem Server.** Und: **NestJS ist zu viel Overhead für das, was wir brauchen.**

Das Ergebnis:

- **19 von 22 Web-Apps** laufen jetzt Local-First (IndexedDB + Background Sync)
- **0 NestJS-Services** im Monorepo (vorher: 18)
- **~80.000 Zeilen weniger Code**
- **80% weniger RAM-Verbrauch** auf dem Server

---

## Teil 1: Local-First Migration

### Das Problem

Jede App brauchte eine Internetverbindung für alles. Ein Task erstellen? API-Call. Einen Kontakt anzeigen? API-Call. Die App öffnen? Login-Screen.

Das bedeutete:

- **Kein Offline-Support** — App zeigt "Offline"-Seite
- **Kein Guest-Mode** — Login obligatorisch
- **200-500ms Latenz** für jede Aktion (API-Roundtrip)
- **~400 CRUD-Endpoints** über 13 NestJS-Backends verteilt

### Die Lösung: IndexedDB als Source of Truth

Jede App bekommt eine lokale Datenbank (IndexedDB via Dexie.js). Reads und Writes gehen **immer** zuerst dorthin. Im Hintergrund synchronisiert ein Go-Server (mana-sync) die Daten per WebSocket.

```
Guest:      App → IndexedDB → UI                    (<1ms)
Eingeloggt: App → IndexedDB → UI → Sync → Server    (<1ms + Background)
```

### Was pro App gemacht wurde

Für jede der 19 Apps:

1. **`local-store.ts`** — Typisierte IndexedDB-Collections mit `createLocalStore()`
2. **`guest-seed.ts`** — Onboarding-Daten die sofort geladen werden
3. **`AuthGate allowGuest={true}`** — Layout erlaubt unauthentifizierte Nutzung
4. **`GuestWelcomeModal`** — Einladung zur Registrierung beim ersten Besuch
5. **Store-Rewrite** — Svelte-Stores lesen von IndexedDB statt API

### Die Zahlen

| Metrik              | Vorher       | Nachher      | Verbesserung |
| ------------------- | ------------ | ------------ | ------------ |
| Time to Interactive | Login → 3-5s | Sofort       | **−95%**     |
| Task erstellen      | 200-300ms    | <5ms         | **−98%**     |
| Offline CRUD        | ❌           | ✅           | —            |
| Guest-Mode          | ❌           | ✅ (19 Apps) | —            |
| CRUD-Endpoints      | ~400         | 0 (via Sync) | **−100%**    |

### Beispiel: SkilltTree

SkilltTree hatte eine eigene IndexedDB-Implementierung mit dem `idb` Package (~280 LOC). Wir haben das durch `@manacore/local-store` ersetzt — die gleiche Bibliothek die alle anderen Apps nutzen. Ergebnis: einheitliches Sync-Protokoll, weniger Dependencies, gleiche Funktionalität.

---

## Teil 2: mana-core-auth Aufspaltung

### Das Problem

Der zentrale Auth-Service war über die Zeit zum Monolithen geworden:

- **~20.000 LOC** in einem NestJS-Service
- Auth + Credits + Gifts + Subscriptions + Settings + Tags + Feedback + Analytics
- Änderung am Credit-System → Auth-Service redeployen
- ~300MB RAM, 2-5s Cold Start

### Die Lösung: 5 Fokussierte Services auf Hono + Bun

| Service                | Port | LOC   | Funktion                            |
| ---------------------- | ---- | ----- | ----------------------------------- |
| **mana-auth**          | 3001 | 1.931 | Auth, JWT, SSO, OIDC, 2FA, Orgs     |
| **mana-credits**       | 3061 | 2.199 | Credits, Gifts, Guild Pools, Stripe |
| **mana-user**          | 3062 | 796   | Settings, Tags, Storage             |
| **mana-subscriptions** | 3063 | 832   | Plans, Billing, Invoices            |
| **mana-analytics**     | 3064 | 475   | Feedback, Voting                    |

**Gesamt: 6.233 LOC** statt 20.000 LOC. Der Unterschied kommt von:

- **Kein NestJS-Boilerplate** (Module, Guards, Decorators, Interceptors, DTOs)
- **Better Auth nativ** auf Hono (fetch-basiert, kein Express↔Fetch-Konvertierung)
- **Zod statt class-validator** (deklarativer, weniger Code)
- **Manuelle Instantiierung** statt Dependency Injection Container

### Better Auth + Hono = Perfekte Kombination

Better Auth ist fetch-basiert. NestJS ist Express-basiert. Das bedeutete: jeder Request musste von Express nach Fetch konvertiert und zurück übersetzt werden — inklusive Cookies, Headers, Redirects.

Hono ist ebenfalls fetch-basiert. Der gesamte Passthrough-Controller (150+ LOC in NestJS) wird zu:

```typescript
app.all('/api/auth/*', async (c) => auth.handler(c.req.raw));
```

**Eine Zeile.**

---

## Teil 3: App-Backend Elimination

### Das Problem

13 NestJS-Backends mit jeweils ~3.000-6.000 LOC. Davon waren ~80% CRUD-Endpoints die jetzt durch mana-sync überflüssig sind. Die restlichen ~20% sind server-seitige Compute-Logik (AI, File Upload, External APIs).

### Die Lösung: Hono Compute-Server

Für jede App ein minimaler Hono-Server der **nur** die server-seitigen Endpoints enthält:

| App      | LOC | Was der Server macht              |
| -------- | --- | --------------------------------- |
| Chat     | 137 | LLM Completions + SSE Streaming   |
| Picture  | 144 | Replicate Image Gen + S3 Upload   |
| Calendar | 119 | RRULE Expansion + ICS Import      |
| Food     | 154 | Gemini Meal Analysis              |
| Planta   | 104 | Gemini Plant Analysis + S3 Upload |
| Traces   | 108 | AI Guide Generation               |
| ...      | ... | ...                               |

**Durchschnitt: ~118 LOC pro Server.** Statt ~3.500 LOC NestJS-Backend.

### Die alte Welt: Ein typisches NestJS-Backend

```
apps/contacts/apps/backend/                    # ~5.500 LOC
├── src/
│   ├── app.module.ts                          # Module imports
│   ├── main.ts                                # Bootstrap mit Middleware
│   ├── contact/
│   │   ├── contact.module.ts                  # NestJS Module
│   │   ├── contact.controller.ts              # 20+ Endpoints
│   │   ├── contact.service.ts                 # Business Logic
│   │   └── dto/
│   │       ├── create-contact.dto.ts          # Validation
│   │       ├── update-contact.dto.ts
│   │       └── query-contacts.dto.ts
│   ├── note/
│   │   ├── note.module.ts
│   │   ├── note.controller.ts
│   │   └── note.service.ts
│   ├── import/
│   │   ├── import.controller.ts
│   │   └── import.service.ts
│   ├── google/
│   │   ├── google.controller.ts
│   │   └── google.service.ts
│   ├── db/
│   │   ├── schema/                            # 5 Schema-Dateien
│   │   ├── connection.ts
│   │   └── database.module.ts
│   └── admin/                                 # GDPR Admin
├── Dockerfile                                 # Multi-stage Build (~500MB)
├── docker-entrypoint.sh
├── drizzle.config.ts
├── package.json                               # 20+ Dependencies
└── tsconfig.json
```

### Die neue Welt: Ein Hono Compute-Server

```
apps/contacts/apps/server/                     # 89 LOC
├── src/
│   └── index.ts                               # Alles in einer Datei
├── package.json                               # 3 Dependencies
└── tsconfig.json
```

Die 89 LOC enthalten: Avatar-Upload (S3) und vCard-Import. **Alles andere (CRUD) läuft über mana-sync.**

---

## Teil 4: Die Zahlen

### Code-Bilanz

| Kategorie                                     | Gelöscht    | Hinzugefügt | Netto       |
| --------------------------------------------- | ----------- | ----------- | ----------- |
| mana-core-auth → 5 Hono Services              | 20.000      | 6.233       | **−13.767** |
| 13 NestJS Backends → 14 Hono Servers          | 40.000      | 1.537       | **−38.463** |
| 5 NestJS Shared Packages → 1 shared-hono      | 2.500       | 516         | **−1.984**  |
| Legacy NestJS Services (Search, Notify, etc.) | 21.000      | 0           | **−21.000** |
| Local-First Data Layer                        | 0           | 3.100       | **+3.100**  |
| Store-Rewrites                                | 0           | 800         | **+800**    |
| **Gesamt**                                    | **~83.500** | **~12.186** | **−71.314** |

### Server-Ressourcen

| Metrik                   | Vorher | Nachher | Einsparung |
| ------------------------ | ------ | ------- | ---------- |
| Docker Image Size (Auth) | ~600MB | ~170MB  | **−72%**   |
| Docker Image Size (App)  | ~400MB | ~160MB  | **−60%**   |
| RAM Auth-Service         | ~300MB | ~50MB   | **−83%**   |
| RAM 13 App-Backends      | ~2.5GB | ~500MB  | **−80%**   |
| RAM Gesamt Backend       | ~3.5GB | ~700MB  | **−80%**   |
| Cold Start               | 2-5s   | ~50ms   | **−98%**   |
| Build Time               | 60-90s | ~5s     | **−94%**   |

### Client-Performance

| Metrik              | Vorher       | Nachher        | Verbesserung |
| ------------------- | ------------ | -------------- | ------------ |
| Time to Interactive | 3-5s (Login) | <500ms (Guest) | **−90%**     |
| Daten anzeigen      | 200-500ms    | <1ms           | **−99%**     |
| Daten schreiben     | 200-300ms    | <5ms           | **−98%**     |
| Offline-Fähigkeit   | ❌           | ✅ Voller CRUD | ∞            |

---

## Teil 5: Tech-Stack Vergleich

### Vorher

```
Node.js 20 + NestJS 10
├── 18 NestJS-Services
│   ├── @nestjs/common, core, config, platform-express
│   ├── @nestjs/throttler, swagger
│   ├── class-validator, class-transformer
│   ├── reflect-metadata, rxjs
│   └── Guards, Interceptors, Decorators, Modules, DTOs
├── 5 NestJS Shared Packages
└── Express Request → Fetch → Response Konvertierung
```

### Nachher

```
Bun + Hono
├── 19 Hono-Services (5 Core + 14 Compute)
│   ├── hono (1 Package)
│   ├── zod (Validation)
│   └── jose (JWT)
├── 1 Shared Package (@manacore/shared-hono)
└── Fetch-nativ (kein Konvertierung)
```

**Dependencies pro Service:** NestJS: ~20 Packages → Hono: ~3 Packages.

---

## Architektur-Diagramm

```
┌─ Client (19 Apps) ──────────────────────────────────────────┐
│                                                              │
│  SvelteKit + Svelte 5 + Tailwind                            │
│  Dexie.js (IndexedDB) — Source of Truth                     │
│  @manacore/local-store (Collections, Guest-Seed, Sync)      │
│                                                              │
└──────────┬──────────────────────┬───────────────────────────┘
           │ Sync (WebSocket)     │ API (nur Compute)
           ▼                      ▼
┌─ Go ─────────────┐   ┌─ Hono + Bun ───────────────────────┐
│                   │   │                                     │
│  mana-sync        │   │  14 App Compute Servers            │
│  - Changesets     │   │  (AI, Upload, External APIs)       │
│  - Field-Level    │   │  ~120 LOC pro Server               │
│    LWW            │   │                                     │
│  - WebSocket Push │   │  5 Core Services                   │
│                   │   │  (Auth, Credits, User, Subs, Anal.) │
│  Port: 3050       │   │  ~1.200 LOC pro Service            │
└────────┬──────────┘   └───────────┬─────────────────────────┘
         ▼                          ▼
┌─ PostgreSQL ────────────────────────────────────────────────┐
│  mana_auth │ mana_credits │ mana_user │ mana_subscriptions │
│  + 12 App-Datenbanken                                       │
└─────────────────────────────────────────────────────────────┘

┌─ Python ────────────────────────────────────────────────────┐
│  mana-llm │ mana-stt │ mana-tts │ mana-image-gen │ voice   │
└─────────────────────────────────────────────────────────────┘
```

---

## Fazit

Diese Migration hat gezeigt, dass **Local-First + leichtgewichtige Server** ein radikal einfacheres System ergeben als der klassische API-First-Ansatz mit schwerem Framework.

Die wichtigsten Erkenntnisse:

1. **80% des Backend-Codes war CRUD-Boilerplate.** Ein generischer Sync-Server ersetzt hunderte von Endpoints.

2. **NestJS ist großartig für Enterprise-Java-Entwickler.** Für ein kleines Team ist es zu viel Zeremonie — Module, Guards, Interceptors, DTOs, Decorators für jeden Endpoint.

3. **Better Auth + Hono ist eine Killer-Kombination.** Beide sind fetch-basiert, kein Konvertierungs-Overhead, minimaler Glue-Code.

4. **Bun macht Build-Steps überflüssig.** TypeScript wird direkt ausgeführt. Docker-Images sind kleiner, Cold Starts sind schneller.

5. **Die beste UX ist keine Loading-Spinners.** Wenn Daten <1ms statt 200ms laden, fühlt sich die App nativ an.

Das ManaCore-Monorepo ist jetzt NestJS-frei. Alle TypeScript-Services laufen auf Hono + Bun. Die Architektur ist einfacher, schneller, und braucht weniger Ressourcen — auf dem Server und im Client.

---

## Phase 2: Konsolidierung & Haertung

Nach der grossen Migration wurden Altlasten bereinigt, der kritischste Service gehaertet, und die Developer Experience massiv verbessert.

### Package-Konsolidierung: 58 → 43

Viele Packages waren unnoetig fragmentiert — Types, Service und UI als separate Packages, obwohl sie immer zusammen benutzt werden:

- shared-feedback-{types,service,ui} → `@manacore/feedback`
- shared-help-{types,content,ui,mobile} → `@manacore/help`
- shared-subscription-{types,ui} → `@manacore/subscriptions`
- credit-operations + shared-credit-{service,ui} → `@manacore/credits`

**26% weniger Packages**, alle Imports in allen 21 Apps aktualisiert.

### Auth Store: 6.800 → 182 Zeilen

21 Web-Apps hatten jeweils ~350 Zeilen identischen Auth-Code — SSO, Passkeys, 2FA, Token-Management, alles 21x kopiert. Neue `createManaAuthStore` Factory:

```typescript
// Vorher: 350 Zeilen Boilerplate pro App
// Nachher:
import { createManaAuthStore } from '@manacore/shared-auth-stores';
export const authStore = createManaAuthStore({ devBackendPort: 3007 });
```

**97% weniger Auth-Code.** Aenderungen am Auth-Flow: 1 Datei statt 21.

### mana-sync gehaertet

Der Go Sync-Server — Rueckgrat aller 19 Local-First Apps — hatte kritische Luecken. WebSocket JWT war komplett kaputt, kein Body Size Limit, JSON-Fehler still ignoriert, null Tests. Jetzt: echte JWKS-Validierung, 10 MB Limit, 19 Unit Tests, vollstaendige Dokumentation.

### Weitere Verbesserungen

- **Port-Schema:** ~60 Services haben dokumentierte, konfliktfreie Ports
- **Type-Safety:** 5 Apps die type-check uebersprangen repariert
- **Expo SDK:** 7 Mobile-Apps von 3 SDKs (52/54/55) auf einheitliches SDK 55

### Gesamtbilanz

| Metrik               | Wert                |
| -------------------- | ------------------- |
| Netto Code-Reduktion | **~88.600 LOC**     |
| NestJS-Services      | 18 → **0**          |
| Packages             | 58 → **43**         |
| Auth Store LOC       | 6.800 → **182**     |
| RAM-Verbrauch        | ~3.5GB → **~700MB** |
| Expo SDK Versionen   | 3 → **1**           |

Das ManaCore-Monorepo ist bereit fuer Production.

---

## Phase 3: Letzte NestJS-Bastion + Infra-Finalisierung

Am Abend des 28. Maerz wurden die letzten offenen Punkte aus dem Migrationsplan abgearbeitet.

### mana-core-auth: Endgueltig geloescht

Der Legacy-Auth-Service war bereits durch `mana-auth` (Hono + Bun) ersetzt, existierte aber noch als Zombie-Directory auf Disk und wurde in **15+ Dateien** referenziert:

| Datei-Typ         | Anzahl | Aenderungen                                                  |
| ----------------- | ------ | ------------------------------------------------------------ |
| Docker Compose    | 2      | Service-Definition entfernt, URLs auf mana-auth              |
| CI/CD Workflows   | 4      | ci.yml, cd-macmini.yml, daily-tests.yml, docker-validate.yml |
| Root package.json | 3      | dev:auth, seed:dev-user, docker:logs:auth                    |
| Scripts           | 4      | generate-env, setup-databases, deploy, ensure-containers     |
| Config            | 3      | Prometheus, dependabot, CODEOWNERS                           |

**Ergebnis:** Null Referenzen auf `mana-core-auth` in aktiven Config-Dateien. Historische Referenzen in Docs/Devlogs bleiben als Dokumentation.

### mana-media: Letzter NestJS-Service → Hono/Bun

Der Media-Service war der **letzte verbleibende NestJS-Service** im gesamten Monorepo. Migration:

| Aspekt       | NestJS (vorher)      | Hono/Bun (nachher)  |
| ------------ | -------------------- | ------------------- |
| Source Files | 23                   | 12                  |
| LOC          | ~1.945               | ~980                |
| Dependencies | 15 (6 × @nestjs/\*)  | 9                   |
| Dockerfile   | Node 20, multi-stage | Bun 1, single-stage |
| Runtime      | ~150 MB RAM          | ~40 MB RAM          |

**Was erhalten blieb** (Business Logic identisch):

- Content-Addressable Storage (SHA-256 Dedup)
- BullMQ Image Processing (Sharp: Thumbnails 200×200, Medium 800×800, Large 1920×1920)
- Matrix MXC URL Import
- EXIF Extraction (Kamera, GPS, Datum)
- On-the-fly Image Transforms
- Prometheus Metrics

**Was verschwand** (NestJS-Boilerplate):

- 6 Module-Dateien (`*.module.ts`)
- `database.module.ts` + DI Container
- `@Injectable()`, `@Controller()`, `@UseInterceptors()` Decoratoren
- `FileInterceptor` → Hono `parseBody()`
- `ValidationPipe` → direkte Validierung
- `nest-cli.json`, Express Dependencies

### k6 Load Testing fuer mana-sync

Der Sync-Server ist das Rueckgrat aller 19 Local-First Apps. Erstmals gibt es eine Load-Test-Suite:

```bash
# Smoke Test
k6 run --vus 10 --duration 30s test/load/sync-load.js

# WebSocket Stress (bis 1000 Connections)
k6 run --env SCENARIO=websocket test/load/sync-load.js

# Sync Throughput (200 req/s konstant)
k6 run --env SCENARIO=sync test/load/sync-load.js
```

**3 Szenarien:**

| Szenario            | Was es testet                            | Ziel                           |
| ------------------- | ---------------------------------------- | ------------------------------ |
| **mixed** (default) | 60% Sync + 25% Pull + 15% Health         | Realistischer Workload         |
| **websocket**       | Bis 1000 parallele WebSocket-Connections | Auth, Ping/Pong, Broadcast     |
| **sync**            | 200 req/s konstant auf POST /sync        | Throughput + Latenz unter Last |

**Custom Metrics:** Push/Pull-Latenz, WS-Connect-Zeit, LWW-Konflikte, Error-Rate.

**Thresholds:** HTTP p95 < 500ms, Push p95 < 300ms, Pull p95 < 200ms, Errors < 1%.

### CI/CD Pipeline: Alle Services abgedeckt

Vorher fehlten **8 Services** in den CI/CD-Workflows. Jetzt:

| Workflow                         | Vorher        | Nachher                                                                |
| -------------------------------- | ------------- | ---------------------------------------------------------------------- |
| `ci.yml` (Build)                 | 2 Services    | 8 Services (+mana-sync, -notify, -gateway, -crawler, -media, -credits) |
| `cd-macmini.yml` (Deploy)        | 2 Services    | 10 Services                                                            |
| `docker-validate.yml` (PR-Check) | 1 Architektur | 3 Architekturen (Hono, Go, Hono+Sharp)                                 |

**Go Services** triggern auch bei Aenderungen an `packages/shared-go/`.

### Gesamtbilanz Phase 3

| Metrik                      | Wert         |
| --------------------------- | ------------ |
| Dateien geaendert           | 181          |
| Zeilen hinzugefuegt         | +6.372       |
| Zeilen entfernt             | −8.687       |
| NestJS-Services noch uebrig | **0**        |
| Services in CI/CD           | 8 → **alle** |
| Load Test Szenarien         | 0 → **3**    |

---

## Gesamtbilanz aller 3 Phasen (27.-28. Maerz)

| Metrik                   | Wert                             |
| ------------------------ | -------------------------------- |
| **Netto Code-Reduktion** | ~90.900 LOC                      |
| **NestJS-Services**      | 18 → 0                           |
| **Packages**             | 58 → 43                          |
| **Auth Store LOC**       | 6.800 → 182                      |
| **RAM-Verbrauch**        | ~3.5 GB → ~700 MB                |
| **Services in CI/CD**    | lueckenhaft → vollstaendig       |
| **Load Tests**           | keine → k6 Suite mit 3 Szenarien |
| **Offline-Faehigkeit**   | 0 Apps → 19 Apps                 |
| **Cold Start**           | 2-5s → ~50ms                     |

Die Local-First + NestJS-Elimination Migration ist **vollstaendig abgeschlossen**. Alle 5 Phasen des Migrationsplans sind done. Das ManaCore-Monorepo laeuft komplett auf Hono/Bun + Go — kein einziges NestJS-Package oder -Service mehr vorhanden.
