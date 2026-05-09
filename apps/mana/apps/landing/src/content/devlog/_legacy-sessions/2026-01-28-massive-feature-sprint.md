---
title: 'Massive Feature Sprint: 3 neue Apps, Matrix Gateway, Search Service & mehr'
description: 'SkillTree App, Questions App, Matrix Client Phase 2, mana-search Microservice, Bot Gateway Architecture, 4 neue Matrix Bots, VictoriaMetrics Monitoring und OIDC Provider'
date: 2026-01-28
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'skilltree',
    'questions',
    'matrix',
    'search',
    'bot',
    'gateway',
    'monitoring',
    'oidc',
    'nestjs',
    'sveltekit',
    'architecture',
  ]
featured: true
commits: 74
readTime: 20
stats:
  filesChanged: 747
  linesAdded: 56325
  linesRemoved: 11567
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 74
workingHours:
  start: '2026-01-28T11:00'
  end: '2026-01-29T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Außergewöhnlich produktiver Tag (und Nacht!) mit **74 Commits** und mehreren großen neuen Features. Die wichtigsten Errungenschaften:

- **SkillTree App** - Gamified Skill Tracking mit XP-System (MVP complete)
- **Questions App** - AI-powered Research Assistant mit mana-search Integration
- **Matrix Client Phase 2** - File Upload, Message Actions, Room Management
- **mana-search Microservice** - SearXNG Meta-Search + Content Extraction
- **@manacore/bot-services** - Shared Business Logic Package
- **matrix-mana-bot** - Unified Gateway Bot für alle Features
- **4 neue Matrix Bots** - Todo, Food, Quotes, Clock
- **OIDC Provider** - Matrix SSO via mana-core-auth
- **VictoriaMetrics** - Monitoring Upgrade mit DuckDB Analytics
- **App Cleanup** - Demo Mode für Calendar, Todo, Contacts

---

## SkillTree App

Komplett neue gamifizierte Skill-Tracking App - wie ein RPG Skill Tree für das echte Leben.

### Web App (SvelteKit)

```
apps/skilltree/apps/web/
├── src/lib/
│   ├── components/
│   │   ├── SkillCard.svelte        # Skill mit XP-Balken
│   │   ├── AddSkillModal.svelte    # Neuen Skill erstellen
│   │   ├── AddActivityModal.svelte # XP verdienen
│   │   ├── EditSkillModal.svelte   # Skill bearbeiten
│   │   ├── LevelUpCelebration.svelte # Animation bei Level-Up
│   │   ├── SkillTreeView.svelte    # Graph-Visualisierung
│   │   └── TemplateSelector.svelte  # Skill-Vorlagen
│   ├── services/skillDb.ts          # IndexedDB Storage
│   └── stores/skills.svelte.ts      # Svelte 5 Runes Store
```

**Features:**

| Feature                  | Beschreibung                                            |
| ------------------------ | ------------------------------------------------------- |
| **6 Skill-Branches**     | Intellect, Body, Creativity, Social, Practical, Mindset |
| **XP-System**            | 6 Level mit steigenden XP-Anforderungen (100 → 10.000)  |
| **Level-Up Celebration** | Animation + Sound bei Levelaufstieg                     |
| **Tree View**            | Graph-Visualisierung mit Skill-Abhängigkeiten           |
| **Templates**            | Vorgefertigte Skill-Sets zum Schnellstart               |
| **Offline-First**        | IndexedDB, kein Backend nötig                           |

### Backend (NestJS)

```
apps/skilltree/apps/backend/
├── src/
│   ├── db/schema/
│   │   ├── skills.schema.ts        # Skills mit XP/Level
│   │   ├── activities.schema.ts    # XP-Aktivitäten
│   │   └── user-stats.schema.ts    # Aggregierte Stats
│   ├── skill/skill.service.ts      # CRUD + XP-Berechnung
│   └── activity/activity.service.ts # Activity-Logging
```

**API Endpoints:**

