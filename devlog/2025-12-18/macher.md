---
date: 2025-12-18
day: 24
view: macher
weekday: Donnerstag
commits: 11
review: written
---

# Donnerstag, 2025-12-18 — Tag 24 (Macher-Sicht)

## Stats

11 Commits, +11359 / −4314 LoC, 92 Files. Top-Dirs: `services/mana-core-auth/src` (34%), `packages/shared-error-tracking/src` (10%), `.github/workflows/cd-staging.yml` (2%), `docker-compose.staging.yml` (2%), `services/mana-core-auth/scripts` (2%). Tags: —. Session 16:03 → 02:26 (~48 aktive Min, längster Fokus 46 Min).

## Commits

- `1cd04a5` Merge branch 'dev' into till-dev (+0/-0)
- `4d15d9e` 🔒 security(auth): migrate to EdDSA JWT and add automated monitoring (+6871/-4155)
- `7f35753` 🐛 fix(auth-migrations): make initial migration idempotent (+139/-139)
- `5bb1abb` 🐛 fix(auth-migrations): add missing session columns migration (+74/-0)
- `ffc41b2` 🐛 fix(auth-migrations): use native ADD COLUMN IF NOT EXISTS syntax (+40/-2)
- `f834986` 🐛 fix(ci): add db:push fallback when migrations fail (+8/-3)
- `5e1118b` ✨ feat(error-tracking): add shared error tracking package (+1033/-0)
- `319ccd1` ✨ feat(auth): add error logs API and database schema (+527/-0)
- `9e771c9` 🔧 chore(auth): improve migration safety and docker setup (+353/-5)
- `2784143` 📝 docs: add error tracking and security documentation (+2287/-0)
- `834b11d` 🐛 fix(staging): add missing PUBLIC\_\*\_CLIENT env vars for runtime config (+27/-10)
