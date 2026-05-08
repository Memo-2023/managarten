# Mana Companion Brain — Architecture & Implementation Plan

> Vollstaendiger Umbau-Plan fuer ein zentrales Intelligenz-System ueber alle Module.
> Start mit 5 Pilot-Modulen: **Todo, Calendar, Drink, Food, Places**.
> Stand: April 2026

---

## 1. Vision

Mana hat 40+ Module, die isoliert arbeiten. Der Companion Brain verbindet sie zu einem System, das den Nutzer proaktiv begleitet — erinnert, motiviert, Muster erkennt und Zusammenhaenge zwischen Modulen herstellt. Alles lokal, privacy-first.

**Drei Saeulen:**
1. **Pulse** — Regelbasierte Nudges & Tageszusammenfassungen (kein LLM)
2. **Rituale** — Gefuehrte Routinen die Daten in Module schreiben (AI-generiert)
3. **Companion Chat** — LLM mit Tool-Zugriff auf alle Module

**Fundament:**
- Domain Event Bus (semantische Events statt CRUD-Logs)
- Projection Engine (live-reaktive Aggregation ueber alle Module)
- Goal System (moduluebergreifende Ziele mit Fortschritt)
- Semantic Memory (extrahiertes Nutzerwissen, persistent)
- Tool Layer (standardisierter LLM-Zugriff auf Module)
- Feedback Loop (Nudge-Outcomes fuer Lernfaehigkeit)

---

## 2. Architektur-Uebersicht

```
+---------------------------------------------------+
|                  MODULE LAYER                      |
|  Todo - Calendar - Drink - Food - Places       |
|  Jedes Modul emittiert Domain Events via Stores    |
+------------------------+--------------------------+
                         | emit()
                         v
+---------------------------------------------------+
|                  EVENT BUS                         |
|  Typed, synchron, in-process                       |
|  TaskCompleted - DrinkLogged - EventCreated ...    |
+--+--------+--------+--------+--------+-----------+
   |        |        |        |        |
   v        v        v        v        v
+------+ +------+ +------+ +------+ +------+
|Event | |State | |Proj. | |Rule  | |Trig- |
|Store | |Write | |Engine| |Engine| |gers  |
|      | |Dexie | |      | |      | |      |
+------+ +------+ +--+---+ +--+---+ +------+
                      |        |
           +----------+--------+----------+
           v          v        v          v
+---------------------------------------------------+
|              INTELLIGENCE LAYER                    |
|                                                    |
| +------------+ +----------+ +-------+ +--------+  |
| |Projections | | Memory   | | Goals | |Feedback|  |
| |DaySnapshot | | Patterns | | Meter | | Loop   |  |
| |Streaks     | | Prefs    | | Track | | Nudge  |  |
| |Correlations| | Context  | | Link  | | Outcome|  |
| +-----+------+ +----+-----+ +---+---+ +---+----+  |
|       |              |           |         |       |
|       +--------------+-----------+---------+       |
|                      v                             |
|           Context Document Generator               |
|           (~500 Token Nutzer-Snapshot)              |
+------------------------+--------------------------+
                         |
                         v
+---------------------------------------------------+
|              INTERACTION LAYER                     |
|                                                    |
| +----------+ +----------+ +---------+ +---------+  |
| |  Pulse   | | Rituale  | |Companion| |Insights |  |
| |  Engine  | | (AI-gen) | |  Chat   | | Cards   |  |
| | regelb.  | |          | |LLM+Tool | |         |  |
| +----------+ +----------+ +---------+ +---------+  |
|                                                    |
|  Feedback: Nudge -> Outcome -> Memory Update       |
+---------------------------------------------------+
```

---

## 3. Domain Event System

### 3.1 Warum Domain Events statt CRUD-Logs

Aktuell loggt `_activity` nur `{ op: 'update', collection: 'tasks', recordId }`. Daraus laesst sich nicht ableiten, **was** passiert ist. Wurde der Task erledigt? Umbenannt? Verschoben? Das erzwingt Archaeologie — Felder vergleichen, Semantik raten.

Domain Events tragen Bedeutung: `TaskCompleted { taskId, title, project }` ist sofort verstaendlich fuer Projections, Rules, LLM und Mensch.

### 3.2 Event Bus Interface

**Neues File: `apps/mana/apps/web/src/lib/data/events/event-bus.ts`**

```typescript
// ── Core Types ──────────────────────────────────────

export interface DomainEvent<T extends string = string, P = unknown> {
  type: T;
  payload: P;
  meta: EventMeta;
}

export interface EventMeta {
  id: string;            // crypto.randomUUID()
  timestamp: string;     // ISO
  appId: string;         // source module
  collection: string;    // source table
  recordId: string;      // affected record
  userId: string;        // from getEffectiveUserId()
  causedBy?: string;     // parent event id (for trigger chains)
}

// ── Bus Interface ───────────────────────────────────

export type EventHandler<E extends DomainEvent = DomainEvent> = (event: E) => void;

export interface EventBus {
  emit(event: DomainEvent): void;
  on<T extends string>(type: T, handler: EventHandler): () => void;
  onAny(handler: EventHandler): () => void;
  off(type: string, handler: EventHandler): void;
}
```

**Implementierung:** Einfacher synchroner Dispatcher mit async Subscribers.
- `emit()` ist synchron (blockiert Dexie-Hook nicht)
- Handlers laufen in `queueMicrotask()` — nach dem Hook, aber vor dem naechsten Frame
- Guard gegen Endlos-Loops: `_emitting` Set verhindert re-entrant emits vom selben Event-Typ

```typescript
export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<EventHandler>>();
  const anyHandlers = new Set<EventHandler>();

  return {
    emit(event: DomainEvent) {
      queueMicrotask(() => {
        const typeHandlers = handlers.get(event.type);
        if (typeHandlers) {
          for (const h of typeHandlers) h(event);
        }
        for (const h of anyHandlers) h(event);
      });
    },

    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
      return () => handlers.get(type)?.delete(handler);
    },

    onAny(handler) {
      anyHandlers.add(handler);
      return () => anyHandlers.delete(handler);
    },

    off(type, handler) {
      handlers.get(type)?.delete(handler);
    },
  };
}

// Singleton
export const eventBus = createEventBus();
```

### 3.3 Event Store

Ersetzt die `_activity`-Tabelle als primaere Quelle fuer "was ist passiert".

**Neue Dexie-Tabelle `_events`:**
```
_events: '++seq, meta.id, meta.type, meta.appId, meta.timestamp,
          [meta.appId+meta.timestamp], [meta.type+meta.timestamp]'
```

Felder:
- `seq` — Auto-increment (Reihenfolge-Garantie)
- `type` — Domain Event Type (z.B. 'TaskCompleted')
- `payload` — Serialisiertes Event-Payload (verschluesselt fuer sensitive Felder)
- `meta` — EventMeta Objekt

**Retention:** 90 Tage (wie `_activity`), max 50.000 Events. Pruning via bestehender Quota-Recovery.

**Subscriber:** `eventBus.onAny()` schreibt jedes Event in `_events`.

### 3.4 Domain Events pro Modul (5 Pilot-Module)

#### Todo Events

| Event | Payload | Abgeleitet aus |
|-------|---------|----------------|
| `TaskCreated` | `{ taskId, title, dueDate?, priority?, projectId?, labelIds? }` | `tasksStore.createTask()` |
| `TaskCompleted` | `{ taskId, title, projectId?, wasOverdue: boolean }` | `tasksStore.completeTask()` |
| `TaskUncompleted` | `{ taskId, title }` | `tasksStore.uncompleteTask()` |
| `TaskUpdated` | `{ taskId, fields: string[] }` | `tasksStore.updateTask()` |
| `TaskDeleted` | `{ taskId, title }` | `tasksStore.deleteTask()` |
| `TaskRescheduled` | `{ taskId, title, oldDate?, newDate }` | `updateTask` wenn `dueDate` aendert |
| `SubtasksUpdated` | `{ taskId, total, completed }` | `tasksStore.updateSubtasks()` |
| `ReminderSet` | `{ taskId, minutesBefore, type }` | `remindersStore.createReminder()` |

#### Calendar Events

| Event | Payload | Abgeleitet aus |
|-------|---------|----------------|
| `CalendarEventCreated` | `{ eventId, title, startTime, endTime, isAllDay, isRecurring, calendarId }` | `eventsStore.createEvent()` |
| `CalendarEventUpdated` | `{ eventId, fields: string[] }` | `eventsStore.updateEvent()` |
| `CalendarEventDeleted` | `{ eventId, title, wasRecurring }` | `eventsStore.deleteEvent()` |
| `CalendarEventMoved` | `{ eventId, title, oldStart, newStart }` | `updateEvent` wenn `startTime` aendert |

#### Drink Events

| Event | Payload | Abgeleitet aus |
|-------|---------|----------------|
| `DrinkLogged` | `{ entryId, drinkType, quantityMl, name, date, time, fromPreset: boolean }` | `drinkStore.logDrink()`, `logFromPreset()` |
| `DrinkEntryDeleted` | `{ entryId, drinkType, quantityMl }` | `drinkStore.deleteEntry()` |
| `DrinkEntryUndone` | `{ entryId }` | `drinkStore.undoLastEntry()` |
| `DrinkGoalReached` | `{ date, goalMl, actualMl, drinkType: 'water' }` | Projection erkennt Zielerreichung |

#### Food Events

| Event | Payload | Abgeleitet aus |
|-------|---------|----------------|
| `MealLogged` | `{ mealId, mealType, inputType, description, calories?, protein?, date }` | `mealMutations.create()` |
| `MealFromPhotoLogged` | `{ mealId, mealType, photoMediaId, confidence, foods? }` | `mealMutations.createFromPhoto()` |
| `MealDeleted` | `{ mealId, mealType }` | `mealMutations.delete()` |
| `NutritionGoalSet` | `{ dailyCalories, dailyProtein?, dailyCarbs?, dailyFat? }` | `goalMutations.create/update()` |
| `DailyCalorieGoalReached` | `{ date, goal, actual }` | Projection erkennt Zielerreichung |

#### Places Events

| Event | Payload | Abgeleitet aus |
|-------|---------|----------------|
| `PlaceCreated` | `{ placeId, name, category?, lat, lng }` | `placesStore.createPlace()` |
| `PlaceVisited` | `{ placeId, name, visitCount }` | `placesStore.recordVisit()` |
| `LocationLogged` | `{ logId, lat, lng, placeId?, accuracy }` | `trackingStore.logNow()` |
| `TrackingStarted` | `{}` | `trackingStore.startTracking()` |
| `TrackingStopped` | `{ durationMs, logCount }` | `trackingStore.stopTracking()` |

### 3.5 Event-Emission aus Module Stores

Jeder Store bekommt `emit()`-Calls in seinen Mutations. Kein Umbau der Dexie-Hooks noetig — Events werden **im Store** emittiert, nicht im Hook.

**Warum im Store statt im Hook?** Der Hook sieht nur CRUD. Der Store kennt die Semantik. `completeTask()` weiss, dass es ein Completion ist — der Hook sieht nur `update({ completedAt })`.

**Beispiel: Todo Store nach Umbau:**

```typescript
// stores/tasks.svelte.ts
import { eventBus } from '$lib/data/events/event-bus';

export const tasksStore = {
  async completeTask(id: string) {
    const task = await taskTable.get(id);
    if (!task) return;
    const now = new Date().toISOString();
    const wasOverdue = task.dueDate && task.dueDate < now.slice(0, 10);
    
    await taskTable.update(id, { completedAt: now, updatedAt: now });
    
    eventBus.emit({
      type: 'TaskCompleted',
      payload: {
        taskId: id,
        title: task.title,       // plaintext snapshot (pre-encryption)
        projectId: task.projectId,
        wasOverdue,
      },
      meta: {
        id: crypto.randomUUID(),
        timestamp: now,
        appId: 'todo',
        collection: 'tasks',
        recordId: id,
        userId: getEffectiveUserId(),
      },
    });
  },
  // ... andere Mutations analog
};
```

