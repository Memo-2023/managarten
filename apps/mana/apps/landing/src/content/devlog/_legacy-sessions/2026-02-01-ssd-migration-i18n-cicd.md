---
title: 'SSD Migration, i18n für Auth Pages & Matrix Bots CI/CD'
description: 'PostgreSQL und MinIO auf SSD migriert, mehrsprachige Auth-Pages für alle Apps, automatisierte CI/CD Pipeline für 19 Matrix Bots, und erweiterte Grafana Dashboards'
date: 2026-02-01
author: 'Till Schneider'
category: 'infrastructure'
tags:
  [
    'ssd',
    'migration',
    'i18n',
    'ci-cd',
    'github-actions',
    'matrix-bots',
    'grafana',
    'monitoring',
    'oidc',
    'production',
  ]
featured: false
commits: 42
readTime: 14
stats:
  filesChanged: 289
  linesAdded: 14561
  linesRemoved: 3780
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 42
workingHours:
  start: '2026-02-01T11:00'
  end: '2026-02-02T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).


Produktiver Tag mit **42 Commits** und Fokus auf Infrastructure und Production Readiness:

- **SSD Migration** - PostgreSQL und MinIO auf externe SSD verschoben
- **i18n für Auth** - Alle Auth-Pages mehrsprachig (DE/EN)
- **Matrix Bots CI/CD** - Automatisierte GHCR Deployment Pipeline
- **Grafana Dashboards** - Master Overview mit Key Metrics
- **OIDC Production** - mana-core-auth vollständig produktionsreif
- **node-exporter** - Host System Metrics für Monitoring

---

## SSD Migration

Migration der Datenbanken auf externe SSD für bessere Performance.

### Migrierte Services

| Service | Vorher | Nachher |
| ------- | ------ | ------- |
| PostgreSQL | Docker Volume | `/Volumes/ManaData/postgres` |
| MinIO | Docker Volume | `/Volumes/ManaData/minio` |

### Docker Compose Änderungen

```yaml
services:
  manacore-postgres:
    volumes:
      - /Volumes/ManaData/postgres:/var/lib/postgresql/data

  manacore-minio:
    volumes:
      - /Volumes/ManaData/minio:/data
```

### Vorteile

| Aspekt | HDD (intern) | SSD (extern) |
| ------ | ------------ | ------------ |
| **Read Speed** | ~100 MB/s | ~500 MB/s |
| **Write Speed** | ~100 MB/s | ~450 MB/s |
| **IOPS** | ~100 | ~10.000 |
| **Latency** | ~10ms | ~0.1ms |

### Dokumentation

Neue SSD-Dokumentation unter `docs/MAC_MINI_SSD.md`:

- Mount-Konfiguration
- Backup-Strategie
- Performance-Benchmarks

---

## i18n für Auth Pages

Alle Authentifizierungs-Seiten sind jetzt mehrsprachig.

### Unterstützte Sprachen

| Sprache | Code | Status |
| ------- | ---- | ------ |
| Deutsch | `de` | Vollständig |
| English | `en` | Vollständig |

### Betroffene Apps

- Calendar Web
- Chat Web
- Clock Web
- Contacts Web
- Food Web
- Picture Web
- Planta Web
- Questions Web
- SkillTree Web
- Todo Web
- Quotes Web

### Implementierung

```typescript
// Locale Detection
const locale = navigator.language.startsWith('de') ? 'de' : 'en';

// i18n Store
export const t = derived(locale, ($locale) => {
  return (key: string) => translations[$locale][key] || key;
});
```

### Neue Auth Pages

Fehlende Auth-Pages für Quotes und Planta hinzugefügt:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/verify-email`

---

## Matrix Bots CI/CD

Automatisierte Build und Deployment Pipeline für alle Matrix Bots.

### GitHub Actions Workflow

```yaml
# .github/workflows/matrix-bots.yml
name: Matrix Bots CI/CD

