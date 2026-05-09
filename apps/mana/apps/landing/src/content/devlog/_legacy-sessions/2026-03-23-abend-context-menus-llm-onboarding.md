---
title: 'Context Menus Everywhere, Shared LLM Package, Onboarding & Todo Redesign'
description: 'Shared ContextMenu-Component in 12 Apps integriert, neues @manacore/shared-llm Package für alle Backends, Onboarding für 16 Apps, Todo-App komplett überarbeitet mit Notepad-Design und Auto-Save.'
date: 2026-03-23
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'context-menu',
    'shared-ui',
    'llm',
    'gemini',
    'onboarding',
    'todo',
    'quickinputbar',
    'dashboard',
    'ux',
    'refactoring',
    'testing',
  ]
featured: true
commits: 27
readTime: 12
stats:
  filesChanged: 180
  linesAdded: 10064
  linesRemoved: 2830
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 27
workingHours:
  start: '2026-03-23T14:00'
  end: '2026-03-23T23:30'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Intensive Abend-Session mit **27 Commits** über **180 Dateien** und netto **+7.234 Zeilen**:

- **Context Menus Everywhere** - Shared `ContextMenu`-Component aus `@manacore/shared-ui` in 12 Apps integriert
- **Shared LLM Package** - Neues `@manacore/shared-llm` Package mit Google Gemini Fallback für alle Backends
- **Onboarding** - App-Onboarding für 6 neue Apps + Feature-Intro-Step für alle 16 Apps
- **Todo Redesign** - Komplett neues Notepad-Design, Auto-Save, vereinheitlichte Filter, Skeleton Loader
- **QuickInputBar** - In 6 weitere Apps integriert mit Locale-Support und Deferred Search
- **Dashboard Widgets** - Neue Widgets für Mukke, Presi und Context

---

## 1. Context Menus: Shared Component in 12 Apps

Das bestehende `ContextMenu`-Component aus `@manacore/shared-ui` wurde systematisch in alle Apps integriert, die bisher kein Rechtsklick-Menü hatten. Vorher nutzten nur Contacts (Alphabet-Nav) und Mukke (Library) das shared Component.

### Rollout-Übersicht

| App          | Komponente       | Aktionen                                                         | Commit     |
| ------------ | ---------------- | ---------------------------------------------------------------- | ---------- |
| **Todo**     | TaskList         | Bearbeiten, Complete, Priorität, Projekt verschieben, Löschen    | `0893e47a` |
| **Calendar** | WeekView Events  | Bearbeiten, Duplizieren, Löschen (i18n: DE/EN/FR/ES/IT)          | `e7bf58c5` |
| **Presi**    | Deck-Karten      | Öffnen, Löschen                                                  | `28286d12` |
| **Cards**    | Deck-Karten      | Öffnen, Löschen                                                  | `28286d12` |
| **Photos**   | PhotoGrid        | Anzeigen, Favorit toggle, Löschen                                | `28286d12` |
| **Photos**   | AlbumGrid        | Öffnen, Löschen                                                  | `28286d12` |
| **Quotes**   | Favoriten        | Aus Favoriten entfernen, Kopieren, Teilen                        | `28286d12` |
| **Calendar** | AgendaView       | Bearbeiten, Duplizieren, Löschen                                 | `ecda4535` |
| **Chat**     | ConversationList | Umbenennen, Archivieren, Löschen                                 | `ecda4535` |
| **Contacts** | ContactGridView  | Öffnen, Favorit, Anrufen, E-Mail, Löschen                        | `ecda4535` |
| **Storage**  | FileCard         | Herunterladen, Umbenennen, Teilen, Favorit, Verschieben, Löschen | `ecda4535` |

### Implementierungsmuster

Alle Implementierungen folgen dem gleichen Pattern:

```typescript
import { ContextMenu, type ContextMenuItem } from '@manacore/shared-ui';

let contextMenuVisible = $state(false);
let contextMenuX = $state(0);
let contextMenuY = $state(0);
let contextMenuTarget = $state<TargetType | null>(null);

function handleContextMenu(e: MouseEvent, target: TargetType) {
	e.preventDefault();
	e.stopPropagation();
	contextMenuX = e.clientX;
	contextMenuY = e.clientY;
	contextMenuTarget = target;
	contextMenuVisible = true;
}
```

