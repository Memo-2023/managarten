---
title: 'Memoro im Monorepo + Status-Page live + Todo-Polish'
description: 'Memoro vollständig ins Monorepo migriert (Web, Server, Audio-Server), status.mana.how live, Todo mit Paper-Cards und Detail-Modal, Auth-Email-Verification robustifiziert, Infra-Cleanup und UI-Vereinheitlichung.'
date: 2026-03-31
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'memoro',
    'migration',
    'hono',
    'bun',
    'local-first',
    'status-page',
    'monitoring',
    'todo',
    'auth',
    'infra',
    'ui',
    'azure-speech',
  ]
featured: false
commits: 98
readTime: 14
stats:
  filesChanged: 2241
  linesAdded: 340000
  linesRemoved: 25171
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 98
workingHours:
  start: '2026-03-31T09:00'
  end: '2026-03-31T21:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Memoro** vollständig im Monorepo: Web-App (local-first, shared-auth-stores), Hono/Bun Server + Audio-Server ersetzen NestJS
- **status.mana.how** live: öffentliche Status-Page aus VictoriaMetrics-Daten, alle 60s aktualisiert
- **Todo**: Paper-Cards, Complete-Animation, Task-Detail-Modal redesigned, Inline-Subtasks im Kanban
- **Auth**: Email-Not-Verified Flow robust, Resend-Verification-Panel
- **Infra**: 4 Apps von GHCR auf lokale Builds, Arcade auf Hono/Bun
- **UI**: Elevation-System in 4 Apps, LanguageSelector/ConfirmDialog/AppSlider vereinheitlicht

---

## Memoro: Vollständige Monorepo-Integration

Memoro war bisher ein separates Repo (legacy NestJS-Stack). Heute wurde die App vollständig ins Monorepo überführt — in drei Schritten.

### Schritt 1: Legacy-Code importiert

```
apps/memoro/apps/
├── backend/        # Legacy NestJS (importiert, nicht aktiv)
├── mobile/         # Expo App (importiert)
├── landing/        # Astro Landing (importiert)
└── web/            # → wird in Schritt 2 migriert
```

Der Legacy-Code ist eingecheckt als Referenz. Die aktiven Services werden in Schritt 2 und 3 neu gebaut.

### Schritt 2: Web-App migriert (Phasen 1–6)

Die bestehende Web-App wurde vollständig auf den Monorepo-Stack portiert:

| Phase | Was passiert ist                                                                              |
| ----- | --------------------------------------------------------------------------------------------- |
| 1     | Package-Struktur: `@memoro/web`, adapter-node, Tailwind v4 + `@manacore/shared-tailwind`      |
| 2     | Auth: `createManaAuthStore()` aus `@manacore/shared-auth-stores`, Google/Apple OAuth entfernt |
| 3     | Local-First: `memoroStore` mit 7 Collections (memos, tags, spaces, invites, …)                |
| 4     | Guest-Seed: Demo-Daten die sofort geladen werden ohne Login                                   |
| 5     | Service Layer: `memoService` + `tagService` von Supabase direct auf local-store Collections   |
| 6     | Workspace-Integration: `dev:memoro:*` Scripts, CLAUDE.md Eintrag                              |

**Wichtig:** Google/Apple OAuth komplett entfernt — Memoro nutzt ausschließlich mana-auth JWT, wie alle anderen Apps im Ökosystem. Keine externen OAuth-Provider.

### Schritt 3: Hono/Bun Server + Audio-Server

Zwei neue Services ersetzen das komplette NestJS-Backend (Server + Audio-Backend):

#### `apps/memoro/apps/server/` (Port 3015) — Business Logic

```
- Memo-CRUD, Transkriptions-Orchestrierung
- AI: Headline-Generierung, Q&A aus Memos
- Space + Invite-Management, Credits, Settings, Cleanup
- Auth: @manacore/shared-hono authMiddleware (mana-auth JWT)
- DB: Service-Role Supabase Client mit expliziten user_id Filtern
```

#### `apps/memoro/apps/audio-server/` (Port 3016) — Audio Processing

