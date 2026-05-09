---
title: 'Credits-Kostenübersicht, Dashboard Fix, Infrastruktur-Hardening & CityCorners'
description: 'Neue Kosten-Tab für alle Mana-Credit-Operationen, Dashboard-Grid-Layout gefixt, PostgreSQL-Backup mit pgBackRest, Port-Exhaustion-Fix, SkillTree Achievements, Calendar i18n und CityCorners Features.'
date: 2026-03-24
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'credits',
    'dashboard',
    'infrastructure',
    'postgresql',
    'backup',
    'monitoring',
    'citycorners',
    'skilltree',
    'calendar',
    'i18n',
    'docker',
    'cloudflare',
    'accessibility',
  ]
featured: true
commits: 48
readTime: 14
stats:
  filesChanged: 248
  linesAdded: 12998
  linesRemoved: 2376
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 48
workingHours:
  start: '2026-03-24T06:00'
  end: '2026-03-24T12:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).


Intensive Vormittags-Session mit **48 Commits** über **248 Dateien** und netto **+10.622 Zeilen**:

- **Credits-Kostenübersicht** — Neuer "Kosten"-Tab zeigt alle 40+ Credit-Operationen nach App gruppiert
- **Dashboard-Layout gefixt** — Grid-Bug behoben + Layout-Polish (gleiche Höhen, bessere Gaps)
- **PostgreSQL-Backup** — pgBackRest für Point-in-Time Recovery eingerichtet
- **Port-Exhaustion-Fix** — 25.000 TIME_WAIT-Connections auf dem Server gelöst
- **SkillTree Achievements** — 26 Achievements mit Fortschritts-Tracking und Monetarisierung
- **Calendar i18n** — Komplette Lokalisierung aller Toast-Messages und Settings-Seiten
- **CityCorners** — Photo Gallery, Collections, Clustering, Soft Deletes, Rate Limiting

---

## 1. Credits: Kosten-Tab für alle Mana-Operationen

Die Credits-Seite unter `/credits` hatte bisher drei Tabs: Übersicht, Transaktionen und Credits kaufen. Was fehlte: Eine transparente Darstellung, **was wie viel kostet**.

### Neuer Tab "Kosten"

Der neue vierte Tab zeigt alle 40+ Credit-Operationen des gesamten Mana-Ökosystems, gruppiert nach App:

| App | Beispiel-Operationen | Kosten |
|-----|---------------------|--------|
| **Chat** | GPT-4 Message, Claude Message, Ollama (lokal) | 5, 5, 0.1 |
| **Picture** | Bild generieren, Upscale | 10, 5 |
| **Cards** | Deck generieren, Karte generieren | 20, 2 |
| **Todo** | Task erstellen, Smart Scheduling | 0.02, 2 |
| **Calendar** | Event erstellen, CalDAV Sync | 0.02, 0.5 |

### Features

- **Kategorie-Filter** — Buttons zum Filtern nach "Alle", "KI-Features", "Erstellen", "Premium"
- **Farbkodierte Badges** — Grün (kostenlos), Gelb (Micro-Credits < 1), Blau (Standard)
- **Info-Hinweis** — Lesen/Bearbeiten/Löschen ist immer kostenlos
- **URL-Parameter** — Direkt erreichbar via `?tab=costs`
- **TypeScript-Source-Exports** — `@manacore/credit-operations` exportiert jetzt TS direkt statt nur `dist/`, damit Vite es ohne vorherigen Build-Step bundlen kann

### Deployment-Challenges

Das Deployment erforderte mehrere Iterationen:
1. `credit-operations` Package fehlte im Web-Dockerfile → hinzugefügt
2. Package brauchte Build-Step vor Web-Build → auf Source-Exports umgestellt
3. Vorbestehende Syntax-Fehler in `LandingEditor.svelte` und `ContextDocsWidget.svelte` → gefixt
4. `shared-llm` fehlte im Auth-Dockerfile → hinzugefügt

---

## 2. Dashboard-Grid: Layout-Bug & Polish

### Der Bug

Das Dashboard zeigte alle Widgets in einer einzigen schmalen Spalte — Text war abgeschnitten, Cards nur ~100px breit.

**Ursache:** `svelte-dnd-action` wrappte jedes Widget in einem `<div animate:flip>`. Die `col-span-*` Klassen (z.B. `col-span-6`) waren auf dem **inneren** WidgetContainer-Div, nicht auf dem Wrapper-Div, das direkt am CSS-Grid teilnimmt. Ergebnis: Jedes Widget bekam implizit `col-span-1`.

**Fix:** `WIDGET_SIZE_CLASSES` auf den äußeren `animate:flip`-Wrapper verschoben.

### Layout-Polish

| Verbesserung | Vorher | Nachher |
|---|---|---|
| Grid-Gap | `gap-4` (16px) | `gap-5` (20px) |
| Zeilen-Höhe | Ungleichmäßig | `auto-rows-fr` (gleich hoch) |
| Widget min-height | Keine | `min-h-[10rem]` |
| Wrapper-Div | Unnötiges `<div>` | Direkt `<Card>` |
| Default-Layout | 2×medium + 1×large (Lücke) | 3×small (gleichmäßig) |

---

## 3. Infrastruktur: PostgreSQL-Backup & Port-Exhaustion

### pgBackRest für Point-in-Time Recovery

Neues Backup-System für die Produktions-Datenbank:

- **pg_dumpall** — Tägliche logische Full-Backups
- **pg_basebackup** — Wöchentliche physische Backups
- Konfiguration über `docker/postgres/pgbackrest.conf` und `docker/postgres/postgresql.conf`
- Dokumentation in `docs/POSTGRES_BACKUP.md`

