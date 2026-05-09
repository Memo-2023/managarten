---
title: 'Multi-Agent Workbench, News-Research, BYOK, Theme-Migration + Settings-Consolidation'
description: 'Multi-Agent Phase 4-7: Policy pro Agent, Agents UI + Scene-Binding, Workbench Agent-Filter, Tag-basiertes Scoping. News-Research mit RSS-Discovery. BYOK mit 4 Provider-Adaptern. Theme-Token-Migration auf --color-*. Settings in Workbench konsolidiert. Reasoning Loop. 35 BYOK-Tests.'
date: 2026-04-15
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'multi-agent',
    'ai-agents',
    'policy',
    'scene-binding',
    'news-research',
    'rss',
    'byok',
    'theme',
    'settings',
    'reasoning-loop',
    'templates',
    'mcp',
    'tailwind',
  ]
featured: true
commits: 96
readTime: 22
stats:
  filesChanged: 519
  linesAdded: 24384
  linesRemoved: 9576
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 96
workingHours:
  start: '2026-04-15T08:00'
  end: '2026-04-15T23:59'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Multi-Agent Phase 4-7** — Policy pro Agent, Agents UI + Scene-Binding, Workbench Agent-Filter, Tag-basiertes Scoping
- **News-Research** — RSS-Feed-Discovery, Filter und AI-Context-Export als shared-rss Package
- **BYOK** — Bring Your Own Key mit 4 Provider-Adaptern (OpenAI, Anthropic, Gemini, Mistral) + IndexedDB Vault + 35 Tests
- **Theme-Token-Migration** — alle bare shadcn Tokens → `--color-*` Namenskonvention
- **Settings-Consolidation** — Sync, My-Data, Vault inline statt Sub-Routes
- **Reasoning Loop** — Agent chains auto-Tools vor Approval
- **Templates** — WorkbenchTemplate-System + 3 Agent- + 2 Workbench-Templates
- **MCP Server** — 27/29 Tool-Handlers implementiert
- **Dynamic Tool Registry** — Single-Source-Catalog in shared-ai

---

## Multi-Agent Workbench — Phase 4-7

Das Multi-Agent-System wird in vier Phasen fertiggestellt.

### Phase 4: Policy pro Agent

Jeder Agent hat seine eigene Policy — welche Tools darf er auto-ausführen, welche brauchen Approval:

```typescript
agent.policy = {
	create_task: 'auto',
	complete_task: 'propose',
	create_note: 'auto',
	// ...
};
```

Die Policy wird beim MissionRunner-Start geladen und pro Tool-Aufruf gecheckt.

### Phase 5: Agents UI + Scene-Binding

- **Agent-CRUD** unter `/ai-agents`: Erstellen, Bearbeiten, Löschen von Agents
- **Scene-Binding**: Agents können an Workbench-Scenes gebunden werden (Context-Menu → "An Agent binden…"). Reiner UI-Lens, kein Data-Scoping
- **Mission-Picker**: Missions einem Agent zuordnen

### Phase 6: Workbench Agent-Filter + Proposal Agent-Chip

- **Agent-Filter**: Workbench-Timeline filtern nach Agent
- **Proposal Agent-Chip**: Jede Proposal-Card zeigt den verantwortlichen Agent mit Avatar

### Phase 7: Tag-basiertes Scoping

Agents sehen nur Records die zu ihren Tags passen:

- `filterBySceneScope` in Notes, Todo, Contacts, Calendar — filtert nach den Tags der gebundenen Scene
- `filterByScope` in AI-Tools: `list_tasks`, `get_contacts`, `get_todays_events` — Agents sehen nur relevante Daten
- Note-Tag-UI: Tags werden in der Note-Ansicht für AI-Scoping angezeigt

### Guardrail Layer

Pre/Post-Plan + Pre-Execute Checks:

- **Pre-Plan**: Validiert ob die Mission noch aktiv ist, ob der Agent berechtigt ist
- **Post-Plan**: Validiert den Plan gegen die Policy
- **Pre-Execute**: Letzte Checks vor der Tool-Ausführung

### Token Budget Enforcement

Server-seitige Token-Budget-Limits pro Agent. Agents können nicht unbegrenzt LLM-Tokens verbrauchen.

---

## News-Research — RSS-Discovery + AI-Context-Export

### shared-rss Package

RSS-Parsing + Readability in ein eigenes Package `@mana/shared-rss` extrahiert:

- Feed-Discovery via URL
- Article-Extraction via Readability
- Standardisiertes Feed-Format

### News-Research Modul

RSS-Feed-Discovery, Filter und AI-Context-Export:

- **`discoverByQuery`**: Sucht RSS-Feeds zu einem Thema
- **`searchFeeds`**: Durchsucht bekannte Feeds nach Keywords
- **AI-Context-Export**: Gefundene Artikel als strukturierten Context für den Companion aufbereiten

### Integration mit Missions