**Konvention:** Jede Store-Mutation die einen Seiteneffekt hat, emittiert ein Event. Reine UI-State-Aenderungen (z.B. `calendarViewStore.setDate()`) emittieren nicht.

### 3.6 Event Helper fuer Module

Um Boilerplate zu reduzieren, ein `createEventEmitter` Helper:

**Neues File: `apps/mana/apps/web/src/lib/data/events/emit.ts`**

```typescript
import { eventBus } from './event-bus';
import { getEffectiveUserId } from '../current-user';

export function emitDomainEvent<P>(
  type: string,
  appId: string,
  collection: string,
  recordId: string,
  payload: P,
  causedBy?: string
): void {
  eventBus.emit({
    type,
    payload,
    meta: {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      appId,
      collection,
      recordId,
      userId: getEffectiveUserId(),
      causedBy,
    },
  });
}
```

Aufruf im Store wird dann einzeilig:

```typescript
emitDomainEvent('TaskCompleted', 'todo', 'tasks', id, {
  taskId: id, title: task.title, projectId: task.projectId, wasOverdue,
});
```

---

## 4. Projection Engine

### 4.1 Prinzip

Projections sind **live-reaktive Aggregationen** ueber Modul-Daten. Sie hoeren Domain Events und aktualisieren sich inkrementell. Consumers (Pulse, Companion, Dashboard) lesen Projections — nie Rohdaten.

**Neuer Ordner: `apps/mana/apps/web/src/lib/data/projections/`**

### 4.2 DaySnapshot

Beantwortet: "Was ist heute los?"

```typescript
// projections/day-snapshot.ts

export interface DaySnapshot {
  date: string;                       // YYYY-MM-DD
  
  // Todo
  tasks: {
    total: number;
    completed: number;
    overdue: number;
    dueToday: TaskSummary[];
  };
  
  // Calendar
  events: {
    upcoming: EventSummary[];         // naechste 5 Events
    total: number;
    nextEvent?: EventSummary;
  };
  
  // Drink
  drinks: {
    water: { ml: number; goal: number; percent: number };
    coffee: { ml: number; count: number };
    other: { ml: number; count: number };
    total: { ml: number; count: number };
  };
  
  // Food
  nutrition: {
    meals: number;
    calories: { actual: number; goal: number; percent: number };
    protein?: { actual: number; goal: number };
  };
  
  // Places
  places: {
    visited: number;
    currentLocation?: { lat: number; lng: number; placeName?: string };
    tracking: boolean;
  };
}
```

**Implementierung:** Dexie liveQueries die auf `$derived` gemapped werden. Event-Listener fuer inkrementelle Updates (z.B. `DrinkLogged` addiert direkt statt neu zu querien).

### 4.3 Streaks

Beantwortet: "Was laeuft gut, was droht zu brechen?"

```typescript
// projections/streaks.ts

export interface StreakInfo {
  moduleId: string;
  label: string;                      // "Wasser-Ziel", "Journal", "Sport"
  currentStreak: number;              // Tage in Folge
  longestStreak: number;
  lastActiveDate: string;             // YYYY-MM-DD
  status: 'active' | 'at_risk' | 'broken';
  // active: heute oder gestern aktiv
  // at_risk: gestern nicht aktiv, vorgestern schon
  // broken: >1 Tag Pause
}
```

Berechnet aus: TimeBlocks + Modul-spezifische Logik (Drink: Tagesziel erreicht, Todo: mindestens 1 Task erledigt, etc.)

### 4.4 Correlations

Beantwortet: "Was haengt zusammen?"

```typescript
// projections/correlations.ts

export interface Correlation {
  id: string;
  factorA: { module: string; metric: string; label: string };
  factorB: { module: string; metric: string; label: string };
  coefficient: number;               // Pearson r, -1 bis +1
  pValue: number;                    // Statistische Signifikanz
  sampleSize: number;                // Anzahl Tage
  direction: 'positive' | 'negative';
  sentence: string;                  // "An Tagen mit Sport trinkst du 30% mehr Wasser"
  computedAt: string;
}
```

**Berechnung:** 1x taeglich, ueber TimeBlocks + Tagesaggregate der letzten 30-90 Tage. Pearson-Korrelation zwischen Paaren. Nur Korrelationen mit |r| > 0.3 und p < 0.05 werden gespeichert.

**Metriken pro Modul:**
- Todo: tasks_completed_count, overdue_count
- Calendar: events_count, meeting_hours
- Drink: water_ml, coffee_count, goal_reached (boolean)
- Food: calories, protein, meals_count
- Places: places_visited, distance_km

### 4.5 ContactHealth (spaeter, nicht in Pilot)

Wird mit dem Contacts-Modul relevant. Trackt Kontakthaeufigkeit vs. erwartete Frequenz.

---

## 5. Goal System

### 5.1 Datenmodell

**Neue Dexie-Tabelle: `goals`**
```
goals: 'id, moduleId, status, [moduleId+status]'
```

```typescript
export interface LocalGoal {
  id: string;
  title: string;                      // "4x Sport pro Woche"
  description?: string;
  
  // Metrik-Definition
  metric: GoalMetric;
  target: GoalTarget;
  
  // Verknuepfung
  moduleId: string;                   // primaeres Modul
  linkedModules: string[];            // weitere beteiligte Module
  
  // Status
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  
  // Tracking
  currentValue: number;               // live berechnet
  currentPeriodStart: string;         // Beginn der aktuellen Periode
  history: GoalPeriodResult[];        // vergangene Perioden
  
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface GoalMetric {
  source: 'event_count' | 'event_sum' | 'streak_days' | 'custom';
  eventType?: string;                 // Domain Event Type (z.B. 'DrinkLogged')
  filterField?: string;               // z.B. 'drinkType'
  filterValue?: string;               // z.B. 'water'
  sumField?: string;                  // z.B. 'quantityMl' (fuer event_sum)
}

export interface GoalTarget {
  value: number;                      // Zielwert
  period: 'day' | 'week' | 'month';
  comparison: 'gte' | 'lte' | 'eq';  // >= (Sport), <= (Kaffee), = (exakt)
}

export interface GoalPeriodResult {
  periodStart: string;
  periodEnd: string;
  value: number;
  reached: boolean;
}
```

### 5.2 Goal-Tracking via Events

Der Goal-Tracker subscribed auf den Event Bus und aktualisiert `currentValue` inkrementell:

```typescript
// Beispiel: Ziel "8 Glaeser Wasser/Tag"
// metric: { source: 'event_count', eventType: 'DrinkLogged', filterField: 'drinkType', filterValue: 'water' }
// target: { value: 8, period: 'day', comparison: 'gte' }

eventBus.on('DrinkLogged', (event) => {
  if (event.payload.drinkType === 'water') {
    goal.currentValue += 1;
    if (goal.currentValue >= goal.target.value) {
      emitDomainEvent('GoalReached', 'companion', 'goals', goal.id, {
        goalId: goal.id, title: goal.title, value: goal.currentValue,
      });
    }
  }
});
```

### 5.3 Vordefinierte Ziel-Templates

Fuer den Start 10-15 Templates die der Nutzer mit einem Tap aktiviert:

- 8 Glaeser Wasser/Tag (Drink, event_count, DrinkLogged, water)
- 2000 kcal/Tag (Food, event_sum, MealLogged, calories)
- 5 Tasks/Tag erledigen (Todo, event_count, TaskCompleted)
- Alle Mahlzeiten tracken (Food, event_count, MealLogged, 3/day)
- Jeden Tag einen neuen Ort besuchen (Places, event_count, PlaceVisited, 1/day)

---

## 6. Semantic Memory

### 6.1 Datenmodell

**Neue Dexie-Tabelle: `_memory`**
```
_memory: 'id, category, confidence, lastConfirmed, [category+confidence]'
```

```typescript
export interface MemoryFact {
  id: string;
  category: 'pattern' | 'preference' | 'relationship' | 'context';
  
  content: string;                    // Menschenlesbarer Fakt
  // "Trainiert typischerweise Mo/Mi/Fr abends"
  // "Trinkt morgens immer zuerst Kaffee, dann Wasser"
  // "Meetings haeufig Di/Do vormittags"
  
  confidence: number;                 // 0.0 - 1.0
  confirmations: number;             // wie oft bestaetigt
  contradictions: number;             // wie oft widersprochen
  
  sourceEvents: string[];             // Event-IDs die diesen Fakt stuetzen
  sourceModules: string[];            // beteiligte Module
  
  firstSeen: string;                  // wann erstmals erkannt
  lastConfirmed: string;              // letzte Bestaetigung
  expiresAt?: string;                 // fuer temporaere Kontexte
  
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
```

### 6.2 Extraktion

**Zwei Wege:**

1. **Regelbasiert (kein LLM):** Pattern-Detektoren ueber Event-Stream:
   - Wiederholungs-Detektor: "3x in 2 Wochen am Montag trainiert → Pattern: trainiert montags"
   - Zeitfenster-Detektor: "Tasks werden zu 80% zwischen 09-12 Uhr erledigt → Preference: Morgen-Produktivitaet"
   - Sequenz-Detektor: "Kaffee wird immer vor dem ersten Event geloggt → Pattern: Kaffee vor Meetings"

2. **LLM-basiert (Tier 1 browser):** Woechentlich zusammengefasste Events an lokales Gemma-Modell:
   - "Hier sind die Events der letzten Woche. Welche Muster und Praeferenzen erkennst du?"
   - Ergebnis als JSON parsen → MemoryFact[] schreiben

### 6.3 Confidence-Lifecycle

```
Neuer Fakt erkannt          → confidence: 0.3
Nochmal bestaetigt          → confidence: 0.5
3+ Bestaetigungen           → confidence: 0.7
10+ Bestaetigungen          → confidence: 0.9
Widerspruch erkannt         → confidence -= 0.15
Laenger als 30 Tage nicht   → confidence -= 0.05/Woche
  bestaetigt
confidence < 0.1            → Fakt wird geloescht
```

---

## 7. Context Document Generator

### 7.1 Zweck

Komprimiert den gesamten Nutzerzustand in ein ~500 Token Dokument, das als System-Prompt an das LLM geht. Aktualisiert sich bei jedem Companion-Aufruf.

### 7.2 Template

```typescript
// projections/context-document.ts

export function generateContextDocument(
  day: DaySnapshot,
  streaks: StreakInfo[],
  goals: LocalGoal[],
  memory: MemoryFact[],
  correlations: Correlation[]
): string {
  return `## Nutzer-Kontext (${day.date})

### Heute
- ${day.tasks.dueToday.length} Tasks faellig (${day.tasks.completed} erledigt, ${day.tasks.overdue} ueberfaellig)
- ${day.events.total} Termine${day.events.nextEvent ? ` — naechster: ${day.events.nextEvent.title} um ${day.events.nextEvent.startTime}` : ''}
- Wasser: ${day.drinks.water.ml}ml von ${day.drinks.water.goal}ml (${day.drinks.water.percent}%)
- Ernaehrung: ${day.nutrition.calories.actual} von ${day.nutrition.calories.goal} kcal, ${day.nutrition.meals} Mahlzeiten
${day.places.tracking ? `- Standort-Tracking aktiv` : ''}

