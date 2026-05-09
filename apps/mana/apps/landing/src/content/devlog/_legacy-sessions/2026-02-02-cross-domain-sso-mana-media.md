---
title: 'Cross-Domain SSO, mana-media Integration & Matrix Bots Page'
description: 'Cross-Subdomain SSO für alle .mana.how Apps, mana-media Food Integration, neue Bots-Übersichtsseite in Manalink, und mana-llm Production Deployment'
date: 2026-02-02
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'sso',
    'cross-domain',
    'mana-media',
    'matrix',
    'bots',
    'mana-llm',
    'production',
    'food',
    'calendar',
    'ux',
  ]
featured: true
commits: 40
readTime: 15
stats:
  filesChanged: 207
  linesAdded: 9495
  linesRemoved: 6405
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 40
workingHours:
  start: '2026-02-02T11:00'
  end: '2026-02-03T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Produktiver Tag mit **40 Commits** und Fokus auf nahtlose Authentifizierung über alle Apps:

- **Cross-Domain SSO** - Single Sign-On für alle .mana.how Subdomains
- **mana-media Integration** - Food mit zentraler Medienverarbeitung
- **Matrix Bots Page** - Übersicht aller 19 Bots in Manalink
- **mana-llm Production** - LLM Gateway auf Mac Mini deployed
- **i18n für Matrix Bots** - Mehrsprachige Bot-Antworten
- **Calendar UX** - Tasks versteckt, automatischer Scroll zu Mittag

---

## Cross-Domain SSO

Single Sign-On über alle ManaCore Web Apps.

### Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cross-Domain SSO Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User besucht         Session Check          Bereits eingeloggt  │
│  calendar.mana.how ─────────────────────> auth.mana.how         │
│         │                                        │               │
│         │              Cookie gefunden           │               │
│         │<──────────────────────────────────────│               │
│         │              auf .mana.how             │               │
│         │                                        │               │
│         ▼                                                        │
│  Automatisch eingeloggt                                          │
│  (kein Login-Redirect)                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Cookie-Konfiguration

```typescript
// mana-core-auth: Cookie Settings
{
  name: 'manacore_session',
  domain: '.mana.how',  // Shared across subdomains
  secure: true,
  sameSite: 'lax',
  httpOnly: true,
  path: '/',
}
```

### Betroffene Apps

| App        | URL                 | SSO Status |
| ---------- | ------------------- | ---------- |
| Calendar   | calendar.mana.how   | ✅         |
| Chat       | chat.mana.how       | ✅         |
| Clock      | clock.mana.how      | ✅         |
| Contacts   | contacts.mana.how   | ✅         |
| Food       | food.mana.how       | ✅         |
| Picture    | picture.mana.how    | ✅         |
| Planta     | planta.mana.how     | ✅         |
| Questions  | questions.mana.how  | ✅         |
| SkillTree  | skilltree.mana.how  | ✅         |
| Storage    | storage.mana.how    | ✅         |
| Todo       | todo.mana.how       | ✅         |
| Quotes     | quotes.mana.how     | ✅         |
| Manalink   | manalink.mana.how   | ✅         |
| Playground | playground.mana.how | ✅         |

### get-session Endpoint

Neuer Endpoint für Session-Validierung:

```typescript
// GET /api/auth/get-session
// Returns: { user, session } or null

const response = await fetch('https://auth.mana.how/api/auth/get-session', {
	credentials: 'include', // Wichtig für Cross-Domain Cookies
});
const { user } = await response.json();
```

---

## mana-media Integration

Zentrale Medienverarbeitung mit Food als erster Integration.

### Food Integration

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Food      │────>│   mana-media    │────>│    MinIO        │
│   (Upload)      │     │   (Process)     │     │   (Storage)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      │ EXIF Extraction
         │                      │ Thumbnail Generation
         │                      │ Resize/Compress
         │                      ▼
         │              ┌─────────────────┐
         │              │   PostgreSQL    │
         │              │   (Metadata)    │
         │              └─────────────────┘
