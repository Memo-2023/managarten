---
date: 2026-02-12
day: 45
view: macher
weekday: Donnerstag
commits: 22
review: written
---

# Donnerstag, 2026-02-12 — Tag 45 (Macher-Sicht)

## Stats

22 Commits, +9395 / −126 LoC, 84 Files. Top-Dirs: `scripts/mac-mini/launchd` (14%), `apps/storage/apps/backend` (8%), `services/mana-core-auth/src` (7%), `apps/clock/apps/backend` (7%), `apps/photos/apps/backend` (7%). Tags: matrix, admin, docker, auth, monitoring. Session 11:51 → 13:35 (~104 aktive Min, längster Fokus 104 Min).

## Commits

- `2fe7f84` 🔧 fix(mac-mini): add container recovery and update health check ports (+261/-33)
- `759b227` 🔧 fix(mac-mini): correct user path in LaunchD plist (+1/-1)
- `9881e84` ✨ feat(auth): add GDPR self-service endpoints for user data (+928/-13)
- `3e37003` 🔧 fix(docker): build mana-search and skilltree-web locally (+15/-2)
- `bc8cd98` fix(auth): correct MeController route prefix (+1/-1)
- `6548d83` 🐛 fix(mana-search): use pnpm deploy to fix symlink issue in Docker (+5/-4)
- `177e4ee` fix(docker): add missing shared packages to manacore-web Dockerfile (+5/-0)
- `d5e18c9` 🔧 fix(mac-mini): update health checks and disable missing services (+3702/-10)
- `7d40946` fix(docker): add backend URLs to auth service for GDPR data aggregation (+8/-0)
- `3de2f25` ✨ feat(mac-mini): add stability improvements (+615/-23)
- `02a5172` feat(admin): add GDPR user-data endpoints to photos, clock, storage backends (+830/-1)
- `acc8de3` feat(monitoring): add alerting stack and maintenance scripts (+996/-10)
- `42c0069` fix(admin): remove duplicate api/v1 prefix from controller routes (+3/-3)
- `cdb6e25` fix(admin): storage backend needs api/v1 prefix in controller (+1955/-11)
- `650f4f6` fix(matrix): add missing props to Message.svelte interface (+4/-0)
- `7a2acd4` 🐛 fix(admin): remove api/v1 prefix from admin controllers (+7/-7)
- `027d3d2` feat(matrix): restore last selected chat on app load (+15/-0)
- `cb08931` 🔧 chore(docker): build presi-backend locally on Mac Mini (+4/-1)
- `aa13473` 🐛 fix(calendar): change user ID fields to text type (+3/-3)
- `5cd067a` fix(matrix): check \_rooms array for last room restoration (+6/-2)

_… plus 2 weitere Commits._
