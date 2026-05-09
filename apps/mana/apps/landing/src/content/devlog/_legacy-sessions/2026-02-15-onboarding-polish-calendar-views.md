---
title: 'Onboarding Modal Polish & Calendar ViewsBar'
description: 'Onboarding Modal als kompaktes Design mit korrekten Layer-Farben, STT API Key Support und neue Calendar ViewsBar Komponente.'
date: 2026-02-15
author: 'Till Schneider'
category: 'update'
tags: ['onboarding', 'ui-polish', 'calendar', 'views-bar', 'stt', 'api-key', 'gift-codes']
featured: false
commits: 7
readTime: 5
stats:
  filesChanged: 14
  linesAdded: 382
  linesRemoved: 314
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 7
workingHours:
  start: '2026-02-15T11:00'
  end: '2026-02-16T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Fokussierter Tag mit **7 Commits** für UI-Polish und kleinere Features:

- **Onboarding Modal** - Kompaktes Design statt Fullscreen
- **Calendar ViewsBar** - Unified View Switcher Komponente
- **STT API Key** - Support für alle Matrix Bots
- **Gift Code Fixes** - Debug-Logging entfernt

---

## Onboarding Modal Polish

Das Onboarding-Modal wurde von Fullscreen auf kompaktes Modal umgestellt.

### Vorher vs. Nachher

| Aspekt               | Fullscreen | Kompakt   |
| -------------------- | ---------- | --------- |
| Bildschirmabdeckung  | 100%       | ~60%      |
| Hintergrund sichtbar | ❌         | ✅        |
| Mobile UX            | Okay       | Besser    |
| Escape-Gefühl        | Bedrängend | Einladend |

### Elevation Layer Colors

Korrektur der Layer-Farben für das Design-System:

```css
/* Vorher: Falsche Elevation */
.modal-content {
	background: var(--surface-0);
}

/* Nachher: Korrekte Elevation */
.modal-content {
	background: var(--surface-1); /* Erhöht */
}

.modal-overlay {
	background: rgba(0, 0, 0, 0.5);
}
```

### Design-System Referenz

```
┌─────────────────────────────────────────────────────┐
│  Elevation Layers                                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  surface-0  ████████  Base (Page Background)        │
│  surface-1  ████████  Raised (Cards, Modals)        │
│  surface-2  ████████  Higher (Dropdowns, Tooltips)  │
│  surface-3  ████████  Highest (Floating Elements)   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Calendar ViewsBar

Neue unified Komponente für den View-Wechsel im Calendar.

### Features

| Feature                | Beschreibung       |
| ---------------------- | ------------------ |
| **Day/Week/Month**     | Standard-Ansichten |
| **Year Overview**      | Jahresübersicht    |
| **Agenda**             | Listen-Ansicht     |
| **Keyboard Shortcuts** | D, W, M, Y, A      |

### Component API

```svelte
<script lang="ts">
	import { ViewsBar } from '$lib/components/ViewsBar.svelte';

	let currentView = $state<'day' | 'week' | 'month' | 'year' | 'agenda'>('week');
</script>

<ViewsBar bind:view={currentView} />
```

### Implementation

```svelte
<!-- apps/calendar/apps/web/src/lib/components/ViewsBar.svelte -->
<div class="views-bar">
	{#each views as view}
		<button
			class:active={currentView === view.id}
			on:click={() => (currentView = view.id)}
			title="{view.label} ({view.shortcut})"
		>
			<Icon name={view.icon} />
			<span class="label">{view.label}</span>
		</button>
	{/each}
</div>

<style>
	.views-bar {
		display: flex;
		gap: 4px;
		padding: 4px;
		background: var(--surface-1);
		border-radius: 8px;
	}

	button.active {
		background: var(--primary);
		color: var(--on-primary);
	}
</style>
```

---

## STT API Key Support

API Key Authentication für den Transcription Service.

### Motivation

- Externer Zugriff auf mana-stt
- Rate Limiting pro API Key
- Usage Tracking

### Implementation

```typescript
// packages/bot-services/src/transcription.service.ts
export class TranscriptionService {
	private apiKey?: string;

	constructor(config: { apiKey?: string }) {
		this.apiKey = config.apiKey;
	}

	async transcribe(audioBuffer: Buffer): Promise<string> {
		const headers: Record<string, string> = {
			'Content-Type': 'audio/wav',
		};

		if (this.apiKey) {
			headers['X-API-Key'] = this.apiKey;
		}

		const response = await fetch(`${this.baseUrl}/transcribe`, {
			method: 'POST',
			headers,
			body: audioBuffer,
		});

		return response.json();
	}
}
```

### Betroffene Bots

Alle Matrix Bots mit STT-Funktionalität:

- matrix-stt-bot
- matrix-food-bot
- matrix-chat-bot (Voice Messages)

### Environment Variable

```env
STT_API_KEY=your-api-key-here
```

---

## Gift Code Fixes

### Debug Logging entfernt

Nach erfolgreichem Fix des `userId undefined` Problems wurde das Debug-Logging entfernt:

```diff
- console.log('Gift redemption debug:', {
-   userId,
-   giftCode,
-   giftType,
- });
```

### Cleanup

- Produktions-ready ohne Debug-Output
- Cleaner Logs für Monitoring

---

## Zusammenfassung

| Bereich        | Commits | Highlights                    |
| -------------- | ------- | ----------------------------- |
| **Onboarding** | 2       | Modal → Kompakt, Layer Colors |
| **Calendar**   | 1       | ViewsBar Komponente           |
| **STT**        | 2       | API Key für Bots              |
| **Gift Codes** | 1       | Debug Cleanup                 |
| **Fixes**      | 1       | userId Guard                  |

---

## Nächste Schritte

1. **Onboarding Steps** - Weitere Steps implementieren
2. **Calendar Sync** - CalDAV Integration
3. **STT Streaming** - Real-time Transkription
4. **Gift Admin Panel** - Code-Erstellung im UI
