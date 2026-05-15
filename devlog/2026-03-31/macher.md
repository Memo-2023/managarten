---
date: 2026-03-31
day: 70
view: macher
weekday: Dienstag
commits: 114
review: written
---

# Dienstag, 2026-03-31 — Tag 70 (Macher-Sicht)

## Stats

114 Commits, +343823 / −27132 LoC, 2066 Files. Top-Dirs: `apps/memoro/apps/landing` (28%), `apps/memoro/apps/mobile` (24%), `apps/memoro/apps/web` (9%), `apps/todo/apps/web` (6%), `apps/memoro/apps/backend` (5%). Tags: todo, guides, auth, contacts, auth-ui. Session 09:02 → 20:23 (~387 aktive Min, längster Fokus 162 Min).

## Commits

- `a545bb6` refactor(todo): move edit button from FAB to PillNav, share state via context (+47/-74)
- `e68e5c6` refactor(shared-ui): unify icon system to Phosphor, remove SVG path fallbacks (+134/-330)
- `9f6e463` refactor(calendar,contacts): replace inline SVGs with Phosphor icons (+365/-1717)
- `3f2e6a3` feat(todo): unify view modes into single route with Fokus/Übersicht/Matrix layouts (+709/-1803)
- `f58d58f` refactor(apps): replace inline SVGs with Phosphor icons across 19 apps (+179/-687)
- `504e775` refactor(apps): automated SVG-to-Phosphor migration across all apps (+780/-3083)
- `59e535a` refactor(todo): move ViewSelector behind Layout pill, simplify homepage (+135/-451)
- `25e3962` refactor(apps): final SVG-to-Phosphor pass for photos, clock, mukke, inventar (+65/-350)
- `47f981f` refactor(shared-ui): replace remaining inline SVGs with Phosphor icons (+119/-477)
- `14df2cd` fix(auth): declare accessTier as additionalField so Better Auth includes it in user object (+11/-0)
- `c02e264` docs: add Phosphor icon guidelines to code-style.md (+32/-0)
- `56f89b8` fix(shared-ui): resolve Tag identifier collision in TagList (+2/-2)
- `74ff066` simplify(todo): single view with edit mode, remove ViewSelector (+12/-88)
- `101f20e` refactor(todo,calendar): extract duplicated constants and utilities (+438/-371)
- `52e09e4` refactor(todo): merge TagStrip into unified filter strip (+53/-55)
- `bc17889` refactor(contacts,todo): extract shared utilities, eliminate duplication (+67/-106)
- `3211878` feat(todo): add clickable Tags label pill linking to /tags management (+41/-13)
- `4872bc0` refactor(contacts): extract error helper, field labels, match type labels (+60/-40)
- `8465383` refactor(todo): replace Mehr dropdown with inline project pills, add Filter label (+46/-121)
- `b354195` refactor(contacts): apply getErrorMessage helper to remaining files (+11/-9)

_… plus 94 weitere Commits._
