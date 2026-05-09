---
title: 'Production Launch: 7 Apps Live auf mana.how'
description: 'Mac Mini Server Setup, Guest Mode, n8n Workflow Automation, Devlog und Monitoring Stack - ein produktiver Tag mit 43 Commits'
date: 2026-01-23
author: 'Till Schneider'
category: 'release'
tags:
  [
    'deployment',
    'docker',
    'monitoring',
    'mac-mini',
    'n8n',
    'guest-mode',
    'devlog',
    'infrastructure',
  ]
featured: true
commits: 43
readTime: 12
stats:
  filesChanged: 222
  linesAdded: 19273
  linesRemoved: 985
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 43
workingHours:
  start: '2026-01-23T11:00'
  end: '2026-01-24T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Heute war ein sehr produktiver Tag mit Fokus auf die **Produktivstellung der ManaCore Apps auf dem Mac Mini Server**. Die wichtigsten Errungenschaften:

- **7 Apps live** auf https://mana.how (Auth, Dashboard, Chat, Todo, Calendar, Clock, Contacts)
- **Session-First Guest Mode** - Apps ohne Anmeldung nutzbar
- **n8n Workflow Automation** für automatisierte Prozesse
- **Devlog Section** auf der ManaCore Landing Page
- **Monitoring Stack** eingerichtet (Prometheus, Grafana, Umami Analytics)
- **Telegram Stats Bot** für Analytics-Benachrichtigungen
- **Shared Landing UI** für einheitliche Landing Pages

---

## Mac Mini Server Setup & Management

### Auto-Start System

Einrichtung eines vollständigen Auto-Start-Systems für den Mac Mini Server:

- **LaunchAgent** für automatischen Start beim Boot
- **Management Scripts:**
  - `start-manacore.sh` - Startet alle Docker Container
  - `stop-manacore.sh` - Stoppt alle Container
  - `health-check.sh` - Prüft alle Services
  - `update-images.sh` - Aktualisiert Docker Images

### Notification System

Implementierung eines Benachrichtigungssystems:

- **Telegram Bot** für sofortige Alerts
- **Email Backup** via Gmail SMTP (msmtp)
- Automatische Benachrichtigung bei Service-Ausfällen

---

## Session-First Guest Mode

Großes UX-Update: **Alle Apps sind jetzt ohne Anmeldung nutzbar!**

### Konzept

Nutzer können Calendar, Chat, Clock und Todo sofort verwenden - ohne Account. Daten werden im `sessionStorage` gespeichert und beim Schließen des Tabs gelöscht.

### Implementierung

| Komponente            | Beschreibung                                    |
| --------------------- | ----------------------------------------------- |
| `AuthGateModal`       | Modal für Login-Aufforderung bei Cloud-Features |
| `session-*.svelte.ts` | Session-basierte Stores für temporäre Daten     |
| Guest Mode Banner     | Zeigt Anzahl der lokalen Items + Login-CTA      |

### Features

- **Sofortige Nutzung** ohne Registrierung
- **Daten-Migration** beim Login (Session → Cloud)
- **Return URL Handling** - Nach Login zurück zur vorherigen Seite
- **Item Counter** im Banner zeigt gespeicherte Einträge

### Betroffene Apps

- ✅ Calendar (Events, Kalender)
- ✅ Chat (Conversations)
- ✅ Clock (Timer, Alarme)
- ✅ Todo (Tasks, Projekte)

---

## Contacts App Deployment

### Docker Images erstellt

Erstellung der Docker-Konfiguration für Contacts:

- `apps/contacts/apps/backend/Dockerfile` (Port 3015)
- `apps/contacts/apps/web/Dockerfile` (Port 5184)
- `docker-entrypoint.sh` für automatische DB-Migrationen
- CI Workflow Updates für Image-Builds

### MinIO Object Storage

Einrichtung von MinIO für S3-kompatiblen Object Storage:

- MinIO Container in docker-compose.macmini.yml
- `contacts-photos` Bucket für Kontaktbilder
- S3 Environment Variables konfiguriert

**Live URLs:**

- https://contacts.mana.how (Web App)
- https://contacts-api.mana.how (Backend API)

---

## Monitoring & Analytics Stack

Vollständiger Monitoring Stack eingerichtet:

| Service               | Port | Beschreibung       |
| --------------------- | ---- | ------------------ |
| **Prometheus**        | 9090 | Metriken-Sammlung  |
| **Grafana**           | 3100 | grafana.mana.how   |
| **Node Exporter**     | 9100 | System-Metriken    |
| **cAdvisor**          | 8080 | Container-Metriken |
| **Postgres Exporter** | 9187 | Datenbank-Metriken |
| **Redis Exporter**    | 9121 | Cache-Metriken     |
| **Umami**             | 3200 | analytics.mana.how |

### Umami Analytics Integration

Integration von Umami Web Analytics in alle Apps:

- Unique Website IDs für jede App
- Tracking Script in allen Web Apps und Landing Pages
- URL geändert zu stats.mana.how

### Telegram Stats Bot

Neuer Bot für automatische Analytics-Reports:

- Tägliche Zusammenfassungen der Besucher-Statistiken
- Integration mit Umami API
- Konfigurierbare Benachrichtigungszeiten

