---
title: 'spiral-db, Planta Bot & Mana Values'
description: 'spiral-db Pixel-Visualisierung, Planta Bot für Pflanzenidentifikation, Food Bot Verbesserungen, Mana Values Manifest und diverse Docker-Fixes.'
date: 2026-02-17
author: 'Till Schneider'
category: 'feature'
tags: ['spiral-db', 'planta', 'food', 'todo', 'mana-bot', 'wallpaper', 'documentation']
featured: false
commits: 26
readTime: 10
stats:
  filesChanged: 520
  linesAdded: 10400
  linesRemoved: 2800
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 26
workingHours:
  start: '2026-02-17T11:00'
  end: '2026-02-18T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).


Produktiver Tag mit **26 Commits** – neue Packages, Bot-Features und Dokumentation:

- **spiral-db** - Pixel-basierte Spiral-Datenbank-Visualisierung
- **Planta Bot** - KI-Pflanzenidentifikation per Bild-Upload
- **Food Bot** - Smartes Meal Feedback
- **Mana Bot** - Tägliche Morgenzusammenfassung
- **Mana Values** - Manifest-Dokumentation
- **Wallpaper Generator** - Neues Package

---

## spiral-db Package

Neues Package für pixel-basierte Spiral-Datenbank-Visualisierung – Daten werden in einer Spiralform dargestellt.

### Konzept

```
┌─────────────────────────────────────────────┐
│  spiral-db Visualisierung                    │
├─────────────────────────────────────────────┤
│                                              │
│           ██ ██ ██ ██                       │
│         ██           ██                     │
│       ██    ██ ██      ██                   │
│       ██  ██     ██    ██                   │
│       ██  ██  ●  ██    ██                   │
│       ██  ██     ██    ██                   │
│       ██    ██ ██      ██                   │
│         ██           ██                     │
│           ██ ██ ██ ██                       │
│                                              │
│  Jeder Pixel = ein Datenpunkt               │
│  Spirale = zeitlicher Verlauf               │
│                                              │
└─────────────────────────────────────────────┘
```

### API

```typescript
import { SpiralDB } from '@manacore/spiral-db';

const spiral = new SpiralDB({
  width: 512,
  height: 512,
  pixelSize: 4,
});

// Daten hinzufügen
spiral.add({ timestamp: Date.now(), value: 42 });

// Als PNG exportieren
const png = spiral.toPNG();
```

---

## Todo App: spiral-db Integration

Die Todo-App nutzt spiral-db zur Visualisierung erledigter Aufgaben.

### Features

| Feature            | Beschreibung                          |
| ------------------ | ------------------------------------- |
| **Spiral View**    | Erledigte Tasks als Spiral-Pixel      |
| **PNG Import**     | Bestehende Spiralen importieren       |
| **Farbkodierung**  | Prioritäten als Pixel-Farben          |
| **Export**         | Spiral als Bild exportieren           |

---

## Planta Bot

KI-gestützte Pflanzenidentifikation per Bild-Upload – als Docker-Service deployed.

### Architektur

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Matrix Chat │────>│  Planta Bot  │────>│  Vision LLM  │
│  (Bild-Upload)│    │  (Docker)    │     │  (mana-llm)  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
       │  Bild senden       │  Analyse            │
       │                    │  anfragen           │
       │<───────────────────│                     │
       │  Pflanzeninfo      │<────────────────────│
       │  + Pflegetipps     │  Identifikation     │
```

### Response Format

```json
{
  "plant": "Monstera deliciosa",
  "commonName": "Fensterblatt",
  "confidence": 0.94,
  "care": {
    "water": "Mäßig, Erde antrocknen lassen",
    "light": "Helles indirektes Licht",
    "temperature": "18-27°C"
  },
  "health": "Gesund, leichte Staubablagerungen auf Blättern"
}
```

### Docker Deployment

```bash
# Planta Bot starten
docker compose -f docker-compose.macmini.yml up -d planta-bot
```

---

## Food Bot Verbesserungen

Smartes Meal Feedback mit positiven Aspekten und Verbesserungsvorschlägen.

### Vorher vs. Nachher

| Aspekt          | Vorher              | Nachher                     |
| --------------- | ------------------- | --------------------------- |
| **Feedback**    | Nur Nährwerte       | Positiv + Verbesserungen    |
| **Ton**         | Neutral             | Ermutigend                  |
| **Vorschläge**  | Keine               | Konkrete Alternativen       |
| **Format**      | Tabelle             | Strukturierter Text         |

### Beispiel-Feedback

```
✅ Positiv:
- Gute Proteinquelle durch Hühnchen
- Gemüseanteil liefert Vitamine A und C

