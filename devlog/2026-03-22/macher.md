---
date: 2026-03-22
day: 61
view: macher
weekday: Sonntag
commits: 27
review: written
---

# Sonntag, 2026-03-22 — Tag 61 (Macher-Sicht)

## Stats

27 Commits, +5493 / −2856 LoC, 191 Files. Top-Dirs: `apps/mukke/apps/web` (8%), `apps/storage/apps/web` (6%), `apps/todo/apps/web` (6%), `apps/manacore/apps/web` (5%), `apps/calendar/apps/web` (5%). Tags: analytics, storage, mukke, manacore, calendar. Session 16:40 → 18:16 (~96 aktive Min, längster Fokus 96 Min).

## Commits

- `fa116df` feat(manacore): add App Hub as new default home page (+508/-3)
- `28d8cfc` fix(manacore): copy patches directory in Dockerfile for pnpm install (+1/-0)
- `79becc9` fix(calendar): add auth gate to prevent 401 errors and fix CSP for analytics (+118/-106)
- `6b2b703` fix(calendar): scroll to current time and show time label on indicator (+24/-9)
- `97b6100` fix(storage): use runtime env vars instead of hardcoded localhost URLs (+80/-2)
- `93a7c90` feat(storage): add storage to CD pipeline and fix Docker config (+21/-13)
- `9bdb997` refactor(pwa): replace custom service workers with Vite PWA plugin and centralize offline page (+262/-2023)
- `50d084b` fix(todo): add missing patches directory to web Dockerfile (+3/-0)
- `db2a0e6` fix(storage): copy patches directory in Dockerfile for pnpm install (+1/-0)
- `87516bb` fix(storage): add Umami analytics injection to hooks.server.ts (+2/-1)
- `e01b740` refactor(analytics): centralize Umami tracking via env vars and shared utility (+319/-52)
- `0786e6b` feat(mukke): add real-time frequency bars visualizer (+284/-3)
- `2d7ca7e` docs(mukke): add comprehensive visualizer system concept (+490/-0)
- `2c26fce` fix: replace all manacore.app URLs with mana.how (+100/-103)
- `f043db2` feat(analytics): add automatic auth event tracking via shared-auth (+44/-2)
- `6c140c1` docs(mukke): add visualizer alternatives and technology comparison (+417/-0)
- `7954416` feat(analytics): add key action tracking to todo, calendar, chat, contacts (+12/-0)
- `f5ee3aa` feat(security): add unified CSP headers to all 17 web apps (+246/-58)
- `cc9679d` refactor(analytics): centralize landing page Umami tracking via env vars (+216/-25)
- `45c11a1` feat(analytics): add event tracking to picture, storage, clock, mukke, planta (+12/-0)

_… plus 7 weitere Commits._
