---
date: 2025-12-15
day: 21
view: macher
weekday: Montag
commits: 31
review: written
---

# Montag, 2025-12-15 — Tag 21 (Macher-Sicht)

## Stats

31 Commits, +9198 / −2487 LoC, 227 Files. Top-Dirs: `apps/manacore/apps/web` (15%), `apps/calendar/apps/web` (11%), `apps/clock/apps/web` (9%), `apps/contacts/apps/web` (8%), `apps/chat/apps/web` (6%). Tags: manacore-web, auth, runtime-config, deps, storage. Session 13:10 → 04:10 (~216 aktive Min, längster Fokus 52 Min).

## Commits

- `660cbd6` Merge branch 'dev' into till-dev (+0/-0)
- `3011d77` ♻️ refactor(contacts,zitare): use dynamic runtime URLs in auth stores (+49/-9)
- `eebc370` 📝 docs: update runtime URL injection checklist (+14/-12)
- `9238ff7` Merge pull request #18 from Memo-2023/till-dev (+0/-0)
- `b949037` 🔧 chore: add svelte-check to pre-commit hooks (+195/-1)
- `42e5e97` ♿️ fix: resolve all svelte-check a11y warnings across web apps (+1048/-558)
- `272132c` 🙈 chore: remove .claude-flow from git tracking (+0/-98)
- `44e28bb` ♿️ fix(worldream): add a11y attributes to modal and dialog components (+14/-2)
- `263d779` 🐛 fix: resolve CI/CD build failures for manacore-web and todo-web (+17/-15)
- `1480638` 🔧 chore: add pre-push build validation for changed apps (+105/-3)
- `f414aec` 📝 docs: add staging URLs and modernize README (+124/-57)
- `2c30867` 🔧 refactor: implement 12-factor runtime config for all web apps (+1594/-608)
- `b8d1067` 🐛 fix: use dynamic env for MIDDLEWARE_URL in server middleware (+3/-1)
- `22af718` fix(runtime-config): add missing zod dependency to Clock and Contacts web apps (+349/-220)
- `5c594a4` fix(deps): add missing zod dependency to Calendar and Chat web apps for CI (+8/-6)
- `9b55f10` fix(manacore-web): fix Docker entrypoint path for config.json (+5/-2)
- `b2a8ffa` fix(manacore-web): await getAuthUrl() and use runtime config in user-settings (+13/-13)
- `aab8c73` feat: add multi-layered runtime config protection system (+945/-0)
- `d268e8e` docs: add comprehensive session report for runtime config implementation (+1078/-0)
- `78cd59a` feat(storage): unified single-bucket architecture with Hetzner S3 (+226/-252)

_… plus 11 weitere Commits._
