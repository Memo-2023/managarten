---
title: 'Companion Brain: 7 Phasen in einem Tag + Sleep, Stretch, Recipes, Mail Module'
description: 'Companion Brain komplett aufgebaut: Domain Event Bus, Projection Engine, Goal System, Tool Layer, Companion Chat mit LLM, Ritual System, Semantic Memory, Pattern Extractors, Correlation Engine, 29 Module verdrahtet, 29 Unit-Tests. Plus vier neue Module: Sleep, Stretch, Recipes, Mail.'
date: 2026-04-13
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'companion-brain',
    'domain-events',
    'projections',
    'goals',
    'rituals',
    'semantic-memory',
    'correlation-engine',
    'llm',
    'sleep',
    'stretch',
    'recipes',
    'mail',
    'landing',
  ]
featured: true
commits: 30
readTime: 18
stats:
  filesChanged: 289
  linesAdded: 27160
  linesRemoved: 1394
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 30
workingHours:
  start: '2026-04-13T09:00'
  end: '2026-04-13T23:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Companion Brain** — komplettes AI-Subsystem in 7 Phasen aufgebaut: Event Bus → Projections → Goals → Tools → Chat → Rituals → Memory
- **29 Module** verdrahtet mit Domain Events + Tools
- **29 Unit-Tests** für Event Bus, Tools, Goals, Streaks, Correlations
- **Companion Chat** mit LLM Tool-Calling — der Companion kann jetzt mit dem User sprechen UND handeln
- **4 neue Module**: Sleep, Stretch, Recipes, Mail
- **Landing /features Page** mit Simple/Tech Toggle

---

## Companion Brain — von Null auf Vollständig

Das Companion Brain ist das AI-Subsystem das den Companion befähigt, den Kontext des Users zu verstehen und proaktiv zu handeln. Heute in 7 Phasen von Null auf funktionsfähig gebracht.

### Phase 1: Domain Event Bus

Foundation: ein typisierter Event-Bus der Module-Events emittiert:

```typescript
eventBus.emit({
	type: 'task.completed',
	module: 'todo',
	payload: { taskId, title, completedAt },
	userId,
	timestamp: Date.now(),
});
```

Fünf Pilot-Module verdrahtet: Todo, Habits, Journal, Notes, Contacts. Jedes Modul emittiert Events bei CRUD-Operationen.

### Phase 2: Projection Engine

Aus den rohen Events werden aggregierte Projektionen:

- **DaySnapshot**: Tagesübersicht über alle Module — Aufgaben erledigt, Habits geloggt, Stimmung, Notizen geschrieben
- **Streaks**: Automatische Streak-Erkennung über konsistente Aktionen (z.B. "7 Tage in Folge meditiert")
- **Context Document**: Natürlichsprachliches Dokument das den aktuellen Zustand des Users beschreibt — Input für den Companion Chat

DaySnapshot-Berechnung parallelisiert für bessere Performance. `_activity` Table als veraltet markiert (ersetzt durch Event-basierte Projektionen).

### Phase 3: Goal System + Pulse Rule Engine

- **Goal Editor UI**: Ziele erstellen mit Titel, Beschreibung, Metrik, Deadline
- **Event-driven Incremental Streaks**: Streaks werden inkrementell bei jedem Event aktualisiert statt täglich komplett neu berechnet
- **Pulse Rule Engine**: Regelbasiertes System das auf DaySnapshot-Patterns reagiert
- **Feedback Loop**: Pulse-Ergebnisse fließen in den Context Document zurück

### Phase 4: Tool Layer

Der Companion bekommt LLM-accessible Tools:

```typescript
const tools = [
	{ name: 'list_tasks', handler: () => tasksStore.getAll() },
	{ name: 'complete_task', handler: ({ id }) => tasksStore.complete(id) },
	{ name: 'create_note', handler: ({ title, content }) => notesStore.create({ title, content }) },
	// ...
];
```

Tools sind nach Modulen organisiert. Jedes Tool hat einen JSON-Schema für die LLM-Parameter-Validierung.

### Phase 5: Companion Chat mit LLM Tool-Calling

Der Companion kann jetzt mit dem User chatten UND dabei Tools aufrufen:

- **LLM-Integration**: Chat-Completions über mana-llm mit Tool-Calling
- **Markdown-Rendering**: Companion-Antworten werden als Markdown gerendert
- **Loading-Status + Streaming-Feedback**: Typing-Indicator während der LLM-Antwort
- **Multi-Turn Tool Results**: Companion kann auf vorherige Tool-Ergebnisse zugreifen (Fix: `51c8a528`)
- **Anti-Hallucination**: Companion listet jetzt wirklich Tasks auf statt sie zu halluzinieren (Fix: `77d455a1`)

### Phase 6: Ritual System

Geführte Routinen mit Schritt-für-Schritt-Ausführung:

- **Morning Routine**: Aufstehen → Wasser trinken → Stretchen → Tagesplanung
- **Evening Routine**: Journaling → Mood-Check → Morgen-Vorbereitung
- **Custom Rituals**: Users können eigene Routinen erstellen
- **Step Execution**: Jeder Schritt kann eine Aktion triggern (Timer starten, Habit loggen, ...)

### Phase 7: Semantic Memory + Pattern Extractors + Correlation Engine

Die intelligenteste Schicht:

- **Semantic Memory**: Langzeitgedächtnis des Companions. Extrahiert Facts aus Interaktionen und Events
- **Pattern Extractors**: Erkennt wiederkehrende Muster (z.B. "User ist montags produktiver", "Kaffee korreliert mit besserer Stimmung")
- **Correlation Engine**: Korreliert Cross-Module-Daten statistisch (Sleep-Qualität × Produktivität, Meditation × Mood, ...)

