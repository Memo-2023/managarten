---
title: 'Security Hardening, Error Tracking & Production Audits'
description: 'Umfassender Security-Tag: Cross-App SSO Fix, Audit Logging, Account Lockout, GlitchTip Error Tracking für alle 15 Backends, und Production Readiness Audits für alle 20 Apps.'
date: 2026-03-19
author: 'Till Schneider'
category: 'infrastructure'
tags:
  [
    'security',
    'auth',
    'sso',
    'audit-logging',
    'glitchtip',
    'error-tracking',
    'testing',
    'audits',
    'presi',
    'manacore',
  ]
featured: true
commits: 74
readTime: 12
stats:
  filesChanged: 751
  linesAdded: 41228
  linesRemoved: 2218
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 74
workingHours:
  start: '2026-03-19T11:00'
  end: '2026-03-20T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Massiver Infrastruktur- und Security-Tag mit **74 Commits** über das gesamte Monorepo:

- **Cross-App SSO Fix** - Fehlende trusted origins repariert, 47 SSO Contract Tests
- **Security Hardening** - Audit Logging, Account Lockout, API Key Rate Limiting
- **GlitchTip Error Tracking** - Integration für alle 15 Backends
- **Production Audits** - Alle 20 Apps bewertet (35–94 Punkte)
- **ManaCore Dashboard** - Neue Widgets für Mukke, Presi, Context
- **Presi Hardening** - 72 Tests, DB Indexes, Swagger Docs (Score 55→81)
- **Test Coverage** - 174 Auth/Security Tests, 48 ManaCore Dashboard Tests

---

## 1. Cross-App SSO Fix

Das Cross-Domain Single Sign-On war für mehrere neuere Apps kaputt. Ursache: Fehlende Einträge in Better Auth's `trustedOrigins` und CORS.

### Das Problem

```
User loggt sich in Calendar ein → ✓
User öffnet Todo → ❌ Nicht eingeloggt (SSO fehlgeschlagen)
```

10 Apps fehlten in `trustedOrigins`: Mukke, Photos, Planta, Questions, Todo, Traces, Context, Docs, Cards, Quotes.

### Der Fix

```typescript
// services/mana-core-auth/src/auth/better-auth.config.ts
trustedOrigins: [
  'https://auth.mana.how',
  'https://mana.how',
  // Alle 24 Apps alphabetisch sortiert
  'https://calendar.mana.how',
  'https://chat.mana.how',
  'https://clock.mana.how',
  'https://contacts.mana.how',
  'https://context.mana.how',    // NEU
  'https://docs.mana.how',       // NEU
  'https://mukke.mana.how',      // NEU
  'https://photos.mana.how',     // NEU
  'https://planta.mana.how',     // NEU
  'https://questions.mana.how',  // NEU
  'https://todo.mana.how',       // NEU
  'https://traces.mana.how',     // NEU
  // ... alle weiteren
],
```

### 47 SSO Contract Tests

Damit das nicht nochmal passiert, wurden Contract Tests geschrieben:

| Test Suite               | Tests | Prüft                                                               |
| ------------------------ | ----- | ------------------------------------------------------------------- |
| **SSO Config**           | 30    | Jede App in trustedOrigins, Cookie Config, Docker-Compose Alignment |
| **SSO Session-to-Token** | 17    | Client-Server-Vertrag, Cookie-Erkennung, Error Handling             |