### Besonderheiten

- **Calendar**: i18n-Keys für alle 5 Sprachen (DE, EN, FR, ES, IT) angelegt und in WeekView und AgendaView wiederverwendet
- **Storage**: Das bestehende custom Dropdown-Menü wurde durch das shared ContextMenu ersetzt — gleiche Aktionen, konsistentes Look & Feel
- **Todo**: Dynamische Projekt-Verschiebung — das Menü zeigt alle aktiven Projekte + Inbox
- **Contacts**: Anrufen/E-Mail-Optionen werden automatisch disabled wenn keine Telefonnummer/E-Mail vorhanden
- **Photos**: `deletePhoto`-Methode im Store neu implementiert für die Context-Menu-Aktion

---

## 2. Shared LLM Package: `@manacore/shared-llm`

Neues monorepo-weites Package, das die LLM-Integration für alle Backends vereinheitlicht. Statt dass jeder Backend-Service seine eigene AI-Integration pflegt, gibt es jetzt eine zentrale Abstraktion.

### Architektur

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Chat Backend │  │ Quotes Backend│  │ Planta Backend│
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────────────────────────────────────────┐
│            @manacore/shared-llm                  │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │ mana-llm│  │ Ollama   │  │ Google Gemini   │ │
│  │ (lokal) │  │ (direkt) │  │ (Cloud Fallback)│ │
│  └─────────┘  └──────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Migration

**48 Dateien geändert**, +2.477 / -1.298 Zeilen. Alle Backends migriert:

- `@chat/backend` — Chat AI-Completions
- `@quotes/backend` — Zitat-Analyse (vorher eigener Ollama-Service)
- `@planta/backend` — Pflanzen-Vision-Analyse
- `@food/backend` — Ernährungs-Analyse (Gemini)
- `mana-core-auth` — AI-Service für Auth-Features

### Google Gemini Fallback

Neuer Gemini-Provider als Cloud-Fallback wenn lokale Modelle nicht verfügbar sind:

```typescript
// Auto-Routing: Lokal → Cloud Fallback
const result = await llmService.generate({
	prompt: 'Analysiere dieses Bild',
	image: base64Image,
	preferLocal: true, // Versucht zuerst mana-llm/Ollama
});
```

---

## 3. Onboarding für 16 Apps

Onboarding-Flows für 6 neue Apps hinzugefügt und einen Feature-Intro-Step in alle 16 Apps integriert. **35 Dateien**, +872 Zeilen.

### Neue Onboarding-Apps

Die `@manacore/shared-app-onboarding` Komponente wurde in 6 weitere Apps integriert, die bisher keinen Onboarding-Flow hatten.

### Feature-Intro-Step

Alle 16 Apps zeigen jetzt beim ersten Start einen Feature-Intro-Step, der die wichtigsten Funktionen der jeweiligen App erklärt.

---

## 4. Todo-App: Komplettes Redesign

Die Todo-App wurde in dieser Session massiv überarbeitet — vom visuellen Design über die Filter bis hin zu Auto-Save.

### Notepad-Design (3 Commits)

Komplett neues Design für die Task-Liste im Stil eines physischen Notizblocks:

- Papier-ähnlicher Hintergrund mit subtiler Textur
- Linierte Zeilen als visuelle Führung
- Drag-Handle, Priority-Dot, Checkbox und Expand-Button inline
- Clean, minimalistisches Design

### Auto-Save

Save- und Cancel-Buttons entfernt. Tasks werden jetzt automatisch gespeichert mit 500ms Debounce nach jeder Änderung. Initializer-Flag verhindert unnötige Saves beim Öffnen des Edit-Formulars.

### Unified TaskFilters

`FilterStrip` und `KanbanFilters` zu einer einheitlichen `TaskFilters`-Komponente zusammengeführt:

- **841 Zeilen** neuer Code, **761 Zeilen** alter Code entfernt
- Beide Views (Liste und Kanban) nutzen jetzt denselben Filter-State
- Filter-State im `viewStore` zentralisiert

### Tests

