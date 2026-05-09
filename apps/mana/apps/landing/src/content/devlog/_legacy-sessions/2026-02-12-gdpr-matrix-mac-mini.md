---
title: 'GDPR Self-Service, Matrix Mobile UX & Mac Mini Stability'
description: 'Neue GDPR Self-Service Endpoints für Nutzer-Daten, Matrix Web Mobile-Navigation mit FAB und Room Restoration, Mac Mini Stability-Improvements mit Health Checks und Container Recovery'
date: 2026-02-12
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'gdpr',
    'dsgvo',
    'matrix',
    'mobile',
    'mac-mini',
    'stability',
    'monitoring',
    'docker',
    'admin',
    'health-checks',
  ]
featured: true
commits: 22
readTime: 10
stats:
  filesChanged: 102
  linesAdded: 9395
  linesRemoved: 126
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 22
workingHours:
  start: '2026-02-12T11:00'
  end: '2026-02-13T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

**22 Commits** mit Fokus auf DSGVO-Compliance, Mobile UX und Server-Stabilität:

- **GDPR Self-Service** - Neue Endpoints für User Data Export
- **Matrix Mobile UX** - FAB für Sidebar, Room Restoration
- **Mac Mini Stability** - Health Checks, Container Recovery, LaunchD Fixes
- **Monitoring** - Alerting Stack mit Maintenance Scripts
- **Admin API Fixes** - Controller Route Prefix Korrekturen

---

## GDPR Self-Service Endpoints

Neue Self-Service Endpoints für Nutzer, um ihre Daten einzusehen und zu exportieren.

### Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    GDPR Data Aggregation                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                            │
│  │   User Request  │                                            │
│  │   /me/data      │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐     ┌─────────────────────────────────────┐│
│  │  mana-core-auth │────>│  Backend Services (parallel fetch)  ││
│  │                 │     │                                     ││
│  │  /me/data       │     │  Calendar │ Todo │ Contacts │ ...   ││
│  └─────────────────┘     └─────────────────────────────────────┘│
│                                   │                              │
│                                   ▼                              │
│                          ┌─────────────────┐                    │
│                          │  Aggregated     │                    │
│                          │  User Data      │                    │
│                          │  (JSON/ZIP)     │                    │
│                          └─────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Neue Endpoints

```typescript
// mana-core-auth: Self-Service Data
GET /me/data           // Aggregierte Daten aller Services
GET /me/data/export    // ZIP-Download für DSGVO-Auskunft
DELETE /me/data        // Account und alle Daten löschen (Art. 17)

// Backend Services: GDPR Endpoints
GET /admin/gdpr/users/:userId/data
DELETE /admin/gdpr/users/:userId/data
```

### Implementierung

```typescript
// auth: me.controller.ts
@Get('data')
@UseGuards(JwtAuthGuard)
async getUserData(@CurrentUser() user: CurrentUserData) {
  const services = ['calendar', 'todo', 'contacts', 'photos', 'clock', 'storage'];

  const dataPromises = services.map(async (service) => {
    const url = this.configService.get(`${service.toUpperCase()}_BACKEND_URL`);
    return this.fetchServiceData(url, user.userId);
  });

  const results = await Promise.allSettled(dataPromises);
  return this.aggregateResults(results, services);
}
```

### Backend Integration

Neue GDPR Endpoints zu Photos, Clock und Storage Backends hinzugefügt:

| Backend | Endpoint                     | Daten              |
| ------- | ---------------------------- | ------------------ |
| Photos  | `/admin/gdpr/users/:id/data` | Fotos, Alben, EXIF |
| Clock   | `/admin/gdpr/users/:id/data` | Timer, Sessions    |
| Storage | `/admin/gdpr/users/:id/data` | Dateien, Ordner    |

---

## Matrix Web Mobile UX

Verbesserte Mobile-Navigation für die Matrix PWA.

### FAB für Sidebar

```svelte
<!-- FloatingActionButton für Mobile Sidebar -->
<script lang="ts">
	let { onOpenSidebar } = $props();
</script>

<button class="fab fixed bottom-20 right-4 z-50 md:hidden" onclick={onOpenSidebar}>
	<MenuIcon />
</button>
```

### Room Restoration

Automatische Wiederherstellung des zuletzt ausgewählten Chats:

```typescript
// Beim App-Start: Letzten Room wiederherstellen
onMount(() => {
	const lastRoomId = localStorage.getItem('matrix:lastRoom');
	if (lastRoomId && rooms.find((r) => r.roomId === lastRoomId)) {
		selectRoom(lastRoomId);
	}
});

// Bei Room-Wechsel: Speichern
function selectRoom(roomId: string) {
	currentRoomId = roomId;
	localStorage.setItem('matrix:lastRoom', roomId);
}
```

### Message Interface Fix

Fehlende Props zur Message.svelte Interface hinzugefügt:

```typescript
interface MessageProps {
	message: MatrixMessage;
	isOwn: boolean;
	showAvatar: boolean;
	// Neu hinzugefügt:
	onReply?: (msg: MatrixMessage) => void;
	onReact?: (msg: MatrixMessage, emoji: string) => void;
}
```

---

## Mac Mini Stability Improvements