### Ziele
${goals.filter(g => g.status === 'active').map(g =>
  `- "${g.title}" — ${g.currentValue}/${g.target.value} (${g.target.period})`
).join('\n')}

### Streaks
${streaks.filter(s => s.status !== 'broken').map(s =>
  `- ${s.label}: ${s.currentStreak} Tage${s.status === 'at_risk' ? ' (GEFAEHRDET)' : ''}`
).join('\n')}
${streaks.filter(s => s.status === 'broken').map(s =>
  `- ${s.label}: UNTERBROCHEN seit ${daysSince(s.lastActiveDate)} Tagen`
).join('\n')}

### Bekannte Muster
${memory.filter(m => m.confidence > 0.5).map(m => `- ${m.content}`).join('\n')}

### Korrelationen
${correlations.slice(0, 3).map(c => `- ${c.sentence}`).join('\n')}
`;
}
```

---

## 8. Tool Layer (LLM Write-Access)

### 8.1 ModuleTool Interface

**Neues File: `apps/mana/apps/web/src/lib/data/tools/types.ts`**

```typescript
export interface ModuleTool {
  name: string;                       // 'create_task', 'log_drink'
  module: string;                     // 'todo', 'drink'
  description: string;                // Fuer LLM Function-Schema
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  enum?: string[];                    // z.B. ['water', 'coffee', 'tea']
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  message?: string;                   // Menschenlesbare Bestaetigung
}
```

### 8.2 Tool-Definitionen (5 Pilot-Module)

**Jedes Modul bekommt eine `tools.ts`:**

```typescript
// modules/todo/tools.ts
export const todoTools: ModuleTool[] = [
  {
    name: 'create_task',
    module: 'todo',
    description: 'Erstellt einen neuen Task',
    parameters: [
      { name: 'title', type: 'string', description: 'Titel des Tasks', required: true },
      { name: 'dueDate', type: 'string', description: 'Faelligkeitsdatum (YYYY-MM-DD)', required: false },
      { name: 'priority', type: 'number', description: 'Prioritaet 0-3', required: false },
    ],
    execute: async (params) => {
      const task = await tasksStore.createTask({
        title: params.title as string,
        dueDate: params.dueDate as string | undefined,
        priority: params.priority as number | undefined,
      });
      return { success: true, data: task, message: `Task "${task.title}" erstellt` };
    },
  },
  {
    name: 'complete_task',
    module: 'todo',
    description: 'Markiert einen Task als erledigt',
    parameters: [
      { name: 'taskId', type: 'string', description: 'ID des Tasks', required: true },
    ],
    execute: async (params) => {
      await tasksStore.completeTask(params.taskId as string);
      return { success: true, message: 'Task erledigt' };
    },
  },
];

// modules/drink/tools.ts
export const drinkTools: ModuleTool[] = [
  {
    name: 'log_drink',
    module: 'drink',
    description: 'Loggt ein Getraenk',
    parameters: [
      { name: 'drinkType', type: 'string', description: 'Art', required: true, enum: ['water', 'coffee', 'tea', 'juice', 'alcohol', 'other'] },
      { name: 'quantityMl', type: 'number', description: 'Menge in ml', required: true },
      { name: 'name', type: 'string', description: 'Name des Getraenks', required: false },
    ],
    execute: async (params) => {
      const entry = await drinkStore.logDrink({
        name: (params.name as string) ?? (params.drinkType as string),
        drinkType: params.drinkType as DrinkType,
        quantityMl: params.quantityMl as number,
      });
      return { success: true, data: entry, message: `${params.quantityMl}ml ${params.drinkType} geloggt` };
    },
  },
];

// modules/calendar/tools.ts — create_event
// modules/food/tools.ts — log_meal
// modules/places/tools.ts — record_visit, create_place
```

### 8.3 Tool Registry

**Neues File: `apps/mana/apps/web/src/lib/data/tools/registry.ts`**

```typescript
import { todoTools } from '$lib/modules/todo/tools';
import { calendarTools } from '$lib/modules/calendar/tools';
import { drinkTools } from '$lib/modules/drink/tools';
import { foodTools } from '$lib/modules/food/tools';
import { placesTools } from '$lib/modules/places/tools';

const ALL_TOOLS: ModuleTool[] = [
  ...todoTools,
  ...calendarTools,
  ...drinkTools,
  ...foodTools,
  ...placesTools,
];

export function getTools(): ModuleTool[] {
  return ALL_TOOLS;
}

export function getTool(name: string): ModuleTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

export function getToolsForLlm(): LlmFunctionSchema[] {
  return ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        t.parameters.map((p) => [p.name, {
          type: p.type,
          description: p.description,
          ...(p.enum ? { enum: p.enum } : {}),
        }])
      ),
      required: t.parameters.filter((p) => p.required).map((p) => p.name),
    },
  }));
}
```

### 8.4 Integration mit LLM Orchestrator

Der bestehende `LlmOrchestrator` in `@mana/shared-llm` bekommt eine neue Methode:

```typescript
// In shared-llm/src/orchestrator.ts

async runWithTools<TOut>(
  task: LlmTask,
  input: { messages: ChatMessage[]; tools: LlmFunctionSchema[] },
): Promise<LlmTaskResult<TOut>>
```

Das LLM gibt `tool_use` Responses zurueck, die der Orchestrator ueber `getTool(name).execute(params)` ausfuehrt. Das Ergebnis wird als `tool_result` Message zurueckgefuettert.

---

## 9. Rule Engine (Pulse)

### 9.1 Prinzip

Die Rule Engine liest Projections und erzeugt Nudges. Kein LLM — rein deterministisch. Laeuft auf zwei Wegen:

1. **Event-getriggert:** Reagiert auf Domain Events (z.B. `TaskCompleted` → Streak-Check)
2. **Zeitgesteuert:** Periodische Checks (Morgen-Summary, Abend-Reflexion, stuendlich)

### 9.2 Rule Interface

**Neues File: `apps/mana/apps/web/src/lib/companion/rules/types.ts`**

```typescript
export interface PulseRule {
  id: string;
  name: string;
  description: string;
  
  // Trigger
  trigger:
    | { kind: 'event'; eventType: string }
    | { kind: 'schedule'; cron: string }     // z.B. '0 8 * * *' (08:00 taeglich)
    | { kind: 'interval'; minutes: number }; // z.B. 60 (stuendlich)
  
  // Check — gibt null zurueck wenn kein Nudge noetig
  check: (ctx: RuleContext) => Promise<Nudge | null>;
}

export interface RuleContext {
  day: DaySnapshot;
  streaks: StreakInfo[];
  goals: LocalGoal[];
  memory: MemoryFact[];
  now: Date;
}

export interface Nudge {
  id: string;
  type: NudgeType;
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  actionLabel?: string;               // "Jetzt loggen"
  actionRoute?: string;               // '/drink'
  actionTool?: string;                // 'log_drink' — Companion kann direkt ausfuehren
  expiresAt?: string;                 // wann der Nudge irrelevant wird
}

type NudgeType =
  | 'streak_warning'
  | 'goal_progress'
  | 'goal_reached'
  | 'morning_summary'
  | 'evening_reflection'
  | 'overdue_tasks'
  | 'water_reminder'
  | 'meal_reminder'
  | 'correlation_insight';
```

### 9.3 Vordefinierte Rules (Pilot)

```typescript
// rules/water-reminder.ts
export const waterReminderRule: PulseRule = {
  id: 'water-reminder',
  name: 'Wasser-Erinnerung',
  trigger: { kind: 'interval', minutes: 90 },
  async check(ctx) {
    const { water } = ctx.day.drinks;
    if (water.percent >= 100) return null;  // Ziel erreicht
    const hourOfDay = ctx.now.getHours();
    if (hourOfDay < 8 || hourOfDay > 21) return null;  // Nachtruhe
    
    const remaining = water.goal - water.ml;
    const hoursLeft = 21 - hourOfDay;
    const mlPerHour = Math.ceil(remaining / hoursLeft);
    
    return {
      id: `water-${ctx.day.date}-${hourOfDay}`,
      type: 'water_reminder',
      title: 'Wasser trinken',
      body: `Noch ${remaining}ml bis zum Ziel. ~${mlPerHour}ml pro Stunde.`,
      priority: water.percent < 50 ? 'medium' : 'low',
      actionLabel: 'Glas loggen',
      actionTool: 'log_drink',
    };
  },
};

// rules/streak-warning.ts
export const streakWarningRule: PulseRule = {
  id: 'streak-warning',
  name: 'Streak-Warnung',
  trigger: { kind: 'schedule', cron: '0 18 * * *' },  // 18:00 taeglich
  async check(ctx) {
    const atRisk = ctx.streaks.filter(s => s.status === 'at_risk');
    if (atRisk.length === 0) return null;
    
    const best = atRisk.reduce((a, b) => a.currentStreak > b.currentStreak ? a : b);
    return {
      id: `streak-${ctx.day.date}`,
      type: 'streak_warning',
      title: `${best.label}-Streak in Gefahr!`,
      body: `${best.currentStreak} Tage — nicht heute brechen.`,
      priority: best.currentStreak > 7 ? 'high' : 'medium',
    };
  },
};

// rules/morning-summary.ts
// rules/evening-reflection.ts
// rules/overdue-tasks.ts
// rules/meal-reminder.ts
// rules/goal-reached.ts
```

### 9.4 Rule Engine Runner

Integriert sich in den bestehenden Reminder-Scheduler als zusaetzliche Source:

```typescript
// companion/rules/engine.ts

export function createRuleEngine(rules: PulseRule[]): ReminderSource {
  return {
    id: 'companion-pulse',
    async checkDue(): Promise<DueReminder[]> {
      const ctx = await buildRuleContext();
      const nudges: Nudge[] = [];
      
      for (const rule of rules) {
        if (shouldTrigger(rule)) {
          const nudge = await rule.check(ctx);
          if (nudge && !isDismissed(nudge.id)) {
            nudges.push(nudge);
          }
        }
      }
      
      return nudges.map(toReminder);
    },
    async markSent(id) { /* track in localStorage */ },
  };
}
```

---

## 10. Feedback Loop

### 10.1 Datenmodell

**Neue Dexie-Tabelle: `_nudgeOutcomes`**
```
_nudgeOutcomes: '++id, nudgeId, nudgeType, outcome, timestamp, [nudgeType+outcome]'
```

```typescript
export interface NudgeOutcome {
  id?: number;
  nudgeId: string;
  nudgeType: NudgeType;
  outcome: 'acted' | 'dismissed' | 'snoozed' | 'expired' | 'auto_resolved';
  latencyMs?: number;                 // Zeit bis Reaktion
  timestamp: string;
}
```

### 10.2 Lerneffekt

Aggregation ueber `_nudgeOutcomes` beeinflusst die Rule Engine:

```typescript
// Beispiel: Wasser-Reminder wird um 10:00 immer dismissed
// → confidence fuer "Nutzer mag morgens keine Wasser-Reminder" steigt
// → Rule Engine verschiebt auf 11:00

// Beispiel: Streak-Warning um 18:00 fuehrt zu 80% zu Aktion
// → confidence fuer "18:00 ist guter Zeitpunkt" steigt
// → bleibt bei 18:00
```

Memory-Facts werden aus Outcome-Patterns extrahiert und fliessen in den Context Document Generator.

---

## 11. Companion Chat (Interaction Layer)

### 11.1 Modul-Struktur

**Neues Modul: `apps/mana/apps/web/src/lib/modules/companion/`**

