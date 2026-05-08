# Claude Code — Anatomie eines Agent-Harness

**Stand:** 2026-04-23
**Quellenlage:** Reverse-Engineering / Leaks aus Community-Analysen (siehe §13)

> Technischer Bericht über die interne Architektur von Claude Code (Anthropics offiziellem CLI),
> konsolidiert aus öffentlich dokumentierten Reverse-Engineering-Analysen des
> minified `@anthropic-ai/claude-code`-Pakets sowie live mitgeschnittenen API-Roundtrips.

---

## Inhaltsverzeichnis

1. [Kontext zur Quellenlage](#1-kontext-zur-quellenlage)
2. [System-Architektur](#2-system-architektur)
3. [Prompt-System](#3-prompt-system)
4. [Tool-System](#4-tool-system)
5. [Sub-Agent-System (I2A / Task-Tool)](#5-sub-agent-system-i2a--task-tool)
6. [Context-Management](#6-context-management)
7. [Steering-Mechanismen](#7-steering-mechanismen)
8. [Security & Sandboxing](#8-security--sandboxing)
9. [Real-Time Steering: `h2A`](#9-real-time-steering-h2a)
10. [UI/Terminal-Layer](#10-uiterminal-layer)
11. [Memory & Todos](#11-memory--todos)
12. [Model-Routing](#12-model-routing)
13. [Bemerkenswerte Clever Tricks](#13-bemerkenswerte-clever-tricks)
14. [Relevanz für das Mana-Monorepo](#14-relevanz-für-das-managarten)
15. [Quellen](#15-quellen)

---

## 1. Kontext zur Quellenlage

Das ursprünglich viel zitierte Repo `shareAI-lab/analysis_claude_code` wurde inzwischen
archiviert bzw. in `shareAI-lab/learn-claude-code` überführt — der neue Fokus liegt auf
Didaktik („Harness Engineering"), nicht mehr auf den deobfuscierten Funktionsnamen. Die
ursprünglichen Funktionsnamen (`nO`, `h2A`, `wU2`, `I2A`, `UH1`, `gW5`, `tU2`, `KN5` etc.)
leben aber in mehreren Folge-Analysen weiter (BrightCoding Juli 2025, xugj520
„Efficient Coder", PromptLayer-Blog, Medium Sujay Pawar).

`Yuyz0112/claude-code-reverse` geht einen komplementären Weg: Statt statische
Code-Analyse monkey-patcht er `beta.messages.create` im installierten `cli.js` und loggt
die echten API-Roundtrips — daraus lassen sich die System-Prompts, Tool-Definitionen und
Modell-Routing-Entscheidungen direkt ablesen.

`Piebald-AI/claude-code-system-prompts` pflegt per Version ein vollständiges
Prompt-Archiv. Version 2.1.117 hat ~110 Prompt-Strings, 24 Built-in-Tool-Beschreibungen
und ~40 System-Reminder.

Die folgenden Befunde sind die konsolidierte Lesart über diese Quellen.

---

## 2. System-Architektur

Die Gesamtarchitektur ist ein vierlagiges Harness:

1. **UI Layer** — CLI (Ink/React), VSCode-Plugin, optionale Web-Frontends.
2. **Agent Core Scheduling Layer** — `nO` (Master-Loop) plus `h2A` (asynchrone
   Message-Queue als Steering-Bus).
3. **Execution Layer** — Streaming-Generator (`wu`), Context-Compressor (`wU2`),
   Tool-Execution-Engine (`MH1`), Tool-Scheduler (`UH1`/`gW5`).
4. **Storage Layer** — Messages, komprimierte Summaries, CLAUDE.md-basierter
   Langzeitspeicher, `~/.claude/todos/{session}.json`.

Der zentrale Prozessor ist `nO`: ein single-threaded Master-Loop, implementiert als
Generator-basierte async-Runtime. Das Muster ist das kanonische

```ts
while (response.stop_reason === "tool_use") {
  executeTools();
  appendResults();
  recallModel();
}
```

das bei reinem Text terminiert. Um diesen Kern-Loop drapiert sich der gesamte Rest der
Maschinerie. `tU2` ist in den Analysen der Name für den Konversations-Flow-Wrapper, der
Messages in `nO` rein- und rausleitet und dabei System-Reminder einmischt.

### Flow-Diagramm

```
User
  → tU2 (conversation flow)
  → System-Prompt-Zusammenbau + Reminder-Injection
  → nO (master loop)  ←→  h2A (steering bus)
      → Tool-Call?
          → UH1 Permission-Gate
          → gW5 Concurrent-Scheduler (max 10)
          → MH1 exec
      → Results zurück in h2A
      → nO → next iteration
```

---

## 3. Prompt-System

Jeder Turn geht mit drei Schichten an die API:

1. **System-Prompt**: Claude-Code-Identität, Kernrichtlinien, Tool-Policies,
   Sandbox-Regeln, Git-Hinweise. Piebalds Archiv zeigt: mehrere Dutzend Strings werden
   *konditional* injiziert je nach Mode (Auto/Learning/Plan), IDE-Integration,
   aktiviertem Sandboxing etc.
2. **User-Message** mit angehängtem `<system-reminder>`-Block, der den dynamischen
   Zustand trägt: Working-Directory, Git-Branch, Platform, Date, CLAUDE.md-Inhalte,
   Todo-Liste, File-Freshness-Warnungen, Skills-Liste.
3. **Turn-spezifische Reminder** am Anfang und Ende einer Konversation
   (`system-reminder-start`, `system-reminder-end` bei Yuyz0112) — der Start-Reminder
   lädt Umgebungskontext, der End-Reminder prüft, ob Todos re-injiziert werden müssen.

### Besonderheit: CLAUDE.md-Disclaimer

Der CLAUDE.md-Block wird **mit einem expliziten Disclaimer** injiziert:

> „IMPORTANT: this context may or may not be relevant to your tasks. You should not
> respond to this context unless it is highly relevant."

Claude Code gibt dem Modell also bewusst die Freiheit, den Projektkontext zu ignorieren.
Das adressiert den klassischen Bug, dass lange System-Prompts das Modell zu rigiden
Interpretationen zwingen.

---

## 4. Tool-System

Die ursprünglichen Analysen sprechen von „15 Kern-Tools"; die aktuelle Version 2.1.117
laut Piebald-Archiv hat **24 Built-in-Tool-Beschreibungen**.

### Historische Kern-Menge

`View/Read`, `LS`, `Glob`, `Grep`, `Edit`, `Write/Replace`, `Bash`, `WebFetch`,
`WebSearch`, `NotebookRead`, `NotebookEdit`, `TodoWrite`, `Task` (Sub-Agent-Launcher),
`BatchTool` (historischer Vorläufer der heute impliziten Parallel-Tool-Calls),
`exit_plan_mode`.

### Neuere Additionen

`EnterPlanMode`/`ExitPlanMode`, `Worktree`-Management, `TaskCreate`/`TaskUpdate`,
`CronCreate`, `Computer` (Browser-Automation), `LSP`.

### Execution-Pipeline

- **`UH1` — Permission Gateway**: Statisch-strukturelle Prüfung vor Execution. Jeder
  Tool-Call wird gegen die Whitelist aus `settings.json` gemappt (z. B.
  `Bash(npm test:*)`, `Edit(src/**)`). Read-only Tools (`Read`, `Glob`, `Grep`, `LS`,
  `WebFetch`, `WebSearch`) sind per Default auto-approved. Writes und Bash-Befehle
  gehen durch Permission-Prompt, außer der Mode ist `acceptEdits`, `dontAsk` oder
  `bypassPermissions`. Permission-Modes-Katalog: `plan` (read-only), `default`,
  `acceptEdits`, `dontAsk`, `bypassPermissions`.
- **`gW5` — Parallel Scheduler**: Concurrent-Executor mit **Maximum 10 parallelen
  Tool-Calls**. Wenn das Modell in einem Turn mehrere unabhängige Tool-Blocks
  zurückgibt (z. B. gleichzeitig `Grep` + `Glob` + `Read`), werden sie in einem Pool
  von maximal 10 Workern parallel abgearbeitet. Sobald ein Call ein Write ist oder
  Side-Effects hat, serialisiert `gW5` für diesen Block.
- **`MH1` — Tool Execution Engine**: Der eigentliche Dispatcher mit dem Handler-Map
  `toolName → handler`.

### Performance-Messwerte (Reverse-Engineering)

| Metrik                    | Wert                | Quelle                    |
|---------------------------|---------------------|---------------------------|
| `gW5`/`UH1`-Overhead      | ~0.8 ms pro Tool    | xugj520 (M2 Max)          |
| `h2A`-Throughput          | >10 000 msg/s       | xugj520 (M2 Max)          |
| Max parallele Tool-Calls  | 10                  | ComeOnOliver/Analysis     |

Das sind Reverse-Engineering-Schätzwerte, nicht Anthropic-offiziell.

---

## 5. Sub-Agent-System (I2A / Task-Tool)

Das `Task`-Tool ruft `KN5` als Launcher auf, der einen neuen `I2A`-SubAgent-Kontext
startet:

- **Fresh messages[]** — der Sub-Agent bekommt ein leeres History-Array, plus die aus
  dem Parent extrahierte Task-Description als initiale User-Message.
- **Isolation**: eigene Tool-Permissions (restriktiver als der Parent, meist
  read-only + Grep/Glob), eigener Token-Budget, eigener v8-Isolate-ähnlicher Scope.
- **Return-Contract**: Nur die finale Zusammenfassung des Sub-Agents wird als ein
  einzelnes `tool_result` in die Parent-History eingefügt — das Kernziel: „dirty
  context" (hunderte gescannte Files) bleibt im Kind, im Parent landet nur der
  Destillat-Absatz.
- **Rekursionsgrenze**: Sub-Agents können **keine weiteren Sub-Agents** starten („One
  level deep, no further"). Maximale Parallelität in einem Batch: ebenfalls 10.
- **Modell-Routing per Sub-Agent-Typ**: Der `Explore`-SubAgent läuft auf Haiku
  (billig + schnell, read-only-Recherche), `Plan`-Mode auf Sonnet, General-Purpose
  auf dem Parent-Modell.

---

## 6. Context-Management

### `wU2` — 92%-Threshold-Compressor

Die zentrale Komponente ist `wU2` — der **92%-Threshold-Compressor**. Sobald die
Token-Nutzung der Konversation ca. 92 % des Context-Window-Limits erreicht, feuert
`wU2` automatisch einen zusätzlichen API-Call mit einem speziellen
`system-compact`-Prompt (per Yuyz0112 belegt).

Das Modell wird instruiert, den Verlauf nach einem festen Schema zu komprimieren:

- **Task Goal**
- **Decisions Made**
- **Files Changed**
- **Current Progress**

werden explizit erhalten; verbatim-Details und intermediäre Tool-Outputs fallen weg.
Die Analysen berichten Kompressionsraten von ~6.8×.

In neueren Versionen existiert zusätzlich ein „soft"-Trigger bei ~50 % Auslastung, der
eine leichte Summary mit einbaut, ohne die Raw-Turns zu ersetzen.

### CLAUDE.md-Loading (8-Stage-Pipeline)

In der Praxis landen folgende Scopes gestapelt im System-Prompt:

1. `~/.claude/CLAUDE.md` (global)
2. Parent-Dirs hoch zur Git-Root
3. `./CLAUDE.md` (Projekt)
4. `./CLAUDE.local.md` (user-local, gitignored)
5. Sub-Directory CLAUDE.md-Dateien (beim Cd-ähnlichen Navigieren „imported")
6. Auto-Memory aus `~/.claude/projects/{project}/memory/MEMORY.md`
7. Session-spezifische Reminder
8. Turn-spezifische Reminder (siehe §7)

Größe wird empfohlen unter 200 Zeilen zu halten.

---

## 7. Steering-Mechanismen

Dies ist der unterschätzte Teil. Claude Code injiziert zur Laufzeit kontinuierlich
kleine Reminder-Blöcke ins nächste Turn, **ohne die Konversations-History zu
mutieren** — sie kommen als transiente `<system-reminder>`-Tags im nächsten
User-Message-Envelope:

| Mechanismus              | Trigger                                           | Effekt                                                                 |
|--------------------------|---------------------------------------------------|------------------------------------------------------------------------|
| Todo-Re-Injection        | Nach jedem `TodoWrite`-Call                       | Modell „sieht" seine Todo-Liste in *jedem* API-Request                 |
| File-Freshness-Tracking  | File modifiziert nach letztem `Read`              | Blockiert nächsten `Edit`; injiziert „File modified"-Warning           |
| Stale-Todo-Reminder      | Task-Tools zu lange nicht genutzt                 | Injiziert Hinweis, Planungs-Tools zu verwenden                         |
| Hook-Notifications       | `PreToolUse`, `PostToolUse`, `SessionStart/End`   | User-Hooks triggern; Output wird als `<system-reminder>` zurückgespielt |

**Kernidee:** Der Assistant-Teil der History bleibt unberührt — was kritisch ist, weil
jede Assistant-Mutation KV-Cache invalidieren würde. Cache-Stability wird explizit
priorisiert.

---

## 8. Security & Sandboxing

xugj520 beschreibt ein **6-Layer-Permission-Framework**:

1. **UI-Input-Validation**
2. **Prompt-Analyse auf Injection-Patterns**
3. **`UH1`-Policy-Matching** gegen Whitelist
4. **Pro-Tool-Arg-Validation** (z. B. Path-Canonicalization mit Blacklist außerhalb
   des Workspaces)
5. **LLM-basierte Command-Injection-Detection** für Bash (ein separater Haiku-Call
   prüft `rm -rf /`, `curl | sh` etc. vor Execution)
6. **Output-Filter/Redaction** (Secrets, Tokens)

Das Bash-Tool entstringt explizit Backticks und `$()`-Substitutionen in
User-gelieferten Argumenten. MCP-Server laufen in einem Bridge-Modus mit pro-Policy
entweder Docker- oder WASM-Isolation.

---

## 9. Real-Time Steering: `h2A`

`h2A` ist die namentlich auffälligste Komponente — **Dual-Buffer-Async-Message-Queue
mit Promise-basiertem Async-Iterator und Backpressure**. Funktionell:

- **Zero-Latency-Delivery**: Der Producer (Streaming-API-Response-Chunks,
  Tool-Result-Events, User-Interjections) pusht in Buffer A, während der Consumer aus
  Buffer B liest. Swap passiert atomar — keine Lock-Kontention, keine Drops.
- **Mid-Task-User-Interjections**: Der User kann *während* ein Tool läuft Input
  senden; `h2A` merged das in die nächste Iteration, ohne den Loop neu zu starten.
  Das erklärt, warum Claude Code auf Tastatureingaben reagiert, während es z. B. einen
  langen Bash-Command ausführt.
- **Stream-JSON-I/O**: Externe Clients (IDE-Plugins, Remote-Control) sprechen Claude
  Code über line-delimited JSON-Events über stdin/stdout, die direkt in `h2A` gepumpt
  werden.

---

## 10. UI/Terminal-Layer

Ink (React-Renderer für Terminals) mit einem stark geforkten Custom-Reconciler via
`react-reconciler`. Jeder Frame:

1. React-Commit
2. In-memory DOM-Tree (DOMElement/TextNode)
3. **Yoga (Facebook's Flexbox-Engine, als yoga.wasm eingebunden)** berechnet Layout
4. `renderNodeToOutput` schreibt styled Characters in ein getyptes Screen-Buffer-Array
5. Diff gegen den vorherigen Frame
6. Minimale ANSI-Patches werden als single buffered write rausgeschrieben

**Primitive:** `ink-root`, `ink-box`, `ink-text`, `ink-raw-ansi`.
Version 2.1.x enthält laut DeepWiki-Mirrors 130+ React-Komponenten.

---

## 11. Memory & Todos

`TodoWrite` ist bewusst *nicht* in-process persistiert — es schreibt einen JSON-File
unter `~/.claude/todos/{session_id}.json`. Der Persistenz-Pfad erlaubt Session-Resume
und Inter-Session-Kontinuität.

**Felder:** `id`, `content`, `status` (pending/in_progress/completed), `priority`.

Die Re-Injection (siehe §7) macht den Todo-File zum De-facto-Arbeitsspeicher-Format.
Zusätzlich gibt's `MEMORY.md` (User-Memory, cross-session, per Projekt) und die
„Dream"-/Kairos-Features in neueren Builds, die Session-Summaries verdichtet ablegen.

---

## 12. Model-Routing

Claude Code ist in Wahrheit ein Multi-Modell-System:

| Modell         | Einsatz                                                                    |
|----------------|----------------------------------------------------------------------------|
| **Sonnet** 4.x/4.7 | Default für den Haupt-Agent-Loop                                       |
| **Opus**       | opt-in via `--model opus`; auto für Complex Debugging/Plan-Mode            |
| **Haiku**      | Hochfrequente Background-Calls (siehe unten)                               |

### Haiku-Aufgaben

- **(a) Quota-Check beim Startup** — ein 1-Token-Dummy-Request mit Text „quota",
  gelingt nur, wenn Budget da ist
- **(b) Topic-Detection** — nach jedem User-Input (entscheidet, ob der Terminal-Title
  geupdatet werden muss)
- **(c) Session-Summarization** — beim Resume
- **(d) Command-Injection-Detection** — pre-Bash
- **(e) Auto-Compact-Fallback** — wenn der Primär-Compactor teuer wird

Yuyz0112s Logs zeigen: all das läuft über `beta.messages.create` mit explizitem
`model: "claude-haiku-3.5"`.

**Quota-Handling ist proaktiv:** Die Haiku-Probe beim Start fängt 429-Fehler bevor der
User die erste echte Query tippt; bei Budget-Exhaustion wird auf einen Reduced-Mode
degradiert (kein Auto-Compact, kein Topic-Detection).

---

## 13. Bemerkenswerte Clever Tricks

Was technisch am interessantesten ist:

1. **Reminder-Injection statt History-Pollution** — Der gesamte Steuerungskanal
   (Todos, File-Freshness, Plan-Mode-Hints) läuft über transiente
   `<system-reminder>`-Tags im User-Turn. Der Assistant-Teil der History bleibt
   unberührt — was kritisch ist, weil jede Assistant-Mutation KV-Cache invalidieren
   würde. Cache-Stability wird explizit priorisiert.
2. **Der 92%-Trigger vs. hartes Limit** — Anstatt bei 100 % zu crashen, wird bei
   92 % präventiv komprimiert. `wU2` ist eine Insurance-Policy, kein Notausgang.
3. **`h2A`-Dual-Buffer mit User-Interjection** — Agent-Frameworks die man sonst sieht
   (LangGraph, CrewAI) sind turn-based. Claude Codes User-Interjection mitten im
   Tool-Call ist architektonisch der Unterschied zwischen „Chat-Loop" und
   „Interactive Shell".
4. **Sub-Agent als Context-Laundering** — `I2A` ist nicht primär für Parallelisierung
   da, sondern um „dreckige" Kontexte aus der Parent-History zu isolieren. Pattern
   stammt wohl aus Reinforcement-Learning-Tradition: Episoden sauber halten.
5. **LLM für Security** — Die Haiku-basierte Command-Injection-Detection ist ein
   bemerkenswerter Bruch mit klassischer Security-Praxis (Regex-Blacklists).
   Anthropic vertraut einem Modell, Angriffsmuster zu erkennen, die Regex nicht
   erwischt.
6. **Der versteckte Quota-Ping** — Mit einem einzigen „quota"-Token-Request beim
   Start wird das Budget getestet, bevor der User auch nur getippt hat. Billig und
   clever.
7. **yoga.wasm** — Dass ein CLI-Tool einen Flexbox-Engine aus dem
   React-Native-Umfeld als WASM einbindet, um Terminal-Layout zu rendern, ist
   technisch elegant overkill — und erklärt, wie Ink so robust mit Resize-Events
   umgeht.
8. **Parallel-Tool-Policy ohne Write** — `gW5` parallelisiert nur Read-Tools. Sobald
   ein Write kommt, wird serialisiert. Das macht Consistency trivial, ohne dass das
   Modell überhaupt darüber nachdenken muss.
9. **BatchTool wurde deprecated**, weil das Modell selbst gelernt hat, mehrere
   `tool_use`-Blocks in einem Response-Turn zurückzugeben — das Harness brauchte
   irgendwann keinen expliziten Batch-Wrapper mehr. Modell-Training hat das Feature
   wegtrainiert.
10. **CLAUDE.md-Disclaimer** — Der „may or may not be relevant"-Disclaimer ist
    subtile Instruktions-Entkopplung: Anthropic möchte, dass CLAUDE.md *Kontext* ist,
    nicht *Befehl*.

### Kurzes Fazit

Das technisch Bemerkenswerte an Claude Code ist nicht eine einzelne Komponente,
sondern die Konsequenz, mit der **alles, was nicht der Loop ist, zu Harness degradiert
wurde**. `nO` ist 20 Zeilen. Der Rest — `h2A`, `wU2`, `UH1`, `gW5`, `I2A`, `KN5`,
`tU2`, die Reminder-Injektion, die Haiku-Nebencalls — ist Environment-Engineering um
einen minimalen, modellgetriebenen Kern herum. Die explizite Botschaft der
Community-Analysen: Wer heute „Agents" baut und stattdessen in Rule-Trees und
Prompt-Ketten denkt, hat das Grundpattern verfehlt.

---

## 14. Relevanz für das Mana-Monorepo

Direkte Ableitungen für laufende Initiativen:

- **`services/mana-mcp` (:3069)** — Der Reminder-Injection-Mechanismus aus §7 ist
  direkt übertragbar: Tool-Results könnten nicht nur rohe JSON-Payloads zurückgeben,
  sondern transiente `<system-reminder>`-Blöcke mit Space-Context, Tier-Status oder
  stale-Data-Warnungen. Siehe
  [`docs/plans/mana-mcp-and-personas.md`](../plans/mana-mcp-and-personas.md).
- **`services/mana-ai` Mission-Runner** — Das `nO`/`h2A`-Pattern (single-threaded
  Master-Loop + Async-Steering-Bus) ist eine sauberere Alternative zu der
  cross-tick-Statemachine, die dort aktuell Gemini Deep Research orchestriert. Siehe
  `project_gemini_deep_research`-Memory.
- **Shared Tool-Registry** (`packages/mana-tool-registry`) — Das Permission-Gateway
  (`UH1`) mit Whitelist-Matching ist ein brauchbares Mental-Model für die
  Tool-Authorization, die wir persona-scoped einführen müssen.
- **Compression-Pattern (`wU2`)** — Für lange Sync-Logs oder Missions-Historie mit
  >50k Tokens sinnvoll: präventives Komprimieren bei 92 % Budget-Auslastung nach
  festem Schema (Goal / Decisions / Files / Progress).

---

## 15. Quellen

- [shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code)
  (Nachfolger von `analysis_claude_code`)
- [Yuyz0112/claude-code-reverse](https://github.com/Yuyz0112/claude-code-reverse)
  (API-Monkey-Patch-Logs)
- [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts)
  (System-Prompt-Archiv v2.1.117)
- [ComeOnOliver/claude-code-analysis](https://github.com/ComeOnOliver/claude-code-analysis)
  (17-Sektion-Dokumentation)
- [Inside Claude Code: A Deep-Dive Reverse Engineering Report — BrightCoding (Juli 2025)](https://www.blog.brightcoding.dev/2025/07/17/inside-claude-code-a-deep-dive-reverse-engineering-report/)
- [Claude Code Reverse Engineering v1.0.33 — Efficient Coder (xugj520)](https://www.xugj520.cn/en/archives/claude-code-reverse-engineering.html)
- [Claude Code: Behind-the-scenes of the master agent loop — PromptLayer Blog](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)
- [How Claude Code Actually Works — Sujay Pawar (Medium)](https://medium.com/@sujaypawar/how-claude-code-actually-works-1f6d4f1eea82)
- [ZenML LLMOps Database: Claude Code Agent Architecture](https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding)
- [Reverse-Engineering Claude Code — sathwick.xyz](https://sathwick.xyz/blog/claude-code.html)
- [Claude Code Architecture (Reverse Engineered) — vrungta.substack](https://vrungta.substack.com/p/claude-code-architecture-reverse)
- [How Claude Code Uses React in the Terminal — DEV.to](https://dev.to/vilvaathibanpb/how-claude-code-uses-react-in-the-terminal-2f3b)
- [Pan Xinghan: what the shareAI-lab analysis adds — Medium](https://medium.com/@sampan090611/claude-code-feels-like-a-senior-dev-heres-what-actually-makes-it-different-and-what-the-49c02b456d9c)

---

**Verwandte Berichte in diesem Repo:**

- [`docs/reports/ai-agent-architecture-comparison.md`](./ai-agent-architecture-comparison.md)
- [`docs/reports/gemini-deep-research.md`](./gemini-deep-research.md)
- [`docs/reports/web-research-capabilities.md`](./web-research-capabilities.md)