Missions deren Objective Research-Keywords enthält (`recherchier|research|news|...`) bekommen automatisch eine Web-Research-Pre-Step:

- RSS-Discovery + Feed-Search vor dem Planner-Call
- Ergebnisse als `save_news_article` Instruktionen injiziert
- Fix: Deep-Research → News-Research RSS geswitcht (stabiler)
- Fix: Web-Research Failures an den Planner surfacen statt halluzinieren

### Dev-Stack

SearXNG + mana-search in `dev:mana:all` verdrahtet.

---

## BYOK — Bring Your Own Key

Users können ihre eigenen API-Keys für AI-Provider hinterlegen:

### LLM-Tier-System

Neuer `byok` Tier neben `browser`, `server`, `cloud`:

```
browser (local Gemma/Whisper, WebGPU)
  → server (Ollama auf GPU-Box, self-hosted)
  → cloud (Gemini API, managed)
  → byok (User's own API keys)
```

### 4 Provider-Adapter

| Provider      | Model                |
| ------------- | -------------------- |
| OpenAI        | GPT-4o, GPT-4o-mini  |
| Anthropic     | Claude Sonnet, Opus  |
| Google Gemini | Gemini 2.5 Flash/Pro |
| Mistral       | Mistral Large        |

### IndexedDB Vault

API-Keys werden **verschlüsselt in IndexedDB** gespeichert:

- Eigener BYOK-Vault (nicht im Haupt-Vault)
- Keys verlassen nie den Browser (Client-Side API-Calls)
- Settings-UI unter dem AI-Tier-Card

### Per-Task Tier Override

Einzelne AI-Tasks können den globalen Tier überschreiben — z.B. "für diese Mission nutze Claude Opus statt lokales Gemma".

### Tests

35 Unit-Tests für:

- Vault encrypt/decrypt Lifecycle
- Provider-Adapter API-Shape
- Tier-Override-Resolution
- Key-Rotation

---

## Theme-Token-Migration

Große Migration aller CSS-Tokens:

### Problem

Bare shadcn Tokens (`--muted`, `--primary`, `--border`, ...) waren überall im Code verstreut. Das macht Theme-Wechsel fragil und Dark-Mode-Support inkonsistent.

### Lösung

Drei Commits migrieren alles auf `--color-*` Namenskonvention:

1. **Shared Packages** → `--color-muted`, `--color-primary`, ...
2. **Remaining bare Tokens** → vollständige Migration
3. **Alias-Layer**: `--muted` → `--color-muted` Aliases für Übergangszeit

### Tailwind Fix

`@source` Paths in der Tailwind-Config waren falsch — Tailwind scannte keine shared Packages. Fix: korrekte Pfade in `@mana/shared-tailwind/sources.css` zentralisiert.

### Lint Guard

Neuer `audit:theme-tokens` Guard verhindert Rückfall auf bare `--muted` / `--theme-*` Tokens.

---

## Settings-Consolidation

Die Settings-Page wird radikal vereinfacht:

### Inline statt Sub-Routes

Sync, My-Data und Vault-Settings werden **inline** in den Settings gerendert statt als eigene Sub-Routes:

- Weniger Navigation
- Alles auf einen Blick
- Sub-Routes gelöscht

### Workbench-Migration

Fünf Bereiche werden zu Workbench-Apps migriert:

- **Profile & Themes** → Workbench-App mit Deep-Links
- **Spiral** → Workbench-App (standalone Route gelöscht)
- **Help** → Workbench-App (standalone Route gelöscht)
- **Subscription** → merged in "Credits & Abo"
- **Credits** → merged mit Subscription zu einem App

### GeneralSection

Settings-ListView zeigt jetzt den `GeneralSection`-Content statt ihn inline zu duplizieren. Section-Headers über alle Tabs vereinheitlicht.

### BYOK Key Manager

BYOK-Key-Manager inline unter der AI-Tier-Card in den Settings.

---

## Reasoning Loop

Der foreground MissionRunner kann jetzt **chained auto-tools** ausführen:

```
Planner call 1 → list_tasks (auto) → execute → result
  ↓ feed result back
Planner call 2 → create_task (propose) → stop, create Proposal
```

Bis zu 5 Planner-Calls pro Iteration. Read-only Tools (auto-policy) werden inline ausgeführt, ihre Outputs als `ResolvedInput` für den nächsten Planner-Call gefüttert. Die Loop stoppt wenn:

- Ein propose-policy Tool getriggert wird
- Der Planner 0 Steps zurückgibt
- Das Budget exhausted ist

`maxTokens` von 1024 → 4096 gebumpt (der Planner braucht mehr Platz für den Reasoning-Output).

---

## Templates

### WorkbenchTemplate System

Generalisiertes Template-System für Workbench-Setups:

```typescript
interface WorkbenchTemplate {
	agent?: AgentTemplate;
	scenes?: SceneTemplate[];
	missions?: MissionTemplate[];
	seeds?: ModuleSeedTemplate[];
}
```