💡 Verbesserungen:
- Vollkornreis statt weißem Reis für mehr Ballaststoffe
- Olivenöl statt Butter zum Anbraten
```

---

## Mana Bot: Morning Summary

Tägliche Morgenzusammenfassung mit den wichtigsten Infos für den Tag.

### Inhalt

| Bereich         | Datenquelle      |
| --------------- | ---------------- |
| **Kalender**    | Calendar API     |
| **Todos**       | Todo API         |
| **Wetter**      | Weather Service  |
| **Nachrichten** | News Aggregation |

### Beispiel

```
☀️ Guten Morgen, Till!

📅 Heute: 3 Termine
  09:00 - Daily Standup
  14:00 - Design Review
  16:30 - Zahnarzt

✅ Offene Todos: 5
  🔴 2 Priorität Hoch
  🟡 3 Priorität Mittel

🌤️ Berlin: 12°C, teilweise bewölkt
```

---

## ManaCore: QR Code Export

Neue QR-Code-Export-Funktion auf der My-Data Seite.

### Implementation

```svelte
<script lang="ts">
  import { QRCode } from '$lib/components/QRCode.svelte';

  let userData = $state({
    name: 'Till Schneider',
    email: 'till@mana.how',
    profileUrl: 'https://mana.how/u/till',
  });
</script>

<QRCode data={userData.profileUrl} size={256} />
<button onclick={() => downloadQR()}>QR Code herunterladen</button>
```

---

## Wallpaper Generator Package

Neues Package zur programmatischen Generierung von Wallpapers.

### Features

- Generative Patterns (Noise, Gradients, Geometrie)
- Konfigurierbare Auflösungen (Mobile, Desktop, 4K)
- Export als PNG/JPEG

---

## Mana Values Manifest

Dokumentation der Kernwerte des ManaCore-Ökosystems.

### Werte

| Wert              | Beschreibung                            |
| ----------------- | --------------------------------------- |
| **Privacy First** | Daten gehören dem Nutzer                |
| **Open Source**   | Transparenz durch offenen Code          |
| **Self-Hosted**   | Volle Kontrolle über eigene Instanz     |
| **Offline-First** | Apps funktionieren ohne Internet        |
| **Interop**       | Standards statt Lock-in (Matrix, CalDAV)|

---

## PillNavigation Vereinfachung

Sidebar-Mode aus der PillNavigation entfernt – nur noch Bottom-Navigation.

### Vorher

```
┌────────────┬────────────────────────┐
│ Sidebar    │                        │
│ ████       │     Content            │
│ ████       │                        │
│ ████       │                        │
└────────────┴────────────────────────┘
```

### Nachher

```
┌─────────────────────────────────────┐
│                                      │
│            Content                   │
│                                      │
├─────────────────────────────────────┤
│    ██    ██    ██    ██    ██       │
└─────────────────────────────────────┘
```

---

## Zusammenfassung

| Bereich            | Commits | Highlights                        |
| ------------------ | ------- | --------------------------------- |
| **spiral-db**      | 5       | Package + Todo Integration        |
| **Planta Bot**     | 4       | KI-Pflanzenidentifikation         |
| **Food Bot**   | 3       | Smartes Meal Feedback             |
| **Mana Bot**       | 3       | Morning Summary                   |
| **QR Code**        | 2       | My-Data Export                    |
| **Wallpaper**      | 2       | Generator Package                 |
| **Mana Values**    | 2       | Manifest Dokumentation            |
| **PillNavigation** | 2       | Sidebar entfernt                  |
| **Docker/Fixes**   | 3       | Planta, ManaCore, Todo, LightWrite|

---

## Nächste Schritte

1. **spiral-db** - Interaktive Web-Visualisierung
2. **Planta Bot** - Pflanzenpflege-Erinnerungen
3. **Mana Bot** - Abend-Summary mit Tagesrückblick
4. **Wallpaper** - AI-generierte Wallpapers via Picture
