---
title: 'Matrix Bot Konsolidierung, Voice Support & Manalink PWA'
description: 'Massive Konsolidierung aller 19 Matrix Bots mit @manacore/matrix-bot-common, Voice Input/Output für mana-mana-bot, Manalink PWA Rebrand, und Telegram-zu-Matrix Migration'
date: 2026-01-31
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'matrix-bots',
    'voice',
    'pwa',
    'manalink',
    'consolidation',
    'shared-packages',
    'mana-media',
    'telegram',
    'refactoring',
    'docker',
  ]
featured: true
commits: 52
readTime: 18
stats:
  filesChanged: 570
  linesAdded: 24147
  linesRemoved: 19564
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 52
workingHours:
  start: '2026-01-31T11:00'
  end: '2026-02-01T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Intensiver Tag (und Nacht!) mit **52 Commits** - der Fokus lag auf der Konsolidierung der Matrix Bot Infrastruktur:

- **@manacore/matrix-bot-common** - Neues Shared Package für alle 19 Matrix Bots
- **Voice Support** - 4-Phasen-Implementierung für Voice Input/Output im mana-mana-bot
- **Manalink PWA** - Rebrand des Matrix Web Clients mit PWA-Support
- **Telegram Removal** - Migration zu Matrix-only Strategie
- **mana-media MVP** - Unified Media Processing Platform
- **Docker Restructure** - Neues Port-Schema und Naming Convention

---

## @manacore/matrix-bot-common

Neues Shared Package, das gemeinsame Funktionalität für alle Matrix Bots bereitstellt.

### Komponenten

```
packages/matrix-bot-common/
├── src/
│   ├── base/
│   │   └── BaseMatrixService.ts      # Abstrakte Basisklasse
│   ├── health/
│   │   └── HealthController.ts       # Shared Health Endpoint
│   ├── utils/
│   │   ├── KeywordCommandDetector.ts # Command Detection ohne !
│   │   └── UserListMapper.ts         # User-Formatierung
│   └── index.ts
└── package.json
```

### BaseMatrixService

Abstrakte Basisklasse mit Matrix-Verbindungslogik:

```typescript
export abstract class BaseMatrixService implements OnModuleInit {
	protected client: MatrixClient;

	async onModuleInit() {
		this.client = new MatrixClient(this.config.homeserverUrl, this.config.accessToken);
		await this.client.start();
		this.client.on('room.message', this.handleMessage.bind(this));
	}

	protected abstract handleMessage(roomId: string, event: any): Promise<void>;
}
```

### KeywordCommandDetector

Erkennt natürlichsprachliche Befehle ohne `!`-Prefix:

```typescript
const detector = new KeywordCommandDetector({
	keywords: ['todo', 'aufgabe', 'task'],
	patterns: [/(?:erinnere mich|remind me)/i],
});

// "Füge Einkaufen zur Todo-Liste" → detected
// "Was steht auf meiner Aufgabenliste?" → detected
```

### Migration

Alle 19 Matrix Bots wurden migriert:

| Phase | Bots | Änderungen             |
| ----- | ---- | ---------------------- |
| 1     | 5    | HealthController       |
| 2     | 5    | BaseMatrixService      |
| 3     | 4    | UserListMapper         |
| 4     | 5    | KeywordCommandDetector |

---

## Voice Support für matrix-mana-bot

4-Phasen-Implementierung von Voice Input/Output.

### Phase 1: Voice Input

```typescript
// Sprachnachrichten via mana-stt transkribieren
async handleVoiceMessage(event: MatrixEvent): Promise<string> {
  const audioUrl = event.content.url;
  const audioBuffer = await this.downloadMedia(audioUrl);
  const transcription = await this.sttClient.transcribe(audioBuffer);
  return transcription.text;
}
```

### Phase 2: Voice Output (TTS)

```typescript
// Text-zu-Sprache für Antworten
async sendVoiceReply(roomId: string, text: string): Promise<void> {
  const audioBuffer = await this.ttsClient.synthesize(text, {
    voice: 'de-DE-FlorianNeural',
    speed: 1.0,
  });
  await this.client.sendAudio(roomId, audioBuffer, 'response.mp3');
}
```

### Phase 3: Smart Voice Formatting

Intelligente Aufbereitung von Text für Sprachausgabe:

| Input    | Voice Output                |
| -------- | --------------------------- |
| `15:30`  | "fünfzehn Uhr dreißig"      |
| `3.5kg`  | "drei Komma fünf Kilogramm" |
| URLs     | Werden übersprungen         |
| Markdown | Wird entfernt               |

### Phase 4: Persistent Voice Preferences

```typescript
// User-Präferenzen in Redis speichern
interface VoicePreferences {
	enabled: boolean;
	voice: string;
	speed: number;
	autoTranscribe: boolean;
}

await this.redis.hset(`voice:${userId}`, preferences);
```

---

## Manalink PWA

Rebrand des Matrix Web Clients zu "Manalink" mit PWA-Support.

### PWA-Features

| Feature                | Beschreibung           |
| ---------------------- | ---------------------- |
| **Installierbar**      | Add to Home Screen     |
| **Offline**            | Service Worker Caching |
| **Push Notifications** | Web Push API           |
| **App-Icon**           | Custom Manalink Icon   |

### Manifest

```json
{
	"name": "Manalink",
	"short_name": "Manalink",
	"description": "ManaCore Matrix Client",
	"start_url": "/",
	"display": "standalone",
	"theme_color": "#6366f1",
	"background_color": "#0f172a"
}
```