| Endpoint              | Beschreibung            |
| --------------------- | ----------------------- |
| `GET /skills`         | Alle Skills eines Users |
| `POST /skills`        | Neuen Skill erstellen   |
| `POST /skills/:id/xp` | XP hinzufügen           |
| `GET /activities`     | Activity-Feed           |

### Docker Deployment

- **Backend**: Port 3024
- **Web**: Port 5195
- CI/CD Jobs in GitHub Actions hinzugefügt

---

## Questions App

AI-gestützter Research Assistant für tiefgehende Fragen-Recherche.

### Architektur

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Questions  │────>│   Backend   │────>│ mana-search │
│  Web App    │     │   (NestJS)  │     │  (SearXNG)  │
│  Port 5111  │     │  Port 3111  │     │  Port 3021  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Backend (NestJS)

```
apps/questions/apps/backend/
├── src/
│   ├── db/schema/
│   │   ├── questions.schema.ts    # Fragen mit Status, Tags
│   │   ├── collections.schema.ts  # Fragen-Ordner
│   │   ├── research.schema.ts     # Recherche-Ergebnisse
│   │   ├── sources.schema.ts      # Extrahierte Quellen
│   │   └── answers.schema.ts      # AI-Antworten
│   ├── research/
│   │   ├── mana-search.client.ts  # mana-search Integration
│   │   └── research.service.ts    # Recherche-Orchestrierung
│   └── question/question.service.ts
```

**Research Depths:**

| Tiefe      | Quellen | Beschreibung          |
| ---------- | ------- | --------------------- |
| `quick`    | 5       | Schnelle Übersicht    |
| `standard` | 15      | Ausgewogene Recherche |
| `deep`     | 30      | Tiefgehende Analyse   |

### Web App (SvelteKit)

```
apps/questions/apps/web/
├── src/
│   ├── lib/
│   │   ├── api/                   # API Clients
│   │   ├── stores/
│   │   │   ├── auth.svelte.ts     # Auth Store
│   │   │   ├── questions.svelte.ts
│   │   │   └── collections.svelte.ts
│   │   └── components/
│   │       ├── CollectionModal.svelte
│   │       ├── ErrorAlert.svelte
│   │       └── skeletons/         # Loading States
│   └── routes/
│       ├── (app)/
│       │   ├── new/               # Neue Frage erstellen
│       │   ├── question/[id]/     # Fragen-Detail
│       │   ├── collections/       # Collections-Verwaltung
│       │   └── settings/          # Einstellungen
│       └── (auth)/
│           └── forgot-password/   # Password Recovery
```

**UI Features:**

- Filter nach Status, Collection, Suchtext
- Skeleton Loading States
- Error Handling mit Retry
- Dark Mode Support
- Responsive Design

---

## mana-search Microservice

Zentraler Such-Service für alle ManaCore Apps.

### Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                       mana-search (Port 3021)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │  Search Module  │    │ Extract Module  │    │   Cache     │ │
│  │   (SearXNG)     │    │ (Readability)   │    │   (Redis)   │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬──────┘ │
│           │                      │                     │        │
│           └──────────────────────┴─────────────────────┘        │
│                              │                                   │
│                              ▼                                   │
│           ┌─────────────────────────────────────┐               │
│           │          SearXNG Container          │               │
│           │  (40+ Search Engines: Google,       │               │
│           │   Bing, DuckDuckGo, Wikipedia,      │               │
│           │   arXiv, GitHub, StackOverflow...)  │               │
│           └─────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints

| Endpoint                    | Beschreibung                     |
| --------------------------- | -------------------------------- |
| `POST /api/v1/search`       | Web-Suche mit Kategorien/Engines |
| `POST /api/v1/extract`      | Content-Extraktion von URLs      |
| `POST /api/v1/extract/bulk` | Bulk-Extraktion                  |
| `GET /health`               | Health Check                     |
| `GET /metrics`              | Prometheus Metrics               |

