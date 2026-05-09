---
title: 'TimeBlocks: ein Zeitmodell für alles + Mana Rename + PWA'
description: 'TimeBlocks vereinheitlicht Calendar/Habits/Tasks/Focus zu einem Zeitmodell mit rrule.js. Mukke wird zu Music. ManaCore wird zu Mana. PWA-Support inkl. Offline-UX und Update-Prompt für alle Module.'
date: 2026-04-05
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'timeblocks',
    'calendar',
    'habits',
    'rrule',
    'pwa',
    'offline',
    'mobile',
    'rename',
    'mana',
    'mukke',
    'music',
  ]
featured: true
commits: 19
readTime: 11
stats:
  filesChanged: 2244
  linesAdded: 15083
  linesRemoved: 11360
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 19
workingHours:
  start: '2026-04-05T14:39'
  end: '2026-04-05T21:14'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **TimeBlocks** als unified time model — Calendar, Habits, Tasks, Focus-Mode teilen sich eine Tabelle
- **rrule.js** als zentrale Recurrence-Engine, mit Edit-this/all/following Prompts
- **PWA** für die unified app — Offline-UX, Update-Prompt, Icons, mobile Responsiveness in allen Modulen
- **Rename**: ManaCore → **Mana** (final), Mukke → **Music**
- **Cross-Module DnD ins Calendar** — Tasks/Habits droppen wird zum TimeBlock
- **Calendar Type-Specific Styling** — verschiedene Block-Types haben verschiedene Visuals
- **iCal Export** + Analytics-Dashboard für TimeBlocks
- **"Mein Tag" Timeline-Widget** auf dem Dashboard

---

## TimeBlocks: Ein Zeitmodell für alles

Bisher hatten Calendar, Habits, Todo-Scheduling und der (geplante) Focus-Mode jeweils ihr eigenes Zeitmodell. Drei Tabellen, drei Recurrence-Implementierungen, drei UIs.

### Eine `timeBlocks` Tabelle

```typescript
type TimeBlock = {
	id: string;
	type: 'event' | 'habit' | 'task' | 'focus' | 'meal' | 'sleep';
	title: string;
	start: Date;
	end: Date;
	rrule?: string; // RFC 5545
	refModule?: string; // 'todo' | 'habits' | 'memoro' | …
	refId?: string; // ID im Quell-Modul
	color?: string;
	status?: 'planned' | 'done' | 'skipped' | 'missed';
};
```

Jeder Calendar-Event, jede Habit-Schedule, jede Task-Due-Date Kombination, jede Focus-Session, jede Schlaf-/Mahlzeit-Erfassung ist jetzt ein TimeBlock.

### `rrule.js` als Recurrence-Engine

Statt drei selbstgebauter Recurrence-Implementierungen jetzt **eine Library**:

```typescript
import { RRule } from 'rrule';

const block = {
	rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12',
};

// Expand für Anzeige
const occurrences = RRule.fromString(block.rrule).between(viewStart, viewEnd);
```

### Custom Recurrence UI

Vorher: Dropdown mit "Daily / Weekly / Monthly". Jetzt:

```
┌──────────────────────────────────┐
│  Wiederholt sich                 │
│  ⚪ Nie                          │
│  ⚪ Täglich                      │
│  ⚪ Wöchentlich am [Mo Mi Fr]    │
│  ⚫ Benutzerdefiniert            │
│      Alle [2] [Wochen]           │
│      Am [Mo] [Mi] [Fr]           │
│      Bis [15. Mai 2026]          │
└──────────────────────────────────┘
```

### Edit/Delete Prompts

Wenn man einen rezidivierenden Block ändert kommt jetzt ein Prompt:

```
┌─────────────────────────────────┐
│ Diese Wiederholung bearbeiten?  │
│  • Nur diesen Termin            │
│  • Diesen und folgende          │
│  • Alle Termine                 │
└─────────────────────────────────┘
```

Die Logik: bei "nur diesen" wird der Block aus der RRule **exdatet** und als Standalone-Block neu angelegt. Bei "folgende" wird der ursprüngliche Block am gewählten Datum **truncated** und ein neuer mit der angepassten Definition ab dem Datum erstellt.

### Habits-Migration

Habits hatten bisher ihre eigene `habitSchedules` Tabelle. Heute migriert auf TimeBlocks:

```
habit.schedule = TimeBlock {
  type: 'habit',
  refModule: 'habits',
  refId: habitId,
  rrule: 'FREQ=DAILY',
}

habit.entry = TimeBlock {
  type: 'habit',
  refId: habitId,
  start, end,
  status: 'done' | 'skipped',
}
```

### Calendar-Type-Specific Styling

Im Calendar werden TimeBlocks je nach `type` unterschiedlich dargestellt:

- **event** — gefüllter Block in Module-Color
- **habit** — Block mit gestricheltem Border
- **task** — Block mit Checkbox-Indicator
- **focus** — opaker Block mit Schloss-Icon
- **sleep / meal** — kleinere "Tag" am Rand

Plus: Filter-UI um Block-Types ein-/auszuschalten, Cross-Module-Navigation (Klick auf Habit-Block → öffnet Habit-Detail).

---

## TimeBlocks: Phasenrolle

Heute kamen viele Features in einem Rutsch — der Reihe nach:

| Feature                 | Beschreibung                                                                 |
| ----------------------- | ---------------------------------------------------------------------------- |
| Unified Time Model      | `timeBlocks` Tabelle, Migration der bestehenden Daten                        |
| External Item Drag      | Tasks aus der Todo-Liste droppen → wird Task-TimeBlock                       |
| Conflict Detection      | Überlappende Blöcke werden visuell markiert + Warnung                        |
| Plan vs Reality         | TimeBlock hat optional einen `actualStart` / `actualEnd` (für Time-Tracking) |
| Timeline View           | Vertikale Tagesansicht mit gegenwärtiger Zeit-Linie                          |
| Focus Mode              | TimeBlocks vom Type `focus` blockieren Notifications & Distractions          |
| Habit Scheduling        | Habits werden direkt im Calendar geplant                                     |
| Smart Slots             | "Wo passt 30min für Sport?" — leerer Slot-Detection                          |
| Multi-Type Quick-Create | Floating-Action: erstellt event/task/habit/focus aus einem Menü              |
| Analytics Dashboard     | Wie viele Stunden in welchem Type, Plan vs Reality                           |
| iCal Export             | Standard-konformer .ics Download je User/View                                |
| Cross-Module DnD        | Items aus jedem Modul → Calendar als TimeBlock                               |
| Activity Feed Widget    | Dashboard-Widget zeigt die letzten N TimeBlocks                              |
| "Mein Tag" Widget       | Dashboard zeigt die heutige Timeline mit aktueller Position                  |

### CalendarEventsWidget update

Das alte Dashboard-Widget las aus der `events` Tabelle. Heute auf TimeBlocks umgestellt — zeigt jetzt auch Habits, Tasks, Focus-Sessions die heute anstehen.

---

## Rename: ManaCore → Mana

Der Code-Name "ManaCore" hatte seinen Zweck erfüllt — es ist Zeit für den finalen Markennamen.

### Was sich ändert

- **App-Domain bleibt**: `mana.how`
- **Code-Name**: `ManaCore` → `Mana`
- **Pfade**: `apps/manacore/` → `apps/mana/`
- **Packages**: `@manacore/*` → `@mana/*`
- **Workspace-Configs**, Docker-Compose Service-Names, Env-Vars, CI-Pipelines

### Was schiefgehen kann

Ein Rename quer durchs Monorepo ist immer riskant. Heute waren die Folge-Bugs:

- **Type errors** in Templates und Stale-Referenzen
- **Duplicate `manaSvg`** in shared-branding (Rename-Collision mit existierendem `manaSvg`)
- **Type-Extraction aus `.svelte`** Dateien für named re-exports
- **Eslint OOM** — Heap auf 8 GB hochgesetzt damit der Lint nicht vorzeitig stirbt

Plus: Mukke heißt jetzt **Music**. Cleaner Name, weniger Insider, plus Cover-Art-Upload via mana-media (passt zum gestrigen Refactor).

---

## PWA-Support für die Unified App

Ziel: Mana läuft als installierbare PWA auf Mobile, mit Offline-Fallback und Update-Prompt.

### Was heute live ist

| Feature            | Detail                                                 |
| ------------------ | ------------------------------------------------------ |
| **Service Worker** | Caches Shell + Modul-Routes, Network-First für Daten   |
| **Offline-Page**   | `/offline` mit Hinweis + Retry-Button                  |
| **Update-Prompt**  | Toast wenn neue Version verfügbar — 1 Click Reload     |
| **Icons**          | maskable + apple-touch-icon, alle Größen               |
| **Manifest**       | Standalone-Display, Theme-Color, Shortcuts in 5 Module |
| **Install-Prompt** | "Mana installieren" Banner für Erst-User               |

### Mobile Responsiveness komplett

Alle Module + alle shared-Components heute auf Mobile getestet:

- **PageShell** kollabiert auf Mobile in Single-Column
- **Workbench Pages** stacken vertikal
- **PillNav** schrumpft auf Icon-Only
- **Detail-Overlays** werden full-screen
- **Tag-Strip** scrollt horizontal
- **Bottom-Stack** respektiert Safe-Area-Insets

### PWA-Phase im Tauri-v2-Plan abgehakt

Der Tauri-v2-Plan hatte PWA als Vorstufe. Heute komplett — der nächste Schritt (native Tauri-Wrapper) kann beginnen.

---

## Sonstige Fixes

| Fix                 | Detail                                        |
| ------------------- | --------------------------------------------- |
| Calendar `WeekView` | Duplicate `calendarViewStore` Import entfernt |

---

## Zusammenfassung

| Bereich         | Commits | Highlights                                                                       |
| --------------- | ------- | -------------------------------------------------------------------------------- |
| TimeBlocks      | ~10     | Unified time model, rrule.js, focus mode, smart slots, timeline, iCal, analytics |
| ManaCore → Mana | ~3      | Globaler Rename, type-fixes, eslint OOM-bump                                     |
| PWA + Mobile    | ~3      | Service Worker, offline, update prompt, mobile responsive in allen Modulen       |
| Mukke → Music   | ~2      | Rename + cover art via mana-media                                                |
| Dashboard       | ~1      | "Mein Tag" Timeline-Widget                                                       |

---

## Nächste Schritte

- TimeBlocks Sharing (TimeBlocks aus shared Calendar)
- Smart-Slot-Suggestions für Habits-Scheduling intelligenter
- Sprint 1 der Data-Layer-Audit-Backlog (LWW + Atomic Cascades)
- Encryption-Roadmap der user-typed Felder
