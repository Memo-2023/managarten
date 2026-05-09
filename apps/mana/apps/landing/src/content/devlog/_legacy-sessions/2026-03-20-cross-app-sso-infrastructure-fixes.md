---
title: 'Cross-App SSO, Infrastructure Fixes & Calendar Deployment'
description: 'Massive Infrastruktur-Session: SSO Cookie-Fix für alle Apps, Calendar-Web auf Local Build migriert, Cross-App API Routing repariert, MinIO Tunnel-Anbindung, und umfangreiche Storage/Docker-Optimierungen.'
date: 2026-03-20
author: 'Till Schneider'
category: 'infrastructure'
tags:
  [
    'sso',
    'auth',
    'docker',
    'caddy',
    'cors',
    'minio',
    'calendar',
    'mukke',
    'storage',
    'cloudflare',
    'infrastructure',
  ]
featured: true
commits: 48
readTime: 10
stats:
  filesChanged: 194
  linesAdded: 12265
  linesRemoved: 5255
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 48
workingHours:
  start: '2026-03-20T09:00'
  end: '2026-03-20T21:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Intensiver Infrastruktur- und Bugfix-Tag mit **48 Commits**: Cross-App SSO endlich funktionsfähig, Calendar-Web von stale GHCR Image auf Local Build migriert, und eine Kette von Routing/CORS/Cookie-Problemen systematisch aufgelöst.

- **SSO Cookie-Fix** - `SameSite=None` + Session-Cookie bei Login setzen
- **Calendar-Web Migration** - Von veraltetem GHCR Image auf lokalen Docker Build
- **Cross-App API Routing** - `getBaseUrl()` Bug in shared-api-client gefixt
- **CORS & Caddy** - 10+ falsche Reverse-Proxy-Ports korrigiert, CORS für Cross-App erweitert
- **MinIO Tunnel** - Cloudflare Tunnel für `minio.mana.how` eingerichtet
- **Storage & Docker** - Optimierte Dockerfiles, Presigned Multipart, Lifecycle Rules
- **Calendar Features** - CalDAV Sync UI, Recurring Events, Reminders, Composable-Refactoring

---

## 1. Cross-App SSO – Endlich funktionsfähig

Das Single Sign-On über alle `*.mana.how` Subdomains hatte **drei versteckte Bugs**, die zusammen verhinderten, dass SSO jemals funktionierte:

### Problem 1: Kein Session-Cookie beim Login

Die `signIn()` Funktion in `@manacore/shared-auth` nutzte nur den Custom-Endpoint (`/api/v1/auth/login`), der JWT-Tokens zurückgibt aber **kein Session-Cookie setzt**. Nur der native Better Auth Endpoint (`/api/auth/sign-in/email`) setzt das Cookie.

**Fix:** Nach erfolgreichem JWT-Login wird jetzt zusätzlich der Better Auth Endpoint mit `credentials: 'include'` aufgerufen.

### Problem 2: `SameSite=Lax` blockiert `fetch()`

Das Session-Cookie hatte `SameSite=Lax`, was Cookies nur bei Top-Level-Navigationen (Link-Klicks) sendet — **nicht bei programmatischen `fetch()` Requests**. Der SSO-Flow nutzt aber `fetch()` mit `credentials: 'include'`.

**Fix:** `SameSite=None` wenn `COOKIE_DOMAIN` gesetzt ist (Production). Fallback auf `Lax` für lokale Entwicklung.

### Problem 3: `getBaseUrl()` Override

Die `getBaseUrl()` Funktion in `@manacore/shared-api-client` überschrieb **immer** die `baseUrl` mit `window.__PUBLIC_BACKEND_URL__` — egal welche URL der Client eigentlich konfiguriert hatte. Cross-App Clients (Calendar→Todo, Calendar→Contacts) sendeten dadurch alle Requests an den Calendar-Backend.

**Fix:** Neues `useRuntimeUrl: false` Flag für Cross-App Clients.

## 2. Calendar-Web: GHCR → Local Build

`calendar-web` nutzte noch ein veraltetes GHCR Docker Image, das weder die Cross-App URL-Injection noch aktuelle shared-auth Änderungen enthielt.

**Migration:**

- Docker-Compose auf `build: context + dockerfile` umgestellt
- Drei fehlende Packages im Dockerfile ergänzt (`patches`, `shared-pwa`, `shared-app-onboarding`)
- Erfolgreich gebaut und deployed

