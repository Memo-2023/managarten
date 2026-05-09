---
title: 'Manalink: Matrix Mobile Client'
description: 'Manalink als Expo React Native Mobile Client für Matrix Chat mit Reactions, Read Receipts, Message Forwarding und EAS Build für TestFlight.'
date: 2026-03-06
author: 'Till Schneider'
category: 'feature'
tags: ['matrix', 'manalink', 'expo', 'react-native', 'mobile', 'eas-build', 'testflight']
featured: false
commits: 7
readTime: 6
stats:
  filesChanged: 140
  linesAdded: 3500
  linesRemoved: 420
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 7
workingHours:
  start: '2026-03-06T11:00'
  end: '2026-03-07T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Fokussierter Tag mit **7 Commits** für den neuen Matrix Mobile Client:

- **Manalink** - Expo React Native App für Matrix Chat
- **Reactions** - Emoji-Reaktionen auf Nachrichten
- **Read Receipts** - Lesebestätigungen
- **Message Forwarding** - Nachrichten weiterleiten
- **EAS Build** - TestFlight-Konfiguration

---

## Manalink: Matrix Mobile Client

Neue Expo React Native App als nativer Mobile Client für das selbstgehostete Matrix-Setup.

### Architektur

```
┌─────────────────────────────────────────────────┐
│  Manalink (Expo React Native)                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Rooms   │  │  Chat    │  │ Settings │      │
│  │  List    │  │  View    │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │  matrix-js-sdk                       │       │
│  │  matrix-sdk-crypto-wasm (E2EE)      │       │
│  └──────────────────────────────────────┘       │
│                                                  │
└──────────────────────────┬──────────────────────┘
                           │
                           ▼
              ┌─────────────────────┐
              │  Matrix Synapse     │
              │  (matrix.mana.how)  │
              └─────────────────────┘
```

### Features

| Feature                | Status | Beschreibung                       |
| ---------------------- | ------ | ---------------------------------- |
| **Room List**          | ✅     | Alle Räume mit Unread Count        |
| **Chat View**          | ✅     | Nachrichten-Timeline               |
| **Reactions**          | ✅     | Emoji-Reaktionen auf Nachrichten   |
| **Read Receipts**      | ✅     | Lesebestätigungen senden/empfangen |
| **Message Forwarding** | ✅     | Nachrichten an andere Räume        |
| **DM Encryption**      | ✅     | E2EE Fix für Direktnachrichten     |
| **Media Upload**       | ✅     | Bilder und Dateien senden          |

### Reactions Implementation

```typescript
// Emoji Reaction auf eine Nachricht
async function sendReaction(roomId: string, eventId: string, emoji: string) {
	await matrixClient.sendEvent(roomId, 'm.reaction', {
		'm.relates_to': {
			rel_type: 'm.annotation',
			event_id: eventId,
			key: emoji,
		},
	});
}
```

### DM Encryption Fix

Problem: Verschlüsselte DMs zeigten "Unable to decrypt" nach App-Neustart.

```typescript
// Fix: Crypto Store korrekt initialisieren
const client = createClient({
	baseUrl: homeserverUrl,
	userId: userId,
	accessToken: token,
	cryptoStore: new IndexedDBCryptoStore(indexedDB, 'manalink-crypto-store'),
});

// Wichtig: initCrypto() VOR startClient()
await client.initCrypto();
await client.startClient();
```

---

## EAS Build für TestFlight

Konfiguration für iOS TestFlight Distribution via EAS Build.

### eas.json

```json
{
	"build": {
		"development": {
			"developmentClient": true,
			"distribution": "internal"
		},
		"preview": {
			"distribution": "internal",
			"ios": {
				"simulator": false
			}
		},
		"production": {
			"autoIncrement": true,
			"ios": {
				"buildConfiguration": "Release"
			}
		}
	},
	"submit": {
		"production": {
			"ios": {
				"appleId": "till@mana.how",
				"ascAppId": "6744632877"
			}
		}
	}
}
```

---

## Root Dev Scripts

Neue Dev-Scripts im Root für einfaches Starten der Matrix-Apps.

```json
{
	"dev:matrix:mobile": "pnpm --filter @manalink/mobile start",
	"dev:matrix:web": "pnpm --filter @matrix/web dev"
}
```

---

## Monorepo Fix: sharp in neverBuiltDependencies

`sharp` wurde zu `pnpm.neverBuiltDependencies` hinzugefügt, um EAS Build Probleme zu beheben.

### Problem

EAS Build schlug fehl, weil `sharp` native Binaries auf dem Build-Server nicht kompilieren konnte.

### Lösung

```json
// package.json (root)
{
	"pnpm": {
		"neverBuiltDependencies": ["sharp"]
	}
}
```

---

## Zusammenfassung

| Bereich          | Commits | Highlights                        |
| ---------------- | ------- | --------------------------------- |
| **Manalink App** | 3       | Core App mit Room List & Chat     |
| **Features**     | 2       | Reactions, Read Receipts, Forward |
| **EAS Build**    | 1       | TestFlight Konfiguration          |
| **Monorepo**     | 1       | sharp Fix für EAS                 |

---

## Nächste Schritte

1. **Push Notifications** - APNs Integration für iOS
2. **Voice Messages** - Aufnahme und Abspielen
3. **Search** - Nachrichten-Suche in Räumen
4. **SDK 55 Upgrade** - Expo SDK Update
