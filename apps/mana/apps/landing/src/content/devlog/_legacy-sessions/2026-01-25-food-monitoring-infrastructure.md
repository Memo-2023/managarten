---
title: 'Food App, Prometheus Monitoring & Watchtower Auto-Deploy'
description: 'AI-powered Nutrition Tracking App hinzugefügt, Prometheus Metriken für alle Backends, umfassende Grafana Dashboards, und Watchtower für automatisches Container-Deployment.'
date: 2026-01-25
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'food',
    'prometheus',
    'grafana',
    'watchtower',
    'monitoring',
    'docker',
    'ci-cd',
    'health-checks',
    'presi',
    'storage',
  ]
featured: true
commits: 38
readTime: 15
stats:
  filesChanged: 446
  linesAdded: 32534
  linesRemoved: 17786
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 38
workingHours:
  start: '2026-01-25T11:00'
  end: '2026-01-26T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Massiver Tag mit **38 Commits** und Fokus auf neue App, Monitoring und Infrastructure:

- **Food** - AI-powered Nutrition Tracking App mit Gemini
- **Prometheus Metriken** - Für alle Backends implementiert
- **Grafana Dashboards** - Umfassende Visualisierung und Alerting
- **Watchtower** - Automatisches Docker-Image-Update auf Mac Mini
- **Presi & Storage** - Apps aus Archiv wiederhergestellt

---

## Food - AI Nutrition Tracking

Neue App für intelligentes Ernährungs-Tracking mit AI-Analyse.

### Features

| Feature               | Beschreibung                                |
| --------------------- | ------------------------------------------- |
| **Foto-Analyse**      | Mahlzeit fotografieren, AI erkennt Zutaten  |
| **Nährwert-Tracking** | Kalorien, Makros, Mikronährstoffe           |
| **Meal History**      | Tägliche/wöchentliche Übersichten           |
| **AI Suggestions**    | Ernährungsempfehlungen basierend auf Zielen |

### Tech Stack

```
┌─────────────────────────────────────────────────────┐
│                   Food                           │
├──────────────┬──────────────┬───────────────────────┤
│  Mobile      │    Web       │     Backend           │
│  (Expo)      │  (SvelteKit) │     (NestJS)          │
├──────────────┴──────────────┴───────────────────────┤
│                Google Gemini API                     │
│           (Vision + Text Analysis)                   │
└─────────────────────────────────────────────────────┘
```

### Datenbankschema

```sql
-- Haupttabellen
CREATE TABLE meals (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT,
  photo_url TEXT,
  eaten_at TIMESTAMP,
  calories INTEGER,
  protein DECIMAL,
  carbs DECIMAL,
  fat DECIMAL
);

CREATE TABLE daily_goals (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  calories_target INTEGER,
  protein_target DECIMAL,
  carbs_target DECIMAL,
  fat_target DECIMAL
);
```

---

## Prometheus Metriken

Monitoring-Integration für alle NestJS Backends.

### Implementation

```typescript
// Jedes Backend hat jetzt:
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
	imports: [
		PrometheusModule.register({
			defaultMetrics: { enabled: true },
			path: '/metrics',
		}),
	],
})
export class AppModule {}
```

### Metriken pro Backend

| Metrik                          | Typ       | Beschreibung             |
| ------------------------------- | --------- | ------------------------ |
| `http_requests_total`           | Counter   | Gesamtzahl HTTP Requests |
| `http_request_duration_seconds` | Histogram | Request-Dauer            |
| `http_requests_in_progress`     | Gauge     | Aktive Requests          |
| `nodejs_heap_size_bytes`        | Gauge     | Memory Usage             |
| `active_users_total`            | Gauge     | Eingeloggte User         |

### Betroffene Backends

- mana-core-auth (Port 3001)
- chat-backend (Port 3002)
- todo-backend (Port 3004)
- clock-backend (Port 3005)
- picture-backend (Port 3006)
- quotes-backend (Port 3007)
- presi-backend (Port 3008)
- cards-backend (Port 3009)
- contacts-backend (Port 3010)
- calendar-backend (Port 3016)
- food-backend (Port 3027)

---

## Grafana Dashboards

Umfassende Visualisierung aller ManaCore Services.

### Dashboard-Übersicht