### Search Categories

| Kategorie | Engines                         |
| --------- | ------------------------------- |
| `general` | Google, Bing, DuckDuckGo        |
| `news`    | Google News, Bing News          |
| `science` | arXiv, PubMed, Semantic Scholar |
| `it`      | GitHub, StackOverflow, MDN      |
| `images`  | Google Images, Bing Images      |
| `videos`  | YouTube, Vimeo                  |

### Content Extraction

- Readability-basierte Extraktion
- Markdown-Konvertierung
- Metadata-Extraktion (Titel, Autor, Datum)
- Redis-Caching für Performance

---

## Matrix Client Phase 2

Signifikante Erweiterung des SvelteKit Matrix Clients.

### Neue Features

```
apps/matrix/apps/web/src/lib/
├── components/chat/
│   ├── CreateRoomDialog.svelte    # Raum erstellen
│   ├── RoomSettingsPanel.svelte   # Raum-Einstellungen
│   ├── Message.svelte             # + Reply, Edit, Delete
│   └── MessageInput.svelte        # + File Upload
├── matrix/
│   └── store.svelte.ts            # + Media, Reactions
```

**File Upload & Media:**

| Feature       | Beschreibung          |
| ------------- | --------------------- |
| Bild-Upload   | Mit Thumbnail-Preview |
| Video-Upload  | Streaming-Support     |
| Audio-Upload  | Voice Messages        |
| File-Download | Für alle Dateitypen   |

**Message Actions:**

| Action | Beschreibung                  |
| ------ | ----------------------------- |
| Reply  | Mit Quote-Preview             |
| Edit   | Eigene Nachrichten bearbeiten |
| Delete | Nachrichten redaktieren       |
| React  | Emoji-Reaktionen              |

**Room Management:**

| Feature        | Beschreibung     |
| -------------- | ---------------- |
| Create Room    | DM oder Gruppe   |
| User Search    | Zum Einladen     |
| Settings Panel | Mit Member-Liste |
| Leave Room     | Raum verlassen   |

---

## Bot Gateway Architecture

### @manacore/bot-services

Neues Shared Package mit transport-agnostischer Business Logic:

```
packages/bot-services/
├── src/
│   ├── todo/
│   │   ├── todo.service.ts        # Task CRUD, Parsing
│   │   ├── todo.module.ts         # NestJS Module
│   │   └── types.ts
│   ├── calendar/
│   │   ├── calendar.service.ts    # Events, Reminders
│   │   └── ...
│   ├── ai/
│   │   ├── ai.service.ts          # Ollama Integration
│   │   └── ...
│   ├── clock/
│   │   └── clock.service.ts       # Timer, Alarm, World Clock
│   └── shared/
│       ├── storage.ts             # File/Memory Provider
│       └── utils.ts               # Date Parsing (German)
```

**Vorteile:**

- Kein Matrix-Code in Services
- Testbar ohne Matrix-Verbindung
- Pluggable Storage (File, Memory, Database)
- Wiederverwendbar in Gateway und Einzelbots

### matrix-mana-bot (Gateway)

Unified Bot, der alle Features vereint:

```
services/matrix-mana-bot/
├── src/
│   ├── bot/
│   │   ├── matrix.service.ts          # Matrix-Verbindung
│   │   └── command-router.service.ts  # Command Routing
│   ├── handlers/
│   │   ├── ai.handler.ts              # !model, !all, chat
│   │   ├── todo.handler.ts            # !todo, !list, !done
│   │   ├── calendar.handler.ts        # !cal, !event
│   │   └── clock.handler.ts           # !timer, !alarm
│   └── orchestration/
│       └── orchestration.service.ts   # Cross-Feature AI
```

**Cross-Feature Commands:**

| Command    | Beschreibung                        |
| ---------- | ----------------------------------- |
| `!summary` | AI-generierte Tages-Zusammenfassung |
| `!ai-todo` | Todos aus Text extrahieren          |