Das war die technisch interessanteste Komponente. Azure Speech hat Ausfälle und Rate-Limits — der Audio-Server löst das mit einem **4-stufigen Fallback**:

```
Tier 1: Primärer Azure-Key (schnell, < 200ms)
         ↓ (bei Fehler/Timeout)
Tier 2: Gleicher Key, Retry (transiente Fehler)
         ↓ (bei anhaltenden Problemen)
Tier 3: FFmpeg-Konvertierung (PCM 16kHz Mono WAV)
         → Löst Codec-Inkompatibilitäten
         ↓ (bei Batch-Overflow)
Tier 4: Azure Batch Transcription
         → Für lange Aufnahmen (> 10 Minuten)
```

**Load Balancing:** Bis zu 4 Azure-Speech-Keys rotieren für parallele Transkriptionen.

**Intern only:** Der Audio-Server akzeptiert nur Requests mit `X-Service-Key` Header — kein direkter Zugriff von außen.

### Vergleich: Vorher vs. Nachher

| Aspekt       | NestJS (alt)                         | Hono/Bun (neu)                  |
| ------------ | ------------------------------------ | ------------------------------- |
| Services     | 2 (Backend + Audio-Backend)          | 2 (Server + Audio-Server)       |
| LOC (gesamt) | ~12.000                              | ~1.800                          |
| Dependencies | 20+ (@nestjs/\*, class-validator, …) | 4 (hono, zod, fluent-ffmpeg, …) |
| Cold Start   | ~2-3s                                | ~50ms                           |
| RAM          | ~400MB                               | ~80MB                           |
| Auth         | Supabase JWT                         | mana-auth JWT                   |
| OAuth        | Google + Apple                       | Keiner (self-sovereign)         |

---

## status.mana.how: Öffentliche Status-Page

ManaCore betreibt ~37 Services. Nutzer hatten bisher keine Möglichkeit zu prüfen ob ein Ausfall bekannt ist. Das ist jetzt behoben.

### Architektur

```
VictoriaMetrics (interne Metrics)
    ↓ alle 60s
scripts/generate-status-page.sh
    ↓ liest probe_success + response_times
statisches HTML
    ↓ schreibt nach
/Volumes/ManaData/landings/status/
    ↓ served von
Nginx → status.mana.how
```

**Kein separater Service.** Ein Alpine-Container mit `jq` und `curl` fragt VictoriaMetrics ab, generiert eine HTML-Datei und schreibt sie ins Landings-Volume. Nginx dient das statische HTML.

### Was angezeigt wird

- Status pro Service (Operational / Degraded / Down)
- Response Times der letzten Messungen
- Uptime über die letzten 24h / 7 Tage

### Blackbox Exporter

Parallel wurde der **Prometheus Blackbox Exporter** eingerichtet — er probt alle Services von außen per HTTP und liefert `probe_success` Metriken. Das ist die Grundlage für die Status-Page und für Grafana-Alerts.

### ManaScore Integration

Die Live-Uptime-Badges wurden direkt in die ManaScore-Seite integriert. Jede App zeigt jetzt ihre aktuellen Uptime-Werte aus `status.mana.how/status.json`.

---

## Todo: Weiteres Design-Polish

Nach dem Notepad-Redesign von gestern gab es heute mehrere Iteration-Loops auf Details.

### Paper-Style Task-Cards

Die Task-Cards wurden weiter bereinigt:

| Vorher                          | Nachher                                          |
| ------------------------------- | ------------------------------------------------ |
| Border + Hintergrundfarbe       | Kein Border, kein Hintergrund                    |
| Checkbox vertikal zentriert     | Checkbox am Anfang der ersten Zeile (flex-start) |
| Titel abgeschnitten (truncate)  | Mehrzeilig (word-break)                          |
| Hover: translateY + Hintergrund | Kein Hover-Effekt                                |

**Resultat:** Die Task-Liste liest sich wie echtes Papier — nur der Text, keine UI-Noise.

### Complete Animation + "Heute erledigt"

```
Task abgehakt → Checkbox fill-Animation (0.3s)
             → Task faded + durchgestrichen
             → Bewegt sich nach unten in "Heute erledigt"
             → "Heute erledigt" Section erscheint automatisch
```

