---
title: 'Bibliothek, Wetter, Voice-Interview, Research-Lab + AI-Hardening'
description: 'Zwei neue Module (Bibliothek + Wetter), Voice-Interview für das Profil-Modul mit 4 vorgerenderten Edge-TTS-Stimmen (DE/CH × m/f), Research-Lab Service mit 4 synchronen Agenten + Provider-Vergleich, Wünsche-Modul, Rituals-Rename, Credits Reserve/Commit/Refund, mana-tts Orpheus + Zonos Backends, 10 AI-Bugfixes.'
date: 2026-04-16
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'library',
    'wetter',
    'voice-interview',
    'tts',
    'edge-tts',
    'research-lab',
    'wishes',
    'rituals',
    'credits',
    'ai-hardening',
    'orpheus',
    'zonos',
  ]
featured: true
commits: 146
readTime: 20
stats:
  filesChanged: 938
  linesAdded: 52763
  linesRemoved: 11511
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 146
workingHours:
  start: '2026-04-16T08:00'
  end: '2026-04-16T23:59'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **Bibliothek-Modul** — Bücher, Filme, Serien, Comics mit Progress-Tracking, CRUD, Grid-View
- **Wetter-Modul** — Open-Meteo + DWD-Warnungen + Regen-Nowcast + Multi-Model-Vergleich
- **Voice-Interview** — Profil-Interview per Sprache: 92 vorgerenderte MP3s (4 Stimmen × 23 Fragen), Voice/Gesprächs-Modus mit Auto-Save
- **Research-Lab** — Neuer mana-research Service mit 4 synchronen Agenten + Provider-Vergleichs-UI
- **Wünsche-Modul** — Wunschlisten mit Preis-Tracking
- **mana-tts** — Orpheus + Zonos TTS-Backends installiert auf GPU-Server
- **AI-Hardening** — P0/P1/P2 Bugfix-Batches: Tool-Exception-Handling, Mission-Mutex, N+1 Queries, Vault-Guard
- **Credits** — 2-Phase Debit (Reserve/Commit/Refund)

---

## Bibliothek-Modul

Neues Modul für Medien-Tracking:

### Milestone 1: Foundation

- Dexie-Tabellen für `libraryItems` mit Typ-Discriminator (Buch/Film/Serie/Comic)
- Workbench-App registriert in der Kreativ-Kategorie

### Milestone 2: CRUD + Views

- **Erstell-Formular** als Inline-Accordion (kein Modal)
- **Grid-View** mit Cover-Thumbnails + Status-Badge
- **Detail-View** mit allen Metadaten

### Milestone 3: Progress-Tracking

- **Seiten** für Bücher (aktuell/gesamt)
- **Episoden** für Serien (Staffel × Episode)
- **Issues** für Comics
- **Restart**: Abgeschlossenes Werk nochmal starten

UI-Fixes: Labels lesbar gemacht, Suche nach oben verschoben, Page-H1 entfernt.

---

## Wetter-Modul

Vollständiges Wetter-Modul mit Open-Meteo als Datenquelle:

- **Open-Meteo API** — kostenlos, kein API-Key, DSGVO-konform
- **DWD-Warnungen** — Deutsche Wetterwarnungen integriert
- **Regen-Nowcast** — Niederschlagsvorhersage für die nächsten 2 Stunden
- **Multi-Model-Vergleich** — Seite zeigt verschiedene Wettermodelle nebeneinander
- **Location-Management** — Orte speichern, löschen, Default setzen
- **Workbench-Integration** — ListView mit Scroll-Chips für Orte

Fixes nach dem ersten Build:

- Routes vor Auth-Middleware mounten (öffentliche Wetter-Daten brauchen kein Auth)
- Icons für Detail-Grid (Wind, Luftfeuchtigkeit, Druck, UV)
- Design: Scroll-Chips, Hierarchie, Duplikat-Bereinigung

---

## Voice-Interview für das Profil

Das Profil-Interview kann jetzt per Sprache durchgeführt werden:

### Audio-Generierung

92 MP3-Dateien vorgerendert via Edge TTS:

| Stimme    | Voice-ID | Sprache                    |
| --------- | -------- | -------------------------- |
| Seraphina | `de-f`   | Deutsch, weiblich          |
| Florian   | `de-m`   | Deutsch, männlich          |
| Leni      | `ch-f`   | Schweizerdeutsch, weiblich |
| Jan       | `ch-m`   | Schweizerdeutsch, männlich |

23 Interview-Fragen × 4 Stimmen = 92 Dateien, 1.4 MB total in `static/audio/interview/`.

### Interview-Hero

Neuer prominenter Block auf der Profil-Übersicht mit 3 Start-Modi:

- **Per Text** — Fragen lesen und tippen (wie bisher)
- **Per Sprache** — Frage wird vorgelesen, dann Mic aktiv für die Antwort
- **Als Gespräch** — Fließender Flow: Vorlesen → Mic → Auto-Save → nächste Frage

### TTS-System

`useInterviewTts()` spielt vorgerenderte MP3s über `new Audio()`. Voice-Auswahl wird in localStorage gespeichert. Web Speech API als Fallback für fehlende Audio-Dateien.

### STT-Integration

`useLocalStt()` (Whisper, WebGPU) für die Antwort-Transkription. Mic-Button an jedem text/textarea/tags Input. Conversation-Mode: Auto-Save nach 600ms, dann nächste Frage.

---

## mana-tts: Orpheus + Zonos Backends

Zwei neue TTS-Modelle auf dem GPU-Server installiert:

### Orpheus TTS