```

### Änderungen

| Änderung        | Beschreibung                       |
| --------------- | ---------------------------------- |
| `userId` Type   | UUID → TEXT (für Matrix User IDs)  |
| Body Size Limit | 10mb → 50mb (Bilder)               |
| Dockerfile      | Vereinfacht auf Single Build Stage |

### API

```typescript
// POST /api/v1/media/upload
const formData = new FormData();
formData.append('file', imageFile);
formData.append('context', 'meal');

const response = await fetch('https://media.mana.how/api/v1/media/upload', {
	method: 'POST',
	body: formData,
	headers: { Authorization: `Bearer ${token}` },
});
```

---

## Matrix Bots Page

Neue Übersichtsseite mit allen 19 Matrix Bots in Manalink.

### UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Manalink - Bots                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🤖 mana-mana-bot                                            ││
│  │ Der zentrale AI-Assistent mit Voice Support                 ││
│  │ Commands: !help, !model, Voice Messages                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✅ matrix-todo-bot                                          ││
│  │ Task-Management mit natürlicher Sprache                     ││
│  │ Commands: todo, liste, erledigt                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ... (17 weitere Bots)                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Bot-Liste

| Bot                  | Kategorie    | Beschreibung           |
| -------------------- | ------------ | ---------------------- |
| mana-mana-bot        | AI           | Zentraler AI-Assistent |
| matrix-todo-bot      | Productivity | Task-Management        |
| matrix-calendar-bot  | Productivity | Termine & Erinnerungen |
| matrix-clock-bot     | Utility      | Timer & Weltzeit       |
| matrix-contacts-bot  | Productivity | Kontaktverwaltung      |
| matrix-food-bot      | Health       | Ernährungs-Tracking    |
| matrix-picture-bot   | AI           | Bildgenerierung        |
| matrix-quotes-bot    | Inspiration  | Tägliche Zitate        |
| matrix-skilltree-bot | Gamification | Skill-Tracking         |
| matrix-planta-bot    | Lifestyle    | Pflanzenpflege         |
| matrix-cards-bot     | Learning     | Lernkarten             |
| matrix-presi-bot     | Productivity | Präsentationen         |
| matrix-questions-bot | Research     | Q&A Management         |
| matrix-chat-bot      | AI           | AI-Chat                |
| matrix-ollama-bot    | AI           | LLM Direct Access      |
| matrix-tts-bot       | Media        | Text-to-Speech         |
| matrix-stt-bot       | Media        | Speech-to-Text         |
| matrix-storage-bot   | Utility      | Dateiverwaltung        |
| matrix-voice-bot     | AI           | Voice-to-Voice         |

### Layout

Single Column Layout für bessere Lesbarkeit auf allen Geräten.

---

## mana-llm Production

LLM Gateway auf Mac Mini deployed.

### Docker Compose

```yaml
mana-llm:
  image: ghcr.io/manacore/mana-llm:latest
  ports:
    - '3025:3025'
  environment:
    - OLLAMA_URL=http://host.docker.internal:11434
    - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
  restart: unless-stopped
```

### SSE Fix

Double-Data-Prefix Problem behoben:

```python
# Vorher (falsch)
yield f"data: data: {json.dumps(chunk)}\n\n"

# Nachher (korrekt)
yield f"data: {json.dumps(chunk)}\n\n"
```

---

## i18n für Matrix Bots

Mehrsprachige Bot-Antworten basierend auf User-Präferenzen.

### Unterstützte Sprachen

| Sprache | Code |
| ------- | ---- |
| Deutsch | `de` |
| English | `en` |

### Implementierung

```typescript
// bot-services/i18n/index.ts
export function t(key: string, locale: string = 'de'): string {
	return translations[locale]?.[key] || translations['de'][key] || key;
}

