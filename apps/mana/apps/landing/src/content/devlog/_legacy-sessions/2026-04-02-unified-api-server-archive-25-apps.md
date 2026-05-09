---
title: 'Unified API Server + 25 Apps archiviert + SSE Sync'
description: '17 Module-Server zu @manacore/api konsolidiert, 25 standalone Web-Apps archiviert, WebSocket-Sync durch SSE ersetzt, Partial-Sync mit lazy collection loading. Plus Tag-System, Detail-View Overlays und i18n.'
date: 2026-04-02
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'manacore',
    'unified-api',
    'hono',
    'archive',
    'sse',
    'sync',
    'tags',
    'i18n',
    'analytics',
    'workbench',
  ]
featured: true
commits: 107
readTime: 15
stats:
  filesChanged: 3659
  linesAdded: 70140
  linesRemoved: 68673
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 107
workingHours:
  start: '2026-04-02T01:17'
  end: '2026-04-02T23:59'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Unified API Server** (`@manacore/api`): 17 Module-Server zusammengeführt, 25 standalone Web-Apps archiviert
- **WebSocket → SSE**: ein einziger Stream pro User statt 27 Verbindungen
- **Partial Sync**: Collections werden lazy beim ersten Modul-Visit geladen
- **Detail-View Overlays** in 14 Modulen — Stack-fähig, mit inline-editing
- **Unified QuickInputBar** mit context-aware Adapters pro Modul
- **i18n** in 5 Phasen — 126 deutsche Strings extrahiert, Locale-Files konsolidiert
- **2 DBs statt 20+**: `mana_platform` + `mana_sync` mit pgSchema-Isolation
- **Shared Tag-System** über alle 23 Module mit Junction-Tables

---

## Unified API Server: 17 Hono-Server zu einem

Gestern wurden die _Frontends_ konsolidiert. Heute folgten die _Backends_.

Bisher hatte jedes Modul mit Server-Logik einen eigenen Hono-Container (calendar-server, contacts-server, todo-server, …). Jeder mit eigener Auth, eigener Health-Route, eigener Drizzle-Connection. Massiv viel Duplikation, massiv viel RAM, 17 Pipelines.

### Neuer `@manacore/api` Server

Ein einziger Hono/Bun-Server unter `apps/api/`. Module registrieren ihre Routen unter `/api/v1/{module}/*`:

```
apps/api/
├── src/
│   ├── modules/
│   │   ├── calendar/   # Routes + Service
│   │   ├── contacts/
│   │   ├── todo/
│   │   ├── memoro/
│   │   └── … (17 Module)
│   ├── middleware/     # auth, rate-limit, errors (von shared-hono)
│   ├── db/             # 1 Drizzle-Connection für alle Module
│   └── index.ts        # Routes-Mounting
```

### Migration in zwei Schritten

| Schritt | Was passiert                                                 |
| ------- | ------------------------------------------------------------ |
| 1       | API-Server mit 3 Modulen erstellt (calendar, contacts, todo) |
| 2       | Restliche 12 Module portiert                                 |

Jedes Modul behält seine Service-Layer fast unverändert — nur das Hono-App-Setup fällt weg. Auth, Errors, Rate-Limiting kommen aus `@manacore/shared-hono`.

### Was jetzt weg ist

```
apps-archived/
├── calendar-server/
├── contacts-server/
├── todo-server/
├── chat-server/
├── … (17 Server total)
└── README.md  # erklärt warum
```

**RAM-Footprint**: ~2.4 GB → ~280 MB. **Cold-Start**: ~45s zusammen → ~120 ms.

### Auch 25 standalone Web-Apps archiviert

Mit der Unified Web-App von gestern und dem Unified API von heute haben die einzelnen `apps/{name}/apps/web/` Verzeichnisse keinen Zweck mehr. Alle 25 nach `apps-archived/` verschoben. `wisekeep` ist mit dabei.

