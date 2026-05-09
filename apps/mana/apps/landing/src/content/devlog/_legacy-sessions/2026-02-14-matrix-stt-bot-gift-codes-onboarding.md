---
title: 'Matrix STT Bot, Gift Code UI & Onboarding Bot'
description: 'Speech-to-Text Bot für Matrix, Gift Code Web-Interface, Clock Bot Timer-Progress, Onboarding Bot für Profil-Setup und umfangreiche Bot-Fixes.'
date: 2026-02-14
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'matrix',
    'stt',
    'speech-to-text',
    'gift-codes',
    'onboarding',
    'clock-bot',
    'timer',
    'tts',
    'german-voice',
    'emoji-picker',
    'food',
    'stats-bot',
  ]
featured: true
commits: 56
readTime: 18
stats:
  filesChanged: 182
  linesAdded: 9285
  linesRemoved: 2431
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 56
workingHours:
  start: '2026-02-14T11:00'
  end: '2026-02-15T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Produktiver Valentinstag mit **56 Commits** und vielen neuen Features:

- **Matrix STT Bot** - Speech-to-Text direkt in Matrix
- **Gift Code UI** - Web-Interface für Geschenkcode-Verwaltung
- **Onboarding Bot** - Matrix Bot für Profil-Setup
- **Clock Bot Timer** - Live Progress mit Message Editing
- **TTS German Voice** - Kerstin als neue deutsche Stimme
- **Emoji Picker** - Recently Used + WhatsApp-Style Input

---

## Matrix STT Bot

Neuer Bot für Speech-to-Text-Transkription in Matrix.

### Features

| Feature             | Beschreibung               |
| ------------------- | -------------------------- |
| **Voice Messages**  | Automatische Transkription |
| **Multi-Language**  | Deutsch, Englisch, weitere |
| **Inline Response** | Transkription als Reply    |
| **High Accuracy**   | Whisper Large V3           |

### Architektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Matrix Room    │────>│  STT Bot        │────>│  mana-stt       │
│  (Voice Msg)    │     │  (Port 3340)    │     │  (Whisper)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         │                      ▼                       │
         │              ┌─────────────────┐             │
         │              │  Transcription  │<────────────┘
         │              │  Result         │
         │              └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│  Matrix Room: Reply with Transcription  │
└─────────────────────────────────────────┘
```

### Dockerfile Pattern

```dockerfile
# Gleiche Struktur wie TTS Bot
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

---

## Gift Code Web UI

Web-Interface für Geschenkcode-Einlösung und Verwaltung.

### Benutzer-Interface

```
┌─────────────────────────────────────────────────────┐
│              🎁 Geschenkcode einlösen               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  CODE-XXXX-XXXX-XXXX                        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│               [ Einlösen ]                          │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Meine eingelösten Codes:                           │
│  ✅ 500 Credits - 14.02.2026                        │
│  ✅ Pro Subscription 1 Month - 01.02.2026           │
└─────────────────────────────────────────────────────┘
```

### API Endpoints

| Endpoint                | Method | Beschreibung            |
| ----------------------- | ------ | ----------------------- |
| `/api/gifts/redeem`     | POST   | Code einlösen           |
| `/api/gifts/me`         | GET    | Eigene eingelöste Codes |
| `/api/gifts/me/history` | GET    | Einlöse-Historie        |

### Gift Types

```typescript
type GiftType =
	| 'credits' // Direkte Credits
	| 'subscription' // Abo-Zeit
	| 'first_come' // Begrenzte Anzahl
	| 'unlimited'; // Unbegrenzt einlösbar
```

### Bugfixes

- `userId undefined` - Guard verwendet `userId`, Controller erwartete `sub`
- Duplicate Claim Check für `first_come` Type
- Nullable Fields explizit auf `null` gesetzt für Drizzle

---

## Onboarding Bot

Matrix Bot für geführtes Profil-Setup neuer Nutzer.

### Onboarding Flow