```typescript
// Jede App wird automatisch geprüft
const APPS_WITH_SSO = [
	'calendar',
	'chat',
	'clock',
	'contacts',
	'context',
	'cards',
	'matrix',
	'mukke',
	'food',
	'photos',
	'picture',
	'planta',
	'presi',
	'questions',
	'skilltree',
	'storage',
	'todo',
	'traces',
	'quotes',
];

it.each(APPS_WITH_SSO)('should include %s.mana.how in trustedOrigins', (appName) => {
	expect(configContent).toContain(`https://${appName}.mana.how`);
});
```

### SSO Checklist dokumentiert

Neue App hinzufügen erfordert jetzt 3 dokumentierte Schritte:

1. `trustedOrigins` in `better-auth.config.ts`
2. `CORS_ORIGINS` in `docker-compose.macmini.yml`
3. `pnpm test -- src/auth/sso-config.spec.ts` ausführen

---

## 2. Security Hardening: Audit Logging

Vorher: Nur 2 Security Events wurden geloggt (password_changed, account_deleted).

Jetzt: **20 Event-Typen** über einen zentralen `SecurityEventsService`.

### SecurityEventsService

```typescript
// Fire-and-forget: Auth-Flows werden nie durch Logging blockiert
export const SecurityEventType = {
	LOGIN_SUCCESS: 'login_success',
	LOGIN_FAILURE: 'login_failure',
	REGISTER: 'register',
	LOGOUT: 'logout',
	TOKEN_REFRESHED: 'token_refreshed',
	SSO_TOKEN_EXCHANGE: 'sso_token_exchange',
	PASSWORD_CHANGED: 'password_changed',
	PASSWORD_RESET_REQUESTED: 'password_reset_requested',
	ACCOUNT_DELETED: 'account_deleted',
	ACCOUNT_LOCKED: 'account_locked',
	API_KEY_CREATED: 'api_key_created',
	API_KEY_REVOKED: 'api_key_revoked',
	API_KEY_VALIDATED: 'api_key_validated',
	API_KEY_VALIDATION_FAILED: 'api_key_validation_failed',
	ORG_CREATED: 'org_created',
	ORG_MEMBER_INVITED: 'org_member_invited',
	// ... und weitere
};
```

Jedes Event erfasst automatisch:

- **User ID** (wenn verfügbar)
- **IP-Adresse** (aus `x-forwarded-for` oder `req.ip`)
- **User-Agent**
- **Metadata** (kontextspezifische Details)

---

## 3. Security Hardening: Account Lockout

Neuer `AccountLockoutService` schützt gegen Brute-Force-Angriffe.

### Policy

```
5 fehlgeschlagene Logins in 15 Minuten
→ Account für 30 Minuten gesperrt
→ Response: { code: "ACCOUNT_LOCKED", retryAfter: <seconds> }
```

### Architektur

```
Login Request
     │
     ▼
┌────────────────┐     ┌─────────────────────┐
│ checkLockout() │────▶│ auth.login_attempts  │
│                │     │ (neue Tabelle)       │
└────────┬───────┘     └─────────────────────┘
         │
    locked? ──yes──▶ 403 ACCOUNT_LOCKED
         │
        no
         │
         ▼
