---
date: 2025-12-08
day: 14
view: macher
weekday: Montag
commits: 34
review: written
---

# Montag, 2025-12-08 — Tag 14 (Macher-Sicht)

## Stats

34 Commits, +5273 / −3519 LoC, 90 Files. Top-Dirs: `apps/manacore/apps/web` (23%), `apps/calendar/apps/web` (9%), `apps/clock/apps/web` (9%), `apps/todo/apps/web` (8%), `services/mana-core-auth/src` (7%). Tags: ci, web, staging, todo-web, docker. Session 11:53 → 01:13 (~358 aktive Min, längster Fokus 141 Min).

## Commits

- `8de629d` 🚀 ci: add dev branch workflow with PR validation (+80/-13)
- `e423785` 🔧 ci: remove auto-deploy, keep manual/tag-based only (+6/-21)
- `67a15cc` 🧑‍💻 dx: add automatic database setup and dev:\*:full commands (+515/-18)
- `541e227` 🙈 chore: ignore claude-flow metrics from git tracking (+1/-662)
- `60756f7` small linting fixes (+5/-7)
- `bb4e12c` 🐛 fix: resolve auth issues in Manacore, Calendar, and Clock apps (+35/-69)
- `5e0b5a8` 🚀 ci: add Docker deployment for Manacore, Todo, Calendar, and Clock apps (+898/-0)
- `63a5674` 🐛 fix: add build args for SvelteKit env vars in web Dockerfiles (+38/-0)
- `f0d57c1` 🐛 fix: switch web apps to adapter-node for Docker builds (+482/-287)
- `48c5cb4` 🐛 fix: add MIDDLEWARE_URL to manacore-web Dockerfile (+2/-0)
- `ee091c4` ♻️ refactor: migrate manacore-web from Supabase to mana-core-auth (+350/-632)
- `9746db1` 🚀 ci: add manacore, todo, calendar, clock to tagged deployment workflow (+35/-4)
- `59ce92a` 🔧 fix: deployment workflow - lowercase image prefix, service names, and port fixes (+15/-7)
- `73dfe57` 🔧 fix: add GHCR authentication for staging server (+6/-0)
- `3485bf0` fix(ci): use GITHUB_TOKEN for GHCR auth on staging server (+1/-1)
- `aa8cbb1` fix(ci): correct health check path for backend deployments (+1/-1)
- `17c4932` fix(todo-web): remove silent npm install failure in Dockerfile (+1/-1)
- `ef44c06` fix(web): remove silent npm install failures in all web Dockerfiles (+4/-4)
- `75d9d18` fix(web): copy node_modules from builder instead of npm install (+10/-20)
- `fd1c0ee` fix(docker): preserve pnpm symlink structure in web Dockerfiles (+45/-15)

_… plus 14 weitere Commits._
