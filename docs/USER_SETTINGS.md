# Zentrale User Settings

Die User Settings werden zentral in `mana-auth` gespeichert und über alle Apps synchronisiert. Dies ermöglicht eine konsistente Benutzererfahrung über das gesamte Mana-Ökosystem.

## Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                      mana-auth                              │
│                    (Port 3001)                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   auth.user_settings Table                               │   │
│  │   ┌─────────────────────────────────────────────────┐   │   │
│  │   │ user_id │ globalSettings │ appOverrides         │   │   │
│  │   │─────────│────────────────│──────────────────────│   │   │
│  │   │ uuid    │ {nav, theme,   │ {"calendar": {...},  │   │   │
│  │   │         │  locale}       │  "chat": {...}}      │   │   │
│  │   └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API (JWT Auth)
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
  ┌─────────┐           ┌─────────┐           ┌─────────┐
  │Calendar │           │  Chat   │           │ Picture │
  │  App    │           │   App   │           │   App   │
  └─────────┘           └─────────┘           └─────────┘
```

## Datenstruktur

### Global Settings

Globale Einstellungen gelten für **alle Apps** als Standardwerte:

```typescript
interface GlobalSettings {
  nav: {
    desktopPosition: 'top' | 'bottom';  // Position der Navigation auf Desktop
    sidebarCollapsed: boolean;           // Sidebar eingeklappt?
  };
  theme: {
    mode: 'light' | 'dark' | 'system';   // Theme-Modus
    colorScheme: string;                  // 'ocean' | 'nature' | 'lume' | 'stone'
  };
  locale: string;  // 'de' | 'en' | 'fr' | 'es' | 'it'
}
```

**Standardwerte:**
```typescript
{
  nav: { desktopPosition: 'top', sidebarCollapsed: false },
  theme: { mode: 'system', colorScheme: 'ocean' },
  locale: 'de'
}
```

### App Overrides

Jede App kann die globalen Einstellungen überschreiben:

```typescript
interface AppOverride {
  nav?: Partial<NavSettings>;
  theme?: Partial<ThemeSettings>;
}

// Beispiel: Calendar hat eigene Einstellungen
{
  "calendar": {
    nav: { desktopPosition: 'bottom' },
    theme: { colorScheme: 'nature' }
  },
  "chat": {
    theme: { mode: 'dark' }
  }
}
```

### Cascading / Auflösung

Die effektiven Settings einer App werden durch Merging berechnet:

```
Effektive Settings = Global Settings + App Override (falls vorhanden)
```

Beispiel:
- Global: `{ theme: { mode: 'system', colorScheme: 'ocean' } }`
- Calendar Override: `{ theme: { colorScheme: 'nature' } }`
- **Effektiv für Calendar:** `{ theme: { mode: 'system', colorScheme: 'nature' } }`

## Backend API

### Endpoints

Alle Endpoints erfordern JWT-Authentifizierung via `Authorization: Bearer <token>`.

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/api/v1/settings` | GET | Alle Settings des Users abrufen |
| `/api/v1/settings/global` | PATCH | Globale Settings aktualisieren |
| `/api/v1/settings/app/:appId` | PATCH | App-Override setzen/aktualisieren |
| `/api/v1/settings/app/:appId` | DELETE | App-Override löschen (zurück zu Global) |

### Beispiel-Requests

```bash
# Token holen
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}' | jq -r '.accessToken')

# Alle Settings abrufen
curl http://localhost:3001/api/v1/settings \
  -H "Authorization: Bearer $TOKEN"

# Response:
{
  "success": true,
  "globalSettings": {
    "nav": { "desktopPosition": "top", "sidebarCollapsed": false },
    "theme": { "mode": "system", "colorScheme": "ocean" },
    "locale": "de"
  },
  "appOverrides": {}
}

# Sprache global ändern
curl -X PATCH http://localhost:3001/api/v1/settings/global \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locale": "en"}'

# Theme nur für Calendar überschreiben
curl -X PATCH http://localhost:3001/api/v1/settings/app/calendar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"theme": {"colorScheme": "nature"}}'

# Calendar-Override löschen (zurück zu Global)
curl -X DELETE http://localhost:3001/api/v1/settings/app/calendar \
  -H "Authorization: Bearer $TOKEN"
```

## Frontend Integration

### Store erstellen

Jede App erstellt einen eigenen User Settings Store in `src/lib/stores/user-settings.svelte.ts`:

```typescript
import { createUserSettingsStore } from '@mana/shared-theme';
import { authStore } from './auth.svelte';

export const userSettings = createUserSettingsStore({
  appId: 'calendar',  // Eindeutige App-ID
  authUrl: 'http://localhost:3001',
  getAccessToken: () => authStore.getAccessToken()
});
```

### Store laden

Im Root-Layout nach erfolgreicher Authentifizierung:

```svelte
<script lang="ts">
  import { userSettings } from '$lib/stores/user-settings.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';

  onMount(async () => {
    await authStore.initialize();

    if (authStore.isAuthenticated) {
      await userSettings.load();
    }
  });
</script>
```

### Settings lesen