### UX-Änderungen

- SSO als primärer Login (manueller Login versteckt)
- Vereinfachte Login-Seite
- Dark Mode als Default

---

## Telegram Removal

Strategische Entscheidung: Fokus auf Matrix als einzige Chat-Plattform.

### Entfernte Services

```
services/
├── telegram-ollama-bot/        # ENTFERNT
├── telegram-project-doc-bot/   # ENTFERNT
├── telegram-food-bot/      # ENTFERNT
├── telegram-todo-bot/          # ENTFERNT
└── telegram-quotes-bot/        # ENTFERNT
```

### Begründung

| Aspekt           | Telegram  | Matrix   |
| ---------------- | --------- | -------- |
| **Self-Hosted**  | Nein      | Ja       |
| **E2EE**         | Optional  | Standard |
| **Bot Platform** | Limitiert | Flexibel |
| **Integration**  | Extern    | Native   |

---

## mana-media MVP

Unified Media Processing Platform für alle ManaCore Apps.

### Features

```
services/mana-media/
├── src/
│   ├── processing/
│   │   ├── image.service.ts     # Resize, Crop, Format
│   │   ├── video.service.ts     # Transcode, Thumbnail
│   │   └── audio.service.ts     # Convert, Normalize
│   ├── storage/
│   │   └── s3.service.ts        # MinIO/S3 Storage
│   └── metadata/
│       └── exif.service.ts      # EXIF Extraction
└── Dockerfile
```

### API Endpoints

| Endpoint              | Beschreibung           |
| --------------------- | ---------------------- |
| `POST /process/image` | Bildverarbeitung       |
| `POST /process/video` | Videokonvertierung     |
| `GET /metadata/:id`   | EXIF/Metadaten abrufen |

---

## Docker Restructure

Neue Port-Schema und Naming Convention für alle Services.

### Port Ranges

| Range     | Typ                               |
| --------- | --------------------------------- |
| 3001-3099 | Core Services (Auth, Search, LLM) |
| 3100-3199 | App Backends                      |
| 3300-3399 | Matrix Bots                       |
| 5100-5199 | Web Apps                          |
| 8000-8099 | Infrastructure                    |

### Naming Convention

```yaml
# Vorher
container_name: chat-backend
container_name: todo-backend

# Nachher
container_name: mana-chat-backend
container_name: mana-todo-backend
```

---

## Bot Services Consolidation

Konsolidierung von SessionService und TranscriptionService.

### @manacore/bot-services Updates

```typescript
// Vorher: In jedem Bot
class SessionService {
	private sessions = new Map();
}

// Nachher: Shared Package
import { SessionService } from '@manacore/bot-services';
```

### Shared Services

| Service                | Funktion                 |
| ---------------------- | ------------------------ |
| `SessionService`       | User Sessions über Redis |
| `TranscriptionService` | STT via mana-stt         |
| `CreditService`        | Credit-Verbrauch tracken |

---

## Model Comparison Feature

Neues Feature im LLM Playground für Modellvergleiche.

### UI

```typescript
// Gleichzeitig mehrere Modelle abfragen
const models = ['gemma3:4b', 'llama3.2:3b', 'mistral:7b'];
const responses = await Promise.all(models.map((model) => llmClient.chat(model, prompt)));
```

### Metriken

| Metrik         | Beschreibung         |
| -------------- | -------------------- |
| **Latency**    | Time to first token  |
| **Throughput** | Tokens per second    |
| **Quality**    | Subjektive Bewertung |

---

## Grafana & Prometheus Fixes

Zahlreiche Fixes für das Monitoring-System.

### Fixes

| Fix                  | Beschreibung                |
| -------------------- | --------------------------- |
| VictoriaMetrics Port | 8428 → 9090                 |
| Backend Ports        | Korrekte Scrape Targets     |
| Missing Services     | Neu hinzugefügt             |
| Home Dashboard       | Master Overview als Default |

---

## Bugfixes

| Fix                   | Beschreibung                     |
| --------------------- | -------------------------------- |
| matrix-bot-common ESM | Explicit Imports für Node.js v25 |
| bot-services Build    | Compile Step hinzugefügt         |
| Type Errors           | Web Apps, mana-media, calendar   |
| tsconfig Issues       | Alle NestJS Backends             |
| matrix-mana-bot DI    | Service Modules als Global       |

---

## Zusammenfassung

| Bereich                | Commits | Highlights             |
| ---------------------- | ------- | ---------------------- |
| **matrix-bot-common**  | 8       | Neues Shared Package   |
| **Bot Migration**      | 12      | 19 Bots konsolidiert   |
| **Voice Support**      | 4       | 4 Phasen implementiert |
| **Manalink PWA**       | 2       | Rebrand + PWA          |
| **Telegram Removal**   | 1       | Matrix-only Strategie  |
| **mana-media**         | 2       | MVP implementiert      |
| **Docker Restructure** | 1       | Neues Port-Schema      |
| **Grafana/Prometheus** | 8       | Monitoring Fixes       |
| **Bugfixes**           | 14      | Build, Types, ESM      |

---

## Nächste Schritte

1. **Matrix E2EE** aktivieren
2. **Voice Preferences UI** im Manalink Client
3. **mana-media** mit Food integrieren
4. **Matrix Bots CI/CD** Pipeline