`.eslintrc` ignored `web-archived/` Pattern damit Lint nicht durch totes Holz läuft.

---

## Sync: WebSocket → SSE + Partial Sync

Der Sync-Layer hatte zwei Probleme:

1. **27 WebSocket-Verbindungen pro User** (eine pro App). Connection-Pool-Limit hit.
2. **Voll-Sync beim Start** — alle 120+ Collections, auch wenn der User nur 2 Module benutzt.

### Unified WebSocket — _eine_ Verbindung pro User

```
Vorher: User × 27 Apps × WebSocket = 27 Verbindungen
Nachher: User × 1 manacore-web × WebSocket = 1 Verbindung
```

`mana-sync` (Go) multiplext alle App-Streams über einen Channel. Server-Side: einfach RLS-gefilterter `LISTEN/NOTIFY`.

### Dann: WebSocket → SSE

Ein paar Stunden später wurde der WebSocket-Code komplett rausgerissen und durch **Server-Sent Events** ersetzt:

| Aspekt         | WebSocket          | SSE                                       |
| -------------- | ------------------ | ----------------------------------------- |
| Reconnect      | Manuell            | Browser-built-in                          |
| Proxy-Probleme | Häufig (CF, NGINX) | Keine (HTTP)                              |
| Bidirektional  | Ja                 | Nein (irrelevant — Writes gehen via REST) |
| Code           | ~600 LOC           | ~180 LOC                                  |

SSE-Endpoint: `GET /api/v1/sync/stream` → ein Heartbeat alle 25s, Push bei jedem Server-side Change.

### Partial Sync: Lazy Loading

Beim Login werden jetzt nur **Core-Collections** synchronisiert (settings, profile, dashboard-state). Alle Modul-Collections werden erst beim ersten Visit des Moduls gepullt.

```
Login → core (5 collections, ~50 KB)
   ↓
Visit /todo → todo collections (12, ~200 KB)
   ↓
Visit /calendar → calendar collections (8, ~150 KB)
```

Plus **Pull-Pagination** mit `hasMore` Flag, damit ein Modul mit 10.000 Items nicht in einem 8 MB JSON-Blob ankommt.

### Live-Update Bugs (zwei)

E2E-Tests fanden zwei Bugs in der SSE-Reconnect-Logik:

1. Doppel-Subscribe nach Reconnect → doppelte Updates
2. Pending-Changes wurden nach Reconnect nicht resync'd

Beide gefixt, mit Test-Coverage.

---

## Detail-View Overlay-System

Vorher öffnete jedes Modul Detail-Views als eigene Route. Mit der Unified App wäre das Navigation-Hell. Lösung: **Overlay-Stack**.

```
Workbench
   ↓ click on task
   Overlay #1 (TaskDetail)
      ↓ click on linked event
      Overlay #2 (EventDetail)
         ↓ click on contact
         Overlay #3 (ContactDetail)
            [ESC] schließt Overlay #3
```

### Live in 14 Modulen heute

cards, storage, presi, calendar, contacts, todo, picture, chat, mukke, memoro, planta, inventar, times, dreams.

Jedes Detail-View hat:

- **Inline editing** — kein Edit-Modus mehr
- **Animated Open/Close**
- **ESC-Key Support**
- **Stack-Awareness** — z-index korrekt, Backdrop nur unter dem obersten

Routes für die alten Detail-Pages konsolidiert: 14 Routen weg, 1 Layout-Component da.

### Page-Carousel statt Routen

Module wie Contacts haben jetzt einen **Page-Carousel** — zwischen "Liste", "Mein Profil", "Statistik" wird per Swipe/Tab gewechselt, nicht per Route. Schneller, kein Layout-Flash.

---

## Tag-System: Eines für alle 23 Module

Jedes Modul hatte bisher seine eigenen Tags, in eigenen Tabellen. Sinnloser Duplicate-State.

### `globalTags` Tabelle