```
┌─────────────────────────────────────────────────────┐
│              ManaCore Monitoring                     │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  Overview   │ │  Services   │ │   Alerts    │   │
│  │  Dashboard  │ │  Dashboard  │ │  Dashboard  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │   CI/CD     │ │   Docker    │ │   User      │   │
│  │  Pipeline   │ │  Containers │ │  Statistics │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Alerting Rules

| Alert           | Condition       | Severity |
| --------------- | --------------- | -------- |
| `ServiceDown`   | Up == 0 for 1m  | Critical |
| `HighErrorRate` | Error rate > 5% | Warning  |
| `HighLatency`   | P99 > 500ms     | Warning  |
| `HighMemory`    | Memory > 80%    | Warning  |

### User Statistics Panel

Neues Feature: User-Statistiken in Grafana anzeigen:

```typescript
// Metrics endpoint includes active users
register.registerMetric(
	new Gauge({
		name: 'manacore_active_users',
		help: 'Number of active users per app',
		labelNames: ['app'],
	})
);
```

---

## Watchtower Auto-Deploy

Automatisches Container-Update bei neuen Docker Images.

### Konfiguration

```yaml
# docker-compose.macmini.yml
watchtower:
  image: containrrr/watchtower
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  environment:
    - WATCHTOWER_CLEANUP=true
    - WATCHTOWER_POLL_INTERVAL=300
    - WATCHTOWER_INCLUDE_STOPPED=true
  command: --interval 300
```

### Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   GitHub     │────>│   GitHub     │────>│   Docker     │
│   Push       │     │   Actions    │     │   Registry   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Service    │<────│  Watchtower  │<────│   Polling    │
│   Restart    │     │   Pull       │     │   (5 min)    │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Vorteile

- **Zero-Downtime**: Rolling Updates
- **Automatisch**: Keine manuellen Deployments nötig
- **Cleanup**: Alte Images werden gelöscht

---

## Presi & Storage Apps

Apps aus dem Archiv wiederhergestellt und deployment-ready gemacht.

### Presi (Präsentations-Tool)

| Feature       | Status          |
| ------------- | --------------- |
| Slide Editor  | ✅ Funktional   |
| Export PDF    | ✅ Funktional   |
| Collaboration | 🚧 In Progress  |
| Docker        | ✅ Konfiguriert |

### Storage (Cloud Storage)

| Feature           | Status          |
| ----------------- | --------------- |
| File Upload       | ✅ Funktional   |
| Folder Management | ✅ Funktional   |
| Sharing           | 🚧 In Progress  |
| Docker            | ✅ Konfiguriert |

### Deployment Config

```yaml
# Neue Services in docker-compose.macmini.yml
presi-backend:
  image: ghcr.io/till-js/presi-backend:latest
  ports:
    - '3008:3008'
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:3008/health']

storage-web:
  image: ghcr.io/till-js/storage-web:latest
  ports:
    - '5185:5185'
```

---

## Health Endpoints

Alle Web-Apps haben jetzt `/health` Endpoints für Monitoring.

### Implementation

```typescript
// +server.ts in jeder SvelteKit App
export async function GET() {
	return json({ status: 'healthy', timestamp: new Date().toISOString() });
}
```

### Betroffene Apps

- calendar-web, clock-web, contacts-web
- chat-web, picture-web, quotes-web
- todo-web, cards-web, manacore-web
- presi-web, storage-web, food-web

---

## CI/CD Verbesserungen

Docker Build Jobs für neue Apps hinzugefügt.

### Neue Workflows

```yaml
# .github/workflows/docker-presi.yml
# .github/workflows/docker-storage.yml
# .github/workflows/docker-food.yml
```

### Health Check Fixes

Mehrere Health-Check-Pfade korrigiert:

| Service          | Vorher        | Nachher   |
| ---------------- | ------------- | --------- |
| contacts-backend | `/api/health` | `/health` |
| mana-core-auth   | `/api/health` | `/health` |
| todo-backend     | `/api/health` | `/health` |
| calendar         | Port 3015     | Port 3016 |

---

## Infrastructure Cleanup

Hetzner Staging-Infrastruktur entfernt zugunsten von Mac Mini Production.

### Entfernte Dateien

```
scripts/hetzner/          # 15,581 Zeilen entfernt
docker-compose.staging.yml
scripts/staging-deploy.sh
```

### Begründung

- Mac Mini als einziger Produktionsserver
- Keine Staging-Umgebung mehr nötig
- Kosteneinsparung

---

## Zusammenfassung

| Bereich           | Commits | Highlights                   |
| ----------------- | ------- | ---------------------------- |
| **Food**          | 2       | Neue AI Nutrition App        |
| **Monitoring**    | 8       | Prometheus für alle Backends |
| **Grafana**       | 3       | Dashboards & Alerting        |
| **Watchtower**    | 6       | Auto-Deploy eingerichtet     |
| **Apps Restore**  | 4       | Presi & Storage reaktiviert  |
| **Health Checks** | 8       | Alle Apps mit /health        |
| **CI/CD**         | 5       | Docker Build Jobs            |
| **Fixes**         | 2       | Port & Path Korrekturen      |

---

## Nächste Schritte

1. **Matrix Infrastructure** für GDPR-konforme Bots
2. **Food Mobile** App fertigstellen
3. **Alerting** in Grafana aktivieren
4. **User Statistics** Dashboard erweitern
