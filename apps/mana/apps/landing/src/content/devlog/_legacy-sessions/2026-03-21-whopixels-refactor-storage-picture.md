---
title: 'WhoPixels Major Refactor, Storage Animations & Picture Hardening'
description: 'WhoPixels-Spiel komplett überarbeitet mit 21 Verbesserungen (Architektur, Gameplay, Security, i18n), Storage mit Animationen und Integration Tests erweitert, Picture Backend gehärtet.'
date: 2026-03-21
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'whopixels',
    'phaser',
    'game-dev',
    'refactoring',
    'storage',
    'picture',
    'security',
    'i18n',
    'mobile',
    'animations',
  ]
featured: true
commits: 7
readTime: 8
stats:
  filesChanged: 67
  linesAdded: 4949
  linesRemoved: 2880
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 7
workingHours:
  start: '2026-03-21T10:00'
  end: '2026-03-21T18:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Feature-reicher Tag über drei Projekte hinweg mit **7 Commits** und knapp **5.000 hinzugefügten Zeilen**: WhoPixels-Spiel komplett refactored (21 Verbesserungen), Storage mit Drag-Animationen und Integration Tests ausgebaut, Picture-Backend gehärtet.

- ✅ **WhoPixels** — Monolithische RPGScene (1210 Zeilen) in 8 Module aufgeteilt
- ✅ **WhoPixels** — 21 Verbesserungen: Sound, Persistenz, Mobile, i18n, Security, 26 NPCs
- ✅ **Storage** — Drag & Drop Animationen, Integration Tests, Dockerfile-Optimierung
- ✅ **Picture** — Dead Stores entfernt, Type-Check repariert, Testabdeckung +1064 Zeilen
- ✅ **Phaser** — Von 3.55.2 auf 3.80.1 migriert inkl. Particle-API-Breaking-Change

---

## 1. WhoPixels — Kompletter Refactor (21/21 Verbesserungen)

Das WhoPixels-Spiel (`games/whopixels/`) wurde systematisch überarbeitet. Aus einer einzigen 1210-Zeilen-Datei (`RPGScene.js`) entstand eine saubere, modulare Architektur:

### Neue Dateistruktur

```
js/
├── config/
│   ├── constants.js      # GAME_CONFIG — alle Magic Numbers zentralisiert
│   └── i18n.js           # Übersetzungssystem (DE/EN)
├── managers/
│   ├── WorldManager.js   # Welt-Generierung, Terrain, Hindernisse
│   ├── PlayerManager.js  # Spieler, Bewegung, Custom-Avatar-Support
│   ├── NPCManager.js     # NPC-Spawning, Interaktion, Enthüllung
│   ├── ChatUI.js         # Chat-Interface, API-Kommunikation
│   ├── StorageManager.js # LocalStorage-Persistenz, Statistiken
│   ├── SoundManager.js   # Web Audio API Synthesizer-Sounds
│   └── TouchControls.js  # Virtueller Joystick + Interact-Button
└── scenes/
    ├── RPGScene.js       # 82 Zeilen — nur noch Orchestrator
    ├── GameScene.js      # Pixel-Editor mit Avatar-Export
    ├── MainMenuScene.js  # Stats, Sprach-Umschalter
    └── BootScene.js      # Textur-Generierung + Avatar-Laden
```

### Architektur & Code-Qualität

| Vorher                           | Nachher                                 |
| -------------------------------- | --------------------------------------- |
| 1 Datei, 1210 Zeilen             | 12 Dateien, modulare Manager            |
| Magic Numbers überall            | `GAME_CONFIG` Objekt mit ~60 Konstanten |
| Kein Type-Safety                 | JSDoc-Typen + `jsconfig.json`           |
| Doppelter Code (`createTestNPC`) | Konsolidiert in `spawnNewNPC()`         |

### Gameplay-Features

**Persistenz** — `StorageManager` speichert entdeckte NPCs, Guess-Counter, Statistiken und Serien in LocalStorage. Fortschritt bleibt über Sessions erhalten.

**Sound** — `SoundManager` nutzt die Web Audio API für programmatische Sounds (kein Laden externer Dateien):

```javascript
playReveal() {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6 — Fanfare
    notes.forEach((freq, i) => {
        setTimeout(() => this._playTone(freq, 0.3, 'triangle', 0.25), i * 150);
    });
}
```

**26 NPCs** statt 10 — in drei Kategorien:

- **Erfinder** (1–10): da Vinci, Tesla, Curie, Edison, Lovelace, Archimedes, Gutenberg, Hopper, Bell, Lamarr
- **Wissenschaftler** (11–18): Einstein, Newton, Darwin, Galilei, Franklin, Hawking, Humboldt, Meitner
- **Künstler & Denker** (19–26): Mozart, Kahlo, Shakespeare, Cleopatra, Beethoven, Konfuzius, Hypatia, Kopernikus

**Pixel-Editor Integration** — Spieler können im Pixel-Editor einen 16×16 Avatar malen, als `custom_avatar` speichern und als Spieler-Sprite im RPG verwenden.

### Mobile & UX