Eine zentrale `globalTags` Tabelle mit `{id, name, color, icon}`. Jedes Modul nutzt Junction-Tables wie `taskTags`, `contactTags`, `eventTags` mit `(itemId, tagId)`.

### Neuer `createTagLinkOps` Factory

```typescript
const taskTagOps = createTagLinkOps({
	table: db.taskTags,
	itemKey: 'taskId',
	tagKey: 'tagId',
});

await taskTagOps.add({ taskId, tagId });
await taskTagOps.removeAll({ taskId });
```

23 Module nutzen denselben Factory, ein einziges Test-Set, eine einzige Sync-Code-Pfad.

### Shared Components

- `<TagChip>` — die einheitliche Tag-Pille
- `<TagSelector>` — Multi-Select mit Inline-Erstellung
- `<TagField>` — Form-Field-Wrapper

todo + photos sind die ersten Migranten weg von ihren lokalen Kopien.

### Tag-DnD im Workbench

Tags können aus dem Tag-Strip gezogen und auf Items in jedem Modul gedroppt werden. Reaktiv, mit `.value` statt `.subscribe()` (das war ein Bug).

---

## Workbench: QuickInputBar + Page-Carousel

### Unified QuickInputBar

Ein einziger Input am unteren Bildschirmrand. Was er erstellt, hängt vom aktuellen Kontext ab:

| Modul    | QuickInput erstellt |
| -------- | ------------------- |
| Todo     | Task                |
| Calendar | Event               |
| Notes    | Note                |
| Contacts | Contact             |
| Habits   | Habit               |
| …        | …                   |

**Adapter-Pattern**: jedes Modul registriert sich mit `registerQuickInputAdapter('todo', { create, parse, …})`.

### Workbench Home: App Pages Carousel

Statt einer statischen Dashboard-Page hat der Workbench-Home einen horizontalen Carousel mit allen aktiven App-Pages. Swipe/Tab/Cmd+1..9 wechselt zwischen ihnen.

### 2D-Resize

Pages im Workbench sind jetzt in beide Achsen resizable (Width + Height), mit Memory pro Page.

### Bottom-Chrome dynamisch

`bottom-chrome-height` ist eine CSS-Variable die sich an PillNav, Tabs, Notifications anpasst. Main-Content schiebt sich entsprechend.

### `AppView` → `ListView` Rename

In allen 24 Modulen wurde `AppView.svelte` zu `ListView.svelte` umbenannt. Klarer Begriff.

---

## i18n: 5 Phasen

| Phase | Was passiert                                        |
| ----- | --------------------------------------------------- |
| 1     | Locale-Files in per-Modul-Struktur splitten         |
| 2     | User-Settings Locale wired, Nav-Translations        |
| 3     | Alle 22 Module-Translations konsolidiert            |
| 4     | 126 hardcoded deutsche Strings durch `$_()` ersetzt |
| 5     | Help-Content nach Locale-Files migriert             |

Resultat: Es gibt jetzt **keine einzige hardcoded Sprache mehr** im Unified-App-Code (Help-Articles inklusive).

---

## Datenbanken: 20+ → 2

Bisher hatte jeder Modul-Server seine eigene PostgreSQL-DB. Mit dem Unified API macht das keinen Sinn mehr.

### Neue Struktur

```
mana_platform   # alle Service-Daten (auth, todo, calendar, …)
                # via pgSchema('todo'), pgSchema('calendar'), …
                # je Modul ein Schema, eine logische Trennung

mana_sync       # write-heavy, das eine Ding für mana-sync (Go)
```

`pgSchema()` statt `pgTable()` ist jetzt Pflicht. Alte DBs (calendar_db, contacts_db, …) gedumpt + gelöscht.

---

## Analytics: Module-Context + Web Vitals

### Konsolidierung

Umami wurde von allen archivierten Apps entfernt — nur die Unified App trackt jetzt. Aber: jedes Event bekommt einen `module` Context.

