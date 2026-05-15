---
date: 2026-03-20
day: 59
view: macher
weekday: Freitag
commits: 52
review: written
---

# Freitag, 2026-03-20 — Tag 59 (Macher-Sicht)

## Stats

52 Commits, +13375 / −5388 LoC, 201 Files. Top-Dirs: `apps/calendar/apps/web` (22%), `packages/shared-storage/src` (11%), `apps/mukke/apps/web` (6%), `apps/contacts/apps/backend` (3%), `apps/picture/apps/web` (3%). Tags: calendar, storage, picture, auth, docker. Session 15:38 → 20:13 (~163 aktive Min, längster Fokus 75 Min).

## Commits

- `a183640` refactor(docker): switch calendar-web to local build (+4/-1)
- `58bdf98` fix(calendar): add patches dir to web Dockerfile (+3/-0)
- `98d1d1c` fix(calendar): add shared-pwa package to web Dockerfile (+1/-0)
- `93e1c7d` refactor(calendar): simplify settings from 41 to 18 persisted preferences (+303/-478)
- `26d8eb0` fix(calendar): add shared-app-onboarding to web Dockerfile (+1/-0)
- `a5940ab` feat(mukke): clickable songs in library, player error handling & cover fallbacks (+125/-9)
- `3f91c46` feat(infra): add deploy tracking with PostgreSQL, Pushgateway & Grafana dashboard (+928/-33)
- `dea632c` fix(caddy): update all reverse proxy ports to match docker containers (+13/-13)
- `67326b7` fix(shared-api-client): add useRuntimeUrl flag for cross-app clients (+7/-1)
- `70b1c44` test(mukke): add vitest setup and 34 frontend tests for player & library stores (+658/-2)
- `e124869` fix(infra): make deploy tracking Bash 3.x compatible (macOS runner) (+42/-46)
- `e7fb207` fix(docker): add cross-app CORS origins to todo-backend (+1/-1)
- `d3a3bc7` refactor(calendar): remove tag groups hierarchy and legacy drag-drop composables (+213/-2281)
- `42fe39c` fix(infra): fix deploy tracking dashboard datasource UIDs and instant queries (+6/-0)
- `1057d69` ci(cd): add mukke-backend and mukke-web to CD pipeline (+9/-1)
- `43a2226` perf(auth): optimize Dockerfile from ~740MB to ~350MB (+18/-19)
- `ab42c26` feat(calendar): add CalDAV/iCal sync UI and recurring events support (+1720/-2)
- `41fbd2f` feat(storage): improve shared-storage robustness, scalability, and DX (+1315/-648)
- `9858723` perf(auth): optimize Dockerfile from ~740MB to ~320MB (+10/-3)
- `eb859c1` fix(auth): use SameSite=None for cross-subdomain SSO (+4/-2)

_… plus 32 weitere Commits._