## 3. Reverse-Proxy Port-Chaos aufgeräumt

Die `Caddyfile.production` hatte **10+ falsche Ports** — Überbleibsel aus früheren Deployments:

| Domain            | Alt  | Neu  |
| ----------------- | ---- | ---- |
| mana.how          | 5173 | 5000 |
| chat.mana.how     | 3000 | 5010 |
| chat-api          | 3002 | 3030 |
| todo.mana.how     | 5188 | 5011 |
| calendar.mana.how | 5186 | 5012 |
| calendar-api      | 3016 | 3032 |
| clock.mana.how    | 5187 | 5013 |
| clock-api         | 3017 | 3033 |
| contacts.mana.how | 5184 | 5014 |
| grafana           | 3100 | 8000 |
| stats             | 3200 | 8010 |

> Hinweis: Routing läuft über Cloudflare Tunnel (korrekte Ports), nicht Caddy. Caddyfile trotzdem aktualisiert für Dokumentation.

## 4. CORS für Cross-App Integration

Todo-Backend erlaubte nur `todo.mana.how` und `mana.how` als Origins. Calendar und Contacts konnten keine Task-API-Requests machen.

**Fix:** `calendar.mana.how` und `contacts.mana.how` zu `CORS_ORIGINS` des Todo-Backends hinzugefügt.

## 5. MinIO Tunnel-Anbindung

Mukke-Songs konnten nicht abgespielt werden: Die presigned S3-URLs zeigten auf `minio.mana.how`, aber diese Domain fehlte in der Cloudflare Tunnel Config.

**Fix:** `minio.mana.how → localhost:9000` zur Cloudflare Tunnel Config hinzugefügt. Audio-Streaming funktioniert jetzt.

## 6. Storage & Docker Optimierungen

- **Auth Dockerfile**: Von ~740MB auf ~320MB optimiert
- **Backend Dockerfiles**: DevDeps Pruning für alle Backends
- **shared-storage**: Presigned Multipart Upload, `deleteByPrefix`, `copy`, `getMetadata`, File-Size Validation, Lifecycle Rules
- **Deploy Tracking**: Neues Grafana Dashboard mit PostgreSQL + Pushgateway
- **CD Pipeline**: Mukke-Backend und -Web hinzugefügt, Matrix-Benachrichtigung bei Deploy-Fehlern

## 7. Calendar Features & Refactoring

- **CalDAV/iCal Sync UI** — Externe Kalender verbinden und synchronisieren
- **Recurring Events** — Wiederholungsdialog mit RFC 5545 RRULE Support
- **Reminders** — Erinnerungen erstellen und verwalten
- **WeekView Refactoring** — Inline-Logik in Composables extrahiert (1600→903 LOC)
- **Settings vereinfacht** — Von 41 auf 18 persistierte Einstellungen reduziert
- **ViewCarousel** — Touch-Gesten aus UnifiedBar extrahiert
- **Tests** — Composable Unit Tests, WeekView E2E, CalDAV Sync API Tests

## 8. Weitere Fixes

- **Picture App** — Migration von Netlify zu Docker/Mac Mini, Dockerfile-Fixes
- **Contacts** — Verwaiste Fotos bei Duplikat-Merge aufräumen, Storage-Optimierung
- **Mukke** — 34 Frontend-Tests, klickbare Songs, Player Error Handling
- **Games** — WhoPixels Hosting unter `whopxl.mana.how`
- **DevBuildBadge** — Shared Component für Development-Build-Kennzeichnung

---

## Zusammenfassung

| Bereich      | Änderungen                                                                         |
| ------------ | ---------------------------------------------------------------------------------- |
| **SSO/Auth** | 3 Bugs gefixt (Cookie, SameSite, URL-Override), funktioniert jetzt cross-subdomain |
| **Docker**   | Calendar-Web migriert, Auth Image halbiert, alle Backend-Dockerfiles optimiert     |
| **Routing**  | Caddyfile korrigiert, MinIO Tunnel, CORS erweitert                                 |
| **Calendar** | CalDAV, Recurrence, Reminders, Tests, Composable-Refactoring                       |
| **Storage**  | Multipart, Lifecycle, Bulk-Delete, Validation                                      |
| **Testing**  | Mukke 34 Tests, Calendar Composables + E2E, Sync API Tests                         |
