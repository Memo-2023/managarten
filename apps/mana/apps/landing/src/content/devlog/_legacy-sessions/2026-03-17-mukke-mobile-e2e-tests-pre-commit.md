---
title: 'Mukke Music Player, Calendar E2E Tests & Pre-Commit Fixes'
description: 'Mukke als offline-first iOS Music Player ins Monorepo aufgenommen. Calendar Playwright E2E Tests, Pre-Commit Hook Fixes und Auth Verbesserungen.'
date: 2026-03-17
author: 'Till Schneider'
category: 'feature'
tags: ['mukke', 'music-player', 'expo', 'e2e-tests', 'playwright', 'pre-commit', 'auth', 'traces']
featured: false
commits: 9
readTime: 8
stats:
  filesChanged: 85
  linesAdded: 5800
  linesRemoved: 220
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 9
workingHours:
  start: '2026-03-17T11:00'
  end: '2026-03-18T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Produktiver Tag mit **9 Commits** über mehrere Apps hinweg:

- **Mukke** - Offline-first iOS Music Player mit Expo und SQLite
- **Calendar E2E Tests** - Playwright Tests für die Web App
- **Pre-Commit Hook** - eslint-config Dependency Fix, type-check entfernt
- **Auth Fixes** - 403 für unverified Email, Password Min Length
- **Traces** - EAS Build für TestFlight konfiguriert

---

## Mukke: Offline-First Music Player

Mukke ist ein neuer offline-first iOS Music Player. Die App verwaltet lokale Musikdateien mit SQLite als Datenbank und bietet Background Audio Playback.

### Architektur

```
apps/mukke/
├── apps/
│   └── web/          # SvelteKit Web App (Playlist Management)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── (app)/
│       │   │   │   ├── library/    # Musik-Bibliothek
│       │   │   │   ├── playlists/  # Playlist-Verwaltung
│       │   │   │   └── player/     # Audio Player
│       │   │   └── +layout.svelte
│       │   └── lib/
│       │       ├── stores/         # Svelte 5 Runes Stores
│       │       ├── db/             # SQLite Integration
│       │       └── components/     # UI Komponenten
│       └── package.json
└── package.json
```

### Key Features

| Feature              | Beschreibung                             |
| -------------------- | ---------------------------------------- |
| **Offline-First**    | Alle Daten lokal in SQLite               |
| **Local Files**      | Import aus dem lokalen Dateisystem       |
| **Background Audio** | expo-audio mit Background Mode           |
| **Playlists**        | Erstellen, Bearbeiten, Sortieren         |
| **Metadata**         | ID3 Tag Parsing für Artist, Album, Cover |

### Technologie Stack

```
┌─────────────────────────────────────┐
│           Mukke iOS App             │
├─────────────────────────────────────┤
│  Expo SDK 55 + expo-router          │
│  expo-audio (Background Playback)   │
│  expo-file-system (Local Storage)   │
│  expo-sqlite (Metadata Database)    │
│  NativeWind (Styling)               │
└─────────────────────────────────────┘
```

### Datenbank Schema

```sql
CREATE TABLE tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  duration INTEGER,
  file_path TEXT NOT NULL,
  cover_art_path TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlist_tracks (
  playlist_id TEXT REFERENCES playlists(id),
  track_id TEXT REFERENCES tracks(id),
  position INTEGER,
  PRIMARY KEY (playlist_id, track_id)
);
```

---

## Calendar: Playwright E2E Tests

Umfassende E2E Tests für die Calendar Web App mit Playwright.

### Test Coverage

| Test Suite      | Tests | Beschreibung                   |
| --------------- | ----- | ------------------------------ |
| **Navigation**  | 6     | View-Wechsel, Datum-Navigation |
| **Event CRUD**  | 8     | Erstellen, Bearbeiten, Löschen |
| **Drag & Drop** | 4     | Event verschieben, Resize      |
| **Keyboard**    | 5     | Shortcuts, Focus Management    |
| **Responsive**  | 3     | Mobile, Tablet, Desktop        |

