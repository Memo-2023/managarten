---
title: 'UI-Redesign: Wallpaper-System, FloatingInputBar, PillNav Fullscreen + 4 neue Module'
description: 'Großes UI-Redesign mit Wallpaper-System, sticky PageHeader, FloatingInputBar für 7 Module, PillNav Bar-Mode mit Fullscreen + Local STT, Drink-Modul, Landing /features Page, App-Icon-Refresh für 12 Module, planta → plants Rename.'
date: 2026-04-12
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'ui',
    'wallpaper',
    'floating-input',
    'pillnav',
    'fullscreen',
    'local-stt',
    'drink',
    'landing',
    'features',
    'icons',
    'moodlit',
  ]
featured: true
commits: 18
readTime: 10
stats:
  filesChanged: 232
  linesAdded: 8415
  linesRemoved: 2447
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 18
workingHours:
  start: '2026-04-12T12:00'
  end: '2026-04-12T20:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Wallpaper-System** + sticky PageHeader — individualisierbare Hintergrundbilder für die App
- **FloatingInputBar** — geteilte Floating-Input-Komponente, 7 Module migriert
- **PillNav Bar Mode** mit Fullscreen, Local STT + Mic-Button
- **Drink-Modul** — Getränke-Tracking mit Inline-Editing
- **Moodlit Fullscreen** — Mood auf Klick als Fullscreen-Visual
- **Landing /features Page** — USP-Seite mit Simple/Tech-Toggle
- **App-Icons Refresh** für 12 Module
- **planta → plants Rename** über die ganze Codebase

---

## Wallpaper-System + Sticky PageHeader

Neues visuelles Feature: Users können ein Hintergrundbild für die App setzen.

- **Wallpaper-Auswahl**: Mehrere vorinstallierte Wallpapers + Custom-Upload
- **Sticky PageHeader**: Der Seitentitel bleibt beim Scrollen oben fixiert — mit leichtem Blur-Effekt über dem Wallpaper
- **Theme-Token-Integration**: Hardcoded weiße Textfarben entfernt, alle Texte nutzen jetzt Theme-Tokens für Light/Dark-Mode Kompatibilität

---

## FloatingInputBar — Shared Component für 7 Module

Statt jedes Modul seinen eigenen Input-Bar implementieren zu lassen, gibt es jetzt eine geteilte `FloatingInputBar`-Komponente:

- **Floating Design**: Bar schwebt über dem Content, fixiert am unteren Rand
- **Module-agnostisch**: Jedes Modul gibt nur Placeholder-Text und einen `onSubmit`-Handler

Migrierte Module:

1. Todo (minimal ListView-Redesign)
2. Notes
3. Contacts
4. Calendar
5. Inventory
6. Habits
7. Journal

Der Todo-ListView wurde im gleichen Zug redesigned — cleaner, weniger visuelles Rauschen.

---

## PillNav Bar Mode + Fullscreen + Local STT

Die PillNav-Leiste bekommt drei große Features:

### Bar Mode

Neuer kompakter Bar-Modus als Alternative zum Pill-Layout. Weniger Platz, gleiche Funktionalität.

### Fullscreen

Fullscreen-Toggle direkt in der PillNav — die App nimmt den ganzen Bildschirm ein, PillNav und PageHeader verschwinden für immersives Arbeiten.

### Local STT + Mic-Button

Ein Mic-Button in der PillNav startet lokale Speech-to-Text via `@mana/local-stt` (Whisper, WebGPU):

- STT-Routing: Wenn das lokale Whisper-Modell geladen ist → alles lokal, kein Server-Call
- Fallback: Wenn kein lokales Modell → Server-STT via mana-stt
- Docker-Fix: `local-stt` Package in das mana-web Dockerfile kopiert

---

## Drink-Modul

Neues Modul `drink` für Getränke-Tracking:

- **Beverage-Typen**: Wasser, Kaffee, Tee, Saft, Alkohol, ... mit Icons
- **Inline-Editing**: Menge + Typ direkt in der Liste änderbar
- **Tages-Übersicht**: Gesamtmenge pro Tag mit Fortschrittsbalken
- **Workbench-Integration**: ListView mit Quick-Add

---

## Moodlit Fullscreen

Das Moodlit-Modul bekommt ein visuelles Upgrade:

- **Fullscreen on Click**: Mood-Card klicken → Mood als Fullscreen-Visual mit Gradient-Background
- **Visual Card Redesign**: Mood-Cards mit kräftigeren Farben und besserer Typografie

---

## Landing: /features USP-Page

Neue Seite auf der Astro-Landing:

- **Simple/Tech Toggle**: Visitors können zwischen einer einfachen und einer technischen Beschreibung wechseln
- **Feature-Übersicht**: Alle Module mit Kurzbeschreibung
- **Style-Fixes**: Star-Ratings durch fließenden Text ersetzt, Flow-Links subtiler (Underline statt Pills), generische Tool-Kategorien statt Brand-Namen

---

## App-Icons + i18n

- **12 Module** mit neuen App-Icons
- **Fehlende i18n-Labels** nachgetragen
- **PillNav**: Compact Nav mit User-Menu Overlay Panel

---

## planta → plants Rename

Modul-Rename `planta` → `plants` über die gesamte Codebase:

- Routes, Imports, Collections, Branding, i18n Keys
- Codebase-Cleanup von Resten des alten Namens

---

## Sonstige Fixes

| Fix           | Detail                                                   |
| ------------- | -------------------------------------------------------- |
| Auth Token    | `getValidToken()` statt `getAccessToken()` für API-Calls |
| Calc          | Safe-Evaluate-Engine in ListView + Error-Logging         |
| Calendar A11y | Event-Rows als `<button>` für Keyboard-Navigation        |
| Light Mode    | Hardcoded White Text entfernt, Theme-Tokens verwendet    |

---

## Numbers

|                             |           |
| --------------------------- | --------- |
| Commits                     | 18        |
| Files changed               | 232       |
| LOC added                   | ~8.415    |
| LOC removed                 | ~2.447    |
| Net                         | +5.968    |
| Neue Module                 | 1 (Drink) |
| Module mit FloatingInputBar | 7         |
| App-Icon-Updates            | 12        |

---

## Lehren

1. **Shared UI-Components > per-module Kopien**: Die FloatingInputBar spart ~50 LOC pro Modul. Bei 7 Modulen sind das 350 LOC weniger zu maintainen — und jeder Fix wirkt überall.

2. **Local STT als Privacy-Default**: Wenn das Modell geladen ist, verlassen keine Audio-Daten das Gerät. Die Server-Fallback-Option gibt's trotzdem, aber der Default ist privacy-first.