// Verwendung
const response = t('todo.created', userLocale);
// DE: "Aufgabe erstellt!"
// EN: "Task created!"
```

### Direct Message Fallback

Bots antworten jetzt auch in DMs statt nur in Rooms:

```typescript
if (event.sender !== this.client.getUserId()) {
	// Auch Direct Messages beantworten
	await this.handleCommand(event);
}
```

---

## Cross-Bot SSO via Redis

Single Sign-On über verschiedene Matrix Bots.

### Architektur

```
┌─────────────────┐     ┌─────────────────┐
│  matrix-todo-   │     │  matrix-cal-    │
│     bot         │     │  endar-bot      │
│                 │     │                 │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │      Redis Sessions   │
         │           │           │
         │           ▼           │
         │    ┌─────────────┐    │
         └───>│    Redis    │<───┘
              │   Sessions  │
              └─────────────┘
```

### Session Sharing

```typescript
// SessionService mit Redis
class SessionService {
	async getSession(userId: string): Promise<BotSession | null> {
		const session = await this.redis.get(`bot:session:${userId}`);
		return session ? JSON.parse(session) : null;
	}

	async setSession(userId: string, session: BotSession): Promise<void> {
		await this.redis.set(`bot:session:${userId}`, JSON.stringify(session), 'EX', 86400);
	}
}
```

---

## Calendar UX Verbesserungen

Verbesserte User Experience für die Calendar App.

### Änderungen

| Änderung            | Beschreibung                |
| ------------------- | --------------------------- |
| **Tasks versteckt** | Standardmäßig ausgeblendet  |
| **Auto-Scroll**     | Scrollt zu 12:00 beim Laden |
| **PillNavigation**  | Sidebar Mode entfernt       |

### Auto-Scroll

```typescript
onMount(() => {
	// Scroll to midday (12:00)
	const hourElement = document.querySelector('[data-hour="12"]');
	hourElement?.scrollIntoView({ block: 'center' });
});
```

---

## Matrix User Auto-Link

Automatische Verknüpfung von ManaCore-Accounts mit Matrix-Users bei OIDC Login.

### Flow

```
1. User loggt sich via OIDC in Matrix ein
2. mana-core-auth erhält OIDC Callback
3. Matrix User ID wird mit ManaCore Account verknüpft
4. Alle Bots erkennen den User automatisch
```

### Database Schema

```sql
ALTER TABLE users ADD COLUMN matrix_user_id TEXT;

-- Index für schnelle Lookups
CREATE INDEX idx_users_matrix_user_id ON users(matrix_user_id);
```

---

## Bugfixes

| Fix                 | Beschreibung                  |
| ------------------- | ----------------------------- |
| **mana-llm SSE**    | Double data prefix            |
| **contacts-web**    | Runtime URLs statt Build-time |
| **shared-ui**       | calculateFadeOpacity Export   |
| **food Dockerfile** | Fehlende shared packages      |
| **SessionService**  | Async Methods                 |
| **JWT Issuer**      | Aligned mit Better Auth       |

---

## Zusammenfassung

| Bereich              | Commits | Highlights           |
| -------------------- | ------- | -------------------- |
| **Cross-Domain SSO** | 5       | 14 Apps mit SSO      |
| **mana-media**       | 4       | Food Integration     |
| **Matrix Bots Page** | 2       | 19 Bots Übersicht    |
| **mana-llm**         | 2       | Production + SSE Fix |
| **i18n Bots**        | 2       | DE/EN Support        |
| **Cross-Bot SSO**    | 3       | Redis Sessions       |
| **Calendar UX**      | 3       | Tasks, Auto-Scroll   |
| **Auth Fixes**       | 8       | JWT, Sessions, OIDC  |
| **Bugfixes**         | 11      | Docker, UI, Types    |

---

## Nächste Schritte

1. **Photos App** mit mana-media Integration
2. **Admin Dashboard** für User-Übersicht
3. **STT/TTS APIs** extern verfügbar machen
4. **Matrix E2EE** aktivieren
