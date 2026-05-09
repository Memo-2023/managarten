---
title: 'Habits, Automations, Notes/Finance/Places + Stalwart Mail + Undo'
description: 'Vier neue Module (habits, automations, notes/finance, places mit GPS), Cross-Module Trigger-Registry für Automations, Stalwart Mail-Server intern, Undo-Toasts auf 14 DetailViews und cross-module clickable links mit overlay stacking.'
date: 2026-04-03
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'manacore',
    'habits',
    'automations',
    'notes',
    'finance',
    'places',
    'stalwart',
    'mail',
    'undo',
    'workbench',
    'context-menu',
  ]
featured: true
commits: 80
readTime: 13
stats:
  filesChanged: 2617
  linesAdded: 17005
  linesRemoved: 249085
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 80
workingHours:
  start: '2026-04-03T00:08'
  end: '2026-04-03T21:39'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Vier neue Module**: habits, automations, notes, finance, places (GPS)
- **Automations Trigger-Registry** — cross-module Aktionen reagieren aufeinander
- **Stalwart Mail-Server** intern für mana-notify (raus aus Brevo-only)
- **Undo-Toasts** auf 14 DetailViews + Task-Completion
- **Cross-Module clickable links** mit Overlay-Stacking
- **Page-Shell**: Drag-Header + Move/Min/Max/Close in eine Bar
- **−249k LOC** (massive Cleanup-Welle: 25 archivierte Apps endgültig gelöscht, Legacy-Code raus)

---

## Habits-Modul

Habits war eines der letzten Module die noch fehlten. Heute scaffolded und in einem Aufwasch produktiv:

### Features

- **Tally-Board** als Standardansicht — jeden Tag eine Spalte, jede Habit eine Zeile
- **Inline-Create** in der Liste, kein Modal
- **Detail-View** mit Streak-Anzeige, Verlauf, Notizen pro Tag
- **Phosphor-Icons statt Emojis** — neuer shared `<IconPicker>` (mit Suche), gilt jetzt auch für andere Module die Icons brauchen
- **Photos-Upload** an Daily-Entries möglich

Datenmodell: `habits` (Definition) + `habitEntries` (eine pro Tag pro Habit). Beide auf encrypted-by-default.

---

## Automations-Modul

Das wahrscheinlich konzeptuell interessanteste Stück des Tages: **Automations** als eigenes Modul, das aus jedem anderen Modul Trigger empfangen kann.

### Cross-Module Trigger-Registry

Module registrieren ihre Trigger zentral:

```typescript
// modules/todo/automations.ts
registerTriggers('todo', [
	{ id: 'task.completed', label: 'Aufgabe abgehakt' },
	{ id: 'task.created', label: 'Aufgabe erstellt' },
	{ id: 'task.due_today', label: 'Aufgabe wird heute fällig' },
]);
```

Und ihre Aktionen:

```typescript
registerActions('calendar', [{ id: 'event.create', label: 'Termin erstellen', schema: ZEvent }]);
```

Eine Automation verbindet **Trigger → Bedingungen → Aktion**:

```
WHEN  todo.task.completed
WHERE task.tag === 'sport'
THEN  habits.entry.create  habit='workout'
```

### UI für Trigger-Rules

Eine eigene Page in der Automations-App listet alle aktiven Rules. Inline-Editor mit Auto-Suggest aus der Trigger/Action-Registry.

### Proaktive Suggestions

Plus: das System schaut sich an was der User regelmäßig manuell macht ("nach jedem `task.completed` mit Tag 'sport' erstellt User eine `habit.entry`") und schlägt eine entsprechende Automation **inline** vor — dort wo das Verhalten passiert, nicht in einer separaten View.

---

## Notes, Finance — und ein konsolidiertes Registry

Zwei kleine Module nebenher gebaut:

### Notes

- Leichtes Notes-Modul (kein Markdown-Editor — pure Plain-Text + Tags)
- Click-to-edit, ListView mit kompaktem Input oben
- Workbench-Panel mit Inline-Edit (kein Detail-Modal nötig für Quick-Capture)

### Finance

- Buchhaltungs-Light (Income / Expense / Categories)
- Workbench-Panel direkt nutzbar — Eingabe + sofortige Liste

### Unified `AppDescriptor`

Vorher gab es zwei Registries: Entity-Registry (für DnD-Targets) + App-Registry (für Branding/Routing). Heute zusammengeführt zu einem **`AppDescriptor`**, der alles in einer Datei pro Modul beschreibt:

```typescript
export const todoApp: AppDescriptor = {
  id: 'todo',
  label: 'Todo',
  color: '#6366f1',
  icon: 'check',
  routes: [...],
  entityTypes: ['task', 'project', 'page'],
  dragSources: [...],
  dropTargets: [...],
  searchProvider: searchTodos,
};
```

Module registrieren sich mit einem einzigen Aufruf statt drei.

---

