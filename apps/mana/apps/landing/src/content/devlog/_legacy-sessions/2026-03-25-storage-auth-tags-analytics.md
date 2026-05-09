---
title: 'Analytics, Help-System, CityCorners, ManaLink & Infra-Hardening'
description: 'Analytics Event-Tracking in 8+ Apps, Help-Pages für alle 18 Apps, CityCorners mit Reviews und Kategorien, ManaLink Mobile-Optimierung, Infra-Verbesserungen und ManaCore Dashboard-Polish.'
date: 2026-03-25
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'analytics',
    'help',
    'citycorners',
    'manalink',
    'infrastructure',
    'docker',
    'observatory',
    'dashboard',
    'monitoring',
    'ci',
  ]
featured: true
commits: 44
readTime: 12
stats:
  filesChanged: 255
  linesAdded: 10890
  linesRemoved: 1264
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 44
workingHours:
  start: '2026-03-25T08:00'
  end: '2026-03-25T21:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).


Breiter Arbeitstag mit **44 Commits** über viele Bereiche — Analytics, Help, CityCorners, ManaLink, Infra und Dashboard:

- **Analytics überall** — Custom Event Tracking in 8+ Apps, neuer ManaScore-Metrik
- **Help-System** — Help-Pages in allen 18 Apps, shared Mana & Privacy FAQs
- **CityCorners Ausbau** — Reviews, Ratings, Öffnungszeiten, 7 neue Kategorien
- **ManaLink** — Mobile-Layout optimiert, Chat-UX verbessert
- **Infra** — CI-Workflows, Dockerfile-Validator erweitert, Health-Checks gestaffelt
- **ManaCore Dashboard** — UX-Polish, White-Screen-Fix, localStorage zentralisiert

---

## 1. Analytics: Custom Event Tracking

Neuer `Analytics Maturity`-Metrik in ManaScore und Custom Event Tracking in 8+ Apps:

| App | Events |
|-----|--------|
| Storage | Upload, Download, Share, Preview |
| Photos | Upload, Edit, Album-Create |
| Context, SkillTree, Planta, Questions | App-spezifische Events |
| Food, Cards | Meal-Log, Card-Create |

### Commits

- `d2264f53` — Analytics Maturity ManaScore-Metrik + 4 Apps
- `bade0a17` — Storage Event Tracking
- `3075e515` — Photos Event Tracking
- `12b3c4f0` — Context, SkillTree, Planta, Questions
- `1fe8f890` — Food, Cards

---

## 2. Help-System für alle Apps

### Shared Help Content

- **Mana FAQ** — Was ist Mana? Wie funktionieren Credits? Abo-Infos
- **Privacy FAQ** — Datenschutz, DSGVO, Datenexport
- **PillNav Integration** — Help- und Themes-Links in der Navigation aller Apps

### App-spezifische Help-Pages

Help-Pages in 10+ bisher fehlende Apps nachgezogen, verbesserte Inhalte für alle 18 Apps, shared Translations extrahiert.

### Commits

- `dd5c0d50` — Calendar, Todo Help
- `f0233b8d` — Storage, Chat, Picture Help
- `7077c0a3` — Help-Pages in 10 Apps
- `bdab2722` — Shared Translations, Quotes + Mukke Help

---

## 3. CityCorners: Reviews & Kategorien

### Reviews & Ratings

- 5-Sterne-Bewertungen für Locations
- Review-Texte mit Zeitstempel
- Durchschnitts-Rating in Location-Cards

### Neue Features

- **Open/Closed Badges** — Echtzeit-Status basierend auf Öffnungszeiten
- **Map Category Filter** — Kategorien auf der Karte filtern
- **7 neue Kategorien** — Mit 35 Seed-Einträgen für Konstanz

### Commits

- `73037097` — Review und Rating System
- `89e32d47` — Open/Closed Badges, Map Category Filter, Öffnungszeiten
- `8b96b824` — 7 neue Kategorien mit 35 Seed-Einträgen

---

## 4. ManaLink

- **Mobile Layout** — Bottom-Sheets, kompakter Header, Touch-Interaktionen (`1edbc190`)
- **Chat UX** — Message-Grouping, Hover-Actions, Command-Palette (`06bf1502`)

---

## 5. ManaCore Dashboard & Observatory

### Dashboard Polish

- UX-Verbesserungen (`623ce1f0`, `7da67feb`)
- White-Screen-Fix beim Todo-Toggle (`73d55294`)
- localStorage-Keys zentralisiert in `storage-keys` Config (`05194407`, `59c8974a`)
- Kritische Production-Readiness-Issues behoben (`23261aab`)

### Seenplatte Observatory

- Tabbed Gallery-Views für Pflanzen und Seen (`80beef25`)
- Rivers, Leaderboard, Compare und Trends-Tabs (`aeca35ee`)

---

## 6. Infrastructure & DevOps

### Auth & Performance

- AuthGate-Pattern in allen Apps zentralisiert (`336cfedd`)
- JWKS Verification lokal statt HTTP-Call — Performance (`cacf8d7c`)
- Hardcoded localhost in User-Settings aller Apps gefixt (`3376b044`)

### CI/CD & Docker

- `audit:deps` und `generate:dockerfiles --check` in PR-Workflow (`858b7f68`)
- Dockerfile-Validator auf Backends und Services erweitert (`10524693`)
- Docker Health-Check Start-Periods gestaffelt (`37b061f7`)
- Cards Docker Deployment für Backend + Web (`6c1b472e`)
- ManaScore Extended Codebase-Metrics für alle App-Audits (`b9a9052a`)
- Fehlende prom-client Dependency in 4 Backends (`422b4f9f`)
- Onboarding-Modal in 8 Apps aus Flex-Layout rausgeschoben (`491c71e2`)
- Fehlende Cloudflare-Tunnel-Routes für Quotes, SkillTree, Planta (`d8886346`)

### Dokumentation

- Windows GPU Server Docs hinzugefügt (`3631cc77`)
- Base-Images und build-app.sh dokumentiert (`6efeadb3`)

---

## Zusammenfassung

| Bereich | Änderung |
|---------|----------|
| **Analytics** | Custom Event Tracking in 8+ Apps, ManaScore-Metrik |
| **Help** | Help-Pages in allen 18 Apps, Shared Mana & Privacy FAQs |
| **CityCorners** | Reviews, Ratings, 7 Kategorien, Open/Closed-Status |
| **ManaLink** | Mobile Bottom-Sheets, Chat Message-Grouping |
| **Dashboard** | UX-Polish, White-Screen-Fix, localStorage zentralisiert |
| **Infra** | CI-Workflows, Dockerfile-Validator, Health-Checks gestaffelt |
| **Gesamt** | 44 Commits, 255 Dateien, +10.890 / -1.264 Zeilen |