```
companion/
  module.config.ts          — Registriert companion-Tabellen
  collections.ts            — conversations, messages, rituals, goals
  stores/
    chat.svelte.ts          — Chat-Mutations (send, receive, tool-call)
    rituals.svelte.ts       — Ritual-CRUD + Step-Execution
    goals.svelte.ts         — Goal-CRUD + Progress-Tracking
  queries.ts                — Live-Queries fuer Chat, Rituals, Goals
  tools.ts                  — Companion-eigene Tools (read_context, get_insights)
  components/
    CompanionChat.svelte    — Chat-Interface mit Tool-Execution
    CompanionFeed.svelte    — Timeline von Nudges + Insights + Chat
    RitualRunner.svelte     — Step-by-Step Ritual-UI
    GoalCard.svelte         — Ziel-Fortschritts-Anzeige
```

### 11.2 Chat-Flow

```
User: "Wie laeuft mein Tag?"
    |
    v
CompanionChat → LLM Orchestrator
    |
    |  System Prompt = Context Document (~500 Tokens)
    |  + Tool Schemas (getToolsForLlm())
    |  + User Message
    |
    v
LLM (Gemma lokal ODER Gemini Cloud)
    |
    |  Response: "Du hast heute 3/7 Tasks erledigt und erst 400ml
    |  Wasser getrunken. Dein Kalender ist ab 15:00 frei — guter
    |  Zeitpunkt fuer die ueberfaelligen Tasks. Soll ich dich
    |  in 2 Stunden ans Wasser erinnern?"
    |
    |  tool_use: create_reminder(...)
    |
    v
Tool Execution → drinkStore / remindersStore
    |
    v
CompanionChat zeigt Antwort + Aktions-Bestaetigung
```

### 11.3 Ritual-Generierung

```
User: "Erstell mir eine Morgenroutine"
    |
    v
LLM + Context Document + Tool Schemas
    |
    |  LLM sieht: Nutzer hat Drink, Todo, Food, Calendar aktiv
    |  Memory: "Trinkt morgens zuerst Kaffee"
    |  Goals: "8 Glaeser Wasser/Tag"
    |
    v
Generiertes Ritual:
  1. Glas Wasser loggen (tool: log_drink, water, 250ml)
  2. Stimmung checken (free_text → journal)
  3. Tages-Tasks priorisieren (zeigt DaySnapshot.tasks.dueToday)
  4. Kalender-Ueberblick (zeigt DaySnapshot.events.upcoming)
  5. Fruehstueck loggen (tool: log_meal)
```

---

## 12. Dateien & Ordnerstruktur

✅ = implementiert, ⬜ = ausstehend

```
apps/mana/apps/web/src/lib/
  data/
    events/                         ✅ Phase 1
      event-bus.ts                  ✅ EventBus Singleton (sync dispatch, microtask handlers)
      event-store.ts                ✅ Persistenz in _events Tabelle (90d TTL, 50k max)
      emit.ts                       ✅ emitDomainEvent() Helper
      types.ts                      ✅ DomainEvent, EventMeta, EventBus Interfaces
      catalog.ts                    ✅ 22 Event-Typen (ManaEvent union type)
      index.ts                      ✅ Barrel Export
    projections/                    ✅ Phase 2
      day-snapshot.ts               ✅ useDaySnapshot() — live Tagesaggregation
      streaks.ts                    ✅ useStreaks() — 3 Streak-Typen, 90d Lookback
      context-document.ts           ✅ generateContextDocument() — ~500 Token LLM-Prompt
      correlations.ts               ✅ Phase 7 — Pearson ueber 7 Metriken
      types.ts                      ✅ DaySnapshot, StreakInfo, TaskSummary, EventSummary
      index.ts                      ✅ Barrel Export
    tools/                          ✅ Phase 4
      types.ts                      ✅ ModuleTool, ToolParameter, ToolResult, LlmFunctionSchema
      registry.ts                   ✅ registerTools(), getToolsForLlm()
      executor.ts                   ✅ executeTool() mit Validierung + Typ-Coercion
      init.ts                       ✅ initTools() — registriert alle 5 Module
      index.ts                      ✅ Barrel Export
  companion/
    goals/                          ✅ Phase 3
      types.ts                      ✅ LocalGoal, GoalMetric, GoalTarget, 6 Templates
      store.ts                      ✅ CRUD + Event-Bus-Subscription fuer Progress
      queries.ts                    ✅ useActiveGoals(), useAllGoals()
      index.ts                      ✅ Barrel Export
    rules/                          ✅ Phase 3
      types.ts                      ✅ PulseRule, Nudge, NudgeType, RuleContext
      rules.ts                      ✅ 5 Rules (water, streak, morning, overdue, meal)
      engine.ts                     ✅ evaluateRules(), createPulseReminderSource()
      index.ts                      ✅ Barrel Export
    feedback/                       ✅ Phase 3
      types.ts                      ✅ NudgeOutcome
      tracker.ts                    ✅ recordOutcome(), getOutcomeStats(), getActionRate()
      index.ts                      ✅ Barrel Export
    memory/                         ✅ Phase 7
      types.ts                      ✅ MemoryFact, Correlation
      store.ts                      ✅ recordFact, contradictFact, applyDecay, getFacts
      extractors.ts                 ✅ 3 Extractors (day-of-week, time-of-day, frequency)
      index.ts                      ✅ Barrel Export
    rituals/                        ✅ Phase 6
      types.ts                      ✅ 6 Step-Typen, 3 Templates
      store.ts                      ✅ createFromTemplate, CRUD, logs
      queries.ts                    ✅ useActiveRituals, useAllRituals
      index.ts                      ✅ Barrel Export
  modules/
    companion/                      ✅ Phase 5
      types.ts                      ✅ LocalConversation, LocalMessage
      collections.ts                ✅ companionConversations, companionMessages
      stores/chat.svelte.ts         ✅ Conversation + Message CRUD
      queries.ts                    ✅ useConversations, useMessages
      engine.ts                     ✅ runCompanionChat (LLM + Tools + Context)
      index.ts                      ✅ Barrel Export
      components/
        CompanionChat.svelte        ✅ Chat-UI mit Streaming + Tool-Results
        RitualRunner.svelte         ✅ Step-by-Step Runner
        CompanionFeed.svelte        ⬜ Timeline (spaetere Iteration)
        GoalCard.svelte             ⬜ Goal-Fortschritts-Widget (spaetere Iteration)
    todo/
      tools.ts                      ✅ 3 Tools (create, complete, stats)
      stores/tasks.svelte.ts        ✅ 5 Events (Created, Completed, Uncompleted, Deleted, Subtasks)
    calendar/
      tools.ts                      ✅ 2 Tools (create_event, get_todays_events)
      stores/events.svelte.ts       ✅ 3 Events (Created, Updated, Deleted)
    drink/
      tools.ts                      ✅ 3 Tools (log, progress, undo)
      stores/drink.svelte.ts        ✅ 3 Events (Logged, Deleted, Undone)
    food/
      tools.ts                      ✅ 2 Tools (log_meal, nutrition_summary)
      mutations.ts                  ✅ 3 Events (Logged, PhotoLogged, Deleted)
    places/
      tools.ts                      ✅ 4 Tools (create, visit, get_places, location)
      stores/places.svelte.ts       ✅ 3 Events (Created, Deleted, Visited)
      stores/tracking.svelte.ts     ✅ 3 Events (Started, Stopped, LocationLogged)
```

---

## 13. Dexie-Tabellen

### Implementiert (v10 Schema)

```typescript
// Event Store — append-only domain event log
_events: '++seq, type, meta.appId, meta.timestamp, meta.recordId, [meta.appId+meta.timestamp], [type+meta.timestamp]',

// Goals — companion brain goal tracking
companionGoals: 'id, moduleId, status, [moduleId+status]',

// Semantic Memory — extracted user patterns (prepared, not yet populated)
_memory: 'id, category, confidence, lastConfirmed, [category+confidence]',

// Feedback Loop — nudge outcome tracking
_nudgeOutcomes: '++id, nudgeId, nudgeType, outcome, timestamp, [nudgeType+outcome]',
```

### Noch ausstehend (Phase 5+)

```typescript
// Companion Chat (Phase 5)
companionConversations: 'id, createdAt',
companionMessages: 'id, conversationId, role, createdAt, [conversationId+createdAt]',

// Rituals (Phase 6)
rituals: 'id, status, createdAt',
ritualSteps: 'id, ritualId, order, [ritualId+order]',
ritualLogs: '++id, ritualId, date, [ritualId+date]',
```

---

## 14. Implementierungs-Reihenfolge

### Phase 1: Event-Fundament — ERLEDIGT (2026-04-13)

Commit: `e927c1f10`

1. ✅ `data/events/` — EventBus, EventStore, emit Helper, Type Catalog
2. ✅ Domain Events fuer 5 Pilot-Module definiert (catalog.ts, 22 Event-Typen)
3. ✅ Stores der 5 Module umgebaut: `emit()` Calls eingefuegt
4. ✅ Event Store Subscriber: `eventBus.onAny()` → `_events` Tabelle (v10 Schema)
5. ⬜ Tests: noch ausstehend

**Ergebnis:** Semantischer Event-Stream fliesst. 20 Domain Events aus 5 Modulen.

**Implementierungsnotizen:**
- Events werden im Store emittiert (nicht im Dexie-Hook) — der Store kennt die Semantik
- `emitDomainEvent()` Helper reduziert Boilerplate auf eine Zeile pro Event
- Re-Entrancy-Guard im EventBus verhindert Endlos-Loops
- `_activity` Tabelle bleibt parallel bestehen (Sync-Debugging)

### Phase 2: Projections — ERLEDIGT (2026-04-13)

Commit: `40e1145e9`

1. ✅ DaySnapshot Projection (live Dexie-Queries ueber alle 5 Module)
2. ✅ Streaks Projection (3 Streak-Definitionen: Wasser, Tasks, Mahlzeiten, 90-Tage Lookback)
3. ✅ Context Document Generator (Template-basiert, ~300-500 Token)
4. ⬜ Dashboard-Widget: "Mein Tag" Karte — spaeter in UI-Phase

**Ergebnis:** Zentraler Ueberblick ueber alle 5 Module, live-reaktiv.

**Implementierungsnotizen:**
- Projections nutzen `useLiveQueryWithDefault` aus `@mana/local-store/svelte`
- DaySnapshot queried 5 Dexie-Tabellen + decrypted in einem buildSnapshot()-Call
- Streaks berechnen per checkDate() ob ein Tag "zaehlt" (z.B. Wasser-Ziel erreicht)
- Context Document ist reines String-Template, kein LLM noetig
- `startEventStore()` in `(app)/+layout.svelte` bei Auth-Ready gewired

### Phase 3: Goals + Pulse — ERLEDIGT (2026-04-13)

Commit: `9066b6c9a`

1. ✅ Goal Datenmodell + Store + Queries (`companion/goals/`)
2. ✅ Goal-Tracking via Event-Bus-Subscription (auto-increment currentValue)
3. ✅ 6 Goal-Templates (Wasser, Tasks, Mahlzeiten, Kalorien, Orte, Kaffee-Limit)
4. ✅ Rule Engine mit 5 Rules (`companion/rules/`)
5. ✅ ReminderSource-Adapter fuer bestehenden Scheduler
6. ⬜ Nudge-UI: Toast / Bottom-Sheet — in Phase 5 (Companion Chat)

**Ergebnis:** Goals tracken automatisch, Rules erzeugen Nudges.

