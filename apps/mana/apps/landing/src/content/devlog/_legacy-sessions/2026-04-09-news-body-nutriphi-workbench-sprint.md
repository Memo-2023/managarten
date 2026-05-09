---
title: 'Mega-Sprint: News-Modul, Body-Fitness, Nutriphi AI-Foto, Workbench Inline-Actions + 60 Bugfixes'
description: 'Größter Tag seit dem Encryption-Rollout: News-Modul mit Backend-Ingester + RSS-Feeds, Body-Fitness-Modul mit Routinen + Progressions-Chart, Nutriphi AI-Foto-Erkennung, 8 Module mit Workbench-Inline-Actions, Who-Dossier-System, Sync-Debug-Runbook, Wire-Format-Versioning, Cloudflare-Tunnel-Rebuild, 270 Warnings auf null.'
date: 2026-04-09
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'news',
    'body',
    'nutriphi',
    'workbench',
    'inline-actions',
    'who',
    'sync',
    'cloudflare',
    'ai',
    'zod',
    'vercel-ai-sdk',
    'bug-sweep',
  ]
featured: true
commits: 143
readTime: 22
stats:
  filesChanged: 833
  linesAdded: 40847
  linesRemoved: 22379
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 143
workingHours:
  start: '2026-04-09T08:00'
  end: '2026-04-09T23:59'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **News-Modul** — Backend-Ingester-Service, kuratierte RSS-Feeds, Client-Data-Layer, Workbench-ListView + Dashboard-Widget, "Interested"-Bookmark, Onboarding-Flow
- **Body-Fitness-Modul** — neues Modul für kombiniertes Fitness-Training + Körperkomposition, Exercise-Picker, Routinen, Phasen, Progressions-Chart, Calorie×Weight-Korrelation, i18n, Integration-Tests
- **Nutriphi AI-Foto-Erkennung** — Photo-Capture + AI-Meal-Recognition, Meal-Detail-Page mit Foods-Breakdown, Inline Quick-Add, globaler Quick-Input-Adapter
- **Workbench Inline-Actions** für 8 Module — Inventory, Picture, Moodlit, Context, Events, Who, Body, Chat
- **Who-Dossier-System** — Character-Dossier mit gestaffelter Fact-Disclosure, inline Who-Games im Workbench
- **Wire-Format Envelope Versioning** + Anthropic Prompt-Cache Hints im API-Server
- **270 Compiler-Warnings auf null** — großer Sweep über mana/web + alle Packages
- **Cloudflare-Tunnel-Rebuild** — Tunnel als Single Source of Truth, Pre-Commit-Validator
- **Sync-Debug-Runbook** mit neuem Debug-API

---

## News-Modul — von Null auf Dashboard-Widget

Das News-Modul wurde an einem Tag end-to-end aufgebaut, vom Backend-Ingester bis zum Workbench-Widget.

### Backend: news-ingester Service

Neuer Service `news-ingester` als Hono/Bun-App mit kuratierten RSS-Feed-Quellen. Der Ingester pollt Feeds per Cron, parsed Articles via JSDOM + Readability, speichert in PostgreSQL. Zwei Bugs im Ingester sofort gefixt:

- **JSDOM CSS-Errors**: Readability-Fallback crashte den Ingester in einer Loop. Fix: CSS-Error-Silence + Process-Level Safety-Net + Readability-Fallback komplett disabled
- **Unused `@mana/shared-hono` dep**: entfernt, der Ingester braucht kein Auth-Middleware

### Frontend: Client-Data-Layer + UI

```
news-ingester (Hono/Bun)
  ↓ curated RSS feeds
PostgreSQL
  ↓ /api/v1/news/*
mana-web
  ↓ Dexie collections + liveQuery
News workbench (ListView + detail)
  ↓ dashboard widget
Dashboard
```

- `collections.ts` + `queries.ts` + Store mit Bookmark/Interest-Aktionen
- i18n Locales für de/en
- Workbench ListView mit Article-Cards
- Dashboard-Widget mit den neuesten 5 Artikeln
- **"Interested"-Feature**: Artikel als interessant markieren → bleibt sichtbar + bekommt ein Saved-Badge
- **Onboarding**: Instant Handoff zum Feed-Branch nach der ersten Selektion

### Auth + Vault Guards

Drei Auth-Fixes für das News-Modul:

- Bearer Token korrekt im API-Client
- `getValidToken()` statt raw `getAccessToken()`
- Guard gegen Vault-Lock (Prefs nicht laden wenn Vault locked)
- Client-side API URL statt Server-URL für SSR-Kompatibilität
- Dexie v4 Schema-Upgrade für die neuen News-Tabellen

---

## Body-Fitness-Modul — kombiniertes Training + Körperkomposition