```
┌─────────────────────────────────────────────────────┐
│              Onboarding Bot Flow                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. 👋 Willkommen! Wie heißt du?                    │
│     └─ User: "Max"                                  │
│                                                      │
│  2. 📸 Möchtest du ein Profilbild hochladen?        │
│     └─ User: [Bild] oder "Überspringen"             │
│                                                      │
│  3. 🎂 Wann hast du Geburtstag?                     │
│     └─ User: "15.03.1990"                           │
│                                                      │
│  4. 🌍 Welche Sprache bevorzugst du?                │
│     └─ User: "Deutsch"                              │
│                                                      │
│  5. ✅ Profil komplett! Viel Spaß!                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### State Machine

```typescript
enum OnboardingState {
	WELCOME = 'welcome',
	NAME = 'name',
	AVATAR = 'avatar',
	BIRTHDAY = 'birthday',
	LANGUAGE = 'language',
	COMPLETE = 'complete',
}

// Transitions
const transitions = {
	[OnboardingState.WELCOME]: OnboardingState.NAME,
	[OnboardingState.NAME]: OnboardingState.AVATAR,
	[OnboardingState.AVATAR]: OnboardingState.BIRTHDAY,
	[OnboardingState.BIRTHDAY]: OnboardingState.LANGUAGE,
	[OnboardingState.LANGUAGE]: OnboardingState.COMPLETE,
};
```

---

## Clock Bot Timer Progress

Live-Timer mit Message-Editing für Echtzeit-Updates.

### Feature

```
Timer gestartet: 5 Minuten

┌────────────────────────────────┐
│  ⏱️ Timer                       │
│  ████████░░░░░░░░░░ 3:42       │
│                                │
│  Verbleibend: 3 Minuten 42 Sek │
└────────────────────────────────┘
```

### Room Topic Updates

Timer-Status wird auch im Room Topic angezeigt:

```typescript
// Phase 3: Room Topic Integration
async function updateRoomTopic(roomId: string, timerStatus: string) {
	await client.sendStateEvent(roomId, 'm.room.topic', '', {
		topic: `⏱️ ${timerStatus}`,
	});
}
```

### Widget Styling

Optimiert für Element Info Panel:

```css
/* Kompaktes Layout für Widget */
.timer-widget {
	padding: 8px;
	font-size: 14px;
	background: var(--element-bg);
}
```

---

## TTS German Voice

Neue deutsche Stimme "Kerstin" für natürlichere Sprachausgabe.

### Verfügbare Stimmen

| Voice         | Language | Gender | Engine |
| ------------- | -------- | ------ | ------ |
| `de_kerstin`  | Deutsch  | Female | Piper  |
| `de_thorsten` | Deutsch  | Male   | Piper  |
| `en_amy`      | English  | Female | Piper  |

### Auto-Endpoint

```typescript
// /synthesize/auto wählt automatisch passende Stimme
POST /synthesize/auto
{
  "text": "Hallo, wie geht es dir?",
  // Automatisch: de_kerstin (erkannt: Deutsch)
}
```

### WAV Format

Für bessere Matrix-Kompatibilität auf WAV gewechselt:

```typescript
// Vorher: MP3 (Probleme mit Element)
// Nachher: WAV (native Unterstützung)
const format = 'wav';
```

---

## Emoji Picker Improvements

WhatsApp-Style Input und Recently Used Emojis.

### Recently Used

```
┌─────────────────────────────────────────────────────┐
│  Kürzlich verwendet:                                 │
│  😀 😂 ❤️ 👍 🎉 🔥 💯 ✨                           │
├─────────────────────────────────────────────────────┤
│  Smileys & Menschen:                                 │
│  😀 😃 😄 😁 😆 😅 🤣 😂 ...                        │
└─────────────────────────────────────────────────────┘
```

### Cross-App Sync

Recently Used Emojis werden über mana-core-auth synchronisiert:

```typescript
// API Endpoint
GET / api / users / me / preferences / emojis;
POST / api / users / me / preferences / emojis;
```

### WhatsApp-Style Input

```svelte
<div class="chat-input">
	<button class="emoji-trigger" on:click={togglePicker}> 😀 </button>
	<textarea bind:value={message} />
	<button class="send" on:click={send}> ➤ </button>
