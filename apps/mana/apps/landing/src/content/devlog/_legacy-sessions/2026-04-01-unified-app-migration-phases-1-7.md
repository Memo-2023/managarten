---
title: 'ManaCore Unified App: Phasen 1–7 + Memoro Production-Ready'
description: 'Start der Same-Origin Unified App — alle 26 Module migriert in 7 Phasen, cross-app DnD, Spotlight, Sync-Manager. Memoro auf Production gehoben (ManaScore 58 → 79).'
date: 2026-04-01
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'manacore',
    'unified-app',
    'migration',
    'monorepo',
    'memoro',
    'spotlight',
    'dnd',
    'sync',
    'todo',
    'i18n',
    'rate-limiting',
  ]
featured: true
commits: 81
readTime: 13
stats:
  filesChanged: 1485
  linesAdded: 81703
  linesRemoved: 45418
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 81
workingHours:
  start: '2026-04-01T10:55'
  end: '2026-04-01T23:05'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).


## Highlights

- **ManaCore Unified App gestartet** — Same-Origin Web-App, die alle 26 Module unter einem Build/Domain bündelt. 7 Phasen in einem Tag.
- **Cross-Type Drag & Drop** — Tags, Tasks, Events, Karten ziehen sich modulübergreifend
- **Cmd+K Spotlight** in allen 23 Apps — mit Content-Search-Providern
- **Memoro Production-Ready**: ManaScore 58 → 79 (Beta → Production), Audio-Server mit 4-Tier-Fallback live
- **`@manacore/shared-uload`** — neue Share-Modal-Library, in 6 Apps integriert
- **Rate-Limiting** als shared-hono Middleware

---

## ManaCore: Same-Origin Unified App (Phasen 1–7)

Bis heute war jedes der ~26 Mana-Module eine eigene SvelteKit-App mit eigener Domain (`todo.mana.how`, `chat.mana.how`, …) und eigener IndexedDB. Cross-App-Features (Tag-DnD, Spotlight-Search, Dashboard-Widgets) waren entweder Fake oder unmöglich, weil Same-Origin-Policy den IndexedDB-Zugriff über Subdomains blockt.

Der Plan war seit Wochen klar — heute wurde er ausgeführt, in einer langen Session.

### Phasen-Übersicht

| Phase | Was passiert | Module |
|-------|-------------|--------|
| **1** | Schema + erstes Modul (`calc`) | 1 |
| **2** | Migration in Wellen | 26 ✅ |
| **3** | Component-basiertes Split-Screen | – |
| **4** | Cross-App Dashboard-Widgets | – |
| **5** | Single-Container Infra | – |
| **6** | URL/Navigation Update | – |
| **7** | Unified Sync-Manager | – |

### Phase 2: 26 Module in drei Wellen

```
Welle 1 (12 Module):  skilltree, inventar, times, planta,
                      citycorners, photos, presi, uload,
                      context, questions, food, calc

Welle 2 (5 Module):   storage, cards, playground, guides,
                      + restliche Helper

Welle 3 (7 Module):   contacts, todo, calendar, picture,
                      chat, mukke, memoro
```

Jedes Modul wandert nach `apps/manacore/apps/web/src/lib/modules/{name}/`. Eigene Routes werden auf `(app)/{name}` umgehängt, Stores teilen sich die zentrale `mana` Dexie-DB. Kollidierende Tabellennamen bekommen einen Modul-Prefix.

### Phase 3: Component-basiertes Split-Screen

Statt mehrerer Routen für 1-Pane / 2-Pane / 3-Pane gibt es jetzt einen `<SplitScreen>` Slot-Container, der Pages dynamisch nebeneinander rendert. Jede Page kann mit `pageStore.add()` aus jedem Modul heraus geöffnet werden — ohne Navigation.

### Phase 4: Cross-App Dashboard-Widgets

Das Dashboard wird endlich ehrlich: Widgets aus Calendar, Todo, Memoro, Picture, Notes lesen jetzt aus derselben IndexedDB. Vorher hatte jedes Widget einen Stub. Jetzt: echte Daten, live, mit `liveQuery`.

### Phase 5: Single-Container Infra

Statt 26 Docker-Containern (einer pro App) läuft alles in einem `manacore-web` Container. Der NGINX-Routing-Layer fällt komplett weg. Massiv weniger RAM, weniger Cold-Starts, ein Build statt 26.

### Phase 6: URL-Migration

Alle internen Links werden umgeschrieben: `https://todo.mana.how/page` → `https://mana.how/todo/page`. Cross-App-Links funktionieren jetzt als normale `<a>`-Tags ohne Cross-Origin-Tanz.

### Phase 7: Unified Sync-Manager