## Places-Modul mit GPS-Tracking

Das fünfte neue Modul des Tages: **Places** — einfache Location-Verwaltung, mit optionalem GPS-Tracking im Hintergrund.

- **GPS-Background-Tracking** opt-in (per Service-Worker / Permissions API)
- **Visit-Detection** via Stationary-Phasen
- **Reverse Geocoding** über OSM (Nominatim)
- **Map-View** mit OSM-Embeds (leaflet wurde im selben Sweep entfernt — siehe unten)

---

## Cross-Module Clickable Links + Overlay-Stacking

Kombiniert mit dem Detail-Overlay-System von gestern: jedes Item kann auf Items aus anderen Modulen verweisen, und ein Klick öffnet das Ziel **on top** des aktuellen Overlays.

```
TaskDetail (Overlay #1)
  → Linked Event "Sprint Review"
       Click → EventDetail (Overlay #2)
                 → Linked Contact "Anna"
                      Click → ContactDetail (Overlay #3)
```

ESC schließt nur das oberste Overlay. Das System tracked welche Items gerade offen sind, um Doppel-Open zu verhindern.

### Detail-View Polish

- **Animated Close** + ESC-Key (gestern war's nur Open-Animation)
- **Mehrere DetailViews offen** über AppPages hinweg
- **Tag-Pills mit Click-to-Remove** in jeder DetailView
- **Tags als Pills statt Dots** anzeigen — endlich mit Label

---

## Undo-Toasts — wirklich überall

Bisher gab es Undo nur für gelöschte Tasks. Heute ausgeweitet auf:

- **14 DetailViews** (delete + tag removal)
- **Task-Completion** (mit "Doch nicht erledigt"-Toast)

Pattern: jede destruktive Aktion stagged eine `pendingDelete` für 5 Sekunden, im Hintergrund läuft der Undo-Timer. Klick auf "Rückgängig" → restore. Sonst → flush.

---

## Stalwart Mail-Server

`mana-notify` lief bisher nur über Brevo (extern). Für interne Mails (User-Verifikation, System-Alerts, Memoro-Invites) ist das ungeeignet — Brevo zählt jeden Verify-Mail als "Marketing-Email".

### Stalwart als interner Postfix-Ersatz

```yaml
# docker-compose.macmini.yml
stalwart:
  image: stalwartlabs/stalwart
  ports:
    - '25:25'
    - '587:587'
  volumes:
    - stalwart-data:/opt/stalwart
```

`mana-notify` wird auf SMTP umgestellt — Stalwart ist Default für interne Mails, Brevo bleibt für Massenmails (Newsletter etc., später).

### Eine Reihe von Iterations

Stalwart ist neu — es gab heute mehrere Bugs:

| Issue                                        | Fix                                                   |
| -------------------------------------------- | ----------------------------------------------------- |
| Falscher Image-Name                          | `stalwartlabs/stalwart` (nicht `stalwart-mail`)       |
| Port-Mapping kollidierte mit Host-Postfix    | 25 + 587 explizit gemapped                            |
| Healthcheck schlug fehl                      | TCP-Check auf 587                                     |
| LOGIN-Auth schlug fehl                       | mana-notify SMTP-Sender komplett neu mit `LOGIN auth` |
| Insecure TLS für intern erlaubt              | Self-Signed-Zertifikate akzeptiert für interne Hops   |
| Falsche Account-Rolle                        | `noreply` mit `user`-Role statt admin                 |
| Brevo SMTP_USER fehlt als Default            | Backward-compat für externe Mails                     |
| Service-Key zwischen mana-auth & mana-notify | Aligned, sonst lehnt notify die Auth-Mails ab         |
| Message-ID + Date-Headers fehlten            | Outgoing-Mails landen sonst in Spam                   |

Am Ende: Auth-Mails vom mana-auth Service gehen jetzt **vollständig intern** über Stalwart raus. Spam-Score: gut.

### `mana-auth` → `mana-notify` Refactor

`mana-auth` hatte Nodemailer-Code für Verifikations-Mails. Jetzt routet es ALLE Mails über mana-notify (eine API, ein Sender, eine Stelle für Templates).

---

## PageShell: Drag + Window-Controls in eine Bar

Bisher hatte jede Page einen Drag-Bereich oben + separate Window-Controls in der Ecke. Confusing. Jetzt:

```
┌────────────────────────────────────────────────┐
│ ←  •••  Title  •••  → │ □  ⊟  ⊠  ✕            │
└────────────────────────────────────────────────┘
   Drag Handle              Min  Max  Close
```

- **Volle Drag-Bar** als Header (height reduziert auf das Nötige)
- **Window-Controls** (min/max/close) integriert
- **Left/Right Arrow Buttons** für Page-Navigation
- **Drag Preview** zeigt Item-Title + App-Color (statt nur "1 Item")
- **Drag-Handles immer sichtbar**, nicht nur on hover

### Drag vs Click Bug

Bug: nach DnD wurde der Click auch noch ausgelöst → Detail-View öffnete sich. Fix: Click-Event blocken wenn ein Drag gerade stattgefunden hat.

---

## Workbench Page-System

- **`PageCarousel` full-width** auf Homepage (kein Side-Padding)
- **Left scroll offset** damit die erste Page nicht am Rand klebt
- **Page Drag** restricted auf Handle-Area damit Items innerhalb der Page noch greifbar sind
- **Mobile responsive** — Page-Width passt sich an Viewport an

---

## Cleanup-Welle (−249k LOC)

Heute war auch Aufräumtag. Mit den 25 archivierten Apps von gestern und der Stabilität des Unified-Stacks konnte massiv Legacy raus:

| Cleanup                                                                       | LOC           |
| ----------------------------------------------------------------------------- | ------------- |
| 25 web-archived directories endgültig gelöscht                                | großer Teil   |
| Legacy per-app IndexedDB Migration                                            | ~3k           |
| Backend-API-Clients (Ghost-Code, kein Server mehr da)                         | ~5k           |
| Stale Stubs in Workspace-Config                                               | –             |
| `shared-auth-stores`, `shared-profile-ui`, `shared-app-onboarding` Referenzen | –             |
| Leaflet → OSM-Embeds (kein 200 KB JS-Bundle mehr)                             | –             |
| Codebase-weiter Consolidate-Sweep                                             | viele Dateien |

**Note:** Wir haben aktuell noch keine User in Production. Dieser Cleanup-Modus ist genau jetzt richtig — danach wird's politisch.

---

## Fixes & Polish

| Fix                                    | Beschreibung                                                           |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Effect depth exceeded                  | `guestMode` wurde versehentlich `$state()`, hat sich selbst getriggert |
| Entity registration hang               | Race-Condition zwischen Registry-Init und Module-Mount                 |
| 40 Svelte dev warnings                 | Clean-Startup ohne Console-Spam                                        |
| Default Port unified API               | 3050 → 3060 (3050 ist mana-sync)                                       |
| API-Server Dev-Scripts                 | Alle Scripts auf den Unified API umgestellt                            |
| Status-Page / Prometheus / Cloudflared | Configs für unified app aktualisiert                                   |
| Race in status-page-gen                | Lock-File während Generation                                           |
| Analytics Umami Website-ID             | Nach DB-Reset neue ID gepflegt                                         |
| `getTagsByIds`                         | Fehlender `allTags` Param in quotes gefixt                             |
| ManaContacts → Kontakte                | Branding-Rename                                                        |
| AppDrawer → new tab                    | Apps öffnen sich extern statt innerhalb der App                        |
| `bindclient:Height` → calculated       | Bottom-Chrome-Height berechnet, nicht gemessen                         |
| CSP localhost erlaubt                  | In Dev-Mode                                                            |
| `bottomChromeHeight` Order             | Deklaration vor Verwendung                                             |
| Sync revert                            | Per-app SSE → HTTP polling als Fallback (SSE-Bugs morgen klären)       |
| `@const` revert                        | Innerhalb `<div>` invalid                                              |

---

## Branding & UI

- **PillNav cleanup**: Observatory, API Keys, Gifts entfernt — waren Stubs
- **InputBar Toggle**: PillNav-Toggle nach rechts in InputBar verschoben (vorher links, blockierte Tag-Strip)
- **Tags**: leftmost Position in PillNav, größerer Toggle-Button

---

## Dokumentation

- `docs/MAIL_STALWART.md` — Setup-Notes, Auth-Config, Troubleshooting
- `docs/UNIFIED_APP_PHASE7_NOTES.md` — Detail-Patterns für Drag/Drop und Overlays

---

## Zusammenfassung

| Bereich               | Commits | Highlights                                         |
| --------------------- | ------- | -------------------------------------------------- |
| Neue Module           | ~14     | habits, automations, notes, finance, places        |
| Stalwart Mail         | ~13     | Setup, 8 Iterations bis stabil, mana-auth Refactor |
| Undo-Toasts           | ~3      | 14 DetailViews + Task-Completion                   |
| Cross-Module Links    | ~5      | Overlay-Stacking, animated close, ESC              |
| Workbench / PageShell | ~12     | Drag + Window-Controls in eine Bar                 |
| Cleanup               | ~10     | −249k LOC, Legacy + 25 archived Apps endgültig weg |
| Tag UI                | ~5      | Pills statt Dots, Click-to-Remove                  |
| Fixes                 | ~18     | Reactivity, Race-Conditions, Sync-Revert, CSP      |

---

## Nächste Schritte

- Mobile-Responsive für alle Module (PWA-fähig machen)
- Habits + Tasks scheduling: gemeinsamer Time-Block
- Finance Quick-Stats Widget für Dashboard
- Sync SSE-Bugs root-causen, polling wieder zurückbauen
