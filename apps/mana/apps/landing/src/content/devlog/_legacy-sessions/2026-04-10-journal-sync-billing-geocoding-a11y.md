---
title: 'Journal-Modul, Sync-Billing Phase 2, Self-Hosted Geocoding, 215 A11y-Fixes'
description: 'Neues Journal-Modul mit Voice + Mood + Encryption, Sync-Billing mit Server-Side Billing-Gate + Cron-Charging, Self-Hosted Geocoding mit Pelias (DACH), Firsts-Modul, 215 A11y-Suppressions durch echte Fixes ersetzt, Credits-Vereinfachung, TimeBlocks-Integration für 9 Module.'
date: 2026-04-10
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'journal',
    'sync',
    'billing',
    'geocoding',
    'pelias',
    'a11y',
    'credits',
    'timeblocks',
    'firsts',
    'workbench',
    'docker',
  ]
featured: true
commits: 53
readTime: 16
stats:
  filesChanged: 556
  linesAdded: 22514
  linesRemoved: 3220
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 53
workingHours:
  start: '2026-04-10T09:00'
  end: '2026-04-10T22:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Journal-Modul** — Tagebuch mit Voice-Capture, Mood-Tracking und Encryption
- **Sync-Billing Phase 2** — Server-Side Billing-Gate, Cron-basiertes Credit-Charging, E-Mail-Benachrichtigungen
- **Self-Hosted Geocoding** mit Pelias (DACH-Region) — Autocomplete, Reverse-Geocoding, Auto-Kategorisierung
- **Firsts-Modul** — "Erstes Mal"-Tracking von Traum bis Realität
- **215 A11y-Suppressions** durch echte Fixes ersetzt
- **Credits-Vereinfachung** — Productivity Credits, Guild Pools und komplexe Gift-Types entfernt
- **TimeBlocks-Integration** für 9 weitere Module
- **Workbench-Redesign** — Page Cards mit runden Ecken, unified Header, DnD entfernt

---

## Journal-Modul

Neues Modul `journal` in `$lib/modules/journal/`:

- **Voice-Capture**: VoiceCaptureBar-Integration für gesprochene Einträge
- **Mood-Tracking**: Stimmung pro Eintrag (1–5 Skala mit Emoji-Feedback)
- **Encryption**: Alle Einträge AES-GCM-256 verschlüsselt (Registry + Store korrekt verdrahtet)
- **Dexie-Collections**: `journalEntries` mit `userId`, `createdAt`, `mood`, `content`, `tags`
- **Workbench-Integration**: ListView mit Inline-Erstellung

Das Journal unterscheidet sich bewusst von Notes: Notes sind Arbeitsdokumente (Markdown, Tags, Referenzen), das Journal ist chronologisch, stimmungsbezogen und persönlicher.

---

## Sync-Billing Phase 2 — Server-Side Gate + Cron Charging

### Phase 1 Recap (Credits)

`mana-credits` Service bekommt Sync-Billing: monatliches Credit-Abo für Cloud-Sync. Neue Subscription-Tabelle, Activation/Cancellation-Flow, Admin-Gifted Subscriptions.

### Phase 2: Server-Side Enforcement

Die wichtigere Hälfte — der Server-Side Billing-Gate in `mana-sync`:

1. **Billing-Middleware**: Jeder Sync-Push prüft ob der User ein aktives Sync-Abo hat. Ohne Abo → 402 Payment Required mit Link zur Credits-Page
2. **Cron-Charging**: Täglicher Cron-Job berechnet den anteiligen Credit-Verbrauch pro aktivem Sync-Abo
3. **E-Mail-Benachrichtigungen**: Low-Balance-Warning + Subscription-Expiry via `mana-notify`
4. **Docs**: mana-sync CLAUDE.md aktualisiert mit Billing-Middleware, neuen Env-Vars, Projektstruktur

### Sync UI