### Port-Exhaustion: 25.000 TIME_WAIT-Connections

Beim Deployment wurde festgestellt, dass der Mac Mini Server **keine ausgehenden TCP-Verbindungen** aufbauen konnte — weder zu GitHub noch zu Docker Registry.

**Diagnose:**
- `netstat` zeigte 25.383 Connections im `TIME_WAIT`-Status
- Hauptverursacher: Cloudflare-Tunnel-Endpoints (188.114.96/97.x)
- Ephemeral Ports erschöpft → "Can't assign requested address"

**Fix:** n8n-Container entfernt (aggressive Health-Checks), Health-Check-Intervalle erhöht. Kurzfristige Workarounds: Git-Bundles via SCP statt `git pull`.

### Weitere Infra-Fixes

- **GlitchTip-DSNs** intern geroutet statt über Cloudflare-Roundtrip
- **Nginx-Healthchecks** auf `127.0.0.1` statt `localhost` (Alpine resolves zu IPv6)
- **PostgreSQL-Config** über `-c` Flags statt `config_file` Override

---

## 4. SkillTree: Achievement-System

Komplett neues Achievement-System mit **26 Achievements** in mehreren Kategorien:

- **Lern-Achievements** — Erste Skill, 10/50/100 Skills, Skill-Streaks
- **Fortschritts-Achievements** — Level-Meilensteine, XP-Schwellen
- **Soziale Achievements** — Geteilte Skills, Community-Beiträge
- **Konsistenz-Achievements** — Tägliche/wöchentliche Streaks

Backend-seitig mit Fortschritts-Tracking und Frontend mit Celebration-Animationen und Achievement-Karten.

---

## 5. Calendar & Todo: i18n & Accessibility

### Calendar: Komplette Lokalisierung

Alle Toast-Nachrichten und Settings-Seiten in 5 Sprachen (DE, EN, FR, ES, IT):

- **Toast Messages** — Erstellt, Aktualisiert, Gelöscht, Fehler-Meldungen
- **Settings Hauptseite** — Kalender-Einstellungen, Ansicht, Benachrichtigungen
- **Sync-Settings** — CalDAV, Google Calendar, Cloud Sync
- **Sharing-Settings** — Kalender teilen, Einladungen

### Focus Trapping für Modals

Neues `focusTrap` Action in `@manacore/shared-ui`:
- Tab-Navigation bleibt innerhalb des Modals
- Escape schließt das Modal
- Automatischer Fokus auf erstes interaktives Element
- Angewendet auf alle Modals in Calendar und Todo

### Auth Race Condition Fix

`appReady`-Gate für alle Web-Apps: Verhindert, dass Komponenten rendern bevor die Auth-Initialisierung abgeschlossen ist. Löst sporadische Redirects zum Login bei bereits eingeloggten Usern.

---

## 6. CityCorners: Feature-Sprint

Massive Erweiterungen für die Konstanz-Stadtführer-App:

### Backend
- **Slugs** — SEO-freundliche URLs für alle Locations
- **Collections** — Kuratierte Location-Sammlungen (z.B. "Altstadt-Tour")
- **Soft Deletes** — Locations werden als `deletedAt` markiert statt gelöscht
- **Rate Limiting** — API-Schutz gegen Missbrauch
- **Clustering** — Nahegelegene Locations werden auf der Karte gruppiert
- **Owner Tracking** — Locations haben einen Ersteller

### Web
- **Photo Gallery** — Bildergalerie pro Location
- **Nearby Locations** — "In der Nähe"-Vorschläge
- **Search History** — Letzte Suchen werden gespeichert
- **Edit/Delete UI** — Locations bearbeiten und löschen (nur für Owner)
- **Pagination** — Locations-Liste mit Seitennavigation

---

## 7. Monitoring & Observability

### LLM Grafana Dashboard

Neues Dashboard für den zentralen LLM-Service (`mana-llm`):
- Request-Rate pro Provider (OpenRouter, Gemini, Ollama)
- Latenz-Verteilung (p50, p95, p99)
- Token-Verbrauch und Kosten-Tracking
- Error-Rate mit Alerts

### Prometheus Alerting

Neue Alert-Regeln:
- LLM Error Rate > 5% → Warning
- LLM Latency p95 > 10s → Warning
- Provider Fallback aktiviert → Info

### ManaScore: Erweiterte Metriken

- **Lighthouse Score Integration** — Performance, Accessibility, Best Practices, SEO
- **Score Trend Visualization** — Sparkline-Charts für Score-Verlauf über Zeit
- **API Conformity Checks** — Einheitliche API-Patterns über alle Backends
- **Cross-App Consistency** — Konsistenz-Prüfung über alle Apps

---

## 8. Weitere Änderungen

| Bereich | Änderung |
|---------|----------|
| **Picture** | Lokale Bildgenerierung via `mana-image-gen` Service |
| **Project Doc Bot** | Migration auf `@manacore/shared-llm`, OpenAI-Dependency entfernt |
| **it.mana.how** | Neue Landing Page für europäische Tech-Souveränität |
| **Audits → ManaScore** | Rename von `/audits` zu `/manascore` + Methodology-Seite |
| **Cloudflare** | Fallback-Plan für Self-Hosted Landing Pages dokumentiert |

---

## Statistiken

| Metrik | Wert |
|--------|------|
| Commits | 48 |
| Dateien geändert | 248 |
| Zeilen hinzugefügt | 12.998 |
| Zeilen entfernt | 2.376 |
| Netto | +10.622 |
| Betroffene Apps | 15+ |
| Neue Packages | — |
| Docker-Rebuilds | 6 |
| Port-Exhaustion-Debugging | 1 (hoffentlich letzte) |
