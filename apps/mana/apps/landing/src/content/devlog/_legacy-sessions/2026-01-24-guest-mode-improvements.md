---
title: 'Guest Mode Verbesserungen für Clock & Contacts'
description: 'Session-first Guest Mode für Contacts und diverse Guest-Mode-Fixes für Clock App. Behebung von Auth-Redirect und undefined Errors.'
date: 2026-01-24
author: 'Till Schneider'
category: 'bugfix'
tags: ['guest-mode', 'clock', 'contacts', 'session-storage', 'authentication', 'ux']
featured: false
commits: 4
readTime: 3
stats:
  filesChanged: 17
  linesAdded: 591
  linesRemoved: 156
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 4
workingHours:
  start: '2026-01-24T11:00'
  end: '2026-01-25T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Fokussierter Tag mit **4 Commits** zur Verbesserung des Guest-Mode-Erlebnisses:

- **Clock Guest Mode** - Alarms/Timers ohne Auth-Redirect ladbar
- **Contacts Session-First** - Neuer Guest-Mode-Ansatz mit Session-Storage
- **Bugfixes** - undefined Error bei userSettings.nav behoben

---

## Clock App Guest Mode Fixes

Zwei kritische Fixes für das Clock App Guest-Erlebnis:

### Alarms/Timers in Guest Mode

```typescript
// Vorher: Daten wurden nur für eingeloggte User geladen
// Nachher: Guest Mode lädt aus localStorage
if (!session) {
	// Load from localStorage for guest mode
	alarms = loadAlarmsFromLocalStorage();
	timers = loadTimersFromLocalStorage();
}
```

### Auth Redirect entfernt

Das Dashboard war für Gäste unzugänglich, da ein Auth-Redirect vorhanden war:

| Vorher               | Nachher                     |
| -------------------- | --------------------------- |
| Redirect zu `/login` | Dashboard direkt zugänglich |
| Daten nicht geladen  | LocalStorage-Fallback       |

---

## Contacts Session-First Guest Mode

Neues Feature für die Contacts App: Session-first Guest Mode ermöglicht es Nutzern, die App sofort zu testen ohne Registrierung.

### Architektur

```
┌─────────────────────────────────────────────────────┐
│                  Contacts App                        │
├─────────────────────────────────────────────────────┤
│  1. Check Auth Session                              │
│     ├─ Session vorhanden → Supabase-Daten laden    │
│     └─ Keine Session → SessionStorage verwenden    │
│                                                      │
│  2. Guest Mode Features                              │
│     ├─ Kontakte erstellen/bearbeiten               │
│     ├─ Gruppen verwalten                           │
│     └─ Alles lokal gespeichert                     │
│                                                      │
│  3. Upgrade-Pfad                                    │
│     └─ Bei Registrierung: Daten zu Supabase sync   │
└─────────────────────────────────────────────────────┘
```

### Implementation

- **545 neue Zeilen** für Session-Storage-Integration
- Automatischer Sync bei späterer Registrierung
- Keine Daten gehen verloren

---

## Bugfixes

| Fix                          | Beschreibung                                   |
| ---------------------------- | ---------------------------------------------- |
| `userSettings.nav undefined` | Guard für undefined userSettings in Guest Mode |
| Auth Redirect Dashboard      | Entfernt für Guest-Zugänglichkeit              |
| Alarms nicht geladen         | LocalStorage-Fallback hinzugefügt              |

---

## Zusammenfassung

| Bereich              | Commits | Highlights              |
| -------------------- | ------- | ----------------------- |
| **Clock Fixes**      | 2       | Guest Mode funktional   |
| **Contacts Feature** | 1       | Session-first Ansatz    |
| **Web Fixes**        | 1       | undefined Error behoben |

---

## Nächste Schritte

1. **Guest Mode für weitere Apps** ausrollen
2. **Sync-Logik** für Guest → Auth Übergang verfeinern
3. **Onboarding Flow** für Guest-Nutzer optimieren