</div>
```

---

## Food Bot Improvements

### Auto-Analyze Text

Mahlzeiten können jetzt auch als Text beschrieben werden:

```
User: Ich hatte heute Morgen 2 Scheiben Toast mit Butter und Marmelade

Bot: 🍽️ Mahlzeit erkannt:
     - 2x Toast: 140 kcal
     - Butter (20g): 144 kcal
     - Marmelade (30g): 78 kcal
     ─────────────────
     Gesamt: 362 kcal
```

### Fixes

- Gemini Model Update: `gemini-2.0-flash-exp` → `gemini-2.5-flash`
- Korrektes API-Feldname für Bildanalyse
- Dockerfile: Shared Packages hinzugefügt

---

## Stats Bot Infrastructure Monitoring

Neue Commands für Server-Überwachung.

### Commands

```
!infra status     - Service-Status aller Container
!infra memory     - Memory-Verbrauch
!infra cpu        - CPU-Auslastung
!infra disk       - Festplatten-Status
!infra network    - Netzwerk-Traffic
```

### Prometheus Integration

```typescript
// Metriken direkt aus Prometheus abrufen
const metrics = await prometheus.query('up{job=~".*backend.*"}');
```

---

## Bot-to-Bot Loop Prevention

Fix für endlose Bot-Antwort-Schleifen.

### Problem

```
User → Bot A → Bot B → Bot A → Bot B → ...
```

### Lösung

```typescript
// Ignoriere Messages von anderen Bots
if (isBot(event.sender)) {
	return; // Keine Antwort
}

// Ignoriere Edit-Events
if (event.content['m.relates_to']?.rel_type === 'm.replace') {
	return;
}
```

---

## Session Auto-Refresh

Automatische JWT-Token-Erneuerung bei Ablauf.

```typescript
// Interceptor für automatisches Refresh
async function fetchWithRefresh(url: string, options: RequestInit) {
	const response = await fetch(url, options);

	if (response.status === 401) {
		await refreshToken();
		return fetch(url, {
			...options,
			headers: {
				...options.headers,
				Authorization: `Bearer ${getNewToken()}`,
			},
		});
	}

	return response;
}
```

---

## Umami Analytics Update

Tracking IDs für alle Web-Apps aktualisiert.

### Betroffene Apps

| App          | Neue Tracking ID |
| ------------ | ---------------- |
| manacore-web | `manacore-prod`  |
| chat-web     | `chat-prod`      |
| calendar-web | `calendar-prod`  |
| clock-web    | `clock-prod`     |
| contacts-web | `contacts-prod`  |
| todo-web     | `todo-prod`      |
| picture-web  | `picture-prod`   |
| quotes-web   | `quotes-prod`    |

---

## Zusammenfassung

| Bereich          | Commits | Highlights             |
| ---------------- | ------- | ---------------------- |
| **Matrix STT**   | 3       | Speech-to-Text Bot     |
| **Gift Codes**   | 6       | Web UI + Fixes         |
| **Onboarding**   | 2       | Profile Setup Bot      |
| **Clock Bot**    | 4       | Timer Progress + Topic |
| **TTS**          | 4       | German Voice + WAV     |
| **Emoji Picker** | 3       | Recently Used + Sync   |
| **Food**         | 5       | Text-Analyse + Fixes   |
| **Stats Bot**    | 3       | Infra Monitoring       |
| **Bot Fixes**    | 8       | Loop Prevention + Auth |
| **Session**      | 2       | Auto-Refresh           |
| **Analytics**    | 2       | Umami Update           |
| **Sonstige**     | 14      | Diverse Fixes          |

---

## Nächste Schritte

1. **Onboarding UI** in Web-Apps integrieren
2. **Gift Code Admin** Dashboard
3. **Voice-to-Voice** Matrix Bots
4. **Multi-Room** Timer Sync