Vorher: jede App hatte ihre eigene mana-sync-Verbindung. Jetzt: ein zentraler Sync-Manager debounced + batched alle Änderungen aus den 26 Modulen, taggt sie mit `appId`, und schickt sie in einem Stream zu mana-sync.

---

## Cross-Type Drag & Drop

Mit der Unified App wird endlich möglich, was vorher technisch ausgeschlossen war: **modulübergreifendes Drag & Drop**.

```
Drag a Tag from Notes →
   Drop on a Task → Tag wird zur Task hinzugefügt
   Drop on a Calendar Event → Tag wird zum Event hinzugefügt
   Drop on a Contact → Tag wird zum Kontakt hinzugefügt
```

Implementierung:
- `shared-ui` exportiert `DragSource` / `DropTarget` Snippets
- Generischer `entityDragStore` hält das aktuelle Drag-Item modulneutral
- Drop-Targets registrieren sich mit `acceptTypes: ['tag', 'task', 'event', …]`
- Tag-Enrichment passiert beim Drop, nicht beim Drag

Das System ist erweiterbar — jedes Modul kann sich als Source/Target registrieren.

---

## Cmd+K Spotlight in 23 Apps

Spotlight existierte bisher nur in todo + calendar. Heute in alle 23 Apps ausgerollt — mit zwei Erweiterungen:

### Action-Provider

Jede App registriert ihre eigenen Aktionen:

```typescript
spotlight.registerActions('todo', [
  { id: 'new-task', label: 'Neue Aufgabe', icon: 'plus', run: () => ... },
  { id: 'today', label: 'Heute fokussieren', run: () => ... },
]);
```

### Content-Search-Provider

Spotlight kann jetzt **inhaltlich** suchen — über Provider, die IndexedDB-Tabellen abfragen. Erste Provider live für **picture, presi, mukke, quotes, clock**.

```typescript
spotlight.registerSearchProvider('picture', async (query) => {
  return await db.images
    .filter(img => img.title?.includes(query))
    .limit(5)
    .toArray();
});
```

Resultate werden inline gerendert — Klick öffnet das Item direkt im jeweiligen Modul.

---

## `@manacore/shared-uload`: Share-Modal als Library

Bisher hatte jede App ihre eigene Share-Logik. Jetzt: ein einziges Package mit `<ShareModal>` und `createShareLink()` Helpers.

### Features
- **Password Protection** (optional)
- **Expiration Date**
- **Source-Tracking** — uload weiß welche App den Link erstellt hat (für Filter/Statistik)
- **Cross-App Link Creation** — `useShare()` Composable in jedem Modul

### Integration in 6 Apps am ersten Tag

| App | Was geteilt wird |
|-----|-----------------|
| Mukke | Playlists |
| Presi | Decks |
| Todo | Tasks (mit Subtasks) |
| Cards | Decks |
| Chat | Konversationen |
| Calendar | Events |
| Contacts | Visitenkarten |

uload bekommt einen neuen `source`-Filter — man sieht direkt welche Links aus welcher App kommen.

---

## Memoro: Production-Ready (ManaScore 58 → 79)

Gestern wurde Memoro ins Monorepo gehoben. Heute der Härtetest: Audit-Punkte abarbeiten bis es Production-Ready ist.

### Neu in `apps/memoro/apps/server`

- **Zod-Validation** auf allen Endpoints, mit konsistenten `ApiResult<T>` Responses
- **Pagination** auf List-Routen (`?limit=…&cursor=…`)
- **Invite-E-Mail** über mana-notify (templated, mit Cooldown)
- **Health-Checks** für Liveness/Readiness
- **Meetings-Modul** komplett portiert (Phase 7 der Memoro-Migration)
- **OpenAPI 3.1 Spec** als referenzierbares Schema
- **Vitest:** 25 API + Config Tests für Audio-Server, Zod-Schema-Tests, Route-Tests

### Audio-Server: 4-Tier Fallback live

Der gestrige Plan ist heute live:

```
Tier 1: Primärer Azure-Key
Tier 2: Retry mit gleichem Key
Tier 3: FFmpeg-Konvertierung (PCM 16kHz Mono)
Tier 4: Azure Batch (für > 10min Aufnahmen)
```

Plus **AI-Provider-Fallbacks**: Wenn OpenAI für die Headline-Generierung fällt, fallen wir auf Anthropic, dann auf lokales Ollama.

### MemoroEvents Analytics

Eigene Event-Klassen in `@manacore/shared-utils` — `memoro.recording.start`, `memoro.recording.complete`, `memoro.transcription.fallback_used`. Geht direkt nach Umami und GlitchTip.

### Production-Deployment