---

## Neue Matrix Bots

### matrix-todo-bot

Task-Management via Matrix:

| Command     | Beschreibung                          |
| ----------- | ------------------------------------- |
| `!todo`     | Neuer Task (mit Prio, Datum, Projekt) |
| `!list`     | Alle Tasks anzeigen                   |
| `!today`    | Heutige Tasks                         |
| `!done [n]` | Task als erledigt markieren           |

**Syntax:** `!todo Einkaufen !p1 @morgen #haushalt`

### matrix-food-bot

Ernährungs-Tracking via Matrix:

| Command  | Beschreibung               |
| -------- | -------------------------- |
| `!meal`  | Mahlzeit loggen            |
| `!today` | Heutige Nährwerte          |
| `!goals` | Tagesziele anzeigen/setzen |

**Voice Transcription** via mana-stt für Sprachnachrichten.

### matrix-quotes-bot

Tägliche Inspirations-Zitate:

| Command   | Beschreibung               |
| --------- | -------------------------- |
| `!quote`  | Zufälliges Zitat           |
| `!daily`  | Tägliches Zitat aktivieren |
| `!search` | Zitate suchen              |

### matrix-clock-bot

Timer und Alarme:

| Command       | Beschreibung   |
| ------------- | -------------- |
| `!timer 25m`  | Pomodoro-Timer |
| `!alarm 7:00` | Wecker stellen |
| `!time tokyo` | Weltzeit       |

---

## OIDC Provider

Matrix SSO Integration über mana-core-auth:

```
services/mana-core-auth/
├── src/
│   └── oidc/
│       ├── oidc.controller.ts      # /oidc/* Endpoints
│       └── oidc-routes.ts          # Route Mapping
```

**OIDC Endpoints:**

| Endpoint                            | Beschreibung   |
| ----------------------------------- | -------------- |
| `/.well-known/openid-configuration` | Discovery      |
| `/oidc/jwks`                        | Public Keys    |
| `/oidc/authorize`                   | Authorization  |
| `/oidc/token`                       | Token Exchange |
| `/oidc/userinfo`                    | User Info      |

**Synapse Config:**

```yaml
oidc_providers:
  - idp_id: manacore
    idp_name: 'ManaCore'
    issuer: 'https://auth.mana.how'
    client_id: 'synapse'
    client_secret: '...'
```

---

## Monitoring Upgrade

### VictoriaMetrics + DuckDB

Upgrade der Monitoring-Infrastruktur:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Monitoring Stack                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ VictoriaMetrics │    │     Grafana     │    │   DuckDB    │ │
│  │  (Time Series)  │    │ (Visualization) │    │ (Analytics) │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Vorteile:**

| Aspekt      | Prometheus | VictoriaMetrics |
| ----------- | ---------- | --------------- |
| Memory      | Hoch       | 10x weniger     |
| Disk        | Hoch       | 7x weniger      |
| Query Speed | Gut        | Besser          |

**DuckDB Analytics:**

- SQL-basierte Analyse
- Parquet Export
- Historical Trends

---

## App Cleanup: Demo Mode

Einheitliche Implementierung von Demo Mode für alle Apps:

### Entfernte Features

| App      | Entfernt                                          |
| -------- | ------------------------------------------------- |
| Calendar | Statistics, Heatmap, Network View, Session Events |
| Todo     | Statistics, Network View, Session Tasks           |
| Contacts | Statistics, Network View, Session Storage         |

### Demo Mode Pattern

```typescript
// stores/demo.svelte.ts
export const demoStore = createDemoStore();

// Automatische Demo-Daten beim Start
if (!isAuthenticated) {
	demoStore.loadDemoData();
}
```

**Vorteile:**

- Einfacherer Code
- Bessere Demo-Experience
- Konsistentes Verhalten
- Production-Ready ohne Session Storage

---

## Weitere Features

### Calendar: Google/Apple Sync

