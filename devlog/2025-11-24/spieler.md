---
date: 2025-11-24
day: 2
view: spieler
weekday: Montag
commits: 25
review: written
---

# Montag, 2025-11-24 — Tag 2

Dichter Tag in **uload** und Umgebung.

## Highlights

- Commit Message feat: implement comprehensive shared packages architecture for monorepo SUMMARY: Introduce 10 shared packages to unify common code across all 4 web apps, reducing ~3,000 lines of duplicated code and establishing consistent patterns for authentication, UI components, theming, and utilities. NEW SHARED PACKAGES: - @manacore/shared-auth: Unified auth logic (token management, JWT utils, fetch interceptor, storage/device/network adapters) - @manacore/shared-auth-ui: Reusable auth UI (LoginPage, RegisterPage, OAuth buttons for Google/Apple) - @manacore/shared-tailwind: Unified Tailwind config with 4 themes (lume, nature, stone, ocean) and light/dark mode support - @manacore/shared-icons: Phosphor-based icon library (40+ icons) - @manacore/shared-ui: Atomic design system (Text, Button, Badge, Toggle, Input, Modal) - @manacore/shared-i18n: Unified i18n setup with locale detection - @manacore/shared-config: Environment validation with Zod - @manacore/shared-subscriptio n-types: Subscription type definitions - @manacore/shared-subscriptio n-ui: Subscription UI components (planned) EXTENDED PACKAGES: - @manacore/shared-types: Added auth.ts, theme.ts, ui.ts, common.ts - @manacore/shared-utils: Added format.ts, validation.ts APP MIGRATIONS: - memoro/web: Migrated login (549→46 LOC), tailwind (165→12 LOC), removed 15+ duplicate components - manacore/web: Migrated to client-side auth with shared-auth, added new components (Icon, ThemeToggle, Logo) - manadeck/web: Replaced local authService/tokenManager with shared-auth, migrated auth pages - maerchenzauber/web: Added auth setup, stores, components, routes DELETED FILES (migrated to shared packages): - OAuth buttons (Google/Apple) from memoro, manacore, manadeck - Local authService, tokenManager, deviceManager, jwt utils - Duplicate Modal, Toggle, Text components - iconPaths and ManaIcon components - Subscription-related components (CostCard, PackageCard, etc.) BENEFITS: - 92% reduction in login page code - 93% reduction in tailwind config code - Consistent theming across all apps - Single source of truth for auth logic - Easier maintenance and updates BREAKING CHANGES: - Icon imports now from @manacore/shared-icons - Modal imports from @manacore/shared-ui - OAuth config via setGoogleCl ientId()/setAppleConfig()
- implement unified theme system across all web apps
- unify UI components, AppSlider, and login screens across apps
- add navigation components and form elements
- add shared-branding package and extend shared-utils