Eigenes `Dockerfile` + `docker-compose.yml` für Memoro Server + Audio-Server. Beide laufen jetzt im Mac-Mini-Stack neben den anderen Services.

### Audit-Report

Ein neues Dokument `docs/manascore/memoro-audit.md` zeigt die Punkte-für-Punkte-Bewertung. Der ManaScore-Status wird auf der Status-Page automatisch aktualisiert: **Memoro: 79/100 — Beta → Production**.

---

## Todo: Workbench-Polish + Custom Pages

### Page-Controls

Jede Todo-Page hat jetzt **Maximize / Minimize / Close** Controls oben rechts. Minimierte Pages erscheinen als Tab-Leiste am unteren Rand der App.

### Inline-Edit + Drag-Reorder

Der frühere "Edit-Modus" für Pages ist gestrichen. Stattdessen:
- **Click auf Titel:** Sofort-Edit (kein Modal mehr)
- **Drag-Handle:** Reorder der Page-Reihenfolge
- **Inline-Task-Creation:** Neue Tasks ohne Page-Wechsel

### Funktionierendes Tag-Filter-System

Das alte Tag-Filter war ein Stub. Komplett ersetzt durch echtes Filtering, das die `taskTags` Junction-Table nutzt.

### Bottom-Stack Notification System

Neuer `BottomStack` Container in shared-ui — staggered Notifications die sich über Pillnav schieben (nicht mehr darunter). Plus `bottomOffset` Prop für PillNav, damit die Toasts nicht mit Tab-Bar kollidieren.

---

## Status-Page: Tier-Badges + ManaCore selbst

- **Tier-Badges inline** statt in eigener Sektion — kompakter, lesbarer
- **ManaCore zur App-Registry hinzugefügt** und auf der Status-Page sichtbar
- **`mana.how` Badge gefixt** — wurde fälschlicherweise als "Down" angezeigt obwohl der Healthcheck OK war

---

## Refactor & Renames

### Cards (vorher: ManaDeck)

Globaler Rename `ManaDeck` → `Cards` durch das ganze Monorepo. Cleaner Namespace, bessere SEO, weniger Verwirrung mit "Decks" innerhalb der App.

### shared-auth-ui

Neues Package mit `GuestRegistrationNudge` — der Banner der Guests dazu animiert sich zu registrieren, ohne nervig zu sein. Plus `GuestWelcomeModal` Redesign.

### Footer-Polish

ManaCore Landing Footer komplett überarbeitet — bessere Lesbarkeit, sync mit tatsächlichem Production-Deployment-Status.

---

## Infra & Fixes

| Fix | Beschreibung |
|-----|-------------|
| Docker-Build manacore-web | Fehlende Deps (dexie, app-spezifische Packages), Sync-URL Build-Arg |
| Toast-System | `svelte-sonner` durch lokalen Toast-Store ersetzt (kleinerer Bundle) |
| Memoro `$user` → `authStore.user` | Svelte 5 runes Konvertierung |
| mana-stt | WhisperX + Diarisierung integriert |
| mana-notify | Neue Templates für Memoro-Invites |
| CD Pipeline | Schritte für unified manacore-web Container |

---

## Dokumentation

- `docs/UNIFIED_APP_MIGRATION.md` — Plan + Status aller 7 Phasen, jetzt vollständig abgehakt
- `docs/manascore/memoro-audit.md` — Memoro-Audit-Report
- Memoro `OpenAPI 3.1` Spec

---

## Zusammenfassung

| Bereich | Commits | Highlights |
|---------|---------|-----------|
| ManaCore Unified | ~30 | Phasen 1–7, 26 Module migriert, Single-Container, Sync-Manager |
| Cross-App Features | ~10 | DnD, Spotlight, Content-Search, Dashboard-Widgets |
| Memoro Production | ~15 | ManaScore 58→79, Tests, Audio-Server, OpenAPI |
| shared-uload | ~6 | ShareModal in 6 Apps, Source-Tracking |
| Todo Polish | ~10 | Custom Pages, Page-Controls, Tag-Filter, Inline-Edit |
| Status-Page / Branding | ~5 | Tier-Badges inline, ManaDeck → Cards |
| Infra & Fixes | ~5 | Docker-Builds, mana-stt WhisperX, CD updates |

---

## Nächste Schritte

- Weitere Module ins Unified-App-Pattern: alle bisher übersehenen UI-Details abklopfen
- Standalone-Server der einzelnen Apps archivieren — der unified API-Server kommt morgen
- Cross-Module-DnD ausbauen: Drop von Todos in Calendar als Time-Block
- Content-Search-Provider auch für die noch fehlenden Module (todo, contacts, calendar)