**Implementierungsnotizen:**
- Goals leben in `companionGoals` Tabelle (v10 Schema), nicht im Core-Modul
- Goal-Tracker subscribed auf `eventBus.onAny()` und matched per eventType + Filter
- Perioden-Reset (day/week/month) passiert automatisch beim naechsten Event
- `GoalReached` Event wird emittiert wenn Ziel erstmals in einer Periode erreicht
- Rules nutzen localStorage fuer Dismissal-Tracking und Last-Run-Timestamps
- `_memory` und `_nudgeOutcomes` Tabellen vorbereitet (v10 Schema)

### Phase 4: Tool Layer — ERLEDIGT (2026-04-13)

Commit: `66dd684bb`

1. ✅ ModuleTool Interface + Registry (dynamische Registrierung)
2. ✅ tools.ts fuer 5 Pilot-Module (13 Tools total)
3. ✅ Tool Executor mit Parameter-Validierung + Typ-Coercion
4. ✅ LLM Function Schema Generator (`getToolsForLlm()`)
5. ⬜ Integration in LLM Orchestrator (`runWithTools`) — in Phase 5

**Ergebnis:** 13 Tools bereit fuer LLM Function-Calling.

**Implementierungsnotizen:**
- Registry nutzt `registerTools()` Pattern statt statische Imports (tree-shaking-freundlich)
- `initTools()` in `(app)/+layout.svelte` gewired neben `startEventStore()`
- Executor coerced String→Number und String→Boolean automatisch
- Tools pro Modul: Todo (3), Calendar (2), Drink (3), Food (2), Places (4)
- Jeder Tool hat eine `message` Feld fuer menschenlesbare Bestaetigung

### Phase 5: Companion Chat — ERLEDIGT (2026-04-13)

Commit: `46db527f8`

1. ✅ Companion Modul (types, collections, stores/chat, queries)
2. ✅ CompanionChat Svelte-Komponente (Streaming, Tool-Results inline)
3. ✅ Chat-Flow: Context Document als System-Prompt + Tool Schemas + LLM
4. ✅ `/companion` Route mit Sidebar (Gespraechsliste) + Chat-Area
5. ⬜ CompanionFeed: Timeline von Nudges + Chat — spaetere UI-Iteration

**Ergebnis:** Nutzer kann mit dem System sprechen und Aktionen ausfuehren.

**Implementierungsnotizen:**
- Chat nutzt `@mana/local-llm` (Gemma, browser-lokal) direkt — kein Server-Call
- Tool Calling via JSON-Block-Extraction (`\`\`\`tool {...}\`\`\``) statt nativem Function-Calling (Gemma unterstuetzt das nicht nativ)
- Max 3 Tool-Call-Runden pro Nachricht (verhindert Endlos-Loops)
- Conversations + Messages persistent in IndexedDB (`companionConversations`, `companionMessages`)
- Entscheidung: Companion lebt als eigenes Modul unter `/companion`, nicht als Overlay
- Streaming via `onToken` Callback — erster Round streamt, Folgerunden (nach Tool-Call) nicht

### Phase 6: Rituale — ERLEDIGT (2026-04-13)

Commit: `41357b254`

1. ✅ Ritual Datenmodell (6 Step-Typen: tool_call, number_input, text_input, mood_picker, info_display, checklist)
2. ✅ RitualRunner Komponente (Step-Card-UI, Progress-Bar, Tool-Execution)
3. ⬜ AI-Ritual-Generierung via Companion Chat — spaetere Iteration
4. ✅ 3 Ritual-Templates (Morgenroutine, Abendroutine, Trink-Check)
5. ✅ `/companion/rituals` Route mit Template-Picker + Ritual-Liste

**Ergebnis:** Gefuehrte Routinen die in Module schreiben.

**Implementierungsnotizen:**
- Rituale leben in `companion/rituals/` (nicht als eigenes Modul)
- Steps referenzieren Tools per Name — dieselben Tools die der Chat nutzt
- `info_display` Steps zeigen Projektionsdaten (Tasks, Events, Drinks, Nutrition, Streaks)
- Completion-Logs tracken wieviele Steps pro Tag abgeschlossen wurden
- Templates sind statisch definiert — AI-Generierung wird in Phase 5 integriert

### Phase 7: Memory + Correlations — ERLEDIGT (2026-04-13)

Commit: `87a1dd682`

1. ✅ Semantic Memory Store (`_memory` Tabelle, Confidence-Lifecycle)
2. ✅ 3 regelbasierte Pattern-Extractors (11 Extraction-Rules ueber 5 Module)
3. ✅ Correlation Engine (Pearson ueber 7 Metriken, cross-modul)
4. ✅ Memory + Correlations in Context Document integriert
5. ✅ Feedback Loop: `_nudgeOutcomes` Tabelle + Tracker (Phase 3)
6. ⬜ LLM-basierte Memory-Extraktion — spaetere Iteration

**Ergebnis:** System lernt Muster, findet Korrelationen, alles fliesst ins LLM.

**Implementierungsnotizen:**
- Pattern Extractors: day-of-week (Wochentags-Muster), time-of-day (4h-Peak-Fenster), frequency (Tages-Durchschnitt)
- Confidence: 0.3 initial, +0.15 pro Bestaetigung, -0.15 bei Widerspruch, Decay nach 30 Tagen
- Correlations nur cross-modul (gleich-Modul wird uebersprungen, trivial korreliert)
- Nur Korrelationen mit |r| >= 0.3 und >= 14 Tage Daten werden behalten
- `extractAllPatterns()` soll taeglich laufen (manuell oder via Scheduled Rule)
- `computeCorrelations()` berechnet on-demand, nicht persistent gecached

### Phase 8: Rollout auf weitere Module (Woche 8+)

Pro Modul:
1. Domain Events definieren (catalog.ts erweitern)
2. Store Mutations mit emit() versehen
3. tools.ts schreiben
4. Projections erweitern (DaySnapshot Felder)
5. Goal-Templates hinzufuegen
6. Pulse Rules hinzufuegen

Geschaetzter Aufwand pro Modul: 1-2 Tage.

---

## 15. Abhaengigkeiten & Reihenfolge-Graph

```
Phase 1 (Events) ──────┬──> Phase 2 (Projections)
                        |         |
                        |         v
                        ├──> Phase 3 (Goals + Pulse)
                        |         |
                        v         v
                   Phase 4 (Tools) ──> Phase 5 (Companion Chat)
                                              |
                                              v
                                       Phase 6 (Rituale)
                                              |
                                              v
                                       Phase 7 (Memory)
                                              |
                                              v
                                       Phase 8 (Rollout)
```

**Status: Phase 1-8 ERLEDIGT (2026-04-13).** 29 von ~40 Modulen angebunden.

---

## 15b. Phase 8 Status: Modul-Rollout

### Angebundene Module (29)

| # | Modul | Events | Tools | Batch |
|---|-------|--------|-------|-------|
| 1 | Todo | 5 | 3 | Pilot |
| 2 | Calendar | 3 | 2 | Pilot |
| 3 | Drink | 3 | 3 | Pilot |
| 4 | Food | 3 | 2 | Pilot |
| 5 | Places | 6 | 4 | Pilot |
| 6 | Habits | 3 | 3 | Batch 2 |
| 7 | Journal | 3 | 2 | Batch 2 |
| 8 | Notes | 2 | 1 | Batch 2 |
| 9 | Contacts | 2 | 2 | Batch 2 |
| 10 | Body | 5 | 3 | Batch 2 |
| 11 | Finance | 2 | 1 | Batch 3 |
| 12 | Dreams | 2 | 1 | Batch 3 |
| 13 | Cardecky | 2 | 1 | Batch 3 |
| 14 | Times | 2 | 2 | Batch 3 |
| 15 | Social Events | 2 | 1 | Batch 3 |
| 16 | Music | 1 | 1 | Batch 4 |
| 17 | Storage | 1 | 1 | Batch 4 |
| 18 | Chat | 2 | 1 | Batch 4 |
| 19 | Memoro | 1 | 1 | Batch 4 |
| 20 | Skilltree | 2 | 2 | Batch 4 |
| 21 | Period | 1 | 1 | Batch 5 |
| 22 | Firsts | 1 | 1 | Batch 5 |
| 23 | Guides | 1 | 1 | Batch 5 |
| 24 | Inventory | 1 | 1 | Batch 5 |
| 25 | Photos | 1 | 0 | Batch 5 |
| 26 | Plants | 2 | 1 | Batch 6 |
| 27 | News | 1 | 0 | Batch 6 |
| 28 | Recipes | 2 | 1 | Batch 6 |
| 29 | Questions | 1 | 0 | Batch 6 |
| **Total** | | **67** | **47** | |

### Noch fehlende Module (~11)

| Modul | Grund | Prioritaet |
|-------|-------|-----------|
| Citycorners | Nischen-Modul (Konstanz-Guide) | Niedrig |
| Uload | URL-Shortener, wenig Brain-relevant | Niedrig |
| Calc | Kein persistenter State | Nicht noetig |
| Moodlit | Ambient-Lighting, kein Tracking | Nicht noetig |
| Playground | Dev-Tool fuer LLM-Tests | Nicht noetig |
| Who | Rate-Spiel, kein Tracking | Nicht noetig |
| Quotes | Zitate (read-only) | Nicht noetig |
| Context | Kein eigener Store / Mutations | Nicht noetig |
| Presi | Praesentation-Builder | Niedrig |
| Meditate | Meditation-Sessions | Mittel |
| Sleep | Schlaf-Tracking | Mittel |

**Empfehlung:** Meditate und Sleep lohnen sich fuer Correlations (Schlaf vs. Produktivitaet). Die anderen sind entweder read-only, Dev-Tools oder haben keinen persistenten State der fuer das Brain relevant waere.

---

## 15c. Bekannte Altlasten & Optimierungs-Potenzial

### Altlast: `_activity` Tabelle

Die alte `_activity`-Tabelle wird weiterhin parallel zum neuen `_events` Event Store befuellt (via Dexie-Hooks in database.ts). Sie enthaelt nur CRUD-Operationen ohne Semantik. **Kann entfernt werden** sobald alle Debug-Tools und die Activity-Seite auf `_events` umgestellt sind.

**TODO:** `trackActivity()` Calls in database.ts:546-638 entfernen und Activity-Query in activity.ts auf `queryEvents()` umstellen.

### Altlast: Trigger-System duplikation

Das bestehende Trigger-System (`lib/triggers/`) feuert ebenfalls bei Dexie-Writes und hat eigene Actions (logHabit, createTask, createNote). Das Companion Brain hat ein eigenes, maechtigeres System (Domain Events + Goals + Rules). Langfristig sollte das alte Trigger-System in die Rule Engine migriert werden.

**TODO:** Bestehende Automations (`automations` Tabelle) als Pulse Rules abbilden, altes Trigger-System entfernen.

### Optimierung: Streaks-Berechnung

`useStreaks()` in streaks.ts berechnet fuer jeden Streak bis zu 90 Tage zurueck — pro Streak eine separate Dexie-Query pro Tag (worst case: 3 Streaks x 90 Tage = 270 Queries). Fuer die Pilotphase akzeptabel, langfristig sollte das via Event-basierte inkrementelle Berechnung ersetzt werden (Event "DrinkGoalReached" → Streak +1 statt taeglich zurueckschauen).

### Optimierung: DaySnapshot Query-Last

`buildSnapshot()` in day-snapshot.ts queried 5+ Dexie-Tabellen sequentiell + decrypted jeweils. Bei grossen Datenmengen koennte das >100ms dauern. Moegliche Optimierungen:
- Parallele Queries via `Promise.all()`
- Caching des Snapshots fuer 30s (statt bei jedem liveQuery-Trigger neu berechnen)
- Event-basiertes inkrementelles Update statt Full-Scan

