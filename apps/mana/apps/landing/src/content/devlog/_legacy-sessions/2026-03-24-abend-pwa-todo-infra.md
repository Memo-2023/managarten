---
title: 'PWA-Icons für alle Apps, Todo UX-Overhaul, Port-Exhaustion-Fix & Dashboard Widget'
description: 'PWA-Icons und Offline-Prerender für 20 Apps, Todo-App mit Inline-Edit und Drag-Fix, Mac Mini Port-Exhaustion behoben, Dockerfile-Validator, Dashboard-Widget zeigt alle Tasks.'
date: 2026-03-24
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'pwa',
    'todo',
    'drag-and-drop',
    'infrastructure',
    'docker',
    'port-exhaustion',
    'dashboard',
    'inline-edit',
    'offline',
    'sysctl',
    'glitchtip',
    'devops',
  ]
featured: true
commits: 41
readTime: 12
stats:
  filesChanged: 302
  linesAdded: 17583
  linesRemoved: 3471
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 41
workingHours:
  start: '2026-03-24T12:00'
  end: '2026-03-24T23:59'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Intensive Abend-Session mit **41 Commits** über **302 Dateien** und netto **+14.112 Zeilen**:

- **PWA für alle Apps** — Icons, Meta-Tags und Offline-Prerender für 20 Web-Apps
- **Mac Mini Port-Exhaustion** — 25.000 stuck TIME_WAIT Sockets → 3 nach Reboot + sysctl-Tuning
- **Todo UX-Overhaul** — Inline Title Edit, Drag-Handle-Fix, vereinfachte Sections, Long Press
- **Dashboard Widget** — Zeigt jetzt alle offenen Tasks statt nur heute
- **Dockerfile-Validator** — Automatische Erkennung fehlender COPY-Statements
- **Auth-Verbesserungen** — Session-Expired-Banner, lokaler JWKS-Cache, Auth-Race-Condition-Fix

---

## 1. PWA: Icons & Offline-Prerender für alle Apps

### Das Problem