---

## n8n Workflow Automation

Einrichtung von **n8n** als zentrale Workflow-Automation-Plattform:

- **Container:** `manacore-n8n` auf Port 5678
- **Datenbank:** Eigene PostgreSQL-Datenbank `n8n`
- **URL:** https://n8n.mana.how

### Geplante Automationen

- Backup-Workflows für Datenbanken
- Health-Check-Benachrichtigungen
- Deployment-Pipelines
- Analytics-Reports

---

## Devlog auf der Landing Page

Neues **Devlog-System** auf der ManaCore Landing Page implementiert:

### Astro Content Collections

- Schema für Devlog-Einträge mit Kategorien, Tags, Commits, Lesezeit
- Dynamische Routen für einzelne Einträge (`/devlog/[slug]`)
- Sortierung nach Datum

### Homepage-Integration

- Devlog-Section auf der Startseite mit den 3 neuesten Einträgen
- Kategorie-Badges mit Farbkodierung
- Navigation-Link im Header

### Kategorien

| Kategorie      | Farbe  | Verwendung                |
| -------------- | ------ | ------------------------- |
| Release        | Grün   | Neue Versionen            |
| Infrastructure | Blau   | Server, DevOps            |
| Feature        | Lila   | Neue Funktionen           |
| Bugfix         | Orange | Fehlerbehebungen          |
| Update         | Grau   | Allgemeine Aktualisierung |

---

## Landing Pages & Shared Components

### Shared Landing UI

Neues Package `@manacore/shared-landing-ui` mit wiederverwendbaren Astro-Komponenten:

- `Hero.astro` - Hero Section
- `Features.astro` - Feature Grid
- `Pricing.astro` - Preistabellen
- `CTA.astro` - Call-to-Action
- `Footer.astro` - Footer
- `Layout.astro` - Base Layout

### Zentrales Pricing System

Einheitliches Pricing für alle Mana Apps:

| Plan | Preis       | Features                        |
| ---- | ----------- | ------------------------------- |
| Free | 0€          | Basis-Features, limitiert       |
| Pro  | 4,99€/Monat | Alle Features, unbegrenzt       |
| Team | 9,99€/Monat | Team-Features, Priority Support |

---

## Infrastruktur-Übersicht

### Aktive Services auf Mac Mini

| Service          | Container           | Port      | Status |
| ---------------- | ------------------- | --------- | ------ |
| PostgreSQL       | manacore-postgres   | 5432      | ✅     |
| Redis            | manacore-redis      | 6379      | ✅     |
| MinIO            | manacore-minio      | 9000/9001 | ✅     |
| Auth             | mana-core-auth      | 3001      | ✅     |
| Dashboard        | manacore-web        | 5173      | ✅     |
| Chat Backend     | chat-backend        | 3002      | ✅     |
| Chat Web         | chat-web            | 3000      | ✅     |
| Todo Backend     | todo-backend        | 3018      | ✅     |
| Todo Web         | todo-web            | 5188      | ✅     |
| Calendar Backend | calendar-backend    | 3016      | ✅     |
| Calendar Web     | calendar-web        | 5186      | ✅     |
| Clock Backend    | clock-backend       | 3017      | ✅     |
| Clock Web        | clock-web           | 5187      | ✅     |
| Contacts Backend | contacts-backend    | 3015      | ✅     |
| Contacts Web     | contacts-web        | 5184      | ✅     |
| Prometheus       | manacore-prometheus | 9090      | ✅     |
| Grafana          | manacore-grafana    | 3100      | ✅     |
| Umami            | manacore-umami      | 3200      | ✅     |
| n8n              | manacore-n8n        | 5678      | ✅     |

### Live URLs

| App       | Web                       | API                           |
| --------- | ------------------------- | ----------------------------- |
| Dashboard | https://mana.how          | -                             |
| Auth      | -                         | https://auth.mana.how         |
| Chat      | https://chat.mana.how     | https://chat-api.mana.how     |
| Todo      | https://todo.mana.how     | https://todo-api.mana.how     |
| Calendar  | https://calendar.mana.how | https://calendar-api.mana.how |
| Clock     | https://clock.mana.how    | https://clock-api.mana.how    |
| Contacts  | https://contacts.mana.how | https://contacts-api.mana.how |
| Grafana   | https://grafana.mana.how  | -                             |
| Analytics | https://stats.mana.how    | -                             |
| n8n       | https://n8n.mana.how      | -                             |

---

## Erledigte Aufgaben

- ✅ **DNS konfiguriert** - Alle Subdomains via Cloudflare Tunnel
- ✅ **SSL Zertifikate** - Automatisch via Cloudflare
- ✅ **Devlog implementiert** - Content Collections + Landing Page Integration
- ✅ **n8n eingerichtet** - Workflow Automation Platform
- ✅ **Guest Mode** - Session-first UX für alle Apps

---

## Nächste Schritte

1. **Grafana Dashboards** erstellen für alle Services
2. **Backup-Strategie** implementieren (n8n Workflow)
3. **Mobile Apps** testen mit neuen Production APIs
4. **Landing Pages** auf Cloudflare Pages deployen
5. **n8n Workflows** für automatische Reports erstellen
