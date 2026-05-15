---
date: 2025-12-01
day: 8
view: macher
weekday: Montag
commits: 27
review: written
---

# Montag, 2025-12-01 — Tag 8 (Macher-Sicht)

## Stats

27 Commits, +49204 / −28026 LoC, 372 Files. Top-Dirs: `services/mana-core-auth/src` (11%), `games/mana-games/apps` (9%), `apps/picture/apps/backend` (5%), `apps/chat/apps/web` (5%), `services/mana-core-auth/test` (4%). Tags: ci, picture, feedback, apps, zitare. Session 12:30 → 01:43 (~142 aktive Min, längster Fokus 87 Min).

## Commits

- `2a002bf` first auth impl (+13348/-6069)
- `a09c389` fix(picture): resolve hydration error and CORS issues (+85/-9)
- `51edd52` refactor(picture): remove Supabase dependency, migrate to NestJS backend (+1627/-986)
- `1f2d21e` feat(feedback): add feedback pages to all archived web apps (+241/-431)
- `4e4db46` feat(apps): add unified Apps page and PillNavigation to all web apps (+1354/-538)
- `6cfab65` feat(zitare): add vertical scroll-snap quote feed with infinite scroll (+165/-40)
- `8dd1e43` 🐛 fix(auth): use Better Auth native JWT validation with EdDSA (+498/-480)
- `0805713` 🐛 fix(chat): use correct token storage key from shared-auth (+2/-1)
- `bc27484` 📝 docs(auth): add comprehensive auth architecture documentation (+530/-0)
- `746df03` ✅ test(auth): update tests for minimal JWT claims architecture (+209/-641)
- `8a43bbf` 🔀 merge: auth/complete branch with Better Auth implementation (+0/-0)
- `64c82a1` 🐛 fix(presi): resolve auth token mismatch and add feedback navigation (+30/-20)
- `1e2cc03` ✨ feat(shared-auth-ui): add theme toggle to auth pages (+183/-85)
- `a51e065` 🚸 feat(shared-ui): improve PillNavigation mobile responsiveness (+123/-4)
- `f8258b8` docs (+2/-5)
- `1d5f49a` Merge branch 'main' of https://github.com/Memo-2023/manacore-monorepo (+0/-0)
- `942c588` 🔒️ feat(auth): centralize JWT validation via mana-core-auth (+1125/-313)
- `5b0b309` 🔒️ feat(auth): centralize JWT validation and add deployment docs (+11916/-718)
- `5282f55` fix(ci): handle missing coverage artifacts gracefully (+10/-1)
- `0ebfde0` fix(ci): build shared packages before tests and fix formatting (+16214/-15644)

_… plus 7 weitere Commits._
