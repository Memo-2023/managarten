# Shared Packages Roadmap

This document outlines the plan to unify common code across all web apps in the monorepo.

## Current Shared Packages

- [x] `@mana/shared-icons` - Unified Phosphor Icons for all web apps
- [x] `@mana/shared-ui` - Unified UI Components (Text, Button, Badge, Toggle, Input, Modal, Card, Navigation, Forms)
- [x] `@mana/shared-auth` - Unified Auth Logic (Supabase client, token management)
- [x] `@mana/shared-auth-ui` - Unified Auth UI (LoginPage, RegisterPage, OAuth buttons)
- [x] `@mana/shared-tailwind` - Unified Tailwind Config (HSL colors, preset, themes.css)
- [x] `@mana/shared-theme` - Unified Theme Store (Svelte 5, 4 variants, light/dark/system)
- [x] `@mana/shared-theme-ui` - Theme UI Components (ThemeToggle, ThemeSelector)
- [x] `@mana/shared-utils` - Unified Utilities (formatting, validation, async, date, keyboard)
- [x] `@mana/shared-types` - Unified TypeScript Types
- [x] `@mana/shared-i18n` - Unified i18n (languages, locale detection, translations)
- [x] `@mana/shared-config` - Unified Config (env validation)
- [x] `@mana/shared-branding` - **NEW** Unified App Branding (logos, colors, app config)
- [x] `@mana/shared-subscription-types` - Subscription Type Definitions
- [x] `@mana/shared-subscription-ui` - Subscription UI Components

---

## Recently Completed (2025-11-24)

### App Migration to Shared Packages

All web apps now use the shared packages consistently:

**Logo Components** - Migrated to `@mana/shared-branding`:

- `memoro/apps/web/src/lib/components/MemoroLogo.svelte` → uses `AppLogo`
- `cards/apps/web/src/lib/components/CardsLogo.svelte` → uses `AppLogo`
- `mana/apps/web/src/lib/components/ManaLogo.svelte` → uses `AppLogo`
- `maerchenzauber/apps/web/src/lib/components/StorytellerLogo.svelte` → uses `AppLogo`

**Formatter Functions** - Migrated to `@mana/shared-utils`:

- `memoro/apps/web/src/lib/components/memo/AdditionalRecordings.svelte` → uses `formatDurationFromMs`, `formatFileSize`
- `memoro/apps/web/src/lib/components/RecordingButton.svelte` → uses `formatDuration`
- `memoro/apps/web/src/lib/components/statistics/OverviewCard.svelte` → uses `formatDurationWithUnits`
- `memoro/apps/web/src/lib/components/statistics/InsightsCard.svelte` → uses `formatDurationWithUnits`
- `memoro/apps/web/src/lib/components/statistics/ProductivityCard.svelte` → uses `formatDurationWithUnits`

---

## Planned Shared Packages

### 1. Shared UI Components (`@mana/shared-ui`)

**Status**: Done
**Priority**: High
**Estimated LOC Savings**: 500-800 per app

**Components to unify**:

- `Button.svelte` - Primary, secondary, ghost, danger variants
- `Input.svelte` - Text input with label, error states
- `Text.svelte` - Typography component with variants
- `Modal.svelte` - Overlay modal with header, body, footer slots
- `Spinner.svelte` - Loading indicator
- `Toast.svelte` - Notification toasts
- `Badge.svelte` - Status badges
- `Card.svelte` - Content container
- `Dropdown.svelte` - Select/dropdown menus

**Apps using these**:

- Mana Web
- Memoro Web
- Maerchenzauber Web
- Cardecky Web

---

### 2. Shared Auth (`@mana/shared-auth`)

**Status**: Done
**Priority**: High
**Estimated LOC Savings**: 800-1200 per app

**Modules to unify**:

- `tokenManager.ts` - JWT token storage, refresh, validation
- `authService.ts` - Login, logout, register, password reset
- `supabaseClient.ts` - Authenticated Supabase client factory
- `authStore.ts` - Svelte store for auth state
- `authGuard.ts` - Route protection utilities

**Considerations**:

- Each app may have different Supabase projects
- Token storage strategy (localStorage vs cookies)
- OAuth providers per app

---

### 3. Shared Tailwind Config (`@mana/shared-tailwind`)

**Status**: Done
**Priority**: High
**Estimated Benefit**: Consistent branding, easier theme updates

**Config unified**:

- Color palette (primary, secondary, accent colors)
- Theme variants (Lume, Nature, Stone, Ocean) with light/dark modes
- Typography scale (font sizes, line heights)
- Border radius tokens
- Shadow tokens
- CSS variable-based theming system

**Structure**:

```
packages/shared-tailwind/
├── package.json
├── src/
│   ├── index.js           # Main exports
│   ├── preset.js          # Tailwind preset with all tokens
│   ├── colors.js          # Color definitions (4 themes)
│   ├── theme-variables.css # CSS variables for themes
│   └── components.css     # Component utilities
```

**Apps using this**:

- Memoro Web (full migration with theme.css + components.css)
- Mana Web (preset only, keeps local colors)
- Cardecky Web (colors import, HSL-based system)
- Maerchenzauber Web (dependency added)

---

### 4. Shared Utilities (`@mana/shared-utils`)

**Status**: Done
**Priority**: Medium
**Estimated LOC Savings**: 200-400 per app

**Utilities included**:

- `date.ts` - formatDate, formatRelativeTime, toISOString
- `format.ts` - formatDuration, formatFileSize, formatNumber, formatCurrency, formatPercent
- `validation.ts` - isValidEmail, isValidUrl, isValidPhone, validatePassword, isValidUuid
- `string.ts` - truncate, capitalize, generateId, slugify
- `async.ts` - sleep, retry, debounce

---

### 5. Shared Types (`@mana/shared-types`)

**Status**: Planned
**Priority**: Medium
**Estimated Benefit**: Type safety across packages

**Types to unify**:

- `User` - Common user type
- `ApiResponse<T>` - Standard API response wrapper
- `PaginatedResponse<T>` - Pagination types
- `Theme` - Theme configuration types
- `Locale` - i18n locale types

**Note**: App-specific database types (Supabase generated) should remain in each app.

---

### 6. Shared i18n (`@mana/shared-i18n`)

**Status**: Done
**Priority**: Medium
**Estimated LOC Savings**: 100-300 per app

**Modules to unify**:

- `i18n.ts` - svelte-i18n setup and initialization
- `detectLocale.ts` - Browser language detection
- Common translations:
  - Error messages
  - UI labels (Save, Cancel, Delete, etc.)
  - Date/time formats
  - Validation messages

**Structure**:

```
packages/shared-i18n/
├── package.json
├── src/
│   ├── index.ts
│   ├── setup.ts
│   ├── detectLocale.ts
│   └── translations/
│       ├── common/
│       │   ├── en.json
│       │   └── de.json
│       └── errors/
│           ├── en.json
│           └── de.json
```

---

### 7. Shared Config (`@mana/shared-config`)

**Status**: Planned
**Priority**: Low
**Estimated Benefit**: Consistent env handling

**Config to unify**:

- Environment variable validation (Zod schemas)
- API endpoint construction
- Feature flag utilities
- App metadata (version, name, etc.)

---

## Implementation Order

1. **Phase 1** (Completed)
   - [x] `@mana/shared-icons`
   - [x] `@mana/shared-ui`

2. **Phase 2** (Completed)
   - [x] `@mana/shared-auth`
   - [x] `@mana/shared-auth-ui`
   - [x] `@mana/shared-tailwind`

3. **Phase 3** (Completed)
   - [x] `@mana/shared-utils`
   - [x] `@mana/shared-types`

4. **Phase 4** (Completed)
   - [x] `@mana/shared-i18n`
   - [x] `@mana/shared-config`

---

## Guidelines for Shared Packages

### Package Structure

```
packages/shared-{name}/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts        # Public exports
│   └── ...
└── README.md
```

### Package.json Template

```json
{
	"name": "@mana/shared-{name}",
	"version": "0.1.0",
	"private": true,
	"type": "module",
	"main": "./src/index.ts",
	"types": "./src/index.ts",
	"exports": {
		".": "./src/index.ts"
	},
	"peerDependencies": {
		"svelte": "^5.0.0"
	}
}
```

### Best Practices

1. **Keep it minimal** - Only share truly common code
2. **Document props** - Use TypeScript interfaces with JSDoc
3. **Version carefully** - Coordinate updates across apps
4. **Test thoroughly** - Changes affect all apps
5. **Avoid breaking changes** - Use deprecation warnings

---

## Package Details

### `@mana/shared-branding`

Centralized branding configuration for all Mana ecosystem apps.

**Exports**:

- `AppLogo` - SVG logo component that renders app-specific logo
- `AppLogoWithName` - Logo with app name and tagline
- `ManaIcon` - Generic Mana icon component
- `APP_BRANDING` - Configuration object with colors, names, taglines
- `AppId` type - Union type of all app IDs

**Usage**:

```svelte
<script>
	import { AppLogo } from '@mana/shared-branding';
</script>

<AppLogo app="memoro" size={32} />
<AppLogo app="mana" size={55} color="#fff" />
```

### `@mana/shared-utils/format`

Duration and formatting utilities.

**Exports**:

- `formatDuration(seconds)` - Returns `MM:SS` or `HH:MM:SS`
- `formatDurationFromMs(ms)` - Converts milliseconds first
- `formatDurationWithUnits(seconds, locale)` - Returns `2h 30m` style
- `formatDurationHumanReadable(seconds, locale)` - Returns `2 Stunden 30 Minuten`
- `formatFileSize(bytes)` - Returns `1.5 MB`
- `formatNumber(num, locale)` - Locale-aware number formatting
- `formatCurrency(amount, currency, locale)` - Currency formatting
- `formatPercent(value, decimals, locale)` - Percentage formatting

---

## Notes

- Created: 2025-11-24
- Last Updated: 2025-11-24
- Author: Claude Code
