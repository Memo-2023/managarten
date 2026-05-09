---
title: 'Settings-Redesign, Geocoding-Deploy, Monitoring-Ausbau + Status-Page-Hardening'
description: 'Settings-Page komplett redesigned mit PillNav-Compute-Selector, Geocoding-Deploy auf Prod mit Pelias + Prometheus + Grafana, 10 fehlende Module in Blackbox-Probes, Status-Page Shell-Kompatibilität, mana-credits + mana-sync Dockerfiles gefixt.'
date: 2026-04-11
author: 'Till Schneider'
category: 'infrastructure'
tags:
  [
    'settings',
    'geocoding',
    'pelias',
    'monitoring',
    'prometheus',
    'grafana',
    'status-page',
    'docker',
    'mana-credits',
    'mana-sync',
  ]
featured: false
commits: 29
readTime: 10
stats:
  filesChanged: 108
  linesAdded: 4455
  linesRemoved: 1232
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 29
workingHours:
  start: '2026-04-11T10:00'
  end: '2026-04-11T19:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Settings-Page Redesign** mit PillNav-Compute-Selector
- **Geocoding-Deploy** auf Prod — Pelias in Prometheus + Grafana + status.mana.how
- **10 fehlende Module** in Blackbox-Probes nachgetragen
- **Status-Page Shell-Hardening** — ash-kompatibel, set -e/u safe
- **mana-credits + mana-sync Dockerfiles** komplett überarbeitet
- **Workbench Polish** — Paper-Grain-Textur, AppPagePicker-Design, Bottom-Stack-Spacing

---

## Settings-Page Redesign

Die Settings-Page wurde komplett neu designed:

- **PillNav-Compute-Selector**: Der AI-Compute-Tier (Browser / Server / Cloud / BYOK) ist jetzt über einen PillNav-Dropdown in den Settings wählbar
- **Account-Dropdown**: User-Pills kollabiert in ein Account-Dropdown mit soliden Pill-Backgrounds
- **Credits/Sync API**: Client zeigt auf `credits.mana.how` statt auf relative Pfade

---

## Geocoding-Deploy auf Prod

Der Self-Hosted Geocoding-Stack (Pelias) wurde auf dem Mac Mini deployed:

### Monitoring-Integration

- **Prometheus**: Pelias-Scrape-Target hinzugefügt
- **Grafana**: Dashboard für Geocoding-Latenz + Request-Rate
- **status.mana.how**: Geocoding als eigener Service-Check

### Geocoding-Hardening

Fünf Fixes nach dem ersten Prod-Deploy:

| Fix             | Problem                                       | Lösung                                     |
| --------------- | --------------------------------------------- | ------------------------------------------ |
| Pelias Config   | DACH-only Import nicht korrekt                | Single-Country-Filter in der Pelias-Config |
| Health-Proxy    | Pelias-Health nicht erreichbar für Monitoring | Health-Endpoint durch den Wrapper proxied  |
| libpostal Port  | Port 4400 Konflikt mit anderem Service        | libpostal nicht auf Host-Port binden       |
| Unused Services | 3 Pelias-Services liefen unnötig              | Entfernt, Bun idleTimeout erhöht           |
| Category-Patch  | Pelias-Taxonomie incomplete                   | Auto-Kategorisierung via Taxonomy-Mapping  |

### Doku

- `CLAUDE.md` mit Deploy-Lessons-Learned aktualisiert
- Pelias-Category-Patch + Import-Gotchas dokumentiert

---

## Monitoring: 10 fehlende Module

Blackbox-Probes in Prometheus hatten 10 Module nicht überwacht. Nachgetragen:

- Geocoding als neuer Service
- Die fehlenden 10 Web-Module mit Health-Checks

---

## Status-Page Shell-Hardening

Drei Fixes für die Status-Page (`status.mana.how`), die als Alpine-Container läuft:

1. **`set -e` entfernt**: Heredoc-Subshells triggern Silent Exits in ash
2. **`${TIER_APPS:-}`**: Leere Variable mit `set -u` abgesichert
3. **Multi-line awk → Shell Loop**: awk-Syntax nicht ash-kompatibel, durch einfache Shell-Loops ersetzt

---

## Docker: mana-credits + mana-sync

### mana-credits

Das Dockerfile wurde dreimal iteriert:

1. `WORKDIR` statt `cd` (Dockerfile-Best-Practice)
2. `pnpm` statt `npm` für Workspace-Dependency-Resolution
3. Multi-Stage Build mit `node+pnpm` Installer

Das Kernproblem: mana-credits ist ein pnpm-Workspace-Package und braucht den Workspace-Context für die `@mana/*` Dependencies. Ein plain `npm install` resolves die Workspace-Deps nicht.

### mana-sync

- Go Base Image auf 1.25 gebumpt (match go.mod)
- `shared-go` Workspace-Dependency in den Build-Context kopiert

---

## Workbench Polish

### Paper-Grain-Textur

Neues visuelles Detail: die Workbench-Pages bekommen eine subtile Paper-Grain-Textur:

- CSS `mix-blend-mode` für den Grain-Overlay
- Border mit Stone-Palette-Farben
- Dynamische Page-Height + tighter Bottom-Stack-Spacing

### AppPagePicker

- Design matched jetzt die Module-Pages (gleiche Card-Styles, gleiche Spacing)
- `@const` aus `{#if}` verschoben (Svelte 5 Snippet-Kompatibilität)

---

## Sonstige Fixes

| Fix              | Detail                                                         |
| ---------------- | -------------------------------------------------------------- |
| Safari CORS Hang | HTTP → HTTPS Redirect verbessert für Safari                    |
| HTTPS Detection  | Robustere HTTP-Detection für den Redirect                      |
| presi db:push    | Schema-Push für Presi via @mana/api verdrahtet                 |
| Places           | Reverse-Geocoded Location-Label + Full Address + Browser Proxy |

---

## Numbers

|                   |                                   |
| ----------------- | --------------------------------- |
| Commits           | 29                                |
| Files changed     | 108                               |
| LOC added         | ~4.450                            |
| LOC removed       | ~1.230                            |
| Net               | +3.220                            |
| Docker-Fixes      | 5 (mana-credits ×3, mana-sync ×2) |
| Monitoring-Probes | +10                               |

---

## Lehren

1. **Alpine ash ≠ bash**: Status-Page-Scripts die auf macOS funktionieren crashen in Alpine-Containern. `set -e` + Heredocs, awk multi-line Syntax, und unset Variables verhalten sich alle anders. Immer im Container testen.

2. **Dockerfile-Iteration ist normal**: Das mana-credits Dockerfile brauchte drei Versuche. pnpm-Workspace-Dependencies in Docker-Builds sind nicht trivial — der erste Versuch ist fast nie der richtige.
