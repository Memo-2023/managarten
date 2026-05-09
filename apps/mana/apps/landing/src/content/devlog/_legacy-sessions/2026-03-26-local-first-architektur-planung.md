---
title: 'Storage-Sprint, Passkeys & 2FA, Cross-App Tags, Quotes-Polish & Local-First Planung'
description: 'Massiver Tag mit 61 Commits: Storage auf ManaScore 87, WebAuthn/Passkeys und TOTP-2FA, Cross-App Tag-System, Quotes-Komplett-Polish, SvelteKit Base-Image, und Local-First Architekturplanung.'
date: 2026-03-26
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'storage',
    'auth',
    'passkeys',
    '2fa',
    'tags',
    'quotes',
    'infrastructure',
    'docker',
    'local-first',
    'architecture',
    'i18n',
    'testing',
  ]
featured: true
commits: 61
readTime: 18
stats:
  filesChanged: 329
  linesAdded: 19553
  linesRemoved: 2838
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 61
workingHours:
  start: '2026-03-26T08:00'
  end: '2026-03-26T22:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).


Massiver Tag mit **61 Commits** über **329 Dateien** und netto **+16.715 Zeilen** — Storage-Sprint, Auth-Features, Tag-System, Quotes-Polish, Infra und Architekturplanung:

- **Storage-App komplett** — Von Score 72 auf 87: Previews, Audio-Player, Skeleton Screens, Sharing, Tagging, i18n, E2E-Tests
- **Auth: Passkeys & 2FA** — WebAuthn/Passkeys und TOTP-2FA in allen Apps, Google/Apple Login entfernt
- **Cross-App Tag-System** — Neues Tag-System mit Gruppen und Entity-Links in 18 Apps integriert
- **Quotes Komplett-Polish** — i18n, Display-Settings, Suche, Filter, Author-Bios, Loading States
- **Local-First Architektur** — Umfassende Planung für Dexie.js + Go Sync-Server + Hono/Bun
- **Infra** — SvelteKit Base-Image, build-app.sh Script, Dockerfile-Fixes

---

## 1. Storage-App: Von 72 auf 87 ManaScore

Massiver Sprint der die Storage-App von einem funktionalen MVP zu einer production-ready Anwendung transformiert hat.

### Datei-Previews

Vollständiges Preview-System für alle gängigen Dateitypen direkt im Browser:

| Dateityp | Preview |
|----------|---------|
| **Audio** | Player mit Frequency-Visualizer (Canvas-basierte Wellenform-Animation) |
| **Video** | Native HTML5 Video Player |
| **PDF** | Eingebetteter Viewer |
| **Text/Code** | Syntax-Highlighting |
| **Markdown** | Gerenderte Ansicht |

### UX-Verbesserungen

- **Skeleton Shimmer Screens** — Loading-Spinner durch animierte Skeleton-Layouts ersetzt
- **SVG Empty State Illustrations** — Eigene SVGs für leere Ordner, Suche, Papierkorb, Favoriten
- **Share Modal** — Dialog zum Erstellen von Share-Links mit Ablaufdatum und Passwort
- **File Tagging** — TagPicker-Komponente für Tags direkt an Dateien
- **Bulk Operations** — Multi-Select mit Shift/Cmd-Klick, Bulk-Delete, Bulk-Move, Bulk-Tag
- **Storage Stats** — Echte Speicher-Nutzung in den Einstellungen

### Backend-Qualität

- **Swagger/OpenAPI Docs** — Vollständige API-Dokumentation
- **Structured Logging** — Pino Logger mit JSON-Output und Request-Tracing
- **i18n** — Französisch, Spanisch und Italienisch hinzugefügt
- **E2E-Tests** — Integration-Tests mit echtem Backend

### Commits

- `2150452a` — Audio Player mit Frequency Visualizer
- `59896521` — Video, PDF, Text/Code, Markdown Preview
- `9f668009` — Skeleton Shimmer Screens
- `56307a3d` — SVG Empty State Illustrations
- `56683876` — ShareModal
- `5c69dc7d` — File Tagging UI
- `a85682d8` — Bulk File Operations
- `9611544f` — Storage Usage Stats
- `8692b082` — Structured Logging (Pino)
- `8b5889e1` — Swagger/OpenAPI
- `a439d5d8` — FR/ES/IT Translations
- `8a1cb2dc` — Integration E2E Tests
- `c681a5d6` — ManaScore auf 87 aktualisiert

---

## 2. Auth: WebAuthn/Passkeys & TOTP-2FA

### Passkeys (WebAuthn)

Komplette WebAuthn/Passkey-Integration für passwortloses Login über alle Apps:

- **PasskeyManager-Komponente** — UI zum Registrieren, Benennen und Löschen von Passkeys
- **Production Config** — Korrektes `rpId` und `origin` für `mana.how`-Domain
- **ManaCore Integration** — PasskeyManager in Settings-Page eingebaut
- **35 Tests** — Controller-Tests für Passkey und 2FA Flows

### TOTP Two-Factor Authentication

- Authenticator-App Setup mit QR-Code und manuellem Secret
- Recovery Codes für Account-Zugang ohne 2FA-Gerät
- Alle Apps zeigen 2FA-Setup in den Security-Settings

### Auth UX & Cleanup

- UX-Verbesserungen für Passkey- und 2FA-Management (`70737561`)
- Rate-Limit-Feedback, Audit-Log UI und E2E-Tests (`0dfd6038`)
- Google/Apple Social Login Code komplett entfernt — Self-Sovereign Auth (`2d11ba62`)

### Commits