- **Sync-Status PillNav Dropdown**: Der Sync-Status ist jetzt über einen PillNav-Dropdown sichtbar — Pending Changes, Last Sync, Subscription-Status
- **Onboarding-Step**: Neuer Onboarding-Schritt für Cloud-Sync mit Erklärung + Upgrade-CTA
- **Batched Push**: `PUSH_BATCH_SIZE = 200` — große Sync-Pushes werden in 200er-Batches gesplittet statt als Monolith gesendet

---

## Self-Hosted Geocoding mit Pelias

Statt auf Google Maps oder Mapbox zu setzen, hosten wir Geocoding selbst mit **Pelias** (Open-Source, OpenStreetMap-basiert):

### Setup

- **DACH-only Import**: Pelias-Config auf Deutschland, Österreich, Schweiz beschränkt. Spart 80% Storage vs. Welt-Import
- **Single-Country Filter**: Nur DACH-Ergebnisse werden zurückgegeben
- **Docker-Compose**: Pelias-Stack (Elasticsearch, PIP, Placeholder, Interpolation, API) in der prod compose

### Features

- **Autocomplete**: Live-Suche während der Eingabe in Places
- **Reverse-Geocoding**: GPS-Koordinaten → Adresse (für Location-Tracking)
- **Auto-Kategorisierung**: Pelias-Taxonomy mapped OSM-Kategorien auf Places-Kategorien (Restaurant, Café, Park, ...)
- **Fallback**: Wenn `/autocomplete` leer ist → `/search` als Fallback

### Places-Integration

- **Clickable Tracking-Label**: Zeigt die aktuelle Adresse während GPS-Tracking
- **Full Address Display**: Vollständige Adresse statt nur Koordinaten
- **Browser-Proxy**: Geocoding-Requests laufen über den SvelteKit-Proxy (CORS)

### Cross-Module

Geocoding wurde auch in Events, Contacts und Photos integriert — überall wo Orte relevant sind.

### Infra

- Pelias Health über den Wrapper für Monitoring proxied
- libpostal nicht auf Host-Port 4400 binden (Konflikt-Vermeidung)
- Unit-Tests + E2E-Smoke-Test-Script
- Docs: Pelias-Category-Patch + Import-Gotchas

---

## Firsts-Modul — "Erstes Mal"-Tracker

Neues Modul `firsts` für die Dokumentation von "ersten Malen":

- **Dream-to-Lived Tracking**: Träume (aus dem Dreams-Modul) werden zu erlebten Firsts
- **Design-Dokument**: `docs/firsts/` mit Feature-Beschreibung + Datenmodell
- **Fix**: Invalid JS-Comment in CSS-Block entfernt (Build-Blocker)

---

## 215 A11y-Fixes

Commit `b8cd33df7` — der größte Accessibility-Sweep bisher:

Alle 215 `// eslint-disable-next-line` A11y-Suppressions im Code durch echte Fixes ersetzt:

- `on:click` auf non-interactive Elements → `<button>` oder `role="button"` + `tabindex`
- Missing `alt` Texte auf Images
- Missing `aria-label` auf Icon-Buttons
- `<div>` als Click-Handler → semantische HTML-Elemente
- Calendar: Event-Rows als `<button>` statt `<div>` für Keyboard-Navigation

---

## Credits-Vereinfachung

Das Credit-System wurde drastisch vereinfacht:

**Entfernt:**

- Productivity Credits (automatische Credits für App-Nutzung)
- Guild Pools (Team-basierte Credit-Verteilung)
- Komplexe Gift-Types (Multi-Code-Redemption, Conditional Gifts)

**Behalten:**

- Simple Credit-Balance
- Sync-Subscription
- Admin-Gifted Credits/Subscriptions

Die entfernten Features waren over-engineered für den aktuellen Nutzungsumfang. Wenn sie gebraucht werden, können sie als eigene Module zurückkommen statt das Credit-System zu overloaden.