Beim Versuch, die Calendar-App als PWA zu installieren, fehlten die Icons (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`) und die PWA-Meta-Tags in `app.html`. Chrome zeigte keinen Install-Button.

Zusätzlich hatten **alle 20 Web-Apps** einen Service-Worker-Fehler: `non-precached-url :: [{"url":"/offline"}]` — die `/offline`-Route war nicht prerendered, weshalb Workbox sie nicht cachen konnte.

### Die Lösung

**Calendar & Todo & Storage:** SVG-Favicon designed, `generate-icons.mjs` Script erstellt, alle PWA-Icons generiert (32px, 180px, 192px, 512px), `app.html` mit vollständigen PWA-Meta-Tags.

**Alle 20 Apps:** `+page.ts` mit `export const prerender = true` in jeder `/offline`-Route hinzugefügt.

### Commits

- `8bc52f42` — Calendar: PWA Icons, Meta-Tags, app.html
- `61c23d5e` — Todo: PWA Icons, Meta-Tags, Offline-Prerender (+ 8 weitere Dockerfiles)
- `91daba06` — Storage: PWA Icons und Meta-Tags (Build-Fix)

---

## 2. Mac Mini: Port-Exhaustion Fix

### Das Problem

Der Mac Mini konnte keine ausgehenden TCP-Verbindungen mehr aufbauen — `git pull`, `docker pull`, `curl` — alles scheiterte mit "Can't assign requested address". Diagnose: **25.156 Sockets im TIME_WAIT** bei nur 16.384 verfügbaren Ephemeral-Ports (49152-65535).

### Ursachen

| Verursacher                   | Sockets | Grund                                                                                                        |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| GlitchTip DSNs via Cloudflare | ~6.000  | Alle 13 Backends schickten Error-Reports über `glitchtip.mana.how` → Cloudflare → Tunnel → zurück zum Server |
| Localhost Health-Checks       | ~8.800  | 52 Health-Checks alle 30 Sekunden                                                                            |
| n8n Automation                | ~3.000  | Workflows die ständig externe APIs pollten                                                                   |
| Diverse externe APIs          | ~7.000  | GitHub, AWS, etc.                                                                                            |

### Die Lösung

1. **n8n entfernt** — nicht mehr benötigt
2. **Health-Check-Intervalle** — 30s → 120s (Apps), 10s → 30s (Infra)
3. **GlitchTip DSNs intern geroutet** — `glitchtip.mana.how` → `glitchtip:8020` (Docker-intern, kein Cloudflare-Roundtrip)
4. **sysctl-Tuning** — `net.inet.tcp.msl=5000` (TIME_WAIT von 30s auf 10s), `net.inet.ip.portrange.first=10000` (55k statt 16k Ports)
5. **Server-Reboot** — Einziger Weg die stuck Sockets zu clearen
6. **SSH Deploy Key** — Neuer Ed25519-Key für GitHub-Zugriff nach Reboot

**Ergebnis:** 25.000 TIME_WAIT → 3. Alle 72 Container healthy.

### Commits

- `6cab9a3c` — n8n entfernt, Health-Checks 30s → 120s
- `124b4f7c` — GlitchTip DSNs intern geroutet

---

## 3. Todo: UX-Overhaul

### Drag & Drop Fix

Das Reordering war komplett kaputt: Items verschwanden nach dem Ziehen, weil `handleDndFinalize` nie `tasksStore.reorderTasks()` aufrief. Zusätzlich fehlte ein `ReorderTasksDto` im Backend — die globale `ValidationPipe` mit `forbidNonWhitelisted` lehnte den Request Body ab ("property taskIds should not exist").

| Vorher                    | Nachher                          |
| ------------------------- | -------------------------------- |
| Hamburger-Icon (2 Linien) | 6-Punkte Grip-Icon (Standard)    |
| 16px Icon                 | 20px Icon + größere Klickfläche  |
| Reorder nicht persistiert | Optimistic Update + API-Call     |
| Kein DTO → 400 Error      | `ReorderTasksDto` mit Validation |

### Inline Title Edit

Klick auf den Task-Titel öffnet jetzt direkt ein Inline-Input statt den kompletten Expanded-Bereich. Enter speichert, Escape bricht ab, Blur speichert.

### Long Press (Mobile)

500ms Long Press auf einem Task öffnet den Expanded-Bereich mit allen Feldern — die einzige Möglichkeit auf Touch-Geräten, da der Expanded-Bereich nicht mehr über ein Chevron erreichbar ist.

### Vereinfachte Sections

Sections (Heute, Morgen, Überfällig, etc.) sind jetzt immer offen. Kein Chevron, kein Count, kein Collapse — nur Icon + Titel als schlichte Überschrift.

### UI-Anpassungen

- Reihenfolge: Drag-Handle → **Checkbox → Priority-Dot** → Content (vorher: Priority → Checkbox)
- Priority-Dot vergrößert (0.5rem → 0.625rem)
- Chevron-Icon rechts entfernt

### Commits

- `c9644798` — Drag-Handle Grip-Icon + Reorder-Persistence-Fix
- `f42f9ce8` — Checkbox/Priority-Swap, Priority-Dot größer, Chevron entfernt
- `4b4cdd8c` — Inline Title Editing
- `ea37288f` — Long Press für Mobile
- `10df359f` — Vereinfachte Section-Headers
- `d6eacc1c` — ReorderTasksDto Backend-Fix

---

## 4. Dashboard: Tasks-Widget zeigt alle offenen Tasks

### Das Problem

Das "Aufgaben heute"-Widget auf `mana.how` zeigte "Keine Aufgaben", obwohl Tasks existierten — weil es nur `GET /tasks/today` aufrief, das nach `dueDate = heute` filtert. Tasks ohne Datum waren unsichtbar.

### Die Lösung

Neuer `getAllOpenTasks()` Service-Call, der `GET /tasks` nutzt und alle offenen Tasks holt, sortiert nach Datum (heute/überfällig zuerst, dann Zukunft, dann ohne Datum). Das Widget zeigt jetzt das Due-Date neben dem Titel mit Overdue-Highlighting.

### Commits

- `47dbe00d` — Widget zeigt alle offenen Tasks
- `5c2a8d07` — date-fns Dependency für Docker-Build

---

## 5. Dockerfile-Fixes & Validator

### Fehlende Packages in Dockerfiles

9 Web-App-Dockerfiles fehlte das `COPY packages/shared-app-onboarding` Statement, was zu Build-Fehlern führte. Betroffen: Chat, Clock, Mukke, Photos, Picture, Presi, Skilltree, Storage, Quotes.

### Dockerfile Dependency Validator

Neues Script `scripts/validate-dockerfiles.mjs` das automatisch alle `package.json`-Imports analysiert und prüft, ob die entsprechenden `COPY`-Statements in den Dockerfiles vorhanden sind. Wird auch als GitHub Actions Workflow bei PRs ausgeführt.

Zusätzlich: `scripts/generate-dockerfile-copies.mjs` das automatisch korrekte COPY-Statements generiert.

### Commits

- `61c23d5e` — shared-app-onboarding in 9 Dockerfiles
- `a2605e88` — Dockerfile Dependency Validator + 16 fehlende COPYs gefixt
- `90c438e2` — Auto-Generate Dockerfile COPY Statements
- `decd79d5` — Docker Build Validation CI Workflow

---

## 6. Auth-Verbesserungen

- **Session-Expired-Banner** — Wenn Token-Refresh fehlschlägt, erscheint ein nicht-blockierender Banner mit Re-Login-Button statt einer Endlos-Ladeschleife (`d6440664`, `bf7517d2`)
- **Lokaler JWKS-Cache** — Backend cached JWKS-Keys lokal statt HTTP-Self-Call bei jedem Request (`5b5849ea`, `8356ac63`)
- **Auth-Race-Condition** — `appReady` Gate verhindert, dass Widgets API-Calls machen bevor SSO abgeschlossen ist (`000b74af`)
- **Single Fetch Interceptor** — Auth-Interceptor für mehrere Backend-URLs konsolidiert (`d0802362`)

---

## 7. Weitere Änderungen

- **Seenplatte Observatory** — Interaktive Visualisierung des ManaCore-Ökosystems als See-Metapher mit Tooltips, Detail-Panel und Radar-Chart (`76484377`, `23dac327`)
- **Landing Mega-Footer** — Rich Footer mit App-Links, Social-Links und Branding (`04f5afe6`)
- **Intelligent Quick-Create Parsers** — NLP-Parser für 6 Apps mit mehrsprachiger Unterstützung (`52864041`)
- **Help System Hardening** — XSS-Schutz, i18n, Type Safety (`42dd7d2a`)
- **Workspace Dependency Audit** — Script zur Erkennung veralteter/fehlender Workspace-Dependencies (`f2488f86`)
- **ManaScores aktualisiert** — Storage 82→84, Todo und Calendar PWA dokumentiert (`9431af65`)

---

## Zusammenfassung

| Bereich            | Änderung                                                       |
| ------------------ | -------------------------------------------------------------- |
| **PWA**            | 20 Apps mit Offline-Prerender, 3 Apps mit neuen Icons          |
| **Infrastructure** | Port-Exhaustion behoben, n8n entfernt, Health-Checks optimiert |
| **Todo**           | Inline Edit, Drag-Fix, Long Press, vereinfachte Sections       |
| **Dashboard**      | Tasks-Widget zeigt alle offenen Tasks                          |
| **Docker**         | Validator, Auto-Generate, 16+ fehlende COPYs gefixt            |
| **Auth**           | Session-Banner, JWKS-Cache, Race-Condition-Fix                 |
| **Server**         | 72 Container healthy, 3 TIME_WAIT Sockets                      |