┌────────────────┐
│ signIn()       │──fail──▶ recordAttempt(email, false)
│                │──ok────▶ clearAttempts(email)
└────────────────┘
```

### Design-Entscheidungen

- **Fails open**: Bei DB-Fehlern wird der User nicht ausgesperrt
- **Email-not-verified** zählt nicht als fehlgeschlagener Versuch
- **Per-Email** statt per-IP (verhindert verteilte Brute-Force)
- **Neue Tabelle** `auth.login_attempts` mit Index auf `(email, attempted_at)`

---

## 4. Security Hardening: API Key Validation

Der `POST /api-keys/validate` Endpoint war komplett ungeschützt.

### Vorher

```typescript
@Post('validate')
async validateKey(@Body() dto: ValidateApiKeyDto) {
  return this.apiKeysService.validateApiKey(dto.apiKey, dto.scope);
}
```

### Nachher

```typescript
@Post('validate')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { ttl: 60000, limit: 10 } })  // 10 req/min per IP
@HttpCode(HttpStatus.OK)
async validateKey(@Body() dto: ValidateApiKeyDto, @Req() req: Request) {
  const result = await this.apiKeysService.validateApiKey(dto.apiKey, dto.scope);

  // Audit Log: Erfolg oder Fehlschlag
  this.securityEvents.logEventWithRequest(req, {
    eventType: result.valid
      ? SecurityEventType.API_KEY_VALIDATED
      : SecurityEventType.API_KEY_VALIDATION_FAILED,
    metadata: { keyPrefix: dto.apiKey?.substring(0, 16) + '...' },
  });

  return result;
}
```

---

## 5. GlitchTip Error Tracking

GlitchTip (selbst-gehostete Sentry-Alternative) wurde für **alle 15 Backends** integriert.

### Integrierte Services

| Service       | Port | GlitchTip Project |
| ------------- | ---- | ----------------- |
| Calendar      | 3032 | #1                |
| Chat          | 3030 | #4                |
| Clock         | 3033 | #7                |
| Contacts      | 3034 | #6                |
| ManaCore Auth | 3001 | #2                |
| Mukke         | 3010 | #9                |
| Food          | 3037 | #11               |
| Photos        | 3039 | #12               |
| Planta        | 3022 | #13               |
| Presi         | 3036 | #14               |
| Skilltree     | 3038 | #16               |
| Storage       | 3035 | #17               |
| Todo          | 3031 | #3                |
| Quotes        | 3007 | #8                |

### Grafana Dashboard

Neues GlitchTip Error Tracking Dashboard in Grafana mit:

- Error Rate über alle Services
- Top Errors nach Häufigkeit
- Error Trends über Zeit

---

## 6. Production Readiness Audits

Alle 20 aktiven Apps wurden bewertet nach 8 Kategorien (Backend, Frontend, Database, Testing, Deployment, Documentation, Security, UX).

### Ergebnisse

| App           | Score | Status     | Highlights                      |
| ------------- | ----- | ---------- | ------------------------------- |
| **Calendar**  | 94    | Production | Reifste App                     |
| **Contacts**  | 94    | Production | 14 Backend-Module, Google OAuth |
| **Todo**      | 94    | Production | 190 Tests (beste Coverage)      |
| **ManaCore**  | 86    | Beta       | 11 Widgets, PWA                 |
| **Chat**      | 82    | Production | 9 AI-Modelle                    |
| **Presi**     | 81    | Beta       | 72 Tests nach Hardening         |
| **Picture**   | 81    | Production | Replicate Integration           |
| **Mukke**     | 80    | Beta       | 113 Tests, Audio Editor         |
| **Matrix**    | 68    | Production | E2E Encryption                  |
| **Food**      | 63    | Beta       | Gemini AI Integration           |
| **Photos**    | 62    | Beta       | mana-media Integration          |
| **Quotes**    | 62    | Beta       | Deployed auf mana.how           |
| **Context**   | 60    | Beta       | Neuer Backend (Port 3020)       |
| **Clock**     | 58    | Beta       | Kein CLAUDE.md, keine Tests     |
| **Skilltree** | 58    | Beta       | Offline-first PWA               |
| **Storage**   | 55    | Beta       | 10 Module, 0 Tests              |
| **Presi**     | 55→81 | Beta       | Nach Hardening heute            |
| **Planta**    | 50    | Alpha      | Gemini AI, keine Tests          |
| **Cards**     | 48    | Alpha      | Schwächste Codebase             |
| **Questions** | 48    | Alpha      | 32 Endpoints, kein Docker       |
| **Traces**    | 35    | Alpha      | Mobile-first GPS, minimal       |

---

## 7. Presi Hardening (Score 55→81)

Die Presi App wurde massiv verbessert:

- **72 Unit Tests** hinzugefügt
- **DB Indexes** für häufige Queries
- **Swagger/OpenAPI** Dokumentation
- **Rate Limiting** auf allen Endpoints
- **Error Boundary** für bessere Fehlerbehandlung
- **Input Validation** gehärtet

---

## 8. ManaCore Dashboard Erweiterungen

### Neue Widgets

3 neue Dashboard-Widgets für Mukke, Presi und Context integriert.

### 48 Unit Tests

| Suite          | Tests | Beschreibung                      |
| -------------- | ----- | --------------------------------- |
| **Dashboard**  | 15    | Widget Rendering, Layout, State   |
| **API Client** | 18    | HTTP Requests, Error Handling     |
| **Credits**    | 15    | Balance, Transactions, Formatting |

Score: 82 → 88

---

## Zusammenfassung

| Bereich            | Commits | Highlights                                        |
| ------------------ | ------- | ------------------------------------------------- |
| **SSO Fix**        | 3       | 10 fehlende Origins, 47 Contract Tests, Doku      |
| **Security**       | 1       | Audit Logging, Account Lockout, API Key Hardening |
| **Error Tracking** | 4       | GlitchTip für 15 Backends, Grafana Dashboard      |
| **Audits**         | 6       | 20 App Audits, Monitoring Tools                   |
| **Presi**          | 2       | 72 Tests, DB Indexes, Swagger (55→81)             |
| **ManaCore**       | 5       | 3 Widgets, 48 Tests (82→88)                       |
| **Docker**         | 3       | Dockerfile Fixes, lokale Builds                   |
| **Versioning**     | 1       | Semantic Versioning + Changesets                  |
| **Sonstiges**      | 49      | Navigation, Feedback, Icons, Docs                 |

### Security Test Coverage

| Test Suite               | Tests   |
| ------------------------ | ------- |
| SSO Config               | 30      |
| SSO Session-to-Token     | 17      |
| Auth Controller          | 34      |
| Better Auth Service      | 55      |
| Security Events          | 38      |
| **Gesamt Auth/Security** | **174** |

---

## Nächste Schritte

1. **2FA implementieren** - Schema existiert, Code fehlt
2. **Suspicious Login Detection** - Geo/Device/Velocity Checks
3. **Passwort-Komplexität** - Mindestanforderungen + HaveIBeenPwned
4. **Login Rate Limit senken** - Von 10/min auf 5/15min (OWASP)
5. **Concurrent Session Limits** - Max 5 Sessions pro User
