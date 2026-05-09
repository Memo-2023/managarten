---
title: 'Manalink SDK 55 Upgrade & Fixes'
description: 'Manalink auf Expo SDK 55 aktualisiert, matrix-sdk-crypto-wasm Metro Blocking Fix, Reanimated 4.2 Kompatibilität und Chat Input Bar Fix.'
date: 2026-03-07
author: 'Till Schneider'
category: 'bugfix'
tags: ['matrix', 'manalink', 'expo-sdk-55', 'react-native', 'metro']
featured: false
commits: 5
readTime: 4
stats:
  filesChanged: 28
  linesAdded: 480
  linesRemoved: 310
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 5
workingHours:
  start: '2026-03-07T11:00'
  end: '2026-03-08T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Bugfix-Tag mit **5 Commits** – Expo SDK Upgrade und kritische Fixes:

- **SDK 55** - Manalink auf Expo SDK 55 aktualisiert
- **Metro Fix** - matrix-sdk-crypto-wasm Blocking behoben
- **Reanimated** - Worklets für 4.2 Kompatibilität
- **Chat Input** - Eingabeleiste nicht mehr hinter PillNavigation

---

## Expo SDK 55 Upgrade

Manalink von Expo SDK 52 auf SDK 55 aktualisiert.

### Aktualisierte Dependencies

| Package                   | Vorher  | Nachher |
| ------------------------- | ------- | ------- |
| `expo`                    | ~52.0.0 | ~55.0.0 |
| `react-native`            | 0.76.x  | 0.79.x  |
| `expo-router`             | ~4.0.0  | ~5.0.0  |
| `react-native-reanimated` | ~3.16.0 | ~4.2.0  |
| `@expo/metro-runtime`     | ~4.0.0  | ~5.0.0  |

### Breaking Changes

- Expo Router 5: Neue Layout-API
- Reanimated 4: Worklet-System überarbeitet
- Metro: Strengere Module-Resolution

---

## Metro Resolver Fix: matrix-sdk-crypto-wasm

`matrix-sdk-crypto-wasm` blockierte den Metro Resolver beim Bundling.

### Problem

```
error: Unable to resolve module matrix-sdk-crypto-wasm
  from node_modules/matrix-js-sdk/lib/crypto/...

Metro bundler hung indefinitely when encountering WASM modules
```

### Ursache

Metro kann keine `.wasm` Module auflösen. Das `matrix-sdk-crypto-wasm` Package enthält WebAssembly-Binaries, die Metro blockieren.

### Lösung

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Block matrix-sdk-crypto-wasm from being resolved
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName === 'matrix-sdk-crypto-wasm') {
		return {
			type: 'empty',
		};
	}
	return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

---

## react-native-worklets für Reanimated 4.2

Reanimated 4.2 benötigt `react-native-worklets` als separates Package.

### Problem

```
Error: Reanimated 4.2 requires react-native-worklets-core
```

### Lösung

```bash
pnpm add react-native-worklets-core --filter @manalink/mobile
```

```javascript
// babel.config.js
module.exports = function (api) {
	api.cache(true);
	return {
		presets: ['babel-preset-expo'],
		plugins: [
			'react-native-worklets-core/plugin',
			'react-native-reanimated/plugin', // Muss letztes Plugin sein
		],
	};
};
```

---

## react-native-css-interop Dependency

Neue Dependency für NativeWind v4 Kompatibilität mit SDK 55.

```bash
pnpm add react-native-css-interop --filter @manalink/mobile
```

---

## Chat Input Bar Fix

Die Chat-Eingabeleiste wurde auf Web von der PillNavigation verdeckt.

### Problem

```
┌─────────────────────────────────────┐
│                                      │
│  Chat Messages                       │
│  ...                                 │
│  ...                                 │
│                                      │
├─────────────────────────────────────┤
│  [Chat Input Bar]  ← Verdeckt!      │
├─────────────────────────────────────┤
│  ██  ██  ██  ██  ██  PillNav       │
└─────────────────────────────────────┘
```

### Lösung

```css
/* Chat Container mit Bottom-Padding für PillNavigation */
.chat-container {
	padding-bottom: calc(env(safe-area-inset-bottom) + 64px);
}
```

### Nachher

```
┌─────────────────────────────────────┐
│                                      │
│  Chat Messages                       │
│  ...                                 │
│                                      │
├─────────────────────────────────────┤
│  [Chat Input Bar]  ← Sichtbar!     │
│                                      │
├─────────────────────────────────────┤
│  ██  ██  ██  ██  ██  PillNav       │
└─────────────────────────────────────┘
```

---

## Zusammenfassung

| Bereich         | Commits | Highlights                   |
| --------------- | ------- | ---------------------------- |
| **SDK 55**      | 1       | Expo + React Native Upgrade  |
| **Metro**       | 1       | crypto-wasm Blocking Fix     |
| **Reanimated**  | 1       | Worklets Dependency          |
| **CSS Interop** | 1       | NativeWind v4 Kompatibilität |
| **Chat Input**  | 1       | PillNavigation Overlap Fix   |

---

## Nächste Schritte

1. **Performance** - Bundle Size Optimierung
2. **E2EE** - Native Crypto-Module statt WASM
3. **Notifications** - Push via APNs/FCM
4. **CI/CD** - Automatische Builds bei PR