### Optimierung: Context Document fuer LLM

Der Context Document Generator ist aktuell ein reines String-Template. Wenn das LLM-Modell besser wird (groesseres Kontextfenster), koennte das Dokument um historische Daten erweitert werden (letzte Woche, Trends). Aktuell auf ~500 Tokens optimiert fuer Gemma 4 E2B (2B Modell).

### Optimierung: Companion Chat ohne WebGPU

Der Chat funktioniert aktuell NUR mit WebGPU (Gemma lokal). Fuer Browser ohne WebGPU (Firefox, Safari) gibt es keinen Fallback. **TODO:** Server-Fallback via `mana-llm` Ollama-Endpoint integrieren, gesteuert ueber den bestehenden LLM Orchestrator Tier-System.

### Feature-Luecke: Goal-UI

Goals haben kein eigenes UI ausser der Workbench "Ziele" Page. Es gibt keine Moeglichkeit fuer den Nutzer, eigene Goals frei zu definieren (nur Templates). **TODO:** Goal-Editor-Modal mit Metric/Target-Builder.

### Feature-Luecke: Pulse Nudge-UI

Pulse Rules erzeugen Nudges, aber diese werden nur als OS-Notifications angezeigt (via Reminder-Scheduler). Es gibt keine In-App-Anzeige. **TODO:** NudgeToast Komponente oder Integration in den CompanionFeed.

---

## 16. Privacy-Garantien

| Daten | Verarbeitung | Speicherung |
|-------|-------------|-------------|
| Domain Events | Lokal (Browser) | IndexedDB, encrypted |
| Projections | Lokal (Browser) | In-Memory, nicht persistiert |
| Goals | Lokal + Sync | IndexedDB → mana-sync (encrypted) |
| Memory Facts | Lokal (Browser) | IndexedDB, encrypted |
| Context Document | Lokal (Browser) | In-Memory, nie persistiert |
| LLM Inference | Tier 1: Browser (Gemma) | Kein Server-Kontakt |
| | Tier 2: mana-llm (Ollama) | Context geht an eigenen Server |
| | Tier 3: Cloud (Gemini) | Nur mit explizitem Consent |
| Nudge Outcomes | Lokal (Browser) | IndexedDB, nicht synced |
| Tool Execution | Lokal (Browser) | Writes gehen in Module-Tabellen |

**Invariante:** Sensitive Daten (Journal, Dreams, Finance, Food) werden **nie** an Tier 2/3 gesendet — erzwungen durch `contentClass: 'sensitive'` im LLM Orchestrator.

---

## 17. Migration: _activity → _events

Die `_activity`-Tabelle bleibt vorerst bestehen (Sync-Debugging). Langfristig:

1. Phase 1-2: `_events` wird parallel zu `_activity` befuellt
2. Phase 7: Alle Consumers (Activity-Page, Debug-Tools) auf `_events` umstellen
3. Danach: `_activity`-Befuellung aus Hooks entfernen, Tabelle als deprecated markieren
4. Naechste Major-Version: Tabelle loeschen

---

## 18. Testing-Strategie

### Unit Tests
- Event Bus: emit/subscribe/unsubscribe, ordering, no re-entrant loops
- Projections: DaySnapshot korrekt aus Mock-Daten, Streak-Berechnung
- Rules: Nudge-Generierung unter verschiedenen Bedingungen
- Tools: Parameter-Validierung, Execute-Flow
- Correlations: Pearson-Berechnung, Signifikanz-Filter

### Integration Tests
- Store emit() → EventBus → EventStore → Projection Update
- Rule Engine → Nudge → UI → Outcome → Memory Update
- Companion Chat → LLM Mock → Tool Call → Store Mutation → Event

### E2E Tests
- Morgenroutine-Ritual durchspielen: 5 Steps → Daten in 3 Modulen
- Wasser-Ziel erreichen: 8x log_drink → GoalReached Event → Nudge
- Companion-Frage: "Wie war meine Woche?" → Context Document → Antwort

---

## 19. Manuelles Testen (Anleitung)

### Voraussetzungen

```bash
pnpm run mana:dev   # Startet das Dev-Server auf :5173
```

Oeffne http://localhost:5173 im Browser (Chrome/Edge mit WebGPU-Support fuer LLM).

### 1. Event Bus verifizieren

Oeffne die Browser DevTools Console und teste:

```javascript
// Zugriff auf den Event Bus (global via Module-Import im App-Kontext)
// Am einfachsten: Daten erzeugen und in IndexedDB pruefen

// 1. Erstelle einen Task in der Todo-App
// 2. Oeffne DevTools → Application → IndexedDB → mana → _events
// 3. Dort sollte ein Event mit type="TaskCreated" erscheinen

// Alternativ via Console:
const db = await indexedDB.open('mana');
// Events sind in der _events Tabelle mit type, payload, meta
```

**Was zu pruefen ist:**
- Neuen Task erstellen → `TaskCreated` Event in `_events`
- Task erledigen → `TaskCompleted` Event
- Drink loggen → `DrinkLogged` Event
- Mahlzeit loggen → `MealLogged` Event
- Ort besuchen → `PlaceVisited` Event

### 2. Projections testen

Die Projections sind live-reaktiv. Am einfachsten via Browser Console:

```javascript
// DaySnapshot ist eine Svelte-reaktive Query.
// In einer Svelte-Komponente:
//   import { useDaySnapshot } from '$lib/data/projections';
//   const day = useDaySnapshot();
//   console.log(day.value);

// Zum manuellen Testen: Daten erzeugen und schauen ob DaySnapshot reagiert
// 1. Gehe zu /drink und logge ein Glas Wasser
// 2. Die DaySnapshot.drinks.water.ml sollte sich erhoehen
// 3. Gehe zu /todo und erstelle+erledige einen Task
// 4. DaySnapshot.tasks.completed sollte steigen
```

### 3. Companion Chat testen

1. Navigiere zu `/companion`
2. Klicke "Gespraech starten"
3. **WICHTIG:** Der Chat nutzt `@mana/local-llm` (Gemma, ~500MB Download).
   Beim ersten Mal muss das Modell heruntergeladen werden. Das dauert
   je nach Verbindung 1-5 Minuten. WebGPU muss verfuegbar sein
   (Chrome 113+, Edge 113+, kein Firefox/Safari).
4. Teste Nachrichten:
   - "Wie sieht mein Tag aus?" → Sollte DaySnapshot-Daten zusammenfassen
   - "Log mir ein Glas Wasser" → Sollte `log_drink` Tool aufrufen
   - "Erstelle einen Task: Einkaufen gehen" → Sollte `create_task` Tool aufrufen
   - "Wie viel Wasser habe ich heute getrunken?" → Nutzt Context Document

**Ohne WebGPU (Fallback):** Der Chat wird fehlschlagen wenn kein WebGPU
verfuegbar ist. In dem Fall die Engine temporaer auf einen Server-Endpoint
umbauen oder den Chat-Flow mit Mock-Responses testen.

### 4. Rituale testen

1. Navigiere zu `/companion/rituals`
2. Klicke "+ Neu" → waehle "Morgenroutine"
3. Klicke den Play-Button neben der erstellten Routine
4. Der RitualRunner zeigt Step fuer Step:
   - Step 1: "Glas Wasser trinken" → Klick "Ausfuehren" → loggt 250ml Wasser
   - Step 2: "Dein Tag auf einen Blick" → zeigt heutige Events
   - Step 3: "Heutige Tasks" → zeigt faellige Tasks
   - Step 4: "Deine Streaks" → zeigt Streak-Status
5. "Weiter" / "Fertig" navigiert durch die Steps
6. Pruefe in `/drink` ob das Wasser tatsaechlich geloggt wurde

### 5. Goals testen

Goals sind aktuell nur programmatisch testbar (kein UI). Via Console:

```javascript
// In einer Svelte-Komponente oder via Hot-Module:
import { goalStore, GOAL_TEMPLATES } from '$lib/companion/goals';

// Goal aus Template erstellen
const goal = await goalStore.createFromTemplate(GOAL_TEMPLATES[0]); // "8 Glaeser Wasser"
console.log(goal);

// Jetzt ein Wasser loggen → Goal currentValue sollte steigen
// (der Goal-Tracker subscribed auf den Event Bus)
```

### 6. Memory + Correlations testen

Braucht mindestens 7-14 Tage an Daten. Zum Testen mit Seed-Daten:

```javascript
// Pattern Extraction manuell ausfuehren:
import { extractAllPatterns } from '$lib/companion/memory';
await extractAllPatterns();

// Extrahierte Facts pruefen:
import { memoryStore } from '$lib/companion/memory';
const facts = await memoryStore.getFacts();
console.log(facts);

// Correlations berechnen:
import { computeCorrelations } from '$lib/data/projections';
const corrs = await computeCorrelations();
console.log(corrs);
```

**Hinweis:** Mit weniger als 7 Events pro Typ oder 14 Tagen Daten liefern
die Extractors und Correlations keine Ergebnisse — das ist beabsichtigt,
um Rauschen zu vermeiden.

### 7. Pulse Rules testen

Rules laufen ueber den Reminder-Scheduler (30s Intervall). Zum manuellen Test:

```javascript
import { evaluateRules } from '$lib/companion/rules';
import { useDaySnapshot } from '$lib/data/projections/day-snapshot';
import { useStreaks } from '$lib/data/projections/streaks';

// In einer Komponente:
const day = useDaySnapshot();
const streaks = useStreaks();
const nudges = evaluateRules(day.value, streaks.value, []);
console.log(nudges);
```

### 8. IndexedDB direkt inspizieren

Alle Companion-Daten liegen in IndexedDB (`mana` Database):

| Tabelle | Inhalt |
|---------|--------|
| `_events` | Domain Event Stream (type, payload, meta) |
| `companionGoals` | Aktive Ziele mit currentValue |
| `companionConversations` | Chat-Gespraeche |
| `companionMessages` | Chat-Nachrichten + Tool-Calls |
| `rituals` | Erstellte Rituale |
| `ritualSteps` | Ritual-Steps (pro Ritual) |
| `ritualLogs` | Completion-Logs |
| `_memory` | Extrahierte Muster (nach extractAllPatterns) |
| `_nudgeOutcomes` | Nudge-Reaktionen |
| `pendingProposals` | Staged AI-Intents (siehe §20) |

Oeffne: DevTools → Application → IndexedDB → mana → [Tabelle]

---

## 20. AI Workbench (ab 2026-04-14)

Der Companion wird schrittweise vom **Chatbot-mit-Tools** zum **zweiten Akteur im System**:
er arbeitet parallel zum Menschen in den bestehenden Modulen, User sieht jede Aenderung
inline und approved / reverted wo noetig. Fundament laeuft; Missions + Runner folgen.

### 20.1 Actor-Modell

Jeder Write im System traegt ab jetzt einen expliziten Actor. Source of Truth ist die
Data-Schicht (Events + Records + Sync-Payload), nicht ambient Kontext.

```ts
type Actor =
  | { kind: 'user' }
  | { kind: 'ai'; missionId; iterationId; rationale }
  | { kind: 'system'; source: 'projection' | 'rule' | 'migration' };
```

- **Events**: `EventMeta.actor: Actor` (required — kein Legacy-Fallback)
- **Records**: Dexie-Hooks stempeln `__lastActor` + feldweise `__fieldActors`
  (parallel zu `__fieldTimestamps`)
- **Sync-Payload**: `_pendingChanges.actor` geht an mana-sync (Go/Postgres-Migration offen)
- **Ambient-Hilfe**: `runAs(actor, fn)` an definierten Boundaries — Primitive frieren
  den Actor synchron ein, bevor er ueber `setTimeout` / `queueMicrotask` verloren geht

