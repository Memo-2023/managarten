---
date: 2025-11-24
day: 2
view: macher
weekday: Montag
commits: 25
review: written
---

# Montag, 2025-11-24 — Tag 2 (Macher-Sicht)

## Stats

25 Commits, +233767 / −33690 LoC, 1557 Files. Top-Dirs: `uload/apps/web` (15%), `picture/apps/mobile` (9%), `picture/apps/landing` (9%), `memoro/apps/web` (7%), `picture/apps/web` (6%). Tags: manadeck, shared-ui, maerchenzauber/web, landing. Session 20:09 → 03:00 (~188 aktive Min, längster Fokus 92 Min).

## Commits

- `ef70a1a` Commit Message feat: implement comprehensive shared packages architecture for monorepo SUMMARY: Introduce 10 shared packages to unify common code across all 4 web apps, reducing ~3,000 lines of duplicated code and establishing consistent patterns for authentication, UI components, theming, and utilities. NEW SHARED PACKAGES: - @manacore/shared-auth: Unified auth logic (token management, JWT utils, fetch interceptor, storage/device/network adapters) - @manacore/shared-auth-ui: Reusable auth UI (LoginPage, RegisterPage, OAuth buttons for Google/Apple) - @manacore/shared-tailwind: Unified Tailwind config with 4 themes (lume, nature, stone, ocean) and light/dark mode support - @manacore/shared-icons: Phosphor-based icon library (40+ icons) - @manacore/shared-ui: Atomic design system (Text, Button, Badge, Toggle, Input, Modal) - @manacore/shared-i18n: Unified i18n setup with locale detection - @manacore/shared-config: Environment validation with Zod - @manacore/shared-subscriptio n-types: Subscription type definitions - @manacore/shared-subscriptio n-ui: Subscription UI components (planned) EXTENDED PACKAGES: - @manacore/shared-types: Added auth.ts, theme.ts, ui.ts, common.ts - @manacore/shared-utils: Added format.ts, validation.ts APP MIGRATIONS: - memoro/web: Migrated login (549→46 LOC), tailwind (165→12 LOC), removed 15+ duplicate components - manacore/web: Migrated to client-side auth with shared-auth, added new components (Icon, ThemeToggle, Logo) - manadeck/web: Replaced local authService/tokenManager with shared-auth, migrated auth pages - maerchenzauber/web: Added auth setup, stores, components, routes DELETED FILES (migrated to shared packages): - OAuth buttons (Google/Apple) from memoro, manacore, manadeck - Local authService, tokenManager, deviceManager, jwt utils - Duplicate Modal, Toggle, Text components - iconPaths and ManaIcon components - Subscription-related components (CostCard, PackageCard, etc.) BENEFITS: - 92% reduction in login page code - 93% reduction in tailwind config code - Consistent theming across all apps - Single source of truth for auth logic - Easier maintenance and updates BREAKING CHANGES: - Icon imports now from @manacore/shared-icons - Modal imports from @manacore/shared-ui - OAuth config via setGoogleCl ientId()/setAppleConfig() (+11114/-3657)
- `96e0ace` feat: implement unified theme system across all web apps (+2980/-1076)
- `22cb7d2` feat: unify UI components, AppSlider, and login screens across apps (+893/-22130)
- `afdc30b` feat(shared-ui): add navigation components and form elements (+1536/-22)
- `7d426d5` feat: add shared-branding package and extend shared-utils (+493/-1)
- `74ccad3` feat: unify utilities into shared packages (Tier 1) (+878/-648)
- `f93cb99` fix: add missing @manacore/shared-branding dependency to web apps (+43/-12)
- `1032502` feat: add Tier 2 shared components (stats, tags, media) (+513/-304)
- `9449fff` feat: add Tier 3 shared auth store patterns (+717/-0)
- `294d1fc` refactor: consolidate app logos into shared-branding package (Tier 4) (+112/-121)
- `c87641f` feat: add shared credit service package (Tier 5) (+619/-12)
- `3c457f9` feat: add layout components to shared-ui (Tier 6) (+413/-7)
- `5045d70` feat: add form and layout components to shared-ui (Tier 6b) (+505/-1)
- `cacbd61` feat: add sidebar enhancement components (Tier 7) (+306/-4)
- `bd869df` feat: unify navigation with shared PillNavigation component (+984/-1520)
- `926ca23` feat: add i18n localization with language switcher to all web apps (+7051/-2237)
- `39a9a61` fix(manadeck): update Badge and Button variants to match shared-ui (+3/-3)
- `10cb295` feat: add localized AppSlider translations for all web apps (+1084/-69)
- `9c584a2` feat(maerchenzauber/web): add missing features for mobile app parity (+3077/-10)
- `84f9343` Feat: Login localization, design, märchenzauber feature complete webapp (+3229/-150)

_… plus 5 weitere Commits._
