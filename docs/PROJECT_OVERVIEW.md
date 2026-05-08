# Manacore Monorepo - Projektübersicht

Dieses Dokument bietet eine umfassende Übersicht über alle Projekte im Manacore Monorepo.

## Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Projekte](#projekte)
   - [Maerchenzauber](#maerchenzauber)
   - [Manacore](#mana)
   - [Cardecky](#cardecky)
   - [Memoro](#memoro)
   - [Picture](#picture)
   - [uLoad](#uload)
   - [Chat](#chat)
   - [Food](#food)
3. [Shared Packages](#shared-packages)
4. [Technologie-Stack](#technologie-stack)
5. [Entwicklung](#entwicklung)
6. [Ideen für zukünftige Apps](#ideen-für-zukünftige-apps)
   - [Produktivität & Wissensmanagement](#kategorie-1-produktivität--wissensmanagement)
   - [Kreativität & Content](#kategorie-2-kreativität--content)
   - [Bildung & Lernen](#kategorie-3-bildung--lernen)
   - [Gesundheit & Wellness](#kategorie-4-gesundheit--wellness)
   - [Business & Finanzen](#kategorie-5-business--finanzen)
   - [Kommunikation & Social](#kategorie-6-kommunikation--social)
   - [Developer Tools](#kategorie-7-developer-tools)
   - [Entertainment & Lifestyle](#kategorie-8-entertainment--lifestyle)
   - [Priorisierungsmatrix](#priorisierungsmatrix)

---

## Übersicht

Das Manacore Monorepo ist eine Sammlung von mehreren eigenständigen Anwendungen, die gemeinsame Infrastruktur, Authentifizierung und UI-Komponenten teilen. Alle Projekte nutzen ein einheitliches Credit-System (Mana) und eine zentrale Authentifizierung.

### Schnellstart

```bash
# Node.js 20+ und pnpm 9.15.0+ erforderlich
pnpm install

# Alle Projekte starten
pnpm run dev

# Einzelnes Projekt starten
pnpm run maerchenzauber:dev
pnpm run mana:dev
pnpm run cards:dev
pnpm run memoro:dev
pnpm run picture:dev
pnpm run uload:dev
pnpm run food:dev
```

---

## Projekte

### Maerchenzauber

**AI-gestützte Kindergeschichten-Generierung**

Maerchenzauber ist eine magische Geschichten-App für Kinder, die mithilfe von KI personalisierte Geschichten mit benutzerdefinierten Charakteren erstellt.

#### Features

- KI-gestützte Geschichtenerstellung mit konsistenten Charakteren
- Benutzerdefinierte Charaktergenerierung aus Beschreibungen oder Fotos
- Mehrseitige illustrierte Geschichten (10 Seiten)
- Credit-basiertes System (10 Credits pro Geschichte)
- Mehrsprachig (Deutsch/Englisch)
- System-Charaktere (z.B. "Finia" der weise Fuchs)

#### Tech-Stack

| Komponente | Technologie                                           |
| ---------- | ----------------------------------------------------- |
| Backend    | NestJS (Port 3002)                                    |
| Mobile     | React Native + Expo                                   |
| Web        | SvelteKit                                             |
| Landing    | Astro                                                 |
| KI         | Azure OpenAI (GPT-4), Google Gemini, Replicate (Flux) |
| Datenbank  | Supabase (PostgreSQL)                                 |
| Storage    | Supabase Storage                                      |

#### Projektstruktur

```
maerchenzauber/
├── apps/
│   ├── backend/      # NestJS API Server
│   ├── mobile/       # Expo React Native App
│   ├── web/          # SvelteKit Web App
│   └── landing/      # Astro Landing Page
```

#### Entwicklung

```bash
# Backend starten
cd maerchenzauber/apps/backend && npm run dev

# Mobile App starten
cd maerchenzauber/apps/mobile && npm run dev

# Web App starten
cd maerchenzauber/apps/web && npm run dev
```

---

### Manacore

**Multi-App Ecosystem Platform**

Manacore ist die zentrale Plattform für Organisations-Management, Team-Kollaboration und Credit-Transfers. Es dient als Authentifizierungs-Hub für alle anderen Anwendungen.

#### Features

- Einheitliche Authentifizierung mit Supabase
- Organisations-Management mit rollenbasiertem Zugriff
- Team-Kollaboration und Mitgliederverwaltung
- Mana Credit-System mit Transfers und Bilanz-Tracking
- Multi-Brand Support mit konfigurierbaren Themes
- Cross-Platform (Web, iOS, Android)
- Echtzeit-Updates

#### Unterstützte Apps

- **Memoro** - Sprachaufnahmen und Memory-Management
- **Cardecky** - KI-gestützte Lernkarten
- **Storyteller** - Kreatives Schreiben mit KI
- **Mana** - Zentrale Account- und Organisationsverwaltung

#### Tech-Stack

| Komponente | Technologie                    |
| ---------- | ------------------------------ |
| Web        | SvelteKit 2 + Svelte 5 (Runes) |
| Mobile     | Expo 52 + React Native 0.76    |
| Styling    | TailwindCSS / NativeWind       |
| Auth       | Supabase Auth mit SSR          |
| Testing    | Vitest + Playwright            |

#### Projektstruktur

```
mana/
├── apps/
│   ├── web/          # SvelteKit Web App
│   ├── mobile/       # Expo React Native App
│   └── landing/      # Landing Page (geplant)
```

---

### Cardecky

**KI-gestütztes Lernkarten-System**

Cardecky ist ein Deck-Management-System mit KI-gestützter Kartenerstellung und dem integrierten Mana Credit-System.

#### Features

- Deck-Erstellung und -Verwaltung
- KI-gestützte Kartengenerierung
- Credit-System Integration (10 Mana pro Deck, 2 Mana pro Karte)
- Cross-Platform (iOS, Android, Web)
- NestJS Backend mit AuthGuard

#### Credit-Kosten

| Operation            | Kosten  |
| -------------------- | ------- |
| Deck erstellen       | 10 Mana |
| Karte erstellen      | 2 Mana  |
| KI-Kartengenerierung | 5 Mana  |
| Deck exportieren     | 3 Mana  |

#### Tech-Stack

| Komponente | Technologie         |
| ---------- | ------------------- |
| Backend    | NestJS (Port 8080)  |
| Mobile     | React Native + Expo |
| Web        | SvelteKit           |
| Landing    | Astro               |
| Datenbank  | Supabase            |

#### Projektstruktur

```
cards/
├── backend/          # NestJS API Server
├── apps/
│   ├── mobile/       # Expo React Native App
│   ├── web/          # SvelteKit Web App
│   └── landing/      # Astro Landing Page
```

---

### Memoro

**KI-gestützte Sprachaufnahme und Memo-Verwaltung**

Memoro transformiert Audio-Aufnahmen in strukturierte, durchsuchbare Inhalte mithilfe von KI. Ideal für Meetings, Interviews, Vorlesungen oder persönliche Notizen.

#### Features

- Hochwertige Audio-Aufnahme (Hintergrundaufnahme mit Pause/Resume)
- KI-gestützte Analyse (Blueprints und Prompts)
- Kollaborative Spaces für Teams
- 32 Sprachen unterstützt
- 4 Theme-Varianten (Lume, Nature, Stone, Ocean)
- Credit-System mit transparenter Preisgestaltung
- Enterprise-Security mit Row-Level Security

#### Tech-Stack

| Komponente | Technologie                       |
| ---------- | --------------------------------- |
| Mobile     | React Native 0.81.4 + Expo SDK 54 |
| Web        | SvelteKit 2.x                     |
| Audio      | expo-audio, Azure Speech Services |
| State      | Zustand                           |
| Payments   | RevenueCat                        |
| Analytics  | Umami (self-hosted)               |
| i18n       | react-i18next (32 Sprachen)       |

#### Projektstruktur

```
memoro/
├── apps/
│   ├── mobile/       # React Native + Expo App
│   └── web/          # SvelteKit Web App
├── features/         # Feature-Module (33 Module)
├── components/       # Atomic Design Components
└── docs/             # Feature-Dokumentation
```

#### Feature-Module

- auth, audioRecordingV2, memos, spaces, credits
- subscription, i18n, theme, blueprints, prompts
- und 23 weitere...

---

### Picture

**Bild-Bearbeitungs-App**

Picture ist eine Cross-Platform Bildbearbeitungs-Anwendung mit Canvas-basierter Bearbeitung.

#### Features

- Canvas-basierte Bildbearbeitung (Konva)
- Cross-Platform (iOS, Android, Web)
- Theme-System Integration
- Subscription-Management

#### Tech-Stack

| Komponente | Technologie                |
| ---------- | -------------------------- |
| Mobile     | React Native + Expo SDK 54 |
| Web        | SvelteKit + Svelte 5       |
| Canvas     | Konva                      |
| Styling    | TailwindCSS 4.0            |

#### Projektstruktur

```
picture/
├── apps/
│   ├── mobile/       # Expo React Native App
│   ├── web/          # SvelteKit Web App
│   └── landing/      # Landing Page
```

---

### uLoad

**URL-Shortener und Link-Management**

uLoad ist eine URL-Shortening und Link-Management Plattform mit umfangreichen Analytics.

**Live:** https://ulo.ad

#### Features

- URL-Verkürzung
- Link-Analytics und Tracking
- Stripe-Integration für Zahlungen
- E-Mail-Versand via Resend
- Cloudflare R2 Storage

#### Tech-Stack

| Komponente | Technologie                  |
| ---------- | ---------------------------- |
| Framework  | SvelteKit v2.22 + Svelte 5.0 |
| Backend    | PocketBase (embedded SQLite) |
| Datenbank  | PostgreSQL via Drizzle ORM   |
| Cache      | Redis                        |
| Styling    | Tailwind CSS v4.0            |
| Testing    | Vitest + Playwright          |
| Payments   | Stripe                       |
| Email      | Resend                       |
| Storage    | Cloudflare R2                |

#### Projektstruktur

```
uload/
├── apps/
│   └── web/          # SvelteKit Web App
├── backend/          # PocketBase Konfiguration
│   ├── pb_migrations/
│   └── pb_schema.json
├── docs/             # Dokumentation
└── scripts/          # Utility Scripts
```

#### Entwicklung

```bash
cd uload/apps/web

# Development
pnpm run dev          # http://localhost:5173

# Datenbank
pnpm run db:studio    # Drizzle Studio öffnen
pnpm run db:push      # Schema-Änderungen pushen

# Testing
pnpm run test         # Unit + E2E Tests
```

---

### Chat

**Chat-Anwendung**

Chat ist eine mobile Chat-Anwendung mit Supabase-Backend und Markdown-Unterstützung.

#### Features

- Echtzeit-Chat mit Supabase
- Markdown-Rendering
- Expo Router Navigation
- NativeWind Styling

#### Tech-Stack

| Komponente | Technologie                       |
| ---------- | --------------------------------- |
| Mobile     | Expo SDK 52 + React Native 0.76.7 |
| Navigation | Expo Router                       |
| Styling    | NativeWind (Tailwind CSS)         |
| Backend    | Supabase                          |

#### Projektstruktur

```
chat/
├── apps/
│   └── mobile/       # Expo React Native App
```

---

### Food

**KI-gestützter Ernährungs-Tracker**

Food ist ein intelligenter Ernährungs-Tracker, der mithilfe von Google Gemini Vision API Fotos von Mahlzeiten analysiert und automatisch Nährwertinformationen extrahiert.

#### Features

- KI-gestützte Mahlzeitenanalyse aus Fotos
- Automatische Erkennung von Kalorien, Protein, Kohlenhydraten, Fett
- Tägliche Ernährungsbilanz und Statistiken
- Manuelle Eingabe über Textbeschreibung
- Personalisierte Gesundheitstipps
- Offline-Speicherung mit SQLite
- Cloud-Sync mit Supabase

#### Tech-Stack

| Komponente | Technologie                           |
| ---------- | ------------------------------------- |
| Backend    | NestJS (Port 3002)                    |
| Mobile     | Expo SDK 53 + React Native 0.79       |
| Web        | SvelteKit                             |
| Landing    | Astro                                 |
| KI         | Google Gemini Vision API              |
| Datenbank  | Supabase (PostgreSQL), SQLite (lokal) |
| State      | Zustand                               |

#### Projektstruktur

```
food/
├── apps/
│   ├── mobile/       # Expo React Native App (@food/mobile)
│   ├── web/          # SvelteKit Web App (@food/web)
│   └── landing/      # Astro Landing Page (@food/landing)
├── server/           # Hono/Bun server (@food/server)
```

#### API Endpoints

| Endpoint                          | Methode | Beschreibung              |
| --------------------------------- | ------- | ------------------------- |
| `/api/health`                     | GET     | Health Check              |
| `/api/meals/analyze/image`        | POST    | Mahlzeit-Foto analysieren |
| `/api/meals/analyze/text`         | POST    | Mahlzeit-Text analysieren |
| `/api/meals`                      | POST    | Mahlzeit speichern        |
| `/api/meals/user/:userId`         | GET     | Mahlzeiten eines Users    |
| `/api/meals/user/:userId/summary` | GET     | Tagesbilanz               |

#### Entwicklung

```bash
# Backend starten
pnpm dev:food:backend

# Mobile App starten
pnpm dev:food:mobile

# Web App starten
pnpm dev:food:web

# Landing Page starten
pnpm dev:food:landing
```

---

## Shared Packages

Alle Projekte teilen gemeinsame Packages unter `packages/`:

### Core Packages

| Package                     | Beschreibung                             |
| --------------------------- | ---------------------------------------- |
| `@mana/shared-types`    | Gemeinsame TypeScript Types              |
| `@mana/shared-utils`    | Utility-Funktionen (Date, String, Async) |
| `@mana/shared-config`   | Gemeinsame Konfiguration                 |

### Auth & Security

| Package                        | Beschreibung             |
| ------------------------------ | ------------------------ |
| `@mana/shared-auth`        | Authentifizierungs-Logik |
| `@mana/shared-auth-ui`     | Auth UI-Komponenten      |
| `@mana/shared-auth-stores` | Auth State Stores        |

### UI & Styling

| Package                       | Beschreibung                |
| ----------------------------- | --------------------------- |
| `@mana/shared-ui`         | React Native UI-Komponenten |
| `@mana/shared-icons`      | Icon-Library                |
| `@mana/shared-tailwind`   | Tailwind Konfiguration      |
| `@mana/shared-theme`      | Theme-Logik                 |
| `@mana/shared-theme-ui`   | Theme UI-Komponenten        |
| `@mana/shared-branding`   | Branding Assets             |
| `@mana/shared-landing-ui` | Landing Page Komponenten    |

### Business Logic

| Package                               | Beschreibung                  |
| ------------------------------------- | ----------------------------- |
| `@mana/shared-subscription-types` | Subscription TypeScript Types |
| `@mana/shared-subscription-ui`    | Subscription UI-Komponenten   |
| `@mana/shared-credit-service`     | Credit/Mana Service           |
| `@mana/shared-i18n`               | Internationalisierung         |

### Datenbank

| Package             | Beschreibung              |
| ------------------- | ------------------------- |
| `cards-database` | Cardecky Datenbank-Schema |
| `uload-database`    | uLoad Datenbank-Schema    |

### Verwendung

```typescript
// In einem beliebigen Projekt
import { User, ApiResponse } from '@mana/shared-types';
import { formatDate, truncate, retry } from '@mana/shared-utils';
```

---

## Technologie-Stack

### Frontend

| Kategorie  | Web                 | Mobile              |
| ---------- | ------------------- | ------------------- |
| Framework  | SvelteKit 2 / Astro | React Native + Expo |
| UI Library | Svelte 5 (Runes)    | React 18/19         |
| Styling    | TailwindCSS         | NativeWind          |
| State      | Svelte Stores       | Zustand / Context   |
| Routing    | File-based          | Expo Router         |

### Backend

| Kategorie | Technologie                          |
| --------- | ------------------------------------ |
| API       | NestJS                               |
| Auth      | Mana Middleware / Supabase Auth |
| Database  | PostgreSQL (Supabase) / PocketBase   |
| Storage   | Supabase Storage / Cloudflare R2     |
| Cache     | Redis                                |

### AI/ML

| Service               | Verwendung       |
| --------------------- | ---------------- |
| Azure OpenAI (GPT-4)  | Text-Generierung |
| Google Gemini         | Text-Analyse     |
| Replicate (Flux)      | Bild-Generierung |
| Azure Speech Services | Sprache-zu-Text  |

### DevOps

| Kategorie       | Technologie                              |
| --------------- | ---------------------------------------- |
| Package Manager | pnpm 9.15.0                              |
| Build System    | Turborepo                                |
| CI/CD           | EAS Build (Mobile), Vercel/Netlify (Web) |
| Deployment      | Google Cloud Run, Docker                 |

---

## Entwicklung

### Voraussetzungen

- Node.js 20+
- pnpm 9.15.0+
- Expo CLI (für Mobile-Entwicklung)
- Docker (für lokale Backend-Entwicklung)

### Installation

```bash
# pnpm global installieren
npm install -g pnpm

# Dependencies installieren
pnpm install
```

### Befehle

```bash
# Entwicklung
pnpm run dev                    # Alle Projekte starten
pnpm run maerchenzauber:dev     # Einzelnes Projekt

# Build
pnpm run build                  # Alle Projekte bauen

# Code Quality
pnpm run format                 # Code formatieren
pnpm run type-check             # TypeScript prüfen
pnpm run lint                   # Linting

# Testing
pnpm run test                   # Tests ausführen
```

### Dependencies hinzufügen

```bash
# Zum Root hinzufügen (Dev-Tools)
pnpm add -D <package> -w

# Zu einem Projekt hinzufügen
pnpm add <package> --filter maerchenzauber

# Zu einem Shared Package hinzufügen
pnpm add <package> --filter @mana/shared-utils
```

### Projekt-spezifische Entwicklung

Siehe die jeweiligen CLAUDE.md Dateien in den Projektverzeichnissen für detaillierte Entwicklungsanleitungen:

- `maerchenzauber/CLAUDE.md`
- `mana/CLAUDE.md`
- `cards/CLAUDE.md` (im Root)
- `memoro/CLAUDE.md`
- `uload/CLAUDE.md`
- `chat/apps/mobile/CLAUDE.md`

---

## Weitere Dokumentation

- [Backend Architecture](./BACKEND_ARCHITECTURE.md) - Backend-Architektur Details
- [Shared Packages Roadmap](./SHARED_PACKAGES_ROADMAP.md) - Roadmap für Shared Packages
- [i18n](./I18N.md) - Internationalisierungs-Guide
- [Self-Hosting Guide](./SELF-HOSTING-GUIDE.md) - Self-Hosting Anleitung
- [uLoad Deployment](./ULOAD-DEPLOYMENT.md) - uLoad Deployment Guide
- [Cardecky Postgres Migration](./CARDS_POSTGRES_MIGRATION.md) - Datenbank-Migration

---

## Ideen für zukünftige Apps

Dieser Abschnitt enthält durchdachte Ideen für neue Anwendungen, die das Manacore-Ökosystem sinnvoll erweitern könnten. Die Ideen nutzen die bestehende Infrastruktur (Mana Credits, zentrale Auth, Shared Packages) und schaffen Synergien mit existierenden Apps.

### Analyse des bestehenden Ökosystems

**Stärken der Plattform:**

- Etabliertes Credit-System (Mana) für Monetarisierung
- Zentrale Authentifizierung über Manacore
- Multi-Platform-Expertise (Web + Mobile)
- KI-Integration (Text, Bild, Sprache)
- Team/Spaces-Kollaboration
- 32-Sprachen-Support
- Bewährte Shared Packages

**Bestehende Domänen:**

- Kreatives Schreiben (Maerchenzauber)
- Sprachaufnahmen & Transkription (Memoro)
- Lernen & Wissensmanagement (Cardecky)
- Bildbearbeitung (Picture)
- Link-Management (uLoad)
- Kommunikation (Chat)

---

### Kategorie 1: Produktivität & Wissensmanagement

#### ManaNote - Intelligente Notiz-App

**Konzept:** Eine Notion-ähnliche Notiz-Anwendung mit tiefer KI-Integration und nahtloser Verbindung zu anderen Mana-Apps.

**Kernfeatures:**

- Block-basierter Editor (ähnlich Notion)
- KI-gestützte Zusammenfassungen und Umstrukturierung
- Automatische Verlinkung verwandter Notizen (Knowledge Graph)
- Templates für verschiedene Use Cases (Meeting Notes, Projektplanung, Tagebuch)
- Bi-direktionale Links und Backlinks
- Markdown-Export/Import

**Synergien:**

- **Memoro-Integration:** Audio-Memos werden automatisch als Notizen importiert
- **Cardecky-Integration:** Aus Notizen Lernkarten generieren
- **Chat-Integration:** Chat-Verläufe als Notizen speichern

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| KI-Zusammenfassung | 3 |
| Knowledge Graph Update | 2 |
| Template-Generierung | 5 |
| Smart Search (semantisch) | 1 |

**Zielgruppe:** Studenten, Wissensarbeiter, Forscher, Journalisten

**Technische Besonderheiten:**

- Offline-first mit Sync
- Echtzeit-Kollaboration
- Versionierung & History
- Verschlüsselung für sensible Notizen

---

#### ManaTask - Intelligentes Projektmanagement

**Konzept:** Ein schlankes, KI-gestütztes Projektmanagement-Tool, das sich auf Einzelpersonen und kleine Teams konzentriert.

**Kernfeatures:**

- Kanban-Boards, Listen und Kalender-Ansichten
- KI-gestützte Task-Zerlegung (großes Ziel → Subtasks)
- Intelligente Priorisierung basierend auf Deadlines und Abhängigkeiten
- Zeitschätzungen durch KI
- Recurring Tasks mit flexiblen Mustern
- Focus Mode mit Pomodoro-Timer

**Synergien:**

- **Memoro-Integration:** Meeting-Aufnahmen → automatisch extrahierte Action Items
- **ManaNote-Integration:** Projekt-Dokumentation verknüpfen
- **Manacore-Integration:** Team-Spaces mit Rollen

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Task-Zerlegung (KI) | 3 |
| Projekt-Analyse | 5 |
| Sprint-Planung (KI) | 5 |
| Statusbericht generieren | 3 |

**Zielgruppe:** Freelancer, kleine Teams, Projektmanager

**Besonderheit:** "Zero-Inbox"-Philosophie - die App hilft aktiv dabei, die Task-Liste zu reduzieren statt zu erweitern.

---

#### ManaCalendar - Der intelligente Kalender

**Konzept:** Ein Kalender, der nicht nur Termine verwaltet, sondern aktiv bei der Zeitplanung hilft.

**Kernfeatures:**

- Smart Scheduling: Findet automatisch optimale Zeitslots
- Meeting-Vorbereitung: Zeigt relevante Dokumente/Notizen vor Terminen
- Time Blocking: KI schlägt Fokuszeiten vor
- Energie-Tracking: Berücksichtigt persönliche Produktivitätsmuster
- Multi-Kalender-Sync (Google, Outlook, Apple)
- Reisezeit-Berechnung zwischen Terminen

**Synergien:**

- **Memoro-Integration:** Nach Meetings automatisch Transkript verlinken
- **ManaTask-Integration:** Deadline-Visualisierung im Kalender
- **ManaNote-Integration:** Meeting-Notizen direkt zum Termin

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Smart Scheduling | 2 |
| Wochen-Optimierung | 5 |
| Meeting-Zusammenfassung | 3 |
| Verfügbarkeitsanalyse | 1 |

**Zielgruppe:** Alle, die ihre Zeit besser managen wollen

---

### Kategorie 2: Kreativität & Content

#### ManaWrite - Der KI-Schreibassistent

**Konzept:** Während Maerchenzauber auf Kindergeschichten spezialisiert ist, richtet sich ManaWrite an professionelle Content-Erstellung.

**Kernfeatures:**

- Blog-Posts, Artikel, Essays
- Marketing-Texte (Ads, Landing Pages, E-Mails)
- Social Media Content mit Plattform-Anpassung
- SEO-Optimierung und Keyword-Analyse
- Tonfall-Anpassung (formal, casual, witzig, etc.)
- Plagiatsprüfung und Originalitäts-Score
- A/B-Varianten-Generierung

**Content-Typen:**

- Blog-Artikel
- Newsletter
- Produktbeschreibungen
- Social Media Posts
- Pressemitteilungen
- Reden und Präsentationen

**Synergien:**

- **Memoro-Integration:** Gesprochene Gedanken → ausformulierte Texte
- **ManaNote-Integration:** Notizen → fertige Artikel
- **uLoad-Integration:** Tracking-Links für veröffentlichte Inhalte

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Kurzer Text (< 500 Wörter) | 5 |
| Langer Artikel (> 1000 Wörter) | 15 |
| SEO-Analyse | 3 |
| Tonfall-Transformation | 3 |
| Plagiatsprüfung | 2 |

**Zielgruppe:** Content Creator, Marketing-Teams, Blogger, Unternehmen

---

#### ManaVideo - KI-gestützter Video-Editor

**Konzept:** Ein mobiler Video-Editor für kurze Social-Media-Videos mit KI-Unterstützung.

**Kernfeatures:**

- Automatische Untertitel-Generierung (32 Sprachen)
- KI-Schnitt: Erkennt beste Momente, entfernt "Ähms" und Pausen
- Thumbnail-Generierung mit KI
- Musik-Empfehlungen passend zum Content
- Automatische Formatierung für verschiedene Plattformen (TikTok, Reels, Shorts)
- B-Roll-Vorschläge aus Stock-Bibliothek
- Talking Head → Animated Avatar

**Synergien:**

- **Memoro-Integration:** Audio-Transkripte für Untertitel
- **Picture-Integration:** Thumbnail-Bearbeitung
- **ManaWrite-Integration:** Video-Skripte erstellen

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Untertitel (pro Minute) | 2 |
| KI-Schnitt | 10 |
| Thumbnail-Set (5 Varianten) | 5 |
| Avatar-Animation (pro Minute) | 15 |

**Zielgruppe:** Content Creator, Social Media Manager, Influencer

---

#### ManaPodcast - Podcast-Produktions-Suite

**Konzept:** Eine All-in-One Lösung für Podcast-Produktion - von der Aufnahme bis zur Veröffentlichung.

**Kernfeatures:**

- Multi-Track-Aufnahme (Remote-Interviews)
- Automatische Audio-Verbesserung (Noise Reduction, Normalisierung)
- KI-Kapitel-Generierung mit Timestamps
- Show Notes aus Transkript
- Automatische Highlight-Clips für Social Media
- RSS-Feed-Management
- Analytics Dashboard

**Synergien:**

- **Memoro-Integration:** Gleiche Audio-Engine, Transkription
- **ManaWrite-Integration:** Show Notes und Beschreibungen
- **uLoad-Integration:** Tracking-Links für Episoden
- **ManaVideo-Integration:** Video-Podcasts

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Audio-Enhancement (pro Stunde) | 10 |
| Transkript + Kapitel | 8 |
| Show Notes generieren | 5 |
| Highlight-Clips (5 Stück) | 10 |

**Zielgruppe:** Podcaster, Unternehmen, Educators

---

#### ManaDesign - KI-Design-Assistent

**Konzept:** Ergänzung zu Picture mit Fokus auf Brand-Design und Marketing-Materialien.

**Kernfeatures:**

- Logo-Generator mit Varianten
- Brand Kit Management (Farben, Fonts, Assets)
- Social Media Template-Generator
- Mockup-Generator (T-Shirts, Tassen, Screens)
- Visitenkarten und Briefpapier
- Präsentations-Slides
- Infografik-Generator

**Synergien:**

- **Picture-Integration:** Detaillierte Bildbearbeitung
- **ManaWrite-Integration:** Text für Marketing-Materialien
- **uLoad-Integration:** QR-Codes mit Tracking

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Logo-Set (10 Varianten) | 20 |
| Social Media Template-Set | 10 |
| Mockup-Generierung | 5 |
| Brand Kit Export | 5 |
| Infografik | 15 |

**Zielgruppe:** Startups, Freelancer, Marketing-Teams

---

### Kategorie 3: Bildung & Lernen

#### ManaLearn - Lernplattform

**Konzept:** Eine Plattform zum Erstellen und Konsumieren von Mikro-Kursen mit KI-Unterstützung.

**Kernfeatures:**

- Kurs-Builder mit Drag & Drop
- KI-generierte Quizze und Tests
- Lernpfade mit Abhängigkeiten
- Gamification (Streaks, Badges, Leaderboards)
- Zertifikate nach Kursabschluss
- Creator-Monetarisierung
- Spaced Repetition Integration

**Synergien:**

- **Cardecky-Integration:** Kursinhalte → Lernkarten
- **Memoro-Integration:** Vorlesungen aufnehmen und transkribieren
- **ManaNote-Integration:** Kurs-Notizen
- **ManaVideo-Integration:** Video-Lektionen

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Quiz generieren (10 Fragen) | 5 |
| Kurs-Zusammenfassung | 3 |
| Zertifikat erstellen | 2 |
| Lernpfad-Empfehlung | 3 |

**Zielgruppe:** Educators, Corporate Training, Selbstlerner

---

#### ManaRead - Intelligenter Lese-Assistent

**Konzept:** Ein Tool zum schnellen Erfassen und Verarbeiten von Dokumenten, Artikeln und Büchern.

**Kernfeatures:**

- PDF/EPUB-Import und -Annotation
- Web-Artikel-Clipper
- KI-Zusammenfassungen (verschiedene Längen)
- Fragen an Dokumente stellen (RAG-basiert)
- Highlight-Extraktion und -Organisation
- Lese-Statistiken und -Ziele
- Text-to-Speech für Dokumente

**Synergien:**

- **Cardecky-Integration:** Highlights → Lernkarten
- **ManaNote-Integration:** Exzerpte in Notizen überführen
- **ManaLearn-Integration:** Leselisten für Kurse

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Dokument-Zusammenfassung | 5 |
| Q&A (pro 5 Fragen) | 3 |
| Text-to-Speech (pro 10 Min) | 2 |
| Wissens-Extraktion | 8 |

**Zielgruppe:** Studenten, Forscher, Vielleser, Professionals

---

#### ManaTranslate - Professionelle Übersetzung

**Konzept:** Mehr als ein einfacher Übersetzer - ein Tool für professionelle Lokalisierung.

**Kernfeatures:**

- Dokumenten-Übersetzung (PDF, DOCX, etc.)
- Kontext-bewusste Übersetzung
- Terminologie-Management (Glossare)
- Translation Memory für konsistente Übersetzungen
- Stil-Anpassung (formal, informal, technisch)
- Korrekturlese-Modus
- Batch-Übersetzung für Websites

**Synergien:**

- **ManaWrite-Integration:** Mehrsprachige Content-Erstellung
- **Shared i18n:** Gleiche 32-Sprachen-Basis
- **ManaRead-Integration:** Fremdsprachige Dokumente verstehen

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Kurzer Text (< 500 Wörter) | 3 |
| Dokument (pro Seite) | 2 |
| Glossar-Training | 10 |
| Website-Lokalisierung | variabel |

**Zielgruppe:** Übersetzer, internationale Unternehmen, Autoren

---

### Kategorie 4: Gesundheit & Wellness

#### ManaFit - KI-Fitness-Coach

**Konzept:** Ein personalisierter Fitness-Begleiter mit adaptiven Trainingsplänen.

**Kernfeatures:**

- KI-generierte Trainingspläne basierend auf Zielen
- Video-Übungsanleitungen
- Progressive Overload Tracking
- Ernährungsempfehlungen
- Integration mit Apple Health / Google Fit
- Workout-Timer mit Audio-Cues
- Körper-Tracking mit Foto-Vergleich (Picture-Integration)

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Trainingsplan (4 Wochen) | 10 |
| Ernährungsplan | 8 |
| Fortschritts-Analyse | 3 |
| Übungs-Alternative finden | 1 |

**Zielgruppe:** Fitness-Enthusiasten, Anfänger, Menschen ohne Gym-Zugang

---

#### ManaMind - Mentale Gesundheit & Meditation

**Konzept:** Eine App für mentales Wohlbefinden mit geführten Meditationen und Journaling.

**Kernfeatures:**

- Geführte Meditationen (verschiedene Längen und Themen)
- Atemübungen mit Visualisierung
- Stimmungs-Tracking
- KI-Journaling-Prompts
- Schlaf-Geschichten (Maerchenzauber für Erwachsene)
- Entspannungsmusik-Generator
- Therapie-Vorbereitung (Gedanken strukturieren)

**Synergien:**

- **Maerchenzauber-Integration:** Beruhigende Geschichten
- **Memoro-Integration:** Gedanken aufnehmen statt schreiben

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Personalisierte Meditation | 3 |
| Schlaf-Geschichte | 5 |
| Journal-Analyse (Woche) | 5 |
| Musik-Generierung (10 Min) | 5 |

**Zielgruppe:** Stressgeplagte, Meditations-Interessierte, Menschen mit Schlafproblemen

---

#### ManaRecipe - Intelligenter Küchenassistent

**Konzept:** Ein Rezept-Manager mit KI-Funktionen für Planung und Anpassung.

**Kernfeatures:**

- Rezept-Import aus URLs
- KI-Rezeptgenerierung basierend auf Zutaten ("Was kann ich kochen?")
- Automatische Skalierung von Portionen
- Einkaufslisten-Generator mit Zusammenführung
- Nährwert-Analyse
- Diät-Anpassung (vegan, glutenfrei, etc.)
- Essensplanung für die Woche
- Kühlschrank-Inventar mit Ablauf-Warnung

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Rezept aus Zutaten | 3 |
| Wochenplan erstellen | 5 |
| Rezept-Anpassung (Diät) | 2 |
| Nährwert-Analyse | 1 |

**Zielgruppe:** Hobbyköche, Familien, Gesundheitsbewusste

---

### Kategorie 5: Business & Finanzen

#### ManaFinance - Persönlicher Finanz-Manager

**Konzept:** Ein intelligentes Tool zur Verwaltung persönlicher Finanzen mit KI-Insights.

**Kernfeatures:**

- Bank-Synchronisation (via Plaid/ähnlich)
- Automatische Kategorisierung von Transaktionen
- Budget-Erstellung und -Tracking
- KI-Spar-Empfehlungen
- Abonnement-Tracker mit Kündigungs-Reminders
- Steuer-Vorbereitung (Belege sammeln)
- Finanzielle Ziele mit Meilensteinen
- Nettowert-Tracking

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Monats-Analyse | 3 |
| Spar-Optimierung | 5 |
| Jahres-Report | 10 |
| Steuer-Export | 5 |

**Zielgruppe:** Jeder, der seine Finanzen im Griff haben will

---

#### ManaInvoice - Rechnungs- und Angebotsverwaltung

**Konzept:** Einfache Rechnungsstellung für Freelancer und kleine Unternehmen.

**Kernfeatures:**

- Professionelle Rechnungs-Templates
- Automatische Nummerierung
- Wiederkehrende Rechnungen
- Mahnwesen mit automatischen Reminders
- Zeit-Tracking für Dienstleistungen
- Angebots-Erstellung
- Steuer-Berechnung
- Multi-Währung-Support
- Kunden-Verwaltung (CRM-light)

**Synergien:**

- **ManaDesign-Integration:** Gebrandete Rechnungen
- **uLoad-Integration:** Zahlungslinks

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Rechnung erstellen | 0 (Abo-basiert) |
| KI-Angebotserstellung | 5 |
| Jahres-Steuerexport | 10 |

**Zielgruppe:** Freelancer, Kleinunternehmer, Berater

---

#### ManaPitch - Präsentations-Assistent

**Konzept:** Ein Tool zur Erstellung überzeugender Pitch-Decks und Präsentationen.

**Kernfeatures:**

- KI-generierte Präsentations-Struktur
- Design-Vorlagen für verschiedene Anlässe
- Storytelling-Unterstützung
- Speaker Notes Generator
- Präsentations-Training mit Feedback
- Investor-Deck-Templates
- One-Pager-Generator
- Pitch-Timer mit Übung

**Synergien:**

- **ManaDesign-Integration:** Visuelle Assets
- **ManaWrite-Integration:** Texte und Skripte
- **Memoro-Integration:** Präsentation aufnehmen und analysieren

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Deck-Struktur generieren | 5 |
| Design-Vorschläge | 3 |
| Speaker Notes | 5 |
| Präsentations-Feedback | 8 |

**Zielgruppe:** Startups, Sales-Teams, Speaker

---

### Kategorie 6: Kommunikation & Social

#### ManaMeet - Intelligente Video-Konferenzen

**Konzept:** Eine Video-Konferenz-Lösung mit eingebauter KI-Unterstützung.

**Kernfeatures:**

- HD Video-Calls
- Echtzeit-Transkription
- Live-Untertitel in verschiedenen Sprachen
- Automatische Meeting-Zusammenfassung
- Action Items Extraktion
- Hintergrund-Blur und virtuelle Hintergründe
- Breakout Rooms
- Bildschirmfreigabe mit Annotation
- Aufnahme mit automatischer Verarbeitung

**Synergien:**

- **Memoro-Integration:** Gleiche Transkriptions-Engine
- **ManaNote-Integration:** Meeting Notes direkt speichern
- **ManaTask-Integration:** Action Items → Tasks
- **ManaCalendar-Integration:** Nahtlose Terminplanung

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Meeting-Transkript | 5 pro Stunde |
| Live-Übersetzung | 10 pro Stunde |
| Zusammenfassung | 3 |
| KI-Moderator | 15 pro Stunde |

**Zielgruppe:** Remote-Teams, Unternehmen, Freelancer

---

#### ManaForum - Community-Plattform

**Konzept:** Eine moderne Forum/Community-Plattform für Marken und Communities.

**Kernfeatures:**

- Threads und Diskussionen
- Q&A-Bereich mit Voting
- KI-Moderation
- Automatische FAQ-Generierung aus häufigen Fragen
- Mitglieder-Profile und Reputation
- Events und Meetups
- Ressourcen-Bibliothek
- Integration mit Chat

**Synergien:**

- **Chat-Integration:** Private Nachrichten
- **ManaLearn-Integration:** Community-Kurse
- **Manacore-Integration:** Organisation/Team als Community

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| KI-Moderation (pro 100 Posts) | 5 |
| FAQ-Generierung | 8 |
| Community-Analyse | 10 |

**Zielgruppe:** Marken, Creator, Open-Source-Projekte

---

### Kategorie 7: Developer Tools

#### ManaCode - Code-Snippet-Manager

**Konzept:** Eine intelligente Bibliothek für Code-Snippets mit KI-Unterstützung.

**Kernfeatures:**

- Snippet-Organisation mit Tags und Ordnern
- Syntax-Highlighting für alle gängigen Sprachen
- KI-Code-Erklärung
- Snippet-Suche (semantisch)
- Team-Sharing
- IDE-Plugins (VS Code, JetBrains)
- Automatische Dokumentations-Generierung
- Code-Review-Assistent

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Code-Erklärung | 2 |
| Dokumentation generieren | 3 |
| Code-Review | 5 |
| Refactoring-Vorschläge | 5 |

**Zielgruppe:** Entwickler, Tech-Teams

---

#### ManaAPI - API-Dokumentations-Tool

**Konzept:** Automatische API-Dokumentation und Testing.

**Kernfeatures:**

- OpenAPI/Swagger-Import
- Automatische Docs-Generierung
- Interaktiver API-Explorer
- Mock-Server-Generierung
- Änderungs-Tracking (API-Versionierung)
- Code-Beispiele in verschiedenen Sprachen
- Postman-Alternative im Browser

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Docs aus Code generieren | 10 |
| Code-Beispiele (alle Sprachen) | 5 |
| Mock-Server (pro Tag) | 3 |

**Zielgruppe:** API-Entwickler, Tech-Teams, DevRel

---

### Kategorie 8: Entertainment & Lifestyle

#### ManaTrip - Reise-Planer

**Konzept:** Ein KI-gestützter Reiseplaner für die perfekte Reise.

**Kernfeatures:**

- KI-Reiserouten basierend auf Interessen und Budget
- Tag-für-Tag-Itineraries
- Restaurant- und Aktivitäts-Empfehlungen
- Packlisten-Generator
- Offline-Karten und -Guides
- Budget-Tracking während der Reise
- Foto-Tagebuch mit automatischer Sortierung
- Erinnerungsbuch nach der Reise

**Synergien:**

- **Picture-Integration:** Reisefotos bearbeiten
- **ManaNote-Integration:** Reisenotizen
- **ManaFinance-Integration:** Reise-Budget

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Reiseroute (7 Tage) | 15 |
| Tages-Aktivitäten | 3 |
| Packliste | 2 |
| Reise-Zusammenfassung | 10 |

**Zielgruppe:** Reisende, Familien, Digital Nomads

---

#### ManaPlay - Interaktive Geschichten

**Konzept:** Eine Erweiterung von Maerchenzauber für interaktive "Choose Your Own Adventure"-Geschichten.

**Kernfeatures:**

- Interaktive Entscheidungs-Geschichten
- KI-generierte Verzweigungen
- Verschiedene Genres (Fantasy, Krimi, Romance, Horror)
- Charakter-Import aus Maerchenzauber
- Community-Geschichten
- Eigene Geschichten erstellen
- Multiplayer-Abenteuer (Gruppen-Entscheidungen)

**Synergien:**

- **Maerchenzauber-Integration:** Charaktere und Illustrationen
- **Chat-Integration:** Multiplayer-Koordination

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Geschichte starten | 5 |
| Pro Kapitel (mit Illustrationen) | 3 |
| Eigene Geschichte erstellen | 20 |
| Multiplayer-Session | 10 |

**Zielgruppe:** Story-Fans, Gamer, Familien

---

#### ManaMusic - KI-Musik-Studio

**Konzept:** Ein Tool zur KI-gestützten Musikerstellung für Content Creator.

**Kernfeatures:**

- Hintergrundmusik-Generierung
- Stil- und Stimmungs-basierte Musik
- Podcast-Intro/Outro-Generator
- Sound-Effekte-Bibliothek
- Stem-Separation (Vocals entfernen)
- Tempo und Längen-Anpassung
- Lizenzfreie Nutzung
- Loops und Samples

**Synergien:**

- **ManaPodcast-Integration:** Musik für Podcasts
- **ManaVideo-Integration:** Hintergrundmusik
- **ManaMind-Integration:** Entspannungsmusik

**Credit-Modell:**
| Operation | Mana |
|-----------|------|
| Track generieren (30 Sek) | 5 |
| Track generieren (3 Min) | 15 |
| Stem-Separation | 10 |
| Sound-Effekt | 1 |

**Zielgruppe:** Content Creator, Podcaster, Video-Ersteller

---

### Priorisierungsmatrix

Basierend auf Synergien mit bestehenden Apps, Marktpotenzial und technischer Machbarkeit:

#### Hohe Priorität (Sofortiges Potenzial)

| App           | Begründung                                        |
| ------------- | ------------------------------------------------- |
| **ManaNote**  | Natürliche Erweiterung von Memoro, hohe Synergien |
| **ManaWrite** | Nutzt bestehende KI-Infrastruktur, klarer Markt   |
| **ManaRead**  | Ergänzt Cardecky perfekt, Bildungsmarkt           |
| **ManaMeet**  | Memoro-Technologie wiederverwendbar               |

#### Mittlere Priorität (Strategisch wichtig)

| App              | Begründung                             |
| ---------------- | -------------------------------------- |
| **ManaTask**     | Produktivitäts-Suite vervollständigen  |
| **ManaCalendar** | Verbindet alle Produktivitäts-Apps     |
| **ManaPodcast**  | Wachsender Markt, Memoro-Basis         |
| **ManaDesign**   | Picture erweitern, Marketing-Use-Cases |
| **ManaLearn**    | Cardecky + Memoro + Video kombinieren  |

#### Langfristig (Exploration)

| App             | Begründung                         |
| --------------- | ---------------------------------- |
| **ManaVideo**   | Komplex, aber hoher Bedarf         |
| **ManaFinance** | Andere Domäne, aber hohe Nachfrage |
| **ManaFit**     | Großer Markt, wenig Synergien      |
| **ManaMusic**   | KI-Musik im Aufwind                |
| **ManaTrip**    | Saisonal, aber emotional           |

---

### Technische Empfehlungen für neue Apps

1. **Shared Packages erweitern:**
   - `@mana/shared-ai` - Gemeinsame KI-Service-Abstraktionen
   - `@mana/shared-storage` - File-Upload und -Management
   - `@mana/shared-realtime` - Echtzeit-Kollaboration

2. **Backend-Microservices:**
   - Jede größere KI-Funktion als eigener Service
   - Event-basierte Architektur für App-übergreifende Integration

3. **Deep Links zwischen Apps:**
   - Standardisiertes URL-Schema: `mana://app/action?params`
   - Nahtloser Datenfluss zwischen Apps

4. **Unified Search:**
   - App-übergreifende Suche über alle Inhalte
   - Semantische Suche mit Embeddings

5. **ManaHub als zentrale App:**
   - Dashboard mit Widgets aller Apps
   - Einheitliche Benachrichtigungen
   - Cross-App-Workflows

---

### Fazit

Das Manacore-Ökosystem hat enormes Potenzial für Erweiterungen. Die bestehende Infrastruktur (Credits, Auth, Shared Packages, KI-Integration) ermöglicht schnelle Entwicklung neuer Apps. Der Fokus sollte zunächst auf Produktivitäts-Tools liegen, die starke Synergien mit Memoro und Cardecky haben.

Die Vision: **Ein zusammenhängendes Ökosystem, in dem Daten nahtlos zwischen Apps fließen** - von der Sprachaufnahme (Memoro) über Notizen (ManaNote) zu Lernkarten (Cardecky), mit KI-Unterstützung auf jedem Schritt.

---

_Zuletzt aktualisiert: November 2025_