Subtasks erben die Animation vom Parent-Task wenn dieser abgehakt wird.

### Task-Detail-Modal: Komplett redesigned

Das alte Detail-Modal war ein simples Formular. Das neue ist ein **page-like Layout**:

```
┌─────────────────────────────────────────────────────┐
│  Großer, borderloser Titel (Textarea, autoGrow)     │
├─────────────────────────────────┬───────────────────┤
│  Beschreibung                   │  Subtasks         │
│  (linke Spalte, fließend)       │  □ Subtask 1      │
│                                 │  □ Subtask 2      │
│                                 │  + Links          │
├─────────────────────────────────┴───────────────────┤
│  [Status] [Priorität] [Fällig: 15. Apr] [Projekt]   │
│  [Label] [Dauer: 30min] [Spaß ★★★] [Story Pts]      │
└─────────────────────────────────────────────────────┘
```

Props-Strip: alle Metadaten als horizontal-wrappende Chips. Kein Scrolling für Grundfelder nötig.

### Inline Subtasks im Kanban

KanbanTaskCards zeigen jetzt Subtasks direkt in der Card — mit Checkbox-Toggle und DnD-Safe-Fix (DnD blockierte vorher Subtask-Klicks via `stopPropagation`).

### Fokus-View Vereinfachung

Die zwei Tabs "Übersicht" und "Matrix" wurden entfernt. Es gibt nur noch den **Fokus-View** (Inbox/Heute/Übermorgen/Projekte). Die Matrix-Ansicht war kaum genutzt.

---

## Auth: Email-Verification Flow robustifiziert

Der Email-Verification-Flow hatte mehrere Edge-Cases die in der Praxis aufgetreten sind:

### Problem 1: EMAIL_NOT_VERIFIED nicht erkannt

Better-Auth wirft keinen strukturierten Error-Code — der Error kommt als Freitext. Die Erkennung war zu fragil (`message.includes("verify")`). Jetzt mehrere Heuristiken kombiniert:

```typescript
// Vorher
if (error.message.includes('verify')) { ... }

// Nachher
const isNotVerified =
  error.code === 'EMAIL_NOT_VERIFIED' ||
  error.message?.toLowerCase().includes('not verified') ||
  error.message?.toLowerCase().includes('verify your email') ||
  error.status === 403 && error.message?.includes('email');
```

### Problem 2: callbackURL vs. redirectTo

Better-Auth's `sendVerificationEmail` verwendet `callbackURL` — nicht `redirectTo`. Der Link in der E-Mail landete auf der falschen Seite. Fix: Parameter-Name korrigiert.

### Problem 3: Kein Resend-Panel

Wer sich mit einer existierenden, aber nicht verifizierten E-Mail registriert hatte, steckte fest — kein Weg um die Verification-Mail erneut zu senden.

**Neues Resend-Verification-Panel:** Erscheint automatisch wenn beim Login `EMAIL_NOT_VERIFIED` erkannt wird — mit Button zum erneuten Senden der E-Mail und Countdown-Timer (60s Cooldown).

---

## UI: Elevation-System & Komponenten-Vereinheitlichung

### Elevation-System in 4 Apps

Todo, Contacts, Calendar und Clock nutzen jetzt CSS Custom Properties statt hardcodierten Hex-/RGBA-Farben:

```css
/* Vorher (überall) */
background: rgba(255, 255, 255, 0.08);
border: 1px solid rgba(255, 255, 255, 0.15);

/* Nachher */
background: var(--surface-elevated);
border: 1px solid var(--border);
```

**Alle `:global(.dark)` Overrides entfernt** — die CSS-Variablen regeln Light/Dark automatisch. Das war der letzte Schritt um hardcoded Theme-Code aus diesen Apps zu eliminieren.

### Komponenten vereinheitlicht

Drei Komponenten die über viele Apps hinweg dupliziert waren:

| Komponente         | Apps (vorher)                                                 | Lösung                                                  |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------- |
| `LanguageSelector` | contacts, quotes: Custom-Dropdown mit eigenem State           | → `PillDropdown` aus shared-ui (wie die anderen 8 Apps) |
| `ConfirmDialog`    | context (4 Stellen), times (3 Stellen): lokale Kopien         | → `ConfirmationModal` aus `@manacore/shared-ui`         |
| `AppSlider`        | todo, calendar, chat, contacts, presi: statisches `MANA_APPS` | → `getActiveManaApps()` (filtert inaktive Apps)         |

**–228 Zeilen Netto**, 2 lokale Komponenten gelöscht.

---

## Infra: GHCR → Lokale Builds + Arcade Migration

### 4 Apps von GHCR migriert

Die letzten 4 Apps die noch GitHub Container Registry (GHCR) als Image-Quelle nutzten wurden auf das einheitliche lokale Build-Pattern umgestellt:

| App       | Vorher        | Nachher       |
| --------- | ------------- | ------------- |
| chat-web  | `ghcr.io/...` | lokaler Build |
| clock-web | `ghcr.io/...` | lokaler Build |
| presi-web | `ghcr.io/...` | lokaler Build |
| food-web  | `ghcr.io/...` | lokaler Build |

**Einzige Ausnahme:** Umami (externes Projekt) bleibt bei GHCR.

Damit nutzen jetzt **alle 37 eigenen Apps** lokale Builds über das gemeinsame `sveltekit-base:local` Image.

### Arcade: NestJS → Hono/Bun

Das Arcade-Backend (AI Browser Games) war noch auf NestJS. Migration auf Hono/Bun abgeschlossen — damit ist NestJS nun auch im Games-Bereich komplett eliminiert.

### Weitere Fixes

| Fix            | Beschreibung                                                 |
| -------------- | ------------------------------------------------------------ |
| Port-Konflikt  | calc-web: Port 5026 → 5031 (kollidierte mit quotes-web)      |
| Cloudflared    | Config mit tatsächlichen Container-Ports synchronisiert      |
| Landings Nginx | `mkdir snippets` vor Copy, status.mana.how vhost hinzugefügt |
| Prerender 404  | favicon.png 404s bei skilltree + food unterdrückt            |
| inventar-web   | Browser-Error-Tracking Import repariert                      |

---

## Dokumentation

Drei neue Planungs-/Guidelines-Dokumente:

**Auth UX Patterns** (`.claude/guidelines/authentication.md`): Regeln für den Email-Verification-Flow — wann welcher Banner/Dialog/Redirect erscheint. Verhindert die Edge-Cases von heute in Zukunft.

**Mana Bundle Format** (Plan-Dokument): Konzept für ein portables App-Bundle-Format — ermöglicht App-Exports als einzelne Datei (IndexedDB-Snapshot + Assets). Basis für zukünftige Backup/Restore-Features.

**Memoro Backend Migration** (Plan-Dokument): Schritt-für-Schritt-Plan der heute ausgeführten Migration — dokumentiert als Referenz für ähnliche Migrationen.

---

## Zusammenfassung

| Bereich            | Commits | Highlights                                                     |
| ------------------ | ------- | -------------------------------------------------------------- |
| Memoro Integration | ~25     | Web, Server, Audio-Server ins Monorepo                         |
| Status-Page        | ~12     | status.mana.how live, Blackbox Exporter, ManaScore-Badges      |
| Todo Polish        | ~20     | Paper-Cards, Complete-Animation, Detail-Modal, Kanban-Subtasks |
| Auth               | ~10     | EMAIL_NOT_VERIFIED robust, Resend-Panel, callbackURL Fix       |
| Infra              | ~15     | GHCR→lokal, Arcade, Port-Fix, Cloudflared                      |
| UI Unification     | ~8      | Elevation-System, LanguageSelector, ConfirmDialog, AppSlider   |
| Docs               | ~5      | Auth UX Patterns, Bundle Format, Memoro Plan                   |
| Fixes              | ~3      | Prerender, inventar-web, manacore-web Login-Redirect           |

---

## Nächste Schritte

- Memoro Production-Deploy + DNS
- Status-Page: Alert-Integration (Matrix-Benachrichtigung bei Downtime)
- Todo: Keyboard-Navigation-Pattern auf andere Apps übertragen (Quotes, Contacts)
- Debug-Borders als globales Shared-Package