### Test Beispiel

```typescript
test('should create a new event via click', async ({ page }) => {
	await page.goto('/calendar');

	// Click on a time slot
	await page.locator('[data-timeslot="10:00"]').click();

	// Fill event form
	await page.getByLabel('Title').fill('Team Meeting');
	await page.getByLabel('Description').fill('Weekly sync');
	await page.getByRole('button', { name: 'Save' }).click();

	// Verify event appears
	await expect(page.getByText('Team Meeting')).toBeVisible();
});
```

### CI Integration

```yaml
# In der Pipeline
- name: Calendar E2E Tests
  run: pnpm --filter @calendar/web test:e2e
```

---

## Pre-Commit Hook Fixes

Der Pre-Commit Hook hatte zwei Probleme:

### 1. Fehlende eslint-config Dependency

```diff
  "devDependencies": {
+   "@manacore/eslint-config": "workspace:*",
    "lint-staged": "^15.0.0"
  }
```

### 2. type-check entfernt

`type-check` im Pre-Commit war zu langsam (30+ Sekunden) und blockierte den Workflow.

```diff
  // lint-staged.config.js
  module.exports = {
    '*.{ts,tsx,js,jsx}': [
      'eslint --fix',
      'prettier --write',
-     'tsc --noEmit',
    ],
    '*.{svelte}': [
      'prettier --write',
-     'svelte-check',
    ],
  };
```

Type-Checking läuft weiterhin in der CI Pipeline.

---

## Auth Verbesserungen

### 403 für Unverified Email

Bisher erhielten Nutzer mit unbestätigter E-Mail einen generischen 401 Error. Jetzt gibt es einen expliziten 403 mit klarer Fehlermeldung.

```typescript
if (!user.emailVerified) {
	throw new HttpException(
		{
			statusCode: 403,
			error: 'email_not_verified',
			message: 'Please verify your email address before logging in.',
		},
		HttpStatus.FORBIDDEN
	);
}
```

### Password Min Length

Die Mindestlänge für das Reset-Password wurde von 6 auf 8 Zeichen angehoben, um mit der Registration übereinzustimmen.

```diff
  const resetPasswordSchema = z.object({
-   password: z.string().min(6),
+   password: z.string().min(8),
    token: z.string(),
  });
```

---

## Traces: EAS Build für TestFlight

EAS Build für die Traces App konfiguriert, inkl. TestFlight Distribution.

```json
{
	"build": {
		"production": {
			"distribution": "store",
			"ios": {
				"buildConfiguration": "Release"
			}
		},
		"preview": {
			"distribution": "internal",
			"ios": {
				"simulator": false
			}
		}
	},
	"submit": {
		"production": {
			"ios": {
				"appleId": "till@mana.how",
				"ascAppId": "traces-app-id"
			}
		}
	}
}
```

---

## Calendar Settings Audit

Dokumentation aller Calendar Settings mit aktuellem Status und geplanten Erweiterungen erstellt.

---

## Zusammenfassung

| Bereich           | Commits | Highlights                         |
| ----------------- | ------- | ---------------------------------- |
| **Mukke**         | 1       | Offline-first Music Player         |
| **Calendar E2E**  | 1       | 26 Playwright Tests                |
| **Pre-Commit**    | 1       | eslint-config, type-check entfernt |
| **Auth**          | 2       | 403 Unverified, Password Length    |
| **Traces**        | 2       | EAS Build, TestFlight              |
| **Calendar Docs** | 1       | Settings Audit                     |
| **Bot Services**  | 1       | Build Fix                          |

---

## Nächste Schritte

1. **Mukke Player** - Background Audio und Lock Screen Controls
2. **Calendar E2E** - Recurring Events Tests
3. **Traces TestFlight** - Erster interner Build
4. **Test Coverage** - Unit Tests für Contacts und Todo
