# Development Scripts

Diese Dokumentation beschreibt die verfügbaren Entwicklungsbefehle im Mana Monorepo.

## Übersicht

Das Monorepo nutzt [Turborepo](https://turbo.build/) für parallele Builds und intelligentes Caching. Alle Befehle werden über `pnpm` ausgeführt.

## Globale Befehle

| Befehl              | Beschreibung                                      |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Startet alle Apps (Web, Mobile, Landing, Backend) |
| `pnpm build`        | Baut alle Packages und Apps                       |
| `pnpm test`         | Führt alle Tests aus                              |
| `pnpm lint`         | Führt Linting für alle Packages aus               |
| `pnpm type-check`   | TypeScript-Typprüfung für alle Packages           |
| `pnpm clean`        | Bereinigt Build-Artefakte                         |
| `pnpm format`       | Formatiert alle Dateien mit Prettier              |
| `pnpm format:check` | Prüft Formatierung ohne Änderungen                |

## App-Typ Befehle

Diese Befehle starten alle Apps eines bestimmten Typs gleichzeitig:

| Befehl             | Beschreibung               | Apps                                       |
| ------------------ | -------------------------- | ------------------------------------------ |
| `pnpm dev:web`     | Startet alle Web-Apps      | maerchenzauber, mana, cards, memoro |
| `pnpm dev:landing` | Startet alle Landing Pages | maerchenzauber, mana, cards, memoro |
| `pnpm dev:mobile`  | Startet alle Mobile-Apps   | maerchenzauber, mana, cards, memoro |

### Beispiel

```bash
# Alle Web-Apps starten (SvelteKit)
pnpm dev:web

# Alle Landing Pages starten (Astro)
pnpm dev:landing

# Alle Mobile-Apps starten (Expo)
pnpm dev:mobile
```

## Projekt-spezifische Befehle

Diese Befehle starten ein komplettes Projekt mit allen zugehörigen Apps und Dependencies:

| Befehl                    | Beschreibung                                           |
| ------------------------- | ------------------------------------------------------ |
| `pnpm maerchenzauber:dev` | Startet Maerchenzauber (Backend, Web, Mobile, Landing) |
| `pnpm mana:dev`           | Startet Mana (Web, Mobile, Landing)                    |
| `pnpm cards:dev`       | Startet Cardecky (Web, Mobile, Landing)             |
| `pnpm memoro:dev`         | Startet Memoro (Web, Mobile, Landing)                  |

## Turbo Filter

Für erweiterte Kontrolle kannst du Turbo-Filter direkt verwenden:

```bash
# Einzelne App starten
pnpm turbo run dev --filter=@storyteller/web

# Mehrere Apps kombinieren
pnpm turbo run dev --filter=mana-web --filter=memoro-web
```

### Package-Namen Referenz

Da die Package-Namen im Monorepo unterschiedlich sind, hier eine Übersicht:

| Projekt        | Web                | Landing                | Mobile                | Backend                |
| -------------- | ------------------ | ---------------------- | --------------------- | ---------------------- |
| maerchenzauber | `@storyteller/web` | `@storyteller/landing` | `@storyteller/mobile` | `@storyteller/backend` |
| mana           | `mana-web`         | `mana-landing`         | `mana`                | -                      |
| cards       | `web`              | `landing`              | `cards`            | -                      |
| memoro         | `memoro-web`       | `memoro-landing`       | `memoro`              | -                      |

### Filter-Syntax

| Pattern               | Beschreibung                   |
| --------------------- | ------------------------------ |
| `--filter=name`       | Exakte Package-Übereinstimmung |
| `--filter=name...`    | Package und alle Dependencies  |
| `--filter='@scope/*'` | Alle Packages im Scope         |

## Port-Zuweisungen

Wenn mehrere Apps gleichzeitig laufen, verwenden sie unterschiedliche Ports:

| App-Typ | Projekt        | Standard-Port |
| ------- | -------------- | ------------- |
| Web     | maerchenzauber | 5173          |
| Web     | mana       | 5174          |
| Web     | cards       | 5175          |
| Web     | memoro         | 5176          |
| Landing | maerchenzauber | 4321          |
| Landing | mana       | 4322          |
| Landing | cards       | 4323          |
| Landing | memoro         | 4324          |
| Backend | maerchenzauber | 3000          |

_Hinweis: Die tatsächlichen Ports können je nach Konfiguration variieren._

## Tipps

1. **Schnelleres Starten**: Nutze `dev:web` statt `dev` wenn du nur an Web-Apps arbeitest
2. **Parallele Entwicklung**: Turbo führt alle Tasks parallel aus und nutzt Caching
3. **Selektives Bauen**: Nutze Filter um nur relevante Packages zu bauen