```typescript
analytics.track('item.created', {
	module: 'todo',
	itemType: 'task',
	hasDueDate: true,
});
```

### Event-Tracking in 19 Module-Stores

Erste Welle: 7 Core-Module. Zweite Welle: 12 weitere. Tracked werden Create/Update/Delete/Move/Reorder Events.

### Web Vitals + Funnel

CLS, LCP, FID, TTFB werden jetzt zu Umami gesendet. Plus Funnel-Events: `funnel.signup.start`, `funnel.signup.complete`, `funnel.first_action`. GlitchTip bekommt User-Context (anonymisierte ID + Tier).

---

## Reminder System

Neuer **shared reminder system** in `@manacore/shared-stores` — ein Background-Worker scheduled lokale Notifications für Tasks, Events, Habits. Wird im App-Layout gemountet.

```typescript
reminderService.schedule({
	module: 'todo',
	itemId: task.id,
	fireAt: task.dueDate.minusMinutes(15),
	payload: { title: task.title },
});
```

Notification kommt via Service Worker, klickbar, öffnet das Detail-View.

---

## Auth & Stores Refactor

- **`shared-auth-stores` aufgelöst** → in `shared-auth-ui` absorbiert. Ein Package weniger.
- **`createGuestMode` Composable** + Unified `AuthGate` — der Guest-Modus ist jetzt überall einheitlich, statt 23 lokale Implementierungen.
- **`createArchiveOps` / `createViewStore` Factories** — wiederverwendbare CRUD-Patterns für alle Module.
- **Shared Python Auth** + **Shared Go Auth** Packages — extrahiert aus mana-stt, mana-tts, und 3 Go-Services.

---

## Monitoring

- **Strukturiertes Logging** in allen Services (JSON-Format, korrelierbar)
- **Promtail-Alignment** — Labels einheitlich, damit Loki-Queries nicht über inkompatible Schemas stolpern
- **GlitchTip Config** updated für unified app
- **Status-Page** zeigt jetzt unified app statt 27 einzelne Apps

---

## Sonstiges

| Item            | Detail                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------- |
| Self-Contact    | Contacts erstellt für jeden User automatisch einen Eigenen-Profil-Contact, auch im Guest-Mode |
| ColorPicker     | Generischer `<ColorPicker>` mit Standard-Paletten in shared-ui                                |
| FavoriteButton  | Generic `<FavoriteButton>` + `toggleField` Utility                                            |
| Vitest Coverage | Threshold von 50 → 70 %                                                                       |
| jest.config.js  | Orphan entfernt                                                                               |
| Stub-Services   | Archived                                                                                      |

---

## Zusammenfassung

| Bereich                | Commits | Highlights                                        |
| ---------------------- | ------- | ------------------------------------------------- |
| Unified API            | ~15     | 17 Server zu einem, 25 Apps archiviert, 2 DBs     |
| Sync                   | ~10     | WebSocket→SSE, partial sync, pull pagination      |
| Detail Overlays        | ~10     | 14 Module, stack-fähig, inline editing            |
| Tag System             | ~12     | globalTags, junction tables, factory, DnD         |
| QuickInput + Workbench | ~8      | Adapter-Pattern, Page-Carousel, 2D-Resize         |
| i18n                   | ~6      | 5 Phasen, 126 Strings extrahiert                  |
| Analytics              | ~10     | Module-Context, Web Vitals, 19 Stores             |
| Refactor               | ~12     | Auth-Stores absorbiert, Factories, Python/Go Auth |
| Monitoring             | ~5      | Logging, Promtail, GlitchTip                      |
| Fixes                  | ~19     | Diverse Sync- + Build-Bugs                        |

---

## Nächste Schritte

- Habits-Modul aufbauen (das einzige offene Modul)
- Notes & Finance Module ins Unified pattern ziehen
- Cross-Module-Drag-Targets ausbauen (Tags → Tasks → Events fertig, fehlt Karten/Locations)
- Stalwart als interner Mail-Server für mana-notify
