---
date: 2026-03-15
day: 55
view: macher
weekday: Sonntag
commits: 8
review: written
---

# Sonntag, 2026-03-15 — Tag 55 (Macher-Sicht)

## Stats

8 Commits, +17780 / −8006 LoC, 185 Files. Top-Dirs: `apps/traces/apps/mobile` (37%), `apps/calendar/apps/web` (24%), `apps/traces/apps/backend` (13%), `apps/calendar/apps/backend` (6%), `pnpm-lock.yaml` (2%). Tags: calendar, traces, monorepo, picture-mobile, ci. Session 07:12 → 11:43 (~55 aktive Min, längster Fokus 55 Min).

## Commits

- `bd1178e` feat(traces): integrate traces app into monorepo with NestJS backend and AI city guides (+14503/-708)
- `32c6f09` feat(calendar): add critical production security and performance fixes (+239/-114)
- `a39e4ca` fix(calendar): fix Dockerfile healthcheck ports and add ENCRYPTION_KEY to prod (+11/-10)
- `a2569eb` fix(monorepo): add .npmrc with node-linker=hoisted for EAS Build compatibility (+1/-0)
- `d72dfa2` fix(calendar): add @nestjs/throttler as explicit dependency (+545/-443)
- `2ac05ef` fix(picture-mobile): make patch-package non-fatal in postinstall (+1/-1)
- `7bb4b1d` fix(ci): auto-generate CALENDAR_ENCRYPTION_KEY in prod env (+9/-0)
- `7f5c70c` feat(calendar): production hardening - cleanup, tests, a11y, error handling (+2471/-6730)
