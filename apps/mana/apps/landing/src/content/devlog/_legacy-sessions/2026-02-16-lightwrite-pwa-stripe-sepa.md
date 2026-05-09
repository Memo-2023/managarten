---
title: 'LightWrite Launch, PWA für alle Apps & Stripe SEPA'
description: 'LightWrite Beat/Lyrics Editor als neue App, PWA Dependencies für alle 18 Web-Apps, Stripe SEPA Direct Debit, vereinfachtes Credit-System und Matrix Widget Support.'
date: 2026-02-16
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'lightwrite',
    'pwa',
    'stripe',
    'sepa',
    'subscriptions',
    'credits',
    'matrix',
    'calendar',
    'onboarding',
  ]
featured: false
commits: 35
readTime: 12
stats:
  filesChanged: 700
  linesAdded: 14200
  linesRemoved: 3800
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 35
workingHours:
  start: '2026-02-16T11:00'
  end: '2026-02-17T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Massiver Tag mit **35 Commits** – neuer App-Launch, Monetarisierung und PWA-Rollout:

- **LightWrite** - Beat/Lyrics Editor als Full-Stack App gelauncht
- **PWA** - Progressive Web App Dependencies für alle 18 Web-Apps
- **Stripe SEPA** - Direct Debit als Zahlungsoption
- **Subscriptions** - Unified ManaCore Subscription Plans
- **Credits** - System vereinfacht (Free Credits & B2B entfernt)
- **Matrix** - Widget Support und Room Settings Styling

---

## LightWrite Beat/Lyrics Editor

Komplett neue App für Musikproduktion – Beat-Making und Lyrics-Editing in einem Tool.

### Stack

| Layer       | Technologie | Details                    |
| ----------- | ----------- | -------------------------- |
| **Backend** | NestJS      | REST API, Audio Processing |
| **Web**     | SvelteKit   | Svelte 5 Runes, Tailwind   |
| **Landing** | Astro       | Marketing Page             |
| **Infra**   | Docker      | Dockerfile, Subdomains     |

### Features

- Beat Editor mit Timeline und Track-Layering
- Lyrics Editor mit Synchronisation
- STT Lyrics Transcription Integration
- CORS-Konfiguration für Cross-Origin Audio

### Infrastructure

```yaml
# docker-compose - LightWrite Services
lightwrite-backend:
  build: ./apps/lightwrite/apps/backend
  ports:
    - '3012:3012'

lightwrite-web:
  build: ./apps/lightwrite/apps/web
  ports:
    - '5190:5190'
```

### Subdomain Setup

```nginx
# lightwrite.mana.how → Web App
# api.lightwrite.mana.how → Backend API
```

---

## PWA für alle 18 Web-Apps

Progressive Web App Dependencies wurden zu allen SvelteKit Web-Apps hinzugefügt.

### Betroffene Apps

| App        | PWA Status   |
| ---------- | ------------ |
| ManaCore   | ✅ Aktiviert |
| Chat       | ✅ Aktiviert |
| Picture    | ✅ Aktiviert |
| Quotes     | ✅ Aktiviert |
| Calendar   | ✅ Aktiviert |
| Contacts   | ✅ Aktiviert |
| Todo       | ✅ Aktiviert |
| Clock      | ✅ Aktiviert |
| LightWrite | ✅ Aktiviert |
| Cards      | ✅ Aktiviert |
| Photos     | ✅ Aktiviert |
| Food       | ✅ Aktiviert |
| Mukke      | ✅ Aktiviert |
| Reader     | ✅ Aktiviert |
| Inventory  | ✅ Aktiviert |
| Storage    | ✅ Aktiviert |
| Traces     | ✅ Aktiviert |
| Context    | ✅ Aktiviert |

### Installation

```bash
# PWA Dependencies für SvelteKit
pnpm add @vite-pwa/sveltekit workbox-window -D
```

---

## Stripe SEPA Direct Debit

Neue Zahlungsoption für europäische Kunden.

### Payment Methods

| Methode              | Region | Status       |
| -------------------- | ------ | ------------ |
| **Kreditkarte**      | Global | ✅ Bestehend |
| **SEPA Lastschrift** | EU/EWR | ✅ Neu       |

### Implementation

```typescript
// services/mana-core-auth/src/stripe/stripe.service.ts
async createSEPASubscription(customerId: string, planId: string) {
  return this.stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: planId }],
    payment_settings: {
      payment_method_types: ['sepa_debit', 'card'],
    },
  });
}
```

---

## Unified Subscription Plans

ManaCore Subscription Plans als zentrale Verwaltung für alle Apps.

### Plan-Struktur

```
┌─────────────────────────────────────────────────┐
│  ManaCore Subscription Plans                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  Free     ████  Basis-Features, keine Credits   │
│  Starter  ████  100 Credits/Monat               │
│  Pro      ████  500 Credits/Monat               │
│  Business ████  2000 Credits/Monat              │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Credit-System Vereinfachung

Das Credit-System wurde gestrafft – Free Credits und B2B-Logik entfernt.

### Vorher vs. Nachher

| Aspekt       | Vorher            | Nachher  |
| ------------ | ----------------- | -------- |
| Free Credits | 50/Monat          | Entfernt |
| B2B Credits  | Eigene Verwaltung | Entfernt |
| Logik        | Komplex           | Einfach  |
| Code-Pfade   | 6                 | 2        |

---

## Organization Management

Neue Endpoints in mana-core-auth für Organisation-Verwaltung.

### Endpoints

```
POST   /api/v1/organizations          # Erstellen
GET    /api/v1/organizations           # Alle auflisten
GET    /api/v1/organizations/:id       # Details
PUT    /api/v1/organizations/:id       # Aktualisieren
DELETE /api/v1/organizations/:id       # Löschen
POST   /api/v1/organizations/:id/members  # Mitglied hinzufügen
```

---

## Matrix Widget Support

Matrix Room Settings mit Widget-Verwaltung und verbessertem Styling.

### Features

- Widget einbetten in Matrix Rooms
- Room Settings UI überarbeitet
- Konsistentes Styling mit ManaCore Design System

---

## App-Spezifisches Mini-Onboarding

Jede App kann jetzt einen eigenen Onboarding-Flow definieren.

### Konzept

```typescript
// Onboarding Config pro App
const onboardingSteps = {
	lightwrite: [
		{ title: 'Beats erstellen', component: BeatIntro },
		{ title: 'Lyrics schreiben', component: LyricsIntro },
	],
	calendar: [{ title: 'Kalender verbinden', component: CalendarSync }],
};
```

---

## Zusammenfassung

| Bereich           | Commits | Highlights                       |
| ----------------- | ------- | -------------------------------- |
| **LightWrite**    | 10      | Full-Stack App Launch            |
| **PWA**           | 5       | 18 Web-Apps mit PWA Support      |
| **Stripe/SEPA**   | 4       | SEPA Direct Debit Integration    |
| **Subscriptions** | 4       | Unified Plans                    |
| **Credits**       | 3       | Vereinfachung                    |
| **Organizations** | 3       | Auth Endpoints                   |
| **Matrix**        | 3       | Widgets & Room Settings          |
| **Calendar**      | 1       | ViewsBar Komponente              |
| **Onboarding**    | 2       | App-spezifisches Mini-Onboarding |

---

## Nächste Schritte

1. **LightWrite** - Audio-Export und Sharing-Features
2. **PWA** - Offline-Support und Push Notifications
3. **Subscriptions** - Upgrade/Downgrade Flow im UI
4. **Matrix Widgets** - Weitere Widget-Typen