### Agent-Templates (mit AI)

| Template        | Agent                   | Missions                                |
| --------------- | ----------------------- | --------------------------------------- |
| Recherche-Agent | Research-focused Policy | News-Discovery, Artikel-Zusammenfassung |
| Kontext-Agent   | Notes/Kontext-focused   | Kontext-Dokument pflegen                |
| Today-Agent     | Day-Planning-focused    | Tagesplanung, Task-Review               |

### Workbench-Templates (ohne AI)

| Template  | Layout                       |
| --------- | ---------------------------- |
| Calmness  | Meditation, Journal, Moodlit |
| Fitness   | Body, Stretch, Sleep         |
| Deep Work | Todo, Notes, Calendar, Timer |

---

## MCP Server — 27/29 Tool-Handlers

API-Endpoint für externe MCP-Clients:

- **Phase 1**: `/api/v1/mcp` Endpoint exposiert AI-Tools
- **Phase 2**: Real DB-Operations für Tool-Execution (nicht nur Stubs)
- **Phase 3**: 19 weitere Tool-Handlers implementiert (27/29 total)

---

## Dynamic Tool Registry

Single-Source-Catalog in `@mana/shared-ai`:

Vorher: Tool-Definitionen waren dupliziert zwischen Webapp, mana-ai Service und MCP-Server. Jetzt: ein Catalog, drei Consumer. Tool-Name + Parameter-Drift zwischen Catalog und Webapp gefixt.

---

## SSE Streaming für Foreground Runner

Mission-Iterations werden jetzt via Server-Sent Events gestreamt:

- Live Phase-Updates während der Iteration
- Elapsed-Time Counter
- Cancel-Button für laufende Iterationen

---

## Sonstige Features + Fixes

| Bereich        | Was                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Sync Backup    | `.mana` Zip mit Manifest + SHA256 (M3), Import-Parser + Replay (M4a), /backup/export Route (M1) |
| Sync Protocol  | schemaVersion + eventId on wire (M2 hardening)                                                  |
| Meditate       | Neues Modul mit Presets, Sessions, Breathing-UI                                                 |
| Module Renames | nutriphi → food, eventstream → activity, cycles → period                                        |
| Workbench Perf | Lazy-mount Carousel via IntersectionObserver, SceneAppBar Registration split                    |
| Idle-Defer     | Non-critical (app) Init idle-deferred + Modals lazy-loaded                                      |
| PWA            | Manifest + SW Registration für Install-Prompt                                                   |
| Theme Picker   | Redesign mit Gradient-Cards + Beefy Mode Selector                                               |
| Credits        | Merge Credits + Subscription in eine Workbench-App                                              |
| Cloud Tier     | Default Model gemini-2.0-flash → gemini-2.5-flash                                               |
| Audit          | Module Complexity Reports + Workbench Map                                                       |
| shared-pkgs    | sideEffects: false für Tree-Shaking                                                             |
| OTel           | mana-ai OpenTelemetry Tracing + Grafana Tempo                                                   |
| Profile        | Data-Model erweitert + Interview-Field-Mappings gefixt                                          |
| Toasts         | Global ToastContainer, inline Toasts migriert, SETUP.md gelöscht                                |
| Credits Toasts | Octal-Literal-Placeholders durch echte Toast-Messages ersetzt                                   |

---

## Numbers

|                    |                           |
| ------------------ | ------------------------- |
| Commits            | 96                        |
| Files changed      | 519                       |
| LOC added          | ~24.384                   |
| LOC removed        | ~9.576                    |
| Net                | +14.808                   |
| Multi-Agent Phasen | 4-7                       |
| BYOK Provider      | 4                         |
| BYOK Tests         | 35                        |
| MCP Tools          | 27/29                     |
| Templates          | 5 (3 Agent + 2 Workbench) |

---

## Lehren

1. **Per-Agent Policy > globale Policy**: Verschiedene Agents brauchen verschiedene Berechtigungen. Der Recherche-Agent darf Notizen auto-erstellen, der Today-Agent nicht. Globale Policies sind zu grob.

2. **Reasoning Loop macht Agents nützlich**: Ohne die Möglichkeit, read-tools inline auszuführen und die Ergebnisse in den nächsten Planner-Call zu füttern, waren Agents blind. "Lies alle Tasks und erstelle basierend darauf eine Zusammenfassung" braucht mindestens 2 Planner-Calls.

3. **Theme-Token-Migration ist ein Einmal-Aufwand**: Die Migration auf `--color-*` war aufwändig, aber der Lint-Guard verhindert Rückfälle. Jeder zukünftige Entwickler muss sich keine Gedanken mehr machen welches Token-Format er nutzt.

4. **BYOK-Keys gehören nicht auf den Server**: Client-Side API-Calls mit User-Keys sind der einzige Weg der dem Privacy-Versprechen gerecht wird. Der BYOK-Vault in IndexedDB ist die logische Konsequenz.