- **Modell**: `Kartoffel_Orpheus-3B_german_natural` (Deutsch-Finetune)
- **VRAM**: ~8 GB
- **Endpoint**: `POST /synthesize/orpheus`
- **Status**: Gated Repository — HuggingFace-Approval nötig

### Zonos TTS (Zyphra)

- **Modell**: `Zyphra/Zonos-v0.1-transformer` (200k Stunden Training)
- **VRAM**: ~5 GB
- **Endpoint**: `POST /synthesize/zonos`
- **Features**: Emotions-Steuerung (neutral/friendly/warm/curious), Speaking Rate, Pitch
- **Status**: Installiert und funktional, aber Qualität für kurze deutsche Sätze noch nicht optimal (kein Speaker-Embedding → inkonsistente Stimme)

### Infrastruktur

- espeak-ng auf dem GPU-Server installiert (Phonemizer-Dependency)
- `TORCHDYNAMO_DISABLE=1` gesetzt (kein MSVC-Compiler auf Windows)
- Vergleichs-Script `scripts/compare-german-tts.sh`

---

## Research-Lab

Neuer Service `mana-research` für parallele AI-Recherche:

### Phase 1-2: Service + API

- Hono/Bun Service
- Parallel-Query über mehrere LLM-Provider

### Phase 3: 4 synchrone Agenten

Vier Agenten recherchieren gleichzeitig zum selben Thema:

- Verschiedene Perspektiven und Quellen
- Ergebnisse werden zusammengeführt

### Phase 4: Provider-Vergleichs-UI

Side-by-side Vergleich der Antworten verschiedener Provider im Frontend.

---

## Wünsche-Modul

Neues Modul `wishes` für Wunschlisten:

- Wünsche mit Titel, Beschreibung, Preis, URL, Priorität
- Preis-Tracking über Zeit
- Kategorisierung + Tags

---

## AI-Hardening: 3 Bugfix-Batches

### P0 — Kritisch

- **Tool Exception Handling**: Uncaught Exceptions in AI-Tools crashten den Runner
- **Mission Run Mutex**: Zwei gleichzeitige Runs derselben Mission verhindert

### P1 — Hoch

- **N+1 Queries**: Workbench-Timeline lud jede Iteration einzeln
- **Vault-Locked Guard**: AI-Tools crashten wenn der Vault gesperrt war
- **Debug Hardening**: Debug-Log schrieb in die falsche Tabelle
- **Timeout**: Runner-Timeout war zu kurz für komplexe Missions

### P2 — Medium

- **Prompt Sync**: Planner-Prompt war out-of-sync mit dem Tool-Katalog
- **Perf**: Unnötige Re-Renders in der Workbench-Timeline
- **Dedup**: Doppelte Proposals bei schnellen Re-Runs
- **Scope Unification**: Agent-Scope und Scene-Scope waren inkonsistent

---

## Credits: 2-Phase Debit

Credits-System bekommt Reserve/Commit/Refund:

```
Reserve(100) → Credits blockiert, nicht abgebucht
  ↓ Aktion erfolgreich
Commit(100) → Credits endgültig abgebucht
  ↓ Aktion fehlgeschlagen
Refund(100) → Reservierung aufgehoben
```

Verhindert doppelte Abbuchungen bei Retry-Szenarien.

---

## Sonstige Features + Fixes

| Bereich         | Was                                                               |
| --------------- | ----------------------------------------------------------------- |
| Rituals         | Rename ai-rituals → rituals, Ceremony Step Types                  |
| LLM Errors      | User-friendly Messages + Settings-Link bei Tier-Fehlern           |
| Workbench       | Inline Module Help (? Icon), ?app= Deep-Links reaktiv             |
| Settings        | Anchor Deep-Links reaktiv                                         |
| Mobile          | Text-Selection auf List-Rows disabled für Long-Press Context Menu |
| Docker          | Deleted subscriptions Package + shared-ai zu sveltekit-base       |
| Devlogs         | Apr 9-15 nachgetragen                                             |
| MODULE_REGISTRY | Index aller 72+ Module                                            |
| pre-push Hook   | --fail-on-warnings entfernt                                       |

---

## Numbers

|                         |                                   |
| ----------------------- | --------------------------------- |
| Commits                 | 146                               |
| Files changed           | 938                               |
| LOC added               | ~52.760                           |
| LOC removed             | ~11.510                           |
| Net                     | +41.250                           |
| Neue Module             | 3 (Bibliothek, Wetter, Wünsche)   |
| TTS-Stimmen             | 4 (Seraphina, Florian, Leni, Jan) |
| Interview-Audio-Dateien | 92                                |
| AI-Bugfixes             | 10 (3×P0, 4×P1, 3×P2)             |

---

## Lehren

1. **Vorgerenderte Audio > Live-TTS für statische Inhalte**: Edge TTS liefert konsistente Qualität, 1.4 MB für 92 Dateien ist vernachlässigbar, und es funktioniert offline. Zonos (selbst-gehostet) klingt bei kurzen Sätzen ohne Speaker-Embedding inkonsistent.

2. **AI-Tool-Exceptions müssen gefangen werden**: Ein einzelnes Tool das eine Exception wirft darf nicht den ganzen Mission-Runner crashen. Defensive try/catch um jeden Tool-Call ist Pflicht.

3. **Reserve/Commit/Refund > direktes Debit**: Bei AI-Operationen die fehlschlagen können, ist 2-Phase-Debit die einzig korrekte Lösung. Sonst verlieren User Credits für fehlgeschlagene Operationen.
