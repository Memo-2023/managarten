---
title: 'Photos App, STT/TTS API Keys & Admin Dashboard'
description: 'Neue Photos App mit mana-media EXIF-Integration, API Key Authentication für STT/TTS Services, Admin User Data Dashboard für Cross-Project Visualisierung, und vLLM Voxtral Integration'
date: 2026-02-11
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'photos',
    'mana-media',
    'exif',
    'stt',
    'tts',
    'api-keys',
    'admin',
    'dashboard',
    'vllm',
    'voxtral',
    'docker',
  ]
featured: true
commits: 28
readTime: 14
stats:
  filesChanged: 241
  linesAdded: 14772
  linesRemoved: 1668
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 28
workingHours:
  start: '2026-02-11T11:00'
  end: '2026-02-12T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Nach einer Woche Pause: **28 Commits** mit Fokus auf neue Apps und API-Infrastruktur:

- **Photos App** - Neue App mit mana-media EXIF-Integration
- **STT/TTS API Keys** - API Key Authentication mit Rate Limiting
- **Admin Dashboard** - Cross-Project User Data Visualisierung
- **vLLM Integration** - Voxtral Transcription für mana-stt
- **External APIs** - STT und TTS extern verfügbar

---

## Photos App

Neue ManaCore App für Foto-Management mit automatischer EXIF-Extraktion.

### Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                     Photos App Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐     ┌─────────────────┐     ┌────────────┐ │
│  │   Photos Web    │────>│  Photos Backend │────>│ mana-media │ │
│  │   (SvelteKit)   │     │    (NestJS)     │     │  (EXIF)    │ │
│  │   Port 5196     │     │   Port 3026     │     │            │ │
│  └─────────────────┘     └─────────────────┘     └────────────┘ │
│                                  │                      │        │
│                                  │                      │        │
│                                  ▼                      ▼        │
│                          ┌─────────────┐        ┌────────────┐  │
│                          │ PostgreSQL  │        │   MinIO    │  │
│                          │  (Metadata) │        │  (Files)   │  │
│                          └─────────────┘        └────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Features

| Feature               | Beschreibung                      |
| --------------------- | --------------------------------- |
| **EXIF Extraction**   | Kamera, Datum, GPS, Einstellungen |
| **Auto-Organization** | Sortierung nach Datum/Ort         |
| **Thumbnails**        | Automatische Generierung          |
| **Albums**            | Manuelle Organisation             |
| **Timeline View**     | Chronologische Ansicht            |

### mana-media Integration

```typescript
// EXIF-Daten werden automatisch extrahiert
interface PhotoMetadata {
	camera: string;
	lens: string;
	focalLength: string;
	aperture: string;
	shutterSpeed: string;
	iso: number;
	dateTaken: Date;
	gps?: {
		latitude: number;
		longitude: number;
	};
}
```

### Docker Deployment

```yaml
photos-backend:
  build:
    context: .
    dockerfile: apps/photos/apps/backend/Dockerfile
  ports:
    - '3026:3026'
  depends_on:
    - mana-media

photos-web:
  build:
    context: .
    dockerfile: apps/photos/apps/web/Dockerfile
  ports:
    - '5196:5196'
```

### Cloudflare Tunnel

Neue Routes für Photos App:

- `photos.mana.how` → Photos Web (5196)
- `photos-api.mana.how` → Photos Backend (3026)

---

## STT/TTS API Key Authentication

Neue API Key Authentifizierung für Speech Services.

### API Key Management

In mana-core-auth wurde ein API Key Management System hinzugefügt:

```typescript
// Auth API: API Key erstellen
POST /api/v1/api-keys
{
  "name": "My STT App",
  "services": ["stt", "tts"],
  "rateLimit": 100  // requests per minute
}

// Response
{
  "apiKey": "mana_sk_xxx...",
  "name": "My STT App",
  "services": ["stt", "tts"],
  "rateLimit": 100,
  "createdAt": "2026-02-11T14:00:00Z"
}
```

### Rate Limiting

```typescript
// Per-Key Rate Limiting
interface RateLimitConfig {
	windowMs: 60000; // 1 Minute
	max: number; // Aus API Key Config
}

// Redis-basiertes Tracking
const key = `rate:${apiKey}:${currentMinute}`;
await redis.incr(key);
await redis.expire(key, 60);
```

### Service Integration

```bash
# STT mit API Key
curl -X POST https://stt.mana.how/api/v1/transcribe \
  -H "Authorization: Bearer mana_sk_xxx" \
  -F "audio=@recording.mp3"

# TTS mit API Key
curl -X POST https://tts.mana.how/api/v1/synthesize \
  -H "Authorization: Bearer mana_sk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hallo Welt", "voice": "de-DE-FlorianNeural"}'
```

---

## Admin User Data Dashboard

Neues Admin Dashboard für Cross-Project User Data Visualisierung.

### Features

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin Dashboard - User Data                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User: till@mana.how                                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Calendar: 47 Events, 12 Calendars                           ││
│  │ Last activity: 2 hours ago                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Todo: 156 Tasks (23 completed today)                        ││
│  │ Active projects: 8                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Contacts: 234 Contacts, 15 Groups                           ││
│  │ Recent additions: 3 this week                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ... (weitere Apps)                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### API

