---
title: 'Microservices, Matrix Phase 3 & Massive Konsolidierung'
description: '3 neue Microservices (mana-llm, mana-crawler, mana-notify), Matrix Web Client Phase 3 mit VoIP/Video, Screen Sharing, @Mentions und Emoji Reactions, plus umfassende Codebase-Konsolidierung mit 8 neuen Shared Packages'
date: 2026-01-29
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'mana-llm',
    'mana-crawler',
    'mana-notify',
    'matrix',
    'voip',
    'video-calls',
    'screen-sharing',
    'consolidation',
    'shared-packages',
    'refactoring',
    'nestjs',
    'sveltekit',
    'python',
    'fastapi',
  ]
featured: true
commits: 55
readTime: 25
stats:
  filesChanged: 1082
  linesAdded: 51520
  linesRemoved: 12296
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 55
workingHours:
  start: '2026-01-29T11:00'
  end: '2026-01-30T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Außergewöhnlich produktiver Tag mit **55 Commits** - aufgeteilt in drei große Bereiche:

- **3 neue Microservices** - mana-llm (LLM Abstraction), mana-crawler (Web Crawler), mana-notify (Notifications)
- **Matrix Web Client Phase 3** - VoIP/Video Calls, Screen Sharing, @Mentions, Emoji Reactions, Search
- **Massive Konsolidierung** - 8 neue Shared Packages, ~2.500 LOC Code-Deduplizierung

---

## Neue Microservices

### mana-llm: Central LLM Abstraction Service

Neuer Python/FastAPI Service als zentraler Gateway für alle LLM-Anfragen im Monorepo.

#### Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Consumer Apps                                 │
│  matrix-ollama-bot │ telegram-ollama-bot │ chat-backend │ etc.     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP/SSE
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     mana-llm (Port 3025)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Router    │  │   Cache     │  │   Metrics   │                 │
│  │ (Provider)  │  │  (Redis)    │  │ (Prometheus)│                 │
│  └──────┬──────┘  └─────────────┘  └─────────────┘                 │
│         │                                                           │
│  ┌──────┴──────────────────────────────────────────┐               │
│  │              Provider Adapters                   │               │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │               │
│  │  │  Ollama  │  │ OpenAI   │  │  OpenRouter  │  │               │
│  │  │  Adapter │  │ Adapter  │  │   Adapter    │  │               │
│  │  └──────────┘  └──────────┘  └──────────────┘  │               │
│  └─────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

#### Features

| Feature                   | Beschreibung                                              |
| ------------------------- | --------------------------------------------------------- |
| **OpenAI-compatible API** | `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`    |
| **Provider Routing**      | `ollama/gemma3:4b`, `openrouter/llama-3.1-8b`, `groq/...` |
| **Streaming (SSE)**       | Server-Sent Events für Token-Streaming                    |
| **Vision Support**        | Multimodal mit Base64-Bildern                             |
| **Redis Cache**           | Optional für häufige Anfragen                             |
| **Prometheus Metrics**    | `/metrics` Endpoint                                       |

#### Provider Routing

```bash
# Ollama (Standard wenn kein Prefix)
curl -X POST http://localhost:3025/v1/chat/completions \
  -d '{"model": "ollama/gemma3:4b", "messages": [...]}'

# OpenRouter
curl -X POST http://localhost:3025/v1/chat/completions \
  -d '{"model": "openrouter/meta-llama/llama-3.1-8b-instruct", ...}'

# Groq
curl -X POST http://localhost:3025/v1/chat/completions \
  -d '{"model": "groq/llama-3.1-8b-instant", ...}'
```

#### Projekt-Struktur

```
services/mana-llm/
├── src/
│   ├── main.py                 # FastAPI Entry Point
│   ├── config.py               # Pydantic Settings
│   ├── providers/
│   │   ├── base.py             # Abstract Provider
│   │   ├── ollama.py           # Ollama Provider
│   │   ├── openai_compat.py    # OpenAI-compatible Provider
│   │   └── router.py           # Provider Routing
│   ├── models/
│   │   ├── requests.py         # Request Models
│   │   └── responses.py        # Response Models
│   ├── streaming/
│   │   └── sse.py              # SSE Response Handler
│   └── utils/
│       ├── cache.py            # Redis Caching
│       └── metrics.py          # Prometheus Metrics
├── tests/
│   ├── test_api.py
│   ├── test_providers.py
│   └── test_streaming.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── pyproject.toml
```

---

### mana-crawler: Web Crawler Service

NestJS-basierter Web Crawler für systematisches Crawling und Content-Extraktion.

#### Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│              mana-crawler (Port 3023)                                │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Crawl API   │  │ Queue       │  │ Parser      │                  │
│  │ Controller  │──│ Service     │──│ Service     │                  │
│  └─────────────┘  │ (BullMQ)    │  │ (Cheerio)   │                  │
│                   └─────────────┘  └─────────────┘                  │
│                         │                │                          │
│                   ┌─────┴────────────────┴─────┐                    │
│                   │     Storage Service         │                    │
│                   │  (PostgreSQL + Redis)       │                    │
│                   └─────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

#### API Endpoints

| Endpoint                           | Beschreibung            |
| ---------------------------------- | ----------------------- |
| `POST /api/v1/crawl`               | Neuen Crawl-Job starten |
| `GET /api/v1/crawl/:jobId`         | Job-Status abrufen      |
| `GET /api/v1/crawl/:jobId/results` | Ergebnisse (paginiert)  |
| `DELETE /api/v1/crawl/:jobId`      | Job abbrechen           |
| `POST /api/v1/crawl/:jobId/pause`  | Job pausieren           |
| `POST /api/v1/crawl/:jobId/resume` | Job fortsetzen          |

#### Features

| Feature              | Beschreibung                                |
| -------------------- | ------------------------------------------- |
| **Queue-basiert**    | BullMQ mit Redis für Job-Processing         |
| **Robots.txt**       | Automatische Compliance (konfigurierbar)    |
| **Rate Limiting**    | Per-Domain Rate Limiting (default: 2 req/s) |
| **Custom Selectors** | CSS-Selektoren für Content-Extraktion       |
| **Markdown Output**  | Automatische HTML→Markdown Konvertierung    |
| **Bull Board**       | Dashboard unter `/queue/dashboard`          |

#### Beispiel-Request

```bash
curl -X POST http://localhost:3023/api/v1/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://docs.example.com",
    "config": {
      "maxDepth": 3,
      "maxPages": 500,
      "respectRobots": true,
      "rateLimit": 2,
      "includePatterns": ["/docs/*"],
      "excludePatterns": ["/api/*", "*.pdf"],
      "selectors": {
        "content": "article.main-content",
        "title": "h1.page-title"
      },
      "output": {
        "format": "markdown"
      }
    }
  }'
```

---

### mana-notify: Central Notification Service

Zentraler Notification-Service für Email, Push, Matrix und Webhooks.

#### Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                 Consumer Apps                                        │
│   Auth │ Calendar │ Chat │ Picture │ Quotes │ ...                   │
└─────────────────────────┬───────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│              mana-notify (Port 3040)                                 │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Notification│  │ Template    │  │ Preferences │                  │
│  │ API         │  │ Engine      │  │ Manager     │                  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘                  │
│         │                │                                           │
│         ▼                ▼                                           │
│  ┌──────────────────────────────────────────────┐                   │
│  │           BullMQ Job Queues                   │                   │
│  │  Email │ Push │ Matrix │ Webhook              │                   │
│  └──────────────────────────────────────────────┘                   │
│         │         │         │         │                             │
│         ▼         ▼         ▼         ▼                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │ Brevo   │ │ Expo    │ │ Matrix  │ │ HTTP    │                   │
│  │ SMTP    │ │ Push    │ │ API     │ │ Client  │                   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Notification Channels

| Channel     | Provider   | Features                   |
| ----------- | ---------- | -------------------------- |
| **Email**   | Brevo SMTP | Templates, HTML/Plain Text |
| **Push**    | Expo       | iOS, Android, Web          |
| **Matrix**  | Matrix API | Formatted Messages         |
| **Webhook** | HTTP       | POST/PUT, Retry            |

#### API Endpoints

| Endpoint                              | Auth        | Beschreibung             |
| ------------------------------------- | ----------- | ------------------------ |
| `POST /api/v1/notifications/send`     | Service-Key | Sofort senden            |
| `POST /api/v1/notifications/schedule` | Service-Key | Zeitgesteuert            |
| `POST /api/v1/notifications/batch`    | Service-Key | Mehrere senden           |
| `POST /api/v1/devices/register`       | JWT         | Push-Device registrieren |
| `GET /api/v1/preferences`             | JWT         | User-Präferenzen         |
| `GET /api/v1/templates`               | Service-Key | Templates verwalten      |

#### Client SDK