Komplett neues Modul `body` in `$lib/modules/body/`:

**Phase 1 — Foundation**:

- Dexie-Tabellen für Workouts, Exercises, Body-Measurements
- UI-Komponenten, Route, i18n, Dashboard-Widget
- Module in den Workbench-App-Registry eingetragen

**Phase 2 — Features**:

- Exercise-Picker mit Kategorien (Kraft, Cardio, Flexibility)
- Routinen-System mit vordefinierten Trainingsabläufen
- Phasen-Tracking (Aufwärmen, Training, Cool-Down)
- Progressions-Chart (Gewicht × Wiederholungen über Zeit)
- Calorie×Weight-Korrelation-Chart (volle i18n)

**Phase 3 — Quality**:

- Integration-Tests für `bodyStore` Mutations mit fake-indexeddb
- Fix: Routine-Creation unblocked + Duplicate-Header entfernt

---

## Nutriphi: AI-Foto-Mahlzeit-Erkennung

Das Nutriphi-Modul (Ernährungstracking) bekommt eine AI-gestützte Foto-Erkennung:

### API-Refactor

`/api/v1/nutriphi/photo` aufgesplittet in zwei Endpoints:

- `POST /photos/upload` — Foto in MinIO ablegen, Thumbnail generieren
- `POST /analysis/photo` — AI-Vision-Analyse über mana-llm (Vercel AI SDK + Zod für strukturierte Outputs)

Beide Endpoints nutzen jetzt den Vercel AI SDK mit `supportsStructuredOutputs: true` und Zod-Schemas für typsichere AI-Responses. Der Default-Vision-Model wurde auf `ollama/gemma3:4b` gesetzt.

### Frontend

- **Photo-Capture**: Kamera-Button in der Workbench-ListView, nimmt ein Foto auf → Upload → AI-Analyse → strukturierte Mahlzeit mit Lebensmitteln + Kalorien
- **Meal-Detail-Page**: Foods-Breakdown mit Nährwerten pro Lebensmittel, Thumbnail-aware Listen
- **Inline Quick-Add**: Text + Photo direkt in der ListView
- **Global Quick-Input-Adapter**: Nutriphi ist über die globale Suchleiste erreichbar ("Neue Mahlzeit")
- **Context-Menu Quick-Action**: Rechtsklick → "Neue Mahlzeit"

### Tests

- Integration-Tests für Meal-Mutations + Encryption
- Consistency-Guard-Test: Workbench-Registry ↔ `MANA_APPS`

---

## Workbench Inline-Actions — 8 Module

Statt jedes Modul nur als ListView zu rendern, bekommen jetzt 8 Module direkte Inline-Aktionen im Workbench:

| Modul     | Inline-Action                             |
| --------- | ----------------------------------------- |
| Inventory | Quick Item Creation                       |
| Picture   | Inline Upload                             |
| Moodlit   | Inline Mood Creation                      |
| Context   | Inline Document Creation                  |
| Events    | Detail Overlay via ViewProps              |
| Who       | Inline Game Play + Detail                 |
| Body      | (bereits mit Routinen)                    |
| Chat      | Workbench Detail Overlay mit Streaming AI |

### Chat: AI-Streaming im Workbench

Die Chat-Detail-Seite bekommt Streaming-AI-Completions:

- Vercel AI SDK wired für streaming
- Workbench-Detail-Overlay zeigt den Chat inline
- Auth-Header + Template-System-Prompts + Streaming-Debounce
- `api/who`: Server-side Validation des `[IDENTITY_REVEALED]` Sentinel

### Who-Dossier-System

Das Who-Modul (Charakter-Ratespiel) bekommt ein Dossier-System:

- **Staged Fact Disclosure**: Fakten werden stufenweise enthüllt, nicht alle auf einmal
- **Inline Play**: Who-Games direkt auf der Workbench-Page spielbar
- Chat-Bubble Tailwind-Klassen von v3 → v4 migriert
- `createdAt` + simple `gameId` Index für Messages

---

## Wire-Format Envelope Versioning + Prompt-Cache

Der API-Server (`@mana/api`) bekommt zwei Architektur-Verbesserungen:

### Envelope Versioning

Jeder API-Response wird in ein versioniertes Envelope gewrapped:

```json
{
  "version": 1,
  "data": { ... },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

Damit können Breaking Changes am Response-Format versioniert werden ohne bestehende Clients zu brechen.

### Anthropic Prompt-Cache Hints

Für AI-Endpoints die Anthropic-Modelle nutzen: Cache-Control-Hints im System-Prompt damit wiederholte Aufrufe den Prompt-Cache treffen. Reduziert Latenz und Kosten.

### Zod-Schemas für AI Structured Outputs

Neue `@mana/shared-types` Zod-Schemas für alle AI-Structured-Output-Formate. Die API-Routes konsumieren die Schemas via `z.infer<typeof schema>` statt manueller Typen. Nutriphi/Planta Vision-Routes komplett auf Vercel AI SDK + Zod migriert.

---

## Cloudflare-Tunnel-Rebuild

Drei Commits für Infrastructure-Hardening:

1. **Single Source of Truth**: `cloudflared-config.yml` wird zum einzigen Ort für Tunnel-Konfiguration
2. **Smarter Rebuild**: Apex-Domain via API + sane Health-Probes statt alle Probes gleichzeitig
3. **Pre-Commit-Validator**: Neuer Hook validiert die Tunnel-Config vor jedem Commit — syntaktisch und semantisch (keine doppelten Hostnames, keine fehlenden Services)

---

## Sync-Debug-Runbook + Silent Push Failures

### Runbook

Neues `SYNC_DEBUG` Runbook in `docs/sync/` mit einem neuen Debug-API in mana-sync:

- Schritt A: Client-Side Debug-Info exponieren
- Schritt B: Server-Side Query per User
- Schritt C: Neue Debug-API mit `GET /debug/user/:userId/changes`

### Silent Push Failures

Das Problem: Sync-Pushes scheiterten still — kein UI-Feedback, kein Toast, kein Log. Jetzt:

- Debug-Info in der Sync-Status-Anzeige
- Silent Push Failures als Toast + console.warn surfacen

---

## 270 Warnings auf Null

Größter Warning-Sweep bisher:

- `da03fac72` — Alle 270 Svelte-Check Warnings in mana/web + allen Packages auf null
- Hauptsächlich: unused imports, missing types, deprecated API usage
- Includes Packages: `shared-auth`, `shared-llm`, `shared-branding`

---

## Sonstige Features + Fixes

| Bereich              | Was                                                                               |
| -------------------- | --------------------------------------------------------------------------------- |
| Guides               | Komplettes Modul mit Types, CRUD, Detail-View, Run-Tracking                       |
| Zitare               | Smooth Transitions, Custom Quotes, Notes, neue Kategorien, Fuzzy Search           |
| Memoro               | Title-Source-Label unter dem Title-Input                                          |
| Architecture Cleanup | liveQuery Migration, Dead Types, Seed Registry                                    |
| Shared Voice         | Geteilter Voice-Transcription-Helper für alle Module                              |
| Workbench Registry   | Body, Events, Who, Guides in den App-Registry eingetragen                         |
| mana-llm             | `response_format` Support im ChatCompletionRequest + Ollama Strip-Markdown-Fences |
| shared-llm           | Bump Default-Model auf `gemma4:e4b` + Fallback auf `message.reasoning`            |
| mana-media           | Initial Schema-Migration committed + Run-on-Startup                               |
| Help                 | Broken Imports gefixt + SupportedLanguage Typing                                  |
| shared-auth          | Passkey/2FA/Session Methods durch ManaAuthStore proxied                           |
| Api Dockerfile       | @mana/shared-types in Build-Context kopiert                                       |
| inventar → inventory | Rename über die ganze Codebase                                                    |
| shared-branding      | APP_URLS aus APP_ICONS abgeleitet, Who-Entry nachgetragen                         |
| API Deploy           | `mana-api.mana.how` statt `api.mana.how` (Konflikt-Vermeidung)                    |
| Sync                 | Fresh Writes sofort pushen via Listener-Bridge                                    |
| AiSettings           | h2/h3 durch div ersetzt (semantische Korrektheit)                                 |

---

## Numbers

|                                     |                |
| ----------------------------------- | -------------- |
| Commits                             | 143            |
| Files changed                       | 833            |
| LOC added                           | ~40.850        |
| LOC removed                         | ~22.380        |
| Net                                 | +18.470        |
| Neue Module                         | 2 (News, Body) |
| Module mit Workbench Inline-Actions | 8              |
| Warnings eliminated                 | 270            |

---

## Lehren

1. **AI-Vision braucht strukturierte Schemas**: Ohne Zod-Validierung halluziniert das Vision-Modell Felder die im Frontend crashen. Vercel AI SDK + Zod ist die richtige Abstraktion — type-safe bis zum UI.

2. **Silent Failures sind schlimmer als laute Errors**: Sync-Pushes die still scheitern sind für den User unsichtbar — Daten gehen verloren ohne Feedback. Jedes I/O-System braucht Failure-Surfacing.

3. **Pre-Commit-Validators für Infrastructure-as-Code**: Eine kaputte Tunnel-Config deployed erst nach 10 Minuten Build — der Pre-Commit-Hook fängt das in Sekunden.