Code: `apps/mana/apps/web/src/lib/data/events/actor.ts`

### 20.2 Policy-Layer

AI-Writes werden nicht automatisch ausgefuehrt. Per-Tool-Policy entscheidet:

| Decision | Bedeutung |
|----------|-----------|
| `auto`   | Direkt ausfuehren, Actor in Events + Records stempeln |
| `propose`| Als Proposal in `pendingProposals` stagen, User approved inline |
| `deny`   | Refuse — Tool niemals fuer AI zugaenglich |

Default (`DEFAULT_AI_POLICY`): lesendes / append-only self-state → `auto`, alles Mutierende
→ `propose`. User / System Actors umgehen die Policy.

Code: `apps/mana/apps/web/src/lib/data/ai/policy.ts`

### 20.3 Proposals

```ts
interface Proposal {
  id, createdAt, expiresAt?, status: 'pending' | 'approved' | 'rejected' | 'expired';
  actor: { kind: 'ai', missionId, iterationId, rationale };
  missionId?, iterationId?;           // fuer Workbench-Queries indiziert
  intent: { kind: 'toolCall', toolName, params };
  decidedAt?, decidedBy?, userFeedback?;
}
```

Proposals sind **lokal only** — sie syncen nicht. Der approved Write syncet
normal durch den Modulpfad, mit dem AI-Actor attribuiert.

Approval-Flow: `approveProposal(id)` laeuft das gespeicherte Intent unter
`runAsAsync(aiActor, () => executeToolRaw(...))`. `executeToolRaw` umgeht
die Policy — sonst wuerde sie das Intent sofort wieder in ein Proposal
zurueckwerfen.

Code: `apps/mana/apps/web/src/lib/data/ai/proposals/`

### 20.4 Ghost-UI in Pilot-Modul (todo)

`<AiProposalInbox module="todo" />` ist die **opt-in Komponente**: pro Modulseite
ein Einzeiler. Rendert pending Proposals als dashed Ghost-Karten ueber dem echten
Content — zero UI wenn keine anstehen. Approve / Reject inline. Filter ueber
Tool-Registry: Proposal fuer `create_task` landet auf `/todo`, `create_event` auf
`/calendar`, etc.

Code:
- `apps/mana/apps/web/src/lib/components/ai/AiProposalInbox.svelte`
- `apps/mana/apps/web/src/lib/data/ai/proposals/queries.ts`

### 20.5 Roadmap

- [x] Schritt 1 — Actor-Attribution (Events + Records + Sync-Payload)
- [x] Schritt 2 — Policy-Config + `pendingProposals` + Propose-Path im Executor
- [x] Schritt 3 — Ghost-UI im Todo-Pilot (`<AiProposalInbox />`)
- [x] Schritt 4 — Missions-Datenmodell + Planner-LLM-Task
  - Dexie `aiMissions` (v18), cross-device synct
  - `aiPlanTask` als LlmTask (minTier browser, contentClass personal)
  - Strikter JSON-Parser mit Tool-Allowlist + Rationale-Zwang
- [x] Schritt 5 — In-App MissionRunner (Foreground-Tick in `(app)/+layout.svelte`)
  - `runMission(id, deps)` + `runDueMissions(now, deps)` — injiziert, testbar
  - Default-Input-Resolver für Notes / Kontext / Goals
  - 60-Sekunden-Tick, Overlap-Guard, idempotent
- [x] Schritt 6 — Missions-UI unter `/companion/missions`
  - Create-Form mit Konzept-Markdown + Objective + Cadence-Picker
  - List / Detail mit pause / resume / complete / delete / "Jetzt ausführen"
  - Iteration-History + pro-Iteration Freitext-Feedback-Textarea
  - `<MissionInputPicker>`-Komponente mit Indexer-Registry, Default-Indexer
    für notes / kontext / goals (symmetrisch zu den Resolvern)
- [x] Schritt 7 — Workbench-Timeline-Lens unter `/companion/workbench`
  - Live-Query `_events` gefiltert auf `actor.kind === 'ai'`
  - `bucketByIteration` gruppiert Events pro Mission-Iteration, Rationale
    einmal pro Bucket statt pro Event
  - Filter: Mission (per query-string) + Modul (dropdown), Deep-Link ins
    Modul pro Event
  - **Revert-per-Iteration**: Button pro Bucket, `data/ai/revert/`
    Registry mit Inverse-Ops für TaskCreated/Completed, CalendarEvent-
    Created, PlaceCreated, DrinkLogged. Newest-first Reihenfolge,
    RevertStats-Summary ("X zurückgenommen · Y nicht unterstützt").
- [x] Schritt 7a — System-Actor-Wrapping für Projections (streaks-Tracker)
- [x] Schritt 8 — mana-sync Go + Postgres-Migration für `actor`-Feld
  - `sync_changes.actor JSONB` Column (idempotent `ADD COLUMN IF NOT EXISTS`)
  - `Change.Actor json.RawMessage` Wire-Shape, opaque Server-seitig
  - `RecordChange` + alle drei SELECT-Pfade (GetChangesSince / GetAll /
    StreamAllUserChanges) lesen/schreiben Actor
  - Webapp-Parität: `SyncChange.actor?` + Push-Payload + `applyServerChanges`
    stempelt `__lastActor` + `__fieldActors` aus eingehenden Changes
    → **cross-device Attribution geschlossen**
- [x] Schritt 9 — Server-side `mana-ai` Bun-Service (v0.3, Close-the-Loop)
  - `services/mana-ai (3067
  - `@mana/shared-ai` Package als Single-Source-of-Truth für Planner-
    Prompt + Parser + Typen (Webapp + Service importieren identisch)
  - Field-level LWW-Replay von `sync_changes` in `db/missions-projection.ts`
  - Tick-Loop: Due Missions → Planner → mana-llm → Parse → Write-Back
  - `db/iteration-writer.ts` appendet Server-Iteration via RLS-scoped
    `withUser` Transaktion mit Actor `{kind:'system', source:'mission-runner'}`
  - Webapp-Staging-Effect (`server-iteration-staging.ts`) übersetzt
    eingehende `source:'server'` Iterationen in lokale Proposals pro
    PlanStep mit AI-Actor-Attribution; idempotent via proposalId-Marker
  - Server-side Input-Resolver (`db/resolvers/`) für plaintext Tabellen
    (goals); encrypted Tables bleiben privacy-by-design browser-only
  - Contract-Test via `@mana/shared-ai`'s `AI_PROPOSABLE_TOOL_NAMES` +
    Runtime-Drift-Guard im Service
  - `mana_ai.mission_snapshots` — inkrementeller Snapshot, `listDueMissions`
    ist ein indexed SELECT statt O(N) LWW-Replay
  - **Observability**: `/metrics` (Prom-Counter für ticks/plans/parse-
    failures/snapshots + Histogramme für tick-, planner-, HTTP-Latenz)
    scraped vom `mana-ai`-Job in `docker/prometheus/prometheus.yml`.
    `/health` als blackbox-internal Probe → surfaces auf **status.mana.how**
    als „Mana AI Runner".

**Die Workbench-Roadmap ist damit funktional abgeschlossen.**

### 20.5a Symmetrische Registries: Resolver vs. Indexer

Zwei parallele Module-Opt-in-Points für die AI-Layer:

| Registry | Richtung | Nutzer | Beispiel |
|----------|----------|--------|----------|
| `input-resolvers.ts` | `Ref → Prompt-Text` | Runner (Planner-Kontext) | `notes/abc-123 → "Titel\nContent…"` |
| `input-index.ts` | `Module → Candidates[]` | UI (Picker) | `notes → [{label:"Idee", hint:"…"}]` |

Beide werden im selben `default-resolvers.ts` zusammen registriert, damit die Paare synchron bleiben. Neues Modul anbinden = `registerInputResolver(name, resolver) + registerInputIndexer(name, indexer)` — keine Änderungen am AI-Core nötig.

### 20.6 Offene Follow-ups

- **mana-sync (Go) + Postgres-Migration** fuer `actor`-Feld im pendingChange-Payload
- **System-Actor** in Projections + Rule-Engine wrappen (heute im User-Kontext)
- **Inbox-Rollout** auf weitere Module (Kalender, Notes, …) sobald Tools dort
  in `DEFAULT_AI_POLICY` eingetragen sind

### 20.7 Manueller Test

Browser-Console auf `/todo`:

```js
const { executeTool } = await import('/src/lib/data/tools/executor');
await executeTool(
  'create_task',
  { title: 'Test von der KI' },
  { kind: 'ai', missionId: 'demo', iterationId: '1', rationale: 'Beispiel-Proposal' }
);
```

Ghost-Karte erscheint sofort ueber der Task-Liste.

## 21. Mission Key-Grant (ab 2026-04-15, in Arbeit)

Opt-in Mechanismus der es `mana-ai` erlaubt, Missions auf **encrypted** Tabellen (notes, tasks, events, journal, kontext) serverseitig auszufuehren — ohne dass ein Browser-Tab des Users offen sein muss. Ohne Grant bleibt der Foreground-Runner zustaendig; das ist der Default und aendert sich nicht.

Vollstaendiger Plan: [`docs/plans/ai-mission-key-grant.md`](../plans/ai-mission-key-grant.md). Ideen-Kontext: [`docs/future/AI_AGENTS_IDEAS.md`](../future/AI_AGENTS_IDEAS.md#1-encrypted-tables-serverseitig-nutzbar-machen).

### Flow

1. **Consent** — User aktiviert Mission mit encrypted Input → `MissionGrantDialog` erklaert Record-Scope und TTL, fragt explizit um Erlaubnis. Zero-Knowledge-User sehen den Dialog nicht; Grant ist dort hart deaktiviert.
2. **Derivation** — Webapp ruft `deriveMissionDataKey(masterKey, { version, missionId, tables, recordIds })` aus `@mana/shared-ai`. HKDF-SHA256 mit `missionId` als Salt; Scope-Binding im `info`-String → jede Scope-Aenderung erzeugt kryptografisch einen anderen Key, alte Grants werden automatisch ungueltig.
3. **Wrap** — `mana-auth` `POST /me/ai-mission-grant` wrappt den MDK mit dem RSA-OAEP-2048 Public-Key von `mana-ai` (aus `MANA_AI_PUBLIC_KEY_PEM`). Antwort: `{ wrappedKey, derivation, issuedAt, expiresAt }` → Webapp schreibt das als `Mission.grant`.
4. **Sync** — Grant-Blob fliesst ueber das normale Sync-System an `mana_sync`. Keine Sonderbehandlung — `wrappedKey` ist bereits RSA-geschuetzt.
5. **Unwrap** — `mana-ai` holt beim Tick den privaten Key (`MANA_AI_PRIVATE_KEY_PEM`), entwrappt den MDK nur im Prozessspeicher, liest allowlisted Records aus `sync_changes`, entschluesselt, plant.
6. **Audit** — jede Entschluesselung schreibt eine Zeile in `mana_ai.decrypt_audit` (RLS-scoped auf `app.current_user_id`). User kann das in der Workbench unter "Mission -> Datenzugriff" einsehen.
7. **Lifecycle** — Grant hat Default-TTL 7 Tage rollend. Revoke via Workbench-Button → `grant=null`, Mission pausiert (`state='grant-revoked'`). Abgelaufen → Runner ueberspringt mit `state='grant-missing'`, Foreground-Runner uebernimmt beim naechsten Tab-Open.

### Komponenten (Status)

| Komponente | Wo | Status |
|---|---|---|
| Canonical HKDF + Types | `packages/shared-ai/src/missions/grant.ts` | done (Phase 1a) |
| `Mission.grant` Feld | `packages/shared-ai/src/missions/types.ts` | done |
| `mana_ai.decrypt_audit` + RLS | `services/mana-ai/src/db/migrate.ts` | done (Phase 1b) |
| `MANA_AI_PUBLIC_KEY_PEM` / `MANA_AI_PRIVATE_KEY_PEM` config | auth + ai configs | done (Phase 0) |
| `POST /me/ai-mission-grant` Endpoint | `services/mana-auth/src/routes/encryption-vault.ts` | Phase 1c |
| Server-side unwrap helper | `services/mana-ai/src/crypto/unwrap-grant.ts` | Phase 1d |
| Encrypted input resolver | `services/mana-ai/src/db/resolvers/encrypted.ts` | Phase 2 |
| Consent UI + Revoke | `apps/mana/apps/web/src/lib/components/ai/MissionGrantDialog.svelte` | Phase 3 |

### Privacy-Garantien

- **Zero-Knowledge-User bleiben Zero-Knowledge.** Die Webapp verweigert das Anlegen eines Grants, wenn `vault.zeroKnowledge=true`. Endpoint pruefts zusaetzlich serverseitig.
- **Kein Key-Cache.** `mana-ai` entwrappt den MDK pro Tick neu und vergisst ihn im `finally`. Minimiert RAM-Dump-Window auf die Tick-Dauer.
- **Scope-Verletzung = Crypto-Failure.** Record-IDs sind in die Key-Derivation gebunden. Runtime-Allowlist-Check ist belt+braces, nicht die alleinige Verteidigung.
- **Keine Write-Grants.** Server staget nur Proposals; User genehmigt wie bisher. Grant = read-only.

### Nicht-Ziele

- Cross-User-Missions (pro Grant genau ein User).
- Automatische Key-Rotation (Master-Key-Rotation invalidiert alle Grants → User re-consented beim naechsten Edit).
- Grant-Sync-Konflikte (werden ueber normales LWW aufgeloest; bei Scope-Mismatch wirft der Resolver `scope-violation` und die Mission pausiert).

## 22. Multi-Agent Workbench (ab 2026-04-15)

Upgrade von Single-User, Single-AI ("Mana") zu Single-User, Multi-Agent. Missionen gehoeren jetzt einem benannten Agent; Scenes koennen als Lens an einen Agent gebunden werden. Full context + decisions: [`docs/plans/multi-agent-workbench.md`](../plans/multi-agent-workbench.md).

### Datenmodell

```
Agent {
  id, name (unique per user), avatar, role,
  systemPrompt, memory,   // encrypted at rest
  policy: AiPolicy,       // per-tool + per-module + global default
  maxConcurrentMissions, maxTokensPerDay,
  state: active|paused|archived
}