371 neue Testzeilen für die vereinheitlichten TaskFilters und den viewStore Filter-State.

### Skeleton Loader & UI Polish

- Pixel-perfekte Skeleton Loader für Tasks, Kanban-Spalten und Statistiken
- PillNav mit Tab-Group-Semantik
- SSR Head-Fix für korrekte Seitentitel

---

## 5. QuickInputBar: 6 Weitere Apps

Die `QuickInputBar`-Komponente wurde in 6 weitere Apps integriert:

| App        | Zweck               |
| ---------- | ------------------- |
| **Mukke**  | Song-Suche          |
| **Matrix** | Room/Chat-Suche     |
| **Cards**  | Deck-Suche          |
| **Planta** | Pflanzen-Suche      |
| **Photos** | Foto-Suche          |
| **Presi**  | Präsentations-Suche |

### Shared-UI Verbesserungen

- **Locale-aware Highlighting**: Suchbegriffe werden korrekt hervorgehoben, auch bei Umlauten und Sonderzeichen
- **Success Feedback**: Visuelles Feedback nach erfolgreicher Eingabe
- **Deferred Search Mode**: Suche wird erst nach Bestätigung ausgelöst (nicht bei jedem Tastendruck)

---

## 6. Dashboard Widgets

### Neue Widgets

Drei neue Dashboard-Widgets für die ManaCore-Startseite:

| Widget      | Features                                      |
| ----------- | --------------------------------------------- |
| **Mukke**   | Aktuelle Songs, Play-Count, Lieblingsgenres   |
| **Presi**   | Anzahl Decks, letzte Bearbeitung, Slide-Count |
| **Context** | Dokument-Übersicht, Spaces, letzte Aktivität  |

### Fixes

- Alle Dashboard-Widgets nutzen jetzt `APP_URLS` aus `@manacore/shared-branding` statt hardcodierter `localhost`-URLs
- Todo-Widgets verbessert mit korrektem Port-Mapping
- Test-Mock für Todo-Service an neuen Task-Type angepasst

---

## 7. Bugfixes

| Fix            | Beschreibung                                          |
| -------------- | ----------------------------------------------------- |
| `contacts-web` | `spiral-db` zum Dockerfile hinzugefügt                |
| `contacts-web` | `shared-app-onboarding` zum Dockerfile hinzugefügt    |
| `contacts-web` | `shared-pwa` Package zum Dockerfile hinzugefügt       |
| `contacts-web` | `patches`-Verzeichnis zum Dockerfile für pnpm install |
| `manacore`     | Hardcodierte localhost-URLs durch APP_URLS ersetzt    |
| `manacore`     | Todo Service Test-Mock an neuen Task-Type angepasst   |

---

## Zusammenfassung

| Bereich       | Commits | Highlights                                          |
| ------------- | ------- | --------------------------------------------------- |
| Context Menus | 4       | 12 Apps mit shared ContextMenu, konsistentes UX     |
| Shared LLM    | 2       | Neues Package, Gemini Fallback, 5 Backends migriert |
| Onboarding    | 1       | 6 neue Apps, Feature-Intro für alle 16              |
| Todo Redesign | 7       | Notepad-Design, Auto-Save, Unified Filters, Tests   |
| QuickInputBar | 4       | 6 Apps, Locale-Highlighting, Deferred Search        |
| Dashboard     | 3       | Mukke/Presi/Context Widgets, APP_URLS Fix           |
| Bugfixes      | 6       | Dockerfile-Fixes, Test-Mocks                        |
| **Gesamt**    | **27**  | **180 Dateien, +10.064 / -2.830 Zeilen**            |

## Nächste Schritte

1. **Context Menu Migration** — Picture-App und Todo-Kanban von custom auf shared ContextMenu migrieren
2. **Shared LLM Tests** — Unit-Tests für das neue `@manacore/shared-llm` Package
3. **Onboarding Analytics** — Tracking welche Onboarding-Steps übersprungen werden
4. **Todo Mobile** — Notepad-Design und Auto-Save auf die Expo-App übertragen
5. **Dashboard** — Verbleibende Apps (Calendar, Photos, Storage) als Widgets hinzufügen