---

## TimeBlocks-Integration für 9 Module

Drei Commits integrieren TimeBlocks in 9 weitere Module:

| Commit     | Module                            |
| ---------- | --------------------------------- |
| `6ee1df39` | Planta, Dreams, Skilltree, Cycles |
| `29ad31c4` | Guides, Places, Cards             |
| `cbfe995f` | Music, Moodlit, Presi             |

Damit können alle diese Module Aktivitäten als TimeBlocks im Calendar anzeigen.

---

## Workbench-Redesign

### Page Cards

Redesign der Workbench Page-Cards:

- **Runde Ecken** statt scharfe Kanten
- **Unified Header**: Konsistenter Header über alle Page-Cards
- **DnD entfernt**: Drag-and-Drop für Page-Reihenfolge war UX-mäßig verwirrend und wurde nie genutzt

### Bottom Bar

`SceneTabs` und `MinimizeTabs` wurden durch eine **unified Bottom Bar** ersetzt — ein Bar für alle Workbench-Navigationsaktionen.

---

## Dev-Experience Fixes

| Fix                          | Detail                                                 |
| ---------------------------- | ------------------------------------------------------ |
| Redis Eviction Policy        | Dev-Startup crashed nicht mehr bei vollem Redis        |
| mana-media Port Crash        | Port-Konflikt beim Restart behoben                     |
| Svelte Warnings              | Warnings beim Dev-Start suppressed                     |
| AZURE_OPENAI_API_KEY Warning | Falscher Warning für lokale Devs ohne Azure            |
| mana-media Dev Startup       | Shortcut für schnelleren Dev-Start                     |
| db:push Reporting            | Ehrliches Reporting ob Schema-Pushes erfolgreich waren |
| Tier-Test-Patch              | Revert des All-Guest-Patches + widen toggleField       |

---

## Sonstige Fixes

| Fix              | Detail                                                   |
| ---------------- | -------------------------------------------------------- |
| Guides Build     | `{@const}` aus `<div>` verschoben (Svelte 5 Build-Error) |
| Guides Export    | Stub GUIDES Export damit Build passt                     |
| as-any Cleanup   | as-any Casts über die Codebase aufgeräumt                |
| spiral-db        | Prepare-Script für spiral-db hinzugefügt                 |
| Locale Typing    | Locale-Types über die Codebase vereinheitlicht           |
| AI Tier Selector | Dropdown in PillNavigation für AI-Tier-Auswahl           |
| Playground       | Persistent Chat History, Token Display, Model Comparison |
| Top-5 ROI        | CI Gate, Auth Fields, Body×TimeBlocks, Sync Pull, Tests  |

---

## Numbers

|                       |                     |
| --------------------- | ------------------- |
| Commits               | 53                  |
| Files changed         | 556                 |
| LOC added             | ~22.510             |
| LOC removed           | ~3.220              |
| Net                   | +19.290             |
| Neue Module           | 2 (Journal, Firsts) |
| A11y-Fixes            | 215                 |
| Module mit TimeBlocks | +9                  |

---

## Lehren

1. **A11y-Suppressions sind technische Schuld**: 215 Suppressions hatten sich über Monate angesammelt. Der Sweep dauerte einen halben Tag — hätte aber viel weniger gedauert wenn jede Suppression sofort gefixt worden wäre. Ab jetzt: Zero-Suppression-Policy.

2. **Self-Hosted Geocoding lohnt sich ab dem dritten Modul**: Für Places allein wäre ein Mapbox-API-Key einfacher. Aber mit Events + Contacts + Photos nutzen vier Module die gleiche Instanz — kein API-Budget, keine Rate-Limits, DSGVO-konform.

3. **Feature-Simplification > Feature-Addition**: Das Credit-System zu vereinfachen war produktiver als neue Credit-Features zu bauen. Weniger Code = weniger Bugs = schnellere Iteration.