```typescript
// GET /api/v1/admin/users/:userId/data
{
  "calendar": {
    "events": 47,
    "calendars": 12,
    "lastActivity": "2026-02-11T12:30:00Z"
  },
  "todo": {
    "tasks": 156,
    "completed": 89,
    "projects": 8
  },
  "contacts": {
    "total": 234,
    "groups": 15
  },
  // ...
}
```

### Database Fix

```typescript
// Vorher: NodePgDatabase
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Nachher: PostgresJsDatabase
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
```

---

## vLLM Integration für mana-stt

Integration von vLLM für Voxtral Transcription.

### Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    mana-stt Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                            │
│  │   Audio Input   │                                            │
│  │   (MP3/WAV)     │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐     ┌─────────────────┐                    │
│  │  Whisper Model  │────>│    vLLM         │                    │
│  │  (ASR)          │     │  (Voxtral)      │                    │
│  └─────────────────┘     └─────────────────┘                    │
│           │                       │                              │
│           │                       │ Post-Processing              │
│           │                       │ (Punctuation, Formatting)    │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Final Transcript                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### vLLM Configuration

```python
# CPU Mode Configuration
vllm_config = {
    "model": "mistralai/Voxtral-Mini-3B-2025",
    "dtype": "float32",  # CPU Mode
    "device": "cpu",
    "max_model_len": 4096,
}
```

### API

```bash
# Transcription mit Voxtral Post-Processing
curl -X POST https://stt.mana.how/api/v1/transcribe \
  -H "Authorization: Bearer $API_KEY" \
  -F "audio=@recording.mp3" \
  -F "enhance=true"  # Voxtral Enhancement aktivieren
```

---

## External STT/TTS APIs

Speech Services sind jetzt extern verfügbar.

### Cloudflare Tunnel Routes

| Service | URL          | Port |
| ------- | ------------ | ---- |
| STT API | stt.mana.how | 3020 |
| TTS API | tts.mana.how | 3022 |

### Port Fix

TTS API Port korrigiert:

```yaml
# Vorher
tts-api:
  ports:
    - "3020:3020"  # Falsch

# Nachher
tts-api:
  ports:
    - "3022:3022"  # Korrekt
```

### LaunchD Configuration

```bash
# STT/TTS Services laden .env automatisch
launchctl setenv STT_API_KEY $(cat /etc/mana/stt.env | grep API_KEY | cut -d= -f2)
```

---

## Docker Improvements

Zahlreiche Docker-Verbesserungen für alle Services.

### Backend Dockerfiles

`--ignore-scripts` zu allen Backend Dockerfiles hinzugefügt:

```dockerfile
# Verhindert postinstall-Fehler
RUN pnpm install --frozen-lockfile --ignore-scripts
```

### Shared Packages in Dockerfiles

Fehlende Shared Packages zu allen Dockerfiles hinzugefügt:

```dockerfile
# Vorher
COPY packages/shared-utils ./packages/shared-utils

# Nachher
COPY packages/shared-utils ./packages/shared-utils
COPY packages/shared-stores ./packages/shared-stores
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-vite-config ./packages/shared-vite-config
```

### Local Builds

Einige Services werden jetzt lokal auf dem Mac Mini gebaut statt GHCR Images:

```yaml
# Mac Mini: Local Build
mana-auth:
  build:
    context: .
    dockerfile: services/mana-core-auth/Dockerfile
```

---

## Bugfixes

| Fix                    | Beschreibung                            |
| ---------------------- | --------------------------------------- |
| **admin DB type**      | PostgresJsDatabase statt NodePgDatabase |
| **photos Svelte 5**    | Valide Event Syntax                     |
| **mana-media paths**   | Korrekter Pfad zu main.js               |
| **storage-web Docker** | Alle shared packages                    |
| **todo click targets** | Verbesserte Klickflächen                |
| **matrix type safety** | Strict null checks                      |
| **ARM64 CI**           | Deaktiviert für storage-backend         |

---

## Dokumentation

### mana-stt Architecture

Neue Dokumentation unter `services/mana-stt/ARCHITECTURE.md`:

- Whisper Model Details
- vLLM Integration
- API Endpoints
- Performance Benchmarks

---

## Zusammenfassung

| Bereich              | Commits | Highlights                    |
| -------------------- | ------- | ----------------------------- |
| **Photos App**       | 8       | EXIF, Docker, Cloudflare      |
| **STT/TTS API Keys** | 3       | Rate Limiting, Auth           |
| **Admin Dashboard**  | 2       | Cross-Project Data            |
| **vLLM Integration** | 2       | Voxtral, CPU Mode             |
| **External APIs**    | 2       | STT/TTS Tunnel                |
| **Docker Fixes**     | 8       | Shared Packages, Local Builds |
| **Bugfixes**         | 3       | Types, Paths, UI              |

---

## Nächste Schritte

1. **Photos App** Production Deployment
2. **Admin Dashboard** erweitern (GDPR Export)
3. **vLLM GPU Mode** aktivieren
4. **API Key Dashboard** in mana.how