```typescript
import { NotifyClient } from '@manacore/notify-client';

const notify = new NotifyClient({
	serviceUrl: 'http://localhost:3040',
	serviceKey: process.env.MANA_NOTIFY_SERVICE_KEY,
	appId: 'calendar',
});

// Email senden
await notify.sendEmail({
	to: 'user@example.com',
	template: 'calendar-reminder',
	data: { eventTitle: 'Meeting', eventTime: '14:00' },
});

// Push an User
await notify.sendPush({
	userId: 'user-uuid',
	title: 'Erinnerung',
	body: 'Meeting in 15 Minuten',
	data: { eventId: 'xxx' },
});
```

#### Default Templates

| Template              | Channel | Verwendung         |
| --------------------- | ------- | ------------------ |
| `auth-password-reset` | Email   | Password Reset     |
| `auth-verification`   | Email   | Email Verification |
| `auth-welcome`        | Email   | Willkommens-Email  |
| `calendar-reminder`   | Email   | Event-Erinnerung   |

---

## Matrix Web Client Phase 3

Massive Feature-Erweiterung des SvelteKit Matrix Clients mit **25 Commits**.

### VoIP & Video Calls

Vollständige WebRTC-Integration für Audio/Video-Anrufe.

```
apps/matrix/apps/web/src/lib/components/call/
├── CallView.svelte           # 224 LOC - Anruf-UI mit Steuerung
├── IncomingCallDialog.svelte # 123 LOC - Eingehender Anruf Dialog
└── index.ts
```

**Features:**

| Feature                 | Beschreibung          |
| ----------------------- | --------------------- |
| **Audio/Video Calls**   | 1:1 WebRTC Anrufe     |
| **Screen Sharing**      | Bildschirm teilen     |
| **Mute/Unmute**         | Audio/Video Steuerung |
| **Call Accept/Decline** | Incoming Call Dialog  |
| **Camera Switch**       | Kamera wechseln       |

### @Mention Autocomplete

Intelligente User-Erwähnung mit Autocomplete:

```svelte
<!-- MessageInput.svelte -->
<script lang="ts">
	let showMentionPopup = $state(false);
	let mentionSearch = $state('');
	let mentionCandidates = $state<MatrixUser[]>([]);

	function handleInput() {
		const text = inputElement?.textContent || '';
		const mentionMatch = text.match(/@(\w*)$/);
		if (mentionMatch) {
			showMentionPopup = true;
			mentionSearch = mentionMatch[1];
			mentionCandidates = filterMembers(mentionSearch);
		}
	}
</script>

{#if showMentionPopup}
	<div class="mention-popup">
		{#each mentionCandidates as user}
			<button onclick={() => insertMention(user)}>
				<Avatar src={user.avatarUrl} />
				<span>{user.displayName}</span>
			</button>
		{/each}
	</div>
{/if}
```

### Message Forwarding

Nachrichten an andere Räume weiterleiten:

```
apps/matrix/apps/web/src/lib/components/chat/
├── ForwardMessageDialog.svelte  # 173 LOC - Room-Auswahl Dialog
└── Message.svelte               # Forward-Button hinzugefügt
```

### Emoji Reactions

Reaktionen auf Nachrichten:

| Feature             | Beschreibung                      |
| ------------------- | --------------------------------- |
| **Quick Reactions** | Schnellauswahl (Thumbs-up etc.)   |
| **Emoji Picker**    | Erweiterter Picker mit Kategorien |
| **Reaction Count**  | Aggregierte Reaktionen anzeigen   |
| **Own Reaction**    | Eigene Reaktion highlighten       |

### Extended Emoji Picker

Vollständiger Emoji-Picker mit Kategorien und Skin-Tone Support.

### Message Search

Nachrichten im aktuellen Raum durchsuchen:

```
apps/matrix/apps/web/src/lib/components/chat/
└── SearchDialog.svelte  # 185 LOC
```

**Features:**

- Volltextsuche in Nachrichten
- Ergebnisse mit Kontext
- Keyboard Shortcut: `Cmd+F` / `Ctrl+F`
- Jump to Message

### Browser Notifications

```typescript
// apps/matrix/apps/web/src/lib/notifications/index.ts (171 LOC)

export class NotificationService {
	async requestPermission(): Promise<boolean>;
	async showNotification(room: Room, event: MatrixEvent): Promise<void>;
	private shouldShowNotification(event: MatrixEvent): boolean;
}
```

**Features:**

- Permission Request bei erstem Nachrichtenempfang
- Click-to-Focus auf Nachricht
- Unread Badge Update
- Tab-Focus Detection (keine Notifikation wenn aktiv)

### Keyboard Shortcuts