- `3091da91` — WebAuthn/Passkey Support
- `c4d55209` — PasskeyManager Komponente + Production Config
- `ac4bacad` — ManaCore Settings Integration
- `f5a9edcf` — TOTP 2FA in allen Apps
- `e0e9ede8` — 35 Controller-Tests
- `70737561` — UX-Improvements
- `0dfd6038` — Rate-Limit, Audit-Log, E2E-Tests
- `2d11ba62` — Social Login entfernt

---

## 3. Cross-App Tag-System

### Architektur

Neues, app-übergreifendes Tag-System mit:

- **Tag-Gruppen** — Kategorisierung von Tags (z.B. "Priorität", "Status", "Thema")
- **Entity-Links** — Tags können an beliebige Entities gehängt werden
- **Farbige Tags** — Jeder Tag hat eine zuweisbare Farbe
- **Backend-Validierung** — FK-Constraints, Token-Validation, Input-Validation, 37 Tests

### Shared Components

- `TagStrip` — Horizontale Tag-Leiste für jede App
- `createTagStore` — Svelte-Store-Factory für Tag-Operationen

### Integration

1. `ce900d5f` — Todo: TagStrip + createTagStore
2. `69aa8378` — Contacts & Calendar: TagStrip + createTagStore
3. `91116bf0` — Alle 15 übrigen Apps: Shared TagStrip

### Backend

- `0c479b3e` — Tag-System mit Gruppen und Entity-Links
- `11ab265d` — FK-Constraints, Token-Validation, Input-Validation
- `4ddff848` — Transaction on Sync, Scroll-Indicator, 37 Backend-Tests

---

## 4. Quotes: Komplett-Polish

Umfassende Qualitätsverbesserungen für die Zitate-App:

| Feature | Commit |
|---------|--------|
| Komplette i18n-Abdeckung aller Seiten | `90e61356` |
| Display-Settings (Schriftgrösse, Layout) | `6107d572` |
| Suche & Sortierung auf Kategorie-Detailseite | `40b55eb6` |
| Category Filter-Chips in Suchergebnissen | `b7d1d2ec` |
| Favorites-Count-Badge + Display-Settings | `7c7e5eb0` |
| Author-Bio auf Zitat-Karten | `1316ef57` |
| Loading States für Listen-Operationen | `96ff16b7` |
| Error-Feedback für stille API-Fehler | `326acf0e` |
| Maxlength-Validation im Listen-Formular | `5bb96dbf` |
| Settings/Spiral/Themes in Account-Dropdown | `08629b80` |
| Tailwind CSS v4 Vite-Plugin Fix | `30a0a651` |

---

## 5. Local-First Architekturplanung

Umfassende Planung für den fundamentalen Umbau der gesamten ManaCore-Plattform:

### Kernentscheidungen

| Aspekt | Aktuell | Ziel |
|--------|---------|------|
| **Datenmodell** | API-First | Local-First (IndexedDB + Sync) |
| **Client-DB** | Keine | Dexie.js (15KB, liveQuery) |
| **Sync** | Kein | Go Sync-Server (100K+ WebSockets) |
| **Backend** | NestJS | Hono auf Bun (14KB, < 50ms Cold Start) |
| **Guest-Mode** | Separater Code | Nebeneffekt der Architektur |
| **Offline** | Read-Only Cache | Voller CRUD |
| **Performance** | 200-500ms API | < 5ms IndexedDB |

### Conflict Resolution

Field-Level Last-Write-Wins statt "ganzes Objekt gewinnt" — zwei Geräte können verschiedene Felder desselben Objekts offline bearbeiten ohne Datenverlust.

### Migrationsplan

5 Phasen über ~12 Wochen: Foundation → Todo-Pilot → Alle Apps → Auth-Migration → Cleanup

Detaillierter Plan: `.claude/plans/local-first-architecture-migration.md`

---

## 6. Infrastructure

### SvelteKit Base Image

Neues `sveltekit-base:local` Docker-Image mit allen Shared Packages vorinstalliert — einzelne App-Builds deutlich schneller.

- `cdfbfcd1` — SvelteKit Base Image + build-app.sh Script
- `ba6b9537` — Container-Namen statt IDs in build-app.sh

### Weitere Fixes

- `e676ba68` — `JSON.stringify` für Env-Var-Injection in allen `hooks.server.ts`
- `9c8bae3d` — NestJS Auth: Multiple JWT-Issuers für Docker/Public URL Mismatch
- `2b0b902b` — Credit-Operations Package Exports auf compiled `dist/` zeigend
- `5a3ee5c7` — Todo Task UI: Priority-Checkboxes, Drag-Styling, Route-Fix
- Diverse Dockerfile-Fixes für Quotes, Storage, Todo (fehlende Dependencies, Node Heap Size)

---

## Zusammenfassung

| Bereich | Änderung |
|---------|----------|
| **Storage** | Score 72 → 87: Previews, Audio-Player, Sharing, Tagging, E2E-Tests, i18n |
| **Auth** | Passkeys + TOTP-2FA in allen Apps, Social Login entfernt, 35+ Tests |
| **Tags** | Cross-App Tag-System in 18 Apps integriert, 37 Backend-Tests |
| **Quotes** | Komplett i18n, Display-Settings, Suche, Filter, Author-Bios |
| **Architektur** | Local-First Planung: Dexie.js + Go Sync + Hono/Bun |
| **Infra** | SvelteKit Base-Image, build-app.sh, Dockerfile-Fixes |
| **Gesamt** | 61 Commits, 329 Dateien, +19.553 / -2.838 Zeilen |
