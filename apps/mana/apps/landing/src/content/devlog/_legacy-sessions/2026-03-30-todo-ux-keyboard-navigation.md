---
title: 'Todo: Notepad-Design & Keyboard-Navigation'
description: 'Komplettes Redesign der Todo-Liste als Notizblock mit durchgängiger Tastaturnavigation zwischen Tasks und QuickInputBar.'
date: 2026-03-30
author: 'Till Schneider'
category: 'feature'
tags: ['todo', 'ux', 'keyboard-navigation', 'contenteditable', 'design', 'accessibility', 'notepad']
featured: false
commits: 42
readTime: 5
stats:
  filesChanged: 834
  linesAdded: 25713
  linesRemoved: 10299
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 42
workingHours:
  start: '2026-03-30T09:00'
  end: '2026-03-30T18:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- Notizblock-Design mit liniertem Papier-Hintergrund und roter Margin-Linie
- Durchgängige Tastaturnavigation: Pfeiltasten, Tab, Shift+Tab zwischen allen Tasks
- contenteditable statt Input-Toggle: Cursor landet direkt an der Klick-Position
- Zirkuläre Navigation: QuickInputBar -> Tasks -> QuickInputBar
- Debug-Borders Modus (Ctrl+Shift+D) für UI-Debugging

## Notepad-Redesign

Die Todo-Homepage wurde von einer schmalen Card-Ansicht (560px) zu einem A4-breiten Notizblock (840px) umgebaut.

### Vorher

- Kleine weiße Card mit Box-Shadow auf grauem Hintergrund
- CollapsibleSection-Komponenten mit Toggle-Logik
- Task-Items mit Hover-Effekten (translateY, Hintergrundwechsel)
- Separate Input-Elemente für Titel-Bearbeitung (zwei Klicks nötig)

### Nachher

```
┌──────────────────────────────────────────────┐
│ ┃  Überfällig (2)                            │  ← Rote Margin-Linie
│ ┃  ○ Steuererklärung abgeben         Gestern │
│ ┃  ○ Zahnarzt anrufen                 25. Mär │
│ ┃─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  ← Gestrichelte Trenner
│ ┃  Heute (3)                                 │
│ ┃  ○ Meeting vorbereiten              Heute  │
│ ┃  ○ Code Review PR #42              Heute   │
│ ┃  ○ Einkaufen gehen                 Heute   │
│ ┃─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ ┃  ▼ Erledigt (5)                            │  ← Standardmäßig eingeklappt
└──────────────────────────────────────────────┘
     Linierter Hintergrund (Notizbuch-Linien)
```

**Design-Entscheidungen:**

| Aspekt        | Entscheidung                      | Grund                                          |
| ------------- | --------------------------------- | ---------------------------------------------- |
| Hintergrund   | Liniert (#fffef5) nur auf Sheet   | Papier-Metapher, Hauptbereich bleibt neutral   |
| Breite        | 840px (A4-ähnlich)                | Mehr Platz für lange Titel, Labels, Kontakte   |
| Sections      | Einfache Header statt Collapsible | Weniger UI-Noise, Sections sind immer relevant |
| Erledigt      | Eingeklappt mit Chevron-Toggle    | Aktive Tasks im Fokus                          |
| Drag-Handle   | Links außerhalb des Sheets        | Stört nicht, erscheint nur bei Hover           |
| Hover-Effekte | Komplett entfernt                 | Ruhigere UI, weniger visuelle Ablenkung        |

## Keyboard-Navigation

### Navigationsmodell

```
┌─────────────────────────────┐
│   QuickInputBar (unten)     │ ← ArrowUp / Tab
│   [Neue Aufgabe oder...]    │
└──────────┬──────────────────┘
           │ ↑ ArrowUp / Tab
           ▼ ↓ ArrowDown / Tab
┌─────────────────────────────┐
│   Task 1: Meeting vorber... │ ← contenteditable, Cursor an Klick-Position
│   Task 2: Code Review PR... │ ← ArrowDown / Tab → nächster Task
│   Task 3: Einkaufen gehen   │ ← ArrowDown → zurück zur QuickInputBar
└─────────────────────────────┘
```

### Tastatur-Befehle im Task-Titel

| Taste                       | Aktion                   |
| --------------------------- | ------------------------ |
| `ArrowDown` / `Tab`         | Nächster Task-Titel      |
| `ArrowUp` / `Shift+Tab`     | Vorheriger Task-Titel    |
| `Enter`                     | Speichern und Blur       |
| `Escape`                    | Änderungen verwerfen     |
| Am letzten Task `ArrowDown` | Zurück zur QuickInputBar |
| Am ersten Task `ArrowUp`    | Zurück zur QuickInputBar |

### Von QuickInputBar zu Tasks

| Taste     | Aktion                        |
| --------- | ----------------------------- |
| `ArrowUp` | Erster Task-Titel fokussieren |
| `Tab`     | Erster Task-Titel fokussieren |

### contenteditable statt Input-Toggle

**Vorher:** Klick auf Titel → `<span>` wird durch `<input>` ersetzt → zweiter Klick positioniert Cursor.

**Nachher:** Titel ist immer ein `<span contenteditable>` → ein Klick positioniert den Cursor sofort an der Maus-Position. Kein visueller Unterschied zwischen Lese- und Bearbeitungsmodus.

```svelte
<span
	class="task-title"
	contenteditable="true"
	onkeydown={handleTitleKeydown}
	onblur={handleTitleBlur}
>
	{task.title}
</span>
```

## Debug-Borders

Neues Entwickler-Tool: `Ctrl+Shift+D` aktiviert farbkodierte Outlines für alle UI-Elemente.

| Element          | Farbe   |
| ---------------- | ------- |
| `div`            | Rot     |
| `section`        | Blau    |
| `nav`            | Grün    |
| `button`         | Gelb    |
| `input/textarea` | Violett |
| `a`              | Pink    |
| `img/svg`        | Cyan    |

State wird in localStorage persistiert. Aktuell nur in der Todo-App, geplant als globales Shared-Package.

## Weitere Verbesserungen

| Bereich                | Vorher                   | Nachher                                 |
| ---------------------- | ------------------------ | --------------------------------------- |
| Task-Titel             | Einzeilig, abgeschnitten | Mehrzeilig mit word-break               |
| Checkbox-Alignment     | Vertikal zentriert       | Am Anfang der ersten Zeile (flex-start) |
| Mobile Bottom-Padding  | 150px                    | 100px                                   |
| Erledigt-Datum Opacity | 0.5 (zu blass)           | 0.7, Hover 1.0                          |
| Task-Hover             | translateY + Hintergrund | Kein Hover-Effekt                       |
| Titel-Input            | Border + Hintergrund     | Unsichtbar, gleiche Position            |

## Zusammenfassung

| Bereich             | Commits | Highlights                                      |
| ------------------- | ------- | ----------------------------------------------- |
| Notepad-Design      | ~15     | Liniertes Papier, A4-Breite, Section-Redesign   |
| Keyboard-Navigation | ~10     | Arrow/Tab zwischen Tasks, zirkulär mit InputBar |
| contenteditable     | ~5      | Direkte Cursor-Platzierung, kein Mode-Switch    |
| Debug-Borders       | ~3      | Ctrl+Shift+D, farbkodiert, localStorage         |
| Cleanup             | ~9      | Hover entfernt, Alignment, Opacity              |

## Nächste Schritte

- Debug-Borders als globales Shared-Package für alle Apps
- Keyboard-Navigation Pattern in andere Apps übertragen (Quotes, Contacts)
- Tastatur-Shortcut-Hilfe (? oder Ctrl+/) mit Overlay