| Shortcut           | Aktion            |
| ------------------ | ----------------- |
| `Cmd+F` / `Ctrl+F` | Suche öffnen      |
| `Cmd+K` / `Ctrl+K` | Quick Room Switch |
| `Cmd+N` / `Ctrl+N` | Neuer Raum        |
| `Esc`              | Dialog schließen  |
| `Enter`            | Nachricht senden  |
| `Shift+Enter`      | Neue Zeile        |

### Online Status & Presence

- Online/Offline/Busy Indikatoren
- Letzte Aktivität
- Typing Indicator (verbessert)

### Read Receipts

- Gelesen-Markierung pro Nachricht
- Aggregierte Receipts (Avatar-Stack)
- Eigene Nachricht: "Gelesen von X"

### UI/UX Verbesserungen

| Verbesserung          | Beschreibung                        |
| --------------------- | ----------------------------------- |
| **Mobile Responsive** | Besseres Layout auf kleinen Screens |
| **Login Redesign**    | Angepasst an Central Auth UI        |
| **Settings Access**   | Direkter Zugang aus Sidebar         |
| **Theme Selector**    | Light/Dark/System in Settings       |
| **Markdown Support**  | `**bold**`, `*italic*`, Code Blocks |
| **Link Previews**     | Automatische Link-Erkennung         |

---

## Massive Konsolidierung

Der wichtigste Teil des Tages: **~2.500 LOC Code-Deduplizierung** durch 8 neue Shared Packages.

### Neue Shared Packages

| Package                           | Migrierte Apps/Services | LOC gespart    |
| --------------------------------- | ----------------------- | -------------- |
| `@manacore/shared-nestjs-health`  | 12 Backends             | ~312 LOC       |
| `@manacore/shared-nestjs-setup`   | 8 Backends              | ~280 LOC       |
| `@manacore/shared-tsconfig`       | 13 Backends             | ~280 LOC       |
| `@manacore/shared-vite-config`    | 15 Web Apps             | ~350 LOC       |
| `@manacore/shared-drizzle-config` | 16 Configs              | ~160 LOC       |
| `@manacore/shared-logger`         | 2 Mobile Apps           | ~120 LOC       |
| `shared-nestjs-metrics`           | 6 Backends              | ~709 LOC       |
| Navigation Store Factory          | 10 Apps                 | ~50 LOC        |
| App Settings Store Factory        | 3 Apps                  | ~323 LOC       |
| **Gesamt**                        |                         | **~2.584 LOC** |

### @manacore/shared-nestjs-health

```typescript
// Vorher (26 LOC pro Backend)
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString(), service: 'chat' };
  }
}

// Nachher (1 Import)
import { HealthModule } from '@manacore/shared-nestjs-health';
@Module({ imports: [HealthModule.forRoot({ serviceName: 'chat-backend' })] })
```

**Migrierte Backends (12):**
calendar, chat, clock, contacts, food, picture, planta, presi, skilltree, storage, todo, quotes

### @manacore/shared-nestjs-setup

```typescript
// Vorher (85 LOC pro Backend)
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [...];
  app.enableCors({ origin: corsOrigins, ... });
  app.useGlobalPipes(new ValidationPipe({ ... }));
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  // ...
}

// Nachher (15 LOC)
import { bootstrapApp } from '@manacore/shared-nestjs-setup';
const app = await bootstrapApp(AppModule, { defaultPort: 3002 });
await app.listen(process.env.PORT || 3002);
```

**Migrierte Backends (8):**
chat, calendar, contacts, quotes, clock, planta, presi, food

### @manacore/shared-tsconfig

```json
// Vorher (25 LOC pro Backend)
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    // ... 20+ weitere Zeilen
  }
}

// Nachher (3 LOC)
{
  "extends": "@manacore/shared-tsconfig/nestjs"
}
```

**Verfügbare Configs:**

- `nestjs.json` - NestJS Backend
- `sveltekit.json` - SvelteKit Web
- `expo.json` - Expo Mobile
- `astro.json` - Astro Landing

### @manacore/shared-vite-config

```typescript
// Vorher (30-60 LOC pro App)
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: { port: 5174, strictPort: true },
  ssr: { noExternal: ['@manacore/shared-icons', ...] },
  optimizeDeps: { exclude: ['@manacore/shared-icons', ...] },
});

// Nachher (12 LOC)
import { createViteConfig, mergeViteConfig } from '@manacore/shared-vite-config';

const baseConfig = createViteConfig({ port: 5174 });
export default defineConfig(mergeViteConfig(baseConfig, {
  plugins: [tailwindcss(), sveltekit()],
}));
```