### Domain Events + Tools: 29 Module verdrahtet

In vier Commits wurden alle restlichen Module verdrahtet:

| Commit     | Module                                  |
| ---------- | --------------------------------------- |
| `c51382a7` | Habits, Journal, Notes, Contacts, Body  |
| `7752ba9f` | Finance, Dreams, Cards, Times, Events   |
| `c7de8628` | Music, Storage, Chat, Memoro, Skilltree |
| `c95aaa4d` | Remaining 9 Module                      |

### Workbench Pages

4 neue Companion-Brain-Pages im Workbench:

- Brain Overview (DaySnapshot + Streaks)
- Goals
- Rituals
- Memory Explorer

### Tests + Docs

- **29 Unit-Tests**: Event Bus emit/subscribe, Tool execution, Goal increments, Streak calculation, Correlation math
- **Companion-Page Fix**: Schema-Version + Query-Robustness (Page renderte nicht wegen eines Dexie-Schema-Mismatch)
- **Architecture-Docs**: Phase 5-7 Completion + Testing Guide
- **Comprehensive Status Update**: 29 Module, TODOs, Architecture Review

### AI Tier + Observability

- **AI Tier Selector**: In der Companion Chat Toolbar kann der User den AI-Tier wählen
- **Observability**: Chat + Tool Events werden für Monitoring emittiert
- **NudgeToast**: Proaktive Hinweise des Companions als Toast-Notification
- **Server LLM Fallback**: Wenn lokales LLM nicht verfügbar → Fallback auf Server-LLM
- **Trigger-Event Bridge**: Domain Events können NudgeToasts triggern

### Brain → LlmOrchestrator Migration

Der Companion-Engine wurde auf den **LlmOrchestrator** (4-Tier-System: Browser → Server → Cloud → BYOK) migriert. Damit nutzt der Companion das gleiche Tier-System wie alle anderen AI-Features.

---

## Vier neue Module

### Sleep-Modul

Schlaf-Tracking mit drei Kernfeatures:

- **Sleep-Tracking**: Schlafzeiten, Schlafqualität (1-5), Aufwach-Events
- **Hygiene-Checklists**: Vor-Schlaf-Routine (Bildschirm aus, Temperatur, ...)
- **Stats**: Durchschnittliche Schlafdauer, Qualitäts-Trend, Best/Worst-Nächte

### Stretch-Modul

Dehn-Übungen mit geführten Routinen:

- **Guided Routines**: Vordefinierte Routinen (Morgen-Stretch, Nach-Sitzen, Post-Workout)
- **Assessment**: Flexibilitäts-Assessment pro Körperregion
- **Reminders**: Erinnerungen nach X Stunden Sitzen (via TimeBlocks-Integration)

### Recipes-Modul

Rezepte-Sammlung mit Local-First-Data:

- **Encryption**: Rezepte verschlüsselt gespeichert
- **Card UI**: Rezepte als Cards mit Bild, Zutaten, Anleitung
- **Tagging**: Kategorisierung via Tags (vegetarisch, schnell, Dessert, ...)

### Mail-Modul (Phase 1 MVP)

mana-mail Service + Frontend:

- **mana-mail Service**: Hono/Bun auf Port 3042, eigenes DB-Schema
- **Frontend**: Basic Inbox-UI mit Message-List
- **Infra**: Port-Assignment, pnpm install, DB-Schema-Setup
- **TODO-Checklist**: Phase 1-4 Remaining Work dokumentiert

---

## Landing: /features Page

Neue Feature-Übersichtsseite auf der Astro-Landing:

- **Simple/Tech Toggle**: Besucher wählen zwischen einfacher und technischer Erklärung
- **Style-Refinements**:
  - Star-Ratings → fließender Text-Summary
  - Flow-Links → Underline statt Pills (subtiler)
  - Generic Tool-Categories statt Brand-Namen

---

## Workbench-Verbesserungen

- **Fullscreen**: Verbesserter Fullscreen-Modus
- **Scene Bar Styling**: Konsistentere Farben
- **Inline Scene Creation**: Neue Szenen direkt im Workbench erstellen

---

## Numbers

|                          |                                   |
| ------------------------ | --------------------------------- |
| Commits                  | 30                                |
| Files changed            | 289                               |
| LOC added                | ~27.160                           |
| LOC removed              | ~1.394                            |
| Net                      | +25.766                           |
| Neue Module              | 4 (Sleep, Stretch, Recipes, Mail) |
| Companion Brain Phasen   | 7                                 |
| Module mit Domain Events | 29                                |
| Unit-Tests               | 29                                |

---

## Lehren

1. **Event-Driven > Polling**: Der Domain Event Bus macht den Companion reaktiv statt periodisch. Events fließen in Echtzeit in Projektionen → der Companion hat immer den aktuellen Stand.

2. **Incremental Streaks > Full Recompute**: Streaks bei jedem Event inkrementell zu aktualisieren ist O(1) statt O(n). Bei 365 Tagen Journal-Einträgen macht das einen echten Unterschied.

3. **LLM Tool-Calling braucht Anti-Hallucination**: Der Companion halluzinierte anfangs Task-Listen statt die `list_tasks`-Tool zu benutzen. Explizite Tool-Routing + Validation-Layer waren nötig.

4. **Correlation ≠ Causation — aber der User soll es sehen**: Die Correlation Engine zeigt Korrelationen, nicht Kausalitäten. Das ist explizit so designed — der User interpretiert, der Companion präsentiert.
