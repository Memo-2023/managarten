---
title: 'AI Workbench: Actor-Attribution, Missions, Key-Grants + Server-Side mana-ai Deployment'
description: 'Größter AI-Tag: Actor-Attribution auf allen Records + Events + Sync, Mission-System (Planner + Runner + Input-Picker + Proposals), Key-Grant-System für verschlüsselte Server-Side-Runs, mana-ai Service deployed, Quiz-Modul, Multi-Agent-Vorbereitung (Phase 1-3), Workbench-Redesign mit Scene-Header + PageCarousel.'
date: 2026-04-14
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'ai-workbench',
    'actor-attribution',
    'missions',
    'key-grants',
    'mana-ai',
    'proposals',
    'planner',
    'runner',
    'quiz',
    'multi-agent',
    'workbench',
    'scene-header',
  ]
featured: true
commits: 65
readTime: 22
stats:
  filesChanged: 732
  linesAdded: 22522
  linesRemoved: 3997
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 65
workingHours:
  start: '2026-04-14T08:00'
  end: '2026-04-14T23:59'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Actor-Attribution** auf allen Records, PendingChanges und DomainEvents — jeder Schreibvorgang ist einem Actor (user/ai/system) zugeordnet
- **Mission-System** komplett: Planner → Runner → Proposals → Input-Picker → Workbench-Timeline
- **Key-Grant-System** für verschlüsselte Server-Side-Runs — scoped Decryption für mana-ai
- **mana-ai Service** deployed auf mana-ai.mana.how mit Prometheus-Metrics
- **Quiz-Modul** — Quizzes erstellen und spielen
- **Multi-Agent Vorbereitung** — Phase 1-3: Actor-Refactor, Agent CRUD, Server-Side Agent-Awareness
- **Workbench-Redesign** — Scene-Header, PageCarousel, Inline-Edit, Width-Picker

---

## Actor-Attribution — Wer hat was geschrieben?

Das Fundament für das AI Workbench: **jeder Schreibvorgang** in der App wird einem Actor zugeordnet.

### Actor-Typen

```typescript
type Actor = {
	kind: 'user' | 'ai' | 'system';
	principalId: string; // userId | agentId | 'system:streak-tracker'
	displayName: string; // gecached beim Schreiben
};
```

### Dexie-Hooks (Phase 1)

Die `database.ts` Hooks stempeln jetzt bei jedem Write:

- `__lastActor` — der Actor des letzten Schreibvorgangs
- `__fieldActors` — per-field Actor-Tracking (welcher Actor hat welches Feld zuletzt geändert)

### DomainEvents (Phase 1)

Jedes DomainEvent trägt jetzt den emittierenden Actor. Damit kann der Workbench-Timeline filtern: "Zeige nur AI-Änderungen" oder "Zeige nur meine Änderungen".

### Sync-Integration (Phase 1 → mana-sync)

Drei Commits für Sync-Actor-Support:

1. **mana-sync**: `actor` JSON-Feld auf jeder `sync_changes` Row persistiert
2. **Webapp Sync Client**: Actor wird durch den gesamten Sync-Pfad gethread
3. **Incoming Server Changes**: `__lastActor` + `__fieldActors` auf eingehende Server-Änderungen gestempelt

### System-Actor

Projections (z.B. Streak-Tracker) wrappen ihre Writes in einen `system:streak-tracker` Actor. Damit unterscheidet der Workbench-Timeline zwischen echten AI-Aktionen und System-Automatismen.

---

## Mission-System — von Planner bis Workbench

Missions sind langlebige autonome Arbeitsaufträge für den AI-Companion. Heute das komplette System aufgebaut.

### Schritt 1: Mission Datamodel

```typescript
interface Mission {
	id: string;
	title: string;
	objective: string; // Was soll der Companion tun?
	inputs: MissionInput[]; // Verknüpfte Daten (Notes, Goals, ...)
	cadence: 'once' | 'daily' | 'weekly';
	status: 'active' | 'paused' | 'completed';
	iterations: Iteration[]; // Jede Ausführung
}
```

### Schritt 2: Mission Planner (LLM)

Der Planner analysiert das Objective + die Inputs und erzeugt einen Plan:

- Prompt-Template mit Context-Document, Input-Zusammenfassungen, verfügbaren Tools
- Parser für strukturierte LLM-Outputs
- Extrahiert nach `@mana/shared-ai` für Server-Side Reuse

### Schritt 3: MissionRunner

Orchestriert Planner + Tool-Execution + Proposal-Staging:

```
Mission.objective + inputs
  ↓ Planner (LLM)
Plan: [{ tool: 'create_task', params: { title: '...' } }, ...]
  ↓ Policy Check
  ↓ auto → execute silent
  ↓ propose → create Proposal card
  ↓
Iteration { status, plan, results, proposals }
```

- Production Wiring mit Default-Input-Resolvers (Notes, Goals, Kontext)
- Live Phase + Elapsed + Cancel für laufende Iterationen

### Schritt 4: Policy-Gated Tool Executor

Jedes Tool hat eine Policy: `auto` (silent ausführen) oder `propose` (User muss approven):

- `auto`: Read-only Tools wie `list_tasks`, `get_task_stats`
- `propose`: Write-Tools wie `create_task`, `complete_task`

PendingProposals-Lifecycle mit Status-Tracking.

### Schritt 5: Inline Proposal Inbox

`<AiProposalInbox module="todo" />` in der Todo-Seite zeigt pending Proposals inline:

- Approve-Button → Tool wird ausgeführt
- Reject-Button → Proposal wird verworfen

### Schritt 6: Missions UI + Input Picker

- Missions-Liste unter `/companion/missions`
- **Input-Picker**: Notes, Kontext-Dokument und Goals als Mission-Inputs verlinken
- Resolver/Indexer-Symmetrie dokumentiert

### Schritt 7: Workbench Timeline

Cross-Module AI-Activity-Lens auf `/ai-workbench`:

- Gruppiert nach Mission-Iteration
- Per-Module-Filter
- Actor-Filter (nur AI / nur User / alle)

### Revert-per-Iteration

Button pro Iteration: "Diese AI-Änderungen rückgängig machen":

- TaskCreated → Delete
- TaskCompleted → Uncomplete
- Newest-first Reihenfolge

---

## Key-Grant-System — Verschlüsselte Server-Side-Runs

Das größte Sicherheits-Feature des Tages. Problem: mana-ai läuft server-side und braucht Zugriff auf verschlüsselte User-Daten für Missions. Aber der Master-Key darf nicht permanent beim Server liegen.

### Lösung: Mission Key-Grants

1. **Contract** in `@mana/shared-ai`: Definiert das Grant-Format (scoped, zeitlich begrenzt, auditiert)
2. **mana-auth Endpoint**: `POST /api/v1/vault/grant` — erzeugt einen scoped Key-Grant für eine spezifische Mission
3. **Consent UI**: User muss explizit bestätigen: "Ich erlaube dem Companion, für diese Mission meine Daten zu lesen"
4. **Audit Tab**: Workbench zeigt alle Key-Grants mit Zeitstempel, Scope und Status
5. **mana-ai Resolver**: Encrypted Resolver nutzt den Key-Grant um Inputs zu decrypten — nur die Inputs die die Mission braucht
6. **Rollout-Gating**: Feature-Flag `PUBLIC_AI_MISSION_GRANTS`, Alerts bei Grant-Nutzung, Runbook, User-Docs

### Svelte $state Proxy Bug

Zwei Debug-Fixes:

- `structuredClone` → JSON-roundtrip `deepClone`: Svelte $state Proxies sind nicht structuredClone-able
- Proxies vor Dexie-Writes strippen (Dexie kann keine Proxies speichern)

---

## mana-ai Service — Server-Side Mission Runner

Neuer Service `mana-ai` (Port 3067):

### v0.1: Scaffold

- Hono/Bun-Service mit Auth-Middleware
- Tick-Loop: Periodisch active Missions abfragen und Iterations ausführen
- Dockerfile + Docker-Compose-Wiring

### v0.2: Real LLM Calls

- Shared-AI Planner + Parser integriert
- Echte mana-llm API-Calls statt Mocks
- Write-Back: Server-Iterations werden via Sync an den Client gepusht

### Deploy

- `mana-ai.mana.how` via Cloudflare Tunnel
- Prometheus `/metrics` Endpoint
- status.mana.how Integration
- Materialized Mission-Snapshots (Performance: kein Full-Replay pro Tick)
- RLS-scoped Mission-Reads (User sieht nur eigene Missions)

### Infrastructure

- Port-Clash mit news-ingester (3066 → 3067) behoben
- shared-logger + shared-ai in Dockerfiles
- mana-crawler in den Dev-Stack verdrahtet
- Dev-User-Setup: Credit-Balance + Admin-Role

---

## Quiz-Modul

Neues Modul zum Erstellen und Spielen von Quizzes:

- **Quiz-Builder**: Fragen + Antworten + Erklärungen erstellen
- **Play-Mode**: Multiple-Choice mit Score-Tracking
- **Edit**: Bestehende Fragen bearbeiten
- **Guest Seed**: Demo-Quiz für unangemeldete Besucher

---

## Multi-Agent Vorbereitung (Phase 1-3)

Drei Phasen für das Multi-Agent-System:

### Phase 1: Identity-Aware Actor

Actor-Refactor: Agents sind jetzt first-class Actors mit eigener Identity:

```typescript
{ kind: 'ai', principalId: 'agent_abc123', displayName: 'Recherche-Agent' }
```

### Phase 2: Agent CRUD + Default Bootstrap

- Agent-CRUD-UI unter `/ai-agents`
- Default "Mana" Agent wird beim ersten Login auto-bootstrapped
- `Mission.agentId` — jede Mission gehört einem Agent

### Phase 3: Server-Side Agent-Awareness

mana-ai Tick-Loop ist jetzt agent-aware:

- Snapshot-Projection pro Agent
- Agent-spezifische Mission-Queries

---

## Workbench-Redesign

### Scene-Header

- Scene-Description-Feld (statt nur Titel)
- Scene-Icon entfernt (überflüssig)
- Inline-Edit direkt im Header (kein Modal)
- Leading Snippet vor der ersten Page (optionaler Content-Bereich)

### PageCarousel

Jede AI-Feature ist jetzt eine eigene Page im Carousel:

- Empty-State Message wenn Scene keine Apps hat
- Five-Preset Width-Picker statt Drag-Handle
- Auto-Scroll beim Scene-Wechsel
- Inline Rename statt Modal

### Companion Refactor

Der Companion wird in ein PageCarousel refactored — jedes AI-Feature (Chat, Missions, Brain, ...) ist eine eigene Seite statt verschachtelte Sub-Routes.

---

## Kontext-Modul Erweiterungen

- **URL Import**: `POST /api/v1/context/import-url` — Crawler + optionale LLM-Summary
- **appendContent**: Inhalte an das Kontext-Dokument anhängen
- **Cross-Module Handoff**: Kontext als Note speichern (Notes-Integration)

---

## Sonstige Fixes + Features

| Bereich            | Was                                                                       |
| ------------------ | ------------------------------------------------------------------------- |
| zitare → quotes    | Rename über die Codebase                                                  |
| shared-types       | `.ts` Extensions + `.js` re-exports für NodeNext-Kompatibilität           |
| pako               | Missing dep für Backup-Import                                             |
| a11y               | Pre-push svelte-check Warnings gefixt                                     |
| web-research       | Failures an den Planner surfacen statt halluzinieren                      |
| Pill Nav           | Cloud-Sync Pill ins User-Menu verschoben                                  |
| CommandBar         | Zu GlobalSpotlight migriert, CommandBar gelöscht                          |
| Keyboard Shortcuts | Workbench + Nav Bars Shortcuts                                            |
| Proposal Inbox     | Ausgerollt auf Calendar, Places, Drink, Food                              |
| Proposal Reject    | Freitext-Feedback bei Rejection → fließt in die nächste Mission-Iteration |

---

## Numbers

|                    |                               |
| ------------------ | ----------------------------- |
| Commits            | 65                            |
| Files changed      | 732                           |
| LOC added          | ~22.520                       |
| LOC removed        | ~3.997                        |
| Net                | +18.525                       |
| Neue Module        | 1 (Quiz)                      |
| AI-System Schritte | 7 (Actor → Missions → Grants) |
| mana-ai Versionen  | v0.1 → v0.2 → deployed        |

---

## Lehren

1. **Actor-Attribution ist das Fundament für AI-Transparency**: Ohne zu wissen wer was geschrieben hat, ist AI-Output nicht von User-Input unterscheidbar. Das muss auf der tiefsten Ebene (Dexie-Hooks) sitzen, nicht als Afterthought.

2. **Key-Grants > permanenter Server-Key**: Der Server bekommt nur temporären, scoped Zugriff auf die Daten die eine Mission braucht. Das ist mehr Aufwand als einen permanenten Key zu deployen, aber die richtige Architektur für ein verschlüsseltes System.

3. **Svelte $state Proxies sind nicht structuredClone-able**: Subtiler Bug — `structuredClone(proxy)` wirft keinen Error, erzeugt aber ein leeres Objekt. JSON-roundtrip ist der sichere Weg.

4. **Feature-Flags für Security-Features**: Key-Grants hinter einem Flag zu deployen erlaubt gradual Rollout mit Alerting — besser als big-bang Activation.