**Migrierte Apps (15):**
Alle SvelteKit Web Apps

### @manacore/shared-drizzle-config

```typescript
// Vorher (10-15 LOC)
export default defineConfig({
	schema: './src/db/schema/index.ts',
	out: './src/db/migrations',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL || '...' },
	verbose: true,
	strict: true,
});

// Nachher (1 Zeile)
import { createDrizzleConfig } from '@manacore/shared-drizzle-config';
export default createDrizzleConfig({ dbName: 'chat' });
```

---

## Bot Migration zu mana-llm

Alle LLM-nutzenden Bots und Services wurden auf mana-llm migriert:

| Service                  | Vorher           | Nachher      |
| ------------------------ | ---------------- | ------------ |
| matrix-ollama-bot        | Direkt zu Ollama | Via mana-llm |
| telegram-ollama-bot      | Direkt zu Ollama | Via mana-llm |
| telegram-project-doc-bot | Direkt zu Ollama | Via mana-llm |
| chat-backend             | Direkt zu Ollama | Via mana-llm |

**Vorteile:**

- Zentrale Provider-Konfiguration
- Einheitliches Logging/Metrics
- Einfacher Cloud-Provider-Wechsel
- Caching über Services hinweg

```typescript
// Vorher (in jedem Bot)
const response = await fetch(`${OLLAMA_URL}/api/chat`, {
	method: 'POST',
	body: JSON.stringify({ model, messages, stream: true }),
});

// Nachher (via mana-llm)
const response = await fetch(`${MANA_LLM_URL}/v1/chat/completions`, {
	method: 'POST',
	body: JSON.stringify({ model: 'ollama/gemma3:4b', messages, stream: true }),
});
```

---

## Dokumentation

### CONSOLIDATION_OPPORTUNITIES.md

Vollständige Analyse der Konsolidierungsmöglichkeiten mit:

- Detaillierte Code-Analyse
- LOC-Einsparungen pro Maßnahme
- Status-Tracking (erledigt/offen)
- Code-Beispiele vorher/nachher

### MICROSERVICES_API_OVERVIEW.md

Neues Dokument mit API-Übersicht aller Microservices:

- Ports und Endpoints
- Authentication-Methoden
- Request/Response Beispiele

---

## Bugfixes

| Fix                        | Beschreibung                                            |
| -------------------------- | ------------------------------------------------------- |
| **Docker Healthchecks**    | Node-basierte Healthchecks für mana-core-auth, food-web |
| **Matrix Sidebar**         | Gap und Scrolling-Layout gefixt                         |
| **Matrix Message Input**   | Layout-Verbesserungen                                   |
| **Matrix Shared Packages** | Fehlende Dependencies im Dockerfile                     |
| **Matrix Vite Config**     | Inline Config für Docker-Kompatibilität                 |
| **TTS Bot**                | MP3 Format, keine doppelten Nachrichten                 |
| **Matrix RoomItem**        | lastMessageTime Validierung                             |

---

## Neue Services/Ports

| Service      | Port | Typ            | Beschreibung  |
| ------------ | ---- | -------------- | ------------- |
| mana-llm     | 3025 | Python/FastAPI | LLM Gateway   |
| mana-crawler | 3023 | NestJS         | Web Crawler   |
| mana-notify  | 3040 | NestJS         | Notifications |

---

## Zusammenfassung

| Bereich            | Commits | Highlights                                       |
| ------------------ | ------- | ------------------------------------------------ |
| **mana-llm**       | 2       | Python Service, Provider Routing, SSE Streaming  |
| **mana-crawler**   | 1       | BullMQ, Cheerio, Robots.txt Compliance           |
| **mana-notify**    | 2       | 4 Channels, Templates, Device Registration       |
| **Matrix Phase 3** | 25      | VoIP, Screen Share, @Mentions, Reactions, Search |
| **Konsolidierung** | 18      | 8 neue Shared Packages, ~2.500 LOC gespart       |
| **Bot Migration**  | 1       | 4 Services auf mana-llm migriert                 |
| **Bugfixes**       | 6       | Docker, Matrix UI, TTS Bot                       |

**Gesamteinsparung:** ~2.584 LOC durch Konsolidierung + bessere Wartbarkeit

---

## Nächste Schritte

1. **mana-llm** auf Mac Mini deployen
2. **mana-notify** mit Auth-Service integrieren
3. **mana-crawler** für Questions App nutzen
4. **Matrix E2EE** aktivieren
5. **Restliche Backends** zu shared-nestjs-setup migrieren
6. **Mobile Apps** mit mana-notify für Push integrieren
