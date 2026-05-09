---
title: 'Traces App Integration & Calendar Production Hardening'
description: 'Traces App mit NestJS Backend und Expo Mobile ins Monorepo integriert. Calendar mit Security Fixes, Rate Limiting und Accessibility Verbesserungen produktionsreif gemacht.'
date: 2026-03-15
author: 'Till Schneider'
category: 'feature'
tags: ['traces', 'calendar', 'security', 'production', 'rate-limiting', 'expo', 'eas-build']
featured: false
commits: 8
readTime: 7
stats:
  filesChanged: 95
  linesAdded: 4200
  linesRemoved: 380
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 8
workingHours:
  start: '2026-03-15T11:00'
  end: '2026-03-16T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Intensiver Tag mit **8 Commits** für eine neue App-Integration und Production Hardening:

- **Traces App** - AI City Guides mit NestJS Backend und Expo Mobile
- **Calendar Security** - Rate Limiting, Input Validation, CSRF Protection
- **Calendar Performance** - Query Optimization, Connection Pooling
- **EAS Build Fixes** - .npmrc und Dockerfile Healthcheck Ports

---

## Traces App Integration

Traces ist eine neue App für AI-generierte City Guides. Die App wurde komplett ins Monorepo integriert.

### Architektur

```
apps/traces/
├── apps/
│   ├── backend/     # NestJS API (Port 3012)
│   │   ├── src/
│   │   │   ├── guides/       # AI City Guide Generation
│   │   │   ├── locations/    # POI Management
│   │   │   └── routes/       # Route Planning
│   │   └── package.json
│   └── mobile/      # Expo React Native
│       ├── app/
│       │   ├── (tabs)/       # Tab Navigation
│       │   ├── guide/        # Guide Detail Screens
│       │   └── map/          # Map View
│       └── package.json
└── package.json
```

### Backend Features

| Feature              | Beschreibung                          |
| -------------------- | ------------------------------------- |
| **AI Guides**        | LLM-basierte Stadtführer-Generierung  |
| **POI Database**     | Sehenswürdigkeiten mit Geodaten       |
| **Route Planning**   | Optimierte Routen zwischen POIs       |
| **Auth Integration** | mana-core-auth via shared-nestjs-auth |

### Mobile App

- Expo SDK 55 mit expo-router
- MapView Integration für Routen-Visualisierung
- Offline-Cache für heruntergeladene Guides

---

## Calendar Production Hardening

Der Calendar wurde mit umfassenden Security- und Performance-Fixes produktionsreif gemacht.

### Security Fixes

#### Rate Limiting

```typescript
// Rate Limiting pro Endpoint
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Controller('api/events')
export class EventsController {
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@Post()
	async createEvent() {
		// Max 10 Events pro Minute
	}
}
```

#### Input Validation

Strikte Validation für alle API Endpoints:

```typescript
export class CreateEventDto {
	@IsString()
	@MaxLength(200)
	title: string;

	@IsISO8601()
	startDate: string;

	@IsISO8601()
	endDate: string;

	@IsOptional()
	@MaxLength(5000)
	description?: string;
}
```

#### CSRF Protection

```typescript
// Helmet Security Headers
app.use(helmet());
app.use(
	helmet.contentSecurityPolicy({
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'"],
		},
	})
);
```

### Performance Fixes

| Fix                 | Vorher      | Nachher              |
| ------------------- | ----------- | -------------------- |
| **Event Query**     | N+1 Queries | Single JOIN Query    |
| **Connection Pool** | Default (5) | Konfigurierbar (20)  |
| **Response Size**   | Alle Felder | Selektive Projektion |

### Accessibility Verbesserungen

- ARIA Labels für alle interaktiven Elemente
- Keyboard Navigation im Event-Dialog
- Focus Management beim Modal-Open/Close
- Screen Reader Announcements für Kalender-Navigation

---

## Auto-Generate CALENDAR_ENCRYPTION_KEY

Der Encryption Key für Calendar-Daten wird in Production automatisch generiert, falls nicht gesetzt.

```typescript
// Fallback Key Generation
const encryptionKey = process.env.CALENDAR_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

if (!process.env.CALENDAR_ENCRYPTION_KEY) {
	logger.warn('CALENDAR_ENCRYPTION_KEY not set, using generated key');
	logger.warn('Set CALENDAR_ENCRYPTION_KEY for persistent encryption');
}
```

---

## Dockerfile Healthcheck Ports

Die Healthcheck-Ports in den Dockerfiles waren hardcoded und stimmten nicht mit den tatsächlichen Service-Ports überein.

```diff
- HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
+ HEALTHCHECK CMD curl -f http://localhost:${PORT:-3000}/health || exit 1
```

---

## EAS Build: .npmrc für Hoisted Mode

Für alle Mobile Apps wurde `.npmrc` mit `node-linker=hoisted` hinzugefügt, um EAS Build Kompatibilität sicherzustellen.

```ini
# .npmrc
node-linker=hoisted
```

### patch-package Non-Fatal

In picture-mobile wurde `patch-package` im postinstall Script non-fatal gemacht, da fehlende Patches den EAS Build abbrechen konnten.

```diff
- "postinstall": "patch-package"
+ "postinstall": "patch-package || true"
```

---

## Zusammenfassung

| Bereich               | Commits | Highlights                         |
| --------------------- | ------- | ---------------------------------- |
| **Traces**            | 2       | NestJS Backend + Expo Mobile       |
| **Calendar Security** | 3       | Rate Limiting, Validation, CSRF    |
| **Calendar A11y**     | 1       | ARIA, Keyboard, Focus              |
| **Build Infra**       | 2       | Healthcheck, .npmrc, patch-package |

---

## Nächste Schritte

1. **Traces API** - Weitere Guide-Endpoints implementieren
2. **Calendar E2E Tests** - Playwright Tests für kritische Flows
3. **Calendar Monitoring** - Error Tracking und Performance Metrics
4. **Traces TestFlight** - Erster iOS Build