on:
  push:
    paths:
      - 'services/matrix-*-bot/**'

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        bot:
          - matrix-mana-bot
          - matrix-todo-bot
          - matrix-calendar-bot
          # ... alle 19 Bots
    steps:
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/manacore/${{ matrix.bot }}:latest
```

### Betroffene Bots

| Bot | GHCR Image |
| --- | ---------- |
| matrix-mana-bot | `ghcr.io/manacore/matrix-mana-bot` |
| matrix-todo-bot | `ghcr.io/manacore/matrix-todo-bot` |
| matrix-calendar-bot | `ghcr.io/manacore/matrix-calendar-bot` |
| ... | ... (19 total) |

### ARM64 Workaround

QEMU-Emulation für ARM64 deaktiviert aufgrund von CI-Fehlern:

```yaml
platforms: linux/amd64  # ARM64 temporär deaktiviert
```

---

## Grafana Dashboards

Erweiterte Monitoring Dashboards.

### Master Overview

Neues Home Dashboard mit Key Metrics:

| Panel | Metrik |
| ----- | ------ |
| **Total Requests** | Summe aller HTTP Requests |
| **Requests/sec** | Aktuelle Request-Rate |
| **Error Rate** | HTTP 5xx Errors |
| **Response Time** | P95 Latency |

### System Overview

Neugeschrieben mit verfügbaren Metriken:

- CPU Usage (per Container)
- Memory Usage (per Container)
- Network I/O
- Disk Usage

### Infinity Datasource

Plugin für Business Metrics installiert:

```bash
grafana-cli plugins install yesoreyeram-infinity-datasource
```

---

## node-exporter

Host System Metrics für macOS Docker.

### Metriken

| Metrik | Beschreibung |
| ------ | ------------ |
| `node_cpu_seconds_total` | CPU-Nutzung |
| `node_memory_MemTotal_bytes` | Gesamter RAM |
| `node_filesystem_size_bytes` | Disk-Größe |
| `node_network_receive_bytes_total` | Netzwerk RX |

### macOS-spezifische Konfiguration

```yaml
node-exporter:
  image: prom/node-exporter:latest
  volumes:
    - /proc:/host/proc:ro
    - /sys:/host/sys:ro
  command:
    - '--path.procfs=/host/proc'
    - '--path.sysfs=/host/sys'
    - '--collector.filesystem.ignored-mount-points=^/(sys|proc|dev)($|/)'
```

---

## OIDC Production Readiness

mana-core-auth ist jetzt vollständig produktionsreif.

### Fixes

| Fix | Beschreibung |
| --- | ------------ |
| **EdDSA Signing** | OIDC id_token mit EdDSA statt RS256 |
| **JWT Issuer** | BASE_URL als Issuer |
| **Token Exchange** | body-parser für form-urlencoded |
| **Test Fixes** | Alle Tests grün |

### OIDC Token Exchange

```typescript
// Vorher: JSON only
app.use(express.json());

// Nachher: JSON + form-urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

### Token Endpoint

```bash
# OAuth2 Token Request (form-urlencoded)
curl -X POST https://auth.mana.how/oidc/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=xxx&client_id=synapse"
```

---

## Resend Verification Email

Neues Feature auf der Registrierungsseite.

### UI

```svelte
{#if registrationSuccess && !verified}
  <div class="alert">
    <p>Bitte bestätige deine Email-Adresse.</p>
    <button onclick={resendVerification}>
      Bestätigungsmail erneut senden
    </button>
  </div>
{/if}
```

### API

```typescript
// POST /api/v1/auth/resend-verification
await authService.resendVerificationEmail(email);
```

---

## Cloudflared Port Updates

Alle Service-Ports in Cloudflared aktualisiert.

### Geänderte Ports

| Service | Alt | Neu |
| ------- | --- | --- |
| matrix.mana.how | 8008 | 4000 |
| matrix-web | 5178 | 5180 |
| element.mana.how | 80 | 8088 |

---

## Bugfixes

| Fix | Beschreibung |
| --- | ------------ |
| **Matrix SSO** | loginToken Callback Handler |
| **Bot Health Checks** | wget installiert in Docker |
| **Crypto Module** | E2EE via pnpm override deaktiviert |
| **Native Modules** | node:20-slim für Bot Images |
| **CORS Origins** | Alle Apps hinzugefügt |
| **Questions Locale** | 'de' als Fallback |

---

## Test User Seeding

Neuer Test-User für Development.

```typescript
// scripts/seed-dev.ts
await db.insert(users).values({
  email: 't@t.de',
  password: await hash('test1234'),
  verified: true,
});
```

---

## Zusammenfassung

| Bereich | Commits | Highlights |
| ------- | ------- | ---------- |
| **SSD Migration** | 4 | PostgreSQL + MinIO |
| **i18n** | 3 | Alle Auth Pages DE/EN |
| **Matrix Bots CI/CD** | 2 | 19 Bots automatisiert |
| **Grafana** | 6 | Master Overview, Infinity |
| **node-exporter** | 3 | Host Metrics |
| **OIDC** | 8 | Production Ready |
| **Cloudflared** | 4 | Port Updates |
| **Bugfixes** | 12 | Docker, Matrix, Auth |

---

## Nächste Schritte

1. **Cross-Domain SSO** für alle Web Apps
2. **Matrix Bots** auf Mac Mini deployen
3. **Grafana Alerts** konfigurieren
4. **Backup Workflow** mit n8n