Mission.agentId?: string      // owning agent; legacy records backfill-stamped
WorkbenchScene.viewingAsAgentId?: string  // UI lens, does not affect data scope

Actor {
  kind: 'user' | 'ai' | 'system',
  principalId: string,        // userId | agentId | 'system:<source>'
  displayName: string,        // cached at write time — rename doesn't rewrite history
  // AI-only:
  missionId?, iterationId?, rationale?
}
```

### Identity flow

1. User creates an agent in `/ai-agents`. Default "Mana" agent is auto-bootstrapped on first login and inherits the existing user-level policy.
2. Missions are created under an agent (`AgentPicker` in the create flow). Legacy missions were backfilled to the default agent via localStorage-sentinelled one-shot migration.
3. `executor.executeTool` loads `getAgent(actor.principalId).policy` for every AI write; `mana-ai` does the same server-side via `agent_snapshots` (LWW projection mirroring `mission_snapshots`).
4. Every write stamps `Actor.displayName = agent.name` at write time. Workbench timeline + Revert remain correct even after the agent is renamed or deleted (ghost-agent marker on tab).
5. `mana-ai` tick filters `AI_AVAILABLE_TOOLS` by agent policy before the prompt, injects plaintext `systemPrompt + memory` in an `<agent_context>` delimiter block (ciphertext fields stay server-invisible by design — foreground runner picks up encrypted context).
6. Scenes optionally bind `viewingAsAgentId`. Pure UI lens: SceneAppBar shows the agent avatar on the scene tab, Workbench timeline defaults its filter to that agent. No data-scope change.

### Gate order in the server tick

Before an LLM call even happens:
- `agent.state === 'archived'` → skip silently, bump `agentDecisionsTotal{decision='skipped-archived'}`
- `agent.state === 'paused'` → same with `skipped-paused`
- `activeRuns[agentId] >= agent.maxConcurrentMissions` → `skipped-concurrency`, defer to next tick
- Otherwise → `ran`

Missions without an owning agent don't produce this metric; `plansWrittenBackTotal` is the universal "did we run" counter.

### Scene-Agent binding semantics

`scene.viewingAsAgentId` is a **lens**, not a scope. The open apps in the scene still read the same user data regardless of which agent (if any) is bound. The binding drives:
- Agent avatar on the scene tab (SceneAppBar)
- Default `agent` filter in the AI Workbench timeline
- Default selected agent when creating a mission from a bound scene (future — Phase 8 polish)

This is deliberately orthogonal: one agent can appear in many scenes; one scene can be unbound ("neutral workspace"). Binding is set/changed via the scene context menu → "An Agent binden…" dialog.

### Nicht-Ziele

- **Kein Agent-to-Agent Messaging.** Agents laufen unabhaengig.
- **Kein Meta-Planner ueber Agents.** Agents erzeugen sich keine Missionen selbst; der User bleibt Mission-Creator.
- **Keine Team-Features.** Andere User / geteilte Daten kommen in einem separaten Plan nach dieser Iteration.
- **Keine Agent-Memory-Self-Modification.** Memory wird nur vom User editiert.
- **Keine Per-Agent-Encryption-Domains.** Alle Agents sehen alle Daten des einen Users. Mission-Key-Grants bleiben per-Mission.

## 23. Reasoning Loop + Research Pre-Step + Debug Log (ab 2026-04-15)

### 23.1 Reasoning Loop

The foreground Runner (`apps/mana/apps/web/src/lib/data/ai/missions/runner.ts`) wraps the plan→stage pipeline in a loop of up to `MAX_REASONING_LOOP_ITERATIONS` (5) rounds per iteration:

```
while (budget remaining):
    plan = planner(mission, loopInputs, availableTools)
    if plan.steps == 0 → break (agent done)
    for each step:
        resolve policy
        auto  → execute inline, collect {autoData, autoMessage}
        propose → stage proposal, set humanInLoop=true
        fail  → record step as failed
    if humanInLoop → break (wait for user approval)
    if no auto-outputs → break (no progress)
    loopInputs += synthetic ResolvedInput("Zwischenergebnisse Runde N",
                    formatted tool outputs as JSON fenced blocks)
```

This enables read→reason→act missions ("list notes → tag each one") in a single user-triggered run. The `StageOutcome` type carries `autoData` + `autoMessage` so auto-executed tool payloads thread back into the prompt without a second executor call.

**Budget**: 5 loop iterations = 5 LLM calls max. Planner `maxTokens` raised to 4096 to accommodate batch output (up to ~15 step objects). System prompt teaches the planner about the loop: "read-only tools auto-execute, write-tools get staged, emit all batch writes in one plan because staging ends the turn."

### 23.2 Research Pre-Step

Before the planner runs, if the mission objective matches `/recherchier|research|news|finde|suche|aktuelle|neueste/i`, the Runner calls the `news-research` module's RSS pipeline:

1. `discoverByQuery(objective, lang)` — finds matching RSS feeds
2. `searchFeeds(feedUrls, objective, {limit: 10})` — ranks articles by relevance
3. Results formatted as a `ResolvedInput` with explicit instructions ("für jeden relevanten Artikel rufe `save_news_article(url)` auf")

Chosen over the deep-research pipeline (`/api/v1/research/start-sync`) because: no credits consumed, faster (~2s vs ~12s), no SearXNG dependency, uses own RSS infrastructure. The deep-research pipeline still exists for the questions module.

Failures throw explicitly (0 feeds or 0 articles) — the runner catches and injects a "research failed" `ResolvedInput` with the error message so the planner doesn't hallucinate URLs.

#### Server-Side Research (mana-ai, ab v0.6)

The `mana-ai` background runner mirrors the client-side research pre-step. `NewsResearchClient` (`services/mana-ai/src/planner/news-research-client.ts`) calls `mana-api`'s `POST /api/v1/news-research/discover` + `/search` directly over the Docker network (`MANA_API_URL`). The same `RESEARCH_TRIGGER` regex is used; when it matches, results are injected as `ResolvedInput { id: '__web-research__' }` before the planner prompt is built.

Key differences from the client-side path:
- No SvelteKit context — pure HTTP fetch.
- 15s timeout on discover, 30s on search (tighter than client because the tick has a 60s cadence).
- Graceful null on any failure — the planner just runs without research context; tick doesn't crash.
- No `discoverByQuery` / `searchFeeds` module imports — the client ships those from `@mana/shared-rss`; the server calls the API endpoints which wrap the same logic.

This makes the Recherche-Agent and Today-Agent fully autonomous (no browser tab required). `research_news` is also registered as a proposable tool so the planner can explicitly request additional research as a PlanStep.

### 23.3 Kontext Auto-Inject

The user's `kontextDoc` singleton is automatically appended to every planner call as a standing-context `ResolvedInput`, unless the mission already links it as an explicit input. Decrypted client-side only — the server-side mana-ai runner skips this (encryption barrier; needs a Key-Grant for server access).

### 23.4 Debug Log

Per-iteration diagnostic capture in local-only Dexie table `_aiDebugLog` (schema v20, never synced — contains decrypted prompt content). Keyed by `iterationId`, capped at 50 rows.

**Captured per iteration:**
- `plannerCalls[]` — array (one per loop round): `{systemPrompt, userPrompt, rawResponse, latencyMs}`
- `loopSteps[]` — auto-executed tool log: `{loopIndex, toolName, params, outputPreview}`
- `preStep` — web-research outcome or kontext injection state
- `resolvedInputs[]` — full list the planner saw (grows across loop rounds)

**UI:** `<AiDebugBlock iterationId={id}>` renders an expandable panel under each iteration card:
- Summary chip: "2× LLM · 4200ms · 1× Auto-Tool"
- Collapsible sections: Pre-Step, Resolved Inputs (each individually expandable), Auto-Tool outputs, per-LLM-call prompt+response
- "📋 JSON" button copies the entire debug entry to clipboard

**Toggle:** `localStorage.setItem('mana.ai.debug', '1')`. Defaults to enabled in DEV builds, disabled in production. Checkbox in mission-detail header exposes the toggle without DevTools.

### 23.5 New Proposable Tools

| Tool | Module | Policy | Purpose |
|------|--------|--------|---------|
| `save_news_article` | news | propose | Save URL to reading list via Readability extract |
| `list_notes` | notes | auto | List notes (id, title, excerpt) for planner context |
| `update_note` | notes | propose | Full overwrite of title/content (destructive) |
| `append_to_note` | notes | propose | Append text to end of note (non-destructive) |
| `add_tag_to_note` | notes | propose | Append `#Tag` idempotently (deduplicates, case-insensitive) |

All propose-tools registered in `@mana/shared-ai` `AI_PROPOSABLE_TOOL_NAMES` and mirrored in `services/mana-ai/src/planner/tools.ts` (boot-time drift guard). `AiProposalInbox` mounted on `/news` and `/notes` pages.