```svelte
<script lang="ts">
  import { userSettings } from '$lib/stores/user-settings.svelte';
</script>

<!-- Resolved Settings (Global + App Override) -->
<p>Nav Position: {userSettings.nav.desktopPosition}</p>
<p>Theme Mode: {userSettings.theme.mode}</p>
<p>Locale: {userSettings.locale}</p>

<!-- Status -->
<p>Loading: {userSettings.syncing}</p>
<p>Has Override: {userSettings.hasAppOverride}</p>
```

### Settings ändern

```typescript
// Globale Settings ändern (gilt für alle Apps)
await userSettings.updateGlobal({
  locale: 'en',
  theme: { mode: 'dark' }
});

// App-Override setzen (nur diese App)
await userSettings.updateAppOverride({
  nav: { desktopPosition: 'bottom' },
  theme: { colorScheme: 'nature' }
});

// App-Override löschen (zurück zu Global)
await userSettings.removeAppOverride();
```

### Beispiel: PillNavigation

```svelte
<PillNavigation
  desktopPosition={userSettings.nav.desktopPosition}
  ...
/>
```

## Store API Referenz

### Properties (readonly)

| Property | Type | Beschreibung |
|----------|------|--------------|
| `nav` | `NavSettings` | Resolved Navigation Settings |
| `theme` | `ThemeSettings` | Resolved Theme Settings |
| `locale` | `string` | Aktuelle Sprache |
| `globalSettings` | `GlobalSettings` | Rohe globale Settings |
| `hasAppOverride` | `boolean` | Hat diese App einen Override? |
| `syncing` | `boolean` | Wird gerade synchronisiert? |
| `loaded` | `boolean` | Wurden Settings geladen? |

### Methods

| Method | Beschreibung |
|--------|--------------|
| `load()` | Settings vom Server laden |
| `updateGlobal(settings)` | Globale Settings aktualisieren |
| `updateAppOverride(settings)` | App-Override setzen |
| `removeAppOverride()` | App-Override löschen |

## Features

### Optimistic Updates

Änderungen werden sofort in der UI angezeigt, bevor die Server-Antwort eintrifft. Bei einem Fehler wird automatisch auf den vorherigen Zustand zurückgesetzt.

### localStorage Cache

Settings werden lokal gecached für:
- Schnelle UI beim App-Start (keine Wartezeit auf Server)
- Offline-Unterstützung (letzte bekannte Settings)

Cache-Key: `mana-user-settings-{appId}`

### Deep Merge

Partielle Updates werden automatisch gemerged:

```typescript
// Nur colorScheme ändern, mode bleibt erhalten
await userSettings.updateGlobal({
  theme: { colorScheme: 'nature' }
});
// Ergebnis: { theme: { mode: 'system', colorScheme: 'nature' } }
```

## Datenbank-Schema

Tabelle: `auth.user_settings`

| Column | Type | Beschreibung |
|--------|------|--------------|
| `user_id` | TEXT (PK) | Referenz zu auth.users |
| `global_settings` | JSONB | Globale Einstellungen |
| `app_overrides` | JSONB | Pro-App Überschreibungen |
| `created_at` | TIMESTAMP | Erstellungszeitpunkt |
| `updated_at` | TIMESTAMP | Letzte Aktualisierung |

## Dateien

### Backend (mana-auth)

| Datei | Beschreibung |
|-------|--------------|
| `src/settings/settings.module.ts` | NestJS Module |
| `src/settings/settings.controller.ts` | REST API Endpoints |
| `src/settings/settings.service.ts` | Business Logic |
| `src/settings/dto/index.ts` | DTOs für Requests |
| `src/db/schema/auth.schema.ts` | Drizzle Schema (`userSettings`) |

### Shared Package

| Datei | Beschreibung |
|-------|--------------|
| `packages/shared-theme/src/user-settings-store.svelte.ts` | Svelte 5 Store Factory |
| `packages/shared-theme/src/types.ts` | TypeScript Interfaces |

### App Integration (Beispiel Calendar)

| Datei | Beschreibung |
|-------|--------------|
| `apps/calendar/apps/web/src/lib/stores/user-settings.svelte.ts` | Store-Instanz |
| `apps/calendar/apps/web/src/routes/+layout.svelte` | Integration in Layout |

## Integrierte Apps

Folgende Apps nutzen bereits die zentralen User Settings:

- Calendar (`calendar`)
- Chat (`chat`)
- Contacts (`contacts`)
- Mana (`mana`)
- Cardecky (`cards`)
- Picture (`picture`)
- Presi (`presi`)
- Storage (`storage`)
- Quotes (`quotes`)

## Neue App integrieren

1. **Store erstellen** in `src/lib/stores/user-settings.svelte.ts`:
   ```typescript
   import { createUserSettingsStore } from '@mana/shared-theme';
   import { authStore } from './auth.svelte';

   export const userSettings = createUserSettingsStore({
     appId: 'my-app',  // Eindeutige ID
     authUrl: import.meta.env.PUBLIC_MANA_AUTH_URL,
     getAccessToken: () => authStore.getAccessToken()
   });
   ```

2. **Im Layout laden** nach Auth-Check:
   ```typescript
   if (authStore.isAuthenticated) {
     await userSettings.load();
   }
   ```

3. **Settings verwenden**:
   ```svelte
   <PillNavigation desktopPosition={userSettings.nav.desktopPosition} />
   ```