Umfangreiche Verbesserungen für die Server-Stabilität.

### Health Check Updates

```yaml
# docker-compose.macmini.yml
services:
  mana-core-auth:
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3001/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  quotes-backend:
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3007/health']
      # Korrigierter Pfad (vorher /api/health)
```

### Container Recovery Script

```bash
#!/bin/bash
# scripts/mac-mini/container-recovery.sh

UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}")

for container in $UNHEALTHY; do
  echo "Restarting unhealthy container: $container"
  docker restart "$container"

  # Warte auf Health Check
  sleep 30

  # Prüfe Status
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$container")
  if [ "$STATUS" != "healthy" ]; then
    echo "WARNING: $container still unhealthy after restart"
  fi
done
```

### LaunchD Plist Fix

```xml
<!-- com.mana.container-recovery.plist -->
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mana.container-recovery</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/till/projects/manacore-monorepo/scripts/mac-mini/container-recovery.sh</string>
  </array>
  <key>StartInterval</key>
  <integer>300</integer> <!-- Alle 5 Minuten -->
  <key>StandardOutPath</key>
  <string>/var/log/mana/container-recovery.log</string>
</dict>
</plist>
```

### Disabled Services

Temporär deaktivierte Services (fehlende Deployments):

```yaml
# Auskommentiert bis Deployment fertig
# inventory-backend:
# food-backend:
# wisekeep-backend:
```

---

## Monitoring: Alerting Stack

Neues Alerting-System mit Prometheus und Discord Notifications.

### Alert Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: service_alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: '{{ $labels.job }} is down'

      - alert: HighMemoryUsage
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Memory usage above 90%'

      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} < 0.1
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: 'Disk space below 10%'
```

### Maintenance Scripts

```bash
# scripts/mac-mini/maintenance.sh

# 1. Docker Cleanup
docker system prune -f --volumes

# 2. Log Rotation
find /var/log/mana -name "*.log" -mtime +7 -delete

# 3. Health Report
./scripts/mac-mini/health-report.sh | tee /var/log/mana/daily-health.log
```

---

## Admin API Fixes

Korrekturen für Controller Route Prefixes.

### Problem

Doppelte API-Prefixes führten zu 404-Fehlern:

```
GET /api/v1/api/v1/admin/users  → 404
```

### Lösung

```typescript
// VORHER (falsch)
@Controller('api/v1/admin') // + Global Prefix = /api/v1/api/v1/admin
export class AdminController {}

// NACHHER (korrekt)
@Controller('admin') // + Global Prefix = /api/v1/admin
export class AdminController {}
```

### Betroffene Controller

| Service | Controller      | Route      |
| ------- | --------------- | ---------- |
| Auth    | MeController    | `/me/*`    |
| Storage | AdminController | `/admin/*` |

---

## Docker Fixes

Mehrere Docker-Build Korrekturen.

### mana-search Symlink Fix

```dockerfile
# VORHER: Symlinks funktionieren nicht im Docker Context
COPY packages/shared-types ./packages/shared-types

# NACHHER: pnpm deploy für korrekte Dependencies
RUN pnpm --filter @mana-search/service deploy --prod ./deploy

FROM node:20-slim
COPY --from=build /app/deploy ./
```

### Local Builds auf Mac Mini

Weitere Services auf lokale Builds umgestellt:

```yaml
presi-backend:
  build:
    context: .
    dockerfile: apps/presi/apps/backend/Dockerfile
  # Statt: image: ghcr.io/till-js/presi-backend

skilltree-web:
  build:
    context: .
    dockerfile: apps/skilltree/apps/web/Dockerfile

mana-search:
  build:
    context: .
    dockerfile: services/mana-search/Dockerfile
```

### Shared Packages in ManaCore Web

```dockerfile
# Fehlende Packages hinzugefügt
COPY packages/shared-stores ./packages/shared-stores
COPY packages/shared-api-client ./packages/shared-api-client
COPY packages/shared-vite-config ./packages/shared-vite-config
```

---

## Calendar Database Fix

User ID Felder zu Text geändert:

```typescript
// VORHER (UUID)
userId: uuid('user_id').references(() => users.id);

// NACHHER (Text für externe Auth)
userId: text('user_id').notNull();
```

**Grund:** mana-core-auth verwendet String-basierte User IDs, nicht UUIDs.

---

## Zusammenfassung

| Bereich                | Commits | Highlights                  |
| ---------------------- | ------- | --------------------------- |
| **GDPR Self-Service**  | 4       | User Data Endpoints, Export |
| **Matrix Mobile**      | 4       | FAB, Room Restore, Props    |
| **Mac Mini Stability** | 5       | Health Checks, Recovery     |
| **Monitoring**         | 1       | Alerting Stack              |
| **Admin API**          | 3       | Route Prefix Fixes          |
| **Docker**             | 5       | Symlinks, Local Builds      |

---

## Nächste Schritte

1. **GDPR Export UI** - Download-Button im mana.how Dashboard
2. **Matrix E2EE** - Ende-zu-Ende Verschlüsselung aktivieren
3. **Alertmanager** - Discord Webhook Integration
4. **Service Deployments** - Inventory, Food, WiseKeep
