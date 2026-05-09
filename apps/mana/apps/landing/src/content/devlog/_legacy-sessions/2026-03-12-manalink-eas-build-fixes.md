---
title: 'ManaLink EAS Build Fixes & Expo SDK 55 Migration'
description: 'EAS Build Pre-Install Hook für pnpm hoisted Mode, Migration von expo-av zu expo-audio und Dependency Alignment für Expo SDK 55.'
date: 2026-03-12
author: 'Till Schneider'
category: 'bugfix'
tags: ['manalink', 'eas-build', 'expo-sdk-55', 'expo-audio', 'react-native']
featured: false
commits: 5
readTime: 4
stats:
  filesChanged: 12
  linesAdded: 180
  linesRemoved: 45
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 5
workingHours:
  start: '2026-03-12T11:00'
  end: '2026-03-13T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Fokussierter Tag mit **5 Commits** für EAS Build Stabilität und Expo SDK 55 Kompatibilität:

- **EAS Build Pre-Install Hook** - pnpm hoisted Mode für Monorepo Builds
- **expo-av → expo-audio** - Migration auf das neue Audio API
- **SDK 55 Dependency Alignment** - Alle Packages auf kompatible Versionen
- **Build Image Update** - sdk-55 statt deprecated Default Image

---

## EAS Build Pre-Install Hook

EAS Build unterstützt pnpm Monorepos nur eingeschränkt. Der neue Pre-Install Hook stellt sicher, dass Dependencies korrekt im hoisted Mode installiert werden.

### Problem

EAS Build konnte native Dependencies nicht finden, weil pnpm standardmäßig im strict/isolated Mode installiert. React Native erwartet aber, dass alle Dependencies im `node_modules`-Root verfügbar sind.

### Lösung

```javascript
// eas-hooks/eas-build-pre-install.js
const { execSync } = require('child_process');

// Set node-linker to hoisted for EAS Build compatibility
execSync('echo "node-linker=hoisted" >> .npmrc');
```

### eas.json Konfiguration

```json
{
	"build": {
		"base": {
			"node": "20.18.0",
			"pnpm": "9.15.0",
			"image": "sdk-55"
		}
	}
}
```

---

## Migration: expo-av → expo-audio

`expo-av` ist ab SDK 55 deprecated. Die neue `expo-audio` Library bietet ein schlankeres API.

### API Vergleich

| Feature            | expo-av                 | expo-audio                         |
| ------------------ | ----------------------- | ---------------------------------- |
| **Import**         | `Audio` from `expo-av`  | `useAudioPlayer` from `expo-audio` |
| **Playback**       | Class-basiert (`Sound`) | Hook-basiert                       |
| **Bundle Size**    | Inkludiert Video        | Nur Audio                          |
| **SDK 55 Support** | Deprecated              | Empfohlen                          |

### Vorher (expo-av)

```typescript
import { Audio } from 'expo-av';

const { sound } = await Audio.Sound.createAsync(source);
await sound.playAsync();
```

### Nachher (expo-audio)

```typescript
import { useAudioPlayer } from 'expo-audio';

const player = useAudioPlayer(source);
player.play();
```

---

## Dependency Alignment SDK 55

Mehrere Dependencies waren nicht auf die von Expo SDK 55 erwarteten Versionen gepinnt.

### Aktualisierte Packages

| Package               | Vorher | Nachher |
| --------------------- | ------ | ------- |
| `react-native`        | 0.76.x | 0.79.x  |
| `react`               | 18.3.x | 19.0.x  |
| `expo-router`         | 4.x    | 5.x     |
| `expo-image`          | 1.x    | 2.x     |
| `@react-navigation/*` | 6.x    | 7.x     |

### Build Image

```diff
- "image": "default"
+ "image": "sdk-55"
```

Das `default` Build Image enthielt veraltete Xcode- und Android SDK-Versionen, die mit SDK 55 inkompatibel waren.

---

## babel-preset-expo

Als explizite Dependency hinzugefügt, da EAS Build im hoisted Mode das Preset nicht automatisch aus der Expo-Dependency auflösen konnte.

```json
{
	"devDependencies": {
		"babel-preset-expo": "~13.0.0"
	}
}
```

---

## Zusammenfassung

| Bereich             | Commits | Highlights                    |
| ------------------- | ------- | ----------------------------- |
| **EAS Build**       | 2       | Pre-Install Hook, Build Image |
| **Audio Migration** | 1       | expo-av → expo-audio          |
| **Dependencies**    | 1       | SDK 55 Alignment              |
| **Babel**           | 1       | Explicit Preset               |

---

## Nächste Schritte

1. **ManaLink Features** - Audio-Playback im Foreground/Background testen
2. **TestFlight Build** - Erster Build über EAS Submit
3. **Android Build** - EAS Build für Google Play vorbereiten