```
apps/calendar/apps/web/src/lib/services/
├── calendar-sync/
│   ├── google-calendar.ts      # Google Calendar API
│   ├── apple-calendar.ts       # Apple Calendar API (planned)
│   └── sync-manager.ts         # Bidirektionale Sync
```

### Food: Production Ready

- 99 neue Tests (Backend, Web, Shared)
- Error Handling mit deutschen Meldungen
- Loading States und Retry-Buttons
- Settings-Seite mit Tageszielen

### Todo: Production Deployment

- deploy:landing:todo Script
- Cloudflare Pages Integration
- Localhost Fallbacks entfernt

---

## Bugfixes

### Auth

| Fix            | Beschreibung                          |
| -------------- | ------------------------------------- |
| Password Reset | Email Link Handler implementiert      |
| OIDC Routes    | Korrektes Mapping für Better Auth     |
| JWKS Route     | Korrekte Pfad-Konfiguration           |
| DuckDB         | node:20-slim für glibc Kompatibilität |

### Matrix

| Fix              | Beschreibung                       |
| ---------------- | ---------------------------------- |
| Session Lifetime | >= Refresh Token Lifetime          |
| Synapse Mounts   | Separate Config und Data           |
| E2E Warnings     | In Element ausgeblendet            |
| Env Vars         | Hardcoded DB Password (YAML Issue) |

### Docker

| Fix              | Beschreibung             |
| ---------------- | ------------------------ |
| matrix-bot-sdk   | Update auf v0.7 API      |
| crypto-nodejs    | Excluded (Alpine-Fehler) |
| --ignore-scripts | Für NPM Builds           |

---

## Neue Services

| Service           | Port | Typ       | Beschreibung           |
| ----------------- | ---- | --------- | ---------------------- |
| skilltree-backend | 3024 | NestJS    | Skill-Tracking API     |
| skilltree-web     | 5195 | SvelteKit | Skill-Tracking UI      |
| questions-backend | 3111 | NestJS    | Research Assistant API |
| questions-web     | 5111 | SvelteKit | Research Assistant UI  |
| mana-search       | 3021 | NestJS    | Such-Microservice      |
| matrix-mana-bot   | 3310 | NestJS    | Gateway Bot            |
| matrix-todo-bot   | 3315 | NestJS    | Todo Bot               |
| matrix-food-bot   | 3316 | NestJS    | Nutrition Bot          |
| matrix-quotes-bot | 3317 | NestJS    | Quotes Bot             |
| matrix-clock-bot  | 3318 | NestJS    | Timer Bot              |

---

## Zusammenfassung

| Bereich       | Commits | Highlights                             |
| ------------- | ------- | -------------------------------------- |
| SkillTree     | 4       | MVP complete, Backend + Web            |
| Questions     | 3       | Backend + Web, mana-search Integration |
| Matrix Client | 1       | Phase 2 Features                       |
| mana-search   | 3       | SearXNG, Extraction, Cache             |
| Bot Services  | 2       | Shared Package + Gateway               |
| Matrix Bots   | 8       | Todo, Food, Quotes, Clock              |
| OIDC          | 6       | Matrix SSO Provider                    |
| App Cleanup   | 8       | Demo Mode, Feature Removal             |
| Monitoring    | 2       | VictoriaMetrics, DuckDB                |
| Food          | 2       | Tests, Production Ready                |
| Telegram Bots | 1       | Food, Todo, Quotes                     |
| Bugfixes      | 15+     | Auth, Matrix, Docker                   |
| Documentation | 5       | Monitoring, Services, DevLogs          |

---

## Nächste Schritte

1. **SkillTree deployen** auf Mac Mini
2. **Questions App testen** mit echten Recherchen
3. **Matrix Bots refactoren** um bot-services zu nutzen
4. **E2EE Support** für Matrix Client
5. **Mobile Apps** für SkillTree und Questions
6. **mana-search** mit mehr Engines erweitern
7. **Gateway Bot** produktiv deployen