**Touch-Controls** — `TouchControls` erkennt automatisch Touch-Geräte und zeigt:

- Virtueller Joystick (links) für Bewegung
- Interact-Button (rechts) für NPC-Gespräche

**Tutorial** — Interaktives Overlay beim ersten Spielstart mit angepassten Hinweisen (Desktop vs. Mobile).

**Chat-UI** — Typing-Indicator mit animierten Punkten, Chat-Historie (letzte 4 Nachrichten), bessere visuelle Struktur.

**Animations-Feedback** — Schwebendes `?` über NPCs in Interaktions-Reichweite mit Sinus-Animation.

### Server-Hardening

```
┌─────────────────────────────────────────────────────────┐
│                    server.js (vorher)                     │
│  ❌ CORS: Access-Control-Allow-Origin: *                 │
│  ❌ Kein Rate Limiting                                   │
│  ❌ Kein Input-Sanitization                              │
│  ❌ Kein Timeout                                         │
│  ❌ Unbegrenzte Conversation History                     │
│  ❌ Kein Path-Traversal-Schutz                           │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    server.js (nachher)                    │
│  ✅ CORS: Konfigurierbare ALLOWED_ORIGINS               │
│  ✅ Rate Limiting: 30 req/min pro IP                     │
│  ✅ Input-Sanitization: 2000 Zeichen, Control Chars      │
│  ✅ 15s AbortController Timeout                          │
│  ✅ Max 20 Conversation-Einträge                         │
│  ✅ Path-Traversal-Prevention                            │
│  ✅ 50KB Body-Size-Limit                                 │
│  ✅ Typ-Validierung aller Request-Felder                 │
└─────────────────────────────────────────────────────────┘
```

### i18n-Framework

Einfaches Übersetzungssystem mit `I18N.t('key', {params})`:

```javascript
I18N.t('youRevealed', { name: 'Tesla' });
// DE: "Du hast Tesla entlarvt!"
// EN: "You revealed Tesla!"
```

Sprach-Umschalter im Hauptmenü, Sprache wird in LocalStorage gespeichert.

### Phaser 3.55.2 → 3.80.1

Breaking Change bei der Particle-API migriert:

```javascript
// Vorher (3.55 — ParticleEmitterManager)
const particles = this.add.particles('particle');
const emitter = particles.createEmitter({ ... });

// Nachher (3.80 — direkter ParticleEmitter)
this._emitter = this.add.particles(0, 0, 'particle', {
    emitting: false, ...config
});
```

---

## 2. Storage — Animationen & Integration Tests

### Drag & Drop Animationen

FileCards und FolderCards haben jetzt visuelle Feedback-Animationen beim Drag & Drop:

- Scale-Animation beim Aufnehmen
- Transparenz-Änderung während des Ziehens
- Smooth-Return-Animation beim Loslassen

### Integration Tests

**+676 Zeilen** neue Integration Tests in `client-integration.test.ts` — decken die gesamte API-Client-Schicht ab.

### Dockerfile-Optimierung

Storage-Backend-Dockerfile wurde optimiert für schnellere Builds und kleinere Images.

### Audit Score

Storage Audit Score: **75 → 78** nach Animationen und Integration Tests.

---

## 3. Picture — Backend-Hardening

### Dead Stores entfernt

**12 ungenutzte Svelte Store-Dateien** gelöscht (1.315 Zeilen entfernt):

- `archive.svelte.ts`, `boards.svelte.ts`, `canvas.svelte.ts`
- `contextMenu.svelte.ts`, `explore.svelte.ts`, `generate.svelte.ts`
- `images.svelte.ts`, `models.svelte.ts`, `sidebar.svelte.ts`
- `tags.svelte.ts`, `ui.svelte.ts`, `view.svelte.ts`

### Test Coverage

**+1.064 Zeilen** neue Tests für `generate.service.spec.ts` — umfassende Testabdeckung für den Bildgenerierungs-Service.

### PWA & API

- PWA-Support hinzugefügt
- API-Timeouts konfiguriert
- Batch-Fix für parallele Generierungen
- Credit- und History-Endpoints erweitert

---

## 4. Infrastruktur

**GlitchTip Health Check** — `wget` durch `python3` ersetzt, da `wget` nicht im Container-Image vorhanden ist.

---

## Zusammenfassung

| Bereich    | Commits | Dateien              | +/-                 |
| ---------- | ------- | -------------------- | ------------------- |
| WhoPixels  | 2       | 18 neue + 7 geändert | +3.576 / -1.462     |
| Storage    | 2       | 6                    | +741 / -73          |
| Picture    | 2       | 22                   | +1.298 / -1.354     |
| Infra      | 1       | 1                    | +1 / -1             |
| **Gesamt** | **7**   | **67**               | **+4.949 / -2.880** |

## Nächste Schritte

1. **WhoPixels** — Multiplayer-Modus oder Leaderboard mit Backend-Anbindung
2. **Storage** — Audit Score weiter Richtung 85+ pushen
3. **Picture** — PWA testen und auf Produktion deployen
4. **Allgemein** — App-Onboarding-Wizards für die restlichen Apps aktivieren
